import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
  document: {
    filename: 'integration-test.jpg',
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
    raw: 'prima linea\nsecunda linea',
    segments: [
      { lineNumber: 1, text: 'prima linea' },
      { lineNumber: 2, text: 'secunda linea' }
    ],
    columns: [],
    lines: []
  },
  regions: [],
  validation: { status: 'idle', rules: [] },
  description: { raw: '' }
};

vi.mock('../js/state.js', () => ({
  appState: {
    addEventListener: vi.fn(),
    getState: vi.fn(() => state),
    setSelection: vi.fn(),
    setTranscriptionRaw: vi.fn((text, options = {}) => {
      state.transcription.raw = text;
      if (options.syncSegments) {
        const previousSegments = state.transcription.segments || [];
        state.transcription.segments = text.split('\n').map((lineText, index) => ({
          ...previousSegments[index],
          lineNumber: index + 1,
          text: lineText
        }));
      }
    })
  }
}));

import { applySuggestionAtLine, initEditor } from '../js/editor.js';
import { ExportService } from '../js/services/export.js';

describe('Apply to export integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.transcription.raw = 'prima linea\nsecunda linea';
    state.transcription.segments = [
      { lineNumber: 1, text: 'prima linea' },
      { lineNumber: 2, text: 'secunda linea' }
    ];

    document.body.innerHTML = `
      <button id="btnUndo" disabled>Undo</button>
      <button id="btnRedo" disabled>Redo</button>
      <div id="editorContent"></div>
    `;

    initEditor();
  });

  it('exports corrected content after apply suggestion', () => {
    const applyResult = applySuggestionAtLine({
      line: 2,
      sourceText: 'secunda',
      suggestion: 'secvnda'
    });

    expect(applyResult.status).toBe('applied');

    const service = new ExportService();
    const txtExport = service.export('txt');
    const jsonExport = JSON.parse(service.export('json').content);

    expect(txtExport.content).toBe('prima linea\nsecvnda linea');
    expect(jsonExport.transcription.raw).toBe('prima linea\nsecvnda linea');
    expect(jsonExport.transcription.segments[1].text).toBe('secvnda linea');
  });
});
