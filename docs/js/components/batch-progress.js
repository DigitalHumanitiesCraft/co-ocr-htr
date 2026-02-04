/**
 * Batch Progress Panel
 * Shows progress for batch transcription/validation with abort control
 */

import { appState } from '../state.js';

class BatchProgressPanel {
    constructor() {
        this.panel = null;
    }

    /**
     * Show progress panel
     * @param {string} operation - 'transcription' or 'validation'
     * @param {number} total - Total pages
     */
    show(operation, total) {
        if (!this.panel) {
            this.createPanel();
        }
        this.panel.hidden = false;
        this.update(0, total, operation);
    }

    /**
     * Update progress display
     * @param {number} current - Current page (1-based for display)
     * @param {number} total - Total pages
     * @param {string} operation - Operation type
     */
    update(current, total, operation) {
        if (!this.panel) return;

        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        const title = operation === 'transcription' ? 'Batch-Transkription' : 'Batch-Validierung';
        const isAborted = appState.data.batch.abortRequested;

        this.panel.innerHTML = `
            <div class="batch-progress-content">
                <div class="batch-header">
                    <span class="batch-title">${title}</span>
                    <span class="batch-counter">${current} / ${total}</span>
                </div>
                <div class="batch-progress-bar">
                    <div class="batch-progress-fill" style="width: ${percent}%"></div>
                </div>
                <button class="btn btn-secondary btn-sm batch-abort-btn" id="batchAbortBtn" ${isAborted ? 'disabled' : ''}>
                    ${isAborted ? 'Wird abgebrochen...' : 'Abbrechen'}
                </button>
            </div>
        `;

        // Bind abort handler
        const abortBtn = this.panel.querySelector('#batchAbortBtn');
        if (abortBtn && !isAborted) {
            abortBtn.addEventListener('click', () => {
                appState.requestBatchAbort();
                abortBtn.disabled = true;
                abortBtn.textContent = 'Wird abgebrochen...';
            });
        }
    }

    /**
     * Show completion summary
     * @param {number} success - Successful count
     * @param {number} errors - Error count
     * @param {boolean} aborted - Was aborted
     */
    showComplete(success, errors, aborted) {
        if (!this.panel) return;

        const statusText = aborted
            ? `Abgebrochen: ${success} erfolgreich, ${errors} fehlgeschlagen`
            : errors > 0
                ? `${success} erfolgreich, ${errors} fehlgeschlagen`
                : `${success} Seiten erfolgreich`;

        const statusClass = aborted || errors > 0 ? 'batch-status-warning' : 'batch-status-success';

        this.panel.innerHTML = `
            <div class="batch-progress-content ${statusClass}">
                <div class="batch-complete-message">${statusText}</div>
                <button class="btn btn-secondary btn-sm" id="batchCloseBtn">Schließen</button>
            </div>
        `;

        this.panel.querySelector('#batchCloseBtn')?.addEventListener('click', () => {
            this.hide();
        });

        // Auto-hide after 3 seconds
        setTimeout(() => this.hide(), 3000);
    }

    /**
     * Hide the panel
     */
    hide() {
        if (this.panel) {
            this.panel.hidden = true;
        }
    }

    /**
     * Create panel DOM element
     */
    createPanel() {
        this.panel = document.createElement('div');
        this.panel.id = 'batchProgressPanel';
        this.panel.className = 'batch-progress-panel';
        this.panel.hidden = true;
        document.body.appendChild(this.panel);
    }
}

export const batchProgress = new BatchProgressPanel();
