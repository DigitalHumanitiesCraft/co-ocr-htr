/**
 * Post-Processing Orchestrator Service (PPV1-201)
 *
 * Runs Stage 2 (Paleographic Review) and Stage 3 (Philological Review)
 * sequentially, with error isolation and fallback to single-call review.
 *
 * Design principles:
 * - Stage 2 failure does NOT block Stage 3
 * - Double failure falls back to existing single LLM Review
 * - Timeouts and budgets enforced per call and per page
 * - Returns a merged llmJudge shape compatible with existing UI
 */

import { llmService, buildPaleographicReviewPrompt, buildPhilologicalReviewPrompt } from './llm.js';
import {
  POSTPROCESS_CALL_TIMEOUT_MS,
  POSTPROCESS_PAGE_BUDGET_MS,
  POSTPROCESS_MAX_RETRIES,
  POSTPROCESS_BACKOFF_BASE_MS,
  MAX_POSTPROCESS_CALLS
} from '../utils/constants.js';

// ============================================
// Merge Logic (PPV1-202)
// ============================================

/**
 * Merge issues from multiple stages. Rules:
 * 1. Identical suggestions (same line + text + suggestion) are deduplicated
 * 2. Conflicting suggestions (same line + text, different suggestion) are kept as separate issues
 * 3. No silent auto-resolve
 *
 * @param {Array} stage2Issues - Issues from paleographic review
 * @param {Array} stage3Issues - Issues from philological review
 * @returns {Array} Merged and deduplicated issues
 */
export function mergeStageIssues(stage2Issues = [], stage3Issues = []) {
  const merged = [...stage2Issues];
  const signatureSet = new Set(
    stage2Issues.map(i => issueSignature(i))
  );

  for (const issue of stage3Issues) {
    const sig = issueSignature(issue);
    if (!signatureSet.has(sig)) {
      merged.push(issue);
      signatureSet.add(sig);
    }
    // else: identical suggestion already present, skip (deduplicate)
  }

  // Sort by line number for consistent display
  merged.sort((a, b) => (a.line || 0) - (b.line || 0));

  return merged;
}

/**
 * Build a deduplication signature for an issue.
 * Two issues are considered identical if they target the same line+text+suggestion.
 */
function issueSignature(issue) {
  return `${issue.line || 0}|${(issue.text || '').trim()}|${(issue.suggestion || '').trim()}`;
}

/**
 * Merge confidence: use the more cautious (lower) confidence.
 * Order: uncertain < likely < confident
 */
function mergeConfidence(c1, c2) {
  const order = { 'uncertain': 0, 'likely': 1, 'confident': 2 };
  const v1 = order[c1] ?? 0;
  const v2 = order[c2] ?? 0;
  const entries = Object.entries(order);
  const minVal = Math.min(v1, v2);
  const match = entries.find(([, v]) => v === minVal);
  return match ? match[0] : 'uncertain';
}

// ============================================
// Orchestrator
// ============================================

/**
 * Run the full post-processing pipeline for a single page.
 *
 * @param {string} text - Transcription text to review
 * @param {object} options
 * @param {string} [options.contextDescription] - Document context string
 * @param {boolean} [options.runStage2=true] - Whether to run paleographic review
 * @param {boolean} [options.runStage3=true] - Whether to run philological review
 * @param {object|null} [options.promptConfig] - Prompt profile + stage overrides
 * @param {number} [options.maxCalls] - Maximum LLM API calls per page, including retries (defaults to MAX_POSTPROCESS_CALLS)
 * @param {AbortSignal} [options.signal] - External abort signal
 * @returns {Promise<object>} Merged llmJudge result
 */
