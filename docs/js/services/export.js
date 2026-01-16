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
        this.formats = ['txt', 'json', 'md'];
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
