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
import { getById, select, selectAll, show, hide } from '../utils/dom.js';
import { escapeHtml } from '../utils/textFormatting.js';
import { DEFAULT_OLLAMA_ENDPOINT } from '../utils/constants.js';

// Model-to-provider mapping for simplified UI
const MODEL_PROVIDER_MAP = {
    'gemini-3-flash-preview': 'gemini',
    'gemini-3-pro-preview': 'gemini',
    'ollama:deepseek-ocr': 'ollama',
    'ollama:llava': 'ollama',
    'ollama:llama3.2-vision': 'ollama'
};

// API key URLs by provider
const API_KEY_URLS = {
    gemini: 'https://aistudio.google.com/apikey',
    openai: 'https://platform.openai.com/api-keys',
    anthropic: 'https://console.anthropic.com/settings/keys'
};

// API key placeholders by provider
const API_KEY_PLACEHOLDERS = {
    gemini: 'AIza...',
    openai: 'sk-...',
    anthropic: 'sk-ant-...'
};

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
        // Guard against double-initialization (would accumulate listeners)
        if (this._initialized) return;
        this._initialized = true;

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
        // Model indicator click - opens LLM config dialog
        const modelIndicator = getById('modelIndicator');
        if (modelIndicator) {
            modelIndicator.addEventListener('click', () => this.openDialog('apiKey'));
        }

        // Export button
        const exportBtn = getById('btnExport');
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

        const modelSelect = getById('llmModel');
        const customModelInput = getById('llmModelCustom');
        const securityCheckbox = getById('securityAcknowledge');
        const saveBtn = select('#saveApiKeys', dialog);

        // Update UI based on selected model
        const updateUIForModel = () => {
            const modelValue = modelSelect?.value || '';
            const provider = this.getProviderFromModel(modelValue);

            // Update hidden provider field
            const providerInput = getById('llmProvider');
            if (providerInput) providerInput.value = provider;

            // Show/hide custom model input
            if (customModelInput) {
                if (modelValue === 'custom') {
                    customModelInput.style.display = 'block';
                    customModelInput.focus();
                } else {
                    customModelInput.style.display = 'none';
                }
            }

            // Show/hide API key field (hidden for Ollama)
            const apiKeyWrapper = getById('apiKeyWrapper');
            const ollamaWrapper = getById('ollamaEndpointWrapper');

            if (provider === 'ollama') {
                if (apiKeyWrapper) apiKeyWrapper.style.display = 'none';
                if (ollamaWrapper) ollamaWrapper.style.display = 'block';
            } else {
                if (apiKeyWrapper) apiKeyWrapper.style.display = 'block';
                if (ollamaWrapper) ollamaWrapper.style.display = 'none';

                // Update API key hint based on detected provider
                this.updateApiKeyHint(provider);
            }

            // Update save button state
            if (securityCheckbox && saveBtn) {
                if (provider === 'ollama') {
                    saveBtn.disabled = false;
                } else {
                    saveBtn.disabled = !securityCheckbox.checked;
                }
            }

            this.currentProvider = provider;
        };

        // Model selection change
        if (modelSelect) {
            modelSelect.addEventListener('change', updateUIForModel);
        }

        // Custom model input -- update provider detection as user types
        if (customModelInput) {
            customModelInput.addEventListener('input', updateUIForModel);
        }

        // Security acknowledgment checkbox
        if (securityCheckbox && saveBtn) {
            securityCheckbox.addEventListener('change', () => {
                const provider = this.currentProvider;
                if (provider === 'ollama') {
                    saveBtn.disabled = false;
                } else {
                    saveBtn.disabled = !securityCheckbox.checked;
                }
            });
        }

        // Save button click handler
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveApiKeys());
        }

        // Test connection button
        const testBtn = getById('testApiConnection');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.testConnection());
        }

        // Ollama refresh models
        const refreshBtn = getById('ollamaRefreshModels');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshOllamaModels());
        }

        // Password visibility toggle
        const toggleBtn = select('.toggle-visibility', dialog);
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                const wrapper = e.target.closest('.input-with-toggle');
                const input = select('input', wrapper);
                const showIcon = select('.icon-show', wrapper);
                const hideIcon = select('.icon-hide', wrapper);

                if (input.type === 'password') {
                    input.type = 'text';
                    if (showIcon) showIcon.hidden = true;
                    if (hideIcon) hideIcon.hidden = false;
                } else {
                    input.type = 'password';
                    if (showIcon) showIcon.hidden = false;
                    if (hideIcon) hideIcon.hidden = true;
                }
            });
        }

        // Initial UI update
        updateUIForModel();
    }

    /**
     * Get provider from model identifier
     */
    getProviderFromModel(modelValue) {
        // Check predefined mapping
        if (MODEL_PROVIDER_MAP[modelValue]) {
            return MODEL_PROVIDER_MAP[modelValue];
        }

        // Check for ollama: prefix
        if (modelValue.startsWith('ollama:')) {
            return 'ollama';
        }

        // For custom models, detect provider from the custom input field
        if (modelValue === 'custom') {
            const customInput = getById('llmModelCustom');
            const customName = customInput?.value?.trim().toLowerCase() || '';
            if (customName.includes('gpt') || customName.includes('openai') || customName.startsWith('o1') || customName.startsWith('o3') || customName.startsWith('o4')) return 'openai';
            if (customName.includes('claude') || customName.includes('anthropic')) return 'anthropic';
            if (customName.includes('ollama')) return 'ollama';
            return 'gemini'; // Default
        }

        // Infer from model name patterns
        const lower = modelValue.toLowerCase();
        if (lower.includes('gemini')) return 'gemini';
        if (lower.includes('gpt') || lower.includes('openai')) return 'openai';
        if (lower.includes('claude') || lower.includes('anthropic')) return 'anthropic';

        // Default to gemini
        return 'gemini';
    }

    /**
     * Update API key hint based on provider
     */
    updateApiKeyHint(provider) {
        const apiKeyInput = getById('llmApiKey');
        const apiKeyLink = getById('apiKeyLink');
        const _apiKeyHint = getById('apiKeyHint');

        if (apiKeyInput) {
            apiKeyInput.placeholder = API_KEY_PLACEHOLDERS[provider] || 'API Key';
            // Load key from memory if available
            const memoryKey = llmService.providers[provider]?.apiKey;
            if (memoryKey) {
                apiKeyInput.value = memoryKey;
            }
        }

        if (apiKeyLink && API_KEY_URLS[provider]) {
            apiKeyLink.href = API_KEY_URLS[provider];
            const providerNames = { gemini: 'Google AI Studio', openai: 'OpenAI', anthropic: 'Anthropic' };
            apiKeyLink.textContent = providerNames[provider] || provider;
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

        // Export scope toggle buttons
        const scopeBtns = selectAll('.export-scope-btns .btn', dialog);
        scopeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                scopeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    /**
     * Update export dialog when opened (show scope for multi-page)
     */
    updateExportDialogState() {
        const scopeSection = getById('exportScope');
        const scopeHint = getById('exportScopeHint');

        if (appState.isMultiPage()) {
            const pageCount = appState.getPageCount();
            const transcribedCount = Object.keys(appState.data.pageTranscriptions || {}).length;

            show(scopeSection);
            if (scopeHint) {
                scopeHint.textContent = `${transcribedCount} of ${pageCount} pages have transcriptions`;
            }
        } else {
            hide(scopeSection);
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

        // Delete project button (was "Clear Session")
        const clearSessionBtn = dialog.querySelector('#btnClearSession');
        if (clearSessionBtn) {
            clearSessionBtn.addEventListener('click', async () => {
                const projectId = appState.data.project.id;
                if (!projectId) {
                    this.showToast('No active project available', 'warning');
                    return;
                }
                const projectName = appState.data.project.name || 'Current Project';
                const confirmed = await this.showConfirm(
                    'Delete project?',
                    `Do you really want to delete the project "${projectName}"? All data (images, transcriptions) will be removed.`,
                    'Delete',
                    'Cancel',
                    { icon: 'warning' }
                );

                if (confirmed) {
                    try {
                        await storage.deleteProject(projectId);
                        storage.clearActiveProjectId();
                        this.showToast('Project deleted', 'success');
                        setTimeout(() => location.reload(), 500);
                    } catch (err) {
                        console.error('[Settings] Delete project failed:', err);
                        this.showToast('Error during deletion', 'error');
                    }
                }
            });
        }

        // Delete all saved API keys button
        const deleteApiKeysBtn = dialog.querySelector('#btnDeleteApiKeys');
        if (deleteApiKeysBtn) {
            deleteApiKeysBtn.addEventListener('click', async () => {
                const confirmed = await this.showConfirm(
                    'Delete API keys?',
                    'Do you really want to delete all stored API keys?',
                    'Delete',
                    'Cancel',
                    { icon: 'warning' }
                );

                if (confirmed) {
                    try {
                        await storage.deleteAllApiKeys();
                        this.showToast('Stored API keys deleted', 'success');
                    } catch (err) {
                        console.error('[Settings] Delete API keys failed:', err);
                        this.showToast('Error during deletion', 'error');
                    }
                }
            });
        }

        // Reset settings button
        const resetBtn = dialog.querySelector('#btnResetSettings');
        if (resetBtn) {
            resetBtn.addEventListener('click', async () => {
                const confirmed = await this.showConfirm(
                    'Reset settings?',
                    'Do you really want to reset all settings to default values?',
                    'Reset',
                    'Cancel',
                    { icon: 'question' }
                );

                if (confirmed) {
                    this.resetSettings();
                    this.showToast('Settings reset', 'success');
                }
            });
        }

        // Quota refresh button
        const btnRefreshQuota = dialog.querySelector('#btnRefreshQuota');
        if (btnRefreshQuota) {
            btnRefreshQuota.addEventListener('click', async () => {
                await this.updateQuotaDisplay();
            });
        }

        // Update quota on settings dialog open
        const settingsBtn = document.querySelector('[data-open-dialog="settings"]');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', async () => {
                // Delay to allow dialog to open first
                setTimeout(async () => {
                    await this.updateQuotaDisplay();
                }, 100);
            });
        }
    }

    /**
     * Update the storage quota display in the settings dialog
     */
    async updateQuotaDisplay() {
        const quotaText = document.getElementById('quotaText');
        const quotaBarFill = document.getElementById('quotaBarFill');

        if (!quotaText || !quotaBarFill) return;

        const quota = await storage.getQuotaInfo();

        if (!quota.supported) {
            quotaText.textContent = 'Not available in this browser';
            quotaBarFill.style.width = '0%';
            quotaBarFill.removeAttribute('data-level');
            return;
        }

        quotaText.textContent = `${quota.usageMB} MB of ${quota.quotaMB} MB used (${quota.percentUsed}%)`;
        quotaBarFill.style.width = `${quota.percentUsed}%`;

        // Color coding
        if (quota.percentUsed > 90) {
            quotaBarFill.setAttribute('data-level', 'critical');
        } else if (quota.percentUsed > 70) {
            quotaBarFill.setAttribute('data-level', 'warning');
        } else {
            quotaBarFill.removeAttribute('data-level');
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

        // Initialize API Key dialog before opening
        if (name === 'apiKey') {
            this.initApiKeyDialog();
        }

        // Update export dialog state (show scope for multi-page)
        if (name === 'export') {
            this.updateExportDialogState();
        }

        dialog.showModal();
        appState.openDialog(name);

        // Focus first input
        const firstInput = dialog.querySelector('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"])');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 50);
        }
    }

    /**
     * Initialize API Key dialog with current settings
     */
    initApiKeyDialog() {
        const settings = storage.loadSettings() || {};
        const savedModel = settings.activeModel || 'gemini-3-flash-preview';

        const modelSelect = getById('llmModel');
        const customModelInput = getById('llmModelCustom');

        if (modelSelect) {
            const options = Array.from(modelSelect.options);
            const found = options.find(opt => opt.value === savedModel);

            if (found) {
                modelSelect.value = savedModel;
                if (customModelInput) {
                    customModelInput.style.display = 'none';
                    customModelInput.value = '';
                }
            } else {
                // Custom model
                modelSelect.value = 'custom';
                if (customModelInput) {
                    customModelInput.style.display = 'block';
                    customModelInput.value = savedModel;
                }
            }

            // Trigger change event to update UI
            modelSelect.dispatchEvent(new Event('change'));
        }

        // Update save button state based on current provider
        const provider = this.getProviderFromModel(savedModel);
        const securityCheckbox = getById('securityAcknowledge');
        const saveBtn = select('#saveApiKeys', this.dialogs.apiKey);

        if (securityCheckbox && saveBtn) {
            if (provider === 'ollama') {
                saveBtn.disabled = false;
            } else {
                saveBtn.disabled = !securityCheckbox.checked;
            }
        }

        // Load API key from memory if available
        const apiKeyInput = getById('llmApiKey');
        if (apiKeyInput && provider !== 'ollama') {
            const memoryKey = llmService.providers[provider]?.apiKey;
            apiKeyInput.value = memoryKey || '';
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
     * Load saved settings into form fields.
     * Persistent API keys are loaded from IndexedDB (if user opted in).
     */
    async loadSavedApiKeys() {
        const settings = storage.loadSettings() || {};

        // Load Ollama endpoint
        const endpointInput = getById('ollamaEndpoint');
        if (endpointInput) {
            endpointInput.value = settings.ollamaEndpoint || DEFAULT_OLLAMA_ENDPOINT;
        }

        // Load saved model
        const savedModel = settings.activeModel || 'gemini-3-flash-preview';
        const modelSelect = getById('llmModel');
        const customModelInput = getById('llmModelCustom');

        if (modelSelect) {
            const options = Array.from(modelSelect.options);
            const found = options.find(opt => opt.value === savedModel);

            if (found) {
                modelSelect.value = savedModel;
            } else {
                // Custom model
                modelSelect.value = 'custom';
                if (customModelInput) {
                    customModelInput.style.display = 'block';
                    customModelInput.value = savedModel;
                }
            }
        }

        // Load persistent API keys from IndexedDB (if previously saved)
        try {
            const savedKeys = await storage.loadAllApiKeys();
            for (const [provider, apiKey] of Object.entries(savedKeys)) {
                if (apiKey) {
                    llmService.setApiKey(provider, apiKey);
                }
            }
        } catch (err) {
            console.warn('[Dialogs] Failed to load persistent API keys:', err);
        }

        // Update model indicator with saved model
        const provider = this.getProviderFromModel(savedModel);
        this.updateModelIndicator(savedModel, provider);
    }

    /**
     * Save API configuration
     * API keys stored in memory; optionally persisted to IndexedDB if user opts in.
     */
    async saveApiKeys() {
        const settings = storage.loadSettings() || {};

        const modelSelect = getById('llmModel');
        const customModelInput = getById('llmModelCustom');
        const apiKeyInput = getById('llmApiKey');
        const endpointInput = getById('ollamaEndpoint');
        const persistCheckbox = getById('apiKeyPersist');

        // Get model (custom or from select)
        let model = modelSelect?.value;
        if (model === 'custom' && customModelInput?.value) {
            model = customModelInput.value.trim();
        }

        // Determine provider from model
        const provider = this.getProviderFromModel(model);

        // For Ollama models, extract the actual model name (remove "ollama:" prefix)
        let actualModel = model;
        if (model.startsWith('ollama:')) {
            actualModel = model.substring(7); // Remove "ollama:" prefix
        }

        // Save model and provider
        settings.activeModel = model;
        settings.activeProvider = provider;
        llmService.setProvider(provider);
        llmService.setModel(actualModel); // Set model for active provider (single argument)

        // Store API key in memory (for non-Ollama providers)
        if (provider !== 'ollama' && apiKeyInput?.value) {
            const apiKey = apiKeyInput.value.trim();
            llmService.setApiKey(provider, apiKey);

            // Optionally persist to IndexedDB
            if (persistCheckbox?.checked && apiKey) {
                try {
                    await storage.saveApiKey(provider, apiKey);
                } catch (err) {
                    console.warn('[Dialogs] Failed to persist API key:', err);
                }
            }
        }

        // Save Ollama endpoint
        if (provider === 'ollama' && endpointInput?.value) {
            settings.ollamaEndpoint = endpointInput.value;
            llmService.setEndpoint(provider, endpointInput.value);
        }

        storage.saveSettings(settings);

        // Update model indicator in UI
        this.updateModelIndicator(model, provider);

        const persistMsg = persistCheckbox?.checked
            ? 'Configuration saved (API key stored permanently)'
            : 'Configuration saved (API key for this session only)';
        this.showToast(persistMsg, 'success');
        this.closeDialog('apiKey');
    }

    /**
     * Update the model indicator in the editor header
     */
    updateModelIndicator(model, provider) {
        const indicator = getById('modelIndicator');
        const textEl = getById('modelIndicatorText');
        if (!indicator || !textEl) return;

        // Set provider for styling
        indicator.dataset.provider = provider;

        // Create a short display name
        let displayName = model;

        // Shorten common model names
        if (model.includes('gemini-3-flash')) {
            displayName = 'Gemini Flash';
        } else if (model.includes('gemini-3-pro')) {
            displayName = 'Gemini Pro';
        } else if (model.includes('gpt-5')) {
            displayName = 'GPT-5';
        } else if (model.includes('gpt-4')) {
            displayName = 'GPT-4o';
        } else if (model.includes('claude-4')) {
            displayName = 'Claude 4';
        } else if (model.includes('claude-3')) {
            displayName = 'Claude 3.5';
        } else if (model.includes('deepseek-ocr')) {
            displayName = 'DeepSeek OCR';
        } else if (model.includes('llava')) {
            displayName = 'LLaVA';
        } else if (model.startsWith('ollama:')) {
            displayName = model.substring(7);
        }

        // Add provider prefix for local models
        if (provider === 'ollama' && !displayName.includes('lokal')) {
            displayName += ' (lokal)';
        }

        textEl.textContent = displayName;
        indicator.title = `Model: ${model} (${provider})`;
    }


    /**
     * Test cloud API connection using the same endpoints/headers as llmService.
     * Note: OpenAI blocks browser CORS -- only Gemini and Anthropic work from browser.
     */
    async _testCloudConnection(provider, apiKey) {
        const timeout = AbortSignal.timeout(15000);

        try {
            if (provider === 'gemini') {
                const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=1`;
                const res = await fetch(url, { signal: timeout });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error?.message || `HTTP ${res.status}`);
                }
                this._showTestStatus('API key valid, connection OK', 'success');

            } else if (provider === 'openai') {
                const res = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: [{ role: 'user', content: 'Hi' }],
                        max_tokens: 1
                    }),
                    signal: timeout
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error?.message || `HTTP ${res.status}`);
                }
                this._showTestStatus('API key valid, connection OK', 'success');

            } else if (provider === 'anthropic') {
                const res = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                        'anthropic-dangerous-direct-browser-access': 'true'
                    },
                    body: JSON.stringify({
                        model: 'claude-haiku-4-5-20251001',
                        max_tokens: 1,
                        messages: [{ role: 'user', content: 'Hi' }]
                    }),
                    signal: timeout
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error?.message || `HTTP ${res.status}`);
                }
                this._showTestStatus('API key valid, connection OK', 'success');

            } else {
                this._showTestStatus('Unknown provider', 'warning');
            }
        } catch (error) {
            // TypeError = network/CORS failure (fetch never got a response)
            // OpenAI returns no CORS headers on error responses (401/403),
            // so auth failures appear as CORS errors in the browser
            if (error instanceof TypeError) {
                throw new Error(`Connection failed -- Invalid key or no credit?`, { cause: error });
            }
            throw error;
        }
    }

    /**
     * Show inline status next to test button (visible inside dialog top-layer)
     */
    _showTestStatus(message, type = 'info') {
        const statusEl = getById('testConnectionStatus');
        if (!statusEl) return;

        statusEl.textContent = message;
        statusEl.className = `test-status test-${type}`;
        statusEl.hidden = false;

        // Auto-hide after 5s
        clearTimeout(this._testStatusTimer);
        this._testStatusTimer = setTimeout(() => {
            statusEl.hidden = true;
        }, 5000);
    }

    /**
     * Test API connection for current provider
     */
    async testConnection() {
        const testBtn = document.getElementById('testApiConnection');
        if (!testBtn) return;

        const originalText = testBtn.textContent;
        testBtn.textContent = 'Teste...';
        testBtn.disabled = true;

        try {
            const provider = getById('llmProvider')?.value || this.currentProvider;

            if (provider === 'ollama') {
                const endpoint = getById('ollamaEndpoint')?.value;
                if (!endpoint) throw new Error('Server URL required');

                const response = await fetch(`${endpoint}/api/tags`, {
                    method: 'GET',
                    signal: AbortSignal.timeout(5000)
                });

                if (!response.ok) throw new Error('Connection failed');

                const data = await response.json();
                const models = data.models?.map(m => m.name) || [];
                this._showTestStatus(`Verbunden! ${models.length} Modelle gefunden.`, 'success');

                // Auto-populate model dropdown with available models
                this.populateOllamaModels(models);
            } else {
                const keyInput = getById('llmApiKey');
                if (!keyInput?.value) throw new Error('API key required');

                const apiKey = keyInput.value.trim();
                await this._testCloudConnection(provider, apiKey);
            }
        } catch (error) {
            this._showTestStatus(error.message, 'error');
        } finally {
            testBtn.textContent = originalText;
            testBtn.disabled = false;
        }
    }

    /**
     * Populate model dropdown with Ollama models
     */
    populateOllamaModels(models) {
        const modelSelect = getById('llmModel');
        if (!modelSelect) return;

        // Filter to vision models
        const visionModels = models.filter(m =>
            m.includes('llava') || m.includes('vision') || m.includes('vl') || m.includes('deepseek')
        );

        modelSelect.innerHTML = '';

        // Add found vision models first (with ollama: prefix for provider detection)
        if (visionModels.length > 0) {
            visionModels.forEach((model, i) => {
                const option = document.createElement('option');
                option.value = `ollama:${model}`; // Add prefix for provider detection
                option.textContent = model + (i === 0 ? ' (Empfohlen)' : '');
                if (i === 0) option.selected = true;
                modelSelect.appendChild(option);
            });
        }

        // Add other models
        const otherModels = models.filter(m => !visionModels.includes(m));
        if (otherModels.length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = 'Andere Modelle';
            otherModels.forEach(model => {
                const option = document.createElement('option');
                option.value = `ollama:${model}`; // Add prefix for provider detection
                option.textContent = model;
                optgroup.appendChild(option);
            });
            modelSelect.appendChild(optgroup);
        }

        // Add custom option
        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = 'Eigenes Modell...';
        modelSelect.appendChild(customOption);
    }

    /**
     * Refresh available Ollama models
     */
    async refreshOllamaModels() {
        const endpoint = getById('ollamaEndpoint')?.value;
        const refreshBtn = getById('ollamaRefreshModels');

        if (!endpoint || !refreshBtn) return;

        const originalText = refreshBtn.textContent;
        refreshBtn.textContent = 'Loading...';
        refreshBtn.disabled = true;

        try {
            const response = await fetch(`${endpoint}/api/tags`, {
                signal: AbortSignal.timeout(5000)
            });

            if (!response.ok) throw new Error('Connection failed');

            const data = await response.json();
            const models = data.models?.map(m => m.name) || [];

            if (models.length === 0) {
                this.showToast('No models found. Install with: ollama pull llava', 'warning');
            } else {
                this.populateOllamaModels(models);
                this.showToast(`${models.length} models found`, 'success');
            }
        } catch (error) {
            this.showToast(`Error: ${error.message}`, 'error');
        } finally {
            refreshBtn.textContent = originalText;
            refreshBtn.disabled = false;
        }
    }

    /**
     * Handle export action
     */
    async handleExport() {
        const format = document.querySelector('input[name="exportFormat"]:checked')?.value || 'txt';
        const includeValidation = document.getElementById('exportIncludeValidation')?.checked ?? true;
        const includeMetadata = document.getElementById('exportIncludeMetadata')?.checked ?? false;

        // Check export scope
        const scopeBtn = document.querySelector('.export-scope-btns .btn.active');
        const scope = scopeBtn?.dataset.scope || 'current';

        if (scope === 'all' && appState.isMultiPage()) {
            // ZIP export for all pages
            try {
                const { exportService } = await import('../services/export.js');
                const result = await exportService.exportAllPagesZip(format, {
                    includeValidation,
                    includeMetadata
                });
                this.showToast(`Exported ${result.pageCount} pages as ${result.filename}`, 'success');
            } catch (error) {
                console.error('ZIP export failed:', error);
                this.showToast(`Export failed: ${error.message}`, 'error');
            }
        } else {
            // Single page export
            const event = new CustomEvent('exportRequested', {
                detail: { format, includeValidation, includeMetadata }
            });
            document.dispatchEvent(event);
        }

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
            <span class="toast-message">${escapeHtml(message)}</span>
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

    /**
     * Show a confirmation dialog
     * @param {string} title - Dialog title
     * @param {string} message - Dialog message (plain text) or HTML if options.html is true
     * @param {string} confirmText - Text for confirm button
     * @param {string} cancelText - Text for cancel button
     * @param {object} options - Additional options (icon, html)
     * @returns {Promise<boolean>} - True if confirmed, false if cancelled
     */
    showConfirm(title, message, confirmText = 'OK', cancelText = 'Cancel', options = {}) {
        return new Promise((resolve) => {
            // Icon options
            const icons = {
                restore: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M12 7v5l4 2"></path></svg>',
                warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
                info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
                question: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
            };

            const iconHtml = options.icon && icons[options.icon]
                ? `<span class="dialog-icon dialog-icon-${options.icon}">${icons[options.icon]}</span>`
                : '';

            // Create dialog element
            const dialog = document.createElement('dialog');
            dialog.className = 'confirm-dialog glass-panel';

            // Message content - either escaped text or raw HTML
            const messageContent = options.html ? message : `<p>${escapeHtml(message)}</p>`;

            dialog.innerHTML = `
                <div class="dialog-header">
                    ${iconHtml}
                    <h3>${escapeHtml(title)}</h3>
                </div>
                <div class="dialog-body">
                    ${messageContent}
                </div>
                <div class="dialog-actions">
                    <button class="btn btn-ghost" data-action="cancel">${escapeHtml(cancelText)}</button>
                    <button class="btn btn-primary" data-action="confirm">${escapeHtml(confirmText)}</button>
                </div>
            `;

            // Handle button clicks
            dialog.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                if (action === 'confirm') {
                    dialog.close();
                    dialog.remove();
                    resolve(true);
                } else if (action === 'cancel') {
                    dialog.close();
                    dialog.remove();
                    resolve(false);
                }
            });

            // Handle backdrop click
            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) {
                    dialog.close();
                    dialog.remove();
                    resolve(false);
                }
            });

            // Handle escape key
            dialog.addEventListener('cancel', (e) => {
                e.preventDefault();
                dialog.close();
                dialog.remove();
                resolve(false);
            });

            document.body.appendChild(dialog);
            dialog.showModal();
        });
    }

    /**
     * Show a prompt dialog for user input
     * @param {string} title - Dialog title
     * @param {string} message - Dialog message
     * @param {string} defaultValue - Default input value
     * @param {string} confirmText - Confirm button text
     * @param {string} cancelText - Cancel button text
     * @param {object} options - Additional options (icon, hint, maxLength, validate)
     * @returns {Promise<string|null>} - Input value if confirmed, null if cancelled
     */
    showPrompt(title, message, defaultValue = '', confirmText = 'OK', cancelText = 'Cancel', options = {}) {
        return new Promise((resolve) => {
            // Icon options (reuse from showConfirm)
            const icons = {
                restore: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M12 7v5l4 2"></path></svg>',
                warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
                info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
                question: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
            };

            const iconHtml = options.icon && icons[options.icon]
                ? `<span class="dialog-icon dialog-icon-${options.icon}">${icons[options.icon]}</span>`
                : '';

            const dialog = document.createElement('dialog');
            dialog.className = 'confirm-dialog glass-panel';

            dialog.innerHTML = `
                <div class="dialog-header">
                    ${iconHtml}
                    <h3>${escapeHtml(title)}</h3>
                </div>
                <div class="dialog-body">
                    <p>${escapeHtml(message)}</p>
                    <div class="input-wrapper">
                        <input type="text" class="prompt-input" value="${escapeHtml(defaultValue)}"
                               maxlength="${options.maxLength || 100}" autocomplete="off">
                        ${options.hint ? `<span class="input-hint">${escapeHtml(options.hint)}</span>` : ''}
                    </div>
                </div>
                <div class="dialog-actions">
                    <button class="btn btn-ghost" data-action="cancel">${escapeHtml(cancelText)}</button>
                    <button class="btn btn-primary" data-action="confirm">${escapeHtml(confirmText)}</button>
                </div>
            `;

            const input = dialog.querySelector('.prompt-input');
            const confirmBtn = dialog.querySelector('[data-action="confirm"]');

            // Validierung
            const validate = () => {
                const value = input.value.trim();
                const isValid = options.validate ? options.validate(value) : value.length > 0;
                confirmBtn.disabled = !isValid;
                return isValid;
            };

            input.addEventListener('input', validate);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && validate()) {
                    dialog.close();
                    dialog.remove();
                    resolve(input.value.trim());
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    dialog.close();
                    dialog.remove();
                    resolve(null);
                }
            });

            dialog.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                if (action === 'confirm' && validate()) {
                    dialog.close();
                    dialog.remove();
                    resolve(input.value.trim());
                } else if (action === 'cancel') {
                    dialog.close();
                    dialog.remove();
                    resolve(null);
                }
            });

            dialog.addEventListener('cancel', (e) => {
                e.preventDefault();
                dialog.close();
                dialog.remove();
                resolve(null);
            });

            document.body.appendChild(dialog);
            dialog.showModal();

            // Auto-focus + select
            setTimeout(() => {
                input.focus();
                input.select();
            }, 50);
        });
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
