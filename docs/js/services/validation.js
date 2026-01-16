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
const VALIDATION_RULES = [
    {
        id: 'date_format',
        name: 'Datumsformat',
        regex: /\d{1,2}\.\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)/gi,
        type: 'success',
        messagePass: 'Datumsformat korrekt erkannt',
        messageFail: 'Keine Datumsangaben gefunden'
    },
    {
        id: 'currency_taler',
        name: 'Waehrung (Taler)',
        regex: /\d+\s*(Taler|Tlr\.?|Rtl\.?)/gi,
        type: 'success',
        messagePass: 'Taler-Betraege erkannt',
        messageFail: 'Keine Taler-Betraege gefunden'
    },
    {
        id: 'currency_groschen',
        name: 'Waehrung (Groschen)',
        regex: /\d+\s*(Groschen|Gr\.?|Sgr\.?)/gi,
        type: 'success',
        messagePass: 'Groschen-Betraege erkannt',
        messageFail: 'Keine Groschen-Betraege gefunden'
    },
    {
        id: 'currency_gulden',
        name: 'Waehrung (Gulden)',
        regex: /\d+\s*(Gulden|fl\.?|Kreuzer|kr\.?)/gi,
        type: 'success',
        messagePass: 'Gulden/Kreuzer erkannt',
        messageFail: 'Keine Gulden/Kreuzer gefunden'
    },
    {
        id: 'uncertain_marker',
        name: 'Unsichere Lesungen',
        regex: /\[\?\]/g,
        type: 'warning',
        messagePass: 'Unsichere Stellen markiert',
        messageFail: 'Keine unsicheren Markierungen'
    },
    {
        id: 'illegible_marker',
        name: 'Unleserliche Stellen',
        regex: /\[illegible\]/gi,
        type: 'error',
        messagePass: 'Unleserliche Stellen markiert',
        messageFail: 'Keine unleserlichen Stellen'
    },
    {
        id: 'table_consistency',
        name: 'Spaltenanzahl',
        validate: validateTableConsistency,
        type: 'warning',
        messagePass: 'Spaltenanzahl konsistent',
        messageFail: 'Inkonsistente Spaltenanzahl'
    },
    {
        id: 'empty_cells',
        name: 'Leere Zellen',
        validate: validateEmptyCells,
        type: 'warning',
        messagePass: 'Keine unerwartet leeren Zellen',
        messageFail: 'Potenziell fehlende Daten'
    }
];

/**
 * Custom validator: Check table column consistency
 */
function validateTableConsistency(text, segments) {
    if (!segments || segments.length < 2) {
        return { passed: true, lines: [], details: 'Nicht genug Zeilen fuer Pruefung' };
    }

    const columnCounts = segments.map((seg, idx) => {
        const pipeCount = (seg.text?.match(/\|/g) || []).length;
        return { line: idx + 1, count: pipeCount };
    });

    // Find most common column count
    const counts = columnCounts.map(c => c.count);
    const modeCount = counts.sort((a, b) =>
        counts.filter(v => v === a).length - counts.filter(v => v === b).length
    ).pop();

    // Find inconsistent lines
    const inconsistent = columnCounts.filter(c => c.count !== modeCount && c.count > 0);

    return {
        passed: inconsistent.length === 0,
        lines: inconsistent.map(c => c.line),
        details: inconsistent.length > 0
            ? `Zeilen ${inconsistent.map(c => c.line).join(', ')} haben abweichende Spaltenanzahl`
            : null
    };
}

/**
 * Custom validator: Check for potentially missing data
 */
function validateEmptyCells(text, segments) {
    if (!segments || segments.length === 0) {
        return { passed: true, lines: [], details: null };
    }

    const emptyLines = [];

    segments.forEach((seg, idx) => {
        // Check if line has multiple empty cells (consecutive pipes)
        if (seg.text?.match(/\|\s*\|/)) {
            emptyLines.push(idx + 1);
        }
    });

    return {
        passed: emptyLines.length === 0,
        lines: emptyLines,
        details: emptyLines.length > 0
            ? `Zeilen ${emptyLines.join(', ')} haben leere Zellen`
            : null
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

            results.push({
                id: rule.id,
                name: rule.name,
                type: result.passed ? rule.type : (rule.type === 'success' ? 'info' : rule.type),
                passed: result.passed,
                message: result.passed ? rule.messagePass : rule.messageFail,
                lines: result.lines || [],
                details: result.details || null,
                matches: result.matches || []
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
