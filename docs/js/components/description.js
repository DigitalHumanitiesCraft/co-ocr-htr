/**
 * Description Component
 *
 * Handles the description workflow for illuminated initials:
 * 1. User clicks "Describe" button
 * 2. Opens description dialog with custom prompt editor
 * 3. Validates Gemini API key is configured
 * 4. Calls LLM service with image
 * 5. Displays response in collapsible panel
 * 6. Supports batch operations for multi-page documents
 */

import { llmService } from '../services/llm.js';
import { appState } from '../state.js';
import { dialogManager } from './dialogs.js';
import { batchProgress } from './batch-progress.js';
import { storage } from '../services/storage.js';

/**
 * Default description prompt for illuminated initials
 */
const DEFAULT_DESCRIPTION_PROMPT = `You are an expert in medieval manuscript studies and art history.

Task: Analyze and describe the illuminated initials and decorative elements in this manuscript page.

Focus on:
1. Historiated Initials: Letter forms containing biblical scenes or narrative imagery
2. Decorative Elements: Colors (gold, lapis, vermillion), borders, flourishes
3. Iconography: Biblical scenes, saints, symbols, gestures
4. Style & Period: Artistic style indicators (Romanesque, Gothic, Renaissance)
5. Technical Details: Gilding techniques, pigments, marginalia

Format your response with clear sections for initials, iconography, artistic style, and technical observations.

Be specific, scholarly, and note uncertainties. Use Latin terms where appropriate.`;

/**
 * Description Manager
 */
class DescriptionManager {
    constructor() {
        this.describeBtn = null;
        this.describeDialog = null;
        this.startBtn = null;
        this.descriptionPanel = null;
        this.descriptionTextarea = null;
        this.promptTextarea = null;
        this.isDescribing = false;
        this._initialized = false;
    }

