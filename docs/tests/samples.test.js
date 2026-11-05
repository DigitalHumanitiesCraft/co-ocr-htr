/**
 * Multi-page samples: every page must get the transcription from its own PAGE-XML.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../js/services/storage.js', () => ({
  storage: {
    loadSettings: vi.fn(() => ({ autoSave: false })),
    saveSettings: vi.fn()
  }
}));

vi.mock('../js/viewer.js', () => ({ loadIIIFManifest: vi.fn() }));

import { appState } from '../js/state.js';
import { samplesService } from '../js/services/samples.js';

const pageXml = (text) => `<?xml version="1.0" encoding="UTF-8"?>
<PcGts xmlns="http://schema.primaresearch.org/PAGE/gts/pagecontent/2019-07-15">
  <Page imageFilename="p.jpg" imageWidth="1000" imageHeight="1000">
    <TextRegion id="r1">
      <TextLine id="l1">
        <Coords points="10,10 990,10 990,60 10,60"/>
        <TextEquiv><Unicode>${text}</Unicode></TextEquiv>
      </TextLine>
    </TextRegion>
  </Page>
</PcGts>`;

describe('loadMultiPageSample', () => {
  beforeEach(() => {
    vi.spyOn(appState, 'ensureProject').mockResolvedValue(undefined);
    vi.spyOn(samplesService, 'blobToDataUrl').mockResolvedValue('data:image/png;base64,');
    vi.spyOn(samplesService, 'getImageDimensions').mockResolvedValue({ width: 1000, height: 1000 });
    globalThis.fetch = vi.fn(async (url) => {
      const match = String(url).match(/p(\d)\.xml$/);
      if (match) return { ok: true, text: async () => pageXml(`Text of page ${match[1]}`) };
      return { ok: true, blob: async () => new Blob(['img']) };
    });
  });

  it('should load the PAGE-XML transcription of every page, not only the first', async () => {
    await samplesService.loadMultiPageSample({
      id: 'multi',
      name: 'Multi',
      pages: [1, 2, 3].map(n => ({ id: `p${n}`, image: `m/p${n}.jpg`, pageXml: `m/p${n}.xml` }))
    });

    expect(appState.getState().transcription.raw).toBe('Text of page 1');

    appState.goToPage(2);
    expect(appState.getState().transcription.raw).toBe('Text of page 3');
    expect(appState.getState().regions).toHaveLength(1);
  });
});
