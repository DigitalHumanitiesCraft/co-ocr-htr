/**
 * Export Service
 *
 * Handles export of transcription data to various formats:
 * - Plain Text (.txt) - Tab-separated values
 * - JSON (.json) - Full data with metadata
 * - Markdown (.md) - Formatted table with validation notes
 */

import { appState } from '../state.js';

/**
 * Export Service
 */
class ExportService {
    constructor() {
        this.formats = ['txt', 'json', 'md', 'xml'];
    }

    /**
     * Export transcription in specified format
     * @param {string} format - Export format (txt, json, md)
     * @param {object} options - Export options
     * @returns {object} Export result with content and filename
     */
    export(format, options = {}) {
        const state = appState.getState();

        if (!state.transcription.segments?.length && !state.transcription.lines?.length) {
            throw new Error('No transcription data to export');
        }

        const {
            includeValidation = true,
            includeMetadata = false
        } = options;

        let content;
        let mimeType;
        let extension;

        switch (format) {
            case 'txt':
                content = this.exportTxt(state);
                mimeType = 'text/plain';
                extension = 'txt';
                break;
            case 'json':
                content = this.exportJson(state, includeValidation, includeMetadata);
                mimeType = 'application/json';
                extension = 'json';
                break;
            case 'md':
                content = this.exportMarkdown(state, includeValidation);
                mimeType = 'text/markdown';
                extension = 'md';
                break;
            case 'xml':
            case 'pagexml':
                content = this.exportPageXml(state);
                mimeType = 'application/xml';
                extension = 'xml';
                break;
            default:
                throw new Error(`Unknown export format: ${format}`);
        }

        const filename = this.generateFilename(state, extension);

        return {
            content,
            mimeType,
            filename,
            format
        };
    }

    /**
     * Export as plain text (tab-separated)
     */
    exportTxt(state) {
        const lines = [];

        // Use segments if available, otherwise fall back to lines
        if (state.transcription.segments?.length > 0) {
            state.transcription.segments.forEach(seg => {
                if (seg.fields) {
                    // Structured fields
                    lines.push(Object.values(seg.fields).join('\t'));
                } else {
                    lines.push(seg.text || '');
                }
            });
        } else if (state.transcription.lines?.length > 0) {
            // Legacy lines format - extract from markdown table
            state.transcription.lines.forEach(line => {
                // Skip header separator
                if (line.match(/^\|[-\s|]+\|$/)) return;

                // Convert pipe-separated to tab-separated
                if (line.startsWith('|') && line.endsWith('|')) {
                    const cells = line.split('|').slice(1, -1).map(c => c.trim());
                    lines.push(cells.join('\t'));
                } else {
                    lines.push(line);
                }
            });
        }

        return lines.join('\n');
    }

    /**
     * Export as JSON
     */
    exportJson(state, includeValidation, includeMetadata) {
        const data = {
            transcription: {
                segments: state.transcription.segments || [],
                columns: state.transcription.columns || []
            }
        };

        if (includeValidation && state.validation) {
            data.validation = {
                status: state.validation.status,
                rules: state.validation.rules || [],
                llmJudge: state.validation.llmJudge
            };
        }

        if (includeMetadata) {
            data.metadata = {
                document: {
                    filename: state.document.filename,
                    mimeType: state.document.mimeType
                },
                transcription: {
                    provider: state.transcription.provider,
                    model: state.transcription.model
                },
                timestamp: new Date().toISOString(),
                corrections: state.corrections || []
            };
        }

        return JSON.stringify(data, null, 2);
    }

    /**
     * Export as Markdown
     */
    exportMarkdown(state, includeValidation) {
        const lines = [];
        const filename = state.document.filename || 'Transcription';

        // Header
        lines.push(`# ${filename}`);
        lines.push('');

        // Provider info
        if (state.transcription.provider) {
            lines.push(`*Transcribed with ${state.transcription.provider} (${state.transcription.model || 'default'})*`);
            lines.push('');
        }

        // Table
        if (state.transcription.segments?.length > 0) {
            lines.push(this.segmentsToMarkdownTable(state.transcription.segments, state.transcription.columns));
        } else if (state.transcription.lines?.length > 0) {
            // Use raw lines (already markdown table)
            lines.push(...state.transcription.lines);
        }

        lines.push('');

        // Validation notes
        if (includeValidation && state.validation?.rules?.length > 0) {
            lines.push('## Validation Notes');
            lines.push('');

            const issues = state.validation.rules.filter(r =>
                r.type === 'warning' || r.type === 'error'
            );

            if (issues.length > 0) {
                issues.forEach(rule => {
                    const icon = rule.type === 'error' ? '!' : '?';
                    const lineInfo = rule.lines?.length > 0
                        ? ` (Line ${rule.lines.join(', ')})`
                        : '';
                    lines.push(`- [${icon}] ${rule.name}${lineInfo}: ${rule.message}`);
                });
            } else {
                lines.push('No issues found.');
            }

            lines.push('');

            // LLM-Judge assessment
            if (state.validation.llmJudge) {
                lines.push('### AI Assessment');
                lines.push('');
                const confidence = {
                    certain: 'High Confidence',
                    likely: 'Medium Confidence',
                    uncertain: 'Low Confidence'
                }[state.validation.llmJudge.confidence] || state.validation.llmJudge.confidence;

                lines.push(`**${confidence}** (${state.validation.llmJudge.perspective || 'general'})`);
                lines.push('');
                if (state.validation.llmJudge.reasoning) {
                    lines.push(state.validation.llmJudge.reasoning);
                    lines.push('');
                }
            }
        }

        // Footer
        lines.push('---');
        lines.push(`*Exported ${new Date().toLocaleString()}*`);

        return lines.join('\n');
    }

