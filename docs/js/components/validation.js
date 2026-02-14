/**
 * Validation Panel Component
 *
 * Renders validation results in the right panel:
 * - Rule-based validation results (configurable categories)
 * - LLM Review results with optional custom prompt
 * - Clickable line references for navigation
 *
 * Display Logic:
 * - Shows empty state when no transcription exists
 * - Shows validation results when transcription is available
 * - Both Validation and LLM Review sections always visible (compact)
 */

import { validationEngine } from '../services/validation.js';
import { llmService, ISSUE_TYPES } from '../services/llm.js';
import { FEATURE_FLAGS } from '../utils/constants.js';
import { storage } from '../services/storage.js';
import { appState } from '../state.js';
import { applySuggestionAtLine } from '../editor.js';
import { dialogManager } from './dialogs.js';
import { batchProgress } from './batch-progress.js';
import { contextManager } from './context.js';
import { getById, show, hide, select, selectAll, setText, setHTML } from '../utils/dom.js';
import { escapeHtml } from '../utils/textFormatting.js';
import { listPromptProfiles } from '../config/promptProfiles.js';
import { t } from '../services/i18n.js';

/**
 * Validation Panel Manager
 */
class ValidationPanel {
    constructor() {
        this.panel = null;
        this.emptyState = null;
        this.ruleSection = null;
        this.aiSection = null;
        this.isValidating = false;
        this.validateDialog = null;
        this.startValidationBtn = null;
        this.llmIssueApplyState = new Map();
        this.llmIssueStateSignature = '';
        this._isSyncingPromptControls = false;
    }

    /**
     * Initialize validation panel
     */
    init() {
        // Guard against double-initialization (auto-init + main.js)
        if (this._initialized) return;
        this._initialized = true;

        // Find panel elements
        this.panel = getById('validationContent');
        this.emptyState = getById('validationEmptyState');
        this.ruleSection = getById('ruleBasedSection');
        this.aiSection = getById('llmReviewSection');

        if (!this.panel) {
            console.warn('Validation panel not found');
            return;
        }

        // Get dialog elements
        this.validateDialog = getById('validateDialog');
        this.startValidationBtn = getById('startValidation');

        this.bindEvents();
        this.initPromptProfileControls();

        // Check initial state
        this.updateVisibility();
    }

    /**
     * Update panel visibility based on document and transcription state
     *
     * Display logic:
     * - No document: Hide entire panel content (collapsed)
     * - Document but no transcription: Show empty state with hint
     * - Document with transcription: Show validation sections
     */
    updateVisibility() {
        const state = appState.getState();
        // Check for document: multi-page (pages array) OR single page (document.dataUrl or non-mock image)
        const hasDocument = state.pages?.length > 0 ||
                            state.document?.dataUrl ||
                            (state.image?.url && state.image.url !== 'assets/mock-document.jpg');
        // Check for transcription: raw text OR segments
        const hasTranscription = (state.transcription?.raw && state.transcription.raw.trim().length > 0) ||
                                  state.transcription?.segments?.length > 0;

        // Get the main panel container
        // panelContent reference unused - using this.panel directly

        if (!hasDocument) {
            // No document: hide all content, show minimal state
            if (this.emptyState) {
                this.emptyState.hidden = false;
                setText(select('h4', this.emptyState), t('dynamic.noDocument'));
                setText(select('p', this.emptyState), t('dynamic.loadDocToValidate'));
            }
            hide(this.ruleSection);
            hide(this.aiSection);
        } else if (hasTranscription) {
            // Document + transcription: show validation sections
            hide(this.emptyState);
            show(this.ruleSection);
            show(this.aiSection);
        } else {
            // Document but no transcription: show empty state with hint
            if (this.emptyState) {
                this.emptyState.hidden = false;
                setText(select('h4', this.emptyState), t('dynamic.noValidationYet'));
                setText(select('p', this.emptyState), t('dynamic.runTranscriptionFirst'));
            }
            hide(this.ruleSection);
            hide(this.aiSection);
        }
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Validate button in editor panel - opens dialog
        this.validateBtn = getById('btnValidate');
        if (this.validateBtn) {
            this.validateBtn.addEventListener('click', () => this.openValidateDialog());
        }

        // Start validation button in dialog
        if (this.startValidationBtn) {
            this.startValidationBtn.addEventListener('click', () => this.handleValidateClick());
        }

        // Close dialog on backdrop click
        if (this.validateDialog) {
            this.validateDialog.addEventListener('click', (e) => {
                if (e.target === this.validateDialog) {
                    this.validateDialog.close();
                }
            });
        }

        // Listen for transcription completion - enable validate button, don't auto-run
        appState.addEventListener('transcriptionComplete', () => {
            this.updateVisibility();
            this.updateValidateButton(true);
            // Show hint that validation is available
            this.showValidationHint();
        });

        // Listen for document load (reset validation)
        appState.addEventListener('documentLoaded', () => {
            this.updateVisibility();
            this.clearValidation();
            // Check if transcription exists (e.g., from loaded project with existing transcription)
            const state = appState.getState();
            const hasTranscription = (state.transcription?.raw && state.transcription.raw.trim().length > 0) ||
                                    (state.transcription?.segments?.length > 0);
            this.updateValidateButton(hasTranscription);
        });

        // Listen for page changes (multi-page support) - load saved validation or clear
        appState.addEventListener('pageChanged', () => {
            this.updateVisibility();
            this.loadPageValidation();
            this.restoreCustomPrompt();
        });

        // Restore custom prompt when session is loaded
        appState.addEventListener('sessionRestored', () => {
            this.restoreCustomPrompt();
            this.syncPromptProfileControls();
        });

        appState.addEventListener('promptConfigChanged', () => {
            this.syncPromptProfileControls();
        });

        // Listen for validation state changes
        appState.addEventListener('validationComplete', (e) => {
            this.render(e.detail);
        });

        // Check initial state for validate button
        const state = appState.getState();
        const hasTranscription = (state.transcription?.raw && state.transcription.raw.trim().length > 0);
        this.updateValidateButton(hasTranscription);
    }

