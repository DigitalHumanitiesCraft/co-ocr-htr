/**
 * Tests for Storage Service (IndexedDB + localStorage)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { StorageService, DEFAULT_SETTINGS } from '../js/services/storage.js';

describe('StorageService', () => {
  let storage;
  let mockLocalStorage;

  beforeEach(() => {
    // Create fresh localStorage mock
    mockLocalStorage = {
      store: {},
      getItem: vi.fn((key) => mockLocalStorage.store[key] || null),
      setItem: vi.fn((key, value) => { mockLocalStorage.store[key] = value; }),
      removeItem: vi.fn((key) => { delete mockLocalStorage.store[key]; }),
      clear: vi.fn(() => { mockLocalStorage.store = {}; }),
      key: vi.fn((index) => Object.keys(mockLocalStorage.store)[index]),
      get length() { return Object.keys(mockLocalStorage.store).length; }
    };

    // Mock global localStorage
    vi.stubGlobal('localStorage', mockLocalStorage);

    // Create fresh storage instance (new IDB connection each time)
    storage = new StorageService();
  });

  afterEach(async () => {
    // Close and delete IDB between tests for isolation
    if (storage._db) {
      storage._db.close();
      storage._db = null;
      storage._dbPromise = null;
    }
    await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase('coocr-htr');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });

  describe('Initialization', () => {
    it('should use coocr: prefix', () => {
      expect(storage.prefix).toBe('coocr:');
    });
  });

  describe('Settings (localStorage)', () => {
    it('should return default settings when none stored', () => {
      const settings = storage.loadSettings();
      expect(settings).toMatchObject(DEFAULT_SETTINGS);
    });

    it('should save settings with prefix', () => {
      storage.saveSettings({ theme: 'light' });
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'coocr:settings',
        expect.any(String)
      );
    });

    it('should merge settings with defaults', () => {
      storage.saveSettings({ theme: 'light' });
      const settings = storage.loadSettings();
      expect(settings.theme).toBe('light');
      expect(settings.autoSave).toBe(true);
    });

    it('should merge partial settings with existing', () => {
      storage.saveSettings({ theme: 'light', autoSave: false });
      storage.saveSettings({ theme: 'dark' });
      const settings = storage.loadSettings();
      expect(settings.theme).toBe('dark');
      expect(settings.autoSave).toBe(false);
    });

    it('should reset settings to defaults', () => {
      storage.saveSettings({ theme: 'light', autoSave: false });
      storage.resetSettings();
      const settings = storage.loadSettings();
      expect(settings).toMatchObject(DEFAULT_SETTINGS);
    });

    it('should handle corrupted settings gracefully', () => {
      mockLocalStorage.store['coocr:settings'] = 'invalid json{';
      const settings = storage.loadSettings();
      expect(settings).toMatchObject(DEFAULT_SETTINGS);
    });

    it('should return merged settings from saveSettings', () => {
      const result = storage.saveSettings({ customOption: 'value' });
      expect(result.customOption).toBe('value');
      expect(result.theme).toBe('dark');
    });
  });

  describe('Active Project (localStorage)', () => {
    it('should return null when no active project', () => {
      expect(storage.getActiveProjectId()).toBeNull();
    });

    it('should set and get active project ID', () => {
      storage.setActiveProjectId('proj-123');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('coocr:activeProjectId', 'proj-123');
    });

    it('should clear active project ID', () => {
      storage.setActiveProjectId('proj-123');
      storage.clearActiveProjectId();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('coocr:activeProjectId');
    });
  });

  describe('Projects (IndexedDB)', () => {
    const project1 = {
      id: 'p1',
      name: 'Test Project',
      filename: 'test.jpg',
      pageCount: 1,
      hasTranscription: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    };

    const project2 = {
      id: 'p2',
      name: 'Second Project',
      filename: 'doc.jpg',
      pageCount: 3,
      hasTranscription: true,
      createdAt: '2026-01-02T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z'
    };

    it('should create and retrieve a project', async () => {
      await storage.createProject(project1);
      const loaded = await storage.getProject('p1');
      expect(loaded).toMatchObject(project1);
    });

    it('should list all projects sorted by updatedAt desc', async () => {
      await storage.createProject(project1);
      await storage.createProject(project2);
      const projects = await storage.listProjects();
      expect(projects).toHaveLength(2);
      expect(projects[0].id).toBe('p2'); // newer first
    });

    it('should update project metadata', async () => {
      await storage.createProject(project1);
      const updated = await storage.updateProject('p1', { name: 'Renamed', pageCount: 5 });
      expect(updated.name).toBe('Renamed');
      expect(updated.pageCount).toBe(5);
      expect(updated.updatedAt).not.toBe(project1.updatedAt);
    });

    it('should throw when updating non-existent project', async () => {
      await expect(storage.updateProject('nonexistent', { name: 'X' })).rejects.toThrow();
    });

    it('should rename a project', async () => {
      await storage.createProject(project1);
      const renamed = await storage.renameProject('p1', 'New Name');
      expect(renamed.name).toBe('New Name');
    });

    it('should delete a project and its data', async () => {
      await storage.createProject(project1);
      await storage.saveSession('p1', { document: { filename: 'test.jpg' } });
      await storage.saveImage('p1', 'img1', 'data:image/jpeg;base64,abc');

      await storage.deleteProject('p1');

      const loaded = await storage.getProject('p1');
      expect(loaded).toBeUndefined();

      const session = await storage.loadSession('p1');
      expect(session).toBeUndefined();
    });

    it('should clear active project ID when deleting active project', async () => {
      await storage.createProject(project1);
      storage.setActiveProjectId('p1');
      await storage.deleteProject('p1');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('coocr:activeProjectId');
    });

    it('should return undefined for non-existent project', async () => {
      const loaded = await storage.getProject('nonexistent');
      expect(loaded).toBeUndefined();
    });
  });

  describe('Sessions (IndexedDB)', () => {
    it('should save and load session data', async () => {
      const sessionData = {
        document: { id: 'doc1', filename: 'test.jpg' },
        transcription: { raw: 'Hello world' }
      };

      await storage.saveSession('proj1', sessionData);
      const loaded = await storage.loadSession('proj1');

      expect(loaded.document.filename).toBe('test.jpg');
      expect(loaded.transcription.raw).toBe('Hello world');
      expect(loaded.savedAt).toBeDefined();
    });

    it('should return undefined for non-existent session', async () => {
      const session = await storage.loadSession('nonexistent');
      expect(session).toBeUndefined();
    });

    it('should clear a session', async () => {
      await storage.saveSession('proj1', { document: { filename: 'test.jpg' } });
      await storage.clearSession('proj1');
      const loaded = await storage.loadSession('proj1');
      expect(loaded).toBeUndefined();
    });

    it('should not throw when clearing non-existent session', async () => {
      await expect(storage.clearSession('nonexistent')).resolves.not.toThrow();
    });

    it('should overwrite existing session on save', async () => {
      await storage.saveSession('proj1', { document: { filename: 'old.jpg' } });
      await storage.saveSession('proj1', { document: { filename: 'new.jpg' } });
      const loaded = await storage.loadSession('proj1');
      expect(loaded.document.filename).toBe('new.jpg');
    });
  });

  describe('Images (IndexedDB)', () => {
    it('should save and load a single image', async () => {
      const dataUrl = 'data:image/jpeg;base64,abc123';
      await storage.saveImage('proj1', 'page1', dataUrl);
      const loaded = await storage.loadImage('proj1', 'page1');
      expect(loaded).toBe(dataUrl);
    });

    it('should return null for non-existent image', async () => {
      const loaded = await storage.loadImage('proj1', 'nonexistent');
      expect(loaded).toBeNull();
    });

    it('should save multiple images in batch', async () => {
      const pages = [
        { pageId: 'p1', dataUrl: 'data:1' },
        { pageId: 'p2', dataUrl: 'data:2' },
        { pageId: 'p3', dataUrl: 'data:3' }
      ];
      await storage.saveImages('proj1', pages);

      const img1 = await storage.loadImage('proj1', 'p1');
      const img2 = await storage.loadImage('proj1', 'p2');
      const img3 = await storage.loadImage('proj1', 'p3');
      expect(img1).toBe('data:1');
      expect(img2).toBe('data:2');
      expect(img3).toBe('data:3');
    });

    it('should load all images for a project', async () => {
      await storage.saveImage('proj1', 'p1', 'data:1');
      await storage.saveImage('proj1', 'p2', 'data:2');
      await storage.saveImage('proj2', 'p3', 'data:3');

      const images = await storage.loadAllImages('proj1');
      expect(Object.keys(images)).toHaveLength(2);
      expect(images['p1']).toBe('data:1');
      expect(images['p2']).toBe('data:2');
    });

    it('should delete all images for a project', async () => {
      await storage.saveImage('proj1', 'p1', 'data:1');
      await storage.saveImage('proj1', 'p2', 'data:2');
      await storage.saveImage('proj2', 'p3', 'data:3');

      await storage.deleteImages('proj1');

      const images = await storage.loadAllImages('proj1');
      expect(Object.keys(images)).toHaveLength(0);

      // Other project images untouched
      const img3 = await storage.loadImage('proj2', 'p3');
      expect(img3).toBe('data:3');
    });

    it('should return empty map for project with no images', async () => {
      const images = await storage.loadAllImages('empty-project');
      expect(images).toEqual({});
    });
  });

  describe('API Keys (IndexedDB)', () => {
    it('should save and load an API key', async () => {
      await storage.saveApiKey('gemini', 'AIza-test-key');
      const key = await storage.loadApiKey('gemini');
      expect(key).toBe('AIza-test-key');
    });

    it('should return null for non-existent API key', async () => {
      const key = await storage.loadApiKey('nonexistent');
      expect(key).toBeNull();
    });

    it('should load all API keys', async () => {
      await storage.saveApiKey('gemini', 'key1');
      await storage.saveApiKey('openai', 'key2');
      const keys = await storage.loadAllApiKeys();
      expect(keys).toEqual({ gemini: 'key1', openai: 'key2' });
    });

    it('should delete a single API key', async () => {
      await storage.saveApiKey('gemini', 'key1');
      await storage.saveApiKey('openai', 'key2');
      await storage.deleteApiKey('gemini');

      const geminiKey = await storage.loadApiKey('gemini');
      const openaiKey = await storage.loadApiKey('openai');
      expect(geminiKey).toBeNull();
      expect(openaiKey).toBe('key2');
    });

    it('should delete all API keys', async () => {
      await storage.saveApiKey('gemini', 'key1');
      await storage.saveApiKey('openai', 'key2');
      await storage.deleteAllApiKeys();
      const keys = await storage.loadAllApiKeys();
      expect(keys).toEqual({});
    });

    it('should overwrite existing API key', async () => {
      await storage.saveApiKey('gemini', 'old-key');
      await storage.saveApiKey('gemini', 'new-key');
      const key = await storage.loadApiKey('gemini');
      expect(key).toBe('new-key');
    });
  });

  describe('Utility Methods', () => {
    it('should clear all coocr: prefixed localStorage data', async () => {
      mockLocalStorage.store['coocr:settings'] = '{}';
      mockLocalStorage.store['other:data'] = '{}';

      await storage.clearAll();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('coocr:settings');
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('other:data');
    });

    it('should calculate storage info', () => {
      mockLocalStorage.store['coocr:settings'] = '{"theme":"dark"}';

      const info = storage.getStorageInfo();

      expect(info.totalBytes).toBeGreaterThan(0);
      expect(info.totalKB).toBeDefined();
      expect(info.items).toHaveProperty('settings');
    });

    it('should return 0 bytes when no coocr data', () => {
      mockLocalStorage.store['other:key'] = 'value';
      const info = storage.getStorageInfo();
      expect(info.totalBytes).toBe(0);
    });
  });

  describe('Default Settings', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_SETTINGS.theme).toBe('dark');
      expect(DEFAULT_SETTINGS.defaultProvider).toBe('gemini');
      expect(DEFAULT_SETTINGS.autoSave).toBe(true);
      expect(DEFAULT_SETTINGS.autoValidate).toBe(true);
    });
  });
});
