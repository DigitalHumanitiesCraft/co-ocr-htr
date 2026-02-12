/**
 * LLM Service
 * Unified abstraction for multiple LLM providers with vision capabilities
 *
 * SECURITY NOTE: API keys are always used from in-memory runtime state.
 * Optional persistence (if enabled by user) is handled outside this service
 * via IndexedDB and restored into memory on startup.
 */

import { normalizeMarkers } from '../utils/textFormatting.js';

// ============================================
// Timeouts
// ============================================

/** Timeout for cloud LLM API calls (240 seconds -- HTR with large documents needs time) */
const CLOUD_TIMEOUT_MS = 240_000;

/** Timeout for local Ollama calls (480 seconds -- local inference is significantly slower) */
const OLLAMA_TIMEOUT_MS = 480_000;

// ============================================
// Prompts
// ============================================

/**
 * Base transcription prompt - will be enhanced with context if provided
 */
const TRANSCRIPTION_PROMPT_BASE = `You are a specialist for diplomatic transcription of historical manuscripts.

TASK: Produce a conservative, line-faithful transcription from the manuscript image.

CORE RULES:
- Preserve original line breaks exactly as visible in the manuscript
- Preserve original spelling, capitalization, and punctuation (no modernization)
- Keep abbreviations exactly as written (do NOT expand or normalize)
- Mark uncertain readings with [?] directly before the uncertain token (e.g., "[?]word")
- Mark unreadable spans with [illegible]
- Never invent missing text; if unsure, mark uncertainty instead of guessing

OUTPUT:
- Return only the transcribed text
- No commentary, no explanations, no JSON
- Begin directly with the first transcribed line`;

/**
 * Build script-specific transcription hints based on structured context.
 * Returns empty string if no relevant context is available.
 * @param {object} [structuredContext] - Structured context from state
 * @returns {string} Script-specific rules block
 */
function buildScriptHints(structuredContext) {
    if (!structuredContext?.scriptType) return '';
    const hints = [];
    const script = structuredContext.scriptType;

    // Script-specific paleographic warnings
    if (script === 'textura' || script === 'bastarda') {
        hints.push('- CRITICAL: This script uses minim-heavy letterforms. Pay close attention to n/u/m/in/iu/ni disambiguation');
        hints.push('- Watch for long-s (similar to f) and round-s distinctions');
    }
    if (script === 'cursiva' || script === 'bastarda' || script === 'kurrent') {
        hints.push('- Watch for c/t and e/r confusions common in cursive hands');
    }
    if (script === 'kurrent') {
        hints.push('- This is Kurrent/Suetterlin script: watch for e/n, h/y, f/s, and u/ue letter confusions');
    }
    if (script === 'insular' || script === 'uncial') {
        hints.push('- Watch for insular/uncial letterforms: d/cl, r/s, and distinct letter shapes');
    }
    if (script === 'carolingian') {
        hints.push('- Caroline minuscule: generally clear but watch for tironian et, ampersands, and abbreviation marks');
    }

    return hints.length > 0 ? '\n' + hints.join('\n') : '';
}

/**
 * Build the full transcription prompt, optionally enhanced with context
 * @param {string} contextDescription - Additional context from the expert
 * @param {object} [structuredContext] - Structured context for script hints
 * @returns {string} The complete prompt
 */
function buildTranscriptionPrompt(contextDescription = '', structuredContext = null) {
    const scriptHints = buildScriptHints(structuredContext);

    if (contextDescription) {
        return `You are a specialist for diplomatic transcription of historical manuscripts.

DOCUMENT CONTEXT (provided by the expert):
${contextDescription}

TASK: Produce a conservative, line-faithful transcription, using the context only to disambiguate readings.

INTERNAL WORKFLOW (do internally, do not output):
1) Read glyph shapes and abbreviations first (paleographic pass)
2) Re-check each line for local consistency (line pass)
3) Apply uncertainty markers conservatively instead of speculative reconstruction

CORE RULES:
- Preserve original line breaks exactly as visible in the manuscript
- Preserve original spelling, capitalization, and punctuation (no modernization)
- Keep abbreviations exactly as written (do NOT expand or normalize)
- Mark uncertain readings with [?] directly before the uncertain token
- Mark unreadable spans with [illegible]
- Never invent missing text; if unsure, mark uncertainty instead of guessing${scriptHints}

OUTPUT:
- Return only the transcribed text
- No commentary, no explanations, no JSON
- Begin directly with the first transcribed line`;
    }

    if (scriptHints) {
        return `You are a specialist for diplomatic transcription of historical manuscripts.

TASK: Produce a conservative, line-faithful transcription.

INTERNAL WORKFLOW (do internally, do not output):
1) Read glyph shapes and abbreviations first (paleographic pass)
2) Re-check each line for local consistency (line pass)
3) Apply uncertainty markers conservatively instead of speculative reconstruction

CORE RULES:
- Preserve original line breaks exactly as visible in the manuscript
- Preserve original spelling, capitalization, and punctuation (no modernization)
- Keep abbreviations exactly as written (do NOT expand or normalize)
- Mark uncertain readings with [?] directly before the uncertain token
- Mark unreadable spans with [illegible]
- Never invent missing text; if unsure, mark uncertainty instead of guessing${scriptHints}

OUTPUT:
- Return only the transcribed text
- No commentary, no explanations, no JSON
- Begin directly with the first transcribed line`;
    }

    return TRANSCRIPTION_PROMPT_BASE;
}

/**
 * Default description prompt for illuminated initials analysis
 */
const DESCRIPTION_PROMPT_BASE = `You are an expert in medieval manuscript studies and art history.

Task: Analyze and describe the illuminated initials and decorative elements in this manuscript page.

Focus on:
1. Historiated Initials: Letter forms containing biblical scenes or narrative imagery
2. Decorative Elements: Colors (gold, lapis, vermillion), borders, flourishes
3. Iconography: Biblical scenes, saints, symbols, gestures
4. Style & Period: Artistic style indicators (Romanesque, Gothic, Renaissance)
5. Technical Details: Gilding techniques, pigments, marginalia

Format your response with clear sections for initials, iconography, artistic style, and technical observations.

Be specific, scholarly, and note uncertainties. Use Latin terms where appropriate.`;

/**
 * Build description prompt - uses default or custom prompt
 * @param {string} customPrompt - Optional custom prompt from user
 * @returns {string} The complete description prompt
 */
function buildDescriptionPrompt(customPrompt = '') {
    return customPrompt.trim() || DESCRIPTION_PROMPT_BASE;
}

/**
 * Valid issue type identifiers for structured validation results.
 * Used by _normalizeIssueType() and contract enforcement.
 */
const VALID_ISSUE_TYPES = [
  'spelling', 'accent', 'abbreviation', 'illegible',
  'ocr_artifact', 'historical', 'structural', 'plausibility'
];

/**
 * Issue types for structured validation results
 * Labels kept in German for UI display consistency
 */
const ISSUE_TYPES = {
  spelling: { name: 'Spelling', color: 'warning', description: 'Orthographic error' },
  accent: { name: 'Accent', color: 'warning', description: 'Incorrect accent/diacritics' },
  abbreviation: { name: 'Abbreviation', color: 'info', description: 'Check abbreviation expansion' },
  illegible: { name: 'Illegible', color: 'error', description: 'Cannot be deciphered' },
  ocr_artifact: { name: 'OCR Artifact', color: 'error', description: 'Technical OCR error' },
  historical: { name: 'Historical', color: 'info', description: 'Historical spelling (correct)' },
  structural: { name: 'Structural', color: 'warning', description: 'Layout or structure error' },
  plausibility: { name: 'Plausibility', color: 'warning', description: 'Content questionable' }
};

/**
 * Common issue type instruction for all prompts
 */
const ISSUE_TYPE_INSTRUCTION = `
For each issue found, classify it with one of the following types:
- "spelling": Spelling error (e.g., transposed letters)
- "accent": Accent/diacritics error (e.g., é instead of è)
- "abbreviation": Abbreviation unclear or incorrectly expanded
- "illegible": Passage not readable or unclearly transcribed
- "ocr_artifact": Technical OCR error (e.g., special character instead of letter)
- "historical": Historical spelling (not an error, but unusual for modern readers)
- "structural": Structural error (column break, table error)
- "plausibility": Content questionable (unrealistic values, anachronisms)
`;