export async function runPostprocessing(text, options = {}) {
  const {
    contextDescription = '',
    runStage2 = true,
    runStage3 = true,
    promptConfig = null,
    maxCalls = MAX_POSTPROCESS_CALLS,
    signal = null
  } = options;

  const pageStart = Date.now();
  const callLimit = Math.max(0, Math.floor(Number(maxCalls) || 0));
  const callBudget = { used: 0, limit: callLimit };

  let stage2Result = null;
  let stage3Result = null;
  let stage2Error = null;
  let stage3Error = null;
  let stage2Meta = {
    status: 'skipped',
    reason: runStage2 ? 'not_run' : 'disabled'
  };
  let stage3Meta = {
    status: 'skipped',
    reason: runStage3 ? 'not_run' : 'disabled'
  };

  // Stage 2: Paleographic Review
  if (runStage2) {
    if (!hasCallBudget(callBudget)) {
      stage2Meta = { status: 'skipped', reason: 'max_calls_reached' };
    } else {
      const stageStart = Date.now();
      try {
        checkBudget(pageStart, signal);
        const prompt = buildPaleographicReviewPrompt(text, contextDescription, promptConfig);
        stage2Result = await callWithGuardrails(prompt, signal, pageStart, callBudget);
        // Tag all issues with stage
        if (stage2Result?.issues) {
          stage2Result.issues = stage2Result.issues.map(i => ({ ...i, stage: i.stage || 'paleographic' }));
        }
        stage2Meta = { status: 'success', duration: Date.now() - stageStart };
        console.log(`[Postprocess] Stage 2 OK: ${stage2Result.issues?.length || 0} issues`);
      } catch (error) {
        stage2Error = error;
        stage2Meta = { status: 'error', duration: Date.now() - stageStart, reason: error.message };
        console.warn(`[Postprocess] Stage 2 FAILED: ${error.message}`);
      }
    }
  }

  // Stage 3: Philological Review
  if (runStage3) {
    if (!hasCallBudget(callBudget)) {
      stage3Meta = { status: 'skipped', reason: 'max_calls_reached' };
    } else {
      const stageStart = Date.now();
      try {
        checkBudget(pageStart, signal);
        const previousIssues = stage2Result?.issues || [];
        const prompt = buildPhilologicalReviewPrompt(text, contextDescription, previousIssues, promptConfig);
        stage3Result = await callWithGuardrails(prompt, signal, pageStart, callBudget);
        // Tag all issues with stage
        if (stage3Result?.issues) {
          stage3Result.issues = stage3Result.issues.map(i => ({ ...i, stage: i.stage || 'philological' }));
        }
        stage3Meta = { status: 'success', duration: Date.now() - stageStart };
        console.log(`[Postprocess] Stage 3 OK: ${stage3Result.issues?.length || 0} issues`);
      } catch (error) {
        stage3Error = error;
        stage3Meta = { status: 'error', duration: Date.now() - stageStart, reason: error.message };
        console.warn(`[Postprocess] Stage 3 FAILED: ${error.message}`);
      }
    }
  }

  // Both stages failed -> fall back to single LLM Review
  if (!stage2Result && !stage3Result) {
    console.warn('[Postprocess] Both stages failed, falling back to single LLM Review');
    return {
      fallbackUsed: true,
      stage2Error: stage2Error?.message,
      stage3Error: stage3Error?.message,
      pipeline: {
        stage2: stage2Meta,
        stage3: stage3Meta,
        apiCallsUsed: callBudget.used,
        apiCallLimit: callBudget.limit,
        duration: Date.now() - pageStart
      }
    };
  }

  // Merge results
  const mergedIssues = mergeStageIssues(
    stage2Result?.issues || [],
    stage3Result?.issues || []
  );

  const availableConfidences = [stage2Result?.confidence, stage3Result?.confidence]
    .filter(c => typeof c === 'string' && c.trim().length > 0);
  const confidence = availableConfidences.length > 0
    ? availableConfidences.reduce((acc, next) => mergeConfidence(acc, next))
    : 'uncertain';

  const reasoningParts = [];
  if (stage2Result?.reasoning) reasoningParts.push(`Paleographic: ${stage2Result.reasoning}`);
  if (stage3Result?.reasoning) reasoningParts.push(`Philological: ${stage3Result.reasoning}`);
  if (stage2Error) reasoningParts.push(`Paleographic review failed: ${stage2Error.message}`);
  if (stage3Error) reasoningParts.push(`Philological review failed: ${stage3Error.message}`);

  return {
    confidence,
    reasoning: reasoningParts.join(' | '),
    summary: `${mergedIssues.length} issues from ${[stage2Result && 'paleographic', stage3Result && 'philological'].filter(Boolean).join(' + ')} review.`,
    issues: mergedIssues,
    pipeline: {
      stage2: stage2Meta,
      stage3: stage3Meta,
      apiCallsUsed: callBudget.used,
      apiCallLimit: callBudget.limit,
      duration: Date.now() - pageStart
    }
  };
}

