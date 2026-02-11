/**
 * Validation Service
 *
 * Implements hybrid validation:
 * 1. Rule-based Validation: deterministic regex patterns and stats
 * 2. LLM Review: probabilistic review for plausibility and OCR errors
 */

import { llmService } from './llm.js';

// ============================================
// Rule Categories
// ============================================

/**
 * Rule categories for configurable validation
 */
const RULE_CATEGORIES = {
    markers: {
        name: 'Transcription Markers',
        description: '[?], [illegible], Abbreviations',
        rules: ['uncertain_marker', 'illegible_marker', 'abbreviations']
    },
    stats: {
        name: 'Text Statistics',
        description: 'Line and character count',
        rules: ['line_count', 'char_count']
    },
    artifacts: {
        name: 'OCR Artifacts',
        description: 'Unusual characters, control characters',
        rules: ['special_chars', 'double_spaces', 'control_chars']
    }
};

// ============================================
// Rule-based Validation
// ============================================

/**
 * Validation rule definitions
 * Each rule has:
 * - id: unique identifier
 * - name: human-readable name
 * - category: which category this rule belongs to
 * - regex: pattern to match (null for custom validation)
 * - validate: custom validation function (optional)
 * - type: success | warning | error | info
 * - messagePass: message when rule passes (can be function)
 * - messageFail: message when rule fails
 */
