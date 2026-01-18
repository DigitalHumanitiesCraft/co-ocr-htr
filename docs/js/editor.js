/**
 * coOCR/HTR Editor
 * Flexible Transcription Editor with support for multiple source types
 *
 * Editor Modes:
 * - 'lines': Simple line-based view (letters, diaries, manuscripts)
 * - 'grid': Column-based grid view (account books, inventories)
 * - 'auto': Automatically detect from data structure
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

// Current editor mode
let editorMode = 'auto';

export function initEditor() {
    const container = document.getElementById('editorContent');
    if (!container) return;

    // React to selection
    appState.addEventListener('selectionChanged', (e) => {
        document.querySelectorAll('.editor-grid-row.active, .editor-line.active').forEach(el => el.classList.remove('active'));
        const lineEl = document.querySelector(`[data-line="${e.detail.line}"]`);
        if (lineEl) {
            lineEl.classList.add('active');
            lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });

    // React to transcription updates
    appState.addEventListener('transcriptionComplete', () => {
        const state = appState.getState();
        renderEditor(state.transcription);
        pushHistory();
    });

    // React to document load (reset editor when new document is loaded)
    appState.addEventListener('documentLoaded', () => {
        const state = appState.getState();
        renderEditor(state.transcription);
        // Clear history for new document
        history.stack = [];
        history.index = -1;
        updateUndoRedoButtons();
    });

    // React to page changes (multi-page documents, IIIF)
    appState.addEventListener('pageChanged', () => {
        const state = appState.getState();
        renderEditor(state.transcription);
        // Clear history for new page
        history.stack = [];
        history.index = -1;
        updateUndoRedoButtons();
    });

    // React to new pages loaded (IIIF manifest, folder upload)
    appState.addEventListener('pagesLoaded', () => {
        const state = appState.getState();
        renderEditor(state.transcription);
        // Clear history for new document set
        history.stack = [];
        history.index = -1;
        updateUndoRedoButtons();
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
    renderEditor(state.transcription);
}

/**
 * Main render function - determines mode and renders accordingly
 */
function renderEditor(transcription) {
    const container = document.getElementById('editorContent');
    if (!container) return;

    // Determine editor mode
    const mode = detectEditorMode(transcription);
    editorMode = mode;

    if (mode === 'grid') {
        renderGridEditor(container, transcription);
    } else {
        renderLinesEditor(container, transcription);
    }
}

/**
 * Detect which editor mode to use based on data structure
 */
function detectEditorMode(transcription) {
    // No data at all → lines mode (will show empty state)
    const hasData = (transcription.segments?.length > 0) ||
                    (transcription.lines?.length > 0);
    if (!hasData) {
        return 'lines';
    }

    // Explicit columns defined → grid
    if (transcription.columns?.length > 0) {
        return 'grid';
    }

    // Check segments for structured fields
    if (transcription.segments?.length > 0) {
        const hasFields = transcription.segments.some(s => s.fields && Object.keys(s.fields).length > 1);
        if (hasFields) return 'grid';

        // Check for pipe separators in text
        const hasPipes = transcription.segments.some(s => s.text?.includes('|'));
        if (hasPipes) return 'grid';
    }

    // Check lines for pipe separators
    if (transcription.lines?.length > 0) {
        const hasPipes = transcription.lines.some(line =>
            typeof line === 'string' && line.includes('|') && line.split('|').length > 2
        );
        if (hasPipes) return 'grid';
    }

    // Default: lines mode for simple text
    return 'lines';
}

/**
 * Render simple line-based editor (for letters, diaries, manuscripts)
 */
function renderLinesEditor(container, transcription) {
    let html = '<div class="editor-lines">';

    // Get data source
    const lines = transcription.segments?.map(s => ({
        lineNumber: s.lineNumber,
        text: s.text,
        confidence: s.confidence
    })) || transcription.lines?.map((text, i) => ({
        lineNumber: i + 1,
        text: typeof text === 'string' ? text : text.text,
        confidence: text.confidence || 'certain'
    })) || [];

    if (lines.length === 0) {
        html += `
            <div class="editor-empty-state">
                <p>Keine Transkription vorhanden.</p>
                <p class="text-secondary">Lade ein Dokument und starte die Transkription.</p>
            </div>
        `;
    } else {
        lines.forEach((line) => {
            const lineNum = line.lineNumber;
            const text = line.text || '';
            const confidence = line.confidence || 'certain';

            // Apply markers
            const displayText = text
                .replace(/\[\?\]/g, '<span class="marker-uncertain" title="Unsicher">[?]</span>')
                .replace(/\[illegible\]/g, '<span class="marker-illegible" title="Unleserlich">...</span>');

            const confidenceClass = confidence === 'uncertain' ? 'confidence-uncertain' :
                                    confidence === 'likely' ? 'confidence-likely' : '';

            html += `
                <div class="editor-line ${confidenceClass}" data-line="${lineNum}">
                    <span class="line-num">${lineNum}</span>
                    <span class="line-text" data-line="${lineNum}" title="${text}">${displayText || '&nbsp;'}</span>
                </div>
            `;
        });
    }

    html += '</div>';
    container.innerHTML = html;
    bindLinesEditorEvents(container);
}

