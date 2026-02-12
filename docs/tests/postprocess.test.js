/**
 * Tests for Post-Processing Orchestrator (PPV1-201, PPV1-202)
 *
 * Tests merge logic, stage tagging, and deduplication.
 * Orchestrator integration tests mock llmService.validate().
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mergeStageIssues, runPostprocessing } from '../js/services/postprocess.js';
import { llmService } from '../js/services/llm.js';

// ============================================
// Merge Logic Tests (PPV1-202)
// ============================================

describe('mergeStageIssues', () => {
  it('should return empty array when both stages empty', () => {
    expect(mergeStageIssues([], [])).toEqual([]);
  });

  it('should return stage2 issues when stage3 is empty', () => {
    const issues = [
      { line: 1, text: 'a', suggestion: 'b', type: 'spelling', stage: 'paleographic' }
    ];
    expect(mergeStageIssues(issues, [])).toEqual(issues);
  });

  it('should return stage3 issues when stage2 is empty', () => {
    const issues = [
      { line: 2, text: 'x', suggestion: 'y', type: 'plausibility', stage: 'philological' }
    ];
    expect(mergeStageIssues([], issues)).toEqual(issues);
  });

  it('should merge non-overlapping issues from both stages', () => {
    const s2 = [
      { line: 1, text: 'domiuuui', suggestion: 'dominum', type: 'spelling', stage: 'paleographic' }
    ];
    const s3 = [
      { line: 5, text: 'ecclesiast', suggestion: 'ecclesiasticum', type: 'plausibility', stage: 'philological' }
    ];
    const merged = mergeStageIssues(s2, s3);
    expect(merged).toHaveLength(2);
    expect(merged[0].line).toBe(1); // sorted by line
    expect(merged[1].line).toBe(5);
  });

  it('should deduplicate identical suggestions (same line+text+suggestion)', () => {
    const s2 = [
      { line: 3, text: 'miuimu', suggestion: 'minimum', type: 'spelling', stage: 'paleographic' }
    ];
    const s3 = [
      { line: 3, text: 'miuimu', suggestion: 'minimum', type: 'spelling', stage: 'philological' }
    ];
    const merged = mergeStageIssues(s2, s3);
    expect(merged).toHaveLength(1);
    expect(merged[0].stage).toBe('paleographic'); // keeps first (stage2)
  });

  it('should keep conflicting suggestions (same line+text, different suggestion)', () => {
    const s2 = [
      { line: 7, text: 'domiuus', suggestion: 'dominus', type: 'spelling', stage: 'paleographic' }
    ];
    const s3 = [
      { line: 7, text: 'domiuus', suggestion: 'dominium', type: 'plausibility', stage: 'philological' }
    ];
    const merged = mergeStageIssues(s2, s3);
    expect(merged).toHaveLength(2);
    expect(merged[0].suggestion).toBe('dominus');
    expect(merged[1].suggestion).toBe('dominium');
  });

  it('should sort merged issues by line number', () => {
    const s2 = [
      { line: 10, text: 'a', suggestion: 'b', type: 'spelling', stage: 'paleographic' },
      { line: 2, text: 'c', suggestion: 'd', type: 'spelling', stage: 'paleographic' }
    ];
    const s3 = [
      { line: 5, text: 'e', suggestion: 'f', type: 'plausibility', stage: 'philological' }
    ];
    const merged = mergeStageIssues(s2, s3);
    expect(merged.map(i => i.line)).toEqual([2, 5, 10]);
  });

  it('should handle issues with missing line (defaults to 0 in signature)', () => {
    const s2 = [
      { text: 'a', suggestion: 'b', type: 'spelling', stage: 'paleographic' }
    ];
    const s3 = [
      { text: 'a', suggestion: 'b', type: 'spelling', stage: 'philological' }
    ];
    const merged = mergeStageIssues(s2, s3);
    expect(merged).toHaveLength(1); // deduplicated (both line=0)
  });

  it('should trim text and suggestion for deduplication', () => {
    const s2 = [
      { line: 1, text: ' word ', suggestion: ' fix ', type: 'spelling', stage: 'paleographic' }
    ];
    const s3 = [
      { line: 1, text: 'word', suggestion: 'fix', type: 'spelling', stage: 'philological' }
    ];
    const merged = mergeStageIssues(s2, s3);
    expect(merged).toHaveLength(1);
  });

  it('should deduplicate issues after marker normalization (PPV1-302)', () => {
    // Two issues whose text differs only by marker variant should still be distinct
    // because normalization happens BEFORE merge in _normalizeIssue, not inside merge.
    // But if text is already normalized to canonical form, dedup should work.
    const s2 = [
      { line: 1, text: '[?]', suggestion: 'dominus', type: 'spelling', stage: 'paleographic' }
    ];
    const s3 = [
      { line: 1, text: '[?]', suggestion: 'dominus', type: 'spelling', stage: 'philological' }
    ];
    const merged = mergeStageIssues(s2, s3);
    expect(merged).toHaveLength(1);
    expect(merged[0].stage).toBe('paleographic');
  });

  it('should deduplicate issues with canonical [illegible] marker', () => {
    const s2 = [
      { line: 5, text: '[illegible]', suggestion: 'word', type: 'illegible', stage: 'paleographic' }
    ];
    const s3 = [
      { line: 5, text: '[illegible]', suggestion: 'word', type: 'illegible', stage: 'philological' }
    ];
    const merged = mergeStageIssues(s2, s3);
    expect(merged).toHaveLength(1);
  });

  it('should deduplicate issues with canonical [...] marker', () => {
    const s2 = [
      { line: 3, text: '[...]', suggestion: 'missing text', type: 'spelling', stage: 'paleographic' }
    ];
    const s3 = [
      { line: 3, text: '[...]', suggestion: 'missing text', type: 'plausibility', stage: 'philological' }
    ];
    const merged = mergeStageIssues(s2, s3);
    expect(merged).toHaveLength(1);
  });

  it('should keep issues with same marker but different suggestions', () => {
    const s2 = [
      { line: 2, text: '[?]', suggestion: 'dominus', type: 'spelling', stage: 'paleographic' }
    ];
    const s3 = [
      { line: 2, text: '[?]', suggestion: 'dominium', type: 'plausibility', stage: 'philological' }
    ];
    const merged = mergeStageIssues(s2, s3);
    expect(merged).toHaveLength(2);
  });

  it('should preserve all fields including optional metadata', () => {
    const s2 = [
      {
        line: 1, text: 'a', suggestion: 'b', type: 'spelling',
        stage: 'paleographic', score: 0.9, alternatives: ['c'],
        explanation: 'minim'
      }
    ];
    const merged = mergeStageIssues(s2, []);
    expect(merged[0].score).toBe(0.9);
    expect(merged[0].alternatives).toEqual(['c']);
    expect(merged[0].explanation).toBe('minim');
  });
});

// ============================================
// Orchestrator Runtime Tests (F4)
// ============================================

describe('runPostprocessing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should run stage2 and stage3 successfully and return canonical pipeline metadata', async () => {
    const validateSpy = vi.spyOn(llmService, 'validate')
      .mockResolvedValueOnce({
        confidence: 'confident',
        reasoning: 'paleo reasoning',
        issues: [{ line: 1, text: 'domiuus', suggestion: 'dominus', type: 'spelling' }]
      })
      .mockResolvedValueOnce({
        confidence: 'likely',
        reasoning: 'philo reasoning',
        issues: [{ line: 2, text: 'ecclesiast', suggestion: 'ecclesiasticum', type: 'plausibility' }]
      });

    const result = await runPostprocessing('line1\nline2', {
      contextDescription: 'Latin charter, 13th century'
    });

    expect(validateSpy).toHaveBeenCalledTimes(2);
    expect(result.pipeline.stage2.status).toBe('success');
    expect(result.pipeline.stage3.status).toBe('success');
    expect(result.pipeline.duration).toBeTypeOf('number');
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0].stage).toBe('paleographic');
    expect(result.issues[1].stage).toBe('philological');
    expect(validateSpy.mock.calls[0][1].customPrompt).toContain('DOCUMENT CONTEXT:');
    expect(validateSpy.mock.calls[0][1].customPrompt).toContain('Latin charter, 13th century');
  });

  it('should continue with stage3 when stage2 fails', async () => {
    const validateSpy = vi.spyOn(llmService, 'validate')
      .mockRejectedValueOnce(new Error('Unauthorized'))
      .mockResolvedValueOnce({
        confidence: 'likely',
        reasoning: 'stage3 ok',
        issues: [{ line: 3, text: 'miuimu', suggestion: 'minimum', type: 'plausibility' }]
      });

    const result = await runPostprocessing('text', {
      contextDescription: 'Test context'
    });

    expect(validateSpy).toHaveBeenCalledTimes(2);
    expect(result.pipeline.stage2.status).toBe('error');
    expect(result.pipeline.stage2.reason).toContain('Unauthorized');
    expect(result.pipeline.stage3.status).toBe('success');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].stage).toBe('philological');
  });

  it('should return fallback marker when both stages fail', async () => {
    const validateSpy = vi.spyOn(llmService, 'validate')
      .mockRejectedValue(new Error('Unauthorized'));

    const result = await runPostprocessing('text');

    expect(validateSpy).toHaveBeenCalledTimes(2);
    expect(result.fallbackUsed).toBe(true);
    expect(result.pipeline.stage2.status).toBe('error');
    expect(result.pipeline.stage3.status).toBe('error');
  });

  it('should enforce max stage calls per page', async () => {
    const validateSpy = vi.spyOn(llmService, 'validate')
      .mockResolvedValueOnce({
        confidence: 'confident',
        reasoning: 'stage2 ok',
        issues: []
      });

    const result = await runPostprocessing('text', {
      runStage2: true,
      runStage3: true,
      maxCalls: 1
    });

    expect(validateSpy).toHaveBeenCalledTimes(1);
    expect(result.pipeline.stage2.status).toBe('success');
    expect(result.pipeline.stage3.status).toBe('skipped');
    expect(result.pipeline.stage3.reason).toBe('max_calls_reached');
  });

  it('should apply stage prompt overrides from promptConfig', async () => {
    const validateSpy = vi.spyOn(llmService, 'validate')
      .mockResolvedValueOnce({
        confidence: 'likely',
        reasoning: 'stage2 only',
        issues: []
      });

    await runPostprocessing('text', {
      runStage2: true,
      runStage3: false,
      promptConfig: {
        profileId: 'generic_default',
        overrides: {
          stage1: '',
          stage2: 'CUSTOM STAGE2 OVERRIDE\nTRANSCRIPTION:\n{text}',
          stage3: ''
        }
      }
    });

    expect(validateSpy).toHaveBeenCalledTimes(1);
    expect(validateSpy.mock.calls[0][1].customPrompt).toContain('CUSTOM STAGE2 OVERRIDE');
    expect(validateSpy.mock.calls[0][1].customPrompt).toContain('TRANSCRIPTION:\ntext');
  });

  it('should count retries against maxCalls and skip later stages when exhausted', async () => {
    const validateSpy = vi.spyOn(llmService, 'validate')
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValueOnce({
        confidence: 'likely',
        reasoning: 'stage2 recovered',
        issues: [{ line: 1, text: 'domiuus', suggestion: 'dominus', type: 'spelling' }]
      });

    const result = await runPostprocessing('text', {
      runStage2: true,
      runStage3: true,
      maxCalls: 2
    });

    expect(validateSpy).toHaveBeenCalledTimes(2);
    expect(result.pipeline.stage2.status).toBe('success');
    expect(result.pipeline.stage3.status).toBe('skipped');
    expect(result.pipeline.stage3.reason).toBe('max_calls_reached');
    expect(result.pipeline.apiCallsUsed).toBe(2);
    expect(result.pipeline.apiCallLimit).toBe(2);
  });
});

// ============================================
// Prompt Builder Tests
// ============================================

describe('Prompt Builders', () => {
  // Test imports work
  it('should export buildPaleographicReviewPrompt', async () => {
    const { buildPaleographicReviewPrompt } = await import('../js/services/llm.js');
    expect(typeof buildPaleographicReviewPrompt).toBe('function');
  });

  it('should export buildPhilologicalReviewPrompt', async () => {
    const { buildPhilologicalReviewPrompt } = await import('../js/services/llm.js');
    expect(typeof buildPhilologicalReviewPrompt).toBe('function');
  });

  it('should build paleographic prompt with text and context', async () => {
    const { buildPaleographicReviewPrompt } = await import('../js/services/llm.js');
    const prompt = buildPaleographicReviewPrompt('Line 1\nLine 2', 'This is a textura manuscript.');
    expect(prompt).toContain('Line 1');
    expect(prompt).toContain('letterform confusion');
    expect(prompt).toContain('textura manuscript');
  });

  it('should build philological prompt with previous issues', async () => {
    const { buildPhilologicalReviewPrompt } = await import('../js/services/llm.js');
    const prev = [{ line: 1, text: 'old', suggestion: 'new', type: 'spelling' }];
    const prompt = buildPhilologicalReviewPrompt('Line 1', '', prev);
    expect(prompt).toContain('morphology/syntax/formula plausibility');
    expect(prompt).toContain('Line 1: "old" -> "new"');
  });

  it('should handle empty previous issues in philological prompt', async () => {
    const { buildPhilologicalReviewPrompt } = await import('../js/services/llm.js');
    const prompt = buildPhilologicalReviewPrompt('text', '', []);
    expect(prompt).toContain('No previous issues flagged');
  });
});

// ============================================
// Feature Flag Tests
// ============================================

describe('Feature Flags', () => {
  it('should have postprocessPipelineV1 flag defaulting to false', async () => {
    const { FEATURE_FLAGS } = await import('../js/utils/constants.js');
    expect(FEATURE_FLAGS.postprocessPipelineV1).toBe(false);
  });
});
