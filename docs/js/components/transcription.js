/**
 * Transcription Component
 *
 * Handles the transcription workflow:
 * 1. User clicks "Transcribe" button
 * 2. Opens transcription dialog with optional context
 * 3. Validates API key is configured
 * 4. Calls LLM service with image
 * 5. Parses response and updates state
 * 6. Editor reflects the new transcription
 */

import { llmService } from '../services/llm.js';
import { appState } from '../state.js';
import { dialogManager } from './dialogs.js';
import { contextManager } from './context.js';

/**
 * Transcription Manager
 */
class TranscriptionManager {
    constructor() {
        this.transcribeBtn = null;
        this.transcribeDialog = null;
        this.startBtn = null;
        this.isTranscribing = false;
    }

    /**
     * Initialize transcription functionality
     */
    init() {
        this.transcribeBtn = document.getElementById('btnTranscribe');
        this.transcribeDialog = document.getElementById('transcribeDialog');
        this.startBtn = document.getElementById('startTranscription');

        if (!this.transcribeBtn) {
            console.warn('Transcribe button not found');
            return;
        }

        this.bindEvents();
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Open transcribe dialog
        this.transcribeBtn.addEventListener('click', () => this.openTranscribeDialog());

        // Start transcription from dialog
        if (this.startBtn) {
            this.startBtn.addEventListener('click', () => this.handleTranscribe());
        }

        // Close dialog on backdrop click
        if (this.transcribeDialog) {
            this.transcribeDialog.addEventListener('click', (e) => {
                if (e.target === this.transcribeDialog) {
                    this.transcribeDialog.close();
                }
            });
        }

        // Listen for state changes
        appState.addEventListener('documentLoaded', () => {
            this.updateButtonState();
        });

        appState.addEventListener('transcriptionComplete', () => {
            this.setLoading(false);
            this.showEditorLoading(false);
        });
    }

    /**
     * Open the transcription dialog
     */
    openTranscribeDialog() {
        if (this.isTranscribing) return;

        // Validate document is loaded
        const state = appState.getState();
        if (!state.document.dataUrl && state.image.url === 'assets/mock-document.jpg') {
            dialogManager.showToast('Bitte zuerst ein Dokument laden', 'warning');
            return;
        }

        // Pre-fill context from existing state
        const context = appState.getDocumentContext();
        if (context) {
            contextManager.populateForm(context);
            // Open the details if context exists
            const details = document.getElementById('contextDetails');
            if (details) details.open = true;
        }

        // Update model info display
        this.updateModelInfo();

        // Show dialog
        if (this.transcribeDialog) {
            this.transcribeDialog.showModal();
        }
    }

    /**
     * Update the model info display in the dialog
     */
    updateModelInfo() {
        const modelInfo = document.getElementById('transcribeModelInfo');
        if (!modelInfo) return;

        const provider = llmService.activeProvider;
        const model = llmService.getCurrentModel();
        const hasKey = llmService.hasApiKey();

        if (provider === 'ollama' || hasKey) {
            modelInfo.innerHTML = `
                <div class="model-info-ready">
                    <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <span>Modell: <strong>${model}</strong> (${provider})</span>
                    <button type="button" class="btn-link" id="changeModelBtn">ändern</button>
                </div>
            `;
            // Bind change model button
            const changeBtn = document.getElementById('changeModelBtn');
            if (changeBtn) {
                changeBtn.addEventListener('click', () => {
                    this.transcribeDialog.close();
                    dialogManager.openDialog('apiKey');
                });
            }
        } else {
            modelInfo.innerHTML = `
                <div class="model-info-warning">
                    <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>API-Key für <strong>${provider}</strong> erforderlich</span>
                    <button type="button" class="btn btn-secondary btn-sm" id="configureApiBtn">Konfigurieren</button>
                </div>
            `;
            // Bind configure button
            const configBtn = document.getElementById('configureApiBtn');
            if (configBtn) {
                configBtn.addEventListener('click', () => {
                    this.transcribeDialog.close();
                    dialogManager.openDialog('apiKey');
                });
            }
        }
    }

