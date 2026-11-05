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

// Echo the count so change statistics can be read without dictionaries
vi.mock('../js/services/i18n.js', () => ({
  t: (key, params) => (params && 'count' in params ? `${params.count} ${key}` : key)
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

  it('remaps to a unique matching line when requested line is wrong', () => {
    const result = applySuggestionAtLine({
      line: 1,
      sourceText: 'secunda',
      suggestion: 'secvnda'
    });

    const textarea = document.getElementById('transcriptionText');
    expect(result.status).toBe('applied');
    expect(result.line).toBe(2);
    expect(result.message).toContain('Remapped');
    expect(textarea.value).toBe('prima linea\nsecvnda linea');
  });

  it('applies case-insensitive source matches when unique', () => {
    mockState.transcription.raw = 'prima linea\nSecunda linea';
    initEditor();

    const result = applySuggestionAtLine({
      line: 2,
      sourceText: 'secunda',
      suggestion: 'secvnda'
    });

    const textarea = document.getElementById('transcriptionText');
    expect(result.status).toBe('applied');
    expect(textarea.value).toBe('prima linea\nsecvnda linea');
  });

  it('returns ambiguous when source text appears in multiple lines', () => {
    mockState.transcription.raw = 'prima nota\nsecunda linea\nsecunda nota';
    initEditor();

    const result = applySuggestionAtLine({
      line: 1,
      sourceText: 'secunda',
      suggestion: 'secvnda'
    });

    const textarea = document.getElementById('transcriptionText');
    expect(result.status).toBe('ambiguous');
    expect(result.message).toBe('Source text appears in multiple lines. Apply manually.');
    expect(textarea.value).toBe('prima nota\nsecunda linea\nsecunda nota');
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

describe('Editor undo/redo shortcuts', () => {
  const press = (target, init) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ctrlKey: true, ...init }));

  beforeEach(() => {
    vi.clearAllMocks();
    mockState.transcription.raw = 'prima linea\nsecunda linea';
    document.body.innerHTML = `
      <button id="btnUndo" disabled>Undo</button>
      <button id="btnRedo" disabled>Redo</button>
      <div id="editorContent"></div>
      <textarea id="otherField"></textarea>
    `;
    initEditor();
    applySuggestionAtLine({ line: 2, sourceText: 'secunda', suggestion: 'secvnda' });
  });

  it('redoes with Ctrl+Shift+Z, where the browser reports the key as "Z"', () => {
    const editor = document.getElementById('transcriptionText');
    press(editor, { key: 'z' });
    expect(editor.value).toBe('prima linea\nsecunda linea');

    press(editor, { key: 'Z', shiftKey: true });
    expect(editor.value).toBe('prima linea\nsecvnda linea');
  });

  it('leaves Ctrl+Z in other text fields to the field itself', () => {
    const other = document.getElementById('otherField');
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ctrlKey: true, key: 'z' });
    other.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(document.getElementById('transcriptionText').value).toBe('prima linea\nsecvnda linea');
  });
});

describe('Editor change statistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.transcription.raw = 'prima linea\nsecunda linea\ntertia linea';
    document.body.innerHTML = `
      <button id="btnUndo" disabled>Undo</button>
      <button id="btnRedo" disabled>Redo</button>
      <div id="editorContent"></div>
    `;
    initEditor();
  });

  it('should count one inserted line as one change, not every following line', () => {
    const editor = document.getElementById('transcriptionText');
    editor.value = 'nova linea\n' + editor.value;
    editor.dispatchEvent(new Event('input', { bubbles: true }));

    expect(document.getElementById('changeStats').textContent).toMatch(/^1\b/);
  });
});
