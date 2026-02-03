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

// Original text from LLM (for change highlighting)
let originalText = '';

// Structured text (with original formatting/indentation)
let structuredText = '';

// Reference to textarea
let textarea = null;

// Reference to diff display
let diffDisplay = null;

// Reference to line numbers
let lineNumbers = null;

// Current view mode
let isNormalizedView = false;

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

    // Store original text for diff tracking
    originalText = text;
    structuredText = text;

    // Render textarea with view mode toggle
    container.innerHTML = `
        <div class="editor-toolbar-secondary">
            <div class="view-mode-toggle">
                <button class="view-mode-btn active" id="viewStructured" title="Strukturierte Ansicht (Original-Formatierung)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10H3M21 6H3M21 14H3M21 18H10"/>
                    </svg>
                    <span>Strukturiert</span>
                </button>
                <button class="view-mode-btn" id="viewNormalized" title="Normalisierte Ansicht (linksbündig)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 6H3M21 10H3M21 14H3M21 18H3"/>
                    </svg>
                    <span>Normalisiert</span>
                </button>
            </div>
            <div class="editor-toolbar-right">
                <label class="checkbox-wrapper" title="Zeigt Änderungen gegenüber dem Original (nur Ansicht, nicht editierbar)">
                    <input type="checkbox" id="showChanges">
                    <span>Diff-Ansicht</span>
                </label>
                <span class="change-stats" id="changeStats"></span>
            </div>
        </div>
        <div class="editor-content-wrapper">
            <div class="editor-with-lines">
                <div id="lineNumbers" class="line-numbers"></div>
                <textarea
                    id="transcriptionText"
                    class="editor-textarea"
                    spellcheck="false"
                    placeholder="Transkription wird hier angezeigt..."
                ></textarea>
            </div>
            <div id="diffDisplay" class="diff-display" style="display: none;">
                <div class="diff-readonly-hint">Nur Ansicht - zum Bearbeiten Diff-Ansicht deaktivieren</div>
            </div>
        </div>
    `;

    textarea = getById('transcriptionText');
    diffDisplay = getById('diffDisplay');
    lineNumbers = getById('lineNumbers');
    const showChangesCheckbox = getById('showChanges');
    const viewStructuredBtn = getById('viewStructured');
    const viewNormalizedBtn = getById('viewNormalized');

    if (textarea) {
        textarea.value = text;

        // Initialize line numbers
        updateLineNumbers();

        // Sync scroll between textarea and line numbers
        textarea.addEventListener('scroll', () => {
            if (lineNumbers) {
                lineNumbers.scrollTop = textarea.scrollTop;
            }
        });

        // Initialize history with current text
        clearHistory();
        pushHistory();

        // Save changes on input and update diff
        let inputTimer = null;
        textarea.addEventListener('input', () => {
            updateLineNumbers();
            // Update the structured text based on current view
            if (isNormalizedView) {
                // User is editing normalized text - sync back to structured
                structuredText = denormalizeText(textarea.value, structuredText);
            } else {
                structuredText = textarea.value;
            }
            appState.setTranscriptionRaw(structuredText);
            updateChangeStats();
            if (showChangesCheckbox?.checked) {
                updateDiffDisplay(isNormalizedView);
            }

            // Debounced history push (after 500ms of no typing)
            clearTimeout(inputTimer);
            inputTimer = setTimeout(() => {
                pushHistory();
            }, 500);
        });

        // Also save to history on blur (immediate)
        textarea.addEventListener('blur', () => {
            clearTimeout(inputTimer);
            pushHistory();
        });
    }

    // View mode toggle
    if (viewStructuredBtn && viewNormalizedBtn) {
        viewStructuredBtn.addEventListener('click', () => {
            if (!isNormalizedView) return; // Already in structured mode

            // Save current normalized edits back to structured
            if (textarea) {
                structuredText = denormalizeText(textarea.value, structuredText);
            }

            isNormalizedView = false;
            viewStructuredBtn.classList.add('active');
            viewNormalizedBtn.classList.remove('active');
            textarea.classList.remove('normalized');

            // Show structured text
            if (textarea) {
                textarea.value = structuredText;
                updateLineNumbers();
            }

            if (showChangesCheckbox?.checked) {
                updateDiffDisplay(false);
            }
        });

        viewNormalizedBtn.addEventListener('click', () => {
            if (isNormalizedView) return; // Already in normalized mode

            // Save current structured text
            if (textarea) {
                structuredText = textarea.value;
            }

            isNormalizedView = true;
            viewNormalizedBtn.classList.add('active');
            viewStructuredBtn.classList.remove('active');
            textarea.classList.add('normalized');

            // Show normalized text (left-aligned)
            if (textarea) {
                textarea.value = normalizeText(structuredText);
                updateLineNumbers();
            }

            if (showChangesCheckbox?.checked) {
                updateDiffDisplay(true);
            }
        });
    }

    // Toggle diff display
    if (showChangesCheckbox) {
        showChangesCheckbox.addEventListener('change', () => {
            const editorWithLines = textarea?.parentElement;
            if (showChangesCheckbox.checked) {
                if (editorWithLines) editorWithLines.style.display = 'none';
                diffDisplay.style.display = 'block';
                updateDiffDisplay(isNormalizedView);
            } else {
                if (editorWithLines) editorWithLines.style.display = 'flex';
                diffDisplay.style.display = 'none';
            }
        });
    }

    updateChangeStats();
}

