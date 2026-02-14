/**
 * coOCR/HTR Editor
 * Simple textarea-based transcription editor
 *
 * The expert sees the raw LLM output and can edit it directly.
 * No complex parsing, no grid/lines modes - just text.
 */
import { appState } from './state.js';
import { getById } from './utils/dom.js';
import { escapeHtml } from './utils/textFormatting.js';

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

// Current text direction
let _isRTL = false;

/**
 * Detect if text is predominantly RTL (Arabic, Hebrew, etc.)
 * @param {string} text - Text to analyze
 * @returns {boolean} True if text should be displayed RTL
 */
function detectRTL(text) {
    if (!text) return false;

    // Count RTL characters (Arabic, Hebrew, Persian, Urdu ranges)
    const rtlChars = text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/g);
    const ltrChars = text.match(/[a-zA-Z]/g);

    const rtlCount = rtlChars ? rtlChars.length : 0;
    const ltrCount = ltrChars ? ltrChars.length : 0;

    // If more than 30% RTL characters, consider it RTL text
    const total = rtlCount + ltrCount;
    return total > 0 && (rtlCount / total) > 0.3;
}

/**
 * Apply RTL direction to editor elements
 * @param {boolean} rtl - Whether to apply RTL
 */
function applyRTLDirection(rtl) {
    _isRTL = rtl;

    if (textarea) {
        textarea.dir = rtl ? 'rtl' : 'ltr';
        textarea.classList.toggle('rtl', rtl);
    }

    if (diffDisplay) {
        diffDisplay.dir = rtl ? 'rtl' : 'ltr';
        diffDisplay.classList.toggle('rtl', rtl);
    }

    if (lineNumbers) {
        lineNumbers.classList.toggle('rtl', rtl);
    }

    // Also update the editor container
    const editorWithLines = document.querySelector('.editor-with-lines');
    if (editorWithLines) {
        editorWithLines.classList.toggle('rtl', rtl);
    }
}

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

    // React to selection changes (from validation clicks or viewer clicks)
    appState.addEventListener('selectionChanged', (e) => {
        highlightEditorLine(e.detail.line);
    });

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
                <p>No transcription available.</p>
                <p class="text-secondary">Load a document and click "Transcribe".</p>
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
                <button class="view-mode-btn active" id="viewStructured" title="Structured View (Original Formatting)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10H3M21 6H3M21 14H3M21 18H10"/>
                    </svg>
                    <span>Structured</span>
                </button>
                <button class="view-mode-btn" id="viewNormalized" title="Normalized View (left-aligned)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 6H3M21 10H3M21 14H3M21 18H3"/>
                    </svg>
                    <span>Normalized</span>
                </button>
            </div>
            <div class="editor-toolbar-right">
                <label class="checkbox-wrapper" title="Shows changes compared to original (view only, not editable)">
                    <input type="checkbox" id="showChanges">
                    <span>Diff View</span>
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
                    placeholder="Transcription will be displayed here..."
                ></textarea>
            </div>
            <div id="diffDisplay" class="diff-display" style="display: none;">
                <div class="diff-readonly-hint">Read-only - disable diff view to edit</div>
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

        // Detect and apply RTL direction
        const rtlDetected = detectRTL(text);
        applyRTLDirection(rtlDetected);

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
            appState.setTranscriptionRaw(structuredText, { syncSegments: true });
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

/**
 * Apply an LLM suggestion to a specific line in the editor.
 * Conservative strategy:
 * 1) Exact sourceText match in target line
 * 2) Flexible whitespace-aware match in target line
 * 3) Full-line replacement only if sourceText is missing and line is non-empty
 *
 * @param {object} params
 * @param {number|string} params.line - 1-based line number
 * @param {string} [params.sourceText] - Text to replace in the target line
 * @param {string} params.suggestion - Suggested replacement text
 * @returns {{status: 'applied' | 'ambiguous' | 'failed', message: string}}
 */