/**
 * Render grid-based editor (for account books, inventories)
 */
function renderGridEditor(container, transcription) {
    // If no data at all, show empty state instead of grid
    const hasData = (transcription.segments?.length > 0) ||
                    (transcription.lines?.length > 0);

    if (!hasData) {
        container.innerHTML = `
            <div class="editor-empty-state">
                <p>Keine Transkription vorhanden.</p>
                <p class="text-secondary">Lade ein Dokument und starte die Transkription.</p>
            </div>
        `;
        return;
    }

    let html = '';

    // Determine columns
    let columns = transcription.columns || [];

    // Auto-detect columns from first segment or line
    if (columns.length === 0) {
        const firstSegment = transcription.segments?.[0];
        const firstLine = transcription.lines?.[0];

        if (firstSegment?.fields) {
            columns = Object.keys(firstSegment.fields).map(key => ({
                id: key,
                label: key.charAt(0).toUpperCase() + key.slice(1)
            }));
        } else if (firstSegment?.text?.includes('|') || (typeof firstLine === 'string' && firstLine.includes('|'))) {
            const parts = (firstSegment?.text || firstLine).split('|').filter(p => p.trim());
            columns = parts.map((_, i) => ({
                id: `col${i}`,
                label: `Spalte ${i + 1}`
            }));
        }
    }

    // If no columns detected, use single TEXT column
    if (columns.length === 0) {
        columns = [
            { id: 'text', label: 'TEXT' }
        ];
    }

    // Set CSS grid template
    const gridCols = `3rem repeat(${columns.length}, 1fr)`;

    // Header row
    html += `
        <div class="editor-grid-row editor-header" style="grid-template-columns: ${gridCols};">
            <div class="editor-cell header">#</div>
            ${columns.map(c => `<div class="editor-cell header">${c.label}</div>`).join('')}
        </div>
    `;

    // Data rows
    const segments = transcription.segments || [];
    const lines = transcription.lines || [];

    // Use segments if available, otherwise parse lines
    const dataRows = segments.length > 0
        ? segments
        : lines.map((line, i) => ({
            lineNumber: i + 1,
            text: typeof line === 'string' ? line : line.text,
            confidence: line.confidence || 'certain'
        }));

    if (dataRows.length === 0) {
        html += `
            <div class="editor-empty-state">
                <p>Keine Transkription vorhanden.</p>
                <p class="text-secondary">Lade ein Dokument und starte die Transkription.</p>
            </div>
        `;
    } else {
        dataRows.forEach((row) => {
            const lineNum = row.lineNumber;
            const confidence = row.confidence || 'certain';
            const confidenceClass = confidence === 'uncertain' ? 'confidence-uncertain' :
                                    confidence === 'likely' ? 'confidence-likely' : '';

            // Get cell values
            let cells;
            if (row.fields && Object.keys(row.fields).length > 0) {
                cells = columns.map(col => row.fields[col.id] || '');
            } else if (row.text) {
                const parts = row.text.replace(/^\||\|$/g, '').split('|').map(s => s.trim());
                cells = columns.map((_, i) => parts[i] || '');
            } else {
                cells = columns.map(() => '');
            }

            // Skip header-like rows
            if (row.text?.includes('---') || (cells[0]?.toLowerCase() === 'datum' && lineNum === 1)) {
                return;
            }

            const cellsHtml = cells.map((cell, colIdx) => {
                const displayCell = (cell || '')
                    .replace(/\[\?\]/g, '<span class="marker-uncertain" title="Unsicher">[?]</span>')
                    .replace(/\[illegible\]/g, '<span class="marker-illegible" title="Unleserlich">...</span>');
                return `<div class="editor-cell" data-line="${lineNum}" data-col="${colIdx}" title="${cell || ''}">${displayCell || '&nbsp;'}</div>`;
            }).join('');

            html += `
                <div class="editor-grid-row ${confidenceClass}" data-line="${lineNum}" style="grid-template-columns: ${gridCols};">
                    <div class="line-num">${lineNum}</div>
                    ${cellsHtml}
                </div>
            `;
        });
    }

    container.innerHTML = html;
    bindGridEditorEvents(container);
}

/**
 * Bind event listeners for lines editor
 */
function bindLinesEditorEvents(container) {
    container.querySelectorAll('.editor-line[data-line]').forEach(line => {
        line.addEventListener('click', () => {
            const lineNum = parseInt(line.getAttribute('data-line'));
            appState.setSelection(lineNum);
        });
    });

    container.querySelectorAll('.line-text[data-line]').forEach(cell => {
        cell.addEventListener('dblclick', () => startEditing(cell));
    });
}

/**
 * Bind event listeners for grid editor
 */
