/**
 * PAGE-XML Parser
 *
 * Parses PAGE-XML format (Transkribus, etc.) into coOCR/HTR internal format.
 * Supports PAGE 2019-07-15 schema.
 *
 * Reference: https://www.primaresearch.org/schema/PAGE/gts/pagecontent/2019-07-15/
 */

import { appState } from '../../state.js';
import { dialogManager } from '../../components/dialogs.js';

// Namespace for PAGE-XML
const PAGE_NS = 'http://schema.primaresearch.org/PAGE/gts/pagecontent/2019-07-15';

/**
 * PAGE-XML Parser
 */
class PageXMLParser {
    constructor() {
        this.namespaceAware = true;
    }

    /**
     * Parse PAGE-XML string
     * @param {string} xmlString - The XML content
     * @returns {object} Parsed data with segments and metadata
     */
    parse(xmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, 'text/xml');

        // Check for parsing errors
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
            throw new Error(`XML parsing error: ${parseError.textContent}`);
        }

        // Extract metadata
        const metadata = this.extractMetadata(doc);

        // Extract page dimensions
        const page = this.findElement(doc, 'Page');
        const pageDimensions = page ? {
            width: parseInt(page.getAttribute('imageWidth') || '0', 10),
            height: parseInt(page.getAttribute('imageHeight') || '0', 10)
        } : { width: 0, height: 0 };

        // Extract image filename
        const imageFilename = page?.getAttribute('imageFilename') || '';

        // Extract text regions and lines
        const regions = this.extractRegions(doc, pageDimensions);
        const segments = this.extractSegments(doc, pageDimensions);

        return {
            metadata,
            pageDimensions,
            imageFilename,
            regions,
            segments,
            raw: xmlString
        };
    }

    /**
     * Extract metadata from PAGE-XML
     * @param {Document} doc - Parsed XML document
     * @returns {object} Metadata object
     */
    extractMetadata(doc) {
        const metadata = {
            creator: '',
            created: '',
            lastChange: '',
            comments: ''
        };

        const metadataEl = this.findElement(doc, 'Metadata');
        if (!metadataEl) return metadata;

        const creator = this.findElement(metadataEl, 'Creator');
        if (creator) metadata.creator = creator.textContent || '';

        const created = this.findElement(metadataEl, 'Created');
        if (created) metadata.created = created.textContent || '';

        const lastChange = this.findElement(metadataEl, 'LastChange');
        if (lastChange) metadata.lastChange = lastChange.textContent || '';

        const comments = this.findElement(metadataEl, 'Comments');
        if (comments) metadata.comments = comments.textContent || '';

        return metadata;
    }

    /**
     * Extract text regions from PAGE-XML
     * @param {Document} doc - Parsed XML document
     * @param {object} pageDimensions - Page width and height
     * @returns {Array} Array of region objects
     */
    extractRegions(doc, pageDimensions) {
        const regions = [];
        const textRegions = this.findElements(doc, 'TextRegion');

        textRegions.forEach((region, index) => {
            const id = region.getAttribute('id') || `region_${index}`;
            const coords = this.findElement(region, 'Coords');
            const points = coords?.getAttribute('points') || '';
            const bounds = this.polygonToBounds(points, pageDimensions);

            regions.push({
                id,
                type: 'TextRegion',
                bounds,
                polygon: points
            });
        });

        return regions;
    }

    /**
     * Extract text segments (lines) from PAGE-XML
     * @param {Document} doc - Parsed XML document
     * @param {object} pageDimensions - Page width and height
     * @returns {Array} Array of segment objects
     */
    extractSegments(doc, pageDimensions) {
        const segments = [];
        const textLines = this.findElements(doc, 'TextLine');

        textLines.forEach((line, index) => {
            const id = line.getAttribute('id') || `line_${index}`;

            // Get coordinates
            const coords = this.findElement(line, 'Coords');
            const points = coords?.getAttribute('points') || '';
            const bounds = this.polygonToBounds(points, pageDimensions);

            // Get text content
            const textEquiv = this.findElement(line, 'TextEquiv');
            const unicode = this.findElement(textEquiv, 'Unicode');
            const text = unicode?.textContent || '';

            // Get confidence if available
            const conf = textEquiv?.getAttribute('conf');
            const confidence = this.mapConfidence(conf);

            // Get baseline if available
            const baseline = this.findElement(line, 'Baseline');
            const baselinePoints = baseline?.getAttribute('points') || '';

            segments.push({
                id,
                lineNumber: index + 1,
                text,
                confidence,
                bounds,
                polygon: points,
                baseline: baselinePoints,
                fields: this.parseTextToFields(text)
            });
        });

        return segments;
    }

    /**
     * Convert polygon points to bounding box
     * @param {string} points - Points string "x1,y1 x2,y2 ..."
     * @param {object} pageDimensions - Page width and height for normalization
     * @returns {object} Bounding box { x, y, width, height } in percentages
     */
    polygonToBounds(points, pageDimensions) {
        if (!points || !pageDimensions.width || !pageDimensions.height) {
            return { x: 0, y: 0, width: 0, height: 0 };
        }

        const coords = points.split(' ').map(p => {
            const [x, y] = p.split(',').map(Number);
            return { x, y };
        });

        if (coords.length === 0) {
            return { x: 0, y: 0, width: 0, height: 0 };
        }

        // Find bounding box
        const minX = Math.min(...coords.map(c => c.x));
        const maxX = Math.max(...coords.map(c => c.x));
        const minY = Math.min(...coords.map(c => c.y));
        const maxY = Math.max(...coords.map(c => c.y));

        // Convert to percentages
        return {
            x: (minX / pageDimensions.width) * 100,
            y: (minY / pageDimensions.height) * 100,
            width: ((maxX - minX) / pageDimensions.width) * 100,
            height: ((maxY - minY) / pageDimensions.height) * 100
        };
    }

    /**
     * Map Transkribus confidence to categorical confidence
     * @param {string|number} conf - Confidence value (0-1 or percentage)
     * @returns {string} Categorical confidence
     */
    mapConfidence(conf) {
        if (conf === null || conf === undefined) return 'likely';

        const numConf = parseFloat(conf);
        if (isNaN(numConf)) return 'likely';

        // Normalize if percentage
        const normalized = numConf > 1 ? numConf / 100 : numConf;

        if (normalized >= 0.9) return 'certain';
        if (normalized >= 0.7) return 'likely';
        return 'uncertain';
    }

    /**
     * Parse text into structured fields (for table-like data)
     * @param {string} text - Line text
     * @returns {object} Parsed fields
     */
    parseTextToFields(text) {
        // Try to detect table structure (pipe-separated)
        if (text.includes('|')) {
            const cells = text.split('|').map(c => c.trim()).filter(c => c);
            const fields = {};
            const commonColumns = ['datum', 'name', 'beschreibung', 'betrag'];

            cells.forEach((cell, index) => {
                const key = commonColumns[index] || `col${index + 1}`;
                fields[key] = cell;
            });

            return fields;
        }

        // Try to detect tab-separated
        if (text.includes('\t')) {
            const cells = text.split('\t').map(c => c.trim());
            const fields = {};

            cells.forEach((cell, index) => {
                fields[`col${index + 1}`] = cell;
            });

            return fields;
        }

        // Single text field
        return { text };
    }

    /**
     * Find element handling namespaces
     * @param {Element|Document} parent - Parent element
     * @param {string} localName - Element local name
     * @returns {Element|null} Found element or null
     */
    findElement(parent, localName) {
        // Try with namespace
        let el = parent.getElementsByTagNameNS(PAGE_NS, localName)[0];
        if (el) return el;

        // Try without namespace (for documents without namespace)
        el = parent.getElementsByTagName(localName)[0];
        return el || null;
    }

    /**
     * Find all elements handling namespaces
     * @param {Element|Document} parent - Parent element
     * @param {string} localName - Element local name
     * @returns {Array} Array of found elements
     */
    findElements(parent, localName) {
        // Try with namespace
        let els = parent.getElementsByTagNameNS(PAGE_NS, localName);
        if (els.length > 0) return Array.from(els);

        // Try without namespace
        els = parent.getElementsByTagName(localName);
        return Array.from(els);
    }

    /**
     * Serialize parsed data back to PAGE-XML
     * @param {object} data - Parsed data
     * @returns {string} PAGE-XML string
     */
    serialize(data) {
        // Basic serialization - for future export functionality
        const lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            `<PcGts xmlns="${PAGE_NS}">`,
            '  <Metadata>',
            `    <Creator>coOCR/HTR</Creator>`,
            `    <Created>${new Date().toISOString()}</Created>`,
            '  </Metadata>',
            `  <Page imageFilename="${data.imageFilename || ''}" imageWidth="${data.pageDimensions?.width || 0}" imageHeight="${data.pageDimensions?.height || 0}">`,
            '    <TextRegion id="region_0">',
            '      <Coords points="0,0 100,0 100,100 0,100"/>',
        ];

        // Add text lines
        data.segments?.forEach((segment, index) => {
            lines.push(`      <TextLine id="${segment.id || `line_${index}`}">`);
            if (segment.polygon) {
                lines.push(`        <Coords points="${segment.polygon}"/>`);
            }
            if (segment.baseline) {
                lines.push(`        <Baseline points="${segment.baseline}"/>`);
            }
            lines.push('        <TextEquiv>');
            lines.push(`          <Unicode>${this.escapeXml(segment.text)}</Unicode>`);
            lines.push('        </TextEquiv>');
            lines.push('      </TextLine>');
        });

        lines.push('    </TextRegion>');
        lines.push('  </Page>');
        lines.push('</PcGts>');

        return lines.join('\n');
    }

    /**
     * Escape XML special characters
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeXml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}

// Export singleton instance
export const pageXMLParser = new PageXMLParser();

/**
 * Initialize PAGE-XML event listener
 */
