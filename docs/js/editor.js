/**
 * coOCR/HTR Editor
 * Transcription Editor with Inline Editing and Undo/Redo
 */
import { appState } from './state.js';

// History for undo/redo
const history = {
    stack: [],
    index: -1,
    maxSize: 50
};

// Currently editing cell
let editingCell = null;

export function initEditor() {
    const container = document.getElementById('editorContent');
    if (!container) return;

    // React to selection
    appState.addEventListener('selectionChanged', (e) => {
        document.querySelectorAll('.editor-grid-row.active').forEach(el => el.classList.remove('active'));
        const lineEl = document.querySelector(`.editor-grid-row[data-line="${e.detail.line}"]`);
        if (lineEl) {
            lineEl.classList.add('active');
            lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });

    // React to transcription updates
    appState.addEventListener('transcriptionComplete', () => {
        const state = appState.getState();
        if (state.transcription.segments?.length > 0) {
            renderEditorFromSegments(state.transcription.segments, state.transcription.columns);
        } else {
            renderEditor(state.transcription.lines);
        }
        // Save initial state to history
        pushHistory();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown);

    // Bind undo/redo buttons
    const btnUndo = document.getElementById('btnUndo');
    const btnRedo = document.getElementById('btnRedo');
    if (btnUndo) btnUndo.addEventListener('click', undo);
    if (btnRedo) btnRedo.addEventListener('click', redo);

    // Initial render
    const state = appState.getState();
    if (state.transcription.segments?.length > 0) {
        renderEditorFromSegments(state.transcription.segments, state.transcription.columns);
    } else {
        renderEditor(state.transcription.lines);
    }
}

function renderEditor(transcriptionData) {
    const container = document.getElementById('editorContent');
    let html = '';

    // Header
    html += `
        <div class="editor-grid-row" style="background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.05);">
            <div class="editor-cell header">#</div>
            <div class="editor-cell header">Datum</div>
            <div class="editor-cell header">Name</div>
            <div class="editor-cell header">Beschreibung</div>
            <div class="editor-cell header">Betrag</div>
        </div>
    `;

    transcriptionData.forEach((text, index) => {
        if (text.includes('---')) return;
        if (text.includes('Datum') && index === 0) return;

        const lineNum = index + 1;
        const content = text.replace(/^\||\|$/g, '').split('|');

        let rowContent = '';
        if (content.length >= 4) {
            rowContent = content.slice(0, 4).map(cell => {
                let cellHtml = cell.trim()
                    .replace(/\[\?\]/g, '<span class="marker-uncertain" title="Unsicher">[?]</span>')
                    .replace(/\[illegible\]/g, '<span class="marker-illegible" title="Unleserlich">...</span>');
                return `<div class="editor-cell" title="${cell.trim()}">${cellHtml}</div>`;
            }).join('');
        } else {
            rowContent = `<div class="editor-cell" style="grid-column: 2 / -1; color: var(--text-secondary); opacity: 0.5;">${text}</div>`;
        }

        html += `
            <div class="editor-grid-row" data-line="${lineNum}">
                <div class="line-num">${lineNum}</div>
                ${rowContent}
            </div>
        `;
    });

    container.innerHTML = html;
    bindEditorEvents(container);
}

/**
 * Render editor from structured segments
 */
function renderEditorFromSegments(segments, columns) {
    const container = document.getElementById('editorContent');
    if (!container) return;

    let html = '';

    // Determine headers
    const headers = columns?.length > 0
        ? columns.map(c => c.label || c.id)
        : ['#', 'Datum', 'Name', 'Beschreibung', 'Betrag'];

    // Header row
    html += `
        <div class="editor-grid-row" style="background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.05);">
            <div class="editor-cell header">#</div>
            ${headers.slice(0, 4).map(h => `<div class="editor-cell header">${h}</div>`).join('')}
        </div>
    `;

    // Data rows
    segments.forEach((seg, index) => {
        const lineNum = seg.lineNumber || (index + 1);
        let cells;

        if (seg.fields && Object.keys(seg.fields).length > 0) {
            cells = Object.values(seg.fields).slice(0, 4);
        } else if (seg.text) {
            // Parse text as pipe-separated
            const parts = seg.text.replace(/^\||\|$/g, '').split('|').map(s => s.trim());
            cells = parts.slice(0, 4);
        } else {
            cells = ['', '', '', ''];
        }

        const rowContent = cells.map((cell, cellIdx) => {
            const cellHtml = (cell || '')
                .replace(/\[\?\]/g, '<span class="marker-uncertain" title="Unsicher">[?]</span>')
                .replace(/\[illegible\]/g, '<span class="marker-illegible" title="Unleserlich">...</span>');
            return `<div class="editor-cell" data-line="${lineNum}" data-col="${cellIdx}" title="${cell || ''}">${cellHtml}</div>`;
        }).join('');

        // Pad with empty cells if needed
        const emptyCells = Math.max(0, 4 - cells.length);
        const emptyHtml = Array(emptyCells).fill('')
            .map((_, i) => `<div class="editor-cell" data-line="${lineNum}" data-col="${cells.length + i}"></div>`)
            .join('');

        html += `
            <div class="editor-grid-row" data-line="${lineNum}">
                <div class="line-num">${lineNum}</div>
                ${rowContent}${emptyHtml}
            </div>
        `;
    });

    container.innerHTML = html;
    bindEditorEvents(container);
}

/**
 * Bind editor event listeners
 */
function bindEditorEvents(container) {
    // Row click for selection
    container.querySelectorAll('.editor-grid-row[data-line]').forEach(row => {
        row.addEventListener('click', (e) => {
            // Don't select if clicking on an editable cell
            if (e.target.classList.contains('editor-cell') && !e.target.classList.contains('header')) {
                return;
            }
            const line = parseInt(row.getAttribute('data-line'));
            appState.setSelection(line);
        });
    });

    // Cell double-click for inline editing
    container.querySelectorAll('.editor-cell[data-line]').forEach(cell => {
        cell.addEventListener('dblclick', () => startEditing(cell));
    });
}

/**
 * Start inline editing on a cell
 */
function startEditing(cell) {
    if (editingCell) {
        finishEditing(editingCell, false);
    }

    editingCell = cell;
    const originalText = cell.textContent;

    // Store original value
    cell.dataset.originalValue = originalText;

    // Make cell editable
    cell.contentEditable = 'true';
    cell.classList.add('editing');
    cell.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(cell);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    // Event listeners for this edit session
    cell.addEventListener('keydown', handleCellKeyDown);
    cell.addEventListener('blur', handleCellBlur);
}

/**
 * Handle keydown in editing cell
 */
function handleCellKeyDown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        finishEditing(e.target, true);
    } else if (e.key === 'Escape') {
        e.preventDefault();
        finishEditing(e.target, false);
    } else if (e.key === 'Tab') {
        e.preventDefault();
        finishEditing(e.target, true);
        // Move to next cell
        navigateToNextCell(e.target, e.shiftKey ? -1 : 1);
    }
}