/**
 * Default validation prompt - comprehensive check covering all aspects
 */
const DEFAULT_VALIDATION_PROMPT = `Analyze the following transcription from a historical document:

{text}

Check for potential issues in these areas:

1. PALEOGRAPHIC: Letter confusion (n/u, c/e, i/j, f/s), ligatures, abbreviation marks
2. SPELLING & ACCENTS: Orthographic errors, missing or wrong diacritics
3. STRUCTURAL: Table/column errors, broken lines, layout issues (if applicable)
4. PLAUSIBILITY: Unrealistic values, anachronisms, implausible names/dates

Rate the overall transcription quality:
- "confident": No significant issues found
- "likely": Minor issues that expert should verify
- "uncertain": Multiple problems requiring correction
${ISSUE_TYPE_INSTRUCTION}
Respond ONLY with valid JSON in this exact format:
{
  "confidence": "confident|likely|uncertain",
  "summary": "Brief assessment in 1-2 sentences",
  "issues": [
    {"line": 1, "text": "problematic text", "type": "spelling|accent|abbreviation|illegible|ocr_artifact|historical|structural|plausibility", "suggestion": "correction", "explanation": "why this is an issue"}
  ]
}

If no issues found, return empty issues array. Be specific about line numbers.`;

// ============================================
// Post-Processing Prompts (Stage 2 + Stage 3)
// ============================================

/**
 * Stage 2: Paleographic Review prompt.
 * Focuses on script-level letter confusion and abbreviation signs.
 * MUST NOT do lexical normalization or rewriting.
 */
const PALEOGRAPHIC_REVIEW_PROMPT = `You are an expert paleographer specializing in historical handwriting analysis.

TASK: Review the following transcription for paleographic reading errors (letterform misreadings).

TRANSCRIPTION:
{text}

{context}

INTERNAL REVIEW PROTOCOL (single API call):
- Simulate a short internal exchange between:
  A) Primary Paleographer (generates candidates)
  B) Skeptical Verifier (challenges weak candidates)
- Keep that exchange internal. Output only the final JSON.

FOCUS AREAS:
1. MINIM DISAMBIGUATION: Sequences of minims (vertical strokes) that may have been misread. Common confusions: n/u, m/in, iu/ni, im/um, nn/nu, mi/nu, uu/w. Resolve by checking context.
2. LETTER CONFUSION: Script-specific confusions: long-s vs f, c vs t, c vs e, r vs s, d vs cl, i vs l, v vs b.
3. ABBREVIATION SIGNS: Nasal bars (macrons indicating m/n), suspension marks, special signs (e.g., p with stroke = per/par/pro, tironian et).
4. LIGATURES: Misread ligatures or combined letterforms (st, ct, fi ligatures).

RULES:
- Propose corrections ONLY for paleographic reading errors, not grammar/style/content.
- Anchor every issue to an exact source fragment ("text" field) from one line.
- If you cannot point to an exact fragment, do not emit an issue.
- Do NOT modernize or normalize historical spellings. "Iohannes" is not an error by itself.
- Do NOT expand abbreviations; only flag potential misread abbreviation signs.
- Each "suggestion" must be a single-line replacement (no \\n).
- If multiple plausible readings remain, provide "alternatives".
- Be conservative: prefer fewer, high-quality issues over speculative output.
${ISSUE_TYPE_INSTRUCTION}
Respond ONLY with valid JSON:
{
  "confidence": "confident|likely|uncertain",
  "reasoning": "Brief assessment of paleographic difficulty",
  "issues": [
    {
      "line": 1,
      "text": "original text fragment",
      "suggestion": "corrected reading",
      "type": "spelling|abbreviation|illegible|ocr_artifact",
      "explanation": "paleographic rationale (concise, evidence-based)",
      "alternatives": ["optional alternative reading"],
      "stage": "paleographic",
      "score": 0.85
    }
  ]
}

If no paleographic issues found, return empty issues array. Be specific about line numbers.`;

/**
 * Stage 3: Philological Review prompt.
 * Focuses on language-level plausibility after paleographic pass.
 * MUST NOT delete uncertainty markers without reason.
 */
const PHILOLOGICAL_REVIEW_PROMPT = `You are a philologist specializing in historical texts and manuscript traditions.

TASK: Review the transcription for linguistic/contextual plausibility issues that remain after paleographic review.

TRANSCRIPTION:
{text}

{context}

{previous_issues}

INTERNAL REVIEW PROTOCOL (single API call):
- Simulate a short internal exchange between:
  A) Latin Philologist (morphology/syntax/formula specialist)
  B) Historical Language Verifier (checks variant legitimacy, avoids over-correction)
- Keep that exchange internal. Output only the final JSON.

FOCUS AREAS:
1. MORPHOLOGY & SYNTAX: Words that are morphologically impossible or syntactically implausible in the text's language and period (e.g., wrong case ending, impossible verb form).
2. FORMULA RECOGNITION: Liturgical, legal, or administrative formulas where standard wording is expected. If a known formula is nearly correct but has a clear error, propose the standard reading.
3. LEXICAL PLAUSIBILITY: Words that do not exist in the language/period vocabulary and are likely misreadings rather than rare forms.
4. ABBREVIATION CONTEXT: Abbreviation marks where the expansion is ambiguous and the linguistic context can resolve it (e.g., "p" with stroke: per/par/pro -- context decides).

RULES:
- Do NOT correct valid historical spellings, dialectal forms, or archaic grammar.
- Treat medieval Latin and orthographic variation as normal unless strong counter-evidence exists.
- Do NOT delete or alter [?] or [illegible] unless you provide a clearly justified, confident reading.
- Do NOT repeat issues already flagged in PREVIOUS ISSUES.
- Anchor every issue to an exact source fragment ("text" field) from one line.
- If you cannot point to an exact fragment, do not emit an issue.
- Each "suggestion" must be a single-line replacement (no \\n).
- Be conservative: only flag issues where linguistic evidence clearly supports a correction.
- Prefer the simplest explanation (likely misread/scribal slip before rare emendation).
${ISSUE_TYPE_INSTRUCTION}
Respond ONLY with valid JSON:
{
  "confidence": "confident|likely|uncertain",
  "reasoning": "Brief assessment of linguistic quality",
  "issues": [
    {
      "line": 1,
      "text": "original text fragment",
      "suggestion": "corrected reading",
      "type": "spelling|plausibility|abbreviation|historical",
      "explanation": "linguistic/philological rationale (concise, evidence-based)",
      "stage": "philological",
      "score": 0.80
    }
  ]
}

If no philological issues found, return empty issues array. Be specific about line numbers.`;

/**
 * Build paleographic review prompt (Stage 2)
 * @param {string} text - Transcription text to review
 * @param {string} contextDescription - Document context string
 * @returns {string} Complete prompt
 */
function buildPaleographicReviewPrompt(text, contextDescription = '') {
    const contextBlock = contextDescription
        ? `DOCUMENT CONTEXT:\n${contextDescription}`
        : 'No additional context provided.';
    return PALEOGRAPHIC_REVIEW_PROMPT
        .replace('{text}', text)
        .replace('{context}', contextBlock);
}

/**
 * Build philological review prompt (Stage 3)
 * @param {string} text - Transcription text to review
 * @param {string} contextDescription - Document context string
 * @param {Array} previousIssues - Issues from Stage 2 (to avoid duplicates)
 * @returns {string} Complete prompt
 */
function buildPhilologicalReviewPrompt(text, contextDescription = '', previousIssues = []) {
    const contextBlock = contextDescription
        ? `DOCUMENT CONTEXT:\n${contextDescription}`
        : 'No additional context provided.';
    const issuesBlock = previousIssues.length > 0
        ? `PREVIOUS ISSUES (already flagged, do NOT repeat):\n${previousIssues.map(i => `- Line ${i.line}: "${i.text}" -> "${i.suggestion}" (${i.type})`).join('\n')}`
        : 'No previous issues flagged.';
    return PHILOLOGICAL_REVIEW_PROMPT
        .replace('{text}', text)
        .replace('{context}', contextBlock)
        .replace('{previous_issues}', issuesBlock);
}