function bindGridEditorEvents(container) {
    container.querySelectorAll('.editor-grid-row[data-line]').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.classList.contains('editor-cell') && !e.target.classList.contains('header')) {
                return;
            }
            const line = parseInt(row.getAttribute('data-line'));
            appState.setSelection(line);
        });
    });

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

    cell.dataset.originalValue = originalText;
    cell.contentEditable = 'true';
    cell.classList.add('editing');
    cell.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(cell);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

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
    } else if (e.key === 'Tab' && editorMode === 'grid') {
        e.preventDefault();
        finishEditing(e.target, true);
        navigateToNextCell(e.target, e.shiftKey ? -1 : 1);
    }
}

/**
 * Handle blur on editing cell
 */
function handleCellBlur(e) {
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
        const lineNum = parseInt(cell.dataset.line);
        const colIdx = cell.dataset.col !== undefined ? parseInt(cell.dataset.col) : null;

        const state = appState.getState();
        const segment = state.transcription.segments?.find(s => s.lineNumber === lineNum);

        if (segment) {
            if (colIdx !== null && segment.fields) {
                const keys = Object.keys(segment.fields);
                if (keys[colIdx]) {
                    segment.fields[keys[colIdx]] = newValue;
                }
                segment.text = Object.values(segment.fields).join(' | ');
            } else {
                segment.text = newValue;
            }

            appState.updateSegment(lineNum, {
                text: segment.text,
                fields: segment.fields
            });
        }

        pushHistory();

        // Re-render markers
        cell.innerHTML = (newValue || '&nbsp;')
            .replace(/\[\?\]/g, '<span class="marker-uncertain" title="Unsicher">[?]</span>')
            .replace(/\[illegible\]/g, '<span class="marker-illegible" title="Unleserlich">...</span>');
    } else {
        cell.innerHTML = (originalValue || '&nbsp;')
            .replace(/\[\?\]/g, '<span class="marker-uncertain" title="Unsicher">[?]</span>')
            .replace(/\[illegible\]/g, '<span class="marker-illegible" title="Unleserlich">...</span>');
    }

    delete cell.dataset.originalValue;
    editingCell = null;
}

/**
 * Navigate to adjacent cell (grid mode only)
 */
function navigateToNextCell(currentCell, direction) {
    const line = parseInt(currentCell.dataset.line);
    const col = parseInt(currentCell.dataset.col);
    const maxCol = document.querySelectorAll(`.editor-cell[data-line="${line}"]`).length - 1;

    let nextCol = col + direction;
    let nextLine = line;

    if (nextCol > maxCol) {
        nextCol = 0;
        nextLine = line + 1;
    } else if (nextCol < 0) {
        nextCol = maxCol;
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

function pushHistory() {
    const state = appState.getState();
    const snapshot = JSON.stringify(state.transcription.segments || state.transcription.lines);

    if (history.stack[history.index] === snapshot) return;

    history.stack = history.stack.slice(0, history.index + 1);
    history.stack.push(snapshot);
    history.index = history.stack.length - 1;

    if (history.stack.length > history.maxSize) {
        history.stack.shift();
        history.index--;
    }

    updateUndoRedoButtons();
}

function undo() {
    if (history.index <= 0) return;
    history.index--;
    restoreFromHistory();
}

function redo() {
    if (history.index >= history.stack.length - 1) return;
    history.index++;
    restoreFromHistory();
}

function restoreFromHistory() {
    const snapshot = history.stack[history.index];
    if (!snapshot) return;

    const data = JSON.parse(snapshot);
    const state = appState.getState();

    if (Array.isArray(data) && data[0]?.lineNumber !== undefined) {
        state.transcription.segments = data;
    } else {
        state.transcription.lines = data;
    }

    renderEditor(state.transcription);
    updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
    const btnUndo = document.getElementById('btnUndo');
    const btnRedo = document.getElementById('btnRedo');

    if (btnUndo) btnUndo.disabled = history.index <= 0;
    if (btnRedo) btnRedo.disabled = history.index >= history.stack.length - 1;
}

// ============================================
// Keyboard Shortcuts
// ============================================

function handleKeyDown(e) {
    if (editingCell || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || e.key === 'y')) {
        e.preventDefault();
        redo();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const state = appState.getState();
        const selectedLine = state.ui?.selectedLine;
        if (selectedLine !== null && selectedLine !== undefined) {
            e.preventDefault();
            const newLine = selectedLine + (e.key === 'ArrowUp' ? -1 : 1);
            const row = document.querySelector(`[data-line="${newLine}"]`);
            if (row) {
                appState.setSelection(newLine);
            }
        }
    } else if (e.key === 'Enter') {
        const state = appState.getState();
        const selectedLine = state.ui?.selectedLine;
        if (selectedLine !== null && selectedLine !== undefined) {
            const firstCell = editorMode === 'grid'
                ? document.querySelector(`.editor-cell[data-line="${selectedLine}"][data-col="0"]`)
                : document.querySelector(`.line-text[data-line="${selectedLine}"]`);
            if (firstCell) {
                e.preventDefault();
                startEditing(firstCell);
            }
        }
    }
}

export { undo, redo, pushHistory };
