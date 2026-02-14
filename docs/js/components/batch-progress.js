/**
 * Batch Progress Panel
 * Shows progress for batch transcription/validation with abort control
 */

import { appState } from '../state.js';
import { t } from '../services/i18n.js';

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
        const titleMap = { transcription: t('batch.transcription'), description: t('batch.description'), validation: t('batch.validation') };
        const title = titleMap[operation] || 'Batch Validation';
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
                    <button class="btn btn-secondary btn-sm batch-abort-btn" id="batchAbortBtn">${t('batch.cancel')}</button>
                </div>
            `;
            // Bind abort handler once
            const abortBtn = this.panel.querySelector('#batchAbortBtn');
            if (abortBtn) {
                abortBtn.addEventListener('click', () => {
                    appState.requestBatchAbort();
                    abortBtn.disabled = true;
                    abortBtn.textContent = t('batch.canceling');
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
            abortBtn.textContent = isAborted ? t('batch.canceling') : t('batch.cancel');
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
            ? t('batch.cancelled', { success, errors })
            : errors > 0
                ? t('batch.withErrors', { success, errors })
                : t('batch.allSuccess', { success });

        const statusClass = aborted || errors > 0 ? 'batch-status-warning' : 'batch-status-success';

        this.panel.innerHTML = `
            <div class="batch-progress-content ${statusClass}">
                <div class="batch-complete-message">${statusText}</div>
                <button class="btn btn-secondary btn-sm" id="batchCloseBtn">${t('batch.close')}</button>
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
