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

        // Bind custom toggles for all select-with-custom fields
        this._bindCustomToggle('contextDocType', 'contextDocTypeCustom');
        this._bindCustomToggle('contextScriptType', 'contextScriptTypeCustom');
        this._bindCustomToggle('contextRegion', 'contextRegionCustom');
        this._bindCustomToggle('contextTextType', 'contextTextTypeCustom');
    }

    /**
     * Bind a select element to show/hide its custom text input
     */
    _bindCustomToggle(selectId, customId) {
        const select = getById(selectId);
        const custom = getById(customId);
        if (!select || !custom) return;

        select.addEventListener('change', () => {
            if (select.value === 'custom') {
                custom.style.display = 'block';
                custom.focus();
            } else {
                custom.style.display = 'none';
                custom.value = '';
            }
        });
    }

    /**
     * Populate the context form fields with existing context
     */
    populateForm(context) {
        const period = getById('contextPeriod');
        const language = getById('contextLanguage');
        const description = getById('contextDescription');
        const century = getById('contextCentury');
        const knownText = getById('contextKnownText');

        // Populate select-with-custom fields
        this._populateSelectWithCustom('contextDocType', 'contextDocTypeCustom', context.documentType);
        this._populateSelectWithCustom('contextScriptType', 'contextScriptTypeCustom', context.scriptType);
        this._populateSelectWithCustom('contextRegion', 'contextRegionCustom', context.region);
        this._populateSelectWithCustom('contextTextType', 'contextTextTypeCustom', context.textType);

        if (period) period.value = context.period || '';
        if (language) language.value = context.language || '';
        if (description) description.value = context.description || '';
        if (century) century.value = context.century || '';
        if (knownText) knownText.value = context.knownText || '';
    }

    /**
     * Populate a select element, falling back to custom input for non-predefined values
     */
    _populateSelectWithCustom(selectId, customId, value) {
        const select = getById(selectId);
        const custom = getById(customId);
        if (!select) return;

        if (!value) {
            select.value = '';
            if (custom) { custom.style.display = 'none'; custom.value = ''; }
            return;
        }

        // Check if value exists as a predefined option
        const optionExists = Array.from(select.options).some(opt => opt.value === value && opt.value !== 'custom');
        if (optionExists) {
            select.value = value;
            if (custom) { custom.style.display = 'none'; custom.value = ''; }
        } else {
            select.value = 'custom';
            if (custom) { custom.style.display = 'block'; custom.value = value; }
        }
    }

    /**
     * Clear the context form fields
     */
    clearForm() {
        // Clear all select-with-custom fields
        this._clearSelectWithCustom('contextDocType', 'contextDocTypeCustom');
        this._clearSelectWithCustom('contextScriptType', 'contextScriptTypeCustom');
        this._clearSelectWithCustom('contextRegion', 'contextRegionCustom');
        this._clearSelectWithCustom('contextTextType', 'contextTextTypeCustom');

        // Clear text inputs
        const fields = ['contextPeriod', 'contextLanguage', 'contextDescription', 'contextCentury', 'contextKnownText'];
        for (const id of fields) {
            const el = getById(id);
            if (el) el.value = '';
        }
    }

    _clearSelectWithCustom(selectId, customId) {
        const select = getById(selectId);
        const custom = getById(customId);
        if (select) select.value = '';
        if (custom) { custom.value = ''; custom.style.display = 'none'; }
    }

    /**
     * Save context from form fields (called from transcription dialog)
     */
    saveContextSilent() {
        const period = getById('contextPeriod')?.value || '';
        const language = getById('contextLanguage')?.value || '';
        const description = getById('contextDescription')?.value || '';
        const century = getById('contextCentury')?.value || '';
        const knownText = getById('contextKnownText')?.value || '';

        // Read select-with-custom fields
        const docType = this._readSelectWithCustom('contextDocType', 'contextDocTypeCustom');
        const scriptType = this._readSelectWithCustom('contextScriptType', 'contextScriptTypeCustom');
        const region = this._readSelectWithCustom('contextRegion', 'contextRegionCustom');
        const textType = this._readSelectWithCustom('contextTextType', 'contextTextTypeCustom');

        // Derive structured languages array from free-text language field
        const languages = language
            ? language.split(/[,;]+/).map(l => l.trim().toLowerCase()).filter(Boolean)
            : [];

        // Only save if any context was provided
        if (docType || period || language || description || scriptType || century || region || textType || knownText) {
            appState.setDocumentContext({
                documentType: docType,
                period,
                language,
                description,
                scriptType,
                century,
                region,
                languages,
                textType,
                knownText
            });
        }
    }

    /**
     * Read value from a select element, using custom input if "custom" is selected
     */
    _readSelectWithCustom(selectId, customId) {
        const select = getById(selectId);
        const custom = getById(customId);
        let value = select?.value || '';
        if (value === 'custom' && custom) {
            value = custom.value.trim() || '';
        }
        return value;
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
            const typeDescription = typeLabels[context.documentType] || context.documentType;
            parts.push(`This is ${typeDescription}.`);
        }

        if (context.period) {
            parts.push(`Historical period: ${context.period}.`);
        }

        if (context.language) {
            parts.push(`Language(s): ${context.language}.`);
        }

        // Extended structured context fields (PPV1-103)
        if (context.scriptType) {
            const scriptLabels = {
                'textura': 'Textura (Gothic Bookhand)',
                'cursiva': 'Cursiva (Gothic Cursive)',
                'bastarda': 'Bastarda (Hybrid Gothic-Cursive)',
                'humanistica': 'Humanistica',
                'carolingian': 'Caroline Minuscule',
                'uncial': 'Uncial / Half-Uncial',
                'insular': 'Insular Script',
                'kurrent': 'Kurrent / Suetterlin'
            };
            const scriptDesc = scriptLabels[context.scriptType] || context.scriptType;
            parts.push(`Script type: ${scriptDesc}.`);
        }

        if (context.century) {
            parts.push(`Century: ${context.century}.`);
        }

        if (context.region) {
            const regionLabels = {
                'german': 'German-speaking region',
                'french': 'French-speaking region',
                'english': 'English-speaking region',
                'italian': 'Italian-speaking region',
                'spanish': 'Spanish-speaking region',
                'dutch': 'Dutch-speaking region',
                'scandinavian': 'Scandinavian region',
                'bohemian': 'Bohemian / Czech region',
                'polish': 'Polish region'
            };
            parts.push(`Region: ${regionLabels[context.region] || context.region}.`);
        }

        if (context.textType) {
            parts.push(`Text type: ${context.textType}.`);
        }

        if (context.knownText) {
            parts.push(`Known source text: ${context.knownText}.`);
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