// ============================================
// Call with Guardrails
// ============================================

/**
 * Call llmService.validate() with post-processing timeouts and retry logic.
 *
 * @param {string} prompt - The full prompt (already built by Stage prompt builders)
 * @param {AbortSignal|null} signal - External abort signal
 * @param {number} pageStart - Timestamp when page processing started
 * @param {{used:number, limit:number}} callBudget - Shared per-page API call budget
 * @returns {Promise<object>} Parsed validation response
 */
async function callWithGuardrails(prompt, signal, pageStart, callBudget) {
  let lastError;

  for (let attempt = 0; attempt <= POSTPROCESS_MAX_RETRIES; attempt++) {
    try {
      checkBudget(pageStart, signal);
      if (!consumeCallBudget(callBudget)) {
        throw lastError || new Error('Post-processing max calls reached');
      }

      // Use the LLM service's validate method with custom prompt
      // The prompt already contains the text, so we pass a dummy text and override via customPrompt
      const result = await Promise.race([
        llmService.validate('', { customPrompt: prompt }),
        timeoutPromise(POSTPROCESS_CALL_TIMEOUT_MS)
      ]);

      return result;
    } catch (error) {
      lastError = error;

      // Don't retry on non-retryable errors
      if (isNonRetryable(error)) {
        throw error;
      }

      // Don't retry if budget is exhausted
      const elapsed = Date.now() - pageStart;
      if (elapsed >= POSTPROCESS_PAGE_BUDGET_MS) {
        throw lastError;
      }

      // Exponential backoff
      if (attempt < POSTPROCESS_MAX_RETRIES) {
        if (!hasCallBudget(callBudget)) {
          throw lastError;
        }
        const delay = POSTPROCESS_BACKOFF_BASE_MS * Math.pow(2, attempt);
        console.log(`[Postprocess] Retry ${attempt + 1}/${POSTPROCESS_MAX_RETRIES} after ${delay}ms`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Check if page time budget is still available and signal is not aborted.
 */
function checkBudget(pageStart, signal) {
  if (signal?.aborted) {
    throw new Error('Post-processing aborted');
  }
  const elapsed = Date.now() - pageStart;
  if (elapsed >= POSTPROCESS_PAGE_BUDGET_MS) {
    throw new Error(`Page budget exhausted (${elapsed}ms >= ${POSTPROCESS_PAGE_BUDGET_MS}ms)`);
  }
}

function hasCallBudget(callBudget) {
  return Number.isFinite(callBudget?.limit) && callBudget.limit > callBudget.used;
}

function consumeCallBudget(callBudget) {
  if (!hasCallBudget(callBudget)) return false;
  callBudget.used += 1;
  return true;
}

/**
 * Create a promise that rejects after a timeout.
 */
function timeoutPromise(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Post-processing call timed out after ${ms}ms`)), ms);
  });
}

/**
 * Check if an error is non-retryable (auth, config errors).
 */
function isNonRetryable(error) {
  const msg = error.message || '';
  return msg.includes('No API key') ||
         msg.includes('Invalid API key') ||
         msg.includes('401') ||
         msg.includes('Unauthorized') ||
         msg.includes('not implemented') ||
         msg.includes('aborted');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
