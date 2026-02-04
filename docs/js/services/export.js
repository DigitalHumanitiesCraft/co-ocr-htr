/**
 * Export Service
 *
 * Handles export of transcription data to various formats:
 * - Plain Text (.txt) - Tab-separated values
 * - JSON (.json) - Full data with metadata
 * - Markdown (.md) - Formatted table with validation notes
 * - PAGE-XML (.xml) - PAGE 2019-07-15 schema
 * - TEI-XML (.tei.xml) - TEI P5 minimal schema
 */

import { appState } from '../state.js';

/**
 * Export Service
 */
class ExportService {
    constructor() {
        this.formats = ['txt', 'json', 'md', 'xml', 'tei'];
    }

    /**
     * Export transcription in specified format
     * @param {string} format - Export format (txt, json, md)
     * @param {object} options - Export options
     * @returns {object} Export result with content and filename
     */
    export(format, options = {}) {
        const state = appState.getState();

        // Check for any transcription data: segments, lines, or raw text
        const hasSegments = state.transcription.segments?.length > 0;
        const hasLines = state.transcription.lines?.length > 0;
        const hasRaw = state.transcription.raw?.trim().length > 0;

        if (!hasSegments && !hasLines && !hasRaw) {
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
            case 'tei':
            case 'tei-xml':
                content = this.exportTei(state);
                mimeType = 'application/xml';
                extension = 'tei.xml';
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

        // Use segments if available, otherwise fall back to lines or raw
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
        } else if (state.transcription.raw?.trim()) {
            // Use raw text directly
            return state.transcription.raw.trim();
        }

        return lines.join('\n');
    }

