/**
 * Dialog Component
 *
 * Manages native <dialog> elements for API configuration and export.
 * Uses the storage service for persisting API keys.
 */

import { storage } from '../services/storage.js';
import { llmService } from '../services/llm.js';
import { appState } from '../state.js';
import { loadIIIFManifest } from '../viewer.js';
import { getById, select, selectAll, show, hide, focusDelayed } from '../utils/dom.js';
import { IIIF_CONTEXT_V3, IIIF_VERSION, TOAST_DURATION_DEFAULT, TOAST_ANIMATION_DURATION, PAGE_RELOAD_DELAY, DIALOG_FOCUS_DELAY, DEFAULT_OLLAMA_ENDPOINT } from '../utils/constants.js';

// Provider configuration
const PROVIDERS = ['gemini', 'openai', 'anthropic', 'ollama'];

/**
 * Dialog Manager
 * Handles opening, closing, and interaction with dialogs
 */
class DialogManager {
    constructor() {
        this.dialogs = {};
        this.currentProvider = 'gemini';
        this.iiifManifestData = null;
    }

    /**
     * Initialize all dialogs
     */
    init() {
        // Cache dialog elements
        this.dialogs.apiKey = getById('apiKeyDialog');
        this.dialogs.export = getById('exportDialog');
        this.dialogs.settings = getById('settingsDialog');
        this.dialogs.help = getById('helpDialog');
        this.dialogs.iiif = getById('iiifDialog');
        this.dialogs.context = getById('contextDialog');
        this.toastContainer = getById('toastContainer');

        if (!this.dialogs.apiKey || !this.dialogs.export) {
            console.warn('Dialog elements not found in DOM');
            return;
        }

        this.bindEvents();
        this.loadSavedApiKeys();
        this.loadSavedSettings();
        this.updateProviderStatuses();
    }