export function applySuggestionAtLine(params = {}) {
    if (!textarea) {
        return { status: 'failed', message: 'Editor is not ready.' };
    }

    const requestedLine = Number.parseInt(params.line, 10);
    const sourceText = typeof params.sourceText === 'string' ? params.sourceText : '';
    const suggestion = typeof params.suggestion === 'string' ? params.suggestion : '';

    if (!Number.isInteger(requestedLine) || requestedLine <= 0) {
        return { status: 'failed', message: 'Invalid line number.' };
    }

    if (!suggestion.trim()) {
        return { status: 'failed', message: 'Suggestion is empty.' };
    }

    const lines = structuredText.split('\n');
    let lineIndex = requestedLine - 1;

    if (lineIndex < 0 || lineIndex >= lines.length) {
        return { status: 'failed', message: 'Line is outside the current transcription.' };
    }

    const targetLine = lines[lineIndex] || '';
    let updatedLine = null;
    let remappedLine = null;

    // Strategy 1+2: line-local source-text match
    const hasSource = sourceText.trim().length > 0;
    if (hasSource && updatedLine === null) {
        const localMatch = tryReplaceSourceInLine(targetLine, sourceText, suggestion);
        if (localMatch.status === 'ambiguous') {
            return { status: 'ambiguous', message: localMatch.message };
        }
        if (localMatch.status === 'applied') {
            updatedLine = localMatch.updatedLine;
        }
    }

    // Strategy 3: document-wide fallback when line number is off but source match is unique.
    if (hasSource && updatedLine === null) {
        const candidates = [];

        lines.forEach((candidateLine, idx) => {
            const match = tryReplaceSourceInLine(candidateLine || '', sourceText, suggestion);
            if (match.status === 'applied') {
                candidates.push({ lineIndex: idx, updatedLine: match.updatedLine });
            }
        });

        if (candidates.length === 1) {
            lineIndex = candidates[0].lineIndex;
            updatedLine = candidates[0].updatedLine;
            remappedLine = lineIndex + 1;
        } else if (candidates.length > 1) {
            return { status: 'ambiguous', message: 'Source text appears in multiple lines. Apply manually.' };
        }
    }

    // Strategy 4: full-line fallback (only without source text)
    if (!hasSource && updatedLine === null) {
        if (!targetLine.trim()) {
            return { status: 'ambiguous', message: 'Target line is empty.' };
        }
        updatedLine = suggestion;
    }

    if (updatedLine === null) {
        return { status: 'ambiguous', message: 'Source text not found in the target line.' };
    }

    // No-op guard (avoid noisy history entries)
    if (updatedLine === lines[lineIndex]) {
        highlightEditorLine(lineIndex + 1);
        return { status: 'ambiguous', message: 'Suggestion does not change the target line.' };
    }

    // Ensure pre-change baseline exists in history (may be empty after session restore)
    pushHistory();

    lines[lineIndex] = updatedLine;
    structuredText = lines.join('\n');

    // Keep current view mode, but persist structured text.
    textarea.value = isNormalizedView ? normalizeText(structuredText) : structuredText;
    appState.setTranscriptionRaw(structuredText, { syncSegments: true });
    updateLineNumbers();
    updateChangeStats();

    const showChangesCheckbox = getById('showChanges');
    if (showChangesCheckbox?.checked) {
        updateDiffDisplay(isNormalizedView);
    }

    pushHistory();
    const appliedLine = lineIndex + 1;
    highlightEditorLine(appliedLine);

    if (remappedLine !== null && remappedLine !== requestedLine) {
        return {
            status: 'applied',
            line: appliedLine,
            message: `Applied suggestion at line ${appliedLine} (requested line ${requestedLine}).`
        };
    }

    return { status: 'applied', line: appliedLine, message: `Applied suggestion at line ${appliedLine}.` };
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
    appState.setTranscriptionRaw(structuredText, { syncSegments: true });
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
    appState.setTranscriptionRaw(structuredText, { syncSegments: true });
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

    statsEl.textContent = `${changes} line${changes !== 1 ? 's' : ''} changed`;
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
        const origLine = origLines[i] ?? '';
        const currLine = currLines[i] ?? '';

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

// ============ Selection Highlighting ============

/**
 * Highlight a specific line in the editor
 * Called when user clicks on a validation issue or viewer region
 * @param {number} lineNumber - 1-based line number
 */
function highlightEditorLine(lineNumber) {
    if (!lineNumbers || !textarea) return;

    // Remove previous selection
    const prevSelected = lineNumbers.querySelector('.line-number.selected');
    if (prevSelected) {
        prevSelected.classList.remove('selected');
    }

    // Find and highlight the new line number
    const lineNumberElements = lineNumbers.querySelectorAll('.line-number');
    const targetIndex = lineNumber - 1; // Convert to 0-based

    if (targetIndex >= 0 && targetIndex < lineNumberElements.length) {
        const targetElement = lineNumberElements[targetIndex];
        targetElement.classList.add('selected');

        // Scroll textarea to show the line
        scrollToLine(lineNumber);

        // Also scroll line numbers panel if needed
        if (typeof targetElement.scrollIntoView === 'function') {
            targetElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }
}

/**
 * Scroll textarea to a specific line
 * @param {number} lineNumber - 1-based line number
 */
function scrollToLine(lineNumber) {
    if (!textarea) return;

    const lines = textarea.value.split('\n');
    if (lineNumber < 1 || lineNumber > lines.length) return;

    // Calculate character position of line start
    let charPos = 0;
    for (let i = 0; i < lineNumber - 1; i++) {
        charPos += lines[i].length + 1; // +1 for newline
    }

    // Set selection to line start (this also scrolls to it)
    textarea.focus();
    textarea.setSelectionRange(charPos, charPos);

    // Calculate approximate scroll position
    // Use line height estimation (each line is about 1.6em = ~24px at 15px font)
    const lineHeight = 24;
    const targetScroll = (lineNumber - 1) * lineHeight - textarea.clientHeight / 2 + lineHeight;
    textarea.scrollTop = Math.max(0, targetScroll);
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

function normalizeWhitespace(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
}

function escapeRegExp(text) {
    return (text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countPlainMatches(text, search) {
    if (!search) return 0;
    return text.split(search).length - 1;
}

function countRegexMatches(text, regex) {
    if (!regex.global) {
        return regex.test(text) ? 1 : 0;
    }
    const matches = text.match(regex);
    return matches ? matches.length : 0;
}

function buildFlexibleSourcePattern(sourceText, caseInsensitive = false) {
    const flags = caseInsensitive ? 'gi' : 'g';
    return new RegExp(
        escapeRegExp((sourceText || '').trim()).replace(/\s+/g, '\\s+'),
        flags
    );
}

function tryReplaceSourceInLine(lineText, sourceText, suggestion) {
    const source = (sourceText || '').trim();
    if (!source) {
        return { status: 'not-found' };
    }

    // 1) Exact case-sensitive substring match
    if (lineText.includes(source)) {
        const exactMatchCount = countPlainMatches(lineText, source);
        if (exactMatchCount !== 1) {
            return { status: 'ambiguous', message: 'Source text matches multiple times in this line.' };
        }
        return { status: 'applied', updatedLine: lineText.replace(source, () => suggestion) };
    }

    // 2) Flexible whitespace case-sensitive
    const normalizedSource = normalizeWhitespace(source);
    const normalizedLine = normalizeWhitespace(lineText);
    if (normalizedSource && normalizedLine.includes(normalizedSource)) {
        const flexiblePattern = buildFlexibleSourcePattern(source, false);
        const matchCount = countRegexMatches(lineText, flexiblePattern);
        if (matchCount > 1) {
            return { status: 'ambiguous', message: 'Source text cannot be mapped uniquely in this line.' };
        }
        if (matchCount === 1) {
            return { status: 'applied', updatedLine: lineText.replace(flexiblePattern, () => suggestion) };
        }
    }

    // 3) Flexible whitespace case-insensitive
    if (normalizedSource && normalizedLine.toLowerCase().includes(normalizedSource.toLowerCase())) {
        const ciPattern = buildFlexibleSourcePattern(source, true);
        const matchCount = countRegexMatches(lineText, ciPattern);
        if (matchCount > 1) {
            return { status: 'ambiguous', message: 'Source text cannot be mapped uniquely in this line.' };
        }
        if (matchCount === 1) {
            return { status: 'applied', updatedLine: lineText.replace(ciPattern, () => suggestion) };
        }
    }

    return { status: 'not-found' };
}
