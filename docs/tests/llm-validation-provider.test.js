/**
 * Tests for explicit validation provider configuration
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { llmService } from '../js/services/llm.js';

describe('Validation Provider Configuration', () => {
  beforeEach(() => {
    // Reset llmService state
    llmService.clearValidationProvider();
    llmService.setProvider('gemini');
    llmService.setModel('gemini-3-flash-preview');
  });

  describe('setValidationProvider', () => {
    test('should set explicit validation provider', () => {
      llmService.setValidationProvider('gemini', 'gemini-3-flash-preview');
      const config = llmService.getValidationProvider();
      expect(config.provider).toBe('gemini');
      expect(config.model).toBe('gemini-3-flash-preview');
      expect(config.name).toBe('Google Gemini');
    });

    test('should use default model if not specified', () => {
      llmService.setValidationProvider('openai');
      const config = llmService.getValidationProvider();
      expect(config.provider).toBe('openai');
      expect(config.model).toBe('gpt-5.2');
      expect(config.name).toBe('OpenAI');
    });

    test('should throw error for unknown provider', () => {
      expect(() => llmService.setValidationProvider('unknown')).toThrow('Unknown validation provider: unknown');
    });
  });

  describe('clearValidationProvider', () => {
    test('should clear validation provider', () => {
      llmService.setValidationProvider('gemini', 'gemini-3-flash-preview');
      llmService.clearValidationProvider();
      expect(llmService.getValidationProvider()).toBeNull();
    });
  });

  describe('hasValidationProviderConfigured', () => {
    test('should return true when validation provider is set', () => {
      llmService.setValidationProvider('gemini', 'gemini-3-flash-preview');
      expect(llmService.hasValidationProviderConfigured()).toBe(true);
    });

    test('should return false when validation provider is not set', () => {
      expect(llmService.hasValidationProviderConfigured()).toBe(false);
    });
  });

  describe('validate with explicit provider', () => {
    test('should use explicit validation provider when set', async () => {
      // Set OCR-only model
      llmService.setProvider('mistral');
      llmService.setModel('mistral-ocr-latest');

      // Set explicit validation provider
      llmService.setValidationProvider('gemini', 'gemini-3-flash-preview');
      llmService.setApiKey('gemini', 'test-key');

      // Mock _callGemini to avoid real API call
      llmService._callGemini = vi.fn().mockResolvedValue('{"confidence": "confident", "summary": "Looks good", "issues": []}');

      const result = await llmService.validate('test text');
      expect(result.validationProvider.provider).toBe('gemini');
      expect(result.validationProvider.explicit).toBe(true);
      expect(llmService._callGemini).toHaveBeenCalled();
    });

    test('should use automatic fallback when OCR-only and no explicit validation provider', async () => {
      // Set OCR-only model
      llmService.setProvider('mistral');
      llmService.setModel('mistral-ocr-latest');

      // Configure fallback provider
      llmService.setApiKey('gemini', 'fallback-key');

      // Mock _callGemini
      llmService._callGemini = vi.fn().mockResolvedValue('{"confidence": "confident", "summary": "Looks good", "issues": []}');

      const result = await llmService.validate('test text');
      expect(result.fallbackUsed).toBeDefined();
      expect(result.fallbackUsed.provider).toBe('gemini');
    });

    test('should use ollama fallback when OCR-only in ollama and no cloud providers', async () => {
      // Set OCR-only model with Ollama
      llmService.setProvider('ollama');
      llmService.setModel('deepseek-ocr');

      // Clear all cloud API keys to test Ollama fallback
      llmService.providers.gemini.apiKey = null;
      llmService.providers.openai.apiKey = null;
      llmService.providers.anthropic.apiKey = null;

      // Mock Ollama fallback call
      llmService._callOllama = vi.fn().mockResolvedValue('{"confidence": "confident", "summary": "Looks good", "issues": []}');

      // Don't configure any validation provider
      llmService.clearValidationProvider();

      const result = await llmService.validate('test');
      expect(result.fallbackUsed).toBeDefined();
      expect(result.fallbackUsed.provider).toBe('ollama');
      expect(result.fallbackUsed.model).toBe('llama3.2');
    });

    test('should use active provider when not OCR-only and no explicit validation provider', async () => {
      // Set standard model
      llmService.setProvider('gemini');
      llmService.setModel('gemini-3-flash-preview');
      llmService.setApiKey('gemini', 'test-key');

      // Mock _callGemini
      llmService._callGemini = vi.fn().mockResolvedValue('{"confidence": "confident", "summary": "Looks good", "issues": []}');

      const result = await llmService.validate('test text');
      expect(result.validationProvider).toBeUndefined(); // Should use active provider directly
      expect(llmService._callGemini).toHaveBeenCalled();
    });
  });

  describe('isOcrOnlyModel', () => {
    test('should detect DeepSeek-OCR as OCR-only', () => {
      llmService.setProvider('ollama');
      llmService.setModel('deepseek-ocr');
      expect(llmService.isOcrOnlyModel()).toBe(true);
    });

    test('should detect Mistral OCR as OCR-only', () => {
      llmService.setProvider('mistral');
      llmService.setModel('mistral-ocr-latest');
      expect(llmService.isOcrOnlyModel()).toBe(true);
    });

    test('should not detect Gemini as OCR-only', () => {
      llmService.setProvider('gemini');
      llmService.setModel('gemini-3-flash-preview');
      expect(llmService.isOcrOnlyModel()).toBe(false);
    });
  });
});