    /**
     * Bind all event listeners
     */
    bindEvents() {
        // Generic close buttons
        selectAll('[data-close-dialog]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dialog = e.target.closest('dialog');
                if (dialog) this.closeDialog(dialog);
            });
        });

        // Close on backdrop click
        Object.values(this.dialogs).forEach(dialog => {
            if (!dialog) return;
            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) {
                    this.closeDialog(dialog);
                }
            });
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openDialog = select('dialog[open]');
                if (openDialog) {
                    this.closeDialog(openDialog);
                }
            }
        });

        // API Key Dialog specific
        this.bindApiKeyDialogEvents();

        // Export Dialog specific
        this.bindExportDialogEvents();

        // Settings Dialog specific
        this.bindSettingsDialogEvents();

        // IIIF Dialog specific
        this.bindIIIFDialogEvents();

        // Header button bindings
        this.bindHeaderButtons();

        // Password visibility toggles
        selectAll('[data-toggle-password]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const wrapper = e.target.closest('.input-with-toggle');
                const input = select('input', wrapper);
                const showIcon = select('.icon-show', wrapper);
                const hideIcon = select('.icon-hide', wrapper);

                if (input.type === 'password') {
                    input.type = 'text';
                    showIcon.hidden = true;
                    hideIcon.hidden = false;
                } else {
                    input.type = 'password';
                    showIcon.hidden = false;
                    hideIcon.hidden = true;
                }
            });
        });
    }

    /**
     * Bind header button click events
     */
    bindHeaderButtons() {
        // API Keys button
        const apiKeysBtn = select('[title="API Keys"]');
        if (apiKeysBtn) {
            apiKeysBtn.addEventListener('click', () => this.openDialog('apiKey'));
        }

        // Export button
        const exportBtn = select('[title="Export"]');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.openDialog('export'));
        }

        // Settings button
        const settingsBtn = select('[title="Settings"]');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.openDialog('settings'));
        }

        // Help button
        const helpBtn = select('[title="Help"]');
        if (helpBtn) {
            helpBtn.addEventListener('click', () => this.openDialog('help'));
        }

        // IIIF button
        const iiifBtn = getById('btnIIIF');
        if (iiifBtn) {
            iiifBtn.addEventListener('click', () => this.openDialog('iiif'));
        }
    }

    /**
     * Bind API Key Dialog specific events
     */
    bindApiKeyDialogEvents() {
        const dialog = this.dialogs.apiKey;
        if (!dialog) return;

        // Tab switching
        selectAll('.dialog-tab', dialog).forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchProviderTab(tab.dataset.provider);
            });
        });

        // Save button
        const saveBtn = select('#saveApiKeys', dialog);
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveApiKeys());
        }

        // Test connection button
        const testBtn = select('#testApiConnection', dialog);
        if (testBtn) {
            testBtn.addEventListener('click', () => this.testConnection());
        }

        // Ollama refresh models
        const refreshBtn = select('#ollamaRefreshModels', dialog);
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshOllamaModels());
        }
    }

    /**
     * Bind Export Dialog specific events
     */
    bindExportDialogEvents() {
        const dialog = this.dialogs.export;
        if (!dialog) return;

        const downloadBtn = select('#downloadExport', dialog);
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.handleExport());
        }
    }

    /**
     * Bind IIIF Dialog specific events
     */
    bindIIIFDialogEvents() {
        const dialog = this.dialogs.iiif;
        if (!dialog) return;

        // Example links
        selectAll('[data-iiif-example]', dialog).forEach(btn => {
            btn.addEventListener('click', () => {
                const url = btn.dataset.iiifExample;
                const input = getById('iiifManifestUrl');
                if (input) {
                    input.value = url;
                    this.resetIIIFPreview();
                }
            });
        });

        // Preview button
        const previewBtn = getById('iiifLoadPreview');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => this.previewIIIFManifest());
        }

        // Load button - directly loads without requiring preview
        const loadBtn = getById('iiifLoadManifest');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.loadIIIFDirectly());
        }

        // Enter key in input - directly load
        const urlInput = getById('iiifManifestUrl');
        if (urlInput) {
            urlInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.loadIIIFDirectly();
                }
            });
        }
    }

    /**
     * Load IIIF manifest directly (skip preview)
     */
    async loadIIIFDirectly() {
        const urlInput = document.getElementById('iiifManifestUrl');
        const url = urlInput?.value?.trim();

        if (!url) {
            this.showToast('Please enter a manifest URL', 'warning');
            return;
        }

        try {
            new URL(url);
        } catch {
            this.showToast('Invalid URL format', 'error');
            return;
        }

        this.setIIIFLoadingState(true);
        this.resetIIIFPreview();

        try {
            await loadIIIFManifest(url);
            this.showToast('IIIF manifest loaded', 'success');
            this.closeDialog('iiif');
        } catch (error) {
            console.error('[IIIF] Load failed:', error);
            this.showIIIFError(error.message);
        } finally {
            this.setIIIFLoadingState(false);
        }
    }

    /**
     * Preview IIIF manifest (fetch and display info without loading)
     */
    async previewIIIFManifest() {
        const urlInput = document.getElementById('iiifManifestUrl');
        const url = urlInput?.value?.trim();

        if (!url) {
            this.showToast('Please enter a manifest URL', 'warning');
            return;
        }

        // Validate URL format
        try {
            new URL(url);
        } catch {
            this.showToast('Invalid URL format', 'error');
            return;
        }

        // Show loading state
        this.setIIIFLoadingState(true);
        this.resetIIIFPreview();

        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(15000)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const manifest = await response.json();

            // Detect version
            const context = manifest['@context'];
            const version = Array.isArray(context)
                ? (context.some(c => c.includes('presentation/3')) ? 3 : 2)
                : (context?.includes('presentation/3') ? 3 : 2);

            // Extract canvases
            const canvases = version === 3
                ? manifest.items
                : manifest.sequences?.[0]?.canvases;

            if (!canvases || canvases.length === 0) {
                throw new Error('No canvases found in manifest');
            }

            // Extract title
            const title = version === 3
                ? (manifest.label?.en?.[0] || manifest.label?.de?.[0] || manifest.label || 'Untitled')
                : (manifest.label || 'Untitled');

            // Store manifest data for loading
            this.iiifManifestData = {
                url,
                manifest,
                version,
                title: typeof title === 'object' ? JSON.stringify(title) : title,
                pageCount: canvases.length
            };

            // Display preview
            this.displayIIIFPreview();

            // Enable load button
            const loadBtn = document.getElementById('iiifLoadManifest');
            if (loadBtn) loadBtn.disabled = false;

        } catch (error) {
            console.error('[IIIF] Preview failed:', error);
            this.showIIIFError(error.message);
        } finally {
            this.setIIIFLoadingState(false);
        }
    }

    /**
     * Display IIIF preview information
     */
    displayIIIFPreview() {
        if (!this.iiifManifestData) return;

        const previewEl = document.getElementById('iiifPreview');
        const versionEl = document.getElementById('iiifVersion');
        const titleEl = document.getElementById('iiifTitle');
        const infoEl = document.getElementById('iiifInfo');
        const pagesEl = document.getElementById('iiifPages');

        if (previewEl) previewEl.style.display = 'block';
        if (versionEl) versionEl.textContent = `v${this.iiifManifestData.version}`;
        if (titleEl) titleEl.textContent = this.iiifManifestData.title;
        if (infoEl) infoEl.textContent = `${this.iiifManifestData.pageCount} page${this.iiifManifestData.pageCount !== 1 ? 's' : ''}`;

        // Show first few page labels if available
        if (pagesEl && this.iiifManifestData.manifest) {
            const canvases = this.iiifManifestData.version === 3
                ? this.iiifManifestData.manifest.items
                : this.iiifManifestData.manifest.sequences?.[0]?.canvases;

            if (canvases && canvases.length > 0) {
                const labels = canvases.slice(0, 5).map((c, i) => {
                    const label = this.iiifManifestData.version === 3
                        ? (c.label?.en?.[0] || c.label?.de?.[0] || `Page ${i + 1}`)
                        : (c.label || `Page ${i + 1}`);
                    return typeof label === 'object' ? `Page ${i + 1}` : label;
                });
                const suffix = canvases.length > 5 ? ', ...' : '';
                pagesEl.textContent = labels.join(', ') + suffix;
            }
        }
    }

    /**
     * Load IIIF manifest from dialog
     */
    async loadIIIFFromDialog() {
        if (!this.iiifManifestData) {
            this.showToast('Please preview the manifest first', 'warning');
            return;
        }

        try {
            this.setIIIFLoadingState(true);

            // Use the viewer's loadIIIFManifest function
            await loadIIIFManifest(this.iiifManifestData.url);

            this.showToast(`Loaded ${this.iiifManifestData.pageCount} pages from IIIF`, 'success');
            this.closeDialog('iiif');

            // Reset state
            this.iiifManifestData = null;
            this.resetIIIFPreview();

        } catch (error) {
            console.error('[IIIF] Load failed:', error);
            this.showToast(`Failed to load: ${error.message}`, 'error');
        } finally {
            this.setIIIFLoadingState(false);
        }
    }

    /**
     * Set IIIF loading state
     */
    setIIIFLoadingState(loading) {
        const loadingEl = document.getElementById('iiifLoading');
        const previewBtn = document.getElementById('iiifLoadPreview');
        const loadBtn = document.getElementById('iiifLoadManifest');

        if (loadingEl) loadingEl.style.display = loading ? 'flex' : 'none';
        if (previewBtn) previewBtn.disabled = loading;
        if (loadBtn && loading) loadBtn.disabled = true;
    }

    /**
     * Show IIIF error message
     */
    showIIIFError(message) {
        const errorEl = document.getElementById('iiifError');
        const errorMsg = document.getElementById('iiifErrorMessage');

        if (errorEl) errorEl.style.display = 'flex';
        if (errorMsg) errorMsg.textContent = message;
    }

    /**
     * Reset IIIF preview state
     */
    resetIIIFPreview() {
        const previewEl = document.getElementById('iiifPreview');
        const errorEl = document.getElementById('iiifError');

        if (previewEl) previewEl.style.display = 'none';
        if (errorEl) errorEl.style.display = 'none';

        this.iiifManifestData = null;
    }

    /**
     * Bind Settings Dialog specific events
     */
    bindSettingsDialogEvents() {
        const dialog = this.dialogs.settings;
        if (!dialog) return;

        // Save settings button
        const saveBtn = dialog.querySelector('#saveSettings');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSettings());
        }

        // Clear session button
        const clearSessionBtn = dialog.querySelector('#btnClearSession');
        if (clearSessionBtn) {
            clearSessionBtn.addEventListener('click', () => {
                if (confirm('Clear current session? This will remove all unsaved transcription data.')) {
                    storage.clearSession();
                    appState.clearSession();
                    this.showToast('Session cleared', 'success');
                    // Reload page to reset state
                    setTimeout(() => location.reload(), 500);
                }
            });
        }

        // Reset settings button
        const resetBtn = dialog.querySelector('#btnResetSettings');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm('Reset all settings to defaults?')) {
                    this.resetSettings();
                    this.showToast('Settings reset to defaults', 'success');
                }
            });
        }
    }

    /**
     * Load saved settings into form fields
     */
    loadSavedSettings() {
        const settings = storage.loadSettings() || {};

        // Editor settings
        const autoSave = document.getElementById('settingAutoSave');
        const showLineNumbers = document.getElementById('settingShowLineNumbers');
        const highlightUncertain = document.getElementById('settingHighlightUncertain');

        if (autoSave) autoSave.checked = settings.autoSave !== false;
        if (showLineNumbers) showLineNumbers.checked = settings.showLineNumbers !== false;
        if (highlightUncertain) highlightUncertain.checked = settings.highlightUncertain !== false;

        // Validation settings
        const autoValidate = document.getElementById('settingAutoValidate');
        const defaultPerspective = document.getElementById('settingDefaultPerspective');

        if (autoValidate) autoValidate.checked = settings.autoValidate === true;
        if (defaultPerspective && settings.defaultPerspective) {
            defaultPerspective.value = settings.defaultPerspective;
        }

        // Display settings
        const showHints = document.getElementById('settingShowHints');
        const showWorkflow = document.getElementById('settingShowWorkflow');

        if (showHints) showHints.checked = settings.showHints !== false;
        if (showWorkflow) showWorkflow.checked = settings.showWorkflow !== false;

        // Apply workflow stepper visibility
        this.applyWorkflowVisibility(settings.showWorkflow !== false);
    }

    /**
     * Save settings from form fields
     */
    saveSettings() {
        const settings = storage.loadSettings() || {};

        // Editor settings
        settings.autoSave = document.getElementById('settingAutoSave')?.checked ?? true;
        settings.showLineNumbers = document.getElementById('settingShowLineNumbers')?.checked ?? true;
        settings.highlightUncertain = document.getElementById('settingHighlightUncertain')?.checked ?? true;

        // Validation settings
        settings.autoValidate = document.getElementById('settingAutoValidate')?.checked ?? false;
        settings.defaultPerspective = document.getElementById('settingDefaultPerspective')?.value || 'paleographic';

        // Display settings
        settings.showHints = document.getElementById('settingShowHints')?.checked ?? true;
        settings.showWorkflow = document.getElementById('settingShowWorkflow')?.checked ?? true;

        storage.saveSettings(settings);

        // Apply settings immediately
        this.applyWorkflowVisibility(settings.showWorkflow);

        // Reset hint dismissals if hints are re-enabled
        if (settings.showHints) {
            delete settings.hint_viewer_dismissed;
            delete settings.hint_editor_dismissed;
            delete settings.hint_validation_dismissed;
            storage.saveSettings(settings);
        }

        this.showToast('Settings saved', 'success');
        this.closeDialog('settings');
    }

    /**
     * Reset settings to defaults
     */
    resetSettings() {
        const defaultSettings = {
            autoSave: true,
            showLineNumbers: true,
            highlightUncertain: true,
            autoValidate: false,
            defaultPerspective: 'paleographic',
            showHints: true,
            showWorkflow: true
        };

        storage.saveSettings(defaultSettings);
        this.loadSavedSettings();
    }

    /**
     * Apply workflow stepper visibility
     */
    applyWorkflowVisibility(visible) {
        const stepper = document.getElementById('workflowStepper');
        if (stepper) {
            stepper.style.display = visible ? 'flex' : 'none';
        }
    }

    /**
     * Open a dialog by name
     */
    openDialog(name) {
        const dialog = this.dialogs[name];
        if (!dialog) return;

        dialog.showModal();
        appState.openDialog(name);

        // Focus first input
        const firstInput = dialog.querySelector('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"])');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 50);
        }
    }

    /**
     * Close a dialog
     */
    closeDialog(dialog) {
        if (typeof dialog === 'string') {
            dialog = this.dialogs[dialog];
        }
        if (!dialog) return;

        dialog.close();
        appState.closeDialog();
    }

    /**
     * Switch provider tab in API Key dialog
     */
    switchProviderTab(provider) {
        const dialog = this.dialogs.apiKey;
        if (!dialog) return;

        this.currentProvider = provider;

        // Update tabs
        dialog.querySelectorAll('.dialog-tab').forEach(tab => {
            const isActive = tab.dataset.provider === provider;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive);
        });

        // Update panels
        dialog.querySelectorAll('.dialog-tab-panel').forEach(panel => {
            const isActive = panel.dataset.panel === provider;
            panel.classList.toggle('active', isActive);
            panel.hidden = !isActive;
        });
    }

    /**
     * Load saved API keys into form fields
     */
    loadSavedApiKeys() {
        PROVIDERS.forEach(provider => {
            if (provider === 'ollama') {
                // Load Ollama endpoint
                const settings = storage.loadSettings();
                const endpoint = settings?.ollamaEndpoint || 'http://localhost:11434';
                const model = settings?.ollamaModel || 'llava';

                const endpointInput = document.getElementById('ollamaEndpoint');
                const modelInput = document.getElementById('ollamaModel');

                if (endpointInput) endpointInput.value = endpoint;
                if (modelInput) modelInput.value = model;
            } else {
                // Load API key
                const key = storage.loadApiKey(provider);
                const input = document.getElementById(`${provider}ApiKey`);
                if (input && key) {
                    input.value = key;
                }

                // Load model preference
                const settings = storage.loadSettings();
                const modelKey = `${provider}Model`;
                const modelSelect = document.getElementById(modelKey);
                if (modelSelect && settings?.[modelKey]) {
                    modelSelect.value = settings[modelKey];
                }
            }
        });
    }

    /**
     * Save API keys from form fields
     */
    saveApiKeys() {
        const settings = storage.loadSettings() || {};

        PROVIDERS.forEach(provider => {
            if (provider === 'ollama') {
                const endpoint = document.getElementById('ollamaEndpoint')?.value;
                const model = document.getElementById('ollamaModel')?.value;

                if (endpoint) settings.ollamaEndpoint = endpoint;
                if (model) settings.ollamaModel = model;

                // Update LLM service
                llmService.setEndpoint(provider, endpoint);
                llmService.setModel(provider, model);
            } else {
                const keyInput = document.getElementById(`${provider}ApiKey`);
                const modelSelect = document.getElementById(`${provider}Model`);

                if (keyInput?.value) {
                    storage.saveApiKey(provider, keyInput.value);
                    llmService.setApiKey(provider, keyInput.value);
                }

                if (modelSelect?.value) {
                    settings[`${provider}Model`] = modelSelect.value;
                    llmService.setModel(provider, modelSelect.value);
                }
            }
        });

        storage.saveSettings(settings);
        this.updateProviderStatuses();
        this.showToast('API keys saved', 'success');
        this.closeDialog('apiKey');
    }

    /**
     * Update provider status indicators
     */
    updateProviderStatuses() {
        PROVIDERS.forEach(provider => {
            const statusEl = document.querySelector(
                `.dialog-tab[data-provider="${provider}"] .provider-status`
            );
            if (!statusEl) return;

            let status = 'unconfigured';

            if (provider === 'ollama') {
                const endpoint = document.getElementById('ollamaEndpoint')?.value;
                if (endpoint) status = 'configured';
            } else {
                const key = storage.loadApiKey(provider);
                if (key) status = 'configured';
            }

            statusEl.dataset.status = status;
        });
    }

    /**
     * Test API connection for current provider
     */
    async testConnection() {
        const testBtn = document.getElementById('testApiConnection');
        if (!testBtn) return;

        const originalText = testBtn.textContent;
        testBtn.textContent = 'Testing...';
        testBtn.disabled = true;

        try {
            const provider = this.currentProvider;

            if (provider === 'ollama') {
                const endpoint = document.getElementById('ollamaEndpoint')?.value;
                if (!endpoint) throw new Error('Endpoint is required');

                const response = await fetch(`${endpoint}/api/tags`, {
                    method: 'GET',
                    signal: AbortSignal.timeout(5000)
                });

                if (!response.ok) throw new Error('Connection failed');

                const data = await response.json();
                const models = data.models?.map(m => m.name) || [];
                this.showToast(`Connected. Found ${models.length} models.`, 'success');
            } else {
                const keyInput = document.getElementById(`${provider}ApiKey`);
                if (!keyInput?.value) throw new Error('API key is required');

                llmService.setApiKey(provider, keyInput.value);
                llmService.setProvider(provider);

                const keyFormats = {
                    gemini: /^AIza/,
                    openai: /^sk-/,
                    anthropic: /^sk-ant-/
                };

                const pattern = keyFormats[provider];
                if (pattern && !pattern.test(keyInput.value)) {
                    this.showToast('Key format looks incorrect', 'warning');
                } else {
                    this.showToast('Key format valid. Save to test with actual requests.', 'success');
                }
            }
        } catch (error) {
            this.showToast(`Connection failed: ${error.message}`, 'error');
        } finally {
            testBtn.textContent = originalText;
            testBtn.disabled = false;
        }
    }

    /**
     * Refresh available Ollama models
     */
    async refreshOllamaModels() {
        const endpoint = document.getElementById('ollamaEndpoint')?.value;
        const modelInput = document.getElementById('ollamaModel');
        const refreshBtn = document.getElementById('ollamaRefreshModels');

        if (!endpoint || !modelInput || !refreshBtn) return;

        refreshBtn.textContent = 'Loading...';
        refreshBtn.disabled = true;

        try {
            const response = await fetch(`${endpoint}/api/tags`, {
                signal: AbortSignal.timeout(5000)
            });

            if (!response.ok) throw new Error('Failed to fetch models');

            const data = await response.json();
            const models = data.models?.map(m => m.name) || [];

            if (models.length === 0) {
                this.showToast('No models found. Run "ollama pull llava"', 'warning');
            } else {
                // Show available models
                this.showToast(`Available: ${models.slice(0, 5).join(', ')}${models.length > 5 ? '...' : ''}`, 'success');

                // Auto-select first vision model if available
                const visionModels = models.filter(m =>
                    m.includes('llava') || m.includes('bakllava') || m.includes('vision')
                );
                if (visionModels.length > 0) {
                    modelInput.value = visionModels[0];
                }
            }
        } catch (error) {
            this.showToast(`Failed to fetch models: ${error.message}`, 'error');
        } finally {
            refreshBtn.textContent = 'Refresh';
            refreshBtn.disabled = false;
        }
    }

    /**
     * Handle export action
     */
    handleExport() {
        const format = document.querySelector('input[name="exportFormat"]:checked')?.value || 'txt';
        const includeValidation = document.getElementById('exportIncludeValidation')?.checked ?? true;
        const includeMetadata = document.getElementById('exportIncludeMetadata')?.checked ?? false;

        // Dispatch export event - actual export logic in export service
        const event = new CustomEvent('exportRequested', {
            detail: { format, includeValidation, includeMetadata }
        });
        document.dispatchEvent(event);

        this.closeDialog('export');
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info', duration = 3000) {
        if (!this.toastContainer) {
            this.toastContainer = document.getElementById('toastContainer');
            if (!this.toastContainer) {
                console.log(`[Toast ${type}] ${message}`);
                return;
            }
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');

        // Icon based on type
        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" aria-label="Dismiss">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;

        // Close button handler
        toast.querySelector('.toast-close').addEventListener('click', () => {
            this.removeToast(toast);
        });

        this.toastContainer.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('toast-visible');
        });

        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => this.removeToast(toast), duration);
        }

        return toast;
    }

    /**
     * Remove toast with animation
     */
    removeToast(toast) {
        if (!toast || !toast.parentNode) return;

        toast.classList.remove('toast-visible');
        toast.classList.add('toast-hiding');

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
}

// Export singleton instance
export const dialogManager = new DialogManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => dialogManager.init());
} else {
    dialogManager.init();
}
