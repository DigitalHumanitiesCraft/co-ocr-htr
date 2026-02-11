import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = {
  transcription: {
    raw: 'prima linea\nsecunda linea'
  }
};

vi.mock('../js/state.js', () => ({
  appState: {
    addEventListener: vi.fn(),
    getState: vi.fn(() => mockState),
    setTranscriptionRaw: vi.fn(),
    setSelection: vi.fn()
  }
}));

import { appState } from '../js/state.js';
import { applySuggestionAtLine, initEditor } from '../js/editor.js';

describe('Editor applySuggestionAtLine', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockState.transcription.raw = 'prima linea\nsecunda linea';

    document.body.innerHTML = `
      <button id="btnUndo" disabled>Undo</button>
      <button id="btnRedo" disabled>Redo</button>
      <div id="editorContent"></div>
    `;

    initEditor();
  });

  it('applies a suggestion on the target line when source text matches exactly', () => {
    const result = applySuggestionAtLine({
      line: 2,
      sourceText: 'secunda',
      suggestion: 'secvnda'
    });

    const textarea = document.getElementById('transcriptionText');
    expect(result.status).toBe('applied');
    expect(textarea.value).toBe('prima linea\nsecvnda linea');
    expect(appState.setTranscriptionRaw).toHaveBeenLastCalledWith(
      'prima linea\nsecvnda linea',
      { syncSegments: true }
    );
  });

  it('returns ambiguous when source text cannot be found in the target line', () => {
    const result = applySuggestionAtLine({
      line: 2,
      sourceText: 'non-existent',
      suggestion: 'replacement'
    });

    const textarea = document.getElementById('transcriptionText');
    expect(result.status).toBe('ambiguous');
    expect(textarea.value).toBe('prima linea\nsecunda linea');
  });

  it('updates diff output and supports undo after apply', () => {
    const diffToggle = document.getElementById('showChanges');
    const btnUndo = document.getElementById('btnUndo');
    const diffDisplay = document.getElementById('diffDisplay');
    const textarea = document.getElementById('transcriptionText');

    diffToggle.checked = true;
    diffToggle.dispatchEvent(new Event('change'));

    const applyResult = applySuggestionAtLine({
      line: 2,
      sourceText: 'secunda',
      suggestion: 'secvnda'
    });

    expect(applyResult.status).toBe('applied');
    expect(diffDisplay.innerHTML).toContain('<ins>secvnda</ins>');

    btnUndo.click();
    expect(textarea.value).toBe('prima linea\nsecunda linea');
    expect(appState.setTranscriptionRaw).toHaveBeenLastCalledWith(
      'prima linea\nsecunda linea',
      { syncSegments: true }
    );
  });

  it('syncs segments during regular textarea input', () => {
    const textarea = document.getElementById('transcriptionText');
    textarea.value = 'prima linea\ntertia linea';
    textarea.dispatchEvent(new Event('input'));

    expect(appState.setTranscriptionRaw).toHaveBeenLastCalledWith(
      'prima linea\ntertia linea',
      { syncSegments: true }
    );
  });
});
