/**
 * PAGE-XML round trip: import, edit line structure in the editor state, export.
 * Geometry must stay attached to its text line, not to its array position.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../js/services/storage.js', () => ({
  storage: {
    loadSettings: vi.fn(() => ({ autoSave: false })),
    saveSettings: vi.fn()
  }
}));

import { appState } from '../js/state.js';
import { PageXMLParser } from '../js/services/parsers/page-xml.js';
import { ExportService } from '../js/services/export.js';

const SOURCE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<PcGts xmlns="http://schema.primaresearch.org/PAGE/gts/pagecontent/2019-07-15">
  <Page imageFilename="brief.jpg" imageWidth="2000" imageHeight="3000">
    <TextRegion id="r1">
      <Coords points="100,100 1900,100 1900,2900 100,2900"/>
      <TextLine id="tl_1">
        <Coords points="150,200 1850,200 1850,280 150,280"/>
        <Baseline points="150,270 1850,270"/>
        <TextEquiv><Unicode>Lieber Freund</Unicode></TextEquiv>
      </TextLine>
      <TextLine id="tl_2">
        <Coords points="150,300 1850,300 1850,380 150,380"/>
        <Baseline points="150,370 1850,370"/>
        <TextEquiv><Unicode>ich schreibe Dir heute</Unicode></TextEquiv>
      </TextLine>
      <TextLine id="tl_3">
        <Coords points="150,400 1850,400 1850,480 150,480"/>
        <Baseline points="150,470 1850,470"/>
        <TextEquiv><Unicode>aus Baltimore</Unicode></TextEquiv>
      </TextLine>
    </TextRegion>
  </Page>
</PcGts>`;

describe('PAGE-XML round trip with a line inserted in the editor', () => {
  it('should keep each text line on its own original polygon and invent none for the new line', () => {
    const parser = new PageXMLParser();
    const imported = parser.parse(SOURCE_XML);
    appState.setDocument({ name: 'brief.jpg', type: 'image/jpeg' }, '');
    appState.setTranscription({ provider: 'page-xml', model: 'import', segments: imported.segments });
    appState.setRegions(imported.segments.map(seg => ({ line: seg.lineNumber, y: seg.bounds.y })));

    appState.setTranscriptionRaw(
      'Lieber Freund\nich schreibe Dir heute\n[eingefuegte Zeile]\naus Baltimore',
      { syncSegments: true }
    );

    const xml = new ExportService().exportPageXml(appState.getState());
    const exported = parser.parse(xml).segments;

    const original = Object.fromEntries(imported.segments.map(seg => [seg.text, seg]));
    for (const line of exported.filter(seg => original[seg.text])) {
      expect(line.polygon).toBe(original[line.text].polygon);
      expect(line.baseline).toBe(original[line.text].baseline);
      expect(line.id).toBe(original[line.text].id);
    }

    // Viewer boxes follow their lines: old line 3 is now line 4, the new line 3 has no box
    expect(appState.getState().regions.map(r => [r.line, r.y]))
      .toEqual([[1, imported.segments[0].bounds.y], [2, imported.segments[1].bounds.y], [4, imported.segments[2].bounds.y]]);

    const inserted = exported.find(seg => seg.text === '[eingefuegte Zeile]');
    expect(inserted.polygon).toBe('');
    expect(xml).toMatch(/<TextLine id="line_3">\s*<TextEquiv/);
  });
});
