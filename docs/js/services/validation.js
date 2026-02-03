/**
 * Validation Service
 *
 * Implements hybrid validation:
 * 1. Rule-based: Deterministic regex patterns for known formats
 * 2. LLM-Judge: AI-based validation from different perspectives
 */

import { llmService } from './llm.js';
import { appState } from '../state.js';

// ============================================
// Rule-based Validation
// ============================================

/**
 * Validation rule definitions
 * Each rule has:
 * - id: unique identifier
 * - name: human-readable name
 * - regex: pattern to match (null for custom validation)
 * - validate: custom validation function (optional)
 * - type: success | warning | error
 * - messagePass: message when rule passes
 * - messageFail: message when rule fails
 */
/**
 * Generic validation rules (applicable to all document types)
 */
const VALIDATION_RULES = [
    {
        id: 'uncertain_marker',
        name: 'Unsichere Lesungen',
        description: 'Stellen, die mit [?] markiert wurden',
        regex: /\[\?\]/g,
        type: 'warning',
        messagePass: (count) => `${count} unsichere Stelle(n) markiert`,
        messageFail: 'Keine unsicheren Markierungen'
    },
    {
        id: 'illegible_marker',
        name: 'Unleserliche Stellen',
        description: 'Stellen, die als [illegible] oder [...] markiert wurden',
        regex: /\[(illegible|\.\.\.)\]/gi,
        type: 'warning',
        messagePass: (count) => `${count} unleserliche Stelle(n)`,
        messageFail: 'Keine unleserlichen Stellen'
    },
    {
        id: 'abbreviations',
        name: 'Abkuerzungen',
        description: 'Erkannte Abkuerzungsmarkierungen',
        regex: /\w+\[[\w]+\]/g,  // e.g., "admi[nistrateurs]"
        type: 'info',
        messagePass: (count) => `${count} aufgeloeste Abkuerzung(en)`,
        messageFail: 'Keine Abkuerzungen erkannt'
    },
    {
        id: 'line_breaks',
        name: 'Zeilenanzahl',
        description: 'Anzahl der transkribierten Zeilen',
        validate: validateLineCount,
        type: 'info',
        messagePass: (count) => `${count} Zeilen transkribiert`,
        messageFail: 'Keine Zeilen gefunden'
    },
    {
        id: 'special_chars',
        name: 'Sonderzeichen',
        description: 'Ungewoehnliche Zeichen (moegl. OCR-Artefakte)',
        regex: /[^\w\s\.,;:!?\-\'\"\(\)\[\]äöüÄÖÜßàâéèêëïîôùûçœæÀÂÉÈÊËÏÎÔÙÛÇŒÆ]/g,
        type: 'info',
        messagePass: (count) => `${count} Sonderzeichen gefunden`,
        messageFail: 'Keine ungewoehnlichen Zeichen'
    }
];

/**
 * Custom validator: Count transcribed lines
 */
function validateLineCount(text, segments) {
    const lines = text ? text.split('\n').filter(l => l.trim().length > 0) : [];
    const count = lines.length;

    return {
        passed: count > 0,
        lines: [],
        matches: [count],
        details: null
    };
}

// ============================================
// Validation Engine
// ============================================

class ValidationEngine {
    constructor() {
        this.rules = VALIDATION_RULES;
    }

    /**
     * Run all rule-based validations
     * @param {string} text - Full transcription text
     * @param {Array} segments - Parsed segments
     * @returns {Array} Validation results
     */
    validateRules(text, segments) {
        const results = [];

        for (const rule of this.rules) {
            let result;

            if (rule.validate) {
                // Custom validation function
                result = rule.validate(text, segments);
            } else if (rule.regex) {
                // Regex-based validation
                result = this.validateRegex(text, segments, rule.regex);
            } else {
                continue;
            }

            // Generate message (support function or string)
            // For custom validators, use first match value if it's a number (e.g., line count)
            // For regex validators, use matches array length
            let matchCount;
            if (rule.validate && result.matches?.length === 1 && typeof result.matches[0] === 'number') {
                matchCount = result.matches[0];
            } else {
                matchCount = result.matches?.length || 0;
            }

            let message;
            if (result.passed && typeof rule.messagePass === 'function') {
                message = rule.messagePass(matchCount);
            } else if (result.passed) {
                message = rule.messagePass;
            } else {
                message = rule.messageFail;
            }

            results.push({
                id: rule.id,
                name: rule.name,
                description: rule.description || '',
                type: result.passed ? rule.type : 'info',
                passed: result.passed,
                message,
                lines: result.lines || [],
                details: result.details || null,
                matches: result.matches || [],
                matchCount
            });
        }

        return results;
    }

    /**
     * Run regex validation and find matching lines
     */
    validateRegex(text, segments, regex) {
        // Reset regex lastIndex
        regex.lastIndex = 0;

        const matches = [];
        let match;

        // Find all matches in text
        const globalRegex = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
        while ((match = globalRegex.exec(text)) !== null) {
            matches.push(match[0]);
        }

        // Find which lines contain matches
        const lines = [];
        if (segments) {
            segments.forEach((seg, idx) => {
                const lineRegex = new RegExp(regex.source, regex.flags.replace('g', ''));
                if (lineRegex.test(seg.text || '')) {
                    lines.push(idx + 1);
                }
            });
        }

        return {
            passed: matches.length > 0,
            lines,
            matches
        };
    }

    /**
     * Run LLM-Judge validation
     * @param {string} text - Transcription text
     * @param {string} perspective - Validation perspective
     * @returns {Promise<object>} LLM validation result
     */
    async validateWithLLM(text, perspective = 'paleographic') {
        try {
            const result = await llmService.validate(text, perspective);
            return {
                perspective,
                confidence: result.confidence,
                reasoning: result.reasoning,
                issues: result.issues || [],
                raw: result.raw
            };
        } catch (error) {
            console.error('LLM validation error:', error);
            return {
                perspective,
                confidence: 'uncertain',
                reasoning: `Validation failed: ${error.message}`,
                issues: [],
                error: error.message
            };
        }
    }

    /**
     * Run complete validation (rules + LLM)
     * @param {string} text - Transcription text
     * @param {Array} segments - Parsed segments
     * @param {string} perspective - LLM perspective
     * @param {boolean} includeLLM - Whether to include LLM validation
     * @returns {Promise<object>} Complete validation results
     */
    async validate(text, segments, perspective = 'paleographic', includeLLM = true) {
        // Run rule-based validation (always)
        const ruleResults = this.validateRules(text, segments);

        // Run LLM validation (if requested and API key available)
        let llmResult = null;
        if (includeLLM && llmService.hasApiKey()) {
            llmResult = await this.validateWithLLM(text, perspective);
        }

        // Calculate summary
        const summary = this.calculateSummary(ruleResults, llmResult);

        return {
            rules: ruleResults,
            llmJudge: llmResult,
            summary,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Calculate validation summary
     */
    calculateSummary(ruleResults, llmResult) {
        const counts = {
            success: 0,
            warning: 0,
            error: 0,
            info: 0
        };

        ruleResults.forEach(r => {
            counts[r.type] = (counts[r.type] || 0) + 1;
        });

        // Overall status based on results
        let status = 'success';
        if (counts.error > 0 || (llmResult?.confidence === 'uncertain')) {
            status = 'error';
        } else if (counts.warning > 0 || (llmResult?.confidence === 'likely')) {
            status = 'warning';
        }

        return {
            status,
            counts,
            totalIssues: counts.warning + counts.error,
            llmConfidence: llmResult?.confidence || null
        };
    }

    /**
     * Get available perspectives for LLM validation
     */
    getPerspectives() {
        return [
            { id: 'paleographic', name: 'Palaeographisch', description: 'Buchstabenformen, Ligaturen, Abkuerzungen' },
            { id: 'linguistic', name: 'Sprachlich', description: 'Grammatik, historische Orthographie' },
            { id: 'structural', name: 'Strukturell', description: 'Tabellen, Summen, Verweise' },
            { id: 'domain', name: 'Domaenenwissen', description: 'Fachtermini, Plausibilitaet' }
        ];
    }
}

// Export singleton instance
export const validationEngine = new ValidationEngine();
export { VALIDATION_RULES, ValidationEngine };
