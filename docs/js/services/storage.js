/**
 * Storage Service
 * LocalStorage abstraction for settings, API keys, and session data
 */

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
  }

  // ============================================
  // Settings
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
  // API Keys - NOT PERSISTED (memory-only for security)
  // ============================================
  // API keys are intentionally NOT stored in localStorage.
  // Users must re-enter their keys each session.
  // This prevents accidental exposure of sensitive credentials.

  /**
   * @deprecated API keys are no longer persisted. Use llmService.setApiKey() directly.
   */
  saveApiKey() {
    console.warn('[Storage] API keys are no longer persisted for security reasons.');
    // No-op: keys are stored in memory via llmService only
  }

  /**
   * @deprecated API keys are no longer persisted.
   * @returns {null} Always returns null
   */
  loadApiKey() {
    // Always return null - keys must be entered each session
    return null;
  }

  /**
   * @deprecated API keys are no longer persisted.
   * @returns {object} Always returns empty object
   */
  loadAllApiKeys() {
    return {};
  }

  /**
   * @deprecated API keys are no longer persisted.
   */
  clearApiKey() {
    // No-op
  }

  /**
   * @deprecated API keys are no longer persisted.
   */
  clearAllApiKeys() {
    // Clean up any legacy stored keys
    localStorage.removeItem(`${this.prefix}apikeys`);
  }

  /**
   * @deprecated API keys are no longer persisted.
   * @returns {boolean} Always returns false
   */
  hasApiKey() {
    return false;
  }

  // ============================================
  // Session (Auto-Save)
  // ============================================

  /**
   * Save current session state
   * @param {object} sessionData - Session data to save
   */
  saveSession(sessionData) {
    const session = {
      timestamp: new Date().toISOString(),
      data: sessionData
    };
    localStorage.setItem(`${this.prefix}session`, JSON.stringify(session));
  }

  /**
   * Load saved session
   * @returns {object|null} Session object with timestamp and data, or null
   */
  loadSession() {
    try {
      const stored = localStorage.getItem(`${this.prefix}session`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  /**
   * Clear saved session
   */
  clearSession() {
    localStorage.removeItem(`${this.prefix}session`);
  }

  /**
   * Check if a session exists
   * @returns {boolean}
   */
  hasSession() {
    return localStorage.getItem(`${this.prefix}session`) !== null;
  }

  // ============================================
  // Utility
  // ============================================

  /**
   * Clear all stored data
   */
  clearAll() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(this.prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  /**
   * Get storage usage info
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
