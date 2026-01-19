/**
 * coOCR/HTR Editor
 * Simple textarea-based transcription editor
 *
 * The expert sees the raw LLM output and can edit it directly.
 * No complex parsing, no grid/lines modes - just text.
 */
import { appState } from './state.js';
import { getById } from './utils/dom.js';

// History for undo/redo
const history = {
    stack: [],
    index: -1,
    maxSize: 50
};

// Reference to textarea
let textarea = null;

export function initEditor() {
    const container = getById('editorContent');
    if (!container) return;

    // React to transcription updates
    appState.addEventListener('transcriptionComplete', () => {
        const state = appState.getState();
        renderEditor(state.transcription);
        pushHistory();
    });

    // React to document load (reset editor)
    appState.addEventListener('documentLoaded', () => {
        const state = appState.getState();
        renderEditor(state.transcription);
        clearHistory();
    });

    // React to page changes (multi-page documents)
    appState.addEventListener('pageChanged', () => {
        const state = appState.getState();
        renderEditor(state.transcription);
        clearHistory();
    });

    // React to new pages loaded
    appState.addEventListener('pagesLoaded', () => {
        const state = appState.getState();
        renderEditor(state.transcription);
        clearHistory();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown);

    // Bind undo/redo buttons
    const btnUndo = getById('btnUndo');
    const btnRedo = getById('btnRedo');
    if (btnUndo) btnUndo.addEventListener('click', undo);
    if (btnRedo) btnRedo.addEventListener('click', redo);

    // Initial render
    const state = appState.getState();
    renderEditor(state.transcription);
}

/**
 * Render the editor - simple textarea with the transcription text
 */
function renderEditor(transcription) {
    const container = getById('editorContent');
    if (!container) return;

    // Get the raw text from transcription
    const text = transcription?.raw || '';

    // Check if we have content
    if (!text) {
        container.innerHTML = `
            <div class="editor-empty-state">
                <p>Keine Transkription vorhanden.</p>
                <p class="text-secondary">Lade ein Dokument und klicke auf "Transcribe".</p>
            </div>
        `;
        textarea = null;
        return;
    }

    // Render textarea
    container.innerHTML = `
        <textarea
            id="transcriptionText"
            class="editor-textarea"
            spellcheck="false"
            placeholder="Transkription wird hier angezeigt..."
        ></textarea>
    `;

    textarea = getById('transcriptionText');
    if (textarea) {
        textarea.value = text;

        // Save changes on input
        textarea.addEventListener('input', () => {
            appState.setTranscriptionRaw(textarea.value);
        });

        // Save to history on blur
        textarea.addEventListener('blur', () => {
            pushHistory();
        });
    }
}

/**
 * Get current text from editor
 */
export function getEditorText() {
    return textarea?.value || '';
}

// ============ History (Undo/Redo) ============

function clearHistory() {
    history.stack = [];
    history.index = -1;
    updateUndoRedoButtons();
}

function pushHistory() {
    if (!textarea) return;

    const currentText = textarea.value;

    // Don't push if same as current state
    if (history.stack[history.index] === currentText) return;

    // Remove any redo states
    history.stack = history.stack.slice(0, history.index + 1);

    // Add new state
    history.stack.push(currentText);

    // Limit size
    if (history.stack.length > history.maxSize) {
        history.stack.shift();
    } else {
        history.index++;
    }

    updateUndoRedoButtons();
}

function undo() {
    if (history.index <= 0 || !textarea) return;

    history.index--;
    textarea.value = history.stack[history.index];
    appState.setTranscriptionRaw(textarea.value);
    updateUndoRedoButtons();
}

function redo() {
    if (history.index >= history.stack.length - 1 || !textarea) return;

    history.index++;
    textarea.value = history.stack[history.index];
    appState.setTranscriptionRaw(textarea.value);
    updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
    const btnUndo = getById('btnUndo');
    const btnRedo = getById('btnRedo');

    if (btnUndo) {
        btnUndo.disabled = history.index <= 0;
    }
    if (btnRedo) {
        btnRedo.disabled = history.index >= history.stack.length - 1;
    }
}

function handleKeyDown(e) {
    // Ctrl+Z = Undo
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
    }
    // Ctrl+Shift+Z or Ctrl+Y = Redo
    if ((e.ctrlKey && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y')) {
        e.preventDefault();
        redo();
    }
}
