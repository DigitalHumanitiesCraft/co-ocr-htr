/**
 * Dialog Component
 *
 * Manages native <dialog> elements for API configuration and export.
 * Uses the storage service for persisting API keys.
 */

import { storage } from '../services/storage.js';
import { llmService } from '../services/llm.js';
import { appState } from '../state.js';

// Provider configuration
const PROVIDERS = ['gemini', 'openai', 'anthropic', 'deepseek', 'ollama'];

/**
 * Dialog Manager
 * Handles opening, closing, and interaction with dialogs
 */
class DialogManager {
    constructor() {
        this.dialogs = {};
        this.currentProvider = 'gemini';
    }

    /**
     * Initialize all dialogs
     */
    init() {
        // Cache dialog elements
        this.dialogs.apiKey = document.getElementById('apiKeyDialog');
        this.dialogs.export = document.getElementById('exportDialog');
        this.toastContainer = document.getElementById('toastContainer');

        if (!this.dialogs.apiKey || !this.dialogs.export) {
            console.warn('Dialog elements not found in DOM');
            return;
        }

        this.bindEvents();
        this.loadSavedApiKeys();
        this.updateProviderStatuses();
    }

    /**
     * Bind all event listeners
     */
    bindEvents() {
        // Generic close buttons
        document.querySelectorAll('[data-close-dialog]').forEach(btn => {
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
                const openDialog = document.querySelector('dialog[open]');
                if (openDialog) {
                    this.closeDialog(openDialog);
                }
            }
        });

        // API Key Dialog specific
        this.bindApiKeyDialogEvents();

        // Export Dialog specific
        this.bindExportDialogEvents();

        // Header button bindings
        this.bindHeaderButtons();

        // Password visibility toggles
        document.querySelectorAll('[data-toggle-password]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const wrapper = e.target.closest('.input-with-toggle');
                const input = wrapper.querySelector('input');
                const showIcon = wrapper.querySelector('.icon-show');
                const hideIcon = wrapper.querySelector('.icon-hide');

                if (input.type === 'password') {
                    input.type = 'text';
                    showIcon.style.display = 'none';
                    hideIcon.style.display = 'block';
                } else {
                    input.type = 'password';
                    showIcon.style.display = 'block';
                    hideIcon.style.display = 'none';
                }
            });
        });
    }

    /**
     * Bind header button click events
     */
    bindHeaderButtons() {
        // API Keys button
        const apiKeysBtn = document.querySelector('[title="API Keys"]');
        if (apiKeysBtn) {
            apiKeysBtn.onclick = () => this.openDialog('apiKey');
        }

        // Export button
        const exportBtn = document.querySelector('[title="Export"]');
        if (exportBtn) {
            exportBtn.onclick = () => this.openDialog('export');
        }
    }

    /**
     * Bind API Key Dialog specific events
     */
    bindApiKeyDialogEvents() {
        const dialog = this.dialogs.apiKey;
        if (!dialog) return;

        // Tab switching
        dialog.querySelectorAll('.dialog-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchProviderTab(tab.dataset.provider);
            });
        });

        // Save button
        const saveBtn = dialog.querySelector('#saveApiKeys');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveApiKeys());
        }

        // Test connection button
        const testBtn = dialog.querySelector('#testApiConnection');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.testConnection());
        }

        // Ollama refresh models
        const refreshBtn = dialog.querySelector('#ollamaRefreshModels');
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

        const downloadBtn = dialog.querySelector('#downloadExport');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.handleExport());
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
            // Get current provider settings
            const provider = this.currentProvider;

            if (provider === 'ollama') {
                const endpoint = document.getElementById('ollamaEndpoint')?.value;
                if (!endpoint) throw new Error('Endpoint is required');

                // Test Ollama connection
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

                // Set temporary key for testing
                llmService.setApiKey(provider, keyInput.value);
                llmService.setProvider(provider);

                // Simple test - most providers don't have a "ping" endpoint
                // We'll show success if key format is valid
                const keyFormats = {
                    gemini: /^AIza/,
                    openai: /^sk-/,
                    anthropic: /^sk-ant-/,
                    deepseek: /^sk-/
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