    /**
     * Handle transcribe button click (from dialog)
     */
    async handleTranscribe() {
        if (this.isTranscribing) return;

        // Save context from form
        contextManager.saveContextSilent();

        // Validate API key is configured
        if (!llmService.hasApiKey()) {
            const provider = llmService.activeProvider;
            if (provider !== 'ollama') {
                dialogManager.showToast(`Bitte ${provider} API-Key konfigurieren`, 'warning');
                this.transcribeDialog.close();
                dialogManager.openDialog('apiKey');
                return;
            }
        }

        // Close dialog immediately and show loading in editor
        if (this.transcribeDialog) {
            this.transcribeDialog.close();
        }

        // Start transcription
        this.setLoading(true);
        this.showEditorLoading(true);

        try {
            // Get image as base64 (without data URL prefix)
            const state = appState.getState();
            const imageUrl = state.document.dataUrl || state.image.url;
            const base64 = await this.getImageBase64(imageUrl);

            // Get context from expert (if provided)
            const contextDescription = contextManager.buildPromptContext();

            // Call LLM service with context
            const result = await llmService.transcribe(base64, {
                context: contextDescription
            });

            // Update state with transcription
            appState.setTranscription({
                provider: result.provider,
                model: result.model,
                raw: result.raw
            });

            this.showEditorLoading(false);
            dialogManager.showToast(
                `Transkription abgeschlossen (${result.provider})`,
                'success'
            );

        } catch (error) {
            console.error('Transcription error:', error);

            // Handle specific error types
            if (error.type === 'auth') {
                dialogManager.showToast('Ungültiger API-Key. Bitte Konfiguration prüfen.', 'error');
                this.transcribeDialog.close();
                dialogManager.openDialog('apiKey');
            } else if (error.type === 'rate_limit') {
                dialogManager.showToast('Rate-Limit erreicht. Bitte warten und erneut versuchen.', 'warning');
            } else if (error.type === 'network') {
                dialogManager.showToast('Netzwerkfehler. Bitte Verbindung prüfen.', 'error');
            } else {
                dialogManager.showToast(`Transkription fehlgeschlagen: ${error.message}`, 'error');
            }

            this.setLoading(false);
            this.showEditorLoading(false);
        }
    }

    /**
     * Show/hide loading overlay in editor panel
     * @param {boolean} show - Whether to show loading
     */
    showEditorLoading(show) {
        const editorPanel = document.getElementById('editorContent');
        if (!editorPanel) return;

        let overlay = document.getElementById('editorLoadingOverlay');

        if (show) {
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'editorLoadingOverlay';
                overlay.className = 'editor-loading-overlay';
                overlay.innerHTML = `
                    <div class="loading-content">
                        <div class="loading-spinner-large"></div>
                        <span>Transkription läuft...</span>
                        <span class="loading-hint">Das kann einige Sekunden dauern</span>
                    </div>
                `;
                editorPanel.style.position = 'relative';
                editorPanel.appendChild(overlay);
            }
            overlay.hidden = false;
        } else {
            if (overlay) {
                overlay.hidden = true;
            }
        }
    }

    /**
     * Get image as base64 string (without data URL prefix)
     * @param {string} url - Image URL or data URL
     * @returns {Promise<string>} Base64 string
     */
    async getImageBase64(url) {
        // If already a data URL, extract base64 part
        if (url.startsWith('data:')) {
            const base64 = url.split(',')[1];
            return base64;
        }

        // Load image and convert to base64
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                // Get base64 (without data URL prefix)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                const base64 = dataUrl.split(',')[1];
                resolve(base64);
            };

            img.onerror = () => {
                reject(new Error('Failed to load image'));
            };

            img.src = url;
        });
    }

    /**
     * Set loading state
     * @param {boolean} loading - Whether loading
     */
    setLoading(loading) {
        this.isTranscribing = loading;

        if (!this.transcribeBtn) return;

        const btnText = this.transcribeBtn.querySelector('.btn-text');
        const btnSpinner = this.transcribeBtn.querySelector('.btn-spinner');

        if (loading) {
            this.transcribeBtn.disabled = true;
            this.transcribeBtn.classList.add('loading');
            if (btnText) btnText.hidden = true;
            if (btnSpinner) btnSpinner.hidden = false;
            appState.setLoading(true, 'Transcribing...');
        } else {
            this.transcribeBtn.disabled = false;
            this.transcribeBtn.classList.remove('loading');
            if (btnText) btnText.hidden = false;
            if (btnSpinner) btnSpinner.hidden = true;
            appState.setLoading(false);
        }
    }

    /**
     * Update button state based on app state
     */
    updateButtonState() {
        if (!this.transcribeBtn) return;

        const state = appState.getState();
        const hasDocument = state.document.dataUrl ||
            (state.image.url && state.image.url !== 'assets/mock-document.jpg');

        // Button is enabled if we have a document
        // (API key check happens on click)
        this.transcribeBtn.disabled = !hasDocument || this.isTranscribing;
    }
}

// Add spinner animation CSS
const spinnerStyles = `
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.btn .spinner {
    width: 16px;
    height: 16px;
    animation: spin 1s linear infinite;
}

.btn.loading {
    pointer-events: none;
    opacity: 0.8;
}

.btn-spinner {
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.btn-sm {
    padding: 6px 12px;
    font-size: var(--text-sm);
}

/* Editor Loading Overlay */
.editor-loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(var(--bg-primary-rgb, 26, 27, 30), 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    backdrop-filter: blur(4px);
}

.editor-loading-overlay .loading-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    color: var(--text-primary);
}

.editor-loading-overlay .loading-content span {
    font-size: var(--text-sm);
}

.editor-loading-overlay .loading-hint {
    color: var(--text-tertiary);
    font-size: var(--text-xs);
}

.loading-spinner-large {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: var(--accent-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
}
`;

// Inject styles
function injectStyles() {
    if (document.getElementById('transcriptionStyles')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'transcriptionStyles';
    styleEl.textContent = spinnerStyles;
    document.head.appendChild(styleEl);
}

// Export singleton instance
export const transcriptionManager = new TranscriptionManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        injectStyles();
        transcriptionManager.init();
    });
} else {
    injectStyles();
    transcriptionManager.init();
}
