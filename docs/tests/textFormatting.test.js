/**
 * textFormatting.test.js - Tests for text formatting utilities
 */

import { describe, it, expect } from 'vitest';
import {
    applyMarkers,
    hasUncertainMarker,
    hasIllegibleMarker,
    hasAnyMarker,
    countUncertainMarkers,
    countIllegibleMarkers,
    getConfidenceClass,
    getStatusClass,
    getConfidenceLabel,
    determineConfidence,
    stripMarkers,
    escapeHtml,
    safeApplyMarkers
} from '../js/utils/textFormatting.js';

describe('Text Formatting Utilities', () => {

    describe('applyMarkers', () => {
        it('should convert [?] to uncertain marker span', () => {
            const result = applyMarkers('word[?]');
            expect(result).toContain('class="marker-uncertain"');
            expect(result).toContain('[?]');
        });

        it('should convert [illegible] to illegible marker span', () => {
            const result = applyMarkers('[illegible] text');
            expect(result).toContain('class="marker-illegible"');
            expect(result).toContain('...');
        });

        it('should handle multiple markers', () => {
            const result = applyMarkers('[?] word [illegible] more [?]');
            expect((result.match(/marker-uncertain/g) || []).length).toBe(2);
            expect((result.match(/marker-illegible/g) || []).length).toBe(1);
        });

        it('should return empty string for null/undefined', () => {
            expect(applyMarkers(null)).toBe('');
            expect(applyMarkers(undefined)).toBe('');
            expect(applyMarkers('')).toBe('');
        });

        it('should preserve text without markers', () => {
            expect(applyMarkers('normal text')).toBe('normal text');
        });
    });

    describe('hasUncertainMarker', () => {
        it('should detect [?] marker at end', () => {
            expect(hasUncertainMarker('word[?]')).toBe(true);
        });

        it('should detect [?] marker at start', () => {
            expect(hasUncertainMarker('[?]word')).toBe(true);
        });

        it('should return false without marker', () => {
            expect(hasUncertainMarker('no markers here')).toBe(false);
        });

        it('should handle null/empty input', () => {
            expect(hasUncertainMarker(null)).toBe(false);
            expect(hasUncertainMarker('')).toBe(false);
        });
    });

    describe('hasIllegibleMarker', () => {
        it('should detect [illegible] marker alone', () => {
            expect(hasIllegibleMarker('[illegible]')).toBe(true);
        });

        it('should detect [illegible] marker in text', () => {
            expect(hasIllegibleMarker('text [illegible] more')).toBe(true);
        });

        it('should return false without marker', () => {
            expect(hasIllegibleMarker('readable text')).toBe(false);
        });

        it('should handle null/empty input', () => {
            expect(hasIllegibleMarker(null)).toBe(false);
            expect(hasIllegibleMarker('')).toBe(false);
        });
    });

    describe('hasAnyMarker', () => {
        it('should detect uncertain markers', () => {
            expect(hasAnyMarker('[?]word')).toBe(true);
        });

        it('should detect illegible markers', () => {
            expect(hasAnyMarker('[illegible]')).toBe(true);
        });

        it('should detect both markers', () => {
            expect(hasAnyMarker('[?] and [illegible]')).toBe(true);
        });

        it('should return false without markers', () => {
            expect(hasAnyMarker('clean text')).toBe(false);
        });

        it('should handle null/empty input', () => {
            expect(hasAnyMarker(null)).toBe(false);
            expect(hasAnyMarker('')).toBe(false);
        });
    });

    describe('countUncertainMarkers', () => {
        it('should count zero markers', () => {
            expect(countUncertainMarkers('no markers')).toBe(0);
        });

        it('should count one marker', () => {
            expect(countUncertainMarkers('[?]word')).toBe(1);
        });

        it('should count multiple markers', () => {
            expect(countUncertainMarkers('[?] one [?] two [?] three')).toBe(3);
        });

        it('should handle null/empty input', () => {
            expect(countUncertainMarkers(null)).toBe(0);
            expect(countUncertainMarkers('')).toBe(0);
        });
    });

    describe('countIllegibleMarkers', () => {
        it('should count zero markers', () => {
            expect(countIllegibleMarkers('no markers')).toBe(0);
        });

        it('should count markers', () => {
            expect(countIllegibleMarkers('[illegible] and [illegible]')).toBe(2);
        });

        it('should handle null/empty input', () => {
            expect(countIllegibleMarkers(null)).toBe(0);
        });
    });

    describe('getConfidenceClass', () => {
        it('should return empty string for confident', () => {
            expect(getConfidenceClass('confident')).toBe('');
        });

        it('should return class for uncertain', () => {
            expect(getConfidenceClass('uncertain')).toBe('confidence-uncertain');
        });

        it('should return class for problematic', () => {
            expect(getConfidenceClass('problematic')).toBe('confidence-problematic');
        });

        it('should return empty string for unknown values', () => {
            expect(getConfidenceClass('unknown')).toBe('');
        });
    });

    describe('getStatusClass', () => {
        it('should return success for confident', () => {
            expect(getStatusClass('confident')).toBe('status-success');
        });

        it('should return uncertain for uncertain', () => {
            expect(getStatusClass('uncertain')).toBe('status-uncertain');
        });

        it('should return error for problematic', () => {
            expect(getStatusClass('problematic')).toBe('status-error');
        });
    });

    describe('getConfidenceLabel', () => {
        it('should return labels for all confidence levels', () => {
            expect(getConfidenceLabel('confident')).toBe('High Confidence');
            expect(getConfidenceLabel('certain')).toBe('High Confidence');
            expect(getConfidenceLabel('likely')).toBe('Medium Confidence');
            expect(getConfidenceLabel('uncertain')).toBe('Low Confidence');
            expect(getConfidenceLabel('problematic')).toBe('Problematic');
        });

        it('should return Unknown for unrecognized values', () => {
            expect(getConfidenceLabel('foo')).toBe('Unknown');
        });
    });

    describe('determineConfidence', () => {
        it('should return confident for no markers', () => {
            expect(determineConfidence(0, 0)).toBe('confident');
        });

        it('should return uncertain for uncertain markers only', () => {
            expect(determineConfidence(3, 0)).toBe('uncertain');
        });

        it('should return problematic for illegible markers', () => {
            expect(determineConfidence(0, 1)).toBe('problematic');
            expect(determineConfidence(5, 1)).toBe('problematic');
        });
    });

    describe('stripMarkers', () => {
        it('should remove uncertain markers', () => {
            expect(stripMarkers('[?]word')).toBe('word');
        });

        it('should remove illegible markers', () => {
            expect(stripMarkers('text [illegible] more')).toBe('text  more');
        });

        it('should remove all markers', () => {
            expect(stripMarkers('[?] word [illegible]')).toBe('word');
        });

        it('should handle null/empty input', () => {
            expect(stripMarkers(null)).toBe('');
            expect(stripMarkers('')).toBe('');
        });
    });

    describe('escapeHtml', () => {
        it('should escape ampersand', () => {
            expect(escapeHtml('a & b')).toBe('a &amp; b');
        });

        it('should escape angle brackets', () => {
            expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
        });

        it('should escape quotes', () => {
            expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
            expect(escapeHtml("'world'")).toBe('&#39;world&#39;');
        });

        it('should escape all special characters', () => {
            const input = '<div class="test">&\'</div>';
            const expected = '&lt;div class=&quot;test&quot;&gt;&amp;&#39;&lt;/div&gt;';
            expect(escapeHtml(input)).toBe(expected);
        });

        it('should handle null/empty input', () => {
            expect(escapeHtml(null)).toBe('');
            expect(escapeHtml('')).toBe('');
        });

        it('should preserve normal text', () => {
            expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
        });
    });

    describe('safeApplyMarkers', () => {
        it('should escape HTML then apply markers', () => {
            const result = safeApplyMarkers('<script>[?]</script>');
            expect(result).toContain('&lt;script&gt;');
            expect(result).toContain('marker-uncertain');
        });

        it('should handle normal text with markers', () => {
            const result = safeApplyMarkers('word [?] text');
            expect(result).toContain('marker-uncertain');
        });

        it('should handle null/empty input', () => {
            expect(safeApplyMarkers(null)).toBe('');
            expect(safeApplyMarkers('')).toBe('');
        });
    });
});