/**
 * Handle blur on editing cell
 */
function handleCellBlur(e) {
    // Small delay to allow for button clicks
    setTimeout(() => {
        if (editingCell === e.target) {
            finishEditing(e.target, true);
        }
    }, 100);
}

/**
 * Finish editing a cell
 */
function finishEditing(cell, save) {
    if (!cell) return;

    cell.removeEventListener('keydown', handleCellKeyDown);
    cell.removeEventListener('blur', handleCellBlur);

    const newValue = cell.textContent.trim();
    const originalValue = cell.dataset.originalValue || '';

    cell.contentEditable = 'false';
    cell.classList.remove('editing');

    if (save && newValue !== originalValue) {
        // Update state
        const lineNum = parseInt(cell.dataset.line);
        const colIdx = parseInt(cell.dataset.col);

        // Update segment
        const state = appState.getState();
        const segment = state.transcription.segments?.find(s => s.lineNumber === lineNum);
        if (segment) {
            if (segment.fields) {
                const keys = Object.keys(segment.fields);
                if (keys[colIdx]) {
                    segment.fields[keys[colIdx]] = newValue;
                }
            }
            segment.text = Object.values(segment.fields || {}).join(' | ');

            // Track correction
            appState.updateSegment(lineNum, {
                text: segment.text,
                fields: segment.fields
            });
        }

        // Push to history
        pushHistory();

        // Re-render markers
        cell.innerHTML = newValue
            .replace(/\[\?\]/g, '<span class="marker-uncertain" title="Unsicher">[?]</span>')
            .replace(/\[illegible\]/g, '<span class="marker-illegible" title="Unleserlich">...</span>');
    } else {
        // Restore original value
        cell.innerHTML = originalValue
            .replace(/\[\?\]/g, '<span class="marker-uncertain" title="Unsicher">[?]</span>')
            .replace(/\[illegible\]/g, '<span class="marker-illegible" title="Unleserlich">...</span>');
    }

    delete cell.dataset.originalValue;
    editingCell = null;
}

