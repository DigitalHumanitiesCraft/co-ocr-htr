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
        this.panel = document.getElementById('validationContent');
        this.emptyState = document.getElementById('validationEmptyState');
        this.ruleSection = document.getElementById('ruleBasedSection');
        this.aiSection = document.getElementById('aiAssistantSection');

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
        const hasDocument = state.pages?.length > 0 || state.imageData;
        const hasTranscription = state.transcription?.segments?.length > 0 ||
                                  state.transcription?.lines?.length > 0;

        // Get the main panel container
        const panelContent = this.panel;

        if (!hasDocument) {
            // No document: hide all content, show minimal state
            if (this.emptyState) {
                this.emptyState.style.display = 'flex';
                this.emptyState.querySelector('h4').textContent = 'No Document';
                this.emptyState.querySelector('p').textContent = 'Load a document to enable validation.';
            }
            if (this.ruleSection) this.ruleSection.style.display = 'none';
            if (this.aiSection) this.aiSection.style.display = 'none';
        } else if (hasTranscription) {
            // Document + transcription: show validation sections
            if (this.emptyState) this.emptyState.style.display = 'none';
            if (this.ruleSection) this.ruleSection.style.display = 'block';
            if (this.aiSection) this.aiSection.style.display = 'block';
        } else {
            // Document but no transcription: show empty state with hint
            if (this.emptyState) {
                this.emptyState.style.display = 'flex';
                this.emptyState.querySelector('h4').textContent = 'No Validation Yet';
                this.emptyState.querySelector('p').textContent = 'Run transcription to see validation results.';
            }
            if (this.ruleSection) this.ruleSection.style.display = 'none';
            if (this.aiSection) this.aiSection.style.display = 'none';
        }
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Listen for transcription completion to trigger validation
        appState.addEventListener('transcriptionComplete', () => {
            this.updateVisibility();
            this.runValidation();
        });

        // Listen for document load (reset validation)
        appState.addEventListener('documentLoaded', () => {
            this.updateVisibility();
            this.clearValidation();
        });

        // Listen for page changes (multi-page support)
        appState.addEventListener('pageChanged', () => {
            this.updateVisibility();
            this.clearValidation();
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
    }

    /**
     * Clear validation results (e.g., when loading new document)
     */
    clearValidation() {
        const ruleContent = document.getElementById('ruleBasedContent');
        const aiContent = document.getElementById('aiAssistantContent');

        if (ruleContent) ruleContent.innerHTML = '<p class="text-secondary" style="font-size: var(--text-xs); padding: var(--space-2);">Run transcription to see rule-based checks.</p>';
        if (aiContent) aiContent.innerHTML = '<p class="text-secondary" style="font-size: var(--text-xs); padding: var(--space-2);">Configure API key for AI-powered analysis.</p>';

        // Update badge
        const badge = document.getElementById('validationBadge');
        if (badge) {
            badge.textContent = '0 Issues';
            badge.style.display = 'none';
        }
    }

    /**
     * Setup perspective dropdown in status bar
     */
    setupPerspectiveDropdown() {
        const perspectives = validationEngine.getPerspectives();
        const current = perspectives.find(p => p.id === this.currentPerspective);

        // Update status bar display
        const perspectiveEl = document.querySelector('.status-bar span:nth-child(2) span');
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
        let menu = document.getElementById('perspectiveMenu');
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
        const trigger = document.querySelector('.status-bar span:nth-child(2)');
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
        }, 0);
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

        // Show loading state
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
            this.render(results);

        } catch (error) {
            console.error('Validation error:', error);
            dialogManager.showToast(`Validation failed: ${error.message}`, 'error');
            appState.setValidationStatus('error');
        } finally {
            this.isValidating = false;
        }
    }

    /**
     * Render loading state
     */
    renderLoading() {
        if (!this.panel) return;

        this.panel.innerHTML = `
            <div class="validation-loading">
                <div class="loading-spinner"></div>
                <span>Validating transcription...</span>
            </div>
        `;
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
        const badge = document.getElementById('validationBadge');
        if (badge && results.summary) {
            const issueCount = results.summary.totalIssues || 0;
            badge.textContent = `${issueCount} Issues`;
            badge.style.display = issueCount > 0 ? 'inline' : 'none';
            badge.style.background = issueCount > 0
                ? 'rgba(var(--warning-rgb), 0.2)'
                : 'rgba(255,255,255,0.1)';
        }

        // Render into separate sections
        const ruleContent = document.getElementById('ruleBasedContent');
        const aiContent = document.getElementById('aiAssistantContent');

        if (ruleContent) {
            ruleContent.innerHTML = this.renderRuleCards(results.rules);
        }

        if (aiContent) {
            aiContent.innerHTML = this.renderLLMCards(results.llmJudge);
        }

        // Bind line click handlers
        this.bindLineClicks();
    }

    /**
     * Render rule-based validation cards (content only)
     */
    renderRuleCards(rules) {
        if (!rules || rules.length === 0) {
            return '<p class="text-secondary" style="font-size: var(--text-xs); padding: var(--space-2);">No rule-based issues found.</p>';
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
     * Render LLM-Judge validation cards (content only)
     */
    renderLLMCards(llmResult) {
        if (!llmResult) {
            const hasApiKey = llmService.hasApiKey();
            if (!hasApiKey) {
                return `
                    <div class="validation-card" style="opacity: 0.6;">
                        <div class="card-header">
                            <div class="status-indicator" style="background: var(--text-muted);"></div>
                            <span class="card-title">Not configured</span>
                        </div>
                        <div class="card-lines">Configure API key to enable AI validation</div>
                    </div>
                `;
            }
            return '<p class="text-secondary" style="font-size: var(--text-xs); padding: var(--space-2);">AI analysis will run after transcription.</p>';
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

        let html = `
            <div class="validation-card">
                <div class="card-header">
                    <div class="status-indicator ${statusClass}"></div>
                    <span class="card-title">${confidenceLabel}</span>
                    <span class="perspective-badge" style="margin-left: auto; padding: 2px 8px; background: rgba(var(--accent-rgb), 0.2); border-radius: var(--radius-sm); font-size: var(--text-xs); color: var(--accent-primary);">${perspective?.name || llmResult.perspective}</span>
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
        `;

        // Add issue cards
        if (llmResult.issues && llmResult.issues.length > 0) {
            html += llmResult.issues.map(issue => `
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
     * Render a single validation card
     */
    renderValidationCard(rule) {
        const statusClass = {
            success: 'status-success',
            warning: 'status-warning',
            error: 'status-error',
            info: 'status-success'
        }[rule.type] || 'status-warning';

        // Only show passed rules with matches, or failed important rules
        if (rule.type === 'success' && !rule.passed && rule.lines.length === 0) {
            return ''; // Skip success rules that didn't match
        }

        const lineInfo = rule.lines.length > 0
            ? `Lines ${rule.lines.slice(0, 5).join(', ')}${rule.lines.length > 5 ? '...' : ''}`
            : '';

        return `
            <div class="validation-card" ${rule.lines.length > 0 ? `data-line="${rule.lines[0]}"` : ''}>
                <div class="card-header">
                    <div class="status-indicator ${statusClass}"></div>
                    <span class="card-title">${rule.name}</span>
                </div>
                <div class="card-lines">${lineInfo || rule.message}</div>
                ${rule.details ? `
                    <div class="details-toggle" onclick="this.nextElementSibling.classList.toggle('expanded')">
                        Show Details
                    </div>
                    <div class="card-details">
                        ${rule.details}
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Bind click handlers for line navigation
     */
    bindLineClicks() {
        this.panel.querySelectorAll('.validation-card[data-line]').forEach(card => {
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

.validation-card {
    background: rgba(255,255,255,0.03);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    margin-bottom: var(--space-2);
    transition: background 0.15s;
}

.validation-card:hover {
    background: rgba(255,255,255,0.05);
}

.validation-card[data-line]:hover {
    outline: 1px solid rgba(var(--accent-rgb), 0.3);
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
    padding-left: calc(8px + var(--space-2));
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