    /**
     * Open the validation dialog
     */
    openValidateDialog() {
        if (this.isValidating) return;

        // Validate transcription exists
        const state = appState.getState();
        const hasTranscription = (state.transcription?.raw && state.transcription.raw.trim().length > 0) ||
                                  state.transcription?.segments?.length > 0;

        if (!hasTranscription) {
            dialogManager.showToast(t('toast.transcribeFirst'), 'warning');
            return;
        }

        // Update page selection UI
        this.updatePageSelectionUI();

        // Update LLM mode hint
        this.updateLLMModeHint();

        // Show/hide stage toggles based on feature flag
        this.updateStageTogglesVisibility();

        // Show dialog
        if (this.validateDialog) {
            this.validateDialog.showModal();
        }
    }

    /**
     * Update the page selection UI based on current document
     */
    updatePageSelectionUI() {
        const pageSelectionEl = getById('validatePageSelection');
        const pageCountEl = getById('validatePageCount');
        const allPagesHintEl = getById('validateAllPagesHint');
        const batchWarningEl = getById('validateBatchWarning');
        const batchPageCountEl = getById('validateBatchPageCount');

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
                pageCountEl.textContent = t('dynamic.pageOf', { current: currentPage, total: totalPages });
            }

            if (allPagesHintEl) {
                allPagesHintEl.textContent = t('dynamic.pagesMayTakeMinutes', { count: totalPages });
            }

            if (batchPageCountEl) {
                batchPageCountEl.textContent = totalPages;
            }

            // Bind radio button change to show/hide warning
            const radioButtons = document.querySelectorAll('input[name="validatePageSelection"]');
            radioButtons.forEach(radio => {
                radio.addEventListener('change', () => {
                    if (batchWarningEl) {
                        batchWarningEl.hidden = radio.value !== 'all';
                    }
                });
            });

