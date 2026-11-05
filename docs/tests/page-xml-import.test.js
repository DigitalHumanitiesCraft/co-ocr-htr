/**
 * Uploaded PAGE-XML: one clear outcome message, and a warning when the file
 * describes a different image than the one loaded.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../js/services/storage.js', () => ({
  storage: {
    loadSettings: vi.fn(() => ({ autoSave: false })),
    saveSettings: vi.fn()
  }
}));
vi.mock('../js/components/dialogs.js', () => ({
  dialogManager: { showToast: vi.fn() }
}));

import { appState } from '../js/state.js';
import { dialogManager } from '../js/components/dialogs.js';
import { importPageXML } from '../js/services/parsers/page-xml.js';

const xml = (image) => `<?xml version="1.0" encoding="UTF-8"?>
<PcGts xmlns="http://schema.primaresearch.org/PAGE/gts/pagecontent/2019-07-15">
  <Page imageFilename="${image}" imageWidth="100" imageHeight="100">
    <TextRegion id="r1"><TextLine id="l1">
      <Coords points="1,1 99,1 99,9 1,9"/>
      <TextEquiv><Unicode>Zeile</Unicode></TextEquiv>
    </TextLine></TextRegion>
  </Page>
</PcGts>`;

const toastTypes = () => dialogManager.showToast.mock.calls.map(([, type]) => type);

describe('importPageXML', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appState.setDocument({ name: 'brief.jpg', type: 'image/jpeg' }, '');
  });

  it('should report a malformed file once, as an error, without a success message', () => {
    expect(importPageXML('<PcGts><Page>', 'kaputt.xml')).toBe(false);
    expect(toastTypes()).toEqual(['error']);
  });

  it('should warn when the PAGE-XML describes another image', () => {
    expect(importPageXML(xml('anderes.jpg'), 'seite.xml')).toBe(true);
    expect(toastTypes()).toEqual(['warning', 'success']);
  });

  it('should import silently apart from success when the image matches', () => {
    importPageXML(xml('scans/brief.jpg'), 'seite.xml');
    expect(toastTypes()).toEqual(['success']);
    expect(appState.getState().transcription.raw).toBe('Zeile');
  });
});
