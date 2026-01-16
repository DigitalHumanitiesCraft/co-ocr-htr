/**
 * Tests for LLM Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LLMService, LLMError, PROVIDERS } from '../js/services/llm.js';

// Mock storage module
vi.mock('../js/services/storage.js', () => ({
  storage: {
    loadApiKey: vi.fn(),
    hasApiKey: vi.fn(),
    saveApiKey: vi.fn()
  }
}));

import { storage } from '../js/services/storage.js';

describe('LLMService', () => {
  let service;

  beforeEach(() => {
    service = new LLMService();
    vi.clearAllMocks();
  });

  describe('Provider Configuration', () => {
    it('should have all expected providers', () => {
      expect(service.providers).toHaveProperty('gemini');
      expect(service.providers).toHaveProperty('openai');
      expect(service.providers).toHaveProperty('anthropic');
      expect(service.providers).toHaveProperty('deepseek');
      expect(service.providers).toHaveProperty('ollama');
    });

    it('should default to gemini provider', () => {
      expect(service.activeProvider).toBe('gemini');
    });

    it('should set provider correctly', () => {
      service.setProvider('openai');
      expect(service.activeProvider).toBe('openai');
    });

    it('should throw error for unknown provider', () => {
      expect(() => service.setProvider('unknown')).toThrow('Unknown provider');
    });

    it('should get correct provider config', () => {
      const config = service.getProviderConfig();
      expect(config.name).toBe('Google Gemini');
      expect(config.supportsVision).toBe(true);
    });

    it('should return default model when none set', () => {
      const model = service.getCurrentModel();
      expect(model).toBe('gemini-3.0-flash-preview');
    });

    it('should return custom model when set', () => {
      service.setModel('gemini-3.0-pro-preview');
      expect(service.getCurrentModel()).toBe('gemini-3.0-pro-preview');
    });
  });

  describe('API Key Handling', () => {
    it('should check if API key exists', () => {
      storage.hasApiKey.mockReturnValue(true);
      expect(service.hasApiKey()).toBe(true);
      expect(storage.hasApiKey).toHaveBeenCalledWith('gemini');
    });

    it('should always return true for ollama', () => {
      service.setProvider('ollama');
      expect(service.hasApiKey()).toBe(true);
    });

    it('should list available providers with status', () => {
      storage.hasApiKey.mockImplementation((provider) => provider === 'gemini');

      const providers = service.getAvailableProviders();

      expect(providers).toHaveLength(5);

      const gemini = providers.find(p => p.id === 'gemini');
      expect(gemini.hasKey).toBe(true);
      expect(gemini.isActive).toBe(true);

      const openai = providers.find(p => p.id === 'openai');
      expect(openai.hasKey).toBe(false);

      const ollama = providers.find(p => p.id === 'ollama');
      expect(ollama.hasKey).toBe(true); // Always true for ollama
    });
  });

  describe('Provider Capabilities', () => {
    it('should mark gemini as supporting vision', () => {
      expect(PROVIDERS.gemini.supportsVision).toBe(true);
    });

    it('should mark openai as supporting vision', () => {
      expect(PROVIDERS.openai.supportsVision).toBe(true);
    });

    it('should mark anthropic as supporting vision', () => {
      expect(PROVIDERS.anthropic.supportsVision).toBe(true);
    });

    it('should mark deepseek as NOT supporting vision', () => {
      expect(PROVIDERS.deepseek.supportsVision).toBe(false);
    });

    it('should mark ollama as supporting vision', () => {
      expect(PROVIDERS.ollama.supportsVision).toBe(true);
    });
  });

  describe('Response Parsing', () => {
    it('should parse markdown table response', () => {
      const mockResponse = `| Datum | Name | Beschreibung | Betrag |
|-------|------|--------------|--------|
| 28. Mai | K. Schmidt | Eisenwaren | 23 Taler |
| 3. Juni | H. Müller | Tuchstoff | 15 Taler |`;

      const segments = service._parseTranscriptionResponse(mockResponse);

      expect(segments).toHaveLength(2);
      expect(segments[0].lineNumber).toBe(1);
      expect(segments[0].text).toContain('28. Mai');
      expect(segments[0].confidence).toBe('certain');
    });

    it('should detect uncertain markers in transcription', () => {
      const mockResponse = `| Datum | Name |
|-------|------|
| 28. Mai | [?] Schmidt |`;

      const segments = service._parseTranscriptionResponse(mockResponse);

      expect(segments[0].confidence).toBe('likely');
    });

    it('should detect illegible markers in transcription', () => {
      const mockResponse = `| Datum | Name |
|-------|------|
| 28. Mai | [illegible] |`;

      const segments = service._parseTranscriptionResponse(mockResponse);

      expect(segments[0].confidence).toBe('uncertain');
    });

    it('should extract columns from header', () => {
      const mockResponse = `| Datum | Name | Beschreibung |
|-------|------|--------------|
| 28. Mai | Test | Test |`;

      const columns = service._extractColumns(mockResponse);

      expect(columns).toHaveLength(3);
      expect(columns[0].label).toBe('Datum');
      expect(columns[0].id).toBe('datum');
    });

    it('should parse validation response JSON', () => {
      const mockResponse = `{"confidence": "likely", "reasoning": "Some issues found", "issues": []}`;

      const result = service._parseValidationResponse(mockResponse, 'paleographic');

      expect(result.confidence).toBe('likely');
      expect(result.reasoning).toBe('Some issues found');
      expect(result.perspective).toBe('paleographic');
    });

    it('should handle malformed validation response', () => {
      const mockResponse = `The text looks plausible but needs review.`;

      const result = service._parseValidationResponse(mockResponse, 'linguistic');

      expect(result.confidence).toBe('likely'); // "plausible" in text
      expect(result.perspective).toBe('linguistic');
    });
  });

  describe('Error Handling', () => {
    it('should categorize auth errors', () => {
      const error = service._handleError(new Error('401 Unauthorized'));

      expect(error).toBeInstanceOf(LLMError);
      expect(error.type).toBe('auth');
    });

    it('should categorize rate limit errors', () => {
      const error = service._handleError(new Error('429 rate limit exceeded'));

      expect(error).toBeInstanceOf(LLMError);
      expect(error.type).toBe('rate_limit');
    });

    it('should categorize network errors', () => {
      const error = service._handleError(new Error('network error'));

      expect(error).toBeInstanceOf(LLMError);
      expect(error.type).toBe('network');
    });

    it('should categorize unknown errors', () => {
      const error = service._handleError(new Error('something weird happened'));

      expect(error).toBeInstanceOf(LLMError);
      expect(error.type).toBe('unknown');
    });
  });

  describe('Transcription Validation', () => {
    it('should throw error if provider does not support vision', async () => {
      service.setProvider('deepseek');
      storage.loadApiKey.mockReturnValue('test-key');

      await expect(service.transcribe('base64image'))
        .rejects.toThrow('does not support vision');
    });

    it('should throw error if no API key configured', async () => {
      storage.loadApiKey.mockReturnValue(null);

      await expect(service.transcribe('base64image'))
        .rejects.toThrow('No API key configured');
    });
  });
});

describe('LLMError', () => {
  it('should have correct name and type', () => {
    const error = new LLMError('auth', 'Invalid key');

    expect(error.name).toBe('LLMError');
    expect(error.type).toBe('auth');
    expect(error.message).toBe('Invalid key');
  });
});
