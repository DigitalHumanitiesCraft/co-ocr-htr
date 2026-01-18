/**
 * textFormatting.js - Text marker and formatting utilities
 * coOCR/HTR Application
 *
 * Centralizes text marker rendering and confidence class logic
 * to eliminate code duplication across editor and validation modules.
 */

// =============================================================================
// MARKER PATTERNS
// =============================================================================

/** Pattern for uncertain readings [?] */
const UNCERTAIN_PATTERN = /\[\?\]/g;

/** Pattern for illegible text [illegible] */
const ILLEGIBLE_PATTERN = /\[illegible\]/g;

// =============================================================================
// MARKER HTML TEMPLATES
// =============================================================================

/** HTML for uncertain marker */
const UNCERTAIN_MARKER_HTML = '<span class="marker-uncertain" title="Unsicher">[?]</span>';

/** HTML for illegible marker */
const ILLEGIBLE_MARKER_HTML = '<span class="marker-illegible" title="Unleserlich">...</span>';

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Apply text markers (uncertain, illegible) to a string
 * @param {string} text - Raw text to process
 * @returns {string} HTML with marker spans applied
 */
export function applyMarkers(text) {
    if (!text) return '';

    return text
        .replace(UNCERTAIN_PATTERN, UNCERTAIN_MARKER_HTML)
        .replace(ILLEGIBLE_PATTERN, ILLEGIBLE_MARKER_HTML);
}

/**
 * Check if text contains uncertain markers [?]
 * @param {string} text - Text to check
 * @returns {boolean}
 */
export function hasUncertainMarker(text) {
    return text ? UNCERTAIN_PATTERN.test(text) : false;
}

/**
 * Check if text contains illegible markers [illegible]
 * @param {string} text - Text to check
 * @returns {boolean}
 */
export function hasIllegibleMarker(text) {
    return text ? ILLEGIBLE_PATTERN.test(text) : false;
}

/**
 * Check if text contains any markers
 * @param {string} text - Text to check
 * @returns {boolean}
 */
export function hasAnyMarker(text) {
    if (!text) return false;
    // Reset lastIndex for global patterns
    UNCERTAIN_PATTERN.lastIndex = 0;
    ILLEGIBLE_PATTERN.lastIndex = 0;
    return UNCERTAIN_PATTERN.test(text) || ILLEGIBLE_PATTERN.test(text);
}

/**
 * Count uncertain markers in text
 * @param {string} text - Text to analyze
 * @returns {number}
 */
export function countUncertainMarkers(text) {
    if (!text) return 0;
    const matches = text.match(UNCERTAIN_PATTERN);
    return matches ? matches.length : 0;
}

/**
 * Count illegible markers in text
 * @param {string} text - Text to analyze
 * @returns {number}
 */
export function countIllegibleMarkers(text) {
    if (!text) return 0;
    const matches = text.match(ILLEGIBLE_PATTERN);
    return matches ? matches.length : 0;
}

/**
 * Get CSS class for confidence level
 * @param {string} confidence - Confidence level: 'confident', 'uncertain', 'problematic'
 * @returns {string} CSS class name
 */
export function getConfidenceClass(confidence) {
    switch (confidence) {
        case 'uncertain':
            return 'confidence-uncertain';
        case 'problematic':
            return 'confidence-problematic';
        case 'confident':
        default:
            return '';
    }
}

/**
 * Get status indicator class for confidence level
 * @param {string} confidence - Confidence level
 * @returns {string} CSS status class name
 */
export function getStatusClass(confidence) {
    switch (confidence) {
        case 'uncertain':
            return 'status-uncertain';
        case 'problematic':
            return 'status-error';
        case 'confident':
        default:
            return 'status-success';
    }
}

/**
 * Get human-readable label for confidence level
 * @param {string} confidence - Confidence level
 * @returns {string} Human-readable label
 */
export function getConfidenceLabel(confidence) {
    switch (confidence) {
        case 'confident':
        case 'certain':
            return 'High Confidence';
        case 'likely':
            return 'Medium Confidence';
        case 'uncertain':
            return 'Low Confidence';
        case 'problematic':
            return 'Problematic';
        default:
            return 'Unknown';
    }
}

/**
 * Determine overall confidence from marker counts
 * @param {number} uncertainCount - Number of uncertain markers
 * @param {number} illegibleCount - Number of illegible markers
 * @returns {string} Confidence level
 */
export function determineConfidence(uncertainCount, illegibleCount) {
    if (illegibleCount > 0) {
        return 'problematic';
    }
    if (uncertainCount > 0) {
        return 'uncertain';
    }
    return 'confident';
}

/**
 * Strip markers from text, leaving clean text
 * @param {string} text - Text with markers
 * @returns {string} Clean text without markers
 */
export function stripMarkers(text) {
    if (!text) return '';

    return text
        .replace(UNCERTAIN_PATTERN, '')
        .replace(ILLEGIBLE_PATTERN, '')
        .trim();
}

/**
 * Escape HTML special characters in text
 * @param {string} text - Text to escape
 * @returns {string} HTML-safe text
 */
export function escapeHtml(text) {
    if (!text) return '';

    const htmlEscapes = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };

    return text.replace(/[&<>"']/g, char => htmlEscapes[char]);
}

/**
 * Apply markers to text with HTML escaping
 * @param {string} text - Raw text
 * @returns {string} Safe HTML with markers applied
 */
export function safeApplyMarkers(text) {
    if (!text) return '';

    // First escape HTML, then apply markers
    // We need to escape first so marker patterns aren't affected
    const escaped = escapeHtml(text);
    return applyMarkers(escaped);
}