/**
 * Build validation prompt - uses default or custom prompt
 * @param {string} text - The transcription text to validate
 * @param {string} customPrompt - Optional custom prompt from user
 * @returns {string} The complete validation prompt
 */
function buildValidationPrompt(text, customPrompt = '') {
    const basePrompt = customPrompt.trim() || DEFAULT_VALIDATION_PROMPT;
    return basePrompt.replace('{text}', text);
}

// ============================================
// Provider Configurations
// ============================================

/**
 * Provider configurations
 *
 * NOTE: Model lists change frequently. Use "Eigenes Modell..." to enter
 * any model ID not listed here. Check provider docs for current models:
 * - Gemini: https://ai.google.dev/models
 * - OpenAI: https://platform.openai.com/docs/models
 * - Anthropic: https://docs.anthropic.com/en/docs/models
 * - Ollama: https://ollama.com/library
 */
const PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
    defaultModel: 'gemini-3-flash-preview',
    models: [
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (fast)', recommended: true },
      { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (best quality)' },
      { id: 'custom', name: 'Custom model...', hint: 'Any Gemini model ID' }
    ],
    authType: 'query',
    supportsVision: true,
    apiKeyUrl: 'https://aistudio.google.com/apikey',
    apiKeyPlaceholder: 'AIza...'
  },
  openai: {
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-5.2',
    models: [
      { id: 'gpt-5.2', name: 'GPT-5.2 (Recommended)', recommended: true },
      { id: 'gpt-5.2-mini', name: 'GPT-5.2 Mini (faster)' },
      { id: 'custom', name: 'Custom model...', hint: 'Any OpenAI model ID' }
    ],
    authType: 'bearer',
    supportsVision: true,
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    apiKeyPlaceholder: 'sk-...'
  },
  anthropic: {
    name: 'Anthropic Claude',
    endpoint: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-sonnet-4-5-20250514',
    models: [
      { id: 'claude-sonnet-4-5-20250514', name: 'Claude 4.5 Sonnet (Recommended)', recommended: true },
      { id: 'claude-haiku-4-5-20250514', name: 'Claude 4.5 Haiku (faster)' },
      { id: 'claude-opus-4-5-20250514', name: 'Claude 4.5 Opus (best quality)' },
      { id: 'custom', name: 'Custom model...', hint: 'e.g. claude-3-opus-*' }
    ],
    authType: 'header',
    supportsVision: true,
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    apiKeyPlaceholder: 'sk-ant-...'
  },
  mistral: {
    name: 'Mistral',
    endpoint: 'https://api.mistral.ai/v1/ocr',
    defaultModel: 'mistral-ocr-latest',
    models: [
      { id: 'mistral-ocr-latest', name: 'Mistral OCR (Recommended)', recommended: true },
      { id: 'custom', name: 'Custom model...', hint: 'Any Mistral OCR model ID' }
    ],
    authType: 'bearer',
    supportsVision: true,
    apiKeyUrl: 'https://console.mistral.ai/api-keys',
    apiKeyPlaceholder: 'mi-...'
  },
  ollama: {
    name: 'Ollama (local)',
    endpoint: 'http://localhost:11434/api/generate',
    defaultModel: 'deepseek-ocr',
    models: [
      { id: 'deepseek-ocr', name: 'DeepSeek-OCR (Recommended)', recommended: true },
      { id: 'llava', name: 'LLaVA' },
      { id: 'llama3.2-vision', name: 'Llama 3.2 Vision' },
      { id: 'custom', name: 'Custom model...', hint: 'ollama list shows installed models' }
    ],
    authType: 'none',
    supportsVision: true,
    apiKeyUrl: null,
    apiKeyPlaceholder: null
  }
};

// ============================================
// LLM Service Class
// ============================================

class LLMService {
  constructor() {
    this.providers = PROVIDERS;
    this.activeProvider = 'gemini';
    this.activeModel = null;

    // Separate validation provider (null = automatic fallback)
    this.validationProvider = null;
    this.validationModel = null;

    // Separate in-memory API key storage for validation provider
    // (prevents overwriting transcription key when same provider used for both)
    this.validationApiKeys = {};
  }

  // ============================================
  // Configuration
  // ============================================

  /**
   * Set the active provider
   * @param {string} providerName - Provider name
   */
  setProvider(providerName) {
    if (!this.providers[providerName]) {
      throw new Error(`Unknown provider: ${providerName}`);
    }
    this.activeProvider = providerName;
    this.activeModel = null; // Reset to default
  }

  /**
   * Set the model for a provider (or active provider if not specified)
   * @param {string} providerOrModel - Provider name or model name
   * @param {string} [modelName] - Model name (if first param is provider)
   */
  setModel(providerOrModel, modelName) {
    if (modelName !== undefined) {
      // Two arguments: provider and model
      if (!this.providers[providerOrModel]) {
        throw new Error(`Unknown provider: ${providerOrModel}`);
      }
      this.providers[providerOrModel].activeModel = modelName;
    } else {
      // One argument: just model name for active provider
      this.activeModel = providerOrModel;
    }
  }

  /**
   * Set API key for a provider
   * @param {string} provider - Provider name
   * @param {string} apiKey - API key
   */
  setApiKey(provider, apiKey) {
    if (!this.providers[provider]) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    // Store in memory for immediate use (storage handles persistence)
    this.providers[provider].apiKey = apiKey;
  }

  /**
   * Set validation API key for a specific provider
   * Stored separately to prevent overwriting transcription key when same provider used
   * @param {string} provider - Provider name
   * @param {string} apiKey - API key
   */
  setValidationApiKey(provider, apiKey) {
    if (!this.providers[provider]) {
      throw new Error(`Unknown validation provider: ${provider}`);
    }
    this.validationApiKeys[provider] = apiKey;
  }

  /**
   * Get validation API key for a specific provider
   * @param {string} provider - Provider name
   * @returns {string|null} API key or null if not set
   */
  getValidationApiKey(provider) {
    return this.validationApiKeys[provider] || null;
  }

  /**
   * Set custom endpoint for a provider (mainly for Ollama)
   * @param {string} provider - Provider name
   * @param {string} endpoint - Endpoint URL
   */
  setEndpoint(provider, endpoint) {
    if (!this.providers[provider]) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    this.providers[provider].endpoint = endpoint;
  }

  /**
   * Get current provider config
   */
  getProviderConfig() {
    return this.providers[this.activeProvider];
  }

  /**
   * Get current model name
   */
  getCurrentModel() {
    const config = this.getProviderConfig();
    return this.activeModel || config.defaultModel;
  }

  /**
   * Check if API key is configured for current provider (runtime memory state)
   */
  hasApiKey() {
    if (this.activeProvider === 'ollama') return true;
    return !!this.providers[this.activeProvider]?.apiKey;
  }

  /**
   * Get list of available providers with their status
   */
  getAvailableProviders() {
    return Object.entries(this.providers).map(([id, config]) => ({
      id,
      name: config.name,
      hasKey: id === 'ollama' || !!config.apiKey,
      supportsVision: config.supportsVision,
      models: config.models,
      isActive: id === this.activeProvider
    }));
  }

  /**
   * Check if current model is OCR-only (cannot do text validation)
   * OCR-only models like DeepSeek-OCR and Mistral OCR are optimized for image-to-text
   * but cannot analyze/validate text without an image
   */
  isOcrOnlyModel() {
    const model = this.getCurrentModel();
    // DeepSeek-OCR and Mistral OCR are specifically OCR models, not general LLMs
    return model.includes('deepseek-ocr') ||
           model.includes('mistral-ocr') ||
           this.activeProvider === 'mistral';
  }

  /**
   * Set explicit validation provider (separate from transcription provider)
   * @param {string} provider - Provider name
   * @param {string} model - Model name (optional, defaults to provider's default)
   */
  setValidationProvider(provider, model = null) {
    if (!this.providers[provider]) {
      throw new Error(`Unknown validation provider: ${provider}`);
    }
    this.validationProvider = provider;
    this.validationModel = model;
    console.log(`[LLM] setValidationProvider: ${provider} (${model || 'default'})`);
  }

