/**
 * vibing/js/editor.js
 * Transcription Editor Logic
 */
import { appState } from './state.js';

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

    // Initial render
    renderEditor(appState.getState().transcription);
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

    // Add click listeners
    container.querySelectorAll('.editor-grid-row[data-line]').forEach(row => {
        row.addEventListener('click', () => {
            const line = parseInt(row.getAttribute('data-line'));
            appState.setSelection(line);
        });
    });
}