/**
 * Navigate to adjacent cell
 */
function navigateToNextCell(currentCell, direction) {
    const line = parseInt(currentCell.dataset.line);
    const col = parseInt(currentCell.dataset.col);

    let nextCol = col + direction;
    let nextLine = line;

    // Wrap to next/previous row
    if (nextCol > 3) {
        nextCol = 0;
        nextLine = line + 1;
    } else if (nextCol < 0) {
        nextCol = 3;
        nextLine = line - 1;
    }

    const nextCell = document.querySelector(
        `.editor-cell[data-line="${nextLine}"][data-col="${nextCol}"]`
    );

    if (nextCell) {
        startEditing(nextCell);
    }
}

// ============================================
// Undo/Redo
// ============================================

/**
 * Push current state to history
 */
function pushHistory() {
    const state = appState.getState();
    const snapshot = JSON.stringify(state.transcription.segments || state.transcription.lines);

    // Don't push if identical to current
    if (history.stack[history.index] === snapshot) return;

    // Remove any redo states
    history.stack = history.stack.slice(0, history.index + 1);

    // Add new state
    history.stack.push(snapshot);
    history.index = history.stack.length - 1;

    // Limit stack size
    if (history.stack.length > history.maxSize) {
        history.stack.shift();
        history.index--;
    }

    updateUndoRedoButtons();
}

/**
 * Undo last change
 */
function undo() {
    if (history.index <= 0) return;

    history.index--;
    restoreFromHistory();
}

/**
 * Redo last undone change
 */
function redo() {
    if (history.index >= history.stack.length - 1) return;

    history.index++;
    restoreFromHistory();
}

/**
 * Restore state from history
 */
function restoreFromHistory() {
    const snapshot = history.stack[history.index];
    if (!snapshot) return;

    const data = JSON.parse(snapshot);

    // Determine if it's segments or lines
    if (Array.isArray(data) && data[0]?.lineNumber !== undefined) {
        appState.data.transcription.segments = data;
        renderEditorFromSegments(data, appState.getState().transcription.columns);
    } else {
        appState.data.transcription.lines = data;
        renderEditor(data);
    }

    updateUndoRedoButtons();
}

/**
 * Update undo/redo button states
 */
function updateUndoRedoButtons() {
    const btnUndo = document.getElementById('btnUndo');
    const btnRedo = document.getElementById('btnRedo');

    if (btnUndo) btnUndo.disabled = history.index <= 0;
    if (btnRedo) btnRedo.disabled = history.index >= history.stack.length - 1;
}

// ============================================
// Keyboard Shortcuts
// ============================================

/**
 * Handle global keyboard shortcuts
 */
function handleKeyDown(e) {
    // Don't intercept if in an input or editing cell
    if (editingCell || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
    }

    // Ctrl/Cmd + Z = Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
    }
    // Ctrl/Cmd + Shift + Z or Ctrl + Y = Redo
    else if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || e.key === 'y')) {
        e.preventDefault();
        redo();
    }
    // Arrow keys for navigation
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const selectedLine = appState.getState().ui.selectedLine;
        if (selectedLine !== null) {
            e.preventDefault();
            const newLine = selectedLine + (e.key === 'ArrowUp' ? -1 : 1);
            const row = document.querySelector(`.editor-grid-row[data-line="${newLine}"]`);
            if (row) {
                appState.setSelection(newLine);
            }
        }
    }
    // Enter to start editing selected cell
    else if (e.key === 'Enter') {
        const selectedLine = appState.getState().ui.selectedLine;
        if (selectedLine !== null) {
            const firstCell = document.querySelector(
                `.editor-cell[data-line="${selectedLine}"][data-col="0"]`
            );
            if (firstCell) {
                e.preventDefault();
                startEditing(firstCell);
            }
        }
    }
}

// Export for external use
export { undo, redo, pushHistory };