            // Reset to "current" and hide warning
            const currentRadio = document.querySelector('input[name="validatePageSelection"][value="current"]');
            if (currentRadio) currentRadio.checked = true;
            if (batchWarningEl) batchWarningEl.hidden = true;
        }
    }

    /**
     * Update LLM mode hint based on API key status
     */
    updateLLMModeHint() {
        const llmModeItem = getById('llmModeItem');
        const llmModeHint = getById('llmModeHint');
        const enableLLMCheckbox = getById('enableLLM');
        const customPromptDetails = document.querySelector('.custom-prompt-details');

        if (!llmModeHint) return;

        const hasApiKey = llmService.hasApiKey();

        if (hasApiKey) {
            llmModeHint.textContent = t('dynamic.apiCallPerPage');
            if (llmModeItem) llmModeItem.classList.remove('disabled');
            if (enableLLMCheckbox) enableLLMCheckbox.disabled = false;
            if (customPromptDetails) customPromptDetails.style.display = '';
        } else {
            llmModeHint.textContent = t('dynamic.apiKeyRequiredShort');
            if (llmModeItem) llmModeItem.classList.add('disabled');
            if (enableLLMCheckbox) {
                enableLLMCheckbox.checked = false;
                enableLLMCheckbox.disabled = true;
            }
            if (customPromptDetails) customPromptDetails.style.display = 'none';
        }
    }

    /**
     * Show/hide stage toggles based on feature flag
     */
    updateStageTogglesVisibility() {
        const section = getById('stageTogglesSection');
        if (!section) return;
        // Only show stage toggles when postprocessing pipeline is enabled
        section.hidden = !FEATURE_FLAGS.postprocessPipelineV1;
    }

    getPromptConfigSafe() {
        if (typeof appState.getPromptConfig === 'function') {
            return appState.getPromptConfig();
        }
        return {
            profileId: 'generic_default',
            overrides: { stage1: '', stage2: '', stage3: '' }
        };
    }

    initPromptProfileControls() {
        const profileSelect = getById('promptProfileSelectValidate');
        const stage2Input = getById('promptOverrideStage2');
        const stage3Input = getById('promptOverrideStage3');
        const resetStage2 = getById('resetPromptStage2');
        const resetStage3 = getById('resetPromptStage3');

        if (profileSelect) {
            const profiles = listPromptProfiles();
            profileSelect.innerHTML = profiles
                .map(profile => `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.label)}</option>`)
                .join('');

            profileSelect.addEventListener('change', () => {
                if (this._isSyncingPromptControls) return;
                appState.setPromptProfile?.(profileSelect.value);
            });
        }

        if (stage2Input) {
            stage2Input.addEventListener('input', () => {
                if (this._isSyncingPromptControls) return;
                appState.setPromptOverride?.('stage2', stage2Input.value);
            });
        }

        if (stage3Input) {
            stage3Input.addEventListener('input', () => {
                if (this._isSyncingPromptControls) return;
                appState.setPromptOverride?.('stage3', stage3Input.value);
            });
        }

        if (resetStage2) {
            resetStage2.addEventListener('click', () => appState.clearPromptOverride?.('stage2'));
        }

        if (resetStage3) {
            resetStage3.addEventListener('click', () => appState.clearPromptOverride?.('stage3'));
        }

        this.syncPromptProfileControls();
    }

    syncPromptProfileControls() {
        const profileSelect = getById('promptProfileSelectValidate');
        const stage2Input = getById('promptOverrideStage2');
        const stage3Input = getById('promptOverrideStage3');
        const promptConfig = this.getPromptConfigSafe();

        this._isSyncingPromptControls = true;
        if (profileSelect) profileSelect.value = promptConfig.profileId || 'generic_default';
        if (stage2Input) stage2Input.value = promptConfig.overrides?.stage2 || '';
        if (stage3Input) stage3Input.value = promptConfig.overrides?.stage3 || '';
        this._isSyncingPromptControls = false;
    }

    /**
     * Get validation options from dialog checkboxes
     * @returns {object} Validation options
     */
    getValidationOptions() {
        const options = {
            checkMarkers: getById('checkMarkers')?.checked ?? true,
            checkStats: getById('checkStats')?.checked ?? true,
            checkArtifacts: getById('checkArtifacts')?.checked ?? true,
            includeLLM: getById('enableLLM')?.checked ?? true,
            customPrompt: getById('customValidationPrompt')?.value?.trim() || '',
            // Forward document context into LLM Review / postprocessing prompts.
            contextDescription: contextManager.buildPromptContext() || '',
            promptConfig: this.getPromptConfigSafe()
        };

        // Include stage toggles when pipeline is active
        if (FEATURE_FLAGS.postprocessPipelineV1) {
            options.runStage2 = getById('enableStage2')?.checked ?? true;
            options.runStage3 = getById('enableStage3')?.checked ?? true;
        }

        return options;
    }

    /**
     * Get selected page mode (current or all)
     */
    getSelectedPageMode() {
        const selected = document.querySelector('input[name="validatePageSelection"]:checked');
        return selected?.value || 'current';
    }

    /**
     * Handle validate button click (from dialog)
     */
    handleValidateClick() {
        if (this.isValidating) return;

        // Check page selection mode
        const pageMode = this.getSelectedPageMode();
        const state = appState.getState();
        const isMultiPage = (state.pages || []).length > 1;

        // Close dialog immediately
        if (this.validateDialog) {
            this.validateDialog.close();
        }

        // If multi-page and "all" selected, do batch validation
        if (isMultiPage && pageMode === 'all') {
            this.validateAllPages();
            return;
        }

        // Single page validation
        this.runValidation();
    }

    /**
     * Update validate button state
     */
    updateValidateButton(enabled) {
        if (!this.validateBtn) return;
        this.validateBtn.disabled = !enabled;
    }

    /**
     * Load validation results for current page (after page change)
     */
    loadPageValidation() {
        const state = appState.getState();
        const hasTranscription = (state.transcription?.raw && state.transcription.raw.trim().length > 0) ||
                                  state.transcription?.segments?.length > 0;

        // Check if validation results exist for this page
        if (state.validation.status === 'complete' &&
            (state.validation.rules?.length > 0 || state.validation.llmJudge)) {
            // Render existing validation results
            this.render({
                rules: state.validation.rules,
                llmJudge: state.validation.llmJudge,
                summary: state.validation.summary
            });
            this.updateValidateButton(hasTranscription);
        } else {
            // No validation for this page - clear and show hint
            this.clearValidation();
            this.updateValidateButton(hasTranscription);
        }
    }

    /**
     * Restore custom prompt into textarea from state or localStorage
     */
    restoreCustomPrompt() {
        const textarea = getById('customValidationPrompt');
        if (!textarea) return;

        const state = appState.getState();
        // For validated pages, show exactly the per-page prompt (including explicit empty).
        // Otherwise use the global fallback prompt for convenience.
        const prompt = state.validation?.status === 'complete'
            ? (state.validation.customPrompt || '')
            : storage.loadValidationPrompt();
        textarea.value = prompt || '';
    }

    /**
     * Show validation available hint in panel
     */
    showValidationHint() {
        setHTML('ruleBasedContent', `<p class="text-secondary text-xs" style="padding: var(--space-2);">${t('dynamic.clickValidateRules')}</p>`);
        setHTML('llmReviewContent', `<p class="text-secondary text-xs" style="padding: var(--space-2);">${t('dynamic.clickValidateLLM')}</p>`);
    }

    /**
     * Clear validation results (e.g., when loading new document)
     */
    clearValidation() {
        setHTML('ruleBasedContent', `<p class="text-secondary text-xs" style="padding: var(--space-2);">${t('dynamic.runTranscriptionRules')}</p>`);
        setHTML('llmReviewContent', `<p class="text-secondary text-xs" style="padding: var(--space-2);">${t('dynamic.configureLLM')}</p>`);

        // Update badge
        const badge = getById('validationBadge');
        if (badge) {
            badge.textContent = t('dynamic.issueCount', { count: 0 });
            badge.hidden = true;
        }
    }

    /**
     * Run validation on current transcription
     * @param {boolean} llmOnly - Only run LLM validation (skip rules)
     */
    async runValidation(_llmOnly = false) {
        if (this.isValidating) return;

        const state = appState.getState();
        const segments = state.transcription.segments;
        const text = state.transcription.raw || segments.map(s => s.text).join('\n');

        if (!text || text.trim().length === 0) {
            return;
        }

        this.isValidating = true;
        appState.setValidationStatus('running');

        // Show loading state in button and panel
        this.setButtonLoading(true);
        this.renderLoading();

        // Thinking panel support (declared outside try for catch access)
        const supportsThinking = FEATURE_FLAGS.thinkingPanel &&
            llmService._supportsThinking(llmService.activeProvider);

        try {
            // Get options from dialog checkboxes
            const options = this.getValidationOptions();

            // Override LLM option if no API key
            if (!llmService.hasApiKey()) {
                options.includeLLM = false;
            }

            // Emit thinking start when LLM review is included
            const willUseLLM = options.includeLLM && llmService.hasApiKey();
            if (supportsThinking && willUseLLM) {
                appState.emitThinkingStart({
                    operation: 'validation',
                    provider: llmService.activeProvider,
                    model: llmService.getCurrentModel()
                });
            }
            const thinkingStartTime = Date.now();

            // Pass stream options to validation engine
            if (supportsThinking && willUseLLM) {
                options.stream = true;
                options.onThinkingChunk = (text) => appState.emitThinkingChunk({ text, operation: 'validation' });
            }

            const results = await validationEngine.validate(text, segments, options);

            if (supportsThinking && willUseLLM) {
                appState.emitThinkingComplete({
                    operation: 'validation',
                    duration: Date.now() - thinkingStartTime
                });
            }
            const resultsWithPrompt = {
                ...results,
                customPrompt: options.customPrompt || ''
            };
            if (options.customPrompt) {
                storage.saveValidationPrompt(options.customPrompt);
            }

            // Update state
            appState.setValidationResults(resultsWithPrompt);
            this.hideLoading();
            this.render(resultsWithPrompt);

            dialogManager.showToast(t('toast.validationComplete'), 'success');

        } catch (error) {
            console.error('Validation error:', error);

            if (supportsThinking) {
                appState.emitThinkingError({
                    operation: 'validation',
                    message: error.message
                });
            }

            dialogManager.showToast(t('toast.validationFailed', { message: error.message }), 'error');
            appState.setValidationStatus('error');
            this.hideLoading();
            this.showValidationHint();
        } finally {
            this.isValidating = false;
            this.setButtonLoading(false);
        }
    }

    /**
     * Validate all pages in batch
     */
    async validateAllPages() {
        const state = appState.getState();
        const pages = state.pages || [];
        const batchTranscriptions = state.batchTranscriptions || [];

        if (pages.length === 0) {
            dialogManager.showToast(t('toast.noPagesToBatch', { operation: 'validate' }), 'warning');
            return;
        }

        // Check if all pages have transcriptions
        const pagesWithTranscription = pages.filter((page, index) => {
            const batchResult = batchTranscriptions.find(r => r.pageIndex === index);
            return batchResult?.success && batchResult?.transcription?.raw;
        });

        if (pagesWithTranscription.length === 0) {
            dialogManager.showToast(t('toast.noTranscriptionsAvailable'), 'warning');
            return;
        }

        // Initialize batch state
        appState.startBatch('validation', pagesWithTranscription.length);
        batchProgress.show('validation', pagesWithTranscription.length);

        this.isValidating = true;
        appState.setValidationStatus('running');
        this.setButtonLoading(true);

        // Get options from dialog checkboxes
        const options = this.getValidationOptions();

        // Save custom prompt to localStorage
        if (options.customPrompt) {
            storage.saveValidationPrompt(options.customPrompt);
        }

        // Override LLM option if no API key
        if (!llmService.hasApiKey()) {
            options.includeLLM = false;
        }

        const results = [];
        let processedCount = 0;

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const batchResult = batchTranscriptions.find(r => r.pageIndex === i);

            // Check for abort request
            if (appState.data.batch.abortRequested) {
                console.log('[Validation] Batch aborted by user');
                break;
            }

            // Skip pages without transcription
            if (!batchResult?.success || !batchResult?.transcription?.raw) {
                results.push({
                    pageId: page.id,
                    pageIndex: i,
                    success: false,
                    error: t('toast.noTranscription')
                });
                continue;
            }

            try {
                // Update progress
                processedCount++;
                batchProgress.update(processedCount, pagesWithTranscription.length, 'validation');

                const text = batchResult.transcription.raw;
                const segments = batchResult.transcription.segments || [];

                // Run validation with options
                const validationResult = await validationEngine.validate(text, segments, options);
                const validationWithPrompt = {
                    ...validationResult,
                    customPrompt: options.customPrompt || ''
                };

                results.push({
                    pageId: page.id,
                    pageIndex: i,
                    success: true,
                    validation: validationWithPrompt
                });

                appState.updateBatchProgress(i, true);

                // Small delay to avoid rate limiting (only if LLM validation)
                if (options.includeLLM && i < pages.length - 1) {
                    await this._delay(500);
                }

            } catch (error) {
                console.error(`Error validating page ${i + 1}:`, error);
                results.push({
                    pageId: page.id,
                    pageIndex: i,
                    success: false,
                    error: error.message
                });

                appState.updateBatchProgress(i, false);

                // If auth error, stop the batch
                if (error.type === 'auth') {
                    dialogManager.showToast(t('toast.invalidApiKeyBatch'), 'error');
                    break;
                }

                // If rate limit, wait longer and continue
                if (error.type === 'rate_limit') {
                    dialogManager.showToast(t('toast.rateLimitWaiting'), 'warning');
                    await this._delay(30000);
                }
            }
        }

        // Store all validation results
        appState.setBatchValidations(results);

        // Complete batch operation
        appState.completeBatch();

        // Set current page validation
        const currentPageResult = results.find(r => r.pageIndex === state.currentPageIndex);
        if (currentPageResult?.success) {
            appState.setValidationResults(currentPageResult.validation);
            this.render(currentPageResult.validation);
        }

        this.isValidating = false;
        this.setButtonLoading(false);

        // Show completion summary
        const { successCount, errorCount, status } = appState.data.batch;
        batchProgress.showComplete(successCount, errorCount, status === 'aborted');

        // Trigger session save for persistence
        try {
            await appState.saveSessionNow();
        } catch (error) {
            console.warn('[Validation] Failed to save batch session:', error.message);
            dialogManager.showToast(t('toast.batchSaveFailed'), 'warning');
        }

        appState.setValidationStatus('complete');
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
        if (!this.panel) return;

        let overlay = getById('validationBatchOverlay');

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'validationBatchOverlay';
            overlay.className = 'validation-loading-overlay';
            this.panel.style.position = 'relative';
            this.panel.appendChild(overlay);
        }

        const percent = Math.round((current / total) * 100);

        overlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <span>${t('dynamic.validating')}</span>
                <span class="loading-hint">${t('dynamic.batchPageProgress', { current, total, percent })}</span>
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
        const overlay = getById('validationBatchOverlay');
        if (overlay) {
            overlay.hidden = true;
        }
    }

    /**
     * Set validate button loading state
     */
    setButtonLoading(loading) {
        if (!this.validateBtn) return;

        const btnText = this.validateBtn.querySelector('.btn-text');
        const btnSpinner = this.validateBtn.querySelector('.btn-spinner');

        if (loading) {
            this.validateBtn.disabled = true;
            this.validateBtn.classList.add('loading');
            if (btnText) btnText.hidden = true;
            if (btnSpinner) btnSpinner.hidden = false;
        } else {
            this.validateBtn.disabled = false;
            this.validateBtn.classList.remove('loading');
            if (btnText) btnText.hidden = false;
            if (btnSpinner) btnSpinner.hidden = true;
        }
    }

    /**
     * Render loading state as overlay (preserves panel structure)
     */
    renderLoading() {
        if (!this.panel) return;

        // Create overlay instead of replacing content
        let overlay = getById('validationLoadingOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'validationLoadingOverlay';
            overlay.className = 'validation-loading-overlay';
            overlay.innerHTML = `
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <span>${t('dynamic.validating')}</span>
                </div>
            `;
            this.panel.style.position = 'relative';
            this.panel.appendChild(overlay);
        }
        overlay.hidden = false;
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        const overlay = getById('validationLoadingOverlay');
        if (overlay) {
            overlay.hidden = true;
        }
    }

    /**
     * Render validation results
     * @param {object} results - Validation results
     */
    render(results) {
        if (!this.panel) return;

        // Update visibility
        this.updateVisibility();
        this.syncIssueApplyState(results.llmJudge);

        // Update issue badge
        const badge = getById('validationBadge');
        if (badge && results.summary) {
            const issueCount = results.summary.totalIssues || 0;
            badge.textContent = t('dynamic.issueCount', { count: issueCount });
            badge.hidden = issueCount === 0;
            badge.style.background = issueCount > 0
                ? 'rgba(var(--warning-rgb), 0.2)'
                : 'rgba(255,255,255,0.1)';
        }

        // Render into separate sections
        setHTML('ruleBasedContent', this.renderRuleCards(results.rules));
        setHTML('llmReviewContent', this.renderLLMCards(results.llmJudge));

        // Bind line click handlers
        this.bindLineClicks();
        this.bindIssueActions();
    }

    /**
     * Render Validation cards (content only)
     */
    renderRuleCards(rules) {
        if (!rules || rules.length === 0) {
            return `<p class="text-secondary text-xs" style="padding: var(--space-2);">${t('dynamic.noValidationIssues')}</p>`;
        }

        return rules.map(rule => this.renderValidationCard(rule)).join('');
    }

    /**
     * Render LLM Review cards - compact style with issue types
     */
    renderLLMCards(llmResult) {
        if (!llmResult) {
            this.syncIssueApplyState(null);
            const hasApiKey = llmService.hasApiKey();
            if (!hasApiKey) {
                return `<p class="text-muted text-xs">${t('dynamic.configureLLMAlt')}</p>`;
            }
            return `<p class="text-muted text-xs">${t('dynamic.runValidationLLM')}</p>`;
        }

        const statusClass = {
            confident: 'status-success',
            certain: 'status-success',
            sure: 'status-success',
            likely: 'status-warning',
            'check-worthy': 'status-warning',
            uncertain: 'status-error',
            problematic: 'status-error'
        }[llmResult.confidence] || 'status-warning';

        const confidenceLabel = {
            confident: t('dynamic.highConfidence'),
            certain: t('dynamic.highConfidence'),
            sure: t('dynamic.highConfidence'),
            likely: t('dynamic.mediumConfidence'),
            'check-worthy': t('dynamic.mediumConfidence'),
            uncertain: t('dynamic.lowConfidence'),
            problematic: t('dynamic.lowConfidence')
        }[llmResult.confidence] || t('dynamic.unknown');

        // Compact summary line
        let html = `
            <div class="validation-item">
                <span class="status-dot ${statusClass}"></span>
                <span class="item-label">${t('dynamic.confidence')}</span>
                <span class="item-value">${confidenceLabel}</span>
            </div>
        `;

        // Show pipeline info if post-processing was used
        if (llmResult.pipeline) {
            const stage2Status = (typeof llmResult.pipeline.stage2 === 'string')
                ? llmResult.pipeline.stage2
                : llmResult.pipeline.stage2?.status;
            const stage3Status = (typeof llmResult.pipeline.stage3 === 'string')
                ? llmResult.pipeline.stage3
                : llmResult.pipeline.stage3?.status;
            const stages = [];
            if (stage2Status === 'success') stages.push(t('dynamic.paleographic'));
            if (stage3Status === 'success') stages.push(t('dynamic.philological'));
            if (stages.length > 0) {
                html += `
                    <div class="validation-item pipeline-notice">
                        <span class="status-dot status-info"></span>
                        <span class="item-label">Pipeline</span>
                        <span class="item-value text-xs">${stages.join(' + ')} ${t('dynamic.review')}</span>
                    </div>
                `;
            }
        }

        // Show fallback notice if a different model was used for validation
        if (llmResult.fallbackUsed) {
            html += `
                <div class="validation-item fallback-notice">
                    <span class="status-dot status-info"></span>
                    <span class="item-label">${t('dynamic.fallback')}</span>
                    <span class="item-value text-xs">${escapeHtml(llmResult.fallbackUsed.name)}</span>
                </div>
            `;
        }

        // Add issues with type badges
        if (llmResult.issues && llmResult.issues.length > 0) {
            const applicableCount = llmResult.issues.filter(issue => !!(issue?.suggestion || '').trim()).length;
            if (applicableCount > 1) {
                html += `
                    <div class="llm-issues-toolbar">
                        <button
                            type="button"
                            class="btn btn-secondary btn-sm llm-apply-all-btn"
                            id="applyAllLlmIssuesBtn"
                            title="${t('dynamic.applyAllTitle')}"
                        >
                            ${t('dynamic.applyAll', { count: applicableCount })}
                        </button>
                    </div>
                `;
            }
            html += llmResult.issues.map((issue, index) => this.renderIssueItem(issue, index)).join('');
        }

        // Show analysis toggle if reasoning exists
        if (llmResult.reasoning) {
            html += `
                <details class="ai-details">
                    <summary>
                        <span class="ai-label">LLM</span>
                        ${t('dynamic.showRationale')}
                    </summary>
                    <div class="ai-reasoning-container">
                        <p class="ai-reasoning">${escapeHtml(llmResult.reasoning)}</p>
                    </div>
                </details>
            `;
        }

        return html;
    }

    /**
     * Render a single issue item with type badge
     * @param {object} issue - Issue from LLM validation
     */
    renderIssueItem(issue, index) {
        // Get issue type info from ISSUE_TYPES
        const typeInfo = ISSUE_TYPES[issue.type] || {
            name: issue.type || 'Note',
            color: 'warning',
            description: ''
        };
        const applyState = this.llmIssueApplyState.get(index) || null;
        const issueClass = applyState?.status ? ` ${applyState.status}` : '';
        const sourceText = issue.text || '';
        const suggestion = issue.suggestion || '';
        const hasSuggestion = suggestion.trim().length > 0;
        const isMultilineSuggestion = suggestion.includes('\n');

        // Build issue HTML
        return `
            <div
                class="validation-issue issue-${typeInfo.color}${issueClass}"
                ${issue.line ? `data-line="${issue.line}"` : ''}
                data-issue-index="${index}"
                data-source-text="${escapeHtml(sourceText)}"
                data-suggestion="${escapeHtml(suggestion)}"
            >
                <div class="issue-header">
                    <span class="issue-type-badge badge-${typeInfo.color}" title="${escapeHtml(typeInfo.description || '')}">${escapeHtml(typeInfo.name)}</span>
                    ${issue.stage ? `<span class="issue-stage-badge stage-${escapeHtml(issue.stage)}">${escapeHtml(issue.stage)}</span>` : ''}
                    ${issue.line ? `<span class="issue-line">Line ${issue.line}</span>` : ''}
                </div>
                <div class="issue-content">
                    <span class="issue-text">${escapeHtml(issue.text || '')}</span>
                    ${issue.suggestion ? `<span class="issue-suggestion">&rarr; ${escapeHtml(issue.suggestion)}</span>` : ''}
                </div>
                ${issue.explanation ? `<p class="issue-explanation">${escapeHtml(issue.explanation)}</p>` : ''}
                ${hasSuggestion ? `
                    <div class="issue-actions">
                        ${isMultilineSuggestion
                            ? `<span class="issue-apply-status ${applyState ? `status-${applyState.status}` : 'status-ambiguous'} issue-manual-note">${escapeHtml(applyState?.message || t('dynamic.multilineSuggestion'))}</span>`
                            : `
                                <button
                                    type="button"
                                    class="btn btn-secondary btn-sm issue-apply-btn"
                                    data-issue-index="${index}"
                                    ${applyState?.status === 'applied' ? 'disabled' : ''}
                                >
                                    ${t('dynamic.apply')}
                                </button>
                                ${applyState ? `<span class="issue-apply-status status-${applyState.status}">${escapeHtml(applyState.message || applyState.status)}</span>` : ''}
                            `
                        }
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render a single validation card - compact inline style
     */
    renderValidationCard(rule) {
        const statusClass = {
            success: 'status-success',
            warning: 'status-warning',
            error: 'status-error',
            info: 'status-info'
        }[rule.type] || 'status-info';

        return `
            <div class="validation-item" ${rule.lines.length > 0 ? `data-line="${rule.lines[0]}"` : ''}>
                <span class="status-dot ${statusClass}"></span>
                <span class="item-label">${rule.name}</span>
                <span class="item-value">${rule.message}</span>
            </div>
        `;
    }

    /**
     * Keep per-issue apply status while the same LLM result is displayed.
     * Reset the status map when a new LLM result arrives.
     * @param {object|null} llmResult
     */
    syncIssueApplyState(llmResult) {
        const signature = this.getIssueStateSignature(llmResult);
        if (signature !== this.llmIssueStateSignature) {
            this.llmIssueApplyState.clear();
            this.llmIssueStateSignature = signature;
        }
    }

    /**
     * Build a stable signature for the current LLM issues.
     * @param {object|null} llmResult
     * @returns {string}
     */
    getIssueStateSignature(llmResult) {
        if (!llmResult?.issues?.length) return '';
        return llmResult.issues.map(issue => [
            issue.line || '',
            issue.type || '',
            issue.text || '',
            issue.suggestion || '',
            issue.explanation || ''
        ].join('|')).join('||');
    }

    /**
     * Bind click handlers for LLM issue action buttons.
     */
    bindIssueActions() {
        selectAll('.issue-apply-btn', this.panel).forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const issueIndex = Number.parseInt(btn.dataset.issueIndex, 10);
                this.applyIssueCorrection(issueIndex);
            });
        });

        const applyAllBtn = getById('applyAllLlmIssuesBtn');
        if (applyAllBtn) {
            applyAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.applyAllIssueCorrections();
            });
        }
    }

    /**
     * Apply one LLM issue suggestion into the editor.
     * @param {number} issueIndex
     * @param {object} [options]
     * @param {boolean} [options.silent=false]
     * @returns {{status: 'applied'|'ambiguous'|'failed', message: string}}
     */
    applyIssueCorrection(issueIndex, options = {}) {
        const { silent = false } = options;
        const issue = appState.getState()?.validation?.llmJudge?.issues?.[issueIndex];
        const issueElement = this.panel?.querySelector(`.validation-issue[data-issue-index="${issueIndex}"]`);

        if (!issue) {
            const result = { status: 'failed', message: 'Issue not found.' };
            this.updateIssueApplyState(issueIndex, result, issueElement);
            if (!silent) dialogManager.showToast(result.message, 'error');
            return result;
        }

        const suggestion = (issue.suggestion || '').trim();
        if (!suggestion) {
            const result = { status: 'failed', message: 'No suggestion available for this issue.' };
            this.updateIssueApplyState(issueIndex, result, issueElement);
            if (!silent) dialogManager.showToast(result.message, 'warning');
            return result;
        }
        if (suggestion.includes('\n')) {
            const result = { status: 'failed', message: t('dynamic.multilineSuggestion') };
            this.updateIssueApplyState(issueIndex, result, issueElement);
            if (!silent) dialogManager.showToast(result.message, 'warning');
            return result;
        }

        const result = applySuggestionAtLine({
            line: issue.line,
            sourceText: issue.text || '',
            suggestion
        });

        this.updateIssueApplyState(issueIndex, result, issueElement);

        const selectedLine = Number(result.line || issue.line);
        if (result.status !== 'failed' && Number.isFinite(selectedLine) && selectedLine > 0) {
            appState.setSelection(selectedLine);
        }

        if (!silent) {
            const toastType = {
                applied: 'success',
                ambiguous: 'warning',
                failed: 'error'
            }[result.status] || 'warning';
            dialogManager.showToast(result.message, toastType);
        }

        return result;
    }

    /**
     * Apply all issues that include a textual suggestion.
     */
    applyAllIssueCorrections() {
        const issues = appState.getState()?.validation?.llmJudge?.issues || [];
        if (issues.length === 0) {
            dialogManager.showToast(t('dynamic.noLlmIssues'), 'warning');
            return;
        }

        const summary = { applied: 0, ambiguous: 0, failed: 0 };
        let multilineSkipped = 0;

        // Apply from bottom to top to reduce line-shift side effects.
        const sortedTargets = issues
            .map((issue, index) => ({ issue, index }))
            .filter(({ issue }) => !!(issue?.suggestion || '').trim())
            .sort((a, b) => {
                const aLine = Number.isFinite(Number(a.issue?.line)) ? Number(a.issue.line) : 0;
                const bLine = Number.isFinite(Number(b.issue?.line)) ? Number(b.issue.line) : 0;
                if (bLine !== aLine) return bLine - aLine;
                return b.index - a.index;
            });

        sortedTargets.forEach(({ issue, index }) => {
            const suggestion = issue?.suggestion || '';
            if (suggestion.includes('\n')) {
                multilineSkipped++;
                const result = {
                    status: 'failed',
                    message: t('dynamic.multilineSkipped')
                };
                const issueElement = this.panel?.querySelector(`.validation-issue[data-issue-index="${index}"]`);
                this.updateIssueApplyState(index, result, issueElement);
                summary.failed++;
                return;
            }

            const result = this.applyIssueCorrection(index, { silent: true });
            summary[result.status] = (summary[result.status] || 0) + 1;
        });

        const multilineInfo = multilineSkipped > 0
            ? t('dynamic.multilineSkippedInfo', { count: multilineSkipped })
            : '';
        const message = t('dynamic.applyAllResult', { applied: summary.applied, ambiguous: summary.ambiguous, failed: summary.failed, multilineInfo });

        dialogManager.showToast(message, summary.failed > 0 ? 'warning' : 'success');
    }

    /**
     * Store and render apply status on an issue item.
     * @param {number} issueIndex
     * @param {{status:string, message:string}} result
     * @param {HTMLElement|null} issueElement
     */
    updateIssueApplyState(issueIndex, result, issueElement) {
        this.llmIssueApplyState.set(issueIndex, result);
        if (!issueElement) return;

        issueElement.classList.remove('applied', 'ambiguous', 'failed');
        issueElement.classList.add(result.status);

        const statusEl = issueElement.querySelector('.issue-apply-status');
        if (statusEl) {
            statusEl.textContent = result.message;
            statusEl.className = `issue-apply-status status-${result.status}`;
        }

        const applyBtn = issueElement.querySelector('.issue-apply-btn');
        if (applyBtn) {
            applyBtn.disabled = result.status === 'applied';
        }
    }

    /**
     * Bind click handlers for line navigation
     * Handles legacy .validation-card, compact .validation-item, and new .validation-issue elements
     */
    bindLineClicks() {
        // Select card, item, and issue elements with data-line attribute
        const selector = '.validation-card[data-line], .validation-item[data-line], .validation-issue[data-line]';
        selectAll(selector, this.panel).forEach(element => {
            element.style.cursor = 'pointer';
            element.addEventListener('click', (e) => {
                // Don't navigate if clicking on details toggle
                if (e.target.classList.contains('details-toggle')) return;
                if (e.target.closest('.issue-actions')) return;
                if (e.target.closest('.llm-issues-toolbar')) return;

                const line = parseInt(element.dataset.line, 10);
                if (!isNaN(line)) {
                    appState.setSelection(line);
                }
            });
        });
    }
}

// Export singleton instance
export const validationPanel = new ValidationPanel();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        validationPanel.init();
    });
} else {
    validationPanel.init();
}