    /**
     * Export as JSON
     */
    exportJson(state, includeValidation, includeMetadata) {
        const data = {
            transcription: {
                raw: state.transcription.raw || '',
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

        // Transcription content
        if (state.transcription.segments?.length > 0) {
            lines.push(this.segmentsToMarkdownTable(state.transcription.segments, state.transcription.columns));
        } else if (state.transcription.lines?.length > 0) {
            // Use raw lines (already markdown table)
            lines.push(...state.transcription.lines);
        } else if (state.transcription.raw?.trim()) {
            // Use raw text in a code block for readability
            lines.push('## Transcription');
            lines.push('');
            lines.push('```');
            lines.push(state.transcription.raw.trim());
            lines.push('```');
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

                lines.push(`**${confidence}**`);
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
     * Export as TEI-XML (TEI P5 minimal schema)
     * Suitable for integration with digital edition projects
     */
    exportTei(state) {
        const filename = state.document.filename || 'transcription';
        const segments = state.transcription.segments || [];
        const timestamp = new Date().toISOString();

        // Build TEI body lines
        const bodyLines = [];

        if (segments.length > 0) {
            segments.forEach((segment, index) => {
                let text = this.escapeXml(segment.text || '');

                // Convert coOCR/HTR markers to TEI elements
                // [word]? or [?word] -> <unclear>word</unclear>
                text = text.replace(/\[([^\]]+)\]\?/g, '<unclear>$1</unclear>');
                text = text.replace(/\[\?([^\]]+)\]/g, '<unclear>$1</unclear>');

                // [?] alone -> <gap reason="illegible"/>
                text = text.replace(/\[\?\]/g, '<gap reason="illegible"/>');

                // [illegible] or [...] -> <gap reason="illegible"/>
                text = text.replace(/\[illegible\]/gi, '<gap reason="illegible"/>');
                text = text.replace(/\[\.\.\.\]/g, '<gap reason="illegible"/>');

                // [abbr:expansion] -> <choice><abbr>abbr</abbr><expan>expansion</expan></choice>
                text = text.replace(/\[([^\]:]+):([^\]]+)\]/g,
                    '<choice><abbr>$1</abbr><expan>$2</expan></choice>');

                // Add line break element if not last line
                const lb = index < segments.length - 1 ? '<lb/>' : '';

                bodyLines.push(`        <ab n="${index + 1}">${text}${lb}</ab>`);
            });
        } else if (state.transcription.raw?.trim()) {
            // Fallback to raw text, split by lines
            const rawLines = state.transcription.raw.trim().split('\n');
            rawLines.forEach((line, index) => {
                const text = this.escapeXml(line);
                const lb = index < rawLines.length - 1 ? '<lb/>' : '';
                bodyLines.push(`        <ab n="${index + 1}">${text}${lb}</ab>`);
            });
        }

        // Provider/model info for respStmt
        const provider = state.transcription.provider || 'unknown';
        const model = state.transcription.model || '';

        return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-model href="http://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader>
    <fileDesc>
      <titleStmt>
        <title>${this.escapeXml(filename)}</title>
      </titleStmt>
      <publicationStmt>
        <p>Transcription generated by coOCR/HTR Workbench</p>
      </publicationStmt>
      <sourceDesc>
        <p>Source: ${this.escapeXml(filename)}</p>
      </sourceDesc>
    </fileDesc>
    <encodingDesc>
      <appInfo>
        <application ident="coOCR-HTR" version="1.0">
          <label>coOCR/HTR Workbench</label>
        </application>
      </appInfo>
    </encodingDesc>
    <revisionDesc>
      <change when="${timestamp.slice(0, 10)}">
        Transcription created via ${provider}${model ? ` (${model})` : ''}
      </change>
    </revisionDesc>
  </teiHeader>
  <text>
    <body>
      <div>
${bodyLines.join('\n')}
      </div>
    </body>
  </text>
</TEI>`;
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

    /**
     * Load external script dynamically
     * @param {string} src - Script URL
     * @returns {Promise}
     */
    _loadScript(src) {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (window.JSZip) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
        });
    }

    /**
     * Export all pages as ZIP archive
     * @param {string} format - Export format per file (txt, json, md, xml, tei)
     * @param {object} options - Export options
     * @returns {Promise<object>} Result with filename and page count
     */
    async exportAllPagesZip(format, options = {}) {
        // Load JSZip dynamically (only when needed)
        await this._loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');

        const state = appState.getState();
        const pages = state.pages || [];
        const pageTranscriptions = state.pageTranscriptions || {};

        if (pages.length === 0) {
            throw new Error('No pages to export');
        }

        // Create ZIP
        const zip = new window.JSZip();
        const docName = state.document.filename?.replace(/\.[^.]+$/, '') || 'transcription';
        const folder = zip.folder(docName);

        let exportedCount = 0;

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const transcription = pageTranscriptions[page.id];

            // Skip pages without transcription
            if (!transcription?.raw && !transcription?.segments?.length) {
                continue;
            }

            // Create temporary state for this page's export
            const pageState = {
                document: {
                    filename: page.filename,
                    width: page.width,
                    height: page.height
                },
                transcription: {
                    raw: transcription.raw || '',
                    segments: transcription.segments || [],
                    lines: transcription.lines || [],
                    provider: transcription.provider || '',
                    model: transcription.model || ''
                },
                validation: state.batchValidations.find(v => v.pageIndex === i)?.validation || null,
                regions: transcription.regions || [],
                image: { width: page.width, height: page.height }
            };

            // Generate content for this page
            const content = this._exportPageContent(format, pageState, options);
            const extension = this._getExtension(format);
            const filename = `${page.filename?.replace(/\.[^.]+$/, '') || `page_${i + 1}`}.${extension}`;

            folder.file(filename, content);
            exportedCount++;
        }

        if (exportedCount === 0) {
            throw new Error('No pages with transcriptions to export');
        }

        // Add manifest
        const manifest = {
            exportDate: new Date().toISOString(),
            format: format,
            pageCount: pages.length,
            exportedPages: exportedCount,
            tool: 'coOCR/HTR',
            version: '2.1'
        };
        folder.file('manifest.json', JSON.stringify(manifest, null, 2));

        // Generate and download
        const blob = await zip.generateAsync({ type: 'blob' });
        const timestamp = new Date().toISOString().slice(0, 10);
        const zipFilename = `${docName}_${timestamp}.zip`;

        this.download(blob, zipFilename, 'application/zip');

        return { filename: zipFilename, pageCount: exportedCount };
    }

    /**
     * Export content for a single page (used by ZIP export)
     * @param {string} format - Export format
     * @param {object} pageState - Page-specific state
     * @param {object} options - Export options
     * @returns {string} Exported content
     */
    _exportPageContent(format, pageState, options) {
        const { includeValidation = true } = options;

        switch (format) {
            case 'txt':
                return this.exportTxt(pageState);
            case 'json':
                return this.exportJson(pageState, includeValidation, false);
            case 'md':
                return this.exportMarkdown(pageState, includeValidation);
            case 'xml':
            case 'pagexml':
                return this.exportPageXml(pageState);
            case 'tei':
            case 'tei-xml':
                return this.exportTei(pageState);
            default:
                return pageState.transcription?.raw || '';
        }
    }

    /**
     * Get file extension for format
     * @param {string} format - Export format
     * @returns {string} File extension
     */
    _getExtension(format) {
        switch (format) {
            case 'txt': return 'txt';
            case 'json': return 'json';
            case 'md': return 'md';
            case 'xml':
            case 'pagexml': return 'xml';
            case 'tei':
            case 'tei-xml': return 'tei.xml';
            default: return 'txt';
        }
    }
}

// Export singleton instance
export const exportService = new ExportService();
export { ExportService };
