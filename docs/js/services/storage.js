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
 * Simple Base64 obfuscation for API keys
 * Note: This is NOT encryption, just basic obfuscation to prevent casual viewing
 */
function obfuscate(value) {
  if (!value) return null;
  return btoa(encodeURIComponent(value));
}

function deobfuscate(value) {
  if (!value) return null;
  try {
    return decodeURIComponent(atob(value));
  } catch {
    return null;
  }
}

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
  // API Keys
  // ============================================

  /**
   * Save API key for a provider
   * @param {string} provider - Provider name (gemini, openai, anthropic, deepseek, ollama)
   * @param {string} key - API key (or URL for Ollama)
   */
  saveApiKey(provider, key) {
    const keys = this._loadApiKeys();
    keys[provider] = obfuscate(key);
    localStorage.setItem(`${this.prefix}apikeys`, JSON.stringify(keys));
  }

  /**
   * Load API key for a provider
   * @param {string} provider - Provider name
   * @returns {string|null} API key or null if not set
   */
  loadApiKey(provider) {
    const keys = this._loadApiKeys();
    return deobfuscate(keys[provider]);
  }

  /**
   * Load all API keys (deobfuscated)
   * @returns {object} Object with provider names as keys
   */
  loadAllApiKeys() {
    const keys = this._loadApiKeys();
    const result = {};
    for (const [provider, value] of Object.entries(keys)) {
      result[provider] = deobfuscate(value);
    }
    return result;
  }

  /**
   * Clear API key for a provider
   * @param {string} provider - Provider name
   */
  clearApiKey(provider) {
    const keys = this._loadApiKeys();
    delete keys[provider];
    localStorage.setItem(`${this.prefix}apikeys`, JSON.stringify(keys));
  }

  /**
   * Clear all API keys
   */
  clearAllApiKeys() {
    localStorage.removeItem(`${this.prefix}apikeys`);
  }

  /**
   * Check if an API key is configured for a provider
   * @param {string} provider - Provider name
   * @returns {boolean}
   */
  hasApiKey(provider) {
    return !!this.loadApiKey(provider);
  }

  _loadApiKeys() {
    try {
      const stored = localStorage.getItem(`${this.prefix}apikeys`);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
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