const VALIDATION_RULES = [
    // === MARKERS CATEGORY ===
    {
        id: 'uncertain_marker',
        name: 'Uncertain Readings',
        category: 'markers',
        description: 'Places marked with [?]',
        regex: /\[\?\]/g,
        type: 'warning',
        messagePass: (count) => `${count} uncertain place(s) marked`,
        messageFail: 'No uncertain markers'
    },
    {
        id: 'illegible_marker',
        name: 'Illegible Places',
        category: 'markers',
        description: 'Places marked as [illegible] or [...]',
        regex: /\[(illegible|\.\.\.)\]/gi,
        type: 'warning',
        messagePass: (count) => `${count} illegible place(s)`,
        messageFail: 'No illegible places'
    },
    {
        id: 'abbreviations',
        name: 'Abbreviations',
        category: 'markers',
        description: 'Detected abbreviation markers like word[expansion]',
        regex: /\w+\[[\w]+\]/g,
        type: 'info',
        messagePass: (count) => `${count} resolved abbreviation(s)`,
        messageFail: 'No abbreviations detected'
    },

    // === STATS CATEGORY ===
    {
        id: 'line_count',
        name: 'Line Count',
        category: 'stats',
        description: 'Number of transcribed lines',
        validate: validateLineCount,
        type: 'info',
        messagePass: (count) => `${count} lines transcribed`,
        messageFail: 'No lines found'
    },
    {
        id: 'char_count',
        name: 'Character Count',
        category: 'stats',
        description: 'Total number of characters in text',
        validate: validateCharCount,
        type: 'info',
        messagePass: (count) => `${count} characters`,
        messageFail: 'No text available'
    },

    // === ARTIFACTS CATEGORY ===
    {
        id: 'special_chars',
        name: 'Special Characters',
        category: 'artifacts',
        description: 'Unusual characters (possible OCR artifacts)',
        // Exclude common chars: word chars, whitespace, punctuation, common accented chars
        regex: /[^\w\s.,;:!?\-'"()\]{[/\\\n\r\t°§†‡©®™€£¥¢äöüÄÖÜßàáâãåæçèéêëìíîïðñòóôõøùúûýÿœŒÀÁÂÃÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕØÙÚÛÝŸ]/g,
        type: 'warning',
        messagePass: (count, matches) => {
            const uniqueChars = [...new Set(matches)].slice(0, 5).join(' ');
            return `${count} special characters: ${uniqueChars}${matches.length > 5 ? '...' : ''}`;
        },
        messageFail: 'No unusual characters'
    },
    {
        id: 'double_spaces',
        name: 'Double Spaces',
        category: 'artifacts',
        description: 'Multiple consecutive spaces',
        regex: /  +/g,
        type: 'info',
        messagePass: (count) => `${count} place(s) with multiple spaces`,
        messageFail: 'No double spaces'
    },
    {
        id: 'control_chars',
        name: 'Control Characters',
        category: 'artifacts',
        description: 'Non-printable characters (except line breaks)',
        // eslint-disable-next-line no-control-regex -- intentional: detecting control chars
        regex: /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,
        type: 'error',
        messagePass: (count) => `${count} non-printable character(s) found`,
        messageFail: 'No control characters'
    }
];

/**
 * Custom validator: Count transcribed lines
 */
function validateLineCount(text, _segments) {
    const lines = text ? text.split('\n').filter(l => l.trim().length > 0) : [];
    const count = lines.length;

    return {
        passed: count > 0,
        lines: [],
        matches: [count],
        details: null
    };
}

/**
 * Custom validator: Count characters
 */
function validateCharCount(text, _segments) {
    const count = text ? text.length : 0;

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
        this.categories = RULE_CATEGORIES;
    }

    /**
     * Get rules for a specific category
     * @param {string} categoryId - Category identifier
     * @returns {Array} Rules in that category
     */
    getRulesByCategory(categoryId) {
        const category = this.categories[categoryId];
        if (!category) return [];
        return this.rules.filter(r => category.rules.includes(r.id));
    }

    /**
     * Run rule-based validations with category filtering
     * @param {string} text - Full transcription text
     * @param {Array} segments - Parsed segments
     * @param {object} categoryOptions - Which categories to include
     * @returns {Array} Validation results
     */
    validateRules(text, segments, categoryOptions = {}) {
        const {
            markers = true,
            stats = true,
            artifacts = true
        } = categoryOptions;

        // Determine which rules to run based on enabled categories
        const enabledCategories = [];
        if (markers) enabledCategories.push('markers');
        if (stats) enabledCategories.push('stats');
        if (artifacts) enabledCategories.push('artifacts');

        const results = [];

        for (const rule of this.rules) {
            // Skip rules not in enabled categories
            if (!enabledCategories.includes(rule.category)) {
                continue;
            }

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
            let matchCount;
            if (rule.validate && result.matches?.length === 1 && typeof result.matches[0] === 'number') {
                matchCount = result.matches[0];
            } else {
                matchCount = result.matches?.length || 0;
            }

            let message;
            if (result.passed && typeof rule.messagePass === 'function') {
                message = rule.messagePass(matchCount, result.matches);
            } else if (result.passed) {
                message = rule.messagePass;
            } else {
                message = rule.messageFail;
            }

            results.push({
                id: rule.id,
                name: rule.name,
                category: rule.category,
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
        if (text) {
            const textLines = text.split('\n');
            const lineRegex = new RegExp(regex.source, regex.flags.replace('g', ''));
            textLines.forEach((line, idx) => {
                if (lineRegex.test(line)) {
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
     * Run LLM Review
     * @param {string} text - Transcription text
     * @param {string} customPrompt - Optional custom validation prompt
     * @returns {Promise<object>} LLM validation result
     */
    async validateWithLLM(text, customPrompt = '') {
        try {
            const result = await llmService.validate(text, { customPrompt });
            const validationResult = {
                confidence: result.confidence,
                reasoning: result.reasoning,
                issues: result.issues || [],
                summary: result.summary || result.reasoning,
                raw: result.raw
            };

            // Pass through fallback info if validation used a different model
            if (result.fallbackUsed) {
                validationResult.fallbackUsed = result.fallbackUsed;
            }

            return validationResult;
        } catch (error) {
            console.error('LLM validation error:', error);
            return {
                confidence: 'uncertain',
                reasoning: `Validation failed: ${error.message}`,
                issues: [],
                error: error.message
            };
        }
    }

    /**
     * Run complete validation (rules + LLM) with options
     * @param {string} text - Transcription text
     * @param {Array} segments - Parsed segments
     * @param {object} options - Validation options
     * @returns {Promise<object>} Complete validation results
     */
    async validate(text, segments, options = {}) {
        // Support old signature: validate(text, segments, perspective, includeLLM)
        if (typeof options === 'string') {
            options = {
                includeLLM: arguments[3] !== false
            };
        }

        const {
            checkMarkers = true,
            checkStats = true,
            checkArtifacts = true,
            includeLLM = true,
            customPrompt = ''
        } = options;

        // Run rule-based validation with category filtering
        const ruleResults = this.validateRules(text, segments, {
            markers: checkMarkers,
            stats: checkStats,
            artifacts: checkArtifacts
        });

        // Run LLM validation (if requested and API key available)
        let llmResult = null;
        if (includeLLM && llmService.hasApiKey()) {
            llmResult = await this.validateWithLLM(text, customPrompt);
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
            if (r.passed) {
                counts[r.type] = (counts[r.type] || 0) + 1;
            }
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
     * Get rule categories for UI
     */
    getCategories() {
        return Object.entries(this.categories).map(([id, cat]) => ({
            id,
            name: cat.name,
            description: cat.description,
            ruleCount: cat.rules.length
        }));
    }
}

// Export singleton instance
export const validationEngine = new ValidationEngine();
export { VALIDATION_RULES, RULE_CATEGORIES, ValidationEngine };
