/**
 * Context Manager
 *
 * Allows the expert to provide document context before transcription.
 * This context is used to enhance the LLM prompt for better results.
 *
 * Implements the "Expert as Instructor" pattern:
 * The expert doesn't just validate - they guide the machine.
 */

import { appState } from '../state.js';
import { dialogManager } from './dialogs.js';
import { getById } from '../utils/dom.js';

class ContextManager {
    constructor() {
        this.dialog = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;

        this.dialog = getById('contextDialog');
        if (!this.dialog) {
            console.warn('[Context] Dialog not found');
            return;
        }

        this.bindEvents();
        this.initialized = true;
        console.log('[Context] Initialized');
    }

    bindEvents() {
        // Open dialog button
        const btnContext = getById('btnContext');
        if (btnContext) {
            btnContext.addEventListener('click', () => this.openDialog());
        }

        // Save button
        const saveBtn = getById('saveContext');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveContext());
        }

        // Clear button
        const clearBtn = getById('clearContext');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearContext());
        }

        // Close on backdrop click
        this.dialog.addEventListener('click', (e) => {
            if (e.target === this.dialog) {
                this.dialog.close();
            }
        });

        // Update button text when context changes
        appState.addEventListener('contextChanged', () => this.updateButtonText());

        // Update button on document load (restore saved context)
        appState.addEventListener('documentLoaded', () => this.updateButtonText());
    }

    openDialog() {
        if (!this.dialog) return;

        // Pre-fill with existing context
        const context = appState.getDocumentContext();
        if (context) {
            this.populateForm(context);
        } else {
            this.clearForm();
        }

        this.dialog.showModal();
    }

    populateForm(context) {
        const docType = getById('contextDocType');
        const period = getById('contextPeriod');
        const language = getById('contextLanguage');
        const description = getById('contextDescription');

        if (docType) docType.value = context.documentType || '';
        if (period) period.value = context.period || '';
        if (language) language.value = context.language || '';
        if (description) description.value = context.description || '';
    }

    clearForm() {
        const docType = getById('contextDocType');
        const period = getById('contextPeriod');
        const language = getById('contextLanguage');
        const description = getById('contextDescription');

        if (docType) docType.value = '';
        if (period) period.value = '';
        if (language) language.value = '';
        if (description) description.value = '';
    }

    saveContext() {
        const docType = getById('contextDocType')?.value || '';
        const period = getById('contextPeriod')?.value || '';
        const language = getById('contextLanguage')?.value || '';
        const description = getById('contextDescription')?.value || '';

        // Check if any context was provided
        if (!docType && !period && !language && !description) {
            dialogManager.showToast('Please provide at least some context', 'warning');
            return;
        }

        appState.setDocumentContext({
            documentType: docType,
            period: period,
            language: language,
            description: description
        });

        dialogManager.showToast('Context saved', 'success');
        this.dialog.close();
    }

    clearContext() {
        this.clearForm();
        appState.clearDocumentContext();
        dialogManager.showToast('Context cleared', 'info');
        this.dialog.close();
    }

    updateButtonText() {
        const btnText = getById('contextBtnText');
        if (!btnText) return;

        const context = appState.getDocumentContext();
        if (context && (context.documentType || context.description)) {
            // Show abbreviated context
            const label = context.documentType
                ? this.getDocTypeLabel(context.documentType)
                : 'Set';
            btnText.textContent = label;
            btnText.parentElement.classList.add('has-context');
        } else {
            btnText.textContent = 'Context';
            btnText.parentElement.classList.remove('has-context');
        }
    }

    getDocTypeLabel(type) {
        const labels = {
            'letter': 'Letter',
            'account_book': 'Account',
            'diary': 'Diary',
            'register': 'Register',
            'protocol': 'Protocol',
            'contract': 'Contract',
            'inventory': 'Inventory',
            'other': 'Other'
        };
        return labels[type] || 'Set';
    }

    /**
     * Build context string for LLM prompt
     * @returns {string} Context description for prompt
     */
    buildPromptContext() {
        const context = appState.getDocumentContext();
        if (!context) return '';

        const parts = [];

        if (context.documentType) {
            const typeLabels = {
                'letter': 'a letter/correspondence',
                'account_book': 'an account book or ledger with tabular entries',
                'diary': 'a diary or journal',
                'register': 'a register or list',
                'protocol': 'a protocol or meeting minutes',
                'contract': 'a contract or legal document',
                'inventory': 'an inventory',
                'other': 'a historical document'
            };
            parts.push(`This is ${typeLabels[context.documentType] || 'a document'}.`);
        }

        if (context.period) {
            parts.push(`Historical period: ${context.period}.`);
        }

        if (context.language) {
            parts.push(`Language(s): ${context.language}.`);
        }

        if (context.description) {
            parts.push(`Additional information: ${context.description}`);
        }

        return parts.join(' ');
    }
}

// Export singleton
export const contextManager = new ContextManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => contextManager.init());
} else {
    contextManager.init();
}