  /**
   * Get current validation provider configuration
   * @returns {object|null} { provider, model, name } or null if not configured
   */
  getValidationProvider() {
    if (!this.validationProvider) return null;
    const config = this.providers[this.validationProvider];
    return {
      provider: this.validationProvider,
      model: this.validationModel || config.defaultModel,
      name: config.name
    };
  }

  /**
   * Clear explicit validation provider
   */
  clearValidationProvider() {
    this.validationProvider = null;
    this.validationModel = null;
    console.log('[LLM] clearValidationProvider');
  }

  /**
   * Check if validation provider is explicitly configured
   * @returns {boolean}
   */
  hasValidationProviderConfigured() {
    return this.validationProvider !== null;
  }

  /**
   * Find a fallback provider for validation when using OCR-only models
   * Returns provider info or null if none available
   */
  getValidationFallback() {
    // Priority: configured cloud providers with API keys, then other Ollama models
    const cloudProviders = ['gemini', 'openai', 'anthropic'];

    for (const providerId of cloudProviders) {
      const provider = this.providers[providerId];
      if (provider.apiKey) {
        return {
          provider: providerId,
          model: provider.activeModel || provider.defaultModel,
          name: provider.name
        };
      }
    }

    // Check for other Ollama models that can do text analysis
    // (llama, mistral, etc. - anything that's not OCR-specific)
    if (this.activeProvider === 'ollama') {
      const _ollamaTextModels = ['llama3.2', 'llama3', 'mistral', 'phi3', 'qwen2'];
      // We can't check if these are installed, but we can suggest them
      return {
        provider: 'ollama',
        model: 'llama3.2',
        name: 'Ollama (llama3.2)',
        suggested: true // Indicates this model might not be installed
      };
    }

    return null;
  }

  // ============================================
  // Transcription
  // ============================================

  /**
   * Transcribe an image using the active LLM provider
   * @param {string} imageBase64 - Base64 encoded image (without data URL prefix)
   * @param {object} options - Additional options
   * @returns {Promise<object>} Transcription result
   */
  async transcribe(imageBase64, options = {}) {
    const config = this.getProviderConfig();
    console.log(`[LLM] transcribe() provider=${this.activeProvider}`);

    if (!config.supportsVision) {
      throw new Error(`Provider ${config.name} does not support vision/image input`);
    }

    // Get API key from memory (not persisted for security)
    const apiKey = this.providers[this.activeProvider]?.apiKey;
    if (!apiKey && config.authType !== 'none') {
      throw new Error(`No API key configured for ${config.name}. Please enter your API key in the LLM configuration dialog.`);
    }

    // Build prompt with optional context from expert
    const contextDescription = options.context || '';
    const structuredContext = options.structuredContext || null;
    const prompt = options.prompt || buildTranscriptionPrompt(contextDescription, structuredContext);
    const model = this.getCurrentModel();
    console.log(`[LLM] model=${model} image=${imageBase64 ? 'yes' : 'no'} context=${contextDescription ? 'yes' : 'no'}`);

    try {
      let response;
      const useStream = options.stream && this._supportsThinking(this.activeProvider);

      switch (this.activeProvider) {
        case 'gemini':
          if (useStream) {
            try {
              response = await this._callGeminiStream(apiKey, model, prompt, imageBase64, {
                useThinking: true, thinkingLevel: 'high',
                onThinkingChunk: options.onThinkingChunk,
                timeoutMs: options.timeoutMs
              });
            } catch (streamError) {
              console.warn('[Gemini] Stream fallback in transcribe():', streamError.message);
              options.onStreamError?.(streamError);
              response = await this._callGemini(apiKey, model, prompt, imageBase64);
            }
          } else {
            response = await this._callGemini(apiKey, model, prompt, imageBase64);
          }
          break;
        case 'openai':
          response = await this._callOpenAI(apiKey, model, prompt, imageBase64);
          break;
        case 'anthropic':
          if (useStream) {
            try {
              response = await this._callAnthropicStream(apiKey, model, prompt, imageBase64, {
                onThinkingChunk: options.onThinkingChunk,
                timeoutMs: options.timeoutMs
              });
            } catch (streamError) {
              console.warn('[Anthropic] Stream fallback in transcribe():', streamError.message);
              options.onStreamError?.(streamError);
              response = await this._callAnthropic(apiKey, model, prompt, imageBase64);
            }
          } else {
            response = await this._callAnthropic(apiKey, model, prompt, imageBase64);
          }
          break;
        case 'mistral':
          response = await this._callMistral(apiKey, model, imageBase64);
          break;
        case 'ollama':
          if (useStream) {
            try {
              response = await this._callOllamaStream(model, prompt, imageBase64, {
                onThinkingChunk: options.onThinkingChunk,
                timeoutMs: options.timeoutMs
              });
            } catch (streamError) {
              console.warn('[Ollama] Stream fallback in transcribe():', streamError.message);
              options.onStreamError?.(streamError);
              response = await this._callOllama(model, prompt, imageBase64);
            }
          } else {
            response = await this._callOllama(model, prompt, imageBase64);
          }
          break;
        default:
          throw new Error(`Provider ${this.activeProvider} not implemented`);
      }

      console.log(`[LLM] transcribe() OK, length=${response.length} chars`);
      return {
        provider: this.activeProvider,
        model,
        raw: response
      };
    } catch (error) {
      console.error(`[LLM] transcribe() FAILED:`, error.message);
      throw this._handleError(error);
    }
  }

  // ============================================
  // Description (Illuminated Initials Analysis)
  // ============================================

  /**
   * Describe illuminated initials using Gemini (enforces Gemini-only for vision analysis)
   * @param {string} imageBase64 - Base64 encoded image (without data URL prefix)
   * @param {object} options - Description options
   * @returns {Promise<object>} Description result
   */
  async describe(imageBase64, options = {}) {
    // Use local variables only -- no global provider mutation.
    // This avoids race conditions if transcribe() runs concurrently.
    const apiKey = this.providers.gemini?.apiKey;
    if (!apiKey) {
      throw new Error('Gemini API key required for image description. Please configure it in LLM settings.');
    }

    const model = this.providers.gemini.defaultModel || 'gemini-3-pro-preview';
    const prompt = buildDescriptionPrompt(options.customPrompt);

    console.log(`[LLM] describe() using Gemini model=${model} customPrompt=${!!options.customPrompt}`);

    try {
      let response;

      if (options.stream && this._supportsThinking('gemini')) {
        try {
          response = await this._callGeminiStream(apiKey, model, prompt, imageBase64, {
            useThinking: true, thinkingLevel: 'high',
            onThinkingChunk: options.onThinkingChunk,
            timeoutMs: options.timeoutMs
          });
        } catch (streamError) {
          console.warn('[Gemini] Stream fallback in describe():', streamError.message);
          options.onStreamError?.(streamError);
          response = await this._callGemini(apiKey, model, prompt, imageBase64);
        }
      } else {
        response = await this._callGemini(apiKey, model, prompt, imageBase64);
      }

      console.log(`[LLM] describe() OK, length=${response.length} chars`);
      return {
        provider: 'gemini',
        model,
        raw: response,
        customPrompt: options.customPrompt || ''
      };

    } catch (error) {
      console.error(`[LLM] describe() FAILED:`, error.message);
      throw this._handleError(error);
    }
  }

  // ============================================
  // Validation
  // ============================================