/**
 * Get current text from editor (always returns structured text)
 */
export function getEditorText() {
    // Always return the structured text, even if viewing normalized
    if (isNormalizedView && textarea) {
        return denormalizeText(textarea.value, structuredText);
    }
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

    // Always store structured text in history
    const currentText = isNormalizedView
        ? denormalizeText(textarea.value, structuredText)
        : textarea.value;

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
    structuredText = history.stack[history.index];
    // Display according to current view mode
    textarea.value = isNormalizedView ? normalizeText(structuredText) : structuredText;
    appState.setTranscriptionRaw(structuredText);
    updateUndoRedoButtons();
    updateChangeStats();
    updateLineNumbers();

    // Update diff display if visible
    const showChangesCheckbox = getById('showChanges');
    if (showChangesCheckbox?.checked) {
        updateDiffDisplay(isNormalizedView);
    }
}

function redo() {
    if (history.index >= history.stack.length - 1 || !textarea) return;

    history.index++;
    structuredText = history.stack[history.index];
    // Display according to current view mode
    textarea.value = isNormalizedView ? normalizeText(structuredText) : structuredText;
    appState.setTranscriptionRaw(structuredText);
    updateUndoRedoButtons();
    updateChangeStats();
    updateLineNumbers();

    // Update diff display if visible
    const showChangesCheckbox = getById('showChanges');
    if (showChangesCheckbox?.checked) {
        updateDiffDisplay(isNormalizedView);
    }
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

// ============ Change Highlighting (Suggesting Mode) ============

/**
 * Update the change statistics display
 */
function updateChangeStats() {
    const statsEl = getById('changeStats');
    if (!statsEl || !textarea) return;

    // Always compare structured text
    const currentText = isNormalizedView
        ? denormalizeText(textarea.value, structuredText)
        : textarea.value;

    if (currentText === originalText) {
        statsEl.textContent = '';
        statsEl.className = 'change-stats';
        return;
    }

    // Simple line-based diff count
    const origLines = originalText.split('\n');
    const currLines = currentText.split('\n');
    let changes = 0;

    const maxLen = Math.max(origLines.length, currLines.length);
    for (let i = 0; i < maxLen; i++) {
        if (origLines[i] !== currLines[i]) {
            changes++;
        }
    }

    statsEl.textContent = `${changes} Zeile${changes !== 1 ? 'n' : ''} geändert`;
    statsEl.className = 'change-stats has-changes';
}

/**
 * Update the diff display showing changes visually
 * @param {boolean} normalized - If true, normalize whitespace (left-aligned)
 */
function updateDiffDisplay(normalized = false) {
    if (!diffDisplay || !textarea) return;

    // Always compare structured text for accurate diff
    const currentText = isNormalizedView
        ? denormalizeText(textarea.value, structuredText)
        : textarea.value;
    const origLines = originalText.split('\n');
    const currLines = currentText.split('\n');

    // Apply normalization class
    diffDisplay.classList.toggle('normalized', normalized);

    let html = '';
    const maxLen = Math.max(origLines.length, currLines.length);

    for (let i = 0; i < maxLen; i++) {
        let origLine = origLines[i] ?? '';
        let currLine = currLines[i] ?? '';

        // Normalize if requested (trim leading whitespace)
        const displayOrig = normalized ? origLine.trimStart() : origLine;
        const displayCurr = normalized ? currLine.trimStart() : currLine;

        const lineNum = `<span class="diff-line-number">${i + 1}</span>`;

        if (origLine === currLine) {
            // Unchanged line
            html += `<div class="diff-line">${lineNum}${escapeHtml(displayCurr) || '&nbsp;'}</div>`;
        } else if (i >= origLines.length) {
            // Added line
            html += `<div class="diff-line diff-added">${lineNum}${escapeHtml(displayCurr) || '&nbsp;'}</div>`;
        } else if (i >= currLines.length) {
            // Deleted line
            html += `<div class="diff-line diff-deleted">${lineNum}${escapeHtml(displayOrig) || '&nbsp;'}</div>`;
        } else {
            // Modified line - show word-level diff
            html += `<div class="diff-line diff-modified">${lineNum}${renderWordDiff(displayOrig, displayCurr)}</div>`;
        }
    }

    diffDisplay.innerHTML = html;
}

/**
 * Render word-level diff between two lines
 */
function renderWordDiff(origLine, currLine) {
    const origWords = origLine.split(/(\s+)/);
    const currWords = currLine.split(/(\s+)/);

    let result = '';
    const maxLen = Math.max(origWords.length, currWords.length);

    for (let i = 0; i < maxLen; i++) {
        const origWord = origWords[i] ?? '';
        const currWord = currWords[i] ?? '';

        if (origWord === currWord) {
            result += escapeHtml(currWord);
        } else {
            if (origWord && origWord.trim()) {
                result += `<del>${escapeHtml(origWord)}</del>`;
            }
            if (currWord && currWord.trim()) {
                result += `<ins>${escapeHtml(currWord)}</ins>`;
            } else if (currWord) {
                result += escapeHtml(currWord); // whitespace
            }
        }
    }

    return result || '&nbsp;';
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============ Line Numbers ============

/**
 * Update line numbers display
 */
function updateLineNumbers() {
    if (!lineNumbers || !textarea) return;

    const lines = textarea.value.split('\n');
    const lineCount = lines.length;

    // Generate line numbers HTML
    let html = '';
    for (let i = 1; i <= lineCount; i++) {
        html += `<div class="line-number">${i}</div>`;
    }

    lineNumbers.innerHTML = html;
}

// ============ Text Normalization ============

/**
 * Normalize text by removing leading whitespace from each line
 * @param {string} text - The structured text with indentation
 * @returns {string} - Left-aligned text
 */
function normalizeText(text) {
    return text.split('\n').map(line => line.trimStart()).join('\n');
}

/**
 * Attempt to restore indentation from original structured text
 * This maps normalized lines back to their original indentation
 * @param {string} normalizedText - The edited normalized text
 * @param {string} originalStructured - The original structured text for reference
 * @returns {string} - Text with restored indentation where possible
 */
function denormalizeText(normalizedText, originalStructured) {
    const normalizedLines = normalizedText.split('\n');
    const originalLines = originalStructured.split('\n');

    // Build a map of content -> leading whitespace from original
    const indentMap = new Map();
    for (const line of originalLines) {
        const trimmed = line.trimStart();
        if (trimmed && !indentMap.has(trimmed)) {
            const indent = line.slice(0, line.length - trimmed.length);
            indentMap.set(trimmed, indent);
        }
    }

    // Apply indentation to normalized lines where we have a match
    return normalizedLines.map((line, index) => {
        const trimmed = line.trimStart();
        if (!trimmed) return line; // Empty or whitespace-only line

        // Try to find matching indent from original
        if (indentMap.has(trimmed)) {
            return indentMap.get(trimmed) + trimmed;
        }

        // For lines that don't match, try to use the indent of the corresponding original line
        if (index < originalLines.length) {
            const origLine = originalLines[index];
            const origTrimmed = origLine.trimStart();
            const origIndent = origLine.slice(0, origLine.length - origTrimmed.length);
            return origIndent + trimmed;
        }

        // No match found, return as-is
        return trimmed;
    }).join('\n');
}
