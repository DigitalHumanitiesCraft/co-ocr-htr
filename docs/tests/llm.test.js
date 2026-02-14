/**
 * Tests for LLM Service
 *
 * Updated for v2.1: Removed deepseek provider, no perspective parameter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LLMService, LLMError, PROVIDERS, VALID_ISSUE_TYPES,
  buildTranscriptionPrompt,
  buildPaleographicReviewPrompt, buildPhilologicalReviewPrompt
} from '../js/services/llm.js';

// Mock storage module
vi.mock('../js/services/storage.js', () => ({
  storage: {
    loadApiKey: vi.fn(),
    hasApiKey: vi.fn(),
    saveApiKey: vi.fn()
  }
}));

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
      expect(model).toBe('gemini-3-flash-preview');
    });

    it('should return custom model when set', () => {
      service.setModel('gemini-3-pro-preview');
      expect(service.getCurrentModel()).toBe('gemini-3-pro-preview');
    });
  });

  describe('API Key Handling', () => {
    it('should check if API key exists in memory', () => {
      // API keys are now stored in memory only, not in storage
      expect(service.hasApiKey()).toBe(false); // No key set yet

      service.setApiKey('gemini', 'test-key');
      expect(service.hasApiKey()).toBe(true);
    });

    it('should always return true for ollama', () => {
      service.setProvider('ollama');
      expect(service.hasApiKey()).toBe(true);
    });

    it('should list available providers with status', () => {
      // Set API key for gemini in memory
      service.setApiKey('gemini', 'test-key');

      const providers = service.getAvailableProviders();

      expect(providers).toHaveLength(6); // gemini, openai, anthropic, mistral, ollama, azure-mistral

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

    it('should mark ollama as supporting vision', () => {
      expect(PROVIDERS.ollama.supportsVision).toBe(true);
    });
  });

  describe('Response Parsing', () => {
    it('should parse markdown table response', () => {
      const mockResponse = `| Datum | Name | Beschreibung | Betrag |
|-------|------|--------------|--------|
| 28. Mai | K. Schmidt | Eisenwaren | 23 Taler |
| 3. Juni | H. Mueller | Tuchstoff | 15 Taler |`;

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

      const result = service._parseValidationResponse(mockResponse);

      expect(result.confidence).toBe('likely');
      expect(result.reasoning).toBe('Some issues found');
    });

    it('should handle malformed validation response', () => {
      const mockResponse = `The text looks plausible but needs review.`;

      const result = service._parseValidationResponse(mockResponse);

      expect(result.confidence).toBe('likely'); // "plausible" in text
    });

    it('should parse issues from validation response', () => {
      const mockResponse = `{
        "confidence": "likely",
        "reasoning": "Found some issues",
        "issues": [
          {"line": 1, "text": "typo", "type": "spelling", "suggestion": "fixed"}
        ]
      }`;

      const result = service._parseValidationResponse(mockResponse);

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('spelling');
      expect(result.issues[0].line).toBe(1);
    });
  });

  describe('Issue Schema Normalization (_normalizeIssue)', () => {
    it('should normalize a valid issue with all required fields', () => {
      const issue = service._normalizeIssue({
        line: 5, text: 'typo', type: 'spelling', suggestion: 'fixed', explanation: 'Misspelled'
      });
      expect(issue).toEqual({
        line: 5, text: 'typo', type: 'spelling', suggestion: 'fixed', explanation: 'Misspelled'
      });
    });

    it('should return null for null/undefined/non-object input', () => {
      expect(service._normalizeIssue(null)).toBeNull();
      expect(service._normalizeIssue(undefined)).toBeNull();
      expect(service._normalizeIssue('string')).toBeNull();
      expect(service._normalizeIssue(42)).toBeNull();
    });

    it('should return null when both text and suggestion are empty', () => {
      expect(service._normalizeIssue({ line: 1, text: '', suggestion: '' })).toBeNull();
      expect(service._normalizeIssue({ line: 1, text: '  ', suggestion: null })).toBeNull();
    });

    it('should keep issue when text is present but suggestion is empty', () => {
      const issue = service._normalizeIssue({ line: 1, text: 'word', type: 'spelling' });
      expect(issue).not.toBeNull();
      expect(issue.text).toBe('word');
      expect(issue.suggestion).toBeNull();
    });

    it('should keep issue when suggestion is present but text is empty', () => {
      const issue = service._normalizeIssue({ line: 1, text: '', suggestion: 'fix', type: 'spelling' });
      expect(issue).not.toBeNull();
      expect(issue.suggestion).toBe('fix');
    });

    it('should coerce string line numbers to integers', () => {
      const issue = service._normalizeIssue({ line: '7', text: 'a', type: 'spelling' });
      expect(issue.line).toBe(7);
    });

    it('should floor floating-point line numbers', () => {
      const issue = service._normalizeIssue({ line: 3.7, text: 'a', type: 'spelling' });
      expect(issue.line).toBe(3);
    });

    it('should default invalid line values to 1 (minimum contract)', () => {
      expect(service._normalizeIssue({ line: -1, text: 'a', type: 'spelling' }).line).toBe(1);
      expect(service._normalizeIssue({ line: 0, text: 'a', type: 'spelling' }).line).toBe(1);
      expect(service._normalizeIssue({ line: NaN, text: 'a', type: 'spelling' }).line).toBe(1);
      expect(service._normalizeIssue({ line: 'abc', text: 'a', type: 'spelling' }).line).toBe(1);
    });

    it('should trim text field', () => {
      const issue = service._normalizeIssue({ line: 1, text: '  word  ', type: 'spelling', suggestion: 'x' });
      expect(issue.text).toBe('word');
    });

    it('should fallback explanation to suggestion when explanation is missing', () => {
      const issue = service._normalizeIssue({ line: 1, text: 'a', type: 'spelling', suggestion: 'fix' });
      expect(issue.explanation).toBe('fix');
    });

    it('should fallback explanation to empty string when both are missing', () => {
      const issue = service._normalizeIssue({ line: 1, text: 'word', type: 'spelling' });
      expect(issue.explanation).toBe('');
    });

    it('should normalize unknown issue types via fuzzy matching', () => {
      expect(service._normalizeIssue({ line: 1, text: 'a', type: 'orthographic' }).type).toBe('spelling');
      expect(service._normalizeIssue({ line: 1, text: 'a', type: 'diacritics_error' }).type).toBe('accent');
      expect(service._normalizeIssue({ line: 1, text: 'a', type: 'layout_issue' }).type).toBe('structural');
    });

    it('should default completely unknown types to spelling', () => {
      expect(service._normalizeIssue({ line: 1, text: 'a', type: 'xyzzy' }).type).toBe('spelling');
      expect(service._normalizeIssue({ line: 1, text: 'a', type: '' }).type).toBe('spelling');
      expect(service._normalizeIssue({ line: 1, text: 'a' }).type).toBe('spelling');
    });
  });

  describe('Optional Issue Metadata (stage, alternatives, score)', () => {
    it('should pass through stage field when present', () => {
      const issue = service._normalizeIssue({
        line: 1, text: 'a', type: 'spelling', suggestion: 'b', stage: 'paleographic'
      });
      expect(issue.stage).toBe('paleographic');
    });

    it('should not include stage when missing or empty', () => {
      const issue = service._normalizeIssue({ line: 1, text: 'a', type: 'spelling' });
      expect(issue).not.toHaveProperty('stage');
    });

    it('should pass through alternatives array', () => {
      const issue = service._normalizeIssue({
        line: 1, text: 'a', type: 'spelling', alternatives: ['fix1', 'fix2']
      });
      expect(issue.alternatives).toEqual(['fix1', 'fix2']);
    });

    it('should filter non-string alternatives', () => {
      const issue = service._normalizeIssue({
        line: 1, text: 'a', type: 'spelling', alternatives: ['ok', 42, null, 'also_ok']
      });
      expect(issue.alternatives).toEqual(['ok', 'also_ok']);
    });

    it('should not include alternatives when empty array', () => {
      const issue = service._normalizeIssue({ line: 1, text: 'a', type: 'spelling', alternatives: [] });
      expect(issue).not.toHaveProperty('alternatives');
    });

    it('should clamp score to 0-1 range', () => {
      expect(service._normalizeIssue({ line: 1, text: 'a', type: 'spelling', score: 0.82 }).score).toBe(0.82);
      expect(service._normalizeIssue({ line: 1, text: 'a', type: 'spelling', score: 1.5 }).score).toBe(1);
      expect(service._normalizeIssue({ line: 1, text: 'a', type: 'spelling', score: -0.3 }).score).toBe(0);
    });

    it('should not include score when non-numeric', () => {
      const issue = service._normalizeIssue({ line: 1, text: 'a', type: 'spelling', score: 'high' });
      expect(issue).not.toHaveProperty('score');
    });
  });

  describe('Confidence Normalization (_normalizeConfidence)', () => {
    it('should return canonical confidence values unchanged', () => {
      expect(service._normalizeConfidence('confident')).toBe('confident');
      expect(service._normalizeConfidence('likely')).toBe('likely');
      expect(service._normalizeConfidence('uncertain')).toBe('uncertain');
    });

    it('should map "certain" to "confident"', () => {
      expect(service._normalizeConfidence('certain')).toBe('confident');
    });

    it('should default null/undefined/empty to uncertain', () => {
      expect(service._normalizeConfidence(null)).toBe('uncertain');
      expect(service._normalizeConfidence(undefined)).toBe('uncertain');
      expect(service._normalizeConfidence('')).toBe('uncertain');
    });

    it('should map expert domain values to canonical', () => {
      expect(service._normalizeConfidence('sure')).toBe('confident');
      expect(service._normalizeConfidence('high')).toBe('confident');
      expect(service._normalizeConfidence('check-worthy')).toBe('likely');
      expect(service._normalizeConfidence('medium')).toBe('likely');
      expect(service._normalizeConfidence('problematic')).toBe('uncertain');
      expect(service._normalizeConfidence('low')).toBe('uncertain');
    });

    it('should default truly unknown values to uncertain', () => {
      expect(service._normalizeConfidence('banana')).toBe('uncertain');
      expect(service._normalizeConfidence('xyz')).toBe('uncertain');
    });
  });

  describe('Confidence Extraction from Raw Text (_extractConfidenceFromText)', () => {
    it('should extract "sure" from raw text as confident', () => {
      expect(service._extractConfidenceFromText('The reading is "sure" overall.')).toBe('confident');
    });

    it('should extract "check-worthy" from raw text as likely', () => {
      expect(service._extractConfidenceFromText('The confidence is "check-worthy".')).toBe('likely');
    });

    it('should extract "confident" from raw text', () => {
      expect(service._extractConfidenceFromText('Overall assessment: "confident".')).toBe('confident');
    });

    it('should extract "certain" from raw text as confident', () => {
      expect(service._extractConfidenceFromText('The text looks "certain".')).toBe('confident');
    });

    it('should extract "likely" from raw text', () => {
      expect(service._extractConfidenceFromText('Assessment: "likely" correct.')).toBe('likely');
    });

    it('should detect "plausible" (unquoted) in raw text as likely', () => {
      expect(service._extractConfidenceFromText('The text is plausible but needs review.')).toBe('likely');
    });

    it('should default to uncertain for raw text without confidence keywords', () => {
      expect(service._extractConfidenceFromText('Some random text without keywords.')).toBe('uncertain');
    });

    it('should return uncertain for null/undefined/empty input', () => {
      expect(service._extractConfidenceFromText(null)).toBe('uncertain');
      expect(service._extractConfidenceFromText(undefined)).toBe('uncertain');
      expect(service._extractConfidenceFromText('')).toBe('uncertain');
    });
  });

  describe('Canonical Marker Normalization in _normalizeIssue (PPV1-302)', () => {
    it('should normalize [uncertain] to [?] in issue text', () => {
      const issue = service._normalizeIssue({
        line: 1, text: '[uncertain]', type: 'spelling', suggestion: 'fix'
      });
      expect(issue.text).toBe('[?]');
    });

    it('should normalize [unreadable] to [illegible] in issue text', () => {
      const issue = service._normalizeIssue({
        line: 1, text: '[unreadable]', type: 'illegible', suggestion: 'something'
      });
      expect(issue.text).toBe('[illegible]');
    });

    it('should normalize [gap] to [...] in issue suggestion', () => {
      const issue = service._normalizeIssue({
        line: 1, text: 'word', type: 'spelling', suggestion: '[gap]'
      });
      expect(issue.suggestion).toBe('[...]');
    });

    it('should normalize [..] (double dot) to [...] in issue text', () => {
      const issue = service._normalizeIssue({
        line: 1, text: '[..]', type: 'illegible', suggestion: 'fix'
      });
      expect(issue.text).toBe('[...]');
    });

    it('should normalize [lacuna] to [...] in issue suggestion', () => {
      const issue = service._normalizeIssue({
        line: 2, text: 'word', type: 'spelling', suggestion: '[lacuna]'
      });
      expect(issue.suggestion).toBe('[...]');
    });

    it('should normalize [unleserlich] to [illegible] in issue text', () => {
      const issue = service._normalizeIssue({
        line: 3, text: '[unleserlich]', type: 'illegible', suggestion: 'fix'
      });
      expect(issue.text).toBe('[illegible]');
    });

    it('should normalize [unsicher] to [?] in issue text', () => {
      const issue = service._normalizeIssue({
        line: 4, text: '[unsicher]', type: 'spelling', suggestion: 'word'
      });
      expect(issue.text).toBe('[?]');
    });

    it('should leave canonical markers unchanged', () => {
      const issue1 = service._normalizeIssue({ line: 1, text: '[?]', type: 'spelling', suggestion: 'a' });
      expect(issue1.text).toBe('[?]');

      const issue2 = service._normalizeIssue({ line: 1, text: '[illegible]', type: 'illegible', suggestion: 'b' });
      expect(issue2.text).toBe('[illegible]');

      const issue3 = service._normalizeIssue({ line: 1, text: '[...]', type: 'spelling', suggestion: 'c' });
      expect(issue3.text).toBe('[...]');
    });

    it('should normalize markers in mixed text with surrounding words', () => {
      const issue = service._normalizeIssue({
        line: 1, text: 'domin[uncertain]s', type: 'spelling', suggestion: 'dominus'
      });
      expect(issue.text).toBe('domin[?]s');
    });
  });

  describe('Contract: _parseValidationResponse hardened', () => {
    it('should filter out broken issues from valid JSON', () => {
      const response = JSON.stringify({
        confidence: 'likely',
        issues: [
          { line: 1, text: 'good', type: 'spelling', suggestion: 'ok' },
          { line: 2, text: '', suggestion: '' },
          null,
          { line: 3, text: 'also good', type: 'accent' }
        ]
      });
      const result = service._parseValidationResponse(response);
      expect(result.issues).toHaveLength(2);
      expect(result.issues[0].text).toBe('good');
      expect(result.issues[1].text).toBe('also good');
    });

    it('should preserve optional metadata through full parse', () => {
      const response = JSON.stringify({
        confidence: 'confident',
        issues: [{
          line: 5, text: 'domiuuui', type: 'spelling',
          suggestion: 'dominum', explanation: 'Minim',
          stage: 'paleographic', score: 0.9, alternatives: ['dominuni']
        }]
      });
      const result = service._parseValidationResponse(response);
      expect(result.issues[0].stage).toBe('paleographic');
      expect(result.issues[0].score).toBe(0.9);
      expect(result.issues[0].alternatives).toEqual(['dominuni']);
    });

    it('should handle completely empty issues array', () => {
      const response = JSON.stringify({ confidence: 'confident', issues: [] });
      const result = service._parseValidationResponse(response);
      expect(result.issues).toEqual([]);
      expect(result.confidence).toBe('confident');
    });

    it('should handle missing issues key', () => {
      const response = JSON.stringify({ confidence: 'likely', reasoning: 'Looks good' });
      const result = service._parseValidationResponse(response);
      expect(result.issues).toEqual([]);
      expect(result.reasoning).toBe('Looks good');
    });

    it('should return fallback for non-JSON response', () => {
      const result = service._parseValidationResponse('The text looks "confident" overall.');
      expect(result.confidence).toBe('confident');
      expect(result.issues).toEqual([]);
    });
  });

  describe('VALID_ISSUE_TYPES constant', () => {
    it('should contain exactly 8 types', () => {
      expect(VALID_ISSUE_TYPES).toHaveLength(8);
    });

    it('should contain all expected types', () => {
      const expected = ['spelling', 'accent', 'abbreviation', 'illegible', 'ocr_artifact', 'historical', 'structural', 'plausibility'];
      expect(VALID_ISSUE_TYPES).toEqual(expected);
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
    it('should throw error if no API key configured', async () => {
      // API keys are now in memory only - ensure none is set
      service.setApiKey('gemini', ''); // Clear any key

      await expect(service.transcribe('base64image'))
        .rejects.toThrow(/No API key configured|noApiKeyFor/);
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

describe('Post-Processing Prompt Builders', () => {
  it('buildTranscriptionPrompt includes context and script hints', () => {
    const prompt = buildTranscriptionPrompt('Latin liturgical text', { scriptType: 'textura' });
    expect(prompt).toContain('DOCUMENT CONTEXT:\nLatin liturgical text');
    expect(prompt).toContain('SCRIPT-SPECIFIC HINTS:');
    expect(prompt).toContain('CRITICAL: This script uses minim-heavy letterforms');
  });

  it('buildPaleographicReviewPrompt uses selected profile prompt when configured', () => {
    const prompt = buildPaleographicReviewPrompt(
      'linea prima',
      'Script: Textura; Language: Latin',
      { profileId: 'medieval_latin_manuscript', overrides: {} }
    );

    expect(prompt).toContain('INTERNAL PROTOCOL:');
    expect(prompt).toContain('Primary paleographer');
    expect(prompt).toContain('Skeptical verifier');
    expect(prompt).toContain('DOCUMENT CONTEXT:\nScript: Textura; Language: Latin');
    expect(prompt).toContain('TRANSCRIPTION:\nlinea prima');
  });

  it('buildPhilologicalReviewPrompt includes previous issues and anti-duplication instruction', () => {
    const prompt = buildPhilologicalReviewPrompt(
      'ecce rex',
      'Text type: liturgical',
      [{ line: 3, text: 'misam', suggestion: 'missam', type: 'spelling' }],
      { profileId: 'medieval_latin_manuscript', overrides: {} }
    );

    expect(prompt).toContain('INTERNAL PROTOCOL:');
    expect(prompt).toContain('Latin philologist');
    expect(prompt).toContain('Historical-language verifier');
    expect(prompt).toContain('PREVIOUS ISSUES (already flagged, do NOT repeat):');
    expect(prompt).toContain('- Line 3: "misam" -> "missam" (spelling)');
    expect(prompt).toContain('Do not repeat previous issues');
  });

  it('buildPhilologicalReviewPrompt falls back to "No previous issues flagged."', () => {
    const prompt = buildPhilologicalReviewPrompt('ecce rex', '', []);
    expect(prompt).toContain('No previous issues flagged.');
  });

  it('stage override takes precedence over profile and default prompts', () => {
    const prompt = buildPaleographicReviewPrompt('linea prima', '', {
      profileId: 'medieval_latin_manuscript',
      overrides: {
        stage2: 'CUSTOM STAGE 2 PROMPT\nTRANSCRIPTION:\n{text}'
      }
    });
    expect(prompt).toContain('CUSTOM STAGE 2 PROMPT');
    expect(prompt).toContain('TRANSCRIPTION:\nlinea prima');
    expect(prompt).not.toContain('Primary Paleographer');
  });

  it('stage1 override takes precedence for transcription prompt', () => {
    const prompt = buildTranscriptionPrompt('Some context', { scriptType: 'textura' }, {
      profileId: 'medieval_latin_manuscript',
      overrides: {
        stage1: 'CUSTOM STAGE1 OVERRIDE',
        stage2: '',
        stage3: ''
      }
    });

    expect(prompt).toContain('CUSTOM STAGE1 OVERRIDE');
    expect(prompt).not.toContain('You are a specialist for diplomatic transcription of medieval Latin manuscripts.');
  });
});

// ============================================
// normalizeMarkers utility (PPV1-302)
// ============================================

describe('normalizeMarkers', () => {
  let normalizeMarkers;

  beforeEach(async () => {
    const mod = await import('../js/utils/textFormatting.js');
    normalizeMarkers = mod.normalizeMarkers;
  });

  describe('Uncertain variants -> [?]', () => {
    it('should normalize [uncertain] to [?]', () => {
      expect(normalizeMarkers('[uncertain]')).toBe('[?]');
    });

    it('should normalize [unsicher] to [?]', () => {
      expect(normalizeMarkers('[unsicher]')).toBe('[?]');
    });

    it('should normalize [unclear] to [?]', () => {
      expect(normalizeMarkers('[unclear]')).toBe('[?]');
    });

    it('should normalize [unklar] to [?]', () => {
      expect(normalizeMarkers('[unklar]')).toBe('[?]');
    });
  });

  describe('Illegible variants -> [illegible]', () => {
    it('should normalize [unreadable] to [illegible]', () => {
      expect(normalizeMarkers('[unreadable]')).toBe('[illegible]');
    });

    it('should normalize [unleserlich] to [illegible]', () => {
      expect(normalizeMarkers('[unleserlich]')).toBe('[illegible]');
    });

    it('should normalize [unlesbar] to [illegible]', () => {
      expect(normalizeMarkers('[unlesbar]')).toBe('[illegible]');
    });

    it('should normalize [not readable] to [illegible]', () => {
      expect(normalizeMarkers('[not readable]')).toBe('[illegible]');
    });
  });

  describe('Ellipsis variants -> [...]', () => {
    it('should normalize [gap] to [...]', () => {
      expect(normalizeMarkers('[gap]')).toBe('[...]');
    });

    it('should normalize [lacuna] to [...]', () => {
      expect(normalizeMarkers('[lacuna]')).toBe('[...]');
    });

    it('should normalize [..] (double dot) to [...]', () => {
      expect(normalizeMarkers('[..]')).toBe('[...]');
    });

    it('should normalize [.....] (5 dots) to [...]', () => {
      expect(normalizeMarkers('[.....]')).toBe('[...]');
    });

    it('should normalize [......] (many dots) to [...]', () => {
      expect(normalizeMarkers('[......]')).toBe('[...]');
    });
  });

  describe('Already-canonical markers pass through unchanged', () => {
    it('should leave [?] unchanged', () => {
      expect(normalizeMarkers('[?]')).toBe('[?]');
    });

    it('should leave [illegible] unchanged', () => {
      expect(normalizeMarkers('[illegible]')).toBe('[illegible]');
    });

    it('should leave [...] unchanged', () => {
      expect(normalizeMarkers('[...]')).toBe('[...]');
    });
  });

  describe('Edge cases', () => {
    it('should return text without markers unchanged', () => {
      expect(normalizeMarkers('Hello world')).toBe('Hello world');
    });

    it('should return empty string for empty input', () => {
      expect(normalizeMarkers('')).toBe('');
    });

    it('should return empty string for null input', () => {
      expect(normalizeMarkers(null)).toBe('');
    });

    it('should return empty string for undefined input', () => {
      expect(normalizeMarkers(undefined)).toBe('');
    });

    it('should handle text with markers embedded in surrounding words', () => {
      expect(normalizeMarkers('before [uncertain] after')).toBe('before [?] after');
    });

    it('should handle multiple different markers in one string', () => {
      const result = normalizeMarkers('word [uncertain] middle [unreadable] end [gap]');
      expect(result).toBe('word [?] middle [illegible] end [...]');
    });

    it('should be case insensitive for variant markers', () => {
      expect(normalizeMarkers('[UNCERTAIN]')).toBe('[?]');
      expect(normalizeMarkers('[Unreadable]')).toBe('[illegible]');
      expect(normalizeMarkers('[GAP]')).toBe('[...]');
    });
  });
});
