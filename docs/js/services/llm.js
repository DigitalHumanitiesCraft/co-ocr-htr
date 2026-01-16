/**
 * LLM Service
 * Unified abstraction for multiple LLM providers with vision capabilities
 */

import { storage } from './storage.js';

// ============================================
// Prompts
// ============================================

const TRANSCRIPTION_PROMPT = `Du bist ein Experte für historische Handschriften des 16.-19. Jahrhunderts.

Aufgabe: Transkribiere das Bild in eine strukturierte Markdown-Tabelle.

Regeln:
- Erkenne die tabellarische Struktur und gib sie als Markdown-Tabelle aus
- Spalten durch | trennen
- Datumsformate: "DD. Monat" (z.B. "28. Mai", "3. Juni")
- Währungen: Taler, Groschen, Gulden, Kreuzer (z.B. "23 Taler 4 Gr")
- Unsichere Lesungen mit [?] markieren (z.B. "[?] Schmidt", "10 [?] Taler")
- Unleserliche Stellen mit [illegible] markieren
- Eine Tabellenzeile pro Dokumentzeile
- Leere Zellen als leer lassen

Ausgabeformat: Nur die Markdown-Tabelle, keine Erklärungen oder Kommentare.
Beginne direkt mit der Header-Zeile: | Spalte1 | Spalte2 | ...`;

const VALIDATION_PROMPTS = {
  paleographic: `Analysiere den folgenden transkribierten Text aus paläographischer Sicht:

{text}

Prüfe:
- Buchstabenformen: Sind sie konsistent mit der angegebenen Epoche?
- Ligaturen: Wurden sie korrekt aufgelöst?
- Ähnliche Buchstaben: Könnten n/u, c/e, i/j verwechselt worden sein?
- Abkürzungen: Wurden sie korrekt expandiert?

Bewerte die Transkription mit einer der folgenden Kategorien:
- "certain": Hohe Übereinstimmung, keine erkennbaren Fehler
- "likely": Plausibel, aber Experte sollte kritische Stellen prüfen
- "uncertain": Wahrscheinlich fehlerhaft, mehrere problematische Lesungen

Antworte im JSON-Format:
{"confidence": "certain|likely|uncertain", "reasoning": "Deine Begründung", "issues": [{"line": 1, "text": "Problem", "suggestion": "Vorschlag"}]}`,

  linguistic: `Analysiere den folgenden transkribierten Text aus sprachlicher Sicht:

{text}

Prüfe:
- Grammatik: Sind die Sätze grammatikalisch plausibel?
- Historische Orthographie: Entspricht die Schreibweise der Epoche?
- Lexik: Sind die verwendeten Wörter epochentypisch?
- Abkürzungen: Wurden Standardabkürzungen korrekt aufgelöst?

Bewerte mit: "certain", "likely", oder "uncertain"

Antworte im JSON-Format:
{"confidence": "certain|likely|uncertain", "reasoning": "Deine Begründung", "issues": [{"line": 1, "text": "Problem", "suggestion": "Vorschlag"}]}`,

  structural: `Analysiere den folgenden transkribierten Text aus struktureller Sicht:

{text}

Prüfe:
- Tabellenlogik: Stimmen die Summen (falls vorhanden)?
- Spaltenstruktur: Ist die Anzahl der Spalten konsistent?
- Verweise: Sind Referenzen auf andere Einträge korrekt?
- Nummerierung: Ist eine logische Reihenfolge erkennbar?

Bewerte mit: "certain", "likely", oder "uncertain"

Antworte im JSON-Format:
{"confidence": "certain|likely|uncertain", "reasoning": "Deine Begründung", "issues": [{"line": 1, "text": "Problem", "suggestion": "Vorschlag"}]}`,

  domain: `Analysiere den folgenden transkribierten Text mit Domänenwissen:

{text}

Prüfe (für Rechnungsbücher/Geschäftsdokumente):
- Fachtermini: Sind Warenbezeichnungen, Berufe korrekt?
- Plausibilität: Sind Mengen, Preise, Daten realistisch?
- Kontext: Passt der Inhalt zum Dokumenttyp?
- Personennamen: Sind sie für die Region/Epoche typisch?

Bewerte mit: "certain", "likely", oder "uncertain"

Antworte im JSON-Format:
{"confidence": "certain|likely|uncertain", "reasoning": "Deine Begründung", "issues": [{"line": 1, "text": "Problem", "suggestion": "Vorschlag"}]}`
};

// ============================================
// Provider Configurations
// ============================================

const PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
    defaultModel: 'gemini-3.0-flash-preview',
    models: ['gemini-3.0-flash-preview', 'gemini-3.0-pro-preview'],
    authType: 'query', // API key in URL query param
    supportsVision: true
  },
  openai: {
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'o1', 'o1-mini'],
    authType: 'bearer',
    supportsVision: true
  },
  anthropic: {
    name: 'Anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-sonnet-4-20250514',
    models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-3-5-haiku-latest'],
    authType: 'header', // x-api-key header
    supportsVision: true
  },
  deepseek: {
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    authType: 'bearer',
    supportsVision: false // DeepSeek API doesn't support vision yet
  },
  ollama: {
    name: 'Ollama (Local)',
    endpoint: 'http://localhost:11434/api/generate',
    defaultModel: 'llava',
    models: ['llava', 'llava:13b', 'bakllava', 'llama3.2-vision'],
    authType: 'none',
    supportsVision: true
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
   * Check if API key is configured for current provider
   */
  hasApiKey() {
    if (this.activeProvider === 'ollama') return true;
    return storage.hasApiKey(this.activeProvider);
  }

  /**
   * Get list of available providers with their status
   */
  getAvailableProviders() {
    return Object.entries(this.providers).map(([id, config]) => ({
      id,
      name: config.name,
      hasKey: id === 'ollama' || storage.hasApiKey(id),
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

    if (!config.supportsVision) {
      throw new Error(`Provider ${config.name} does not support vision/image input`);
    }

    const apiKey = storage.loadApiKey(this.activeProvider);
    if (!apiKey && config.authType !== 'none') {
      throw new Error(`No API key configured for ${config.name}`);
    }

    const prompt = options.prompt || TRANSCRIPTION_PROMPT;
    const model = this.getCurrentModel();

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

      return {
        provider: this.activeProvider,
        model,
        raw: response,
        segments: this._parseTranscriptionResponse(response),
        columns: this._extractColumns(response)
      };
    } catch (error) {
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
  async validate(text, perspective = 'paleographic') {
    const config = this.getProviderConfig();
    const apiKey = storage.loadApiKey(this.activeProvider);

    if (!apiKey && config.authType !== 'none') {
      throw new Error(`No API key configured for ${config.name}`);
    }

    const promptTemplate = VALIDATION_PROMPTS[perspective];
    if (!promptTemplate) {
      throw new Error(`Unknown perspective: ${perspective}`);
    }

    const prompt = promptTemplate.replace('{text}', text);
    const model = this.getCurrentModel();

    try {
      let response;
      switch (this.activeProvider) {
        case 'gemini':
          response = await this._callGemini(apiKey, model, prompt);
          break;
        case 'openai':
          response = await this._callOpenAI(apiKey, model, prompt);
          break;
        case 'anthropic':
          response = await this._callAnthropic(apiKey, model, prompt);
          break;
        case 'deepseek':
          response = await this._callDeepSeek(apiKey, model, prompt);
          break;
        case 'ollama':
          response = await this._callOllama(model, prompt);
          break;
        default:
          throw new Error(`Provider ${this.activeProvider} not implemented`);
      }

      return this._parseValidationResponse(response, perspective);
    } catch (error) {
      throw this._handleError(error);
    }
  }

  // ============================================
  // Provider-specific API calls
  // ============================================

  async _callGemini(apiKey, model, prompt, imageBase64 = null) {
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

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  async _callOpenAI(apiKey, model, prompt, imageBase64 = null) {
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

  async _callDeepSeek(apiKey, model, prompt) {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
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

  _parseValidationResponse(raw, perspective) {
    try {
      // Try to parse JSON from response
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          perspective,
          confidence: parsed.confidence || 'uncertain',
          reasoning: parsed.reasoning || '',
          issues: parsed.issues || [],
          raw
        };
      }
    } catch {
      // If JSON parsing fails, try to extract confidence from text
    }

    // Fallback: extract confidence from text
    let confidence = 'uncertain';
    if (raw.toLowerCase().includes('"certain"') || raw.toLowerCase().includes('confident')) {
      confidence = 'certain';
    } else if (raw.toLowerCase().includes('"likely"') || raw.toLowerCase().includes('plausible')) {
      confidence = 'likely';
    }

    return {
      perspective,
      confidence,
      reasoning: raw,
      issues: [],
      raw
    };
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
export { LLMService, LLMError, PROVIDERS, TRANSCRIPTION_PROMPT, VALIDATION_PROMPTS };
