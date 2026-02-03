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
        // Validate button in editor panel
        this.validateBtn = getById('btnValidate');
        if (this.validateBtn) {
            this.validateBtn.addEventListener('click', () => this.handleValidateClick());
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

        // Listen for page changes (multi-page support)
        appState.addEventListener('pageChanged', () => {
            this.updateVisibility();
            this.clearValidation();
            this.updateValidateButton(false);
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
     * Handle validate button click
     */
    handleValidateClick() {
        if (this.isValidating) return;
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
                    <summary>Analyse anzeigen</summary>
                    <p class="ai-reasoning">${llmResult.reasoning}</p>
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
     */
    bindLineClicks() {
        selectAll('.validation-card[data-line]', this.panel).forEach(card => {
            card.style.cursor = 'pointer';
            card.addEventListener('click', (e) => {
                // Don't navigate if clicking on details toggle
                if (e.target.classList.contains('details-toggle')) return;

                const line = parseInt(card.dataset.line, 10);
                if (!isNaN(line)) {
                    appState.setSelection(line);
                }
            });
        });
    }
}

// Add component-specific styles
const validationStyles = `
.validation-loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(var(--bg-primary-rgb, 26, 27, 30), 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    backdrop-filter: blur(2px);
    transition: opacity 0.2s ease-out;
}

.validation-loading-overlay[hidden] {
    opacity: 0;
    pointer-events: none;
}

.validation-loading-overlay .loading-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    color: var(--text-primary);
}

.validation-loading-overlay .loading-content span {
    font-size: var(--text-sm);
}

.validation-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-8);
    color: var(--text-secondary);
    gap: var(--space-3);
}

.validation-section {
    margin-bottom: var(--space-4);
}

.section-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px solid rgba(255,255,255,0.05);
}

.perspective-badge {
    margin-left: auto;
    padding: 2px 8px;
    background: rgba(var(--accent-rgb), 0.2);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    color: var(--accent-primary);
}

/* Compact validation items */
.validation-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) 0;
    font-size: var(--text-xs);
    border-bottom: 1px solid rgba(255,255,255,0.03);
}

.validation-item:last-child {
    border-bottom: none;
}

.validation-item[data-line] {
    cursor: pointer;
}

.validation-item[data-line]:hover {
    background: rgba(255,255,255,0.03);
    margin: 0 calc(-1 * var(--space-2));
    padding-left: var(--space-2);
    padding-right: var(--space-2);
}

.status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
}

.status-dot.status-success { background: var(--confident); }
.status-dot.status-warning { background: var(--uncertain); }
.status-dot.status-error { background: var(--problematic); }
.status-dot.status-info { background: var(--accent-primary); }

.item-label {
    color: var(--text-secondary);
    min-width: 90px;
    flex-shrink: 0;
}

.item-value {
    color: var(--text-primary);
    margin-left: auto;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 150px;
}

/* Legacy card styles for AI section */
.validation-card {
    background: rgba(255,255,255,0.03);
    border-radius: var(--radius-sm);
    padding: var(--space-2);
    margin-bottom: var(--space-1);
}

.validation-card:hover {
    background: rgba(255,255,255,0.05);
}

.card-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
}

.card-title {
    font-weight: 500;
    font-size: var(--text-sm);
}

.card-lines {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    margin-top: var(--space-1);
    padding-left: calc(6px + var(--space-2));
}

.details-toggle {
    font-size: var(--text-xs);
    color: var(--accent-primary);
    cursor: pointer;
    margin-top: var(--space-2);
    padding-left: calc(8px + var(--space-2));
}

.details-toggle:hover {
    text-decoration: underline;
}

.card-details {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    margin-top: var(--space-2);
    padding: var(--space-2);
    background: rgba(0,0,0,0.2);
    border-radius: var(--radius-sm);
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.2s, padding 0.2s;
}

.card-details.expanded {
    max-height: 200px;
    overflow-y: auto;
}

.dropdown-menu {
    background: var(--bg-secondary);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: var(--radius-md);
    padding: var(--space-1);
    min-width: 200px;
    z-index: 1000;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}

.dropdown-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: none;
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
    border-radius: var(--radius-sm);
    text-align: left;
}

.dropdown-item:hover {
    background: rgba(255,255,255,0.05);
}

.dropdown-item.active {
    background: rgba(var(--accent-rgb), 0.2);
}

.dropdown-item .item-name {
    font-weight: 500;
    font-size: var(--text-sm);
}

.dropdown-item .item-desc {
    font-size: var(--text-xs);
    color: var(--text-secondary);
}

/* AI Analysis details */
.ai-details {
    margin-top: var(--space-2);
    font-size: var(--text-xs);
}

.ai-details summary {
    color: var(--accent-primary);
    cursor: pointer;
    padding: var(--space-1) 0;
}

.ai-details summary:hover {
    text-decoration: underline;
}

.ai-reasoning {
    margin-top: var(--space-1);
    padding: var(--space-2);
    background: rgba(0,0,0,0.2);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    line-height: 1.5;
    max-height: 150px;
    overflow-y: auto;
}

.text-muted {
    color: var(--text-muted);
    padding: var(--space-1) 0;
}
`;

// Inject styles
function injectStyles() {
    if (document.getElementById('validationPanelStyles')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'validationPanelStyles';
    styleEl.textContent = validationStyles;
    document.head.appendChild(styleEl);
}

// Export singleton instance
export const validationPanel = new ValidationPanel();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        injectStyles();
        validationPanel.init();
    });
} else {
    injectStyles();
    validationPanel.init();
}