    /**
     * Export as PAGE-XML (2019-07-15 schema)
     */
    exportPageXml(state) {
        const timestamp = new Date().toISOString();
        const filename = state.document.filename || 'unknown';
        const segments = state.transcription.segments || [];
        const regions = state.regions || [];

        // Try to get image dimensions from state
        const imageWidth = state.image?.naturalWidth || state.document?.width || 0;
        const imageHeight = state.image?.naturalHeight || state.document?.height || 0;

        const lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<PcGts xmlns="http://schema.primaresearch.org/PAGE/gts/pagecontent/2019-07-15"',
            '       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
            '       xsi:schemaLocation="http://schema.primaresearch.org/PAGE/gts/pagecontent/2019-07-15 http://schema.primaresearch.org/PAGE/gts/pagecontent/2019-07-15/pagecontent.xsd">',
            '  <Metadata>',
            '    <Creator>coOCR/HTR</Creator>',
            `    <Created>${timestamp}</Created>`,
            `    <LastChange>${timestamp}</LastChange>`,
            '  </Metadata>',
            `  <Page imageFilename="${this.escapeXml(filename)}" imageWidth="${imageWidth}" imageHeight="${imageHeight}">`,
            '    <TextRegion id="region_0" type="paragraph">',
            '      <Coords points="0,0 ' + imageWidth + ',0 ' + imageWidth + ',' + imageHeight + ' 0,' + imageHeight + '"/>',
        ];

        // Add text lines
        segments.forEach((segment, index) => {
            const lineId = segment.id || `line_${index + 1}`;
            const region = regions[index];

            // Generate coordinates
            let coordsPoints;
            if (region && !region.synthetic && imageWidth > 0 && imageHeight > 0) {
                // Convert percentage to absolute coordinates
                const x1 = Math.round((region.x / 100) * imageWidth);
                const y1 = Math.round((region.y / 100) * imageHeight);
                const x2 = Math.round(((region.x + region.w) / 100) * imageWidth);
                const y2 = Math.round(((region.y + region.h) / 100) * imageHeight);
                coordsPoints = `${x1},${y1} ${x2},${y1} ${x2},${y2} ${x1},${y2}`;
            } else if (segment.polygon) {
                // Use existing polygon from import
                coordsPoints = segment.polygon;
            } else {
                // Fallback: estimate based on line number
                const lineHeight = imageHeight / Math.max(segments.length, 1);
                const y1 = Math.round(index * lineHeight);
                const y2 = Math.round((index + 1) * lineHeight);
                coordsPoints = `0,${y1} ${imageWidth},${y1} ${imageWidth},${y2} 0,${y2}`;
            }

            lines.push(`      <TextLine id="${lineId}">`);
            lines.push(`        <Coords points="${coordsPoints}"/>`);

            // Add baseline if available
            if (segment.baseline) {
                lines.push(`        <Baseline points="${segment.baseline}"/>`);
            }

            // Add text content
            const text = this.escapeXml(segment.text || '');
            const confidence = this.mapConfidenceToNumber(segment.confidence);

            lines.push(`        <TextEquiv${confidence ? ` conf="${confidence}"` : ''}>`);
            lines.push(`          <Unicode>${text}</Unicode>`);
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
     */
    escapeXml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Map categorical confidence to numeric value
     */
    mapConfidenceToNumber(confidence) {
        const map = {
            certain: 0.95,
            likely: 0.75,
            uncertain: 0.5
        };
        return map[confidence] || null;
    }

    /**
     * Convert segments to markdown table
     */
    segmentsToMarkdownTable(segments, columns) {
        if (!segments || segments.length === 0) return '';

        // Determine columns
        let headers;
        if (columns?.length > 0) {
            headers = columns.map(c => c.label || c.id);
        } else {
            // Infer from first segment
            const firstFields = segments[0]?.fields || {};
            headers = Object.keys(firstFields);
            if (headers.length === 0) {
                headers = ['#', 'Text'];
            }
        }

        const lines = [];

        // Header row
        lines.push(`| ${headers.join(' | ')} |`);
        lines.push(`| ${headers.map(() => '---').join(' | ')} |`);

        // Data rows
        segments.forEach((seg, idx) => {
            let cells;
            if (seg.fields && Object.keys(seg.fields).length > 0) {
                cells = headers.map(h => {
                    const key = h.toLowerCase().replace(/\s+/g, '_');
                    return seg.fields[key] || seg.fields[h] || '';
                });
            } else {
                cells = [idx + 1, seg.text || ''];
            }
            lines.push(`| ${cells.join(' | ')} |`);
        });

        return lines.join('\n');
    }

    /**
     * Generate filename for export
     */
    generateFilename(state, extension) {
        const baseName = state.document.filename
            ? state.document.filename.replace(/\.[^.]+$/, '')
            : 'transcription';

        const timestamp = new Date().toISOString().slice(0, 10);

        return `${baseName}_${timestamp}.${extension}`;
    }

    /**
     * Trigger file download
     */
    download(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    /**
     * Export and download in one step
     */
    exportAndDownload(format, options = {}) {
        const result = this.export(format, options);
        this.download(result.content, result.filename, result.mimeType);
        return result;
    }
}

// Export singleton instance
export const exportService = new ExportService();
export { ExportService };
