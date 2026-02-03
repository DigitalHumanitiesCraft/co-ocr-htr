/**
 * Validation Panel Component
 *
 * Renders validation results in the right panel:
 * - Rule-based validation results
 * - LLM-Judge results with perspective switching
 * - Clickable line references for navigation
 *
 * Display Logic:
 * - Shows empty state when no transcription exists
 * - Shows validation results when transcription is available
 * - Both Rule-Based and AI sections always visible (compact)
 */

import { validationEngine } from '../services/validation.js';
import { llmService } from '../services/llm.js';
import { appState } from '../state.js';
import { dialogManager } from './dialogs.js';
import { getById, show, hide, select, selectAll, setText, setHTML } from '../utils/dom.js';
import { MENU_CLOSE_DELAY } from '../utils/constants.js';
import { getConfidenceLabel, getStatusClass } from '../utils/textFormatting.js';

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
        this.currentPerspective = 'paleographic';
        this.validateDialog = null;
        this.startValidationBtn = null;
    }

    /**
     * Initialize validation panel
     */
    init() {
        // Find panel elements
        this.panel = getById('validationContent');
        this.emptyState = getById('validationEmptyState');
        this.ruleSection = getById('ruleBasedSection');
        this.aiSection = getById('aiAssistantSection');

        if (!this.panel) {
            console.warn('Validation panel not found');
            return;
        }

        // Get dialog elements
        this.validateDialog = getById('validateDialog');
        this.startValidationBtn = getById('startValidation');

        this.bindEvents();
        this.setupPerspectiveDropdown();

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
        const panelContent = this.panel;

        if (!hasDocument) {
            // No document: hide all content, show minimal state
            if (this.emptyState) {
                this.emptyState.hidden = false;
                setText(select('h4', this.emptyState), 'No Document');
                setText(select('p', this.emptyState), 'Load a document to enable validation.');
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
                setText(select('h4', this.emptyState), 'No Validation Yet');
                setText(select('p', this.emptyState), 'Run transcription to see validation results.');
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
            this.updateValidateButton(false);
        });

        // Listen for page changes (multi-page support) - load saved validation or clear
        appState.addEventListener('pageChanged', () => {
            this.updateVisibility();
            this.loadPageValidation();
        });

        // Listen for validation state changes
        appState.addEventListener('validationComplete', (e) => {
            this.render(e.detail);
        });

        // Perspective dropdown in status bar
        const perspectiveLabel = document.querySelector('.status-bar span:nth-child(2)');
        if (perspectiveLabel) {
            perspectiveLabel.style.cursor = 'pointer';
            perspectiveLabel.addEventListener('click', () => this.showPerspectiveMenu());
        }

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
            dialogManager.showToast('Bitte zuerst transkribieren', 'warning');
            return;
        }

        // Update page selection UI
        this.updatePageSelectionUI();

        // Update LLM mode hint
        this.updateLLMModeHint();

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
                pageCountEl.textContent = `Seite ${currentPage} von ${totalPages}`;
            }

            if (allPagesHintEl) {
                allPagesHintEl.textContent = `${totalPages} Seiten, kann mehrere Minuten dauern`;
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

        if (!llmModeHint) return;

        const hasApiKey = llmService.hasApiKey();

        if (hasApiKey) {
            llmModeHint.textContent = 'API-Call pro Seite';
            if (llmModeItem) llmModeItem.classList.remove('disabled');
        } else {
            llmModeHint.textContent = 'API-Key erforderlich';
            if (llmModeItem) llmModeItem.classList.add('disabled');
        }
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
     * Show validation available hint in panel
     */
    showValidationHint() {
        setHTML('ruleBasedContent', '<p class="text-secondary text-xs" style="padding: var(--space-2);">Click "Validate" to run rule-based checks.</p>');
        setHTML('aiAssistantContent', '<p class="text-secondary text-xs" style="padding: var(--space-2);">Click "Validate" for AI-powered analysis.</p>');
    }

    /**
     * Clear validation results (e.g., when loading new document)
     */
    clearValidation() {
        setHTML('ruleBasedContent', '<p class="text-secondary text-xs" style="padding: var(--space-2);">Run transcription to see rule-based checks.</p>');
        setHTML('aiAssistantContent', '<p class="text-secondary text-xs" style="padding: var(--space-2);">Configure API key for AI-powered analysis.</p>');

        // Update badge
        const badge = getById('validationBadge');
        if (badge) {
            badge.textContent = '0 Issues';
            badge.hidden = true;
        }
    }

    /**
     * Setup perspective dropdown in status bar
     */
    setupPerspectiveDropdown() {
        const perspectives = validationEngine.getPerspectives();
        const current = perspectives.find(p => p.id === this.currentPerspective);

        // Update status bar display
        const perspectiveEl = select('.status-bar span:nth-child(2) span');
        if (perspectiveEl && current) {
            perspectiveEl.textContent = current.name;
        }
    }

    /**
     * Show perspective selection menu
     */
    showPerspectiveMenu() {
        const perspectives = validationEngine.getPerspectives();

        // Create dropdown menu
        let menu = getById('perspectiveMenu');
        if (menu) {
            menu.remove();
            return; // Toggle off
        }

        menu = document.createElement('div');
        menu.id = 'perspectiveMenu';
        menu.className = 'dropdown-menu';
        menu.innerHTML = perspectives.map(p => `
            <button class="dropdown-item ${p.id === this.currentPerspective ? 'active' : ''}"
                    data-perspective="${p.id}">
                <span class="item-name">${p.name}</span>
                <span class="item-desc">${p.description}</span>
            </button>
        `).join('');

        // Position menu
        const trigger = select('.status-bar span:nth-child(2)');
        if (trigger) {
            const rect = trigger.getBoundingClientRect();
            menu.style.position = 'fixed';
            menu.style.bottom = `${window.innerHeight - rect.top + 8}px`;
            menu.style.left = `${rect.left}px`;
        }

        document.body.appendChild(menu);

        // Handle selection
        menu.addEventListener('click', (e) => {
            const item = e.target.closest('.dropdown-item');
            if (item) {
                this.currentPerspective = item.dataset.perspective;
                this.setupPerspectiveDropdown();
                menu.remove();

                // Re-run LLM validation with new perspective
                this.runValidation(true);
            }
        });

        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, MENU_CLOSE_DELAY);
    }

    /**
     * Run validation on current transcription
     * @param {boolean} llmOnly - Only run LLM validation (skip rules)
     */
    async runValidation(llmOnly = false) {
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

        try {
            const includeLLM = llmService.hasApiKey();
            const results = await validationEngine.validate(
                text,
                segments,
                this.currentPerspective,
                includeLLM
            );

            // Update state
            appState.setValidationResults(results);
            this.hideLoading();
            this.render(results);

            dialogManager.showToast('Validierung abgeschlossen', 'success');

        } catch (error) {
            console.error('Validation error:', error);
            dialogManager.showToast(`Validierung fehlgeschlagen: ${error.message}`, 'error');
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
            dialogManager.showToast('Keine Seiten zum Validieren', 'warning');
            return;
        }

        // Check if all pages have transcriptions
        const pagesWithTranscription = pages.filter((page, index) => {
            const batchResult = batchTranscriptions.find(r => r.pageIndex === index);
            return batchResult?.success && batchResult?.transcription?.raw;
        });

        if (pagesWithTranscription.length === 0) {
            dialogManager.showToast('Keine Transkriptionen vorhanden. Bitte erst alle Seiten transkribieren.', 'warning');
            return;
        }

        this.isValidating = true;
        appState.setValidationStatus('running');
        this.setButtonLoading(true);
        this.showBatchProgress(0, pagesWithTranscription.length);

        const results = [];
        let successCount = 0;
        let errorCount = 0;
        const includeLLM = llmService.hasApiKey();

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const batchResult = batchTranscriptions.find(r => r.pageIndex === i);

            // Skip pages without transcription
            if (!batchResult?.success || !batchResult?.transcription?.raw) {
                results.push({
                    pageId: page.id,
                    pageIndex: i,
                    success: false,
                    error: 'Keine Transkription vorhanden'
                });
                continue;
            }

            try {
                // Update progress
                this.showBatchProgress(successCount + errorCount + 1, pagesWithTranscription.length, page.filename);

                const text = batchResult.transcription.raw;
                const segments = batchResult.transcription.segments || [];

                // Run validation
                const validationResult = await validationEngine.validate(
                    text,
                    segments,
                    this.currentPerspective,
                    includeLLM
                );

                results.push({
                    pageId: page.id,
                    pageIndex: i,
                    success: true,
                    validation: validationResult
                });

                successCount++;

                // Small delay to avoid rate limiting (only if LLM validation)
                if (includeLLM && i < pages.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

            } catch (error) {
                console.error(`Error validating page ${i + 1}:`, error);
                results.push({
                    pageId: page.id,
                    pageIndex: i,
                    success: false,
                    error: error.message
                });
                errorCount++;

                // If auth error, stop the batch
                if (error.type === 'auth') {
                    dialogManager.showToast('API-Key ungültig. Batch abgebrochen.', 'error');
                    break;
                }

                // If rate limit, wait longer and continue
                if (error.type === 'rate_limit') {
                    dialogManager.showToast('Rate-Limit erreicht. Warte 30 Sekunden...', 'warning');
                    await new Promise(resolve => setTimeout(resolve, 30000));
                }
            }
        }

        // Store all validation results
        appState.setBatchValidations(results);

        // Set current page validation
        const currentPageResult = results.find(r => r.pageIndex === state.currentPageIndex);
        if (currentPageResult?.success) {
            appState.setValidationResults(currentPageResult.validation);
            this.render(currentPageResult.validation);
        }

        this.isValidating = false;
        this.setButtonLoading(false);
        this.hideBatchProgress();

        // Trigger session save for persistence
        appState.saveSessionNow();

        // Show summary with save confirmation
        if (errorCount === 0) {
            dialogManager.showToast(`Alle ${successCount} Seiten validiert (automatisch gespeichert)`, 'success');
        } else {
            dialogManager.showToast(`${successCount} erfolgreich, ${errorCount} fehlgeschlagen`, 'warning');
        }

        appState.setValidationStatus('complete');
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
                <span>Validierung läuft...</span>
                <span class="loading-hint">Seite ${current} von ${total} (${percent}%)</span>
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
                    <span>Validierung läuft...</span>
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

        // Update issue badge
        const badge = getById('validationBadge');
        if (badge && results.summary) {
            const issueCount = results.summary.totalIssues || 0;
            badge.textContent = `${issueCount} Issues`;
            badge.hidden = issueCount === 0;
            badge.style.background = issueCount > 0
                ? 'rgba(var(--warning-rgb), 0.2)'
                : 'rgba(255,255,255,0.1)';
        }

        // Render into separate sections
        setHTML('ruleBasedContent', this.renderRuleCards(results.rules));
        setHTML('aiAssistantContent', this.renderLLMCards(results.llmJudge));

        // Bind line click handlers
        this.bindLineClicks();
    }

    /**
     * Render rule-based validation cards (content only)
     */
    renderRuleCards(rules) {
        if (!rules || rules.length === 0) {
            return '<p class="text-secondary text-xs" style="padding: var(--space-2);">No rule-based issues found.</p>';
        }

        return rules.map(rule => this.renderValidationCard(rule)).join('');
    }

    /**
     * Render rule-based validation section (legacy, kept for compatibility)
     */
    renderRuleSection(rules) {
        if (!rules || rules.length === 0) {
            return '';
        }

        const cards = rules.map(rule => this.renderValidationCard(rule)).join('');

        return `
            <div class="validation-section">
                <div class="section-title">
                    <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                    Rule-Based
                </div>
                ${cards}
            </div>
        `;
    }

    /**
     * Render LLM-Judge validation cards - compact style
     */
    renderLLMCards(llmResult) {
        if (!llmResult) {
            const hasApiKey = llmService.hasApiKey();
            if (!hasApiKey) {
                return `<p class="text-muted text-xs">API-Key fuer KI-Analyse konfigurieren</p>`;
            }
            return `<p class="text-muted text-xs">Validierung starten fuer KI-Analyse</p>`;
        }

        const statusClass = {
            certain: 'status-success',
            likely: 'status-warning',
            uncertain: 'status-error'
        }[llmResult.confidence] || 'status-warning';

        const confidenceLabel = {
            certain: 'Hohe Konfidenz',
            likely: 'Mittlere Konfidenz',
            uncertain: 'Niedrige Konfidenz'
        }[llmResult.confidence] || 'Unbekannt';

        const perspective = validationEngine.getPerspectives()
            .find(p => p.id === llmResult.perspective);

        // Compact summary line
        let html = `
            <div class="validation-item">
                <span class="status-dot ${statusClass}"></span>
                <span class="item-label">Konfidenz</span>
                <span class="item-value">${confidenceLabel}</span>
            </div>
            <div class="validation-item">
                <span class="status-dot status-info"></span>
                <span class="item-label">Perspektive</span>
                <span class="item-value">${perspective?.name || llmResult.perspective}</span>
            </div>
        `;

        // Add issues as compact items
        if (llmResult.issues && llmResult.issues.length > 0) {
            html += llmResult.issues.map(issue => `
                <div class="validation-item" ${issue.line ? `data-line="${issue.line}"` : ''}>
                    <span class="status-dot status-warning"></span>
                    <span class="item-label">${issue.line ? `Zeile ${issue.line}` : 'Hinweis'}</span>
                    <span class="item-value" title="${issue.suggestion || ''}">${issue.text || 'Issue'}</span>
                </div>
            `).join('');
        }

        // Show analysis toggle if reasoning exists
        if (llmResult.reasoning) {
            html += `
                <details class="ai-details">
                    <summary>
                        <span class="ai-label">KI</span>
                        Analyse anzeigen
                    </summary>
                    <div class="ai-reasoning-container">
                        <p class="ai-reasoning">${llmResult.reasoning}</p>
                    </div>
                </details>
            `;
        }

        return html;
    }

    /**
     * Render LLM-Judge validation section (legacy, kept for compatibility)
     */
    renderLLMSection(llmResult) {
        if (!llmResult) {
            return `
                <div class="validation-section">
                    <div class="section-title">
                        <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"></path>
                        </svg>
                        AI Assistant
                    </div>
                    <div class="validation-card" style="opacity: 0.6;">
                        <div class="card-header">
                            <div class="status-indicator" style="background: var(--text-muted);"></div>
                            <span class="card-title">Not configured</span>
                        </div>
                        <div class="card-lines">Configure API key to enable AI validation</div>
                    </div>
                </div>
            `;
        }

        const statusClass = {
            certain: 'status-success',
            likely: 'status-warning',
            uncertain: 'status-error'
        }[llmResult.confidence] || 'status-warning';

        const confidenceLabel = {
            certain: 'High Confidence',
            likely: 'Medium Confidence',
            uncertain: 'Low Confidence'
        }[llmResult.confidence] || 'Unknown';

        const perspective = validationEngine.getPerspectives()
            .find(p => p.id === llmResult.perspective);

        let issueCards = '';
        if (llmResult.issues && llmResult.issues.length > 0) {
            issueCards = llmResult.issues.map(issue => `
                <div class="validation-card" data-line="${issue.line || ''}">
                    <div class="card-header">
                        <div class="status-indicator status-warning"></div>
                        <span class="card-title">${issue.text || 'Issue'}</span>
                    </div>
                    ${issue.line ? `<div class="card-lines">Line ${issue.line}</div>` : ''}
                    ${issue.suggestion ? `
                        <div class="card-details expanded">
                            Suggestion: ${issue.suggestion}
                        </div>
                    ` : ''}
                </div>
            `).join('');
        }

        return `
            <div class="validation-section">
                <div class="section-title">
                    <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"></path>
                    </svg>
                    AI Assistant
                    <span class="perspective-badge">${perspective?.name || llmResult.perspective}</span>
                </div>
                <div class="validation-card">
                    <div class="card-header">
                        <div class="status-indicator ${statusClass}"></div>
                        <span class="card-title">${confidenceLabel}</span>
                    </div>
                    <div class="card-lines">${perspective?.description || 'Overall assessment'}</div>
                    ${llmResult.reasoning ? `
                        <div class="details-toggle" onclick="this.nextElementSibling.classList.toggle('expanded')">
                            Show Analysis
                        </div>
                        <div class="card-details">
                            ${llmResult.reasoning}
                        </div>
                    ` : ''}
                </div>
                ${issueCards}
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
     * Bind click handlers for line navigation
     * Handles both legacy .validation-card and new compact .validation-item elements
     */
    bindLineClicks() {
        // Select both card and item elements with data-line attribute
        const selector = '.validation-card[data-line], .validation-item[data-line]';
        selectAll(selector, this.panel).forEach(element => {
            element.style.cursor = 'pointer';
            element.addEventListener('click', (e) => {
                // Don't navigate if clicking on details toggle
                if (e.target.classList.contains('details-toggle')) return;

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
