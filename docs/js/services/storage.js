/**
 * Storage Service
 * Settings: localStorage (small, synchronous, uncritical)
 * Projects, Sessions, Images, API Keys: IndexedDB (large, async, persistent)
 */

import { IDB_NAME, IDB_VERSION, IDB_STORES, ACTIVE_PROJECT_KEY } from '../utils/constants.js';

const STORAGE_PREFIX = 'coocr:';

// Default settings
const DEFAULT_SETTINGS = {
  theme: 'dark',
  defaultProvider: 'gemini',
  defaultPerspective: 'paleographic',
  autoSave: true,
  autoValidate: true
};

/**
 * Storage Service class
 */
class StorageService {
  constructor() {
    this.prefix = STORAGE_PREFIX;
    this._db = null;
    this._dbPromise = null;
  }

  // ============================================
  // IndexedDB Initialization
  // ============================================

  /**
   * Open (or create) the IndexedDB database. Caches the connection.
   * @returns {Promise<IDBDatabase>}
   */
  async _initDB() {
    if (this._db) return this._db;
    if (this._dbPromise) return this._dbPromise;

    this._dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(IDB_NAME, IDB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // projects store
        if (!db.objectStoreNames.contains(IDB_STORES.PROJECTS)) {
          const projectStore = db.createObjectStore(IDB_STORES.PROJECTS, { keyPath: 'id' });
          projectStore.createIndex('name', 'name', { unique: false });
          projectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // sessions store (1:1 per project)
        if (!db.objectStoreNames.contains(IDB_STORES.SESSIONS)) {
          db.createObjectStore(IDB_STORES.SESSIONS, { keyPath: 'projectId' });
        }

        // images store (1 per page per project)
        if (!db.objectStoreNames.contains(IDB_STORES.IMAGES)) {
          const imageStore = db.createObjectStore(IDB_STORES.IMAGES, { keyPath: 'id' });
          imageStore.createIndex('projectId', 'projectId', { unique: false });
        }

        // apiKeys store
        if (!db.objectStoreNames.contains(IDB_STORES.API_KEYS)) {
          db.createObjectStore(IDB_STORES.API_KEYS, { keyPath: 'provider' });
        }
      };

      request.onsuccess = (event) => {
        this._db = event.target.result;
        resolve(this._db);
      };

      request.onerror = (event) => {
        console.error('[Storage] IndexedDB open failed:', event.target.error);
        this._dbPromise = null;
        reject(event.target.error);
      };
    });

