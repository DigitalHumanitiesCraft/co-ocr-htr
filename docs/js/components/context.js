/**
 * Context Manager
 *
 * Allows the expert to provide document context before transcription.
 * This context is used to enhance the LLM prompt for better results.
 *
 * Context is now managed through the transcription dialog (transcribeDialog).
 */

import { appState } from '../state.js';
import { getById } from '../utils/dom.js';

class ContextManager {
    constructor() {
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        this.initialized = true;

        // Bind custom document type toggle
        this.bindCustomDocTypeToggle();
    }

    /**
     * Bind the custom document type input toggle
     */
    bindCustomDocTypeToggle() {
        const docTypeSelect = getById('contextDocType');
        const customInput = getById('contextDocTypeCustom');

        if (!docTypeSelect || !customInput) return;

        docTypeSelect.addEventListener('change', () => {
            if (docTypeSelect.value === 'custom') {
                customInput.style.display = 'block';
                customInput.focus();
            } else {
                customInput.style.display = 'none';
                customInput.value = '';
            }
        });
    }

    /**
     * Populate the context form fields with existing context
     */
    populateForm(context) {
        const docType = getById('contextDocType');
        const docTypeCustom = getById('contextDocTypeCustom');
        const period = getById('contextPeriod');
        const language = getById('contextLanguage');
        const description = getById('contextDescription');

        // Handle custom document type
        if (docType && context.documentType) {
            // Check if it's a predefined type
            const predefinedTypes = ['letter', 'account_book', 'diary', 'register', 'protocol', 'contract', 'inventory', 'manuscript', 'certificate'];
            if (predefinedTypes.includes(context.documentType)) {
                docType.value = context.documentType;
                if (docTypeCustom) {
                    docTypeCustom.style.display = 'none';
                    docTypeCustom.value = '';
                }
            } else {
                // It's a custom type
                docType.value = 'custom';
                if (docTypeCustom) {
                    docTypeCustom.style.display = 'block';
                    docTypeCustom.value = context.documentType;
                }
            }
        } else if (docType) {
            docType.value = '';
        }

        if (period) period.value = context.period || '';
        if (language) language.value = context.language || '';
        if (description) description.value = context.description || '';
    }

    /**
     * Clear the context form fields
     */
    clearForm() {
        const docType = getById('contextDocType');
        const docTypeCustom = getById('contextDocTypeCustom');
        const period = getById('contextPeriod');
        const language = getById('contextLanguage');
        const description = getById('contextDescription');

        if (docType) docType.value = '';
        if (docTypeCustom) {
            docTypeCustom.value = '';
            docTypeCustom.style.display = 'none';
        }
        if (period) period.value = '';
        if (language) language.value = '';
        if (description) description.value = '';
    }

    /**
     * Save context from form fields (called from transcription dialog)
     */
    saveContextSilent() {
        const docTypeSelect = getById('contextDocType');
        const docTypeCustom = getById('contextDocTypeCustom');
        const period = getById('contextPeriod')?.value || '';
        const language = getById('contextLanguage')?.value || '';
        const description = getById('contextDescription')?.value || '';

        // Get document type (use custom value if "custom" is selected)
        let docType = docTypeSelect?.value || '';
        if (docType === 'custom' && docTypeCustom) {
            docType = docTypeCustom.value.trim() || '';
        }

        // Only save if any context was provided
        if (docType || period || language || description) {
            appState.setDocumentContext({
                documentType: docType,
                period: period,
                language: language,
                description: description
            });
        }
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
                'manuscript': 'a manuscript or handwritten document',
                'certificate': 'a certificate or official document',
                'other': 'a historical document'
            };
            // Use the label if it's a known type, otherwise use the custom type directly
            const typeDescription = typeLabels[context.documentType] || context.documentType;
            parts.push(`This is ${typeDescription}.`);
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
