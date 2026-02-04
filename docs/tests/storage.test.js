/**
 * Tests for Storage Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
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

    // Create fresh storage instance
    storage = new StorageService();
  });

  describe('Initialization', () => {
    it('should use coocr: prefix', () => {
      expect(storage.prefix).toBe('coocr:');
    });
  });

  describe('Settings', () => {
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
      expect(settings.autoSave).toBe(true); // Default value
    });

    it('should merge partial settings with existing', () => {
      storage.saveSettings({ theme: 'light', autoSave: false });
      storage.saveSettings({ theme: 'dark' });

      const settings = storage.loadSettings();
      expect(settings.theme).toBe('dark');
      expect(settings.autoSave).toBe(false); // Previously set
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
      expect(result.theme).toBe('dark'); // From defaults
    });
  });

  describe('API Key Security (Deprecated Methods)', () => {
    it('should NOT persist API keys (saveApiKey is no-op)', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      storage.saveApiKey('gemini', 'test-key');

      expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith(
        expect.stringContaining('apikey'),
        expect.anything()
      );

      consoleSpy.mockRestore();
    });

    it('should always return null from loadApiKey', () => {
      mockLocalStorage.store['coocr:apikey_gemini'] = 'old-key';

      const key = storage.loadApiKey('gemini');
      expect(key).toBeNull();
    });

    it('should always return empty object from loadAllApiKeys', () => {
      mockLocalStorage.store['coocr:apikeys'] = JSON.stringify({ gemini: 'key' });

      const keys = storage.loadAllApiKeys();
      expect(keys).toEqual({});
    });

    it('should always return false from hasApiKey', () => {
      mockLocalStorage.store['coocr:apikey_gemini'] = 'test';

      expect(storage.hasApiKey('gemini')).toBe(false);
    });

    it('should clean up legacy API keys on clearAllApiKeys', () => {
      mockLocalStorage.store['coocr:apikeys'] = JSON.stringify({ gemini: 'key' });

      storage.clearAllApiKeys();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('coocr:apikeys');
    });
  });

  describe('Session Management', () => {
    it('should save session with timestamp', () => {
      const sessionData = { document: { filename: 'test.jpg' } };

      storage.saveSession(sessionData);

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      const savedValue = JSON.parse(mockLocalStorage.store['coocr:session']);
      expect(savedValue.timestamp).toBeDefined();
      expect(savedValue.data).toMatchObject(sessionData);
    });

    it('should load saved session', () => {
      const sessionData = {
        timestamp: '2026-02-04T10:00:00Z',
        data: { document: { filename: 'test.jpg' } }
      };
      mockLocalStorage.store['coocr:session'] = JSON.stringify(sessionData);

      const loaded = storage.loadSession();

      expect(loaded).toMatchObject(sessionData);
    });

    it('should return null when no session exists', () => {
      const session = storage.loadSession();
      expect(session).toBeNull();
    });

    it('should handle corrupted session gracefully', () => {
      mockLocalStorage.store['coocr:session'] = 'invalid{json';

      const session = storage.loadSession();
      expect(session).toBeNull();
    });

    it('should clear session', () => {
      mockLocalStorage.store['coocr:session'] = JSON.stringify({ data: {} });

      storage.clearSession();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('coocr:session');
    });

    it('should detect if session exists', () => {
      expect(storage.hasSession()).toBe(false);

      mockLocalStorage.store['coocr:session'] = JSON.stringify({ data: {} });
      expect(storage.hasSession()).toBe(true);
    });
  });

  describe('Utility Methods', () => {
    it('should clear all coocr: prefixed data', () => {
      mockLocalStorage.store['coocr:settings'] = '{}';
      mockLocalStorage.store['coocr:session'] = '{}';
      mockLocalStorage.store['other:data'] = '{}';

      storage.clearAll();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('coocr:settings');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('coocr:session');
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('other:data');
    });

    it('should calculate storage info', () => {
      mockLocalStorage.store['coocr:settings'] = '{"theme":"dark"}';
      mockLocalStorage.store['coocr:session'] = '{"data":{}}';

      const info = storage.getStorageInfo();

      expect(info.totalBytes).toBeGreaterThan(0);
      expect(info.totalKB).toBeDefined();
      expect(info.items).toHaveProperty('settings');
      expect(info.items).toHaveProperty('session');
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