function initPageXMLHandler() {
    document.addEventListener('pageXMLLoaded', (event) => {
        const { filename, content } = event.detail;

        try {
            const parsed = pageXMLParser.parse(content);

            // Update state with parsed data
            appState.setTranscription({
                provider: 'page-xml',
                model: 'import',
                raw: content,
                segments: parsed.segments,
                columns: [] // Will be auto-detected
            });

            // Update regions
            if (parsed.segments.length > 0) {
                const regions = parsed.segments.map(seg => ({
                    line: seg.lineNumber,
                    x: seg.bounds.x,
                    y: seg.bounds.y,
                    w: seg.bounds.width,
                    h: seg.bounds.height
                }));
                appState.setRegions(regions);
            }

            // Store metadata
            appState.data.meta.pageXML = parsed.metadata;

            if (dialogManager) {
                dialogManager.showToast(`Imported ${parsed.segments.length} lines from PAGE-XML`, 'success');
            }
        } catch (error) {
            console.error('PAGE-XML parsing error:', error);
            if (dialogManager) {
                dialogManager.showToast(`Failed to parse PAGE-XML: ${error.message}`, 'error');
            }
        }
    });
}

// Auto-initialize
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPageXMLHandler);
    } else {
        initPageXMLHandler();
    }
}

export { PageXMLParser };