    return this._dbPromise;
  }

  /**
   * Transaction helper -- opens a store and passes it to a callback.
   * @param {string} storeName
   * @param {'readonly'|'readwrite'} mode
   * @param {function(IDBObjectStore): IDBRequest|void} callback
   * @returns {Promise<*>}
   */
  async _withStore(storeName, mode, callback) {
    const db = await this._initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const result = callback(store);

      // If callback returns an IDBRequest, resolve with its result
      if (result && typeof result.onsuccess !== 'undefined') {
        result.onsuccess = () => resolve(result.result);
        result.onerror = () => reject(result.error);
      } else {
        // For put/delete that don't need a return value
        tx.oncomplete = () => resolve(undefined);
        tx.onerror = () => reject(tx.error);
      }
    });
  }

  // ============================================
  // Settings (localStorage -- synchronous)
  // ============================================

  /**
   * Save application settings
   * @param {object} settings - Settings object (partial or full)
   */
  saveSettings(settings) {
    const current = this.loadSettings();
    const merged = { ...current, ...settings };
    localStorage.setItem(`${this.prefix}settings`, JSON.stringify(merged));
    return merged;
  }

  /**
   * Load application settings
   * @returns {object} Settings object with defaults
   */
  loadSettings() {
    try {
      const stored = localStorage.getItem(`${this.prefix}settings`);
      if (!stored) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Reset settings to defaults
   */
  resetSettings() {
    localStorage.removeItem(`${this.prefix}settings`);
    return { ...DEFAULT_SETTINGS };
  }

  // ============================================
  // Active Project (localStorage -- synchronous)
  // ============================================

  /**
   * Get the active project ID (synchronous, for startup)
   * @returns {string|null}
   */
  getActiveProjectId() {
    return localStorage.getItem(ACTIVE_PROJECT_KEY) || null;
  }

  /**
   * Set the active project ID
   * @param {string} id
   */
  setActiveProjectId(id) {
    localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  }

  /**
   * Clear the active project ID
   */
  clearActiveProjectId() {
    localStorage.removeItem(ACTIVE_PROJECT_KEY);
  }

  // ============================================
  // Projects (IndexedDB)
  // ============================================

  /**
   * List all projects, sorted by updatedAt descending
   * @returns {Promise<Array>}
   */
  async listProjects() {
    const db = await this._initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORES.PROJECTS, 'readonly');
      const store = tx.objectStore(IDB_STORES.PROJECTS);
      const request = store.getAll();
      request.onsuccess = () => {
        const projects = request.result || [];
        projects.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        resolve(projects);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Create a new project
   * @param {object} project - { id, name, filename, pageCount, hasTranscription, createdAt, updatedAt }
   * @returns {Promise<object>}
   */
  async createProject(project) {
    await this._withStore(IDB_STORES.PROJECTS, 'readwrite', (store) => store.put(project));
    return project;
  }

  /**
   * Get a project by ID
   * @param {string} id
   * @returns {Promise<object|undefined>}
   */
  async getProject(id) {
    return this._withStore(IDB_STORES.PROJECTS, 'readonly', (store) => store.get(id));
  }

  /**
   * Update project metadata (partial merge)
   * @param {string} id
   * @param {object} updates
   * @returns {Promise<object>}
   */
  async updateProject(id, updates) {
    const existing = await this.getProject(id);
    if (!existing) throw new Error(`Project ${id} not found`);
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await this._withStore(IDB_STORES.PROJECTS, 'readwrite', (store) => store.put(updated));
    return updated;
  }

  /**
   * Delete a project and all its associated data (session + images)
   * @param {string} id
   */
  async deleteProject(id) {
    // Delete session
    await this.clearSession(id);
    // Delete images
    await this.deleteImages(id);
    // Delete project record
    await this._withStore(IDB_STORES.PROJECTS, 'readwrite', (store) => store.delete(id));

    // Clear active project if it was the deleted one
    if (this.getActiveProjectId() === id) {
      this.clearActiveProjectId();
    }
  }

  /**
   * Rename a project
   * @param {string} id
   * @param {string} newName
   * @returns {Promise<object>}
   */
  async renameProject(id, newName) {
    return this.updateProject(id, { name: newName });
  }

  // ============================================
  // Sessions (IndexedDB)
  // ============================================

  /**
   * Save session data for a project
   * @param {string} projectId
   * @param {object} data - Session data (without images)
   */
  async saveSession(projectId, data) {
    await this._withStore(IDB_STORES.SESSIONS, 'readwrite', (store) =>
      store.put({ projectId, ...data, savedAt: new Date().toISOString() })
    );
  }

  /**
   * Load session data for a project
   * @param {string} projectId
   * @returns {Promise<object|undefined>}
   */
  async loadSession(projectId) {
    return this._withStore(IDB_STORES.SESSIONS, 'readonly', (store) => store.get(projectId));
  }

  /**
   * Clear session data for a project
   * @param {string} projectId
   */
  async clearSession(projectId) {
    try {
      await this._withStore(IDB_STORES.SESSIONS, 'readwrite', (store) => store.delete(projectId));
    } catch {
      // Ignore if not found
    }
  }

  // ============================================
  // Images (IndexedDB)
  // ============================================

  /**
   * Save a single page image
   * @param {string} projectId
   * @param {string} pageId
   * @param {string} dataUrl - Base64 data URL
   */
  async saveImage(projectId, pageId, dataUrl) {
    const id = `${projectId}_${pageId}`;
    await this._withStore(IDB_STORES.IMAGES, 'readwrite', (store) =>
      store.put({ id, projectId, pageId, dataUrl })
    );
  }

  /**
   * Save multiple page images in a single transaction
   * @param {string} projectId
   * @param {Array<{pageId: string, dataUrl: string}>} pages
   */
  async saveImages(projectId, pages) {
    const db = await this._initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORES.IMAGES, 'readwrite');
      const store = tx.objectStore(IDB_STORES.IMAGES);
      for (const page of pages) {
        const id = `${projectId}_${page.pageId}`;
        store.put({ id, projectId, pageId: page.pageId, dataUrl: page.dataUrl });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Load a single page image
   * @param {string} projectId
   * @param {string} pageId
   * @returns {Promise<string|null>} dataUrl or null
   */
  async loadImage(projectId, pageId) {
    const id = `${projectId}_${pageId}`;
    const record = await this._withStore(IDB_STORES.IMAGES, 'readonly', (store) => store.get(id));
    return record?.dataUrl || null;
  }

  /**
   * Load all images for a project
   * @param {string} projectId
   * @returns {Promise<Object<string, string>>} Map of pageId -> dataUrl
   */
  async loadAllImages(projectId) {
    const db = await this._initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORES.IMAGES, 'readonly');
      const store = tx.objectStore(IDB_STORES.IMAGES);
      const index = store.index('projectId');
      const request = index.getAll(projectId);
      request.onsuccess = () => {
        const map = {};
        for (const record of request.result || []) {
          map[record.pageId] = record.dataUrl;
        }
        resolve(map);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete all images for a project
   * @param {string} projectId
   */
  async deleteImages(projectId) {
    const db = await this._initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORES.IMAGES, 'readwrite');
      const store = tx.objectStore(IDB_STORES.IMAGES);
      const index = store.index('projectId');
      const request = index.getAllKeys(projectId);
      request.onsuccess = () => {
        for (const key of request.result || []) {
          store.delete(key);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ============================================
  // API Keys (IndexedDB -- optional persistence)
  // ============================================

  /**
   * Save an API key (user opted in to persistence)
   * @param {string} provider - 'gemini' | 'openai' | 'anthropic'
   * @param {string} apiKey
   */
  async saveApiKey(provider, apiKey) {
    await this._withStore(IDB_STORES.API_KEYS, 'readwrite', (store) =>
      store.put({ provider, apiKey, savedAt: new Date().toISOString() })
    );
  }

  /**
   * Load a single API key
   * @param {string} provider
   * @returns {Promise<string|null>}
   */
  async loadApiKey(provider) {
    const record = await this._withStore(IDB_STORES.API_KEYS, 'readonly', (store) => store.get(provider));
    return record?.apiKey || null;
  }

  /**
   * Load all saved API keys
   * @returns {Promise<Object<string, string>>} Map of provider -> apiKey
   */
  async loadAllApiKeys() {
    const db = await this._initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORES.API_KEYS, 'readonly');
      const store = tx.objectStore(IDB_STORES.API_KEYS);
      const request = store.getAll();
      request.onsuccess = () => {
        const map = {};
        for (const record of request.result || []) {
          map[record.provider] = record.apiKey;
        }
        resolve(map);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a single API key
   * @param {string} provider
   */
  async deleteApiKey(provider) {
    await this._withStore(IDB_STORES.API_KEYS, 'readwrite', (store) => store.delete(provider));
  }

  /**
   * Delete all saved API keys
   */
  async deleteAllApiKeys() {
    await this._withStore(IDB_STORES.API_KEYS, 'readwrite', (store) => store.clear());
  }

  // ============================================
  // Storage Quota Management
  // ============================================

  /**
   * Get storage quota information using StorageManager API
   * @returns {Promise<object>} { usage, quota, percentUsed, available, supported, usageMB, quotaMB, availableMB }
   */
  async getQuotaInfo() {
    if (!navigator.storage || !navigator.storage.estimate) {
      return {
        usage: 0,
        quota: 0,
        percentUsed: 0,
        available: 0,
        supported: false
      };
    }

    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percentUsed = quota > 0 ? Math.round((usage / quota) * 100) : 0;

      return {
        usage,
        quota,
        percentUsed,
        available: quota - usage,
        supported: true,
        usageMB: (usage / 1024 / 1024).toFixed(2),
        quotaMB: (quota / 1024 / 1024).toFixed(2),
        availableMB: ((quota - usage) / 1024 / 1024).toFixed(2)
      };
    } catch (error) {
      console.warn('[Storage] Quota estimate failed:', error);
      return {
        usage: 0,
        quota: 0,
        percentUsed: 0,
        available: 0,
        supported: false
      };
    }
  }

  /**
   * Check if there's enough quota available before a save operation
   * @param {number} estimatedSize - Estimated size in bytes
   * @returns {Promise<boolean>} True if enough space available
   */
  async checkQuotaBeforeSave(estimatedSize) {
    const quota = await this.getQuotaInfo();
    if (!quota.supported) return true; // Can't check, allow operation

    const safetyMargin = 10 * 1024 * 1024; // 10MB safety margin
    return quota.available > (estimatedSize + safetyMargin);
  }

  // ============================================
  // Utility
  // ============================================

  /**
   * Clear all stored data (localStorage settings + IndexedDB)
   */
  async clearAll() {
    // Clear localStorage settings
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(this.prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    this.clearActiveProjectId();

    // Delete entire IndexedDB database
    this._db = null;
    this._dbPromise = null;
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(IDB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get storage usage info (localStorage only -- IDB quota is browser-managed)
   * @returns {object} Storage statistics
   */
  getStorageInfo() {
    let totalSize = 0;
    const items = {};

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(this.prefix)) {
        const value = localStorage.getItem(key);
        const size = new Blob([value]).size;
        items[key.replace(this.prefix, '')] = size;
        totalSize += size;
      }
    }

    return {
      totalBytes: totalSize,
      totalKB: (totalSize / 1024).toFixed(2),
      items
    };
  }
}

// Export singleton instance
export const storage = new StorageService();
export { StorageService, DEFAULT_SETTINGS };
