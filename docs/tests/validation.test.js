/**
 * Tests for Validation Service
 *
 * Updated for v2.1: Generic validation prompt, no perspectives
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ValidationEngine, RULE_CATEGORIES } from '../js/services/validation.js';

// Mock LLM service
vi.mock('../js/services/llm.js', () => ({
  llmService: {
    hasApiKey: vi.fn(() => false),
    validate: vi.fn()
  },
  ISSUE_TYPES: {
    spelling: { name: 'Spelling', color: 'warning' },
    accent: { name: 'Accent', color: 'warning' },
    historical: { name: 'Historical', color: 'info' }
  }
}));

// Mock appState
vi.mock('../js/state.js', () => ({
  appState: {
    getState: vi.fn(() => ({}))
  }
}));

import { llmService } from '../js/services/llm.js';

describe('ValidationEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new ValidationEngine();
    vi.clearAllMocks();
  });

  describe('Rule Definitions', () => {
    it('should have all expected validation rules', () => {
      const ruleIds = engine.rules.map(r => r.id);

      // Current rules: markers, stats, artifacts
      expect(ruleIds).toContain('uncertain_marker');
      expect(ruleIds).toContain('illegible_marker');
      expect(ruleIds).toContain('abbreviations');
      expect(ruleIds).toContain('line_count');
      expect(ruleIds).toContain('char_count');
      expect(ruleIds).toContain('special_chars');
      expect(ruleIds).toContain('double_spaces');
      expect(ruleIds).toContain('control_chars');
    });

    it('should have valid rule structure', () => {
      engine.rules.forEach(rule => {
        expect(rule.id).toBeDefined();
        expect(rule.name).toBeDefined();
        expect(rule.category).toBeDefined();
        expect(rule.type).toMatch(/^(success|warning|error|info)$/);
        expect(rule.messagePass).toBeDefined();
        expect(rule.messageFail).toBeDefined();
        expect(rule.regex || rule.validate).toBeDefined();
      });
    });

    it('should have valid rule categories', () => {
      expect(RULE_CATEGORIES).toHaveProperty('markers');
      expect(RULE_CATEGORIES).toHaveProperty('stats');
      expect(RULE_CATEGORIES).toHaveProperty('artifacts');
    });
  });

  describe('Category-based Validation', () => {
    it('should filter by markers category', () => {
      const text = '[?] unsicher [illegible] unleserlich';
      const results = engine.validateRules(text, [], { markers: true, stats: false, artifacts: false });

      const ruleIds = results.map(r => r.id);
      expect(ruleIds).toContain('uncertain_marker');
      expect(ruleIds).toContain('illegible_marker');
      expect(ruleIds).not.toContain('line_count');
      expect(ruleIds).not.toContain('special_chars');
    });

    it('should filter by stats category', () => {
      const text = 'Test text\nLine two';
      const results = engine.validateRules(text, [], { markers: false, stats: true, artifacts: false });

      const ruleIds = results.map(r => r.id);
      expect(ruleIds).toContain('line_count');
      expect(ruleIds).toContain('char_count');
      expect(ruleIds).not.toContain('uncertain_marker');
    });

    it('should filter by artifacts category', () => {
      const text = 'Text  with  double spaces';
      const results = engine.validateRules(text, [], { markers: false, stats: false, artifacts: true });

      const ruleIds = results.map(r => r.id);
      expect(ruleIds).toContain('double_spaces');
      expect(ruleIds).toContain('special_chars');
      expect(ruleIds).toContain('control_chars');
      expect(ruleIds).not.toContain('line_count');
    });

    it('should include all categories by default', () => {
      const text = '[?] Test';
      const results = engine.validateRules(text, []);

      const categories = [...new Set(results.map(r => r.category))];
      expect(categories).toContain('markers');
      expect(categories).toContain('stats');
      expect(categories).toContain('artifacts');
    });
  });

  describe('Uncertainty Markers', () => {
    it('should detect [?] markers', () => {
      const text = 'Name ist [?] Mueller';
      const segments = [{ text }];

      const results = engine.validateRules(text, segments);
      const uncertainRule = results.find(r => r.id === 'uncertain_marker');

      expect(uncertainRule.passed).toBe(true);
      expect(uncertainRule.type).toBe('warning');
      expect(uncertainRule.lines).toContain(1);
    });

    it('should detect [illegible] markers', () => {
      const text = 'Der Betrag war [illegible] Taler';
      const segments = [{ text }];

      const results = engine.validateRules(text, segments);
      const illegibleRule = results.find(r => r.id === 'illegible_marker');

      expect(illegibleRule.passed).toBe(true);
      expect(illegibleRule.type).toBe('warning');
    });

    it('should detect [...] as illegible marker', () => {
      const text = 'Der Name war [...]';
      const results = engine.validateRules(text, []);
      const illegibleRule = results.find(r => r.id === 'illegible_marker');

      expect(illegibleRule.passed).toBe(true);
    });

    it('should handle multiple markers', () => {
      const text = '[?] und nochmal [?] sowie [illegible]';
      const segments = [{ text }];

      const results = engine.validateRules(text, segments);
      const uncertainRule = results.find(r => r.id === 'uncertain_marker');
      const illegibleRule = results.find(r => r.id === 'illegible_marker');

      expect(uncertainRule.matches).toHaveLength(2);
      expect(illegibleRule.matches).toHaveLength(1);
    });
  });

  describe('Abbreviation Detection', () => {
    it('should detect expanded abbreviations', () => {
      const text = 'Herr[n] Mueller kam am Dienstag[e]';
      const results = engine.validateRules(text, []);
      const abbrevRule = results.find(r => r.id === 'abbreviations');

      expect(abbrevRule.passed).toBe(true);
      expect(abbrevRule.matchCount).toBe(2);
    });

    it('should not match standalone brackets', () => {
      const text = '[?] and [illegible] are not abbreviations';
      const results = engine.validateRules(text, []);
      const abbrevRule = results.find(r => r.id === 'abbreviations');

      expect(abbrevRule.passed).toBe(false);
    });
  });

  describe('Text Statistics', () => {
    it('should count lines correctly', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      const results = engine.validateRules(text, []);
      const lineRule = results.find(r => r.id === 'line_count');

      expect(lineRule.passed).toBe(true);
      expect(lineRule.matchCount).toBe(3);
    });

    it('should ignore empty lines in count', () => {
      const text = 'Line 1\n\nLine 2\n\n';
      const results = engine.validateRules(text, []);
      const lineRule = results.find(r => r.id === 'line_count');

      expect(lineRule.matchCount).toBe(2);
    });

    it('should count characters', () => {
      const text = 'Test';
      const results = engine.validateRules(text, []);
      const charRule = results.find(r => r.id === 'char_count');

      expect(charRule.passed).toBe(true);
      expect(charRule.matchCount).toBe(4);
    });

    it('should handle empty text', () => {
      const results = engine.validateRules('', []);
      const lineRule = results.find(r => r.id === 'line_count');
      const charRule = results.find(r => r.id === 'char_count');

      expect(lineRule.passed).toBe(false);
      expect(charRule.passed).toBe(false);
    });
  });

  describe('OCR Artifacts Detection', () => {
    it('should detect double spaces', () => {
      const text = 'Text  with  double  spaces';
      const results = engine.validateRules(text, []);
      const doubleRule = results.find(r => r.id === 'double_spaces');

      expect(doubleRule.passed).toBe(true);
      expect(doubleRule.matchCount).toBe(3);
    });

    it('should detect control characters', () => {
      const text = 'Text with\x00control\x1Fchars';
      const results = engine.validateRules(text, []);
      const controlRule = results.find(r => r.id === 'control_chars');

      expect(controlRule.passed).toBe(true);
      expect(controlRule.type).toBe('error');
    });

    it('should allow normal whitespace', () => {
      const text = 'Normal text\nwith tabs\tand newlines';
      const results = engine.validateRules(text, []);
      const controlRule = results.find(r => r.id === 'control_chars');

      expect(controlRule.passed).toBe(false);
    });

    it('should detect unusual special characters', () => {
      const text = 'Text with unusual chars: \u2603 \u2764';
      const results = engine.validateRules(text, []);
      const specialRule = results.find(r => r.id === 'special_chars');

      expect(specialRule.passed).toBe(true);
    });

    it('should allow common characters', () => {
      const text = 'Normal text with umlauts: äöüÄÖÜß and punctuation: .,;:!?';
      const results = engine.validateRules(text, []);
      const specialRule = results.find(r => r.id === 'special_chars');

      expect(specialRule.passed).toBe(false);
    });
  });

  describe('Regex Validation', () => {
    it('should find all matches', () => {
      const regex = /\d+/g;
      const text = '10 Taler und 5 Groschen sowie 3 Pfennig';
      const segments = [
        { text: '10 Taler und 5 Groschen' },
        { text: 'sowie 3 Pfennig' }
      ];

      const result = engine.validateRegex(text, segments, regex);

      expect(result.passed).toBe(true);
      expect(result.matches).toContain('10');
      expect(result.matches).toContain('5');
      expect(result.matches).toContain('3');
    });

    it('should identify matching lines', () => {
      const regex = /Taler/gi;
      const text = '10 Taler\nkeine Waehrung\n5 Taler';

      const result = engine.validateRegex(text, [], regex);

      expect(result.lines).toContain(1);
      expect(result.lines).not.toContain(2);
      expect(result.lines).toContain(3);
    });

    it('should handle no matches', () => {
      const regex = /xyz/g;
      const text = 'No matches here';

      const result = engine.validateRegex(text, [], regex);

      expect(result.passed).toBe(false);
      expect(result.matches).toHaveLength(0);
    });
  });

  describe('LLM Validation', () => {
    it('should call LLM service with custom prompt', async () => {
      llmService.hasApiKey.mockReturnValue(true);
      llmService.validate.mockResolvedValue({
        confidence: 'likely',
        reasoning: 'Test reasoning',
        issues: []
      });

      const customPrompt = 'Custom validation prompt: {text}';
      const result = await engine.validateWithLLM('Test text', customPrompt);

      expect(llmService.validate).toHaveBeenCalledWith('Test text', { customPrompt });
      expect(result.confidence).toBe('likely');
    });

    it('should call LLM service without custom prompt', async () => {
      llmService.hasApiKey.mockReturnValue(true);
      llmService.validate.mockResolvedValue({
        confidence: 'confident',
        reasoning: 'All good',
        issues: []
      });

      const result = await engine.validateWithLLM('Test text', '');

      expect(llmService.validate).toHaveBeenCalledWith('Test text', { customPrompt: '' });
      expect(result.confidence).toBe('confident');
    });

    it('should handle LLM errors gracefully', async () => {
      llmService.validate.mockRejectedValue(new Error('API Error'));

      const result = await engine.validateWithLLM('Test text', '');

      expect(result.confidence).toBe('uncertain');
      expect(result.error).toBe('API Error');
    });
  });

  describe('Complete Validation', () => {
    it('should run rule-based validation with options', async () => {
      const text = '[?] unsicher - 10 Zeichen';
      const segments = [{ text }];

      const result = await engine.validate(text, segments, {
        checkMarkers: true,
        checkStats: true,
        checkArtifacts: false,
        includeLLM: false
      });

      expect(result.rules).toBeDefined();
      expect(result.rules.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(result.timestamp).toBeDefined();

      // Should have markers and stats, but not artifacts
      const categories = result.rules.map(r => r.category);
      expect(categories).toContain('markers');
      expect(categories).toContain('stats');
      expect(categories).not.toContain('artifacts');
    });

    it('should skip LLM when includeLLM is false', async () => {
      const result = await engine.validate('Test', [], { includeLLM: false });

      expect(result.llmJudge).toBeNull();
      expect(llmService.validate).not.toHaveBeenCalled();
    });

    it('should skip LLM when no API key', async () => {
      llmService.hasApiKey.mockReturnValue(false);

      const result = await engine.validate('Test', [], { includeLLM: true });

      expect(result.llmJudge).toBeNull();
    });

    it('should include LLM when available and requested', async () => {
      llmService.hasApiKey.mockReturnValue(true);
      llmService.validate.mockResolvedValue({
        confidence: 'confident',
        reasoning: 'Looks good',
        issues: []
      });

      const result = await engine.validate('Test', [], { includeLLM: true });

      expect(result.llmJudge).toBeDefined();
      expect(result.llmJudge.confidence).toBe('confident');
    });

    it('should pass custom prompt to LLM', async () => {
      llmService.hasApiKey.mockReturnValue(true);
      llmService.validate.mockResolvedValue({
        confidence: 'likely',
        reasoning: 'Custom check done',
        issues: []
      });

      const customPrompt = 'Check for specific issue: {text}';
      await engine.validate('Test', [], { includeLLM: true, customPrompt });

      expect(llmService.validate).toHaveBeenCalledWith('Test', { customPrompt });
    });

    it('should support legacy signature for backwards compatibility', async () => {
      // Old signature: validate(text, segments, perspective, includeLLM)
      const result = await engine.validate('Test', [], 'paleographic', false);

      expect(result.rules).toBeDefined();
      expect(result.llmJudge).toBeNull();
    });
  });

  describe('Summary Calculation', () => {
    it('should count result types correctly', () => {
      const ruleResults = [
        { type: 'success', passed: true },
        { type: 'success', passed: true },
        { type: 'warning', passed: true },
        { type: 'error', passed: true },
        { type: 'info', passed: false }
      ];

      const summary = engine.calculateSummary(ruleResults, null);

      expect(summary.counts.success).toBe(2);
      expect(summary.counts.warning).toBe(1);
      expect(summary.counts.error).toBe(1);
    });

    it('should determine overall status from LLM result', () => {
      const ruleResults = [];
      const llmResult = { confidence: 'confident' };

      const summary = engine.calculateSummary(ruleResults, llmResult);

      expect(summary.llmConfidence).toBe('confident');
      expect(summary.status).toBe('success');
    });

    it('should handle missing LLM result', () => {
      const ruleResults = [
        { type: 'warning', passed: true }
      ];

      const summary = engine.calculateSummary(ruleResults, null);

      expect(summary.llmConfidence).toBeNull();
      expect(summary.status).toBe('warning');
    });

    it('should set error status when error results present', () => {
      const ruleResults = [
        { type: 'error', passed: true }
      ];

      const summary = engine.calculateSummary(ruleResults, null);

      expect(summary.status).toBe('error');
      expect(summary.totalIssues).toBe(1);
    });

    it('should set error status when LLM confidence is uncertain', () => {
      const ruleResults = [];
      const llmResult = { confidence: 'uncertain' };

      const summary = engine.calculateSummary(ruleResults, llmResult);

      expect(summary.status).toBe('error');
    });
  });

  describe('getCategories', () => {
    it('should return formatted category list', () => {
      const categories = engine.getCategories();

      expect(categories).toHaveLength(3);

      const markers = categories.find(c => c.id === 'markers');
      expect(markers).toBeDefined();
      expect(markers.name).toBe('Transcription Markers');
      expect(markers.ruleCount).toBeGreaterThan(0);
    });
  });
});
