/**
 * Internationalization (i18n) Service
 *
 * Provides language switching (EN/DE) for the coOCR/HTR application.
 * Uses JSON dictionaries loaded via fetch(), with DOM annotation via
 * data-i18n attributes and a t() function for JS strings.
 *
 * Pattern: Singleton service (same as storage.js, llm.js)
 *
 * Usage:
 *   import { i18n, t } from './services/i18n.js';
 *   await i18n.init('en');              // Load language
 *   i18n.setLang('de');                 // Switch language
 *   t('editor.transcribe');             // Get translation
 *   t('export.pages', { count: 5 });   // With interpolation
 */

const STORAGE_KEY = 'coocr:lang';
const DEFAULT_LANG = 'en';
const SUPPORTED_LANGS = ['en', 'de'];

class I18nService extends EventTarget {
    constructor() {
        super();
        this._lang = DEFAULT_LANG;
        this._dictionaries = {};  // { en: {...}, de: {...} }
        this._initialized = false;
    }

    /**
     * Initialize the i18n service.
     * Loads the saved language preference or detects from browser.
     * @param {string} [lang] - Override language (optional)
     */
    async init(lang) {
        if (this._initialized) return;

        // Determine language: explicit > saved > browser > default
        const saved = localStorage.getItem(STORAGE_KEY);
        const browserLang = navigator.language?.split('-')[0];
        this._lang = lang
            || saved
            || (SUPPORTED_LANGS.includes(browserLang) ? browserLang : DEFAULT_LANG);

        // Load dictionary for current language
        await this._loadDictionary(this._lang);

        // Also load fallback (EN) if current is not EN
        if (this._lang !== 'en') {
            await this._loadDictionary('en');
        }

        this._initialized = true;

        // Apply translations to DOM
        this.translateDOM();
    }

    /**
     * Get current language code.
     * @returns {string} 'en' or 'de'
     */
    getLang() {
        return this._lang;
    }

    /**
     * Switch language at runtime.
     * @param {string} lang - Language code ('en' or 'de')
     */
    async setLang(lang) {
        if (!SUPPORTED_LANGS.includes(lang)) {
            console.warn(`[i18n] Unsupported language: ${lang}`);
            return;
        }
        if (lang === this._lang) return;

        // Load dictionary if not cached
        await this._loadDictionary(lang);

        this._lang = lang;
        localStorage.setItem(STORAGE_KEY, lang);

        // Re-translate DOM
        this.translateDOM();

        // Notify listeners
        this.dispatchEvent(new CustomEvent('languageChanged', {
            detail: { lang }
        }));
    }

    /**
     * Translate a key with optional parameter interpolation.
     * Fallback chain: current lang -> EN -> key string itself.
     *
     * @param {string} key - Dot-notation key (e.g., 'editor.transcribe')
     * @param {Object} [params] - Interpolation parameters
     * @returns {string} Translated string
     */
    t(key, params) {
        const value = this._resolve(key, this._lang)
            || this._resolve(key, 'en')
            || key;

        if (!params) return value;

        // Interpolate {paramName} placeholders
        return value.replace(/\{(\w+)\}/g, (match, name) => {
            return params[name] !== undefined ? String(params[name]) : match;
        });
    }

    /**
     * Translate all DOM elements with data-i18n attributes.
     * Supports:
     *   data-i18n="key"           -> textContent
     *   data-i18n-title="key"     -> title attribute
     *   data-i18n-placeholder="key" -> placeholder attribute
     *   data-i18n-aria="key"      -> aria-label attribute
     */
    translateDOM(root = document) {
        // textContent
        root.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) el.textContent = this.t(key);
        });

        // title
        root.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (key) el.title = this.t(key);
        });

        // placeholder
        root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (key) el.placeholder = this.t(key);
        });

        // aria-label
        root.querySelectorAll('[data-i18n-aria]').forEach(el => {
            const key = el.getAttribute('data-i18n-aria');
            if (key) el.setAttribute('aria-label', this.t(key));
        });
    }

    /**
     * Resolve a dot-notation key from a dictionary.
     * @param {string} key - e.g., 'editor.transcribe'
     * @param {string} lang - Language code
     * @returns {string|null}
     */
    _resolve(key, lang) {
        const dict = this._dictionaries[lang];
        if (!dict) return null;

        const parts = key.split('.');
        let current = dict;
        for (const part of parts) {
            if (current == null || typeof current !== 'object') return null;
            current = current[part];
        }
        return typeof current === 'string' ? current : null;
    }

    /**
     * Load a language dictionary via fetch.
     * Caches loaded dictionaries.
     * @param {string} lang - Language code
     */
    async _loadDictionary(lang) {
        if (this._dictionaries[lang]) return;

        try {
            // Resolve path relative to the app root
            const basePath = this._getBasePath();
            const response = await fetch(`${basePath}i18n/${lang}.json`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            this._dictionaries[lang] = await response.json();
        } catch (err) {
            console.error(`[i18n] Failed to load ${lang}.json:`, err);
            this._dictionaries[lang] = {};
        }
    }

    /**
     * Determine the base path for loading i18n files.
     * Works both in browser (relative to index.html) and in tests.
     */
    _getBasePath() {
        // In browser: i18n/ is relative to index.html in docs/
        // In tests: path is injected or we use a relative path
        if (typeof window !== 'undefined' && window.location) {
            const path = window.location.pathname;
            // If we're at /co-ocr-htr/ or /co-ocr-htr/index.html
            const base = path.substring(0, path.lastIndexOf('/') + 1);
            return base;
        }
        return './';
    }
}

// Export singleton
export const i18n = new I18nService();

// Convenience shorthand
export function t(key, params) {
    return i18n.t(key, params);
}
