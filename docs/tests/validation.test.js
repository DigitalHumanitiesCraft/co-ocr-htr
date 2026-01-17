/**
 * Tests for Validation Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ValidationEngine, VALIDATION_RULES } from '../js/services/validation.js';

// Mock LLM service
vi.mock('../js/services/llm.js', () => ({
  llmService: {
    hasApiKey: vi.fn(() => false),
    validate: vi.fn()
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

      expect(ruleIds).toContain('date_format');
      expect(ruleIds).toContain('currency_taler');
      expect(ruleIds).toContain('currency_groschen');
      expect(ruleIds).toContain('currency_gulden');
      expect(ruleIds).toContain('uncertain_marker');
      expect(ruleIds).toContain('illegible_marker');
      expect(ruleIds).toContain('table_consistency');
      expect(ruleIds).toContain('empty_cells');
    });

    it('should have valid rule structure', () => {
      engine.rules.forEach(rule => {
        expect(rule.id).toBeDefined();
        expect(rule.name).toBeDefined();
        expect(rule.type).toMatch(/^(success|warning|error)$/);
        expect(rule.messagePass).toBeDefined();
        expect(rule.messageFail).toBeDefined();
        expect(rule.regex || rule.validate).toBeDefined();
      });
    });
  });

  describe('Date Format Validation', () => {
    it('should detect German date formats', () => {
      const text = '28. Mai wurde die Rechnung erstellt. Am 3. Januar erfolgte die Zahlung.';
      const segments = [
        { text: '28. Mai wurde die Rechnung erstellt.' },
        { text: 'Am 3. Januar erfolgte die Zahlung.' }
      ];

      const results = engine.validateRules(text, segments);
      const dateRule = results.find(r => r.id === 'date_format');

      expect(dateRule.passed).toBe(true);
      expect(dateRule.matches).toContain('28. Mai');
      expect(dateRule.matches).toContain('3. Januar');
      expect(dateRule.lines).toContain(1);
      expect(dateRule.lines).toContain(2);
    });

    it('should not match invalid date formats', () => {
      const text = 'No dates here, just text.';
      const segments = [{ text: 'No dates here, just text.' }];

      const results = engine.validateRules(text, segments);
      const dateRule = results.find(r => r.id === 'date_format');

      expect(dateRule.passed).toBe(false);
      expect(dateRule.matches).toHaveLength(0);
    });

    it('should handle all German months', () => {
      const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

      months.forEach(month => {
        const text = `1. ${month}`;
        const results = engine.validateRules(text, [{ text }]);
        const dateRule = results.find(r => r.id === 'date_format');
        expect(dateRule.passed).toBe(true);
      });
    });
  });

  describe('Currency Validation', () => {
    it('should detect Taler currency', () => {
      const text = '5 Taler und 10 Tlr. sowie 3 Rtl.';
      const segments = [{ text }];

      const results = engine.validateRules(text, segments);
      const talerRule = results.find(r => r.id === 'currency_taler');

      expect(talerRule.passed).toBe(true);
      expect(talerRule.matches.length).toBeGreaterThanOrEqual(3);
    });

    it('should detect Groschen currency', () => {
      const text = '12 Groschen, 6 Gr. und 4 Sgr.';
      const segments = [{ text }];

      const results = engine.validateRules(text, segments);
      const groschenRule = results.find(r => r.id === 'currency_groschen');

      expect(groschenRule.passed).toBe(true);
      expect(groschenRule.matches.length).toBeGreaterThanOrEqual(3);
    });

    it('should detect Gulden/Kreuzer currency', () => {
      const text = '10 Gulden, 5 fl. und 30 Kreuzer';
      const segments = [{ text }];

      const results = engine.validateRules(text, segments);
      const guldenRule = results.find(r => r.id === 'currency_gulden');

      expect(guldenRule.passed).toBe(true);
      expect(guldenRule.matches.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Uncertainty Markers', () => {
    it('should detect [?] markers', () => {
      const text = 'Name ist [?] Müller';
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
      expect(illegibleRule.type).toBe('error');
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

  describe('Table Consistency Validation', () => {
    it('should pass for consistent column count', () => {
      const segments = [
        { text: '| A | B | C |' },
        { text: '| D | E | F |' },
        { text: '| G | H | I |' }
      ];

      const results = engine.validateRules('', segments);
      const tableRule = results.find(r => r.id === 'table_consistency');

      expect(tableRule.passed).toBe(true);
    });

    it('should detect inconsistent column count', () => {
      const segments = [
        { text: '| A | B | C |' },
        { text: '| D | E |' },      // Different column count
        { text: '| G | H | I |' }
      ];

      const results = engine.validateRules('', segments);
      const tableRule = results.find(r => r.id === 'table_consistency');

      expect(tableRule.passed).toBe(false);
      expect(tableRule.lines).toContain(2);
    });

    it('should handle segments without pipes', () => {
      const segments = [
        { text: 'Just plain text' },
        { text: 'No pipes here' }
      ];

      const results = engine.validateRules('', segments);
      const tableRule = results.find(r => r.id === 'table_consistency');

      expect(tableRule.passed).toBe(true);
    });

    it('should handle single segment', () => {
      const segments = [{ text: '| A | B |' }];

      const results = engine.validateRules('', segments);
      const tableRule = results.find(r => r.id === 'table_consistency');

      expect(tableRule.passed).toBe(true);
    });
  });

  describe('Empty Cells Validation', () => {
    it('should detect empty cells', () => {
      const segments = [
        { text: '| A |  | C |' },   // Empty middle cell
        { text: '| D | E | F |' }
      ];

      const results = engine.validateRules('', segments);
      const emptyRule = results.find(r => r.id === 'empty_cells');

      expect(emptyRule.passed).toBe(false);
      expect(emptyRule.lines).toContain(1);
    });

    it('should pass for filled cells', () => {
      const segments = [
        { text: '| A | B | C |' },
        { text: '| D | E | F |' }
      ];

      const results = engine.validateRules('', segments);
      const emptyRule = results.find(r => r.id === 'empty_cells');

      expect(emptyRule.passed).toBe(true);
    });

    it('should handle consecutive pipes as empty cells', () => {
      const segments = [
        { text: '| A || C |' }  // Missing middle value
      ];

      const results = engine.validateRules('', segments);
      const emptyRule = results.find(r => r.id === 'empty_cells');

      expect(emptyRule.passed).toBe(false);
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
      const segments = [
        { text: '10 Taler' },
        { text: 'keine Waehrung' },
        { text: '5 Taler' }
      ];

      const result = engine.validateRegex('10 Taler keine Waehrung 5 Taler', segments, regex);

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
    it('should call LLM service with correct perspective', async () => {
      llmService.hasApiKey.mockReturnValue(true);
      llmService.validate.mockResolvedValue({
        confidence: 'likely',
        reasoning: 'Test reasoning',
        issues: []
      });

      const result = await engine.validateWithLLM('Test text', 'paleographic');

      expect(llmService.validate).toHaveBeenCalledWith('Test text', 'paleographic');
      expect(result.perspective).toBe('paleographic');
      expect(result.confidence).toBe('likely');
    });

    it('should handle LLM errors gracefully', async () => {
      llmService.validate.mockRejectedValue(new Error('API Error'));

      const result = await engine.validateWithLLM('Test text', 'paleographic');

      expect(result.confidence).toBe('uncertain');
      expect(result.error).toBe('API Error');
    });
  });

  describe('Complete Validation', () => {
    it('should run rule-based validation', async () => {
      const text = '28. Mai - 10 Taler';
      const segments = [{ text }];

      const result = await engine.validate(text, segments, 'paleographic', false);

      expect(result.rules).toBeDefined();
      expect(result.rules.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should skip LLM when includeLLM is false', async () => {
      const result = await engine.validate('Test', [], 'paleographic', false);

      expect(result.llmJudge).toBeNull();
      expect(llmService.validate).not.toHaveBeenCalled();
    });

    it('should skip LLM when no API key', async () => {
      llmService.hasApiKey.mockReturnValue(false);

      const result = await engine.validate('Test', [], 'paleographic', true);

      expect(result.llmJudge).toBeNull();
    });

    it('should include LLM when available and requested', async () => {
      llmService.hasApiKey.mockReturnValue(true);
      llmService.validate.mockResolvedValue({
        confidence: 'certain',
        reasoning: 'Looks good',
        issues: []
      });

      const result = await engine.validate('Test', [], 'paleographic', true);

      expect(result.llmJudge).toBeDefined();
      expect(result.llmJudge.confidence).toBe('certain');
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
      expect(summary.counts.info).toBe(1);
    });

    it('should determine overall status from LLM result', () => {
      const ruleResults = [];
      const llmResult = { confidence: 'certain' };

      const summary = engine.calculateSummary(ruleResults, llmResult);

      expect(summary.llmConfidence).toBe('certain');
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
});
