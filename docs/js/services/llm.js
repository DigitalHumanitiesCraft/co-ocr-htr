/**
 * LLM Service
 * Unified abstraction for multiple LLM providers with vision capabilities
 *
 * SECURITY NOTE: API keys are stored in memory only and are NOT persisted
 * to localStorage. Users must re-enter their keys each browser session.
 */

// ============================================
// Prompts
// ============================================

/**
 * Base transcription prompt - will be enhanced with context if provided
 */
const TRANSCRIPTION_PROMPT_BASE = `You are an expert in historical manuscripts and paleography.

Task: Transcribe the document as accurately as possible.

Rules:
- Preserve original line breaks exactly as they appear
- Separate paragraphs with blank lines
- Mark uncertain readings with [?] (e.g., "[?]word") - you MUST use this when confidence is below 90%
- Mark illegible passages with [illegible]
- Keep abbreviations as written in the original (do not expand)

Output format: Only the transcribed text, no explanations or commentary.
Begin directly with the first line of the document.`;

/**
 * Build the full transcription prompt, optionally enhanced with context
 * @param {string} contextDescription - Additional context from the expert
 * @returns {string} The complete prompt
 */
function buildTranscriptionPrompt(contextDescription = '') {
    let prompt = TRANSCRIPTION_PROMPT_BASE;

    if (contextDescription) {
        prompt = `You are an expert in historical manuscripts and paleography.

DOCUMENT CONTEXT (provided by the expert):
${contextDescription}

Task: Transcribe the document as accurately as possible, taking the context into account.

Rules:
- Preserve original line breaks exactly as they appear
- Separate paragraphs with blank lines
- Mark uncertain readings with [?] (e.g., "[?]word") - you MUST use this when confidence is below 90%
- Mark illegible passages with [illegible]
- Keep abbreviations as written in the original (do not expand)

Output format: Only the transcribed text, no explanations or commentary.
Begin directly with the first line of the document.`;
    }

    return prompt;
}

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

const PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
    defaultModel: 'gemini-3-flash-preview',
    models: [
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (schnell, kosteneffizient)', recommended: true, hint: 'Gut für einfache Dokumente und schnelle Iteration' },
      { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (beste Qualität)', hint: 'Beste Wahl für Handschriften (HTR) und komplexe Layouts' },
      { id: 'custom', name: 'Eigenes Modell...' }
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
      { id: 'gpt-5.2', name: 'GPT-5.2 (Empfohlen)', recommended: true },
      { id: 'gpt-5.2-mini', name: 'GPT-5.2 Mini (schneller)' },
      { id: 'custom', name: 'Eigenes Modell...' }
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
      { id: 'claude-sonnet-4-5-20250514', name: 'Claude 4.5 Sonnet (Empfohlen)', recommended: true },
      { id: 'claude-haiku-4-5-20250514', name: 'Claude 4.5 Haiku (schneller)' },
      { id: 'claude-opus-4-5-20250514', name: 'Claude 4.5 Opus (beste Qualität)' },
      { id: 'custom', name: 'Eigenes Modell...' }
    ],
    authType: 'header',
    supportsVision: true,
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    apiKeyPlaceholder: 'sk-ant-...'
  },
  ollama: {
    name: 'Ollama (lokal)',
    endpoint: 'http://localhost:11434/api/generate',
    defaultModel: 'deepseek-ocr',
    models: [
      { id: 'deepseek-ocr', name: 'DeepSeek-OCR (Empfohlen für OCR)', recommended: true, hint: 'Gut für gedruckte Dokumente mit einfachen Layouts' },
      { id: 'deepseek-ocr2', name: 'DeepSeek-OCR 2', hint: 'Verbesserte Version, besser für strukturierte Dokumente' },
      { id: 'lightonocr', name: 'LightOnOCR-2', hint: 'State-of-the-Art Open Source OCR (erfordert Konvertierung)' },
      { id: 'llava', name: 'LLaVA' },
      { id: 'llama3.2-vision', name: 'Llama 3.2 Vision' },
      { id: 'custom', name: 'Eigenes Modell...' }
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
   * Check if API key is configured for current provider (memory only)
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
    const prompt = options.prompt || buildTranscriptionPrompt(contextDescription);
    const model = this.getCurrentModel();
    console.log(`[LLM] model=${model} image=${imageBase64 ? 'yes' : 'no'} context=${contextDescription ? 'yes' : 'no'}`);

    try {
      let response;
      switch (this.activeProvider) {
        case 'gemini':
          response = await this._callGemini(apiKey, model, prompt, imageBase64);
          break;
        case 'openai':
          response = await this._callOpenAI(apiKey, model, prompt, imageBase64);
          break;
        case 'anthropic':
          response = await this._callAnthropic(apiKey, model, prompt, imageBase64);
          break;
        case 'ollama':
          response = await this._callOllama(model, prompt, imageBase64);
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
  // Validation
  // ============================================

  /**
   * Validate transcription using LLM judge
   * @param {string} text - Transcription text to validate
   * @param {string} perspective - Validation perspective
   * @returns {Promise<object>} Validation result
   */
  async validate(text, options = {}) {
    // Support legacy signature: validate(text, perspective)
    if (typeof options === 'string') {
      options = { perspective: options };
    }

    const { customPrompt = '' } = options;
    const config = this.getProviderConfig();
    console.log(`[LLM] validate() provider=${this.activeProvider} customPrompt=${!!customPrompt}`);

    // Get API key from memory (not persisted for security)
    const apiKey = this.providers[this.activeProvider]?.apiKey;

    if (!apiKey && config.authType !== 'none') {
      throw new Error(`No API key configured for ${config.name}. Please enter your API key in the LLM configuration dialog.`);
    }

    const prompt = buildValidationPrompt(text, customPrompt);
    const model = this.getCurrentModel();

    try {
      let response;
      switch (this.activeProvider) {
        case 'gemini':
          // Use thinking mode for validation - deeper reasoning improves analysis
          response = await this._callGemini(apiKey, model, prompt, null, {
            useThinking: true,
            thinkingLevel: 'high'
          });
          break;
        case 'openai':
          response = await this._callOpenAI(apiKey, model, prompt);
          break;
        case 'anthropic':
          response = await this._callAnthropic(apiKey, model, prompt);
          break;
        case 'ollama':
          response = await this._callOllama(model, prompt);
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

    // Add thinking_config for complex tasks (validation, analysis)
    // thinking_level: "high" for more reasoning, "low" for faster responses
    // NOTE: thinking_config may not be supported by all Gemini 3 preview models
    if (options.useThinking) {
      try {
        requestBody.generationConfig.thinking_config = {
          thinking_level: options.thinkingLevel || 'low'
        };
      } catch (e) {
        console.warn('[Gemini] thinking_config not supported, skipping');
      }
    }

    // NOTE: media_resolution parameter removed - not supported by gemini-3-flash-preview
    // The API returns: "Invalid value at 'generation_config.media_resolution'"
    // Images are processed at default resolution which is sufficient for OCR

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`[Gemini] API error: ${response.status}`, error.error?.message);
      throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log(`[Gemini] Response OK, length=${text.length} chars`);
    return text;
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
      })
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
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  }

  async _callOllama(model, prompt, imageBase64 = null) {
    // Use endpoint from provider config (set via setEndpoint) or fallback
    const ollamaUrl = this.providers.ollama.endpoint || 'http://localhost:11434';

    const body = {
      model,
      prompt,
      stream: false
    };

    if (imageBase64) {
      body.images = [imageBase64];
    }

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
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
        return headers.map((label, index) => ({
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

        // Map old confidence values to new ones
        let confidence = parsed.confidence || 'uncertain';
        if (confidence === 'certain') confidence = 'confident';

        // Validate and normalize issues with types
        const issues = (parsed.issues || []).map(issue => ({
          line: issue.line || 0,
          text: issue.text || '',
          type: this._normalizeIssueType(issue.type),
          suggestion: issue.suggestion || null,
          explanation: issue.explanation || issue.suggestion || ''
        }));

        return {
          confidence,
          reasoning: parsed.reasoning || parsed.summary || '',
          summary: parsed.summary || parsed.reasoning || '',
          issues,
          raw
        };
      }
    } catch {
      // If JSON parsing fails, try to extract confidence from text
    }

    // Fallback: extract confidence from text
    let confidence = 'uncertain';
    if (raw.toLowerCase().includes('"confident"') || raw.toLowerCase().includes('"certain"')) {
      confidence = 'confident';
    } else if (raw.toLowerCase().includes('"likely"') || raw.toLowerCase().includes('plausible')) {
      confidence = 'likely';
    }

    return {
      confidence,
      reasoning: raw,
      summary: '',
      issues: [],
      raw
    };
  }

  /**
   * Normalize issue type to valid type
   */
  _normalizeIssueType(type) {
    const validTypes = ['spelling', 'accent', 'abbreviation', 'illegible', 'ocr_artifact', 'historical', 'structural', 'plausibility'];
    if (type && validTypes.includes(type)) {
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
export { LLMService, LLMError, PROVIDERS, TRANSCRIPTION_PROMPT_BASE, ISSUE_TYPES };
