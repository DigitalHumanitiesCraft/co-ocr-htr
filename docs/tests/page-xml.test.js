/**
 * PAGE-XML Parser Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PageXMLParser } from '../js/services/parsers/page-xml.js';

// Sample PAGE-XML for testing
const SAMPLE_PAGE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<PcGts xmlns="http://schema.primaresearch.org/PAGE/gts/pagecontent/2019-07-15">
  <Metadata>
    <Creator>Transkribus</Creator>
    <Created>2024-01-15T10:30:00Z</Created>
    <LastChange>2024-01-15T11:00:00Z</LastChange>
    <Comments>Test document</Comments>
  </Metadata>
  <Page imageFilename="test_document.jpg" imageWidth="2000" imageHeight="3000">
    <TextRegion id="region_1">
      <Coords points="100,100 1900,100 1900,2900 100,2900"/>
      <TextLine id="line_1">
        <Coords points="150,200 1850,200 1850,280 150,280"/>
        <Baseline points="150,270 1850,270"/>
        <TextEquiv conf="0.95">
          <Unicode>28. Mai | K. Schmidt | Eisenwaren | 23 Taler</Unicode>
        </TextEquiv>
      </TextLine>
      <TextLine id="line_2">
        <Coords points="150,300 1850,300 1850,380 150,380"/>
        <TextEquiv conf="0.72">
          <Unicode>[?] Schmidt | Pinsel | 10 Taler 4 Gr</Unicode>
        </TextEquiv>
      </TextLine>
      <TextLine id="line_3">
        <Coords points="150,400 1850,400 1850,480 150,480"/>
        <TextEquiv conf="0.45">
          <Unicode>[illegible] | [illegible] | 5 Taler</Unicode>
        </TextEquiv>
      </TextLine>
    </TextRegion>
  </Page>
</PcGts>`;

// PAGE-XML without namespace (some tools export this way)
const SAMPLE_PAGE_XML_NO_NS = `<?xml version="1.0" encoding="UTF-8"?>
<PcGts>
  <Metadata>
    <Creator>Manual</Creator>
  </Metadata>
  <Page imageFilename="test.jpg" imageWidth="1000" imageHeight="1500">
    <TextRegion id="r1">
      <TextLine id="l1">
        <Coords points="50,50 950,50 950,100 50,100"/>
        <TextEquiv>
          <Unicode>Test line one</Unicode>
        </TextEquiv>
      </TextLine>
    </TextRegion>
  </Page>
</PcGts>`;

describe('PageXMLParser', () => {
  let parser;

  beforeEach(() => {
    parser = new PageXMLParser();
  });

  describe('parse', () => {
    it('should parse valid PAGE-XML', () => {
      const result = parser.parse(SAMPLE_PAGE_XML);

      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.pageDimensions).toBeDefined();
      expect(result.segments).toBeDefined();
    });

    it('should extract metadata correctly', () => {
      const result = parser.parse(SAMPLE_PAGE_XML);

      expect(result.metadata.creator).toBe('Transkribus');
      expect(result.metadata.created).toBe('2024-01-15T10:30:00Z');
      expect(result.metadata.lastChange).toBe('2024-01-15T11:00:00Z');
      expect(result.metadata.comments).toBe('Test document');
    });

    it('should extract page dimensions', () => {
      const result = parser.parse(SAMPLE_PAGE_XML);

      expect(result.pageDimensions.width).toBe(2000);
      expect(result.pageDimensions.height).toBe(3000);
    });

    it('should extract image filename', () => {
      const result = parser.parse(SAMPLE_PAGE_XML);

      expect(result.imageFilename).toBe('test_document.jpg');
    });

    it('should extract all text lines as segments', () => {
      const result = parser.parse(SAMPLE_PAGE_XML);

      expect(result.segments).toHaveLength(3);
    });

    it('should extract text content correctly', () => {
      const result = parser.parse(SAMPLE_PAGE_XML);

      expect(result.segments[0].text).toBe('28. Mai | K. Schmidt | Eisenwaren | 23 Taler');
      expect(result.segments[1].text).toBe('[?] Schmidt | Pinsel | 10 Taler 4 Gr');
      expect(result.segments[2].text).toContain('[illegible]');
    });

    it('should assign line numbers', () => {
      const result = parser.parse(SAMPLE_PAGE_XML);

      expect(result.segments[0].lineNumber).toBe(1);
      expect(result.segments[1].lineNumber).toBe(2);
      expect(result.segments[2].lineNumber).toBe(3);
    });

    it('should preserve line IDs', () => {
      const result = parser.parse(SAMPLE_PAGE_XML);

      expect(result.segments[0].id).toBe('line_1');
      expect(result.segments[1].id).toBe('line_2');
    });

    it('should parse PAGE-XML without namespace', () => {
      const result = parser.parse(SAMPLE_PAGE_XML_NO_NS);

      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].text).toBe('Test line one');
    });

    it('should throw on invalid XML', () => {
      expect(() => parser.parse('<invalid>')).toThrow();
    });
  });

  describe('confidence mapping', () => {
    it('should map high confidence to "certain"', () => {
      const result = parser.parse(SAMPLE_PAGE_XML);
      // conf="0.95" should be "certain"
      expect(result.segments[0].confidence).toBe('certain');
    });

    it('should map medium confidence to "likely"', () => {
      const result = parser.parse(SAMPLE_PAGE_XML);
      // conf="0.72" should be "likely"
      expect(result.segments[1].confidence).toBe('likely');
    });

    it('should map low confidence to "uncertain"', () => {
      const result = parser.parse(SAMPLE_PAGE_XML);
      // conf="0.45" should be "uncertain"
      expect(result.segments[2].confidence).toBe('uncertain');
    });

    it('should handle missing confidence', () => {
      const result = parser.parse(SAMPLE_PAGE_XML_NO_NS);
      expect(result.segments[0].confidence).toBe('likely'); // default
    });
  });

  describe('polygonToBounds', () => {
    it('should convert polygon to bounding box', () => {
      const points = '100,200 300,200 300,400 100,400';
      const pageDimensions = { width: 1000, height: 1000 };

      const bounds = parser.polygonToBounds(points, pageDimensions);

      expect(bounds.x).toBe(10); // 100/1000 * 100
      expect(bounds.y).toBe(20); // 200/1000 * 100
      expect(bounds.width).toBe(20); // (300-100)/1000 * 100
      expect(bounds.height).toBe(20); // (400-200)/1000 * 100
    });

    it('should handle empty points', () => {
      const bounds = parser.polygonToBounds('', { width: 1000, height: 1000 });

      expect(bounds.x).toBe(0);
      expect(bounds.y).toBe(0);
      expect(bounds.width).toBe(0);
      expect(bounds.height).toBe(0);
    });

    it('should handle missing dimensions', () => {
      const bounds = parser.polygonToBounds('100,100 200,200', { width: 0, height: 0 });

      expect(bounds.x).toBe(0);
    });
  });

  describe('parseTextToFields', () => {
    it('should parse pipe-separated text', () => {
      const fields = parser.parseTextToFields('28. Mai | K. Schmidt | Eisenwaren | 23 Taler');

      expect(fields.datum).toBe('28. Mai');
      expect(fields.name).toBe('K. Schmidt');
      expect(fields.beschreibung).toBe('Eisenwaren');
      expect(fields.betrag).toBe('23 Taler');
    });

    it('should handle tab-separated text', () => {
      const fields = parser.parseTextToFields('value1\tvalue2\tvalue3');

      expect(fields.col1).toBe('value1');
      expect(fields.col2).toBe('value2');
      expect(fields.col3).toBe('value3');
    });

    it('should handle plain text', () => {
      const fields = parser.parseTextToFields('Just some plain text');

      expect(fields.text).toBe('Just some plain text');
    });
  });

  describe('regions extraction', () => {
    it('should extract text regions', () => {
      const result = parser.parse(SAMPLE_PAGE_XML);

      expect(result.regions).toHaveLength(1);
      expect(result.regions[0].id).toBe('region_1');
      expect(result.regions[0].type).toBe('TextRegion');
    });

    it('should calculate region bounds', () => {
      const result = parser.parse(SAMPLE_PAGE_XML);
      const region = result.regions[0];

      // points="100,100 1900,100 1900,2900 100,2900" on 2000x3000
      expect(region.bounds.x).toBe(5); // 100/2000 * 100
      expect(region.bounds.y).toBeCloseTo(3.33, 1); // 100/3000 * 100
    });
  });

  describe('serialize', () => {
    it('should serialize data back to PAGE-XML', () => {
      const data = {
        imageFilename: 'output.jpg',
        pageDimensions: { width: 1000, height: 1500 },
        segments: [
          { id: 'line_1', text: 'First line', polygon: '0,0 100,0 100,50 0,50' },
          { id: 'line_2', text: 'Second line' }
        ]
      };

      const xml = parser.serialize(data);

      expect(xml).toContain('<?xml version="1.0"');
      expect(xml).toContain('PcGts');
      expect(xml).toContain('imageFilename="output.jpg"');
      expect(xml).toContain('<Unicode>First line</Unicode>');
      expect(xml).toContain('<Unicode>Second line</Unicode>');
    });

    it('should escape special characters', () => {
      const data = {
        segments: [{ id: 'l1', text: 'Text with <special> & "chars"' }]
      };

      const xml = parser.serialize(data);

      expect(xml).toContain('&lt;special&gt;');
      expect(xml).toContain('&amp;');
      expect(xml).toContain('&quot;');
    });
  });

  describe('baseline extraction', () => {
    it('should extract baseline points when present', () => {
      const result = parser.parse(SAMPLE_PAGE_XML);

      expect(result.segments[0].baseline).toBe('150,270 1850,270');
    });

    it('should handle missing baseline', () => {
      const result = parser.parse(SAMPLE_PAGE_XML);

      // line_2 has no baseline
      expect(result.segments[1].baseline).toBe('');
    });
  });
});
