/**
 * Tests for AppState - Central State Management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock storage module with all new async methods
vi.mock('../js/services/storage.js', () => ({
  storage: {
    // Settings (sync, localStorage)
    loadSettings: vi.fn(() => ({ autoSave: false })),
    saveSettings: vi.fn(),

    // Active Project (sync, localStorage)
    getActiveProjectId: vi.fn(() => null),
    setActiveProjectId: vi.fn(),
    clearActiveProjectId: vi.fn(),

    // Projects (async, IndexedDB)
    listProjects: vi.fn(async () => []),
    createProject: vi.fn(async (project) => project),
    getProject: vi.fn(async () => undefined),
    updateProject: vi.fn(async (id, updates) => ({ id, ...updates })),
    deleteProject: vi.fn(async () => {}),
    renameProject: vi.fn(async () => {}),

    // Sessions (async, IndexedDB)
    saveSession: vi.fn(async () => {}),
    loadSession: vi.fn(async () => null),
    clearSession: vi.fn(async () => {}),

    // Images (async, IndexedDB)
    saveImage: vi.fn(async () => {}),
    saveImages: vi.fn(async () => {}),
    loadImage: vi.fn(async () => null),
    loadAllImages: vi.fn(async () => ({})),
    deleteImages: vi.fn(async () => {}),

    // API Keys (async, IndexedDB)
    saveApiKey: vi.fn(async () => {}),
    loadApiKey: vi.fn(async () => null),
    loadAllApiKeys: vi.fn(async () => ({})),
    deleteApiKey: vi.fn(async () => {}),
    deleteAllApiKeys: vi.fn(async () => {})
  }
}));

import { storage } from '../js/services/storage.js';

// We need to import after mocking
// Create a fresh AppState instance for each test
let appState;

describe('AppState', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Re-import to get fresh instance
    const module = await import('../js/state.js');
    appState = module.appState;

    // Reset state manually
    appState.data.project = { id: null, name: '' };
    appState.data.document = {
      id: null,
      filename: '',
      mimeType: '',
      dataUrl: '',
      width: 0,
      height: 0
    };
    appState.data.pages = [];
    appState.data.currentPageIndex = 0;
    appState.data.pageTranscriptions = {};
    appState.data.transcription = {
      id: null,
      provider: '',
      model: '',
      raw: '',
      segments: [],
      columns: [],
      lines: []
    };
    appState.data.regions = [];
    appState.data.validation = {
      status: 'idle',
      rules: [],
      llmJudge: null,
      summary: null,
      timestamp: null,
      customPrompt: ''
    };
    appState.data.corrections = [];
    appState.data.batchTranscriptions = [];
    appState.data.batchValidations = [];
    appState.data.ui = {
      zoom: 100,
      selectedLine: null,
      isLoading: false,
      loadingMessage: '',
      activeDialog: null,
      error: null
    };
  });

  describe('Initialization', () => {
    it('should extend EventTarget', () => {
      expect(appState).toBeInstanceOf(EventTarget);
    });

    it('should have initial state structure', () => {
      const state = appState.getState();
      expect(state).toHaveProperty('document');
      expect(state).toHaveProperty('transcription');
      expect(state).toHaveProperty('validation');
      expect(state).toHaveProperty('ui');
      expect(state).toHaveProperty('pages');
      expect(state).toHaveProperty('project');
    });

    it('should have default zoom of 100', () => {
      expect(appState.zoom).toBe(100);
    });

    it('should have no selected line initially', () => {
      expect(appState.selectedLine).toBeNull();
    });

    it('should have no active project initially', () => {
      expect(appState.data.project.id).toBeNull();
    });
  });

  describe('Project Management', () => {
    it('should create a project', async () => {
      const project = await appState.createProject('Test Project');

      expect(project.id).toBeTruthy();
      expect(project.name).toBe('Test Project');
      expect(storage.createProject).toHaveBeenCalled();
      expect(storage.setActiveProjectId).toHaveBeenCalledWith(project.id);
      expect(appState.data.project.id).toBe(project.id);
      expect(appState.data.project.name).toBe('Test Project');
    });

    it('should emit projectChanged on create', async () => {
      const listener = vi.fn();
      appState.addEventListener('projectChanged', listener);

      await appState.createProject('Test');

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].detail.name).toBe('Test');
    });

    it('should ensure project creates one if none active', async () => {
      const projectId = await appState.ensureProject('test.jpg');

      expect(projectId).toBeTruthy();
      expect(storage.createProject).toHaveBeenCalled();
      expect(appState.data.project.id).toBe(projectId);
    });

    it('should save current and create new project when one is already active', async () => {
      appState.data.project.id = 'existing-id';
      appState.data.project.name = 'Old Project';

      const projectId = await appState.ensureProject('test.jpg');

      // Should create a new project, not return the existing one
      expect(projectId).not.toBe('existing-id');
      expect(storage.createProject).toHaveBeenCalled();
      expect(storage.saveSession).toHaveBeenCalled(); // saved the old project
      expect(appState.data.project.name).toBe('test.jpg');
    });
  });

  describe('Document Management', () => {
    it('should set document from file', () => {
      const mockFile = { name: 'test.jpg', type: 'image/jpeg' };
      const dataUrl = 'data:image/jpeg;base64,abc123';

      appState.setDocument(mockFile, dataUrl);

      const state = appState.getState();
      expect(state.document.filename).toBe('test.jpg');
      expect(state.document.mimeType).toBe('image/jpeg');
      expect(state.document.dataUrl).toBe(dataUrl);
      expect(state.document.id).toBeTruthy();
    });

    it('should emit documentLoaded event', () => {
      const listener = vi.fn();
      appState.addEventListener('documentLoaded', listener);

      const mockFile = { name: 'test.jpg', type: 'image/jpeg' };
      appState.setDocument(mockFile, 'data:image/jpeg;base64,abc');

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].detail).toMatchObject({
        filename: 'test.jpg',
        mimeType: 'image/jpeg'
      });
    });

    it('should clear transcription on new document', () => {
      // Set some transcription first
      appState.data.transcription.raw = 'some text';
      appState.data.transcription.segments = [{ text: 'line 1' }];

      const mockFile = { name: 'new.jpg', type: 'image/jpeg' };
      appState.setDocument(mockFile, 'data:image/jpeg;base64,xyz');

      const state = appState.getState();
      expect(state.transcription.raw).toBe('');
      expect(state.transcription.segments).toHaveLength(0);
    });

    it('should set document dimensions', () => {
      appState.setDocumentDimensions(1920, 1080);

      const state = appState.getState();
      expect(state.document.width).toBe(1920);
      expect(state.document.height).toBe(1080);
    });

    it('should update legacy image on document load', () => {
      const mockFile = { name: 'test.jpg', type: 'image/jpeg' };
      const dataUrl = 'data:image/jpeg;base64,abc123';

      appState.setDocument(mockFile, dataUrl);

      const state = appState.getState();
      expect(state.image.url).toBe(dataUrl);
    });

    it('should fire-and-forget save image to IDB when project active', () => {
      appState.data.project.id = 'proj-1';

      const mockFile = { name: 'test.jpg', type: 'image/jpeg' };
      appState.setDocument(mockFile, 'data:image/jpeg;base64,abc');

      expect(storage.saveImage).toHaveBeenCalledWith(
        'proj-1',
        expect.any(String),
        'data:image/jpeg;base64,abc'
      );
    });
  });

  describe('Multi-Page Support', () => {
    const mockPages = [
      { id: 'p1', filename: 'page1.jpg', dataUrl: 'data:1' },
      { id: 'p2', filename: 'page2.jpg', dataUrl: 'data:2' },
      { id: 'p3', filename: 'page3.jpg', dataUrl: 'data:3' }
    ];

    it('should set multiple pages', () => {
      appState.setPages(mockPages);

      expect(appState.getPageCount()).toBe(3);
      expect(appState.isMultiPage()).toBe(true);
    });

    it('should start at first page', () => {
      appState.setPages(mockPages);

      const state = appState.getState();
      expect(state.currentPageIndex).toBe(0);
    });

    it('should emit pagesLoaded event', () => {
      const listener = vi.fn();
      appState.addEventListener('pagesLoaded', listener);

      appState.setPages(mockPages);

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].detail.count).toBe(3);
    });

    it('should navigate to next page', () => {
      appState.setPages(mockPages);
      appState.nextPage();

      const state = appState.getState();
      expect(state.currentPageIndex).toBe(1);
    });

    it('should navigate to previous page', () => {
      appState.setPages(mockPages);
      appState.goToPage(2);
      appState.prevPage();

      const state = appState.getState();
      expect(state.currentPageIndex).toBe(1);
    });

    it('should not go beyond last page', () => {
      appState.setPages(mockPages);
      appState.goToPage(2);
      appState.nextPage();

      const state = appState.getState();
      expect(state.currentPageIndex).toBe(2);
    });

    it('should not go before first page', () => {
      appState.setPages(mockPages);
      appState.prevPage();

      const state = appState.getState();
      expect(state.currentPageIndex).toBe(0);
    });

    it('should emit pageChanged event on navigation', () => {
      appState.setPages(mockPages);
      const listener = vi.fn();
      appState.addEventListener('pageChanged', listener);

      appState.nextPage();

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].detail.index).toBe(1);
    });

    it('should return current page info', () => {
      appState.setPages(mockPages);
      appState.goToPage(1);

      const currentPage = appState.getCurrentPage();
      expect(currentPage.filename).toBe('page2.jpg');
    });

    it('should return false for isMultiPage with single page', () => {
      appState.setPages([mockPages[0]]);
      expect(appState.isMultiPage()).toBe(false);
    });

    it('should preserve transcription on page change', () => {
      appState.setPages(mockPages);

      // Add transcription to page 1
      appState.data.transcription.segments = [{ text: 'Page 1 text' }];

      // Navigate away and back
      appState.nextPage();
      appState.prevPage();

      const state = appState.getState();
      expect(state.transcription.segments).toHaveLength(1);
      expect(state.transcription.segments[0].text).toBe('Page 1 text');
    });

    it('should fire-and-forget save page images to IDB when project active', () => {
      appState.data.project.id = 'proj-1';

      appState.setPages(mockPages);

      expect(storage.saveImages).toHaveBeenCalledWith(
        'proj-1',
        expect.arrayContaining([
          expect.objectContaining({ pageId: expect.any(String), dataUrl: 'data:1' })
        ])
      );
    });
  });

  describe('Transcription', () => {
    it('should set transcription data', () => {
      appState.setTranscription({
        provider: 'gemini',
        model: 'gemini-3-flash',
        raw: 'Transcribed text'
      });

      const state = appState.getState();
      expect(state.transcription.provider).toBe('gemini');
      expect(state.transcription.model).toBe('gemini-3-flash');
      expect(state.transcription.raw).toBe('Transcribed text');
      expect(state.transcription.id).toBeTruthy();
    });

    it('should emit transcriptionComplete event', () => {
      const listener = vi.fn();
      appState.addEventListener('transcriptionComplete', listener);

      appState.setTranscription({ provider: 'gemini', raw: 'text' });

      expect(listener).toHaveBeenCalled();
    });

    it('should update raw transcription text', () => {
      appState.setTranscriptionRaw('Updated text');

      const state = appState.getState();
      expect(state.transcription.raw).toBe('Updated text');
    });

    it('should update timestamp on transcription change', () => {
      const before = appState.data.meta.updatedAt;
      appState.setTranscription({ provider: 'test', raw: 'text' });
      const after = appState.data.meta.updatedAt;

      expect(after).not.toBe(before);
    });
  });

  describe('Selection and Zoom', () => {
    it('should set selection line', () => {
      appState.setSelection(5);
      expect(appState.selectedLine).toBe(5);
    });

    it('should emit selectionChanged event', () => {
      const listener = vi.fn();
      appState.addEventListener('selectionChanged', listener);

      appState.setSelection(3);

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].detail.line).toBe(3);
    });

    it('should set zoom level', () => {
      appState.setZoom(150);
      expect(appState.zoom).toBe(150);
    });

    it('should clamp zoom to minimum 25', () => {
      appState.setZoom(10);
      expect(appState.zoom).toBe(25);
    });

    it('should clamp zoom to maximum 400', () => {
      appState.setZoom(500);
      expect(appState.zoom).toBe(400);
    });

    it('should emit zoomChanged event', () => {
      const listener = vi.fn();
      appState.addEventListener('zoomChanged', listener);

      appState.setZoom(200);

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].detail.zoom).toBe(200);
    });
  });

  describe('Regions', () => {
    it('should set regions', () => {
      const regions = [
        { x: 10, y: 20, w: 100, h: 50 },
        { x: 10, y: 80, w: 100, h: 50 }
      ];

      appState.setRegions(regions);

      const state = appState.getState();
      expect(state.regions).toHaveLength(2);
    });

    it('should emit regionsChanged event', () => {
      const listener = vi.fn();
      appState.addEventListener('regionsChanged', listener);

      appState.setRegions([{ x: 10, y: 20, w: 100, h: 50 }]);

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].detail.count).toBe(1);
    });

    it('should detect region coordinates', () => {
      appState.setRegions([{ x: 10, y: 20, w: 100, h: 50 }]);
      expect(appState.hasRegionCoordinates()).toBe(true);
    });

    it('should return false when no region coordinates', () => {
      appState.setRegions([{ line: 1, text: 'no coords' }]);
      expect(appState.hasRegionCoordinates()).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should set validation status', () => {
      appState.setValidationStatus('running', 'Validating...');

      const state = appState.getState();
      expect(state.validation.status).toBe('running');
    });

    it('should emit validationStatusChanged event', () => {
      const listener = vi.fn();
      appState.addEventListener('validationStatusChanged', listener);

      appState.setValidationStatus('running');

      expect(listener).toHaveBeenCalled();
    });

    it('should set validation results', () => {
      const results = {
        rules: [{ name: 'Test Rule', type: 'warning' }],
        llmJudge: { confidence: 'likely', reasoning: 'Looks good' }
      };

      appState.setValidationResults(results);

      const state = appState.getState();
      expect(state.validation.rules).toHaveLength(1);
      expect(state.validation.llmJudge.confidence).toBe('likely');
      expect(state.validation.status).toBe('complete');
    });

    it('should emit validationComplete event', () => {
      const listener = vi.fn();
      appState.addEventListener('validationComplete', listener);

      appState.setValidationResults({ rules: [] });

      expect(listener).toHaveBeenCalled();
    });

    it('should store summary, timestamp, and customPrompt in validation results', () => {
      const results = {
        rules: [{ name: 'Test', type: 'warning' }],
        llmJudge: { confidence: 'likely' },
        summary: { totalIssues: 3 },
        timestamp: '2026-02-11T10:00:00.000Z',
        customPrompt: 'Check for abbreviations'
      };

      appState.setValidationResults(results);

      const state = appState.getState();
      expect(state.validation.summary).toEqual({ totalIssues: 3 });
      expect(state.validation.timestamp).toBe('2026-02-11T10:00:00.000Z');
      expect(state.validation.customPrompt).toBe('Check for abbreviations');
    });

    it('should preserve customPrompt when not provided in results', () => {
      // Set initial custom prompt
      appState.data.validation.customPrompt = 'Existing prompt';

      // Set results without customPrompt
      appState.setValidationResults({
        rules: [{ name: 'Test', type: 'info' }],
        llmJudge: null
      });

      const state = appState.getState();
      expect(state.validation.customPrompt).toBe('Existing prompt');
    });

    it('should auto-generate timestamp when not provided', () => {
      appState.setValidationResults({
        rules: [],
        llmJudge: null
      });

      const state = appState.getState();
      expect(state.validation.timestamp).toBeTruthy();
      // Should be a valid ISO string
      expect(new Date(state.validation.timestamp).toISOString()).toBe(state.validation.timestamp);
    });

    it('should persist validation fields across page switch roundtrip', () => {
      const mockPages = [
        { id: 'p1', filename: 'page1.jpg', dataUrl: 'data:1' },
        { id: 'p2', filename: 'page2.jpg', dataUrl: 'data:2' }
      ];
      appState.setPages(mockPages);

      // Set validation on page 1
      appState.setValidationResults({
        rules: [{ name: 'Rule1', type: 'warning' }],
        llmJudge: { confidence: 'likely' },
        summary: { totalIssues: 1 },
        timestamp: '2026-02-11T12:00:00.000Z',
        customPrompt: 'Expert prompt for page 1'
      });

      // Navigate away to page 2
      appState.nextPage();

      // Navigate back to page 1
      appState.prevPage();

      const state = appState.getState();
      expect(state.validation.status).toBe('complete');
      expect(state.validation.summary).toEqual({ totalIssues: 1 });
      expect(state.validation.timestamp).toBe('2026-02-11T12:00:00.000Z');
      expect(state.validation.customPrompt).toBe('Expert prompt for page 1');
    });
  });

  describe('UI State', () => {
    it('should set loading state', () => {
      appState.setLoading(true, 'Processing...');

      const state = appState.getState();
      expect(state.ui.isLoading).toBe(true);
      expect(state.ui.loadingMessage).toBe('Processing...');
    });

    it('should emit loadingChanged event', () => {
      const listener = vi.fn();
      appState.addEventListener('loadingChanged', listener);

      appState.setLoading(true);

      expect(listener).toHaveBeenCalled();
    });

    it('should open dialog', () => {
      appState.openDialog('export');

      const state = appState.getState();
      expect(state.ui.activeDialog).toBe('export');
    });

    it('should emit dialogOpened event', () => {
      const listener = vi.fn();
      appState.addEventListener('dialogOpened', listener);

      appState.openDialog('apiKey');

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].detail.dialog).toBe('apiKey');
    });

    it('should close dialog', () => {
      appState.openDialog('export');
      appState.closeDialog();

      const state = appState.getState();
      expect(state.ui.activeDialog).toBeNull();
    });

    it('should emit dialogClosed event', () => {
      appState.openDialog('export');
      const listener = vi.fn();
      appState.addEventListener('dialogClosed', listener);

      appState.closeDialog();

      expect(listener).toHaveBeenCalled();
    });

    it('should set error', () => {
      appState.setError('Something went wrong');

      const state = appState.getState();
      expect(state.ui.error).toBe('Something went wrong');
    });

    it('should clear error', () => {
      appState.setError('Error');
      appState.clearError();

      const state = appState.getState();
      expect(state.ui.error).toBeNull();
    });

    it('should emit toastRequested event', () => {
      const listener = vi.fn();
      appState.addEventListener('toastRequested', listener);

      appState.showToast('Success!', 'success', 5000);

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].detail).toMatchObject({
        message: 'Success!',
        type: 'success',
        duration: 5000
      });
    });
  });

  describe('Document Context', () => {
    it('should set document context', () => {
      appState.setDocumentContext({
        documentType: 'Letter',
        period: '18th century',
        language: 'German'
      });

      const context = appState.getDocumentContext();
      expect(context.documentType).toBe('Letter');
      expect(context.period).toBe('18th century');
      expect(context.language).toBe('German');
    });

    it('should emit contextChanged event', () => {
      const listener = vi.fn();
      appState.addEventListener('contextChanged', listener);

      appState.setDocumentContext({ documentType: 'Letter' });

      expect(listener).toHaveBeenCalled();
    });

    it('should clear document context', () => {
      appState.setDocumentContext({ documentType: 'Letter' });
      appState.clearDocumentContext();

      expect(appState.getDocumentContext()).toBeNull();
    });
  });

  describe('Batch Operations', () => {
    it('should set batch transcriptions', () => {
      const results = [
        { pageId: 'p1', success: true, transcription: { raw: 'text1' } },
        { pageId: 'p2', success: true, transcription: { raw: 'text2' } }
      ];

      appState.setBatchTranscriptions(results);

      const state = appState.getState();
      expect(state.batchTranscriptions).toHaveLength(2);
      expect(state.pageTranscriptions['p1'].raw).toBe('text1');
    });

    it('should emit batchTranscriptionComplete event', () => {
      const listener = vi.fn();
      appState.addEventListener('batchTranscriptionComplete', listener);

      appState.setBatchTranscriptions([
        { pageId: 'p1', success: true, transcription: {} },
        { pageId: 'p2', success: false }
      ]);

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].detail.total).toBe(2);
      expect(listener.mock.calls[0][0].detail.successful).toBe(1);
    });

    it('should set batch validations', () => {
      const results = [
        { pageId: 'p1', success: true, validation: { rules: [] } },
        { pageId: 'p2', success: true, validation: { rules: [] } }
      ];

      appState.setBatchValidations(results);

      const state = appState.getState();
      expect(state.batchValidations).toHaveLength(2);
    });

    it('should emit batchValidationComplete event', () => {
      const listener = vi.fn();
      appState.addEventListener('batchValidationComplete', listener);

      appState.setBatchValidations([{ pageId: 'p1', success: true, validation: {} }]);

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('Session Management', () => {
    it('should save session manually', async () => {
      appState.data.project.id = 'proj-1';
      await appState.saveSessionNow();

      expect(storage.saveSession).toHaveBeenCalledWith('proj-1', expect.any(Object));
    });

    it('should emit sessionSaved event', async () => {
      appState.data.project.id = 'proj-1';
      const listener = vi.fn();
      appState.addEventListener('sessionSaved', listener);

      await appState.saveSessionNow();

      expect(listener).toHaveBeenCalled();
    });

    it('should not save session if no project active', async () => {
      await appState.saveSessionNow();

      expect(storage.saveSession).not.toHaveBeenCalled();
    });

    it('should clear session', async () => {
      appState.data.project.id = 'proj-1';
      await appState.clearSession();

      expect(storage.clearSession).toHaveBeenCalledWith('proj-1');
    });

    it('should emit sessionCleared event', async () => {
      const listener = vi.fn();
      appState.addEventListener('sessionCleared', listener);

      await appState.clearSession();

      expect(listener).toHaveBeenCalled();
    });

    it('should strip image dataUrls from session data', async () => {
      appState.data.project.id = 'proj-1';
      appState.data.document = {
        id: 'doc1',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        dataUrl: 'data:image/jpeg;base64,HUGE_IMAGE',
        width: 100,
        height: 100
      };

      await appState.saveSessionNow();

      const savedData = storage.saveSession.mock.calls[0][1];
      expect(savedData.document.dataUrl).toBeUndefined();
      expect(savedData.document.filename).toBe('test.jpg');
    });

    it('should persist validation summary, timestamp, and customPrompt across session restore', async () => {
      appState.data.project = { id: 'proj-1', name: 'Project 1' };
      appState.data.validation = {
        status: 'complete',
        rules: [{ name: 'Test Rule', type: 'warning' }],
        llmJudge: { confidence: 'likely', reasoning: 'Looks good' },
        summary: { totalIssues: 1 },
        timestamp: '2026-02-11T15:00:00.000Z',
        customPrompt: 'Keep abbreviations'
      };

      await appState.saveSessionNow();
      const savedSession = storage.saveSession.mock.calls[0][1];

      storage.getProject.mockResolvedValue({ id: 'proj-1', name: 'Project 1' });
      storage.loadSession.mockResolvedValue(savedSession);

      const restored = await appState.restoreSession('proj-1');
      const state = appState.getState();

      expect(restored).toBe(true);
      expect(state.validation.summary).toEqual({ totalIssues: 1 });
      expect(state.validation.timestamp).toBe('2026-02-11T15:00:00.000Z');
      expect(state.validation.customPrompt).toBe('Keep abbreviations');
    });

    it('should merge missing validation fields from older sessions with schema defaults', async () => {
      storage.getProject.mockResolvedValue({ id: 'proj-1', name: 'Legacy Project' });
      storage.loadSession.mockResolvedValue({
        validation: {
          status: 'complete',
          rules: [{ name: 'Legacy Rule', type: 'warning' }],
          llmJudge: { confidence: 'likely' }
        }
      });

      const restored = await appState.restoreSession('proj-1');
      const state = appState.getState();

      expect(restored).toBe(true);
      expect(state.validation.status).toBe('complete');
      expect(state.validation.rules).toHaveLength(1);
      expect(state.validation.summary).toBeNull();
      expect(state.validation.timestamp).toBeNull();
      expect(state.validation.customPrompt).toBe('');
    });

    it('should emit validationComplete on restore when validation status is complete', async () => {
      storage.getProject.mockResolvedValue({ id: 'proj-1', name: 'Project 1' });
      storage.loadSession.mockResolvedValue({
        validation: {
          status: 'complete',
          rules: [{ name: 'Rule1', type: 'info' }],
          llmJudge: null,
          summary: { totalIssues: 0 },
          timestamp: '2026-02-11T12:00:00.000Z',
          customPrompt: 'Check Latin'
        }
      });

      const listener = vi.fn();
      appState.addEventListener('validationComplete', listener);

      await appState.restoreSession('proj-1');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].detail).toEqual({
        rules: [{ name: 'Rule1', type: 'info' }],
        llmJudge: null,
        summary: { totalIssues: 0 }
      });
    });

    it('should not emit validationComplete on restore when validation status is idle', async () => {
      storage.getProject.mockResolvedValue({ id: 'proj-1', name: 'Project 1' });
      storage.loadSession.mockResolvedValue({
        validation: {
          status: 'idle',
          rules: [],
          llmJudge: null
        }
      });

      const listener = vi.fn();
      appState.addEventListener('validationComplete', listener);

      await appState.restoreSession('proj-1');

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Segment Updates', () => {
    it('should update a segment', () => {
      appState.data.transcription.segments = [
        { lineNumber: 1, text: 'Original text' }
      ];

      appState.updateSegment(1, { text: 'Corrected text' });

      const state = appState.getState();
      expect(state.transcription.segments[0].text).toBe('Corrected text');
    });

    it('should track corrections', () => {
      appState.data.transcription.segments = [
        { lineNumber: 1, text: 'Original' }
      ];

      appState.updateSegment(1, { text: 'Corrected' });

      const state = appState.getState();
      expect(state.corrections).toHaveLength(1);
      expect(state.corrections[0].original).toBe('Original');
      expect(state.corrections[0].corrected).toBe('Corrected');
    });

    it('should emit transcriptionUpdated event', () => {
      appState.data.transcription.segments = [
        { lineNumber: 1, text: 'Original' }
      ];
      const listener = vi.fn();
      appState.addEventListener('transcriptionUpdated', listener);

      appState.updateSegment(1, { text: 'Updated' });

      expect(listener).toHaveBeenCalled();
    });
  });
});
