/**
 * Tests for Export Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExportService } from '../js/services/export.js';

// Mock appState module
vi.mock('../js/state.js', () => ({
  appState: {
    getState: vi.fn()
  }
}));

import { appState } from '../js/state.js';

describe('ExportService', () => {
  let service;
  let mockState;

  beforeEach(() => {
    service = new ExportService();
    vi.clearAllMocks();

    // Default mock state
    mockState = {
      document: {
        filename: 'test-document.jpg',
        mimeType: 'image/jpeg',
        width: 1000,
        height: 1500
      },
      image: {
        naturalWidth: 1000,
        naturalHeight: 1500
      },
      transcription: {
        provider: 'gemini',
        model: 'gemini-3-flash-preview',
        segments: [
          { lineNumber: 1, text: 'First line of text', confidence: 'certain' },
          { lineNumber: 2, text: 'Second line with [?] uncertain', confidence: 'likely' },
          { lineNumber: 3, text: 'Third line [illegible] here', confidence: 'uncertain' }
        ],
        columns: []
      },
      regions: [
        { line: 1, x: 5, y: 10, w: 90, h: 8 },
        { line: 2, x: 5, y: 20, w: 90, h: 8 },
        { line: 3, x: 5, y: 30, w: 90, h: 8 }
      ],
      validation: {
        status: 'complete',
        rules: [
          { name: 'Date Format', type: 'pass', message: 'All dates valid' },
          { name: 'Uncertainty Markers', type: 'warning', message: 'Found uncertain readings', lines: [2] }
        ]
      }
    };

    appState.getState.mockReturnValue(mockState);
  });

  describe('Supported Formats', () => {
    it('should support txt, json, md, xml, and tei formats', () => {
      expect(service.formats).toContain('txt');
      expect(service.formats).toContain('json');
      expect(service.formats).toContain('md');
      expect(service.formats).toContain('xml');
      expect(service.formats).toContain('tei');
    });
  });

  describe('Export Validation', () => {
    it('should throw error if no transcription data', () => {
      appState.getState.mockReturnValue({
        transcription: { segments: [], lines: [] }
      });

      expect(() => service.export('txt')).toThrow('No transcription data to export');
    });

    it('should throw error for unknown format', () => {
      expect(() => service.export('pdf')).toThrow('Unknown export format');
    });
  });

  describe('Plain Text Export', () => {
    it('should export segments as tab-separated text', () => {
      const result = service.export('txt');

      expect(result.format).toBe('txt');
      expect(result.mimeType).toBe('text/plain');
      expect(result.filename).toMatch(/\.txt$/);
      expect(result.content).toContain('First line of text');
      expect(result.content).toContain('Second line');
    });

    it('should handle segments with fields', () => {
      mockState.transcription.segments = [
        { lineNumber: 1, text: 'Test', fields: { date: '1.5.1850', name: 'Müller', amount: '5 Taler' } }
      ];
      appState.getState.mockReturnValue(mockState);

      const result = service.export('txt');
      expect(result.content).toContain('1.5.1850');
      expect(result.content).toContain('Müller');
      expect(result.content).toContain('5 Taler');
    });

    it('should prefer raw-aligned text when segments are stale and unstructured', () => {
      mockState.transcription.raw = 'Corrected line 1\nCorrected line 2';
      mockState.transcription.segments = [
        { lineNumber: 1, text: 'Old line 1' },
        { lineNumber: 2, text: 'Old line 2' }
      ];
      appState.getState.mockReturnValue(mockState);

      const result = service.export('txt');
      expect(result.content).toBe('Corrected line 1\nCorrected line 2');
    });
  });

  describe('JSON Export', () => {
    it('should export valid JSON', () => {
      const result = service.export('json');

      expect(result.format).toBe('json');
      expect(result.mimeType).toBe('application/json');
      expect(result.filename).toMatch(/\.json$/);

      const parsed = JSON.parse(result.content);
      expect(parsed.transcription).toBeDefined();
      expect(parsed.transcription.segments).toHaveLength(3);
    });

    it('should include validation when requested', () => {
      const result = service.export('json', { includeValidation: true });
      const parsed = JSON.parse(result.content);

      expect(parsed.validation).toBeDefined();
      expect(parsed.validation.status).toBe('complete');
    });

    it('should include metadata when requested', () => {
      const result = service.export('json', { includeMetadata: true });
      const parsed = JSON.parse(result.content);

      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.document.filename).toBe('test-document.jpg');
      expect(parsed.metadata.transcription.provider).toBe('gemini');
    });
  });

  describe('Markdown Export', () => {
    it('should export as markdown with header', () => {
      const result = service.export('md');

      expect(result.format).toBe('md');
      expect(result.mimeType).toBe('text/markdown');
      expect(result.filename).toMatch(/\.md$/);
      expect(result.content).toContain('# test-document.jpg');
    });

    it('should include provider info', () => {
      const result = service.export('md');
      expect(result.content).toContain('gemini');
    });

    it('should include validation notes when present', () => {
      const result = service.export('md', { includeValidation: true });
      expect(result.content).toContain('Validation Notes');
      expect(result.content).toContain('Uncertainty Markers');
    });

    it('should render pipeline notice for canonical object schema', () => {
      mockState.validation.pipeline = {
        stage2: { status: 'success', duration: 1200 },
        stage3: { status: 'success', duration: 800 },
        duration: 2000
      };
      appState.getState.mockReturnValue(mockState);

      const result = service.export('md', { includeValidation: true });
      expect(result.content).toContain('**Pipeline:** Paleographic + Philological review');
    });

    it('should render pipeline notice for legacy string schema', () => {
      mockState.validation.pipeline = {
        stage2: 'success',
        stage3: 'success',
        duration: 1800
      };
      appState.getState.mockReturnValue(mockState);

      const result = service.export('md', { includeValidation: true });
      expect(result.content).toContain('**Pipeline:** Paleographic + Philological review');
    });
  });

  describe('PAGE-XML Export', () => {
    it('should export valid PAGE-XML structure', () => {
      const result = service.export('xml');

      expect(result.format).toBe('xml');
      expect(result.mimeType).toBe('application/xml');
      expect(result.filename).toMatch(/\.xml$/);
      expect(result.content).toContain('<?xml version="1.0"');
      expect(result.content).toContain('<PcGts');
      expect(result.content).toContain('</PcGts>');
    });

    it('should include PAGE 2019-07-15 namespace', () => {
      const result = service.export('xml');
      expect(result.content).toContain('http://schema.primaresearch.org/PAGE/gts/pagecontent/2019-07-15');
    });

    it('should include metadata section', () => {
      const result = service.export('xml');
      expect(result.content).toContain('<Metadata>');
      expect(result.content).toContain('<Creator>coOCR/HTR</Creator>');
      expect(result.content).toContain('<Created>');
    });

    it('should include page dimensions', () => {
      const result = service.export('xml');
      expect(result.content).toContain('imageWidth="1000"');
      expect(result.content).toContain('imageHeight="1500"');
    });

    it('should include TextLine elements for each segment', () => {
      const result = service.export('xml');
      expect(result.content).toContain('<TextLine id="line_1">');
      expect(result.content).toContain('<TextLine id="line_2">');
      expect(result.content).toContain('<TextLine id="line_3">');
    });

    it('should include Unicode text content', () => {
      const result = service.export('xml');
      expect(result.content).toContain('<Unicode>First line of text</Unicode>');
    });

    it('should include confidence values', () => {
      const result = service.export('xml');
      expect(result.content).toContain('conf="0.95"'); // certain
      expect(result.content).toContain('conf="0.75"'); // likely
      expect(result.content).toContain('conf="0.5"');  // uncertain
    });

    it('should generate coordinates from regions', () => {
      const result = service.export('xml');
      // Region 1: x=5%, y=10%, w=90%, h=8% of 1000x1500
      // x1=50, y1=150, x2=950, y2=270
      expect(result.content).toContain('<Coords points="50,150 950,150 950,270 50,270"/>');
    });

    it('should handle pagexml alias', () => {
      const result = service.export('pagexml');
      // Format stays as 'pagexml' but extension is 'xml'
      expect(result.filename).toMatch(/\.xml$/);
      expect(result.content).toContain('<PcGts');
    });
  });

  describe('XML Escaping', () => {
    it('should escape XML special characters', () => {
      expect(service.escapeXml('Test & <value>')).toBe('Test &amp; &lt;value&gt;');
      expect(service.escapeXml('"quoted"')).toBe('&quot;quoted&quot;');
      expect(service.escapeXml("it's")).toBe("it&apos;s");
    });

    it('should handle empty/null input', () => {
      expect(service.escapeXml('')).toBe('');
      expect(service.escapeXml(null)).toBe('');
      expect(service.escapeXml(undefined)).toBe('');
    });

    it('should escape special characters in PAGE-XML export', () => {
      mockState.transcription.segments = [
        { lineNumber: 1, text: 'Müller & Söhne <GmbH>', confidence: 'certain' }
      ];
      appState.getState.mockReturnValue(mockState);

      const result = service.export('xml');
      expect(result.content).toContain('Müller &amp; Söhne &lt;GmbH&gt;');
    });
  });

  describe('Confidence Mapping', () => {
    it('should map categorical confidence to numbers', () => {
      expect(service.mapConfidenceToNumber('certain')).toBe(0.95);
      expect(service.mapConfidenceToNumber('likely')).toBe(0.75);
      expect(service.mapConfidenceToNumber('uncertain')).toBe(0.5);
    });

    it('should return null for unknown confidence', () => {
      expect(service.mapConfidenceToNumber('unknown')).toBeNull();
      expect(service.mapConfidenceToNumber(null)).toBeNull();
      expect(service.mapConfidenceToNumber(undefined)).toBeNull();
    });
  });

  describe('Filename Generation', () => {
    it('should generate filename with date', () => {
      const result = service.export('txt');
      const today = new Date().toISOString().slice(0, 10);
      expect(result.filename).toContain(today);
    });

    it('should use document filename as base', () => {
      const result = service.export('txt');
      expect(result.filename).toContain('test-document');
    });

    it('should fallback to "transcription" if no filename', () => {
      mockState.document.filename = '';
      appState.getState.mockReturnValue(mockState);

      const result = service.export('txt');
      expect(result.filename).toContain('transcription');
    });

    it('should strip original extension from filename', () => {
      const result = service.export('txt');
      expect(result.filename).not.toContain('.jpg');
    });
  });

  describe('Segments to Markdown Table', () => {
    it('should convert segments to markdown table format', () => {
      // Use field keys that match header labels (lowercase with underscores)
      const segments = [
        { lineNumber: 1, text: 'Line 1', fields: { datum: '1.5.', name: 'Müller' } },
        { lineNumber: 2, text: 'Line 2', fields: { datum: '2.5.', name: 'Schmidt' } }
      ];
      const columns = [{ id: 'datum', label: 'Datum' }, { id: 'name', label: 'Name' }];

      const table = service.segmentsToMarkdownTable(segments, columns);

      expect(table).toContain('| Datum | Name |');
      expect(table).toContain('| --- | --- |');
      expect(table).toContain('| 1.5. | Müller |');
      expect(table).toContain('| 2.5. | Schmidt |');
    });

    it('should handle segments without fields', () => {
      const segments = [
        { lineNumber: 1, text: 'Just text' }
      ];

      const table = service.segmentsToMarkdownTable(segments, []);

      expect(table).toContain('| # | Text |');
      expect(table).toContain('| 1 | Just text |');
    });

    it('should return empty string for empty segments', () => {
      expect(service.segmentsToMarkdownTable([], [])).toBe('');
      expect(service.segmentsToMarkdownTable(null, [])).toBe('');
    });
  });

  describe('TEI-XML Export', () => {
    it('should include tei format in supported formats', () => {
      expect(service.formats).toContain('tei');
    });

    it('should export valid TEI structure', () => {
      const result = service.export('tei');

      expect(result.content).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result.content).toContain('<TEI xmlns="http://www.tei-c.org/ns/1.0">');
      expect(result.content).toContain('<teiHeader>');
      expect(result.content).toContain('<fileDesc>');
      expect(result.content).toContain('<titleStmt>');
      expect(result.content).toContain('<publicationStmt>');
      expect(result.content).toContain('<sourceDesc>');
      expect(result.content).toContain('</teiHeader>');
      expect(result.content).toContain('<text>');
      expect(result.content).toContain('<body>');
      expect(result.content).toContain('</TEI>');
    });

    it('should have correct MIME type and extension', () => {
      const result = service.export('tei');

      expect(result.mimeType).toBe('application/xml');
      expect(result.filename).toContain('.tei.xml');
    });

    it('should include filename in title', () => {
      const result = service.export('tei');

      // Filename includes extension in title
      expect(result.content).toContain('<title>test-document.jpg</title>');
    });

    it('should include provider info in revisionDesc', () => {
      const result = service.export('tei');

      expect(result.content).toContain('gemini');
      expect(result.content).toContain('gemini-3-flash-preview');
    });

    it('should number lines with n attribute', () => {
      const result = service.export('tei');

      expect(result.content).toContain('<ab n="1">');
      expect(result.content).toContain('<ab n="2">');
      expect(result.content).toContain('<ab n="3">');
    });

    it('should escape XML special characters', () => {
      mockState.transcription.segments = [
        { text: 'Text with <angle> brackets & ampersand' }
      ];
      appState.getState.mockReturnValue(mockState);

      const result = service.export('tei');

      expect(result.content).toContain('&lt;angle&gt;');
      expect(result.content).toContain('&amp;');
      expect(result.content).not.toContain('<angle>');
    });

    it('should convert [?] marker to gap element', () => {
      mockState.transcription.segments = [
        { text: 'Reading with [?] unclear part' }
      ];
      appState.getState.mockReturnValue(mockState);

      const result = service.export('tei');

      expect(result.content).toContain('<gap reason="illegible"/>');
      expect(result.content).not.toContain('[?]');
    });

    it('should convert [word]? marker to unclear element', () => {
      mockState.transcription.segments = [
        { text: 'The word [reading]? is uncertain' }
      ];
      appState.getState.mockReturnValue(mockState);

      const result = service.export('tei');

      expect(result.content).toContain('<unclear>reading</unclear>');
      expect(result.content).not.toContain('[reading]?');
    });

    it('should convert [illegible] marker to gap element', () => {
      mockState.transcription.segments = [
        { text: 'Text with [illegible] section' }
      ];
      appState.getState.mockReturnValue(mockState);

      const result = service.export('tei');

      expect(result.content).toContain('<gap reason="illegible"/>');
      expect(result.content).not.toContain('[illegible]');
    });

    it('should convert [...] marker to gap element', () => {
      mockState.transcription.segments = [
        { text: 'Text with [...] missing' }
      ];
      appState.getState.mockReturnValue(mockState);

      const result = service.export('tei');

      expect(result.content).toContain('<gap reason="illegible"/>');
      expect(result.content).not.toContain('[...]');
    });

    it('should convert abbreviation markers to choice elements', () => {
      mockState.transcription.segments = [
        { text: 'The [Dr:Doctor] visited' }
      ];
      appState.getState.mockReturnValue(mockState);

      const result = service.export('tei');

      expect(result.content).toContain('<choice><abbr>Dr</abbr><expan>Doctor</expan></choice>');
      expect(result.content).not.toContain('[Dr:Doctor]');
    });

    it('should add line breaks between lines except last', () => {
      const result = service.export('tei');

      // Count <lb/> occurrences - should be segments.length - 1
      const lbCount = (result.content.match(/<lb\/>/g) || []).length;
      expect(lbCount).toBe(mockState.transcription.segments.length - 1);
    });

    it('should handle empty segments gracefully', () => {
      mockState.transcription.segments = [];
      mockState.transcription.raw = 'Line one\nLine two';
      appState.getState.mockReturnValue(mockState);

      const result = service.export('tei');

      expect(result.content).toContain('<ab n="1">Line one<lb/></ab>');
      expect(result.content).toContain('<ab n="2">Line two</ab>');
    });

    it('should include application info in encodingDesc', () => {
      const result = service.export('tei');

      expect(result.content).toContain('<encodingDesc>');
      expect(result.content).toContain('<appInfo>');
      expect(result.content).toContain('coOCR-HTR');
      expect(result.content).toContain('coOCR/HTR Workbench');
    });

    it('should include TEI schema reference', () => {
      const result = service.export('tei');

      expect(result.content).toContain('<?xml-model');
      expect(result.content).toContain('tei_all.rng');
    });

    it('should also accept tei-xml as format alias', () => {
      const result = service.export('tei-xml');

      expect(result.content).toContain('<TEI');
      expect(result.format).toBe('tei-xml');
    });
  });

  describe('Validation Persistence in Export', () => {
    beforeEach(() => {
      mockState.validation = {
        status: 'complete',
        rules: [
          { name: 'Uncertainty Markers', type: 'warning', message: 'Found uncertain readings', lines: [2] }
        ],
        llmJudge: { confidence: 'likely', reasoning: 'Looks reasonable' },
        summary: { totalIssues: 1 },
        timestamp: '2026-02-11T10:00:00.000Z',
        customPrompt: 'Check for Latin abbreviations'
      };
      appState.getState.mockReturnValue(mockState);
    });

    it('should include summary, timestamp, and customPrompt in JSON export', () => {
      const result = service.export('json', { includeValidation: true });
      const parsed = JSON.parse(result.content);

      expect(parsed.validation.summary).toEqual({ totalIssues: 1 });
      expect(parsed.validation.timestamp).toBe('2026-02-11T10:00:00.000Z');
      expect(parsed.validation.customPrompt).toBe('Check for Latin abbreviations');
    });

    it('should show custom prompt as blockquote in Markdown export', () => {
      const result = service.export('md', { includeValidation: true });

      expect(result.content).toContain('**Expert Prompt:**');
      expect(result.content).toContain('> Check for Latin abbreviations');
    });

    it('should not show expert prompt section when customPrompt is empty', () => {
      mockState.validation.customPrompt = '';
      appState.getState.mockReturnValue(mockState);

      const result = service.export('md', { includeValidation: true });

      expect(result.content).not.toContain('**Expert Prompt:**');
    });
  });
});