  /**
   * Review transcription using LLM Review
   * @param {string} text - Transcription text to validate
   * @param {object} options - Validation options
   * @returns {Promise<object>} Validation result
   */
  async validate(text, options = {}) {
    // Support legacy signature: validate(text, perspective)
    if (typeof options === 'string') {
      options = { perspective: options };
    }

    const { customPrompt = '' } = options;

    // Extract stream options
    const streamOpts = {
      stream: options.stream,
      onThinkingChunk: options.onThinkingChunk,
      onStreamError: options.onStreamError,
      timeoutMs: options.timeoutMs
    };

    // PRIORITY 1: Explicit validation provider
    if (this.validationProvider) {
      console.log(`[LLM] validate() using explicit provider: ${this.validationProvider}`);
      try {
        return await this._validateWithExplicitProvider(text, customPrompt, streamOpts);
      } catch (error) {
        console.error(`[LLM] validate() explicit provider FAILED:`, error.message);
        throw this._handleError(error);
      }
    }

    // PRIORITY 2: Automatic fallback for OCR-only
    if (this.isOcrOnlyModel()) {
      const fallback = this.getValidationFallback();
      if (fallback) {
        console.log(`[LLM] validate() OCR-only model detected, using fallback: ${fallback.name}`);
        return this._validateWithFallback(text, customPrompt, fallback, streamOpts);
      } else {
        throw new Error(
          `The current model (${this.getCurrentModel()}) is a pure OCR model and cannot perform text validation. ` +
          `Please configure a validation provider in LLM Configuration.`
        );
      }
    }

    // PRIORITY 3: Current active provider (standard case)
    const config = this.getProviderConfig();
    console.log(`[LLM] validate() using active provider: ${this.activeProvider} customPrompt=${!!customPrompt}`);

    // Get API key from memory (not persisted for security)
    const apiKey = this.providers[this.activeProvider]?.apiKey;

    if (!apiKey && config.authType !== 'none') {
      throw new Error(`No API key configured for ${config.name}. Please enter your API key in the LLM configuration dialog.`);
    }

    const prompt = buildValidationPrompt(text, customPrompt);
    const model = this.getCurrentModel();
    const useStream = streamOpts.stream && this._supportsThinking(this.activeProvider);

    try {
      let response;
      switch (this.activeProvider) {
        case 'gemini':
          if (useStream) {
            try {
              response = await this._callGeminiStream(apiKey, model, prompt, null, {
                useThinking: true, thinkingLevel: 'high',
                onThinkingChunk: streamOpts.onThinkingChunk,
                timeoutMs: streamOpts.timeoutMs
              });
            } catch (streamError) {
              console.warn('[Gemini] Stream fallback in validate():', streamError.message);
              streamOpts.onStreamError?.(streamError);
              response = await this._callGemini(apiKey, model, prompt, null, {
                useThinking: true, thinkingLevel: 'high'
              });
            }
          } else {
            response = await this._callGemini(apiKey, model, prompt, null, {
              useThinking: true,
              thinkingLevel: 'high'
            });
          }
          break;
        case 'openai':
          response = await this._callOpenAI(apiKey, model, prompt);
          break;
        case 'anthropic':
          if (useStream) {
            try {
              response = await this._callAnthropicStream(apiKey, model, prompt, null, {
                onThinkingChunk: streamOpts.onThinkingChunk,
                timeoutMs: streamOpts.timeoutMs
              });
            } catch (streamError) {
              console.warn('[Anthropic] Stream fallback in validate():', streamError.message);
              streamOpts.onStreamError?.(streamError);
              response = await this._callAnthropic(apiKey, model, prompt);
            }
          } else {
            response = await this._callAnthropic(apiKey, model, prompt);
          }
          break;
        case 'ollama':
          if (useStream) {
            try {
              response = await this._callOllamaStream(model, prompt, null, {
                onThinkingChunk: streamOpts.onThinkingChunk,
                timeoutMs: streamOpts.timeoutMs
              });
            } catch (streamError) {
              console.warn('[Ollama] Stream fallback in validate():', streamError.message);
              streamOpts.onStreamError?.(streamError);
              response = await this._callOllama(model, prompt);
            }
          } else {
            response = await this._callOllama(model, prompt);
          }
          break;
        default:
          throw new Error(`Provider ${this.activeProvider} not implemented`);
      }

      const result = this._parseValidationResponse(response);
      console.log(`[LLM] validate() OK, confidence=${result.confidence}`);
      return result;
    } catch (error) {
      console.error(`[LLM] validate() FAILED:`, error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Validate using explicitly configured validation provider
   * @private
   */
  async _validateWithExplicitProvider(text, customPrompt, streamOpts = {}) {
    const provider = this.validationProvider;
    const model = this.validationModel || this.providers[provider].defaultModel;
    const apiKey = this.getValidationApiKey(provider) || this.providers[provider].apiKey;

    if (!apiKey && this.providers[provider].authType !== 'none') {
      throw new Error(
        `Validation provider ${this.providers[provider].name} requires an API key. ` +
        `Please configure it in LLM Configuration.`
      );
    }

    const prompt = buildValidationPrompt(text, customPrompt);
    const useStream = streamOpts.stream && this._supportsThinking(provider);

    let response;
    switch (provider) {
      case 'gemini':
        if (useStream) {
          try {
            response = await this._callGeminiStream(apiKey, model, prompt, null, {
              useThinking: true, thinkingLevel: 'high',
              onThinkingChunk: streamOpts.onThinkingChunk,
              timeoutMs: streamOpts.timeoutMs
            });
          } catch (streamError) {
            console.warn('[Gemini] Stream fallback in explicit validate():', streamError.message);
            response = await this._callGemini(apiKey, model, prompt, null, {
              useThinking: true, thinkingLevel: 'high'
            });
          }
        } else {
          response = await this._callGemini(apiKey, model, prompt, null, {
            useThinking: true, thinkingLevel: 'high'
          });
        }
        break;
      case 'openai':
        response = await this._callOpenAI(apiKey, model, prompt);
        break;
      case 'anthropic':
        if (useStream) {
          try {
            response = await this._callAnthropicStream(apiKey, model, prompt, null, {
              onThinkingChunk: streamOpts.onThinkingChunk,
              timeoutMs: streamOpts.timeoutMs
            });
          } catch (streamError) {
            console.warn('[Anthropic] Stream fallback in explicit validate():', streamError.message);
            response = await this._callAnthropic(apiKey, model, prompt);
          }
        } else {
          response = await this._callAnthropic(apiKey, model, prompt);
        }
        break;
      case 'ollama':
        if (useStream) {
          try {
            response = await this._callOllamaStream(model, prompt, null, {
              onThinkingChunk: streamOpts.onThinkingChunk,
              timeoutMs: streamOpts.timeoutMs
            });
          } catch (streamError) {
            console.warn('[Ollama] Stream fallback in explicit validate():', streamError.message);
            response = await this._callOllama(model, prompt);
          }
        } else {
          response = await this._callOllama(model, prompt);
        }
        break;
      default:
        throw new Error(`Validation provider ${provider} not supported`);
    }

    const result = this._parseValidationResponse(response);
    result.validationProvider = {
      provider,
      model,
      name: this.providers[provider].name,
      explicit: true
    };
    return result;
  }

  /**
   * Validate using a fallback provider (when primary is OCR-only)
   * @private
   */
  async _validateWithFallback(text, customPrompt, fallback, streamOpts = {}) {
    const prompt = buildValidationPrompt(text, customPrompt);
    const { provider, model } = fallback;
    const useStream = streamOpts.stream && this._supportsThinking(provider);

    console.log(`[LLM] _validateWithFallback() provider=${provider} model=${model}`);

    try {
      let response;
      switch (provider) {
        case 'gemini': {
          const apiKey = this.providers.gemini.apiKey;
          if (useStream) {
            try {
              response = await this._callGeminiStream(apiKey, model, prompt, null, {
                useThinking: true, thinkingLevel: 'high',
                onThinkingChunk: streamOpts.onThinkingChunk,
                timeoutMs: streamOpts.timeoutMs
              });
            } catch (streamError) {
              console.warn('[Gemini] Stream fallback in _validateWithFallback():', streamError.message);
              response = await this._callGemini(apiKey, model, prompt, null, {
                useThinking: true, thinkingLevel: 'high'
              });
            }
          } else {
            response = await this._callGemini(apiKey, model, prompt, null, {
              useThinking: true, thinkingLevel: 'high'
            });
          }
          break;
        }
        case 'openai': {
          const apiKey = this.providers.openai.apiKey;
          response = await this._callOpenAI(apiKey, model, prompt);
          break;
        }
        case 'anthropic': {
          const apiKey = this.providers.anthropic.apiKey;
          if (useStream) {
            try {
              response = await this._callAnthropicStream(apiKey, model, prompt, null, {
                onThinkingChunk: streamOpts.onThinkingChunk,
                timeoutMs: streamOpts.timeoutMs
              });
            } catch (streamError) {
              console.warn('[Anthropic] Stream fallback in _validateWithFallback():', streamError.message);
              response = await this._callAnthropic(apiKey, model, prompt);
            }
          } else {
            response = await this._callAnthropic(apiKey, model, prompt);
          }
          break;
        }
        case 'ollama':
          if (useStream) {
            try {
              response = await this._callOllamaStream(model, prompt, null, {
                onThinkingChunk: streamOpts.onThinkingChunk,
                timeoutMs: streamOpts.timeoutMs
              });
            } catch (streamError) {
              console.warn('[Ollama] Stream fallback in _validateWithFallback():', streamError.message);
              response = await this._callOllama(model, prompt);
            }
          } else {
            response = await this._callOllama(model, prompt);
          }
          break;
        default:
          throw new Error(`Fallback provider ${provider} not implemented`);
      }

      const result = this._parseValidationResponse(response);
      result.fallbackUsed = { provider, model, name: fallback.name };
      console.log(`[LLM] _validateWithFallback() OK, confidence=${result.confidence}`);
      return result;
    } catch (error) {
      console.error(`[LLM] _validateWithFallback() FAILED:`, error.message);
      throw this._handleError(error);
    }
  }

  // ============================================
  // Streaming Support
  // ============================================

  /**
   * Check if a provider supports thinking/reasoning tokens
   * @param {string} provider - Provider name
   * @returns {boolean}
   */
  _supportsThinking(provider) {
    return ['gemini', 'anthropic', 'ollama'].includes(provider);
  }

  // ============================================
  // Provider-specific API calls
  // ============================================

  async _callGemini(apiKey, model, prompt, imageBase64 = null, options = {}) {
    console.log(`[Gemini] API call model=${model} thinking=${options.useThinking || false} image=${imageBase64 ? 'yes' : 'no'}`);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const parts = [{ text: prompt }];
    if (imageBase64) {
      parts.push({
        inline_data: {
          mime_type: 'image/jpeg',
          data: imageBase64
        }
      });
    }

    // Gemini 3 specific configuration
    const requestBody = {
      contents: [{ parts }],
      generationConfig: {
        // Gemini 3: Temperature should be 1.0 for best results
        // Lower values can cause unexpected behavior
        temperature: 1.0,
        maxOutputTokens: 8192
      }
    };

    // Add thinkingConfig for complex tasks (validation, analysis)
    // thinkingLevel: "high" for more reasoning, "low" for faster responses
    // includeThoughts: true to get thought parts in response (thought: true)
    // NOTE: REST API requires camelCase (thinkingConfig, thinkingLevel, includeThoughts)
    if (options.useThinking) {
      try {
        requestBody.generationConfig.thinkingConfig = {
          thinkingLevel: options.thinkingLevel || 'low',
          includeThoughts: true
        };
      } catch (_e) {
        console.warn('[Gemini] thinkingConfig not supported, skipping');
      }
    }

    // NOTE: media_resolution parameter removed - not supported by gemini-3-flash-preview
    // The API returns: "Invalid value at 'generation_config.media_resolution'"
    // Images are processed at default resolution which is sufficient for OCR

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(CLOUD_TIMEOUT_MS)
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`[Gemini] API error: ${response.status}`, error.error?.message);
      throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    // When thinking is enabled, response contains both thinking parts (thought:true)
    // and text parts. Find the first non-thinking part for the actual response.
    const responseParts = data.candidates?.[0]?.content?.parts || [];
    const textPart = responseParts.find(p => !p.thought) || responseParts[0] || {};
    const text = textPart.text || '';
    console.log(`[Gemini] Response OK, length=${text.length} chars`);
    return text;
  }

  /**
   * Call Gemini API with streaming (SSE) to extract thinking tokens in real-time
   * @param {string} apiKey
   * @param {string} model
   * @param {string} prompt
   * @param {string|null} imageBase64
   * @param {object} options - { useThinking, thinkingLevel, onThinkingChunk, timeoutMs }
   * @returns {Promise<string>} Full text response (thinking tokens excluded)
   */
  async _callGeminiStream(apiKey, model, prompt, imageBase64 = null, options = {}) {
    console.log(`[Gemini] Stream call model=${model} thinking=${options.useThinking || false}`);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const parts = [{ text: prompt }];
    if (imageBase64) {
      parts.push({
        inline_data: {
          mime_type: 'image/jpeg',
          data: imageBase64
        }
      });
    }

    const requestBody = {
      contents: [{ parts }],
      generationConfig: {
        temperature: 1.0,
        maxOutputTokens: 8192
      }
    };

    if (options.useThinking) {
      requestBody.generationConfig.thinkingConfig = {
        thinkingLevel: options.thinkingLevel || 'low',
        includeThoughts: true
      };
    }

    const timeoutMs = options.timeoutMs || CLOUD_TIMEOUT_MS;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `Gemini streaming error: ${response.status}`);
    }

    return this._parseGeminiSSE(response.body, options.onThinkingChunk);
  }

