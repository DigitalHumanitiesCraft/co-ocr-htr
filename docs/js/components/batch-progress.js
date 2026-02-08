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
        this._contentBuilt = false;
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

        // Build DOM only on first call; update targeted elements on subsequent calls
        if (!this._contentBuilt) {
            this.panel.innerHTML = `
                <div class="batch-progress-content">
                    <div class="batch-header">
                        <span class="batch-title"></span>
                        <span class="batch-counter"></span>
                    </div>
                    <div class="batch-progress-bar">
                        <div class="batch-progress-fill"></div>
                    </div>
                    <button class="btn btn-secondary btn-sm batch-abort-btn" id="batchAbortBtn">Abbrechen</button>
                </div>
            `;
            // Bind abort handler once
            const abortBtn = this.panel.querySelector('#batchAbortBtn');
            if (abortBtn) {
                abortBtn.addEventListener('click', () => {
                    appState.requestBatchAbort();
                    abortBtn.disabled = true;
                    abortBtn.textContent = 'Wird abgebrochen...';
                });
            }
            this._contentBuilt = true;
        }

        // Targeted DOM updates (no innerHTML rebuild, no listener re-binding)
        const titleEl = this.panel.querySelector('.batch-title');
        const counterEl = this.panel.querySelector('.batch-counter');
        const fillEl = this.panel.querySelector('.batch-progress-fill');
        const abortBtn = this.panel.querySelector('#batchAbortBtn');

        if (titleEl) titleEl.textContent = title;
        if (counterEl) counterEl.textContent = `${current} / ${total}`;
        if (fillEl) fillEl.style.width = `${percent}%`;
        if (abortBtn) {
            abortBtn.disabled = isAborted;
            abortBtn.textContent = isAborted ? 'Wird abgebrochen...' : 'Abbrechen';
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
