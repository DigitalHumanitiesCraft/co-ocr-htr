/**
 * Tests for Description Feature (Illuminated Initials Analysis)
 *
 * Covers:
 * - State management: setDescription, setDescriptionRaw, setBatchDescriptions, getDescription
 * - Event emission: descriptionComplete, batchDescriptionComplete
 * - Per-page descriptions (pageDescriptions store)
 * - Page switching preserves/restores descriptions
 * - Session save/restore includes description data
 * - LLM service: describe() method (Gemini-only enforcement)
 * - Export: JSON and Markdown include descriptions
 * - Storage: description prompt persistence
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// State Management Tests
// ============================================

// Mock storage for state tests
vi.mock('../js/services/storage.js', () => ({
  storage: {
    loadSettings: vi.fn(() => ({ autoSave: false })),
    saveSettings: vi.fn(),
    getActiveProjectId: vi.fn(() => null),
    setActiveProjectId: vi.fn(),
    clearActiveProjectId: vi.fn(),
    listProjects: vi.fn(async () => []),
    createProject: vi.fn(async (project) => project),
    getProject: vi.fn(async () => undefined),
    updateProject: vi.fn(async (id, updates) => ({ id, ...updates })),
    deleteProject: vi.fn(async () => {}),
    renameProject: vi.fn(async () => {}),
    saveSession: vi.fn(async () => {}),
    loadSession: vi.fn(async () => null),
    clearSession: vi.fn(async () => {}),
    saveImage: vi.fn(async () => {}),
    saveImages: vi.fn(async () => {}),
    loadImage: vi.fn(async () => null),
    loadAllImages: vi.fn(async () => ({})),
    deleteImages: vi.fn(async () => {}),
    saveApiKey: vi.fn(async () => {}),
    loadApiKey: vi.fn(async () => null),
    loadAllApiKeys: vi.fn(async () => ({})),
    deleteApiKey: vi.fn(async () => {}),
    deleteAllApiKeys: vi.fn(async () => {}),
    saveDescriptionPrompt: vi.fn(),
    loadDescriptionPrompt: vi.fn(() => '')
  }
}));

import { storage } from '../js/services/storage.js';

let appState;

describe('Description Feature', () => {

  // ============================================
  // State Management
  // ============================================

  describe('Description State', () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      vi.resetModules();

      const module = await import('../js/state.js');
      appState = module.appState;

      // Reset state
      appState.data.project = { id: null, name: '' };
      appState.data.document = { id: null, filename: '', mimeType: '', dataUrl: '', width: 0, height: 0 };
      appState.data.pages = [];
      appState.data.currentPageIndex = 0;
      appState.data.pageTranscriptions = {};
      appState.data.pageDescriptions = {};
      appState.data.batchDescriptions = [];
      appState.data.transcription = { id: null, provider: '', model: '', raw: '', segments: [], columns: [], lines: [] };
      appState.data.description = { id: null, provider: 'gemini', model: '', customPrompt: '', raw: '', timestamp: null };
      appState.data.regions = [];
      appState.data.validation = { status: 'idle', rules: [], llmJudge: null };
      appState.data.corrections = [];
      appState.data.batchTranscriptions = [];
      appState.data.batchValidations = [];
      appState.data.ui = { zoom: 100, selectedLine: null, isLoading: false, loadingMessage: '', activeDialog: null, error: null };
    });

    it('should have initial description state structure', () => {
      const state = appState.getState();
      expect(state).toHaveProperty('description');
      expect(state.description).toHaveProperty('id');
      expect(state.description).toHaveProperty('provider');
      expect(state.description).toHaveProperty('model');
      expect(state.description).toHaveProperty('customPrompt');
      expect(state.description).toHaveProperty('raw');
      expect(state.description).toHaveProperty('timestamp');
      expect(state.description.provider).toBe('gemini');
    });

    it('should have pageDescriptions and batchDescriptions', () => {
      const state = appState.getState();
      expect(state).toHaveProperty('pageDescriptions');
      expect(state).toHaveProperty('batchDescriptions');
      expect(state.pageDescriptions).toEqual({});
      expect(state.batchDescriptions).toEqual([]);
    });

    // --- setDescription ---

    it('should set description data', () => {
      appState.setDescription({
        provider: 'gemini',
        model: 'gemini-3-pro-preview',
        customPrompt: 'Describe the illuminated initial',
        raw: 'This manuscript features a historiated initial...'
      });

      const desc = appState.data.description;
      expect(desc.provider).toBe('gemini');
      expect(desc.model).toBe('gemini-3-pro-preview');
      expect(desc.customPrompt).toBe('Describe the illuminated initial');
      expect(desc.raw).toBe('This manuscript features a historiated initial...');
      expect(desc.id).toBeTruthy();
      expect(desc.timestamp).toBeTruthy();
    });

    it('should generate unique ID on setDescription', () => {
      appState.setDescription({ raw: 'Test 1' });
      const id1 = appState.data.description.id;

      appState.setDescription({ raw: 'Test 2' });
      const id2 = appState.data.description.id;

      expect(id1).not.toBe(id2);
    });

    it('should always set provider to gemini', () => {
      appState.setDescription({ provider: 'openai', raw: 'Test' });
      expect(appState.data.description.provider).toBe('gemini');
    });

    it('should emit descriptionComplete event', () => {
      let eventFired = false;
      let eventDetail = null;

      appState.addEventListener('descriptionComplete', (e) => {
        eventFired = true;
        eventDetail = e.detail;
      });

      appState.setDescription({ provider: 'gemini', model: 'gemini-3-pro-preview', raw: 'Test' });

      expect(eventFired).toBe(true);
      expect(eventDetail.provider).toBe('gemini');
      expect(eventDetail.model).toBe('gemini-3-pro-preview');
    });

    it('should update meta.updatedAt on setDescription', () => {
      appState.data.meta = { createdAt: null, updatedAt: null };
      appState.setDescription({ raw: 'Test' });
      expect(appState.data.meta.updatedAt).toBeTruthy();
    });

    // --- setDescriptionRaw ---

    it('should update raw description text', () => {
      appState.setDescription({ raw: 'Original text' });
      appState.setDescriptionRaw('Edited text by user');
      expect(appState.data.description.raw).toBe('Edited text by user');
    });

    it('should update meta.updatedAt on setDescriptionRaw', () => {
      appState.data.meta = { createdAt: null, updatedAt: null };
      appState.setDescriptionRaw('some edit');
      expect(appState.data.meta.updatedAt).toBeTruthy();
    });

    // --- getDescription ---

    it('should return current description when no pageId', () => {
      appState.setDescription({ raw: 'Current page desc', model: 'gemini-3-pro-preview' });
      const desc = appState.getDescription();
      expect(desc.raw).toBe('Current page desc');
    });

    it('should return page description for specific pageId', () => {
      appState.data.pageDescriptions['page-42'] = {
        raw: 'Page 42 description',
        model: 'gemini-3-pro-preview'
      };
      const desc = appState.getDescription('page-42');
      expect(desc.raw).toBe('Page 42 description');
    });

    it('should return null for missing page description', () => {
      const desc = appState.getDescription('nonexistent-page');
      expect(desc).toBeNull();
    });

    // --- setBatchDescriptions ---

    it('should store batch descriptions', () => {
      const results = [
        { pageId: 'p1', pageIndex: 0, success: true, description: { raw: 'Desc 1', model: 'gemini-3-pro-preview', customPrompt: '' } },
        { pageId: 'p2', pageIndex: 1, success: true, description: { raw: 'Desc 2', model: 'gemini-3-pro-preview', customPrompt: '' } },
        { pageId: 'p3', pageIndex: 2, success: false, error: 'Rate limit' }
      ];

      appState.setBatchDescriptions(results);

      expect(appState.data.batchDescriptions).toHaveLength(3);
      expect(appState.data.pageDescriptions['p1']).toBeTruthy();
      expect(appState.data.pageDescriptions['p1'].raw).toBe('Desc 1');
      expect(appState.data.pageDescriptions['p2'].raw).toBe('Desc 2');
      expect(appState.data.pageDescriptions['p3']).toBeUndefined();
    });

    it('should emit batchDescriptionComplete event', () => {
      let eventDetail = null;
      appState.addEventListener('batchDescriptionComplete', (e) => {
        eventDetail = e.detail;
      });

      appState.setBatchDescriptions([
        { pageId: 'p1', success: true, description: { raw: 'OK' } },
        { pageId: 'p2', success: false, error: 'fail' }
      ]);

      expect(eventDetail.total).toBe(2);
      expect(eventDetail.successful).toBe(1);
    });

    it('should assign IDs and timestamps to batch descriptions', () => {
      appState.setBatchDescriptions([
        { pageId: 'p1', success: true, description: { raw: 'Test' } }
      ]);

      const stored = appState.data.pageDescriptions['p1'];
      expect(stored.id).toBeTruthy();
      expect(stored.timestamp).toBeTruthy();
    });

    // --- Multi-page: page switching restores descriptions ---

    it('should restore description when switching pages', () => {
      // Set up multi-page state, start on page-b (index 1)
      appState.data.pages = [
        { id: 'page-a', filename: 'p1.jpg', dataUrl: 'data:image/jpeg;base64,a', width: 100, height: 100 },
        { id: 'page-b', filename: 'p2.jpg', dataUrl: 'data:image/jpeg;base64,b', width: 100, height: 100 }
      ];
      appState.data.currentPageIndex = 1;

      // Store description for page-a
      appState.data.pageDescriptions['page-a'] = {
        id: 'desc-a',
        provider: 'gemini',
        model: 'gemini-3-pro-preview',
        raw: 'Page A has a historiated initial...',
        customPrompt: '',
        timestamp: '2026-01-01T00:00:00Z'
      };

      // Store description for page-b
      appState.data.pageDescriptions['page-b'] = {
        id: 'desc-b',
        provider: 'gemini',
        model: 'gemini-3-pro-preview',
        raw: 'Page B has a decorated border...',
        customPrompt: 'Focus on borders',
        timestamp: '2026-01-01T00:01:00Z'
      };

      // Switch to page-a (goToPage only works when switching away from current)
      appState.goToPage(0);
      expect(appState.data.description.raw).toBe('Page A has a historiated initial...');

      // Switch to page-b
      appState.goToPage(1);
      expect(appState.data.description.raw).toBe('Page B has a decorated border...');
      expect(appState.data.description.customPrompt).toBe('Focus on borders');
    });

    it('should reset description when switching to page without description', () => {
      appState.data.pages = [
        { id: 'page-a', filename: 'p1.jpg', dataUrl: 'data:image/jpeg;base64,a', width: 100, height: 100 },
        { id: 'page-b', filename: 'p2.jpg', dataUrl: 'data:image/jpeg;base64,b', width: 100, height: 100 }
      ];
      // Start on page-b so we can switch TO page-a
      appState.data.currentPageIndex = 1;

      // Only page-a has a description
      appState.data.pageDescriptions['page-a'] = {
        raw: 'Page A desc',
        model: 'gemini-3-pro-preview'
      };

      // Switch to page-a (which has a description)
      appState.goToPage(0);
      expect(appState.data.description.raw).toBe('Page A desc');

      // Switch to page-b (no description)
      appState.goToPage(1);
      expect(appState.data.description.raw).toBe('');
      expect(appState.data.description.id).toBeNull();
    });

    it('should fire beforePageChange synchronously before saving page state', () => {
      // Regression: debounced edits flushed in pageChanged wrote to WRONG page
      // because _saveCurrentPageDescription had already run and _loadPage had
      // overwritten this.data.description.  The fix dispatches beforePageChange
      // before any save/load so listeners can flush into the correct page state.
      appState.data.pages = [
        { id: 'pa', filename: 'a.jpg', dataUrl: 'data:image/jpeg;base64,a', width: 100, height: 100 },
        { id: 'pb', filename: 'b.jpg', dataUrl: 'data:image/jpeg;base64,b', width: 100, height: 100 }
      ];
      appState.data.currentPageIndex = 0;
      appState.data.description = {
        id: 'da', provider: 'gemini', model: 'g', raw: 'original A', customPrompt: '', timestamp: null
      };
      appState.data.pageDescriptions = {};

      // Simulate a debounced edit that hasn't flushed yet:
      // The beforePageChange listener writes 'edited A' into description.raw.
      const handler = () => {
        appState.data.description.raw = 'edited A';
      };
      appState.addEventListener('beforePageChange', handler);

      // Switch to page B
      appState.goToPage(1);

      // After the switch, page A's stored description should be 'edited A'
      // (flushed before _saveCurrentPageDescription) and page B should be empty.
      expect(appState.data.pageDescriptions['pa'].raw).toBe('edited A');
      expect(appState.data.description.raw).toBe('');

      appState.removeEventListener('beforePageChange', handler);
    });

    // --- Session save includes descriptions ---

    it('should include description in session save', async () => {
      appState.data.project = { id: 'proj-1', name: 'Test' };
      appState.data.description = {
        id: 'desc-1',
        provider: 'gemini',
        model: 'gemini-3-pro-preview',
        customPrompt: 'test prompt',
        raw: 'A historiated initial...',
        timestamp: '2026-01-01T00:00:00Z'
      };
      appState.data.pageDescriptions = {
        'page-1': { raw: 'Page 1 desc' }
      };
      appState.data.batchDescriptions = [
        { pageId: 'page-1', success: true }
      ];

      await appState.saveSessionNow();

      expect(storage.saveSession).toHaveBeenCalledTimes(1);
      const savedData = storage.saveSession.mock.calls[0][1];
      expect(savedData.description).toBeTruthy();
      expect(savedData.description.raw).toBe('A historiated initial...');
      expect(savedData.pageDescriptions).toBeTruthy();
      expect(savedData.pageDescriptions['page-1'].raw).toBe('Page 1 desc');
      expect(savedData.batchDescriptions).toHaveLength(1);
    });

    // --- Session restore includes descriptions ---

    it('should restore description from session', async () => {
      const mockProject = { id: 'proj-1', name: 'Test Project' };
      storage.getProject.mockResolvedValue(mockProject);
      storage.loadSession.mockResolvedValue({
        document: { id: 'doc-1', filename: 'test.jpg' },
        description: {
          id: 'desc-restored',
          provider: 'gemini',
          model: 'gemini-3-pro-preview',
          customPrompt: 'restored prompt',
          raw: 'Restored description text',
          timestamp: '2026-01-01T00:00:00Z'
        },
        pageDescriptions: {
          'page-1': { raw: 'Restored page 1' }
        },
        batchDescriptions: [{ pageId: 'page-1', success: true }]
      });
      storage.loadAllImages.mockResolvedValue({});

      const result = await appState.restoreSession('proj-1');

      expect(result).toBe(true);
      expect(appState.data.description.raw).toBe('Restored description text');
      expect(appState.data.description.customPrompt).toBe('restored prompt');
      expect(appState.data.pageDescriptions['page-1'].raw).toBe('Restored page 1');
      expect(appState.data.batchDescriptions).toHaveLength(1);
    });

    it('should reset descriptions when restoring session without them', async () => {
      // Pre-set a description
      appState.data.description = { id: 'old', raw: 'old desc', provider: 'gemini', model: '', customPrompt: '', timestamp: null };

      const mockProject = { id: 'proj-2', name: 'Empty' };
      storage.getProject.mockResolvedValue(mockProject);
      storage.loadSession.mockResolvedValue(null);
      storage.loadAllImages.mockResolvedValue({});

      await appState.restoreSession('proj-2');

      // Should reset to defaults
      expect(appState.data.description.id).toBeNull();
      expect(appState.data.description.raw).toBe('');
      expect(appState.data.pageDescriptions).toEqual({});
      expect(appState.data.batchDescriptions).toEqual([]);
    });
  });

  // ============================================
  // LLM Service: describe() method
  // ============================================

  describe('LLM describe()', () => {
    let service;

    beforeEach(async () => {
      vi.clearAllMocks();
      vi.resetModules();

      const { LLMService } = await import('../js/services/llm.js');
      service = new LLMService();
    });

    it('should require Gemini API key', async () => {
      // No API key configured
      await expect(service.describe('base64img'))
        .rejects.toThrow(/Gemini API key required|geminiKeyRequired/);
    });

    it('should enforce Gemini even when another provider is active', async () => {
      service.setProvider('openai');
      service.setApiKey('openai', 'sk-test');

      // No gemini key = should fail with Gemini-specific error
      await expect(service.describe('base64img'))
        .rejects.toThrow(/Gemini API key required|geminiKeyRequired/);
    });

    it('should restore original provider after describe call', async () => {
      service.setProvider('anthropic');
      service.setApiKey('anthropic', 'sk-ant-test');

      try {
        await service.describe('base64img');
      } catch {
        // Expected to fail (no gemini key), but provider should be restored
      }

      expect(service.activeProvider).toBe('anthropic');
    });

    it('should pass custom prompt via options', async () => {
      service.setApiKey('gemini', 'test-key');

      // Mock _callGemini to capture the prompt
      let capturedPrompt = '';
      service._callGemini = vi.fn(async (_key, _model, prompt) => {
        capturedPrompt = prompt;
        return 'description result';
      });

      await service.describe('base64img', { customPrompt: 'Focus on borders' });
      expect(capturedPrompt).toBe('Focus on borders');
    });

    it('should use default prompt when no custom prompt provided', async () => {
      service.setApiKey('gemini', 'test-key');

      let capturedPrompt = '';
      service._callGemini = vi.fn(async (_key, _model, prompt) => {
        capturedPrompt = prompt;
        return 'description result';
      });

      await service.describe('base64img');
      expect(capturedPrompt).toContain('illuminated initials');
      expect(capturedPrompt).toContain('medieval manuscript');
    });

    it('should return result with provider=gemini', async () => {
      service.setApiKey('gemini', 'test-key');
      service._callGemini = vi.fn(async () => 'A historiated initial showing...');

      const result = await service.describe('base64img');

      expect(result.provider).toBe('gemini');
      expect(result.raw).toBe('A historiated initial showing...');
      expect(result.model).toBeTruthy();
    });

    it('should include customPrompt in result', async () => {
      service.setApiKey('gemini', 'test-key');
      service._callGemini = vi.fn(async () => 'result');

      const result = await service.describe('base64img', { customPrompt: 'Identify saints' });
      expect(result.customPrompt).toBe('Identify saints');
    });

    it('should return empty customPrompt when none provided', async () => {
      service.setApiKey('gemini', 'test-key');
      service._callGemini = vi.fn(async () => 'result');

      const result = await service.describe('base64img');
      expect(result.customPrompt).toBe('');
    });
  });

  // ============================================
  // Export: descriptions in JSON and Markdown
  // ============================================

  describe('Export with descriptions', () => {
    let exportService;

    beforeEach(async () => {
      vi.clearAllMocks();
      vi.resetModules();

      const { ExportService } = await import('../js/services/export.js');
      exportService = new ExportService();
    });

    it('should include description in JSON export', () => {
      const state = {
        document: { filename: 'test.jpg', mimeType: 'image/jpeg' },
        transcription: { raw: 'Line 1', segments: [], columns: [] },
        description: {
          raw: 'Historiated initial showing Christ',
          customPrompt: 'Focus on iconography',
          model: 'gemini-3-pro-preview',
          timestamp: '2026-01-01T00:00:00Z'
        },
        validation: null,
        corrections: []
      };

      const json = exportService.exportJson(state, false, false);
      const parsed = JSON.parse(json);

      expect(parsed.description).toBeTruthy();
      expect(parsed.description.raw).toBe('Historiated initial showing Christ');
      expect(parsed.description.customPrompt).toBe('Focus on iconography');
      expect(parsed.description.model).toBe('gemini-3-pro-preview');
      expect(parsed.description.timestamp).toBe('2026-01-01T00:00:00Z');
    });

    it('should not include description in JSON export when absent', () => {
      const state = {
        document: { filename: 'test.jpg', mimeType: 'image/jpeg' },
        transcription: { raw: 'Line 1', segments: [], columns: [] },
        description: { raw: '' },
        validation: null,
        corrections: []
      };

      const json = exportService.exportJson(state, false, false);
      const parsed = JSON.parse(json);

      expect(parsed.description).toBeUndefined();
    });

    it('should include description section in Markdown export', () => {
      const state = {
        document: { filename: 'test.jpg' },
        transcription: { provider: 'gemini', model: 'gemini-3-flash', raw: 'Line 1', segments: [], lines: [] },
        description: {
          raw: 'A richly decorated initial B...',
          customPrompt: 'Analyze gold leaf',
          model: 'gemini-3-pro-preview'
        },
        validation: null
      };

      const md = exportService.exportMarkdown(state, false);

      expect(md).toContain('## Image Description');
      expect(md).toContain('gemini-3-pro-preview');
      expect(md).toContain('A richly decorated initial B...');
      expect(md).toContain('Analyze gold leaf');
    });

    it('should not include description section in Markdown when absent', () => {
      const state = {
        document: { filename: 'test.jpg' },
        transcription: { provider: '', model: '', raw: 'Line 1', segments: [], lines: [] },
        description: null,
        validation: null
      };

      const md = exportService.exportMarkdown(state, false);
      expect(md).not.toContain('## Image Description');
    });
  });

  // ============================================
  // Storage: description prompt persistence
  // ============================================

  describe('Storage prompt persistence', () => {
    it('should save description prompt', () => {
      storage.saveDescriptionPrompt('Custom analysis prompt');
      expect(storage.saveDescriptionPrompt).toHaveBeenCalledWith('Custom analysis prompt');
    });

    it('should load description prompt', () => {
      storage.loadDescriptionPrompt.mockReturnValue('Saved prompt text');
      const prompt = storage.loadDescriptionPrompt();
      expect(prompt).toBe('Saved prompt text');
    });

    it('should return empty string when no prompt saved', () => {
      storage.loadDescriptionPrompt.mockReturnValue('');
      const prompt = storage.loadDescriptionPrompt();
      expect(prompt).toBe('');
    });
  });

  // ============================================
  // DESCRIPTION_PROMPT_BASE export
  // ============================================

  describe('Default description prompt', () => {
    it('should export DESCRIPTION_PROMPT_BASE', async () => {
      vi.resetModules();
      const { DESCRIPTION_PROMPT_BASE } = await import('../js/services/llm.js');
      expect(DESCRIPTION_PROMPT_BASE).toBeTruthy();
      expect(DESCRIPTION_PROMPT_BASE).toContain('illuminated initials');
      expect(DESCRIPTION_PROMPT_BASE).toContain('medieval manuscript');
      expect(DESCRIPTION_PROMPT_BASE).toContain('Iconography');
    });
  });
});