  /**
   * Parse Gemini SSE stream, extracting thinking parts and accumulating text
   * @param {ReadableStream} body - Response body stream
   * @param {Function|undefined} onThinkingChunk - Callback for thinking tokens
   * @returns {Promise<string>} Accumulated text response
   */
  async _parseGeminiSSE(body, onThinkingChunk) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines
        const lines = buffer.split('\n');
        // Keep last potentially incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const chunk = JSON.parse(jsonStr);
            const parts = chunk.candidates?.[0]?.content?.parts || [];

            for (const part of parts) {
              if (part.thought === true && onThinkingChunk) {
                // This is a thinking part -- forward to callback
                onThinkingChunk(part.text || '');
              } else if (part.text !== undefined && part.thought !== true) {
                // Regular text part -- accumulate
                fullText += part.text;
              }
            }
          } catch (_parseErr) {
            // Malformed JSON chunk -- skip silently
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullText;
  }

  /**
   * Call Anthropic API with streaming to extract extended thinking tokens
   * @param {string} apiKey
   * @param {string} model
   * @param {string} prompt
   * @param {string|null} imageBase64
   * @param {object} options - { onThinkingChunk, timeoutMs }
   * @returns {Promise<string>} Full text response (thinking tokens excluded)
   */
  async _callAnthropicStream(apiKey, model, prompt, imageBase64 = null, options = {}) {
    console.log(`[Anthropic] Stream call model=${model} image=${imageBase64 ? 'yes' : 'no'}`);

    const content = [];
    if (imageBase64) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: imageBase64
        }
      });
    }
    content.push({ type: 'text', text: prompt });

    const requestBody = {
      model,
      max_tokens: 16000,
      stream: true,
      thinking: {
        type: 'enabled',
        budget_tokens: 10000
      },
      messages: [{ role: 'user', content }]
    };

    const timeoutMs = options.timeoutMs || CLOUD_TIMEOUT_MS;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `Anthropic streaming error: ${response.status}`);
    }

    return this._parseAnthropicSSE(response.body, options.onThinkingChunk);
  }

  /**
   * Parse Anthropic SSE stream, extracting thinking_delta and text_delta
   * @param {ReadableStream} body
   * @param {Function|undefined} onThinkingChunk
   * @returns {Promise<string>}
   */
  async _parseAnthropicSSE(body, onThinkingChunk) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === 'content_block_delta') {
              const delta = event.delta;
              if (delta?.type === 'thinking_delta' && onThinkingChunk) {
                onThinkingChunk(delta.thinking || '');
              } else if (delta?.type === 'text_delta') {
                fullText += delta.text || '';
              }
            }
          } catch (_parseErr) {
            // Malformed JSON chunk -- skip
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullText;
  }

  /**
   * Call Ollama API with streaming, parsing <think> tags for reasoning
   * @param {string} model
   * @param {string} prompt
   * @param {string|null} imageBase64
   * @param {object} options - { onThinkingChunk, timeoutMs }
   * @returns {Promise<string>} Full text response (think tags removed)
   */
  async _callOllamaStream(model, prompt, imageBase64 = null, options = {}) {
    const ollamaUrl = this.providers.ollama.endpoint || 'http://localhost:11434';
    console.log(`[Ollama] Stream call model=${model} image=${imageBase64 ? 'yes' : 'no'}`);

    const isVisionModel = imageBase64 && (
      model.includes('deepseek-ocr') ||
      model.includes('llava') ||
      model.includes('vision')
    );

    let endpoint;
    let body;

    if (isVisionModel) {
      endpoint = `${ollamaUrl}/api/chat`;
      const simplePrompt = 'Extract the text in the image.';
      body = {
        model,
        messages: [{ role: 'user', content: simplePrompt, images: [imageBase64] }],
        stream: true
      };
    } else {
      endpoint = `${ollamaUrl}/api/generate`;
      body = { model, prompt, stream: true };
      if (imageBase64) {
        body.images = [imageBase64];
      }
    }

    const timeoutMs = options.timeoutMs || OLLAMA_TIMEOUT_MS;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama streaming error: ${response.status} - ${errorText}`);
    }

    return this._parseOllamaStream(response.body, isVisionModel, options.onThinkingChunk);
  }

  /**
   * Parse Ollama NDJSON stream with <think> tag state machine
   * @param {ReadableStream} body
   * @param {boolean} isChatEndpoint - true for /api/chat, false for /api/generate
   * @param {Function|undefined} onThinkingChunk
   * @returns {Promise<string>}
   */
  async _parseOllamaStream(body, isChatEndpoint, onThinkingChunk) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';
    // State machine for <think> tag parsing
    let insideThink = false;
    let tagBuffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const chunk = JSON.parse(line);
            // Extract token from response (generate) or message.content (chat)
            const token = isChatEndpoint
              ? (chunk.message?.content || '')
              : (chunk.response || '');

            if (!token) continue;

            // Process token through think-tag state machine
            const result = this._processOllamaToken(token, insideThink, tagBuffer, onThinkingChunk);
            insideThink = result.insideThink;
            tagBuffer = result.tagBuffer;
            fullText += result.text;
          } catch (_parseErr) {
            // Malformed JSON line -- skip
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Flush any remaining tagBuffer as regular text
    if (tagBuffer) {
      fullText += tagBuffer;
    }

    return fullText;
  }

  /**
   * Process a single Ollama token through the <think> tag state machine.
   * Handles tag boundaries that may span across token boundaries.
   * @param {string} token
   * @param {boolean} insideThink
   * @param {string} tagBuffer - partial tag match buffer
   * @param {Function|undefined} onThinkingChunk
   * @returns {{ text: string, insideThink: boolean, tagBuffer: string }}
   */
  _processOllamaToken(token, insideThink, tagBuffer, onThinkingChunk) {
    let text = '';
    let combined = tagBuffer + token;
    tagBuffer = '';

    while (combined.length > 0) {
      if (insideThink) {
        // Look for </think> closing tag
        const closeIdx = combined.indexOf('</think>');
        if (closeIdx !== -1) {
          // Thinking text before the close tag
          const thinkText = combined.slice(0, closeIdx);
          if (thinkText && onThinkingChunk) {
            onThinkingChunk(thinkText);
          }
          combined = combined.slice(closeIdx + 8); // skip '</think>'
          insideThink = false;
        } else {
          // Check for partial closing tag at end
          const partialMatch = this._partialTagMatch(combined, '</think>');
          if (partialMatch > 0) {
            // Buffer the potential partial tag
            const safeText = combined.slice(0, combined.length - partialMatch);
            if (safeText && onThinkingChunk) {
              onThinkingChunk(safeText);
            }
            tagBuffer = combined.slice(combined.length - partialMatch);
          } else {
            // All thinking text
            if (onThinkingChunk) {
              onThinkingChunk(combined);
            }
          }
          combined = '';
        }
      } else {
        // Look for <think> opening tag
        const openIdx = combined.indexOf('<think>');
        if (openIdx !== -1) {
          // Regular text before the open tag
          text += combined.slice(0, openIdx);
          combined = combined.slice(openIdx + 7); // skip '<think>'
          insideThink = true;
        } else {
          // Check for partial opening tag at end
          const partialMatch = this._partialTagMatch(combined, '<think>');
          if (partialMatch > 0) {
            text += combined.slice(0, combined.length - partialMatch);
            tagBuffer = combined.slice(combined.length - partialMatch);
          } else {
            text += combined;
          }
          combined = '';
        }
      }
    }

    return { text, insideThink, tagBuffer };
  }

  /**
   * Check if the end of text is a partial match for the beginning of tag.
   * Returns the length of the partial match (0 if none).
   * @param {string} text
   * @param {string} tag
   * @returns {number}
   */
  _partialTagMatch(text, tag) {
    const maxLen = Math.min(text.length, tag.length - 1);
    for (let len = maxLen; len > 0; len--) {
      if (text.endsWith(tag.slice(0, len))) {
        return len;
      }
    }
    return 0;
  }

  async _callOpenAI(apiKey, model, prompt, imageBase64 = null) {
    console.log(`[OpenAI] API call model=${model} image=${imageBase64 ? 'yes' : 'no'}`);
    const content = [{ type: 'text', text: prompt }];
    if (imageBase64) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
      });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content }],
        max_tokens: 4096,
        temperature: 0.1
      }),
      signal: AbortSignal.timeout(CLOUD_TIMEOUT_MS)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async _callAnthropic(apiKey, model, prompt, imageBase64 = null) {
    const content = [];
    if (imageBase64) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: imageBase64
        }
      });
    }
    content.push({ type: 'text', text: prompt });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{ role: 'user', content }]
      }),
      signal: AbortSignal.timeout(CLOUD_TIMEOUT_MS)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  }

  /**
   * Call Mistral OCR API
   * @param {string} apiKey - Mistral API key
   * @param {string} model - Model ID (e.g., 'mistral-ocr-latest')
   * @param {string} imageBase64 - Base64-encoded image (without data URL prefix)
   * @returns {Promise<string>} Extracted text
   */
  async _callMistral(apiKey, model, imageBase64) {
    console.log(`[Mistral] OCR API call model=${model} image=${imageBase64 ? 'yes' : 'no'}`);

    if (!imageBase64) {
      throw new Error('Mistral OCR requires an image');
    }

    // Convert base64 to data URL format required by Mistral
    const dataUrl = `data:image/jpeg;base64,${imageBase64}`;

    const requestBody = {
      model,
      document: {
        type: 'image_url',
        image_url: dataUrl
      }
      // Optional: table_format, extract_header, extract_footer, include_image_base64
    };

    const response = await fetch('https://api.mistral.ai/v1/ocr', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(CLOUD_TIMEOUT_MS)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Mistral] API error: ${response.status}`, errorText);
      throw new Error(`Mistral OCR API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`[Mistral] Response OK, pages=${data.pages?.length || 0}`);

    // Extract text from first page's markdown
    const text = data.pages?.[0]?.markdown || '';
    console.log(`[Mistral] Extracted text length=${text.length} chars`);
    return text;
  }

  async _callOllama(model, prompt, imageBase64 = null) {
    // Use endpoint from provider config (set via setEndpoint) or fallback
    const ollamaUrl = this.providers.ollama.endpoint || 'http://localhost:11434';

    // DeepSeek-OCR and other vision models require /api/chat endpoint
    // and work better with simpler prompts
    const isVisionModel = imageBase64 && (
      model.includes('deepseek-ocr') ||
      model.includes('llava') ||
      model.includes('vision')
    );

    if (isVisionModel) {
      // Use /api/chat for vision models (required for DeepSeek-OCR)
      // DeepSeek-OCR works best with simple, direct prompts
      const simplePrompt = 'Extract the text in the image.';

      const body = {
        model,
        messages: [{
          role: 'user',
          content: simplePrompt,
          images: [imageBase64]
        }],
        stream: false
      };

      console.log(`[Ollama] Calling ${ollamaUrl}/api/chat model=${model} (vision mode)`);
      console.log(`[Ollama] Image base64 length: ${imageBase64.length}`);

      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Ollama] API error: ${response.status}`, errorText);
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`[Ollama] Response:`, data);
      return data.message?.content || '';
    }

    // Standard /api/generate for non-vision models
    const body = {
      model,
      prompt,
      stream: false
    };

    if (imageBase64) {
      body.images = [imageBase64];
    }

    console.log(`[Ollama] Calling ${ollamaUrl}/api/generate model=${model}`);

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Ollama] API error: ${response.status}`, errorText);
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`[Ollama] Response:`, data);
    return data.response || '';
  }

  // ============================================
  // Response Parsing
  // ============================================

  _parseTranscriptionResponse(raw) {
    const segments = [];
    const lines = raw.split('\n').filter(line => line.trim());

    let lineNumber = 1;
    let inTable = false;

    for (const line of lines) {
      // Skip header separator
      if (line.match(/^\|[-\s|]+\|$/)) {
        inTable = true;
        continue;
      }

      // Check if it's a table row
      if (line.startsWith('|') && line.endsWith('|')) {
        if (!inTable) {
          // This is the header
          inTable = true;
          continue;
        }

        // Parse table row
        const cells = line.split('|').slice(1, -1).map(c => c.trim());

        // Determine confidence based on markers
        let confidence = 'certain';
        const text = cells.join(' | ');
        if (text.includes('[illegible]')) {
          confidence = 'uncertain';
        } else if (text.includes('[?]')) {
          confidence = 'likely';
        }

        segments.push({
          lineNumber,
          text,
          confidence,
          fields: this._parseFields(cells)
        });

        lineNumber++;
      }
    }

    return segments;
  }

  _parseFields(cells) {
    // Common column names for historical documents
    const commonColumns = ['datum', 'name', 'beschreibung', 'betrag', 'date', 'description', 'amount'];
    const fields = {};

    cells.forEach((cell, index) => {
      const key = commonColumns[index] || `col${index + 1}`;
      fields[key] = cell;
    });

    return fields;
  }

  _extractColumns(raw) {
    const lines = raw.split('\n').filter(line => line.trim());

    for (const line of lines) {
      if (line.startsWith('|') && !line.match(/^\|[-\s|]+\|$/)) {
        // This is likely the header
        const headers = line.split('|').slice(1, -1).map(h => h.trim());
        return headers.map((label, _index) => ({
          id: label.toLowerCase().replace(/\s+/g, '_'),
          label,
          width: 'auto'
        }));
      }
    }

    return [];
  }

  _parseValidationResponse(raw) {
    try {
      // Try to parse JSON from response
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        const confidence = this._normalizeConfidence(parsed.confidence);

        // Validate and normalize issues, filter out broken ones
        const issues = (parsed.issues || [])
          .map(issue => this._normalizeIssue(issue))
          .filter(issue => issue !== null);

        return {
          confidence,
          reasoning: parsed.reasoning || parsed.summary || '',
          summary: parsed.summary || parsed.reasoning || '',
          issues,
          raw
        };
      }
    } catch (e) {
      console.warn('[LLM] JSON parse failed in validation response:', e.message);
    }

    // Fallback: extract confidence from text keywords
    const confidence = this._extractConfidenceFromText(raw);

    return {
      confidence,
      reasoning: raw,
      summary: '',
      issues: [],
      raw
    };
  }

  /**
   * Normalize a confidence value to canonical form.
   * Canonical values: 'confident', 'likely', 'uncertain'
   */
  _normalizeConfidence(value) {
    if (!value || typeof value !== 'string') return 'uncertain';
    const lower = value.toLowerCase().trim();
    // Canonical values
    if (lower === 'confident' || lower === 'certain' || lower === 'sure' || lower === 'high') return 'confident';
    if (lower === 'likely' || lower === 'check-worthy' || lower === 'medium') return 'likely';
    if (lower === 'uncertain' || lower === 'problematic' || lower === 'low') return 'uncertain';
    return 'uncertain';
  }

  /**
   * Extract confidence from raw text when JSON parsing fails.
   */
  _extractConfidenceFromText(raw) {
    if (!raw || typeof raw !== 'string') return 'uncertain';
    const lower = raw.toLowerCase();
    if (lower.includes('"confident"') || lower.includes('"certain"') || lower.includes('"sure"')) return 'confident';
    if (lower.includes('"likely"') || lower.includes('"check-worthy"') || lower.includes('plausible')) return 'likely';
    return 'uncertain';
  }

  /**
   * Validate and normalize a single issue object.
   * Returns null for fundamentally broken issues (missing text AND suggestion).
   * Required fields: line, text, type, suggestion, explanation
   */
  _normalizeIssue(issue) {
    if (!issue || typeof issue !== 'object') return null;

    // line: must be positive integer (>=1), default 1 for missing/invalid
    let line = typeof issue.line === 'number' ? issue.line : parseInt(issue.line, 10);
    if (!Number.isFinite(line) || line < 1) line = 1;
    line = Math.floor(line);

    // text: must be string, normalize markers to canonical forms
    const text = (typeof issue.text === 'string') ? normalizeMarkers(issue.text.trim()) : '';

    // suggestion: string or null, normalize markers to canonical forms
    let suggestion = null;
    if (typeof issue.suggestion === 'string' && issue.suggestion.trim()) {
      suggestion = normalizeMarkers(issue.suggestion);
    }

    // Drop issues with neither text nor suggestion -- not actionable
    if (!text && !suggestion) return null;

    // explanation: string, fallback to suggestion
    const explanation = (typeof issue.explanation === 'string' && issue.explanation.trim())
      ? issue.explanation
      : (suggestion || '');

    // type: normalize to valid enum
    const type = this._normalizeIssueType(issue.type);

    const normalized = { line, text, type, suggestion, explanation };

    // Optional metadata fields -- pass through if present and valid
    if (typeof issue.stage === 'string' && issue.stage.trim()) {
      normalized.stage = issue.stage.trim();
    }
    if (Array.isArray(issue.alternatives) && issue.alternatives.length > 0) {
      normalized.alternatives = issue.alternatives.filter(a => typeof a === 'string');
    }
    if (typeof issue.score === 'number' && Number.isFinite(issue.score)) {
      normalized.score = Math.max(0, Math.min(1, issue.score));
    }

    return normalized;
  }

  /**
   * Normalize issue type to valid type
   */
  _normalizeIssueType(type) {
    if (type && VALID_ISSUE_TYPES.includes(type)) {
      return type;
    }
    // Try to infer from common variations
    if (type) {
      const lower = type.toLowerCase();
      if (lower.includes('spell') || lower.includes('ortho')) return 'spelling';
      if (lower.includes('accent') || lower.includes('diacritic')) return 'accent';
      if (lower.includes('abbrev') || lower.includes('abkuerz')) return 'abbreviation';
      if (lower.includes('illegib') || lower.includes('unles')) return 'illegible';
      if (lower.includes('ocr') || lower.includes('artifact')) return 'ocr_artifact';
      if (lower.includes('histor')) return 'historical';
      if (lower.includes('struct') || lower.includes('layout')) return 'structural';
      if (lower.includes('plausib')) return 'plausibility';
    }
    return 'spelling'; // Default fallback
  }

  // ============================================
  // Error Handling
  // ============================================

  _handleError(error) {
    const message = error.message || 'Unknown error';

    // Categorize error
    if (message.includes('401') || message.includes('Unauthorized') || message.includes('invalid_api_key')) {
      return new LLMError('auth', 'Invalid API key. Please check your configuration.');
    }
    if (message.includes('429') || message.includes('rate limit') || message.includes('quota')) {
      return new LLMError('rate_limit', 'Rate limit exceeded. Please wait and try again.');
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('CORS')) {
      return new LLMError('network', 'Network error. Please check your connection.');
    }
    if (message.includes('timeout')) {
      return new LLMError('timeout', 'Request timed out. Please try again.');
    }

    return new LLMError('unknown', message);
  }
}

/**
 * Custom error class for LLM errors
 */
class LLMError extends Error {
  constructor(type, message) {
    super(message);
    this.name = 'LLMError';
    this.type = type; // auth, rate_limit, network, timeout, unknown
  }
}

// Export singleton instance and classes
export const llmService = new LLMService();
export {
  LLMService, LLMError, PROVIDERS,
  TRANSCRIPTION_PROMPT_BASE, DESCRIPTION_PROMPT_BASE,
  ISSUE_TYPES, VALID_ISSUE_TYPES,
  buildTranscriptionPrompt,
  buildPaleographicReviewPrompt, buildPhilologicalReviewPrompt
};
