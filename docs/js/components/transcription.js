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
import { batchProgress } from './batch-progress.js';
import { escapeHtml } from '../utils/textFormatting.js';

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
            dialogManager.showToast('Please load a document first', 'warning');
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

        // Update page selection UI
        this.updatePageSelectionUI();

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
                    <span>Modell: <strong>${escapeHtml(model)}</strong> (${escapeHtml(provider)})</span>
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
                    <span>API key for <strong>${escapeHtml(provider)}</strong> required</span>
                    <button type="button" class="btn btn-secondary btn-sm" id="configureApiBtn">Configure</button>
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
                dialogManager.showToast(`Please configure ${provider} API key`, 'warning');
                this.transcribeDialog.close();
                dialogManager.openDialog('apiKey');
                return;
            }
        }

        // Check page selection mode
        const pageMode = this.getSelectedPageMode();
        const state = appState.getState();
        const isMultiPage = (state.pages || []).length > 1;

        // Close dialog immediately
        if (this.transcribeDialog) {
            this.transcribeDialog.close();
        }

        // If multi-page and "all" selected, do batch transcription
        if (isMultiPage && pageMode === 'all') {
            await this.transcribeAllPages();
            return;
        }

        // Single page transcription (current page)
        this.setLoading(true);
        this.showEditorLoading(true);

        try {
            // Get image as base64 (without data URL prefix)
            // For multi-page, use current page's dataUrl
            let imageUrl;
            if (isMultiPage && state.pages.length > 0) {
                const currentPage = state.pages[state.currentPageIndex];
                imageUrl = currentPage?.dataUrl || state.document.dataUrl;
            } else {
                imageUrl = state.document.dataUrl || state.image.url;
            }

            const base64 = await this.getImageBase64(imageUrl);

            // Get context from expert (if provided)
            const contextDescription = contextManager.buildPromptContext();

            // Call LLM service with context (including structured context for script hints)
            const result = await llmService.transcribe(base64, {
                context: contextDescription,
                structuredContext: appState.getDocumentContext()
            });

            // Update state with transcription
            appState.setTranscription({
                provider: result.provider,
                model: result.model,
                raw: result.raw
            });

            this.setLoading(false);
            this.showEditorLoading(false);
            dialogManager.showToast(
                `Transcription complete (${result.provider})`,
                'success'
            );

        } catch (error) {
            console.error('Transcription error:', error);

            // Handle specific error types
            if (error.type === 'auth') {
                dialogManager.showToast('Invalid API key. Please check configuration.', 'error');
                this.transcribeDialog.close();
                dialogManager.openDialog('apiKey');
            } else if (error.type === 'rate_limit') {
                dialogManager.showToast('Rate limit reached. Please wait and try again.', 'warning');
            } else if (error.type === 'network') {
                dialogManager.showToast('Network error. Please check connection.', 'error');
            } else {
                dialogManager.showToast(`Transcription failed: ${error.message}`, 'error');
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
                        <span>Transcribing...</span>
                        <span class="loading-hint">This may take a few seconds</span>
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
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);

                    // Get base64 (without data URL prefix)
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                    const base64 = dataUrl.split(',')[1];
                    resolve(base64);
                } catch (err) {
                    reject(new Error(`Canvas conversion failed: ${err.message}`));
                }
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

    /**
     * Update the page selection UI based on current document
     */
    updatePageSelectionUI() {
        const pageSelectionEl = document.getElementById('transcribePageSelection');
        const pageCountEl = document.getElementById('pageSelectionCount');
        const allPagesHintEl = document.getElementById('allPagesHint');
        const batchWarningEl = document.getElementById('batchWarning');
        const batchPageCountEl = document.getElementById('batchPageCount');
        const batchTokenEstimateEl = document.getElementById('batchTokenEstimate');

        if (!pageSelectionEl) return;

        const state = appState.getState();
        const pages = state.pages || [];
        const isMultiPage = pages.length > 1;

        // Show/hide page selection based on multi-page
        pageSelectionEl.hidden = !isMultiPage;

        if (isMultiPage) {
            const currentPage = state.currentPageIndex + 1;
            const totalPages = pages.length;

            // Update counts
            if (pageCountEl) {
                pageCountEl.textContent = `Page ${currentPage} of ${totalPages}`;
            }

            if (allPagesHintEl) {
                allPagesHintEl.textContent = `${totalPages} pages, may take several minutes`;
            }

            if (batchPageCountEl) {
                batchPageCountEl.textContent = totalPages;
            }

            // Estimate tokens (~1000 tokens per page average)
            if (batchTokenEstimateEl) {
                const estimatedTokens = totalPages * 1000;
                batchTokenEstimateEl.textContent = `${estimatedTokens.toLocaleString()} Tokens`;
            }

            // Bind radio button change to show/hide warning
            const radioButtons = document.querySelectorAll('input[name="pageSelection"]');
            radioButtons.forEach(radio => {
                radio.addEventListener('change', () => {
                    if (batchWarningEl) {
                        batchWarningEl.hidden = radio.value !== 'all';
                    }
                });
            });

            // Reset to "current" and hide warning
            const currentRadio = document.querySelector('input[name="pageSelection"][value="current"]');
            if (currentRadio) currentRadio.checked = true;
            if (batchWarningEl) batchWarningEl.hidden = true;
        }
    }

    /**
     * Get selected page mode (current or all)
     */
    getSelectedPageMode() {
        const selected = document.querySelector('input[name="pageSelection"]:checked');
        return selected?.value || 'current';
    }

    /**
     * Transcribe all pages in batch
     */
    async transcribeAllPages() {
        const state = appState.getState();
        const pages = state.pages || [];

        if (pages.length === 0) {
            dialogManager.showToast('No pages to transcribe', 'warning');
            return;
        }

        // Initialize batch state
        appState.startBatch('transcription', pages.length);
        batchProgress.show('transcription', pages.length);
        this.setLoading(true);

        const results = [];

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];

            // Check for abort request
            if (appState.data.batch.abortRequested) {
                console.log('[Transcription] Batch aborted by user');
                break;
            }

            try {
                // Update progress
                batchProgress.update(i + 1, pages.length, 'transcription');

                // Get image as base64
                const base64 = await this.getImageBase64(page.dataUrl);

                // Get context
                const contextDescription = contextManager.buildPromptContext();

                // Call LLM service with context (including structured context for script hints)
                const result = await llmService.transcribe(base64, {
                    context: contextDescription,
                    structuredContext: appState.getDocumentContext()
                });

                // Store result for this page
                results.push({
                    pageId: page.id,
                    pageIndex: i,
                    success: true,
                    transcription: {
                        provider: result.provider,
                        model: result.model,
                        raw: result.raw
                    }
                });

                appState.updateBatchProgress(i, true);

                // Small delay to avoid rate limiting
                if (i < pages.length - 1) {
                    await this._delay(500);
                }

            } catch (error) {
                console.error(`Error transcribing page ${i + 1}:`, error);
                results.push({
                    pageId: page.id,
                    pageIndex: i,
                    success: false,
                    error: error.message
                });

                appState.updateBatchProgress(i, false);

                // If auth error, stop the batch
                if (error.type === 'auth') {
                    dialogManager.showToast('Invalid API key. Batch aborted.', 'error');
                    break;
                }

                // If rate limit, wait longer and continue
                if (error.type === 'rate_limit') {
                    dialogManager.showToast('Rate limit reached. Waiting 30 seconds...', 'warning');
                    await this._delay(30000);
                }
            }
        }

        // Store all transcriptions
        appState.setBatchTranscriptions(results);

        // Complete batch operation
        appState.completeBatch();

        // Set current page transcription
        const currentPageResult = results.find(r => r.pageIndex === state.currentPageIndex);
        if (currentPageResult?.success) {
            appState.setTranscription(currentPageResult.transcription);
        }

        this.setLoading(false);

        // Show completion summary
        const { successCount, errorCount, status } = appState.data.batch;
        batchProgress.showComplete(successCount, errorCount, status === 'aborted');

        // Trigger session save for persistence
        try {
            await appState.saveSessionNow();
        } catch (error) {
            console.warn('[Transcription] Failed to save batch session:', error.message);
            dialogManager.showToast('Batch complete, but saving failed', 'warning');
        }
    }

    /**
     * Helper for delay (allows abort check)
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Show batch progress overlay
     */
    showBatchProgress(current, total, filename = '') {
        const editorPanel = document.getElementById('editorContent');
        if (!editorPanel) return;

        let overlay = document.getElementById('editorLoadingOverlay');

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'editorLoadingOverlay';
            overlay.className = 'editor-loading-overlay';
            editorPanel.style.position = 'relative';
            editorPanel.appendChild(overlay);
        }

        const percent = Math.round((current / total) * 100);

        overlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner-large"></div>
                <span>Transcribing...</span>
                <span class="loading-hint">Page ${current} of ${total} (${percent}%)</span>
                ${filename ? `<span class="loading-hint">${filename}</span>` : ''}
                <div class="batch-progress-bar">
                    <div class="batch-progress-fill" style="width: ${percent}%"></div>
                </div>
            </div>
        `;
        overlay.hidden = false;
    }

    /**
     * Hide batch progress overlay
     */
    hideBatchProgress() {
        const overlay = document.getElementById('editorLoadingOverlay');
        if (overlay) {
            overlay.hidden = true;
        }
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

/* Editor Loading Overlay - Light, blurred overlay */
.editor-loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(250, 248, 245, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
}

.editor-loading-overlay .loading-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-6);
    background: rgba(255, 255, 255, 0.9);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
}

.editor-loading-overlay .loading-content span {
    font-size: var(--text-sm);
    color: var(--text-primary);
    font-weight: 500;
}

.editor-loading-overlay .loading-hint {
    color: var(--text-secondary);
    font-size: var(--text-xs);
}

/* Loading Spinner - Same as validation */
.loading-spinner-large {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-muted);
    border-top-color: var(--accent-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

/* Batch Progress Bar */
.batch-progress-bar {
    width: 200px;
    height: 6px;
    background: var(--border-muted);
    border-radius: 3px;
    overflow: hidden;
    margin-top: var(--space-2);
}

.batch-progress-fill {
    height: 100%;
    background: var(--accent-primary);
    border-radius: 3px;
    transition: width 0.3s ease;
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