    /**
     * Initialize description functionality
     */
    init() {
        if (this._initialized) return;
        this._initialized = true;

        this.describeBtn = document.getElementById('btnDescribe');
        this.describeDialog = document.getElementById('describeDialog');
        this.startBtn = document.getElementById('startDescription');
        this.descriptionPanel = document.getElementById('descriptionPanel');
        this.descriptionTextarea = document.getElementById('descriptionTextarea');
        this.promptTextarea = document.getElementById('descriptionPrompt');
        this.resizeHandle = document.getElementById('descriptionResizeHandle');
        this.editorContainer = document.getElementById('editorContent');

        if (!this.describeBtn) {
            console.warn('[Description] Describe button not found');
            return;
        }

        this.bindEvents();
        this.loadSavedPrompt();
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Open describe dialog
        this.describeBtn.addEventListener('click', () => this.openDescribeDialog());

        // Start description from dialog
        if (this.startBtn) {
            this.startBtn.addEventListener('click', () => this.handleDescribe());
        }

        // Close dialog on backdrop click
        if (this.describeDialog) {
            this.describeDialog.addEventListener('click', (e) => {
                if (e.target === this.describeDialog) {
                    this.describeDialog.close();
                }
            });
        }

        // Load default prompt button
        const loadDefaultBtn = document.getElementById('loadDefaultPrompt');
        if (loadDefaultBtn) {
            loadDefaultBtn.addEventListener('click', () => this.loadDefaultPrompt());
        }

        // Copy description button
        const copyBtn = document.getElementById('copyDescription');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyDescription());
        }

        // Collapse/expand description panel
        const collapseBtn = document.getElementById('descriptionCollapseBtn');
        if (collapseBtn) {
            collapseBtn.addEventListener('click', () => {
                if (this.descriptionPanel) {
                    this.descriptionPanel.open = !this.descriptionPanel.open;
                    // Show/hide resize handle based on open state
                    if (this.resizeHandle) {
                        this.resizeHandle.hidden = !this.descriptionPanel.open;
                    }
                }
            });
        }

        // Vertical resize handle between description and editor
        if (this.resizeHandle) {
            this.resizeHandle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this._startVerticalDrag(e.clientY);
            });
            this.resizeHandle.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this._startVerticalDrag(e.touches[0].clientY);
            }, { passive: false });
        }

        // Save custom prompt on change (debounced, flushable)
        if (this.descriptionTextarea) {
            this._debouncedSaveRaw = this._debounce(() => {
                appState.setDescriptionRaw(this.descriptionTextarea.value);
            }, 500);
            this.descriptionTextarea.addEventListener('input', this._debouncedSaveRaw);
        }

        // Save custom prompt on blur
        if (this.promptTextarea) {
            this.promptTextarea.addEventListener('blur', () => this.saveCustomPrompt());
        }

        // Listen for state changes
        appState.addEventListener('documentLoaded', () => {
            this.updateButtonState();
            this.hideDescriptionPanel();
        });

        appState.addEventListener('descriptionComplete', () => {
            this.setLoading(false);
            this.showDescriptionPanel();
        });

        // Flush pending debounced edits BEFORE the page snapshot is taken.
        // beforePageChange fires synchronously in goToPage() before
        // _saveCurrentPageDescription() and _loadPage().
        appState.addEventListener('beforePageChange', () => {
            if (this._debouncedSaveRaw) this._debouncedSaveRaw.flush();
        });

        appState.addEventListener('pageChanged', () => {
            this.updateDescriptionDisplay();
        });
    }

    /**
     * Open the description dialog
     */
    openDescribeDialog() {
        if (this.isDescribing) return;

        // Validate document is loaded
        const state = appState.getState();
        if (!state.document.dataUrl && state.image.url === 'assets/mock-document.jpg') {
            dialogManager.showToast('Please load a document first', 'warning');
            return;
        }

        // Update model info display
        this.updateModelInfo();

        // Update page selection UI
        this.updatePageSelectionUI();

        // Load saved or default prompt
        if (!this.promptTextarea.value.trim()) {
            this.loadSavedPrompt();
        }

        // Show dialog
        if (this.describeDialog) {
            this.describeDialog.showModal();
        }
    }

    /**
     * Update the model info display in the dialog
     */
    updateModelInfo() {
        const modelInfo = document.getElementById('descriptionModelName');
        const changeBtn = document.getElementById('changeDescriptionModel');

        if (!modelInfo) return;

        // Check if Gemini is configured
        const hasGeminiKey = this._isGeminiConfigured();
        const currentModel = llmService.activeProvider === 'gemini'
            ? llmService.getCurrentModel()
            : (llmService.providers.gemini?.defaultModel || 'Gemini 3 Pro');

        modelInfo.textContent = currentModel;

        // Update change button
        if (changeBtn) {
            changeBtn.onclick = () => {
                this.describeDialog.close();
                dialogManager.openDialog('apiKey');
            };
        }

        // Remove any existing warnings before potentially adding a new one
        const existingWarnings = modelInfo.parentElement.querySelectorAll('.model-info-warning');
        existingWarnings.forEach(el => el.remove());

        // Show warning if no Gemini key
        if (!hasGeminiKey) {
            const warningDiv = document.createElement('div');
            warningDiv.className = 'model-info-warning';
            warningDiv.innerHTML = `
                <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>Gemini API key required for image description</span>
                <button type="button" class="btn btn-secondary btn-sm" id="configureGeminiBtn">Configure</button>
            `;
            modelInfo.parentElement.appendChild(warningDiv);

            const configBtn = warningDiv.querySelector('#configureGeminiBtn');
            if (configBtn) {
                configBtn.addEventListener('click', () => {
                    this.describeDialog.close();
                    dialogManager.openDialog('apiKey');
                });
            }
        }
    }

    /**
     * Handle describe button click (from dialog)
     */
    async handleDescribe() {
        if (this.isDescribing) return;

        // Save custom prompt
        this.saveCustomPrompt();

        // Validate Gemini API key
        if (!this._isGeminiConfigured()) {
            dialogManager.showToast('Please configure Gemini API key for image description', 'warning');
            this.describeDialog.close();
            dialogManager.openDialog('apiKey');
            return;
        }

        // Check page selection mode
        const pageMode = this.getSelectedPageMode();
        const state = appState.getState();
        const isMultiPage = (state.pages || []).length > 1;

        // Close dialog immediately
        if (this.describeDialog) {
            this.describeDialog.close();
        }

        // If multi-page and "all" selected, do batch description
        if (isMultiPage && pageMode === 'all') {
            await this.describeAllPages();
            return;
        }

        // Single page description (current page)
        this.setLoading(true);

        try {
            // Get image as base64
            let imageUrl;
            if (isMultiPage && state.pages.length > 0) {
                const currentPage = state.pages[state.currentPageIndex];
                imageUrl = currentPage?.dataUrl || state.document.dataUrl;
            } else {
                imageUrl = state.document.dataUrl || state.image.url;
            }

            const base64 = await this.getImageBase64(imageUrl);

            // Get custom prompt
            const customPrompt = this.promptTextarea?.value.trim() || '';

            // Call LLM service
            const result = await llmService.describe(base64, {
                customPrompt
            });

            // Update state with description
            appState.setDescription({
                provider: result.provider,
                model: result.model,
                raw: result.raw,
                customPrompt
            });

            this.setLoading(false);
            dialogManager.showToast(
                `Description complete (${result.provider})`,
                'success'
            );

        } catch (error) {
            console.error('[Description] Error:', error);

            // Handle specific error types
            if (error.type === 'auth') {
                dialogManager.showToast('Invalid Gemini API key. Please check configuration.', 'error');
                this.describeDialog.close();
                dialogManager.openDialog('apiKey');
            } else if (error.type === 'rate_limit') {
                dialogManager.showToast('Rate limit reached. Please wait and try again.', 'warning');
            } else if (error.type === 'network') {
                dialogManager.showToast('Network error. Please check connection.', 'error');
            } else {
                dialogManager.showToast(`Description failed: ${error.message}`, 'error');
            }

            this.setLoading(false);
        }
    }

    /**
     * Describe all pages in batch
     */
    async describeAllPages() {
        const state = appState.getState();
        const pages = state.pages || [];

        if (pages.length === 0) {
            dialogManager.showToast('No pages to describe', 'warning');
            return;
        }

        // Get custom prompt
        const customPrompt = this.promptTextarea?.value.trim() || '';

        // Initialize batch state
        appState.startBatch('description', pages.length);
        batchProgress.show('description', pages.length);
        this.setLoading(true);

        const results = [];

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];

            // Check for abort request
            if (appState.data.batch.abortRequested) {
                console.log('[Description] Batch aborted by user');
                break;
            }

            try {
                // Update progress
                batchProgress.update(i + 1, pages.length, 'description');

                // Get image as base64
                const base64 = await this.getImageBase64(page.dataUrl);

                // Call LLM service
                const result = await llmService.describe(base64, {
                    customPrompt
                });

                // Store result for this page
                results.push({
                    pageId: page.id,
                    pageIndex: i,
                    success: true,
                    description: {
                        provider: result.provider,
                        model: result.model,
                        raw: result.raw,
                        customPrompt
                    }
                });

                appState.updateBatchProgress(i, true);

                // Small delay to avoid rate limiting
                if (i < pages.length - 1) {
                    await this._delay(500);
                }

            } catch (error) {
                console.error(`[Description] Error describing page ${i + 1}:`, error);
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
                    appState.requestBatchAbort();
                    break;
                }

                // If rate limit, wait longer and continue
                if (error.type === 'rate_limit') {
                    dialogManager.showToast('Rate limit reached. Waiting 30 seconds...', 'warning');
                    await this._delay(30000);
                }
            }
        }

        // Store all descriptions
        appState.setBatchDescriptions(results);

        // Complete batch operation
        appState.completeBatch();

        // Set current page description
        const currentPageResult = results.find(r => r.pageIndex === state.currentPageIndex);
        if (currentPageResult?.success) {
            appState.setDescription(currentPageResult.description);
        }

        this.setLoading(false);

        // Show completion summary
        const { successCount, errorCount, status } = appState.data.batch;
        batchProgress.showComplete(successCount, errorCount, status === 'aborted');

        // Trigger session save for persistence
        try {
            await appState.saveSessionNow();
        } catch (error) {
            console.warn('[Description] Failed to save batch session:', error.message);
            dialogManager.showToast('Batch complete, but saving failed', 'warning');
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
     * Show description panel with current description
     */
    showDescriptionPanel() {
        if (!this.descriptionPanel || !this.descriptionTextarea) return;

        const state = appState.getState();
        const description = state.description;

        if (!description.raw) return;

        // Update textarea
        this.descriptionTextarea.value = description.raw;

        // Update timestamp
        const timestampEl = document.getElementById('descriptionTimestamp');
        if (timestampEl && description.timestamp) {
            const date = new Date(description.timestamp);
            timestampEl.textContent = `Generated ${date.toLocaleString()}`;
        }

        // Update model badge
        const badgeEl = document.getElementById('descriptionModelBadge');
        if (badgeEl && description.model) {
            badgeEl.textContent = description.model;
        }

        // Show panel and resize handle
        this.descriptionPanel.hidden = false;
        this.descriptionPanel.open = true;
        if (this.resizeHandle) {
            this.resizeHandle.hidden = false;
        }
    }

    /**
     * Hide description panel
     */
    hideDescriptionPanel() {
        if (this.descriptionPanel) {
            this.descriptionPanel.hidden = true;
        }
        if (this.resizeHandle) {
            this.resizeHandle.hidden = true;
        }
        // Clear any persisted height so next show starts fresh
        if (this.descriptionPanel) {
            this.descriptionPanel.style.height = '';
        }
    }

    /**
     * Update description display when page changes
     */
    updateDescriptionDisplay() {
        const state = appState.getState();
        const description = state.description;

        if (description?.raw) {
            this.showDescriptionPanel();
        } else {
            this.hideDescriptionPanel();
        }
    }

    /**
     * Copy description to clipboard
     */
    copyDescription() {
        if (!this.descriptionTextarea) return;

        navigator.clipboard.writeText(this.descriptionTextarea.value)
            .then(() => {
                dialogManager.showToast('Description copied to clipboard', 'success');
            })
            .catch(err => {
                console.error('[Description] Copy failed:', err);
                dialogManager.showToast('Failed to copy description', 'error');
            });
    }

    /**
     * Load default prompt
     */
    loadDefaultPrompt() {
        if (this.promptTextarea) {
            this.promptTextarea.value = DEFAULT_DESCRIPTION_PROMPT;
            this.saveCustomPrompt();
        }
    }

    /**
     * Load saved custom prompt from storage
     */
    loadSavedPrompt() {
        const savedPrompt = storage.loadDescriptionPrompt();
        if (this.promptTextarea && savedPrompt) {
            this.promptTextarea.value = savedPrompt;
        } else if (this.promptTextarea) {
            this.promptTextarea.value = DEFAULT_DESCRIPTION_PROMPT;
        }
    }

    /**
     * Save custom prompt to storage
     */
    saveCustomPrompt() {
        if (this.promptTextarea) {
            const prompt = this.promptTextarea.value.trim();
            storage.saveDescriptionPrompt(prompt);
        }
    }

    /**
     * Update the page selection UI based on current document
     */
    updatePageSelectionUI() {
        const pageSelectionEl = document.getElementById('descriptionPageSelection');
        const pageCountEl = document.getElementById('descriptionPageCount');
        const allPagesHintEl = document.getElementById('descriptionAllPagesHint');

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

            // Reset to "current"
            const currentRadio = document.querySelector('input[name="descriptionPageSelection"][value="current"]');
            if (currentRadio) currentRadio.checked = true;
        }
    }

    /**
     * Get selected page mode (current or all)
     */
    getSelectedPageMode() {
        const selected = document.querySelector('input[name="descriptionPageSelection"]:checked');
        return selected?.value || 'current';
    }

    /**
     * Set loading state
     * @param {boolean} loading - Whether loading
     */
    setLoading(loading) {
        this.isDescribing = loading;

        if (!this.describeBtn) return;

        const btnText = this.describeBtn.querySelector('.btn-text');
        const btnSpinner = this.describeBtn.querySelector('.btn-spinner');

        if (loading) {
            this.describeBtn.disabled = true;
            this.describeBtn.classList.add('loading');
            if (btnText) btnText.hidden = true;
            if (btnSpinner) btnSpinner.hidden = false;
            appState.setLoading(true, 'Describing...');
        } else {
            this.describeBtn.disabled = false;
            this.describeBtn.classList.remove('loading');
            if (btnText) btnText.hidden = false;
            if (btnSpinner) btnSpinner.hidden = true;
            appState.setLoading(false);
        }
    }

    /**
     * Update button state based on app state
     */
    updateButtonState() {
        if (!this.describeBtn) return;

        const state = appState.getState();
        const hasDocument = state.document.dataUrl ||
            (state.image.url && state.image.url !== 'assets/mock-document.jpg');

        // Button is enabled if we have a document
        this.describeBtn.disabled = !hasDocument || this.isDescribing;
    }

    /**
     * Check if Gemini is configured
     * @returns {boolean} True if Gemini API key exists
     */
    _isGeminiConfigured() {
        const geminiKey = llmService.providers.gemini?.apiKey;
        return !!geminiKey;
    }

    /**
     * Start vertical drag between description panel and editor
     * @param {number} startY - Starting clientY position
     */
    _startVerticalDrag(startY) {
        if (!this.descriptionPanel || !this.editorContainer) return;

        const MIN_HEIGHT = 80; // px minimum for either pane
        const startDescH = this.descriptionPanel.getBoundingClientRect().height;
        const startEditorH = this.editorContainer.getBoundingClientRect().height;
        let rafId = null;

        this.resizeHandle.classList.add('dragging');
        document.body.classList.add('pane-resizing-vertical');

        const onMove = (e) => {
            const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? startY;
            const dy = clientY - startY;

            let newDescH = startDescH + dy;
            let newEditorH = startEditorH - dy;

            // Enforce minimum heights
            if (newDescH < MIN_HEIGHT) {
                newEditorH += newDescH - MIN_HEIGHT;
                newDescH = MIN_HEIGHT;
            }
            if (newEditorH < MIN_HEIGHT) {
                newDescH += newEditorH - MIN_HEIGHT;
                newEditorH = MIN_HEIGHT;
            }
            if (newDescH < MIN_HEIGHT || newEditorH < MIN_HEIGHT) return;

            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                this.descriptionPanel.style.height = `${newDescH}px`;
                this.editorContainer.style.height = `${newEditorH}px`;
            });
        };

        const onEnd = () => {
            this.resizeHandle.classList.remove('dragging');
            document.body.classList.remove('pane-resizing-vertical');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
            if (rafId) cancelAnimationFrame(rafId);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);
    }

    /**
     * Debounce helper with flush support
     */
    _debounce(fn, delay) {
        let timeoutId;
        let pendingArgs;
        const debounced = (...args) => {
            pendingArgs = args;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                pendingArgs = null;
                fn(...args);
            }, delay);
        };
        debounced.flush = () => {
            if (pendingArgs !== null && pendingArgs !== undefined) {
                clearTimeout(timeoutId);
                const args = pendingArgs;
                pendingArgs = null;
                fn(...args);
            }
        };
        return debounced;
    }

    /**
     * Delay helper
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export singleton instance
export const descriptionManager = new DescriptionManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        descriptionManager.init();
    });
} else {
    descriptionManager.init();
}
