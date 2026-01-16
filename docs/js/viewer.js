/**
 * coOCR/HTR - Document Viewer Logic
 */
import { appState } from './state.js';

export function initViewer() {
    const img = document.getElementById('docImage');
    const svg = document.getElementById('regionsOverlay');
    const zoomLabel = document.getElementById('zoomLabel');
    const imageWrapper = document.getElementById('imageWrapper');
    const emptyState = document.getElementById('viewerEmptyState');
    const headerDocInfo = document.getElementById('headerDocInfo');
    const headerFilename = document.getElementById('headerFilename');

    if (!img || !svg) {
        console.error("Viewer elements not found");
        return;
    }

    // Helper: Show document view, hide empty state
    function showDocument(filename) {
        if (emptyState) emptyState.classList.add('hidden');
        if (imageWrapper) imageWrapper.style.display = 'block';
        if (headerDocInfo) headerDocInfo.style.display = 'flex';
        if (headerFilename && filename) headerFilename.textContent = filename;
    }

    // Helper: Show empty state, hide document view
    function showEmptyState() {
        if (emptyState) emptyState.classList.remove('hidden');
        if (imageWrapper) imageWrapper.style.display = 'none';
        if (headerDocInfo) headerDocInfo.style.display = 'none';
    }

    // React to document load
    appState.addEventListener('documentLoaded', (e) => {
        showDocument(e.detail.filename);
        // Re-render regions (will be empty after setDocument clears them)
        const currentState = appState.getState();
        renderRegions(currentState.regions);
    });

    // React to state changes
    appState.addEventListener('imageChanged', (e) => {
        img.src = e.detail.url;
    });

    appState.addEventListener('zoomChanged', (e) => {
        img.style.transform = `scale(${e.detail.zoom / 100})`;
        if (zoomLabel) zoomLabel.textContent = `${e.detail.zoom}%`;
    });

    appState.addEventListener('selectionChanged', (e) => {
        document.querySelectorAll('.region-box.selected').forEach(el => el.classList.remove('selected'));
        const regionEl = document.querySelector(`.region-box[data-line="${e.detail.line}"]`);
        if (regionEl) regionEl.classList.add('selected');
    });

    // Render initial regions
    const state = appState.getState();
    renderRegions(state.regions);

    // Listen for regions changes (e.g., from PAGE-XML import)
    appState.addEventListener('regionsChanged', () => {
        const currentState = appState.getState();
        renderRegions(currentState.regions);
    });

    // Also re-render regions when transcription completes (regions may come from segments)
    appState.addEventListener('transcriptionComplete', () => {
        const currentState = appState.getState();
        renderRegions(currentState.regions);
    });

    // Zoom Controls - use appState.zoom getter for current value
    document.getElementById('zoomIn')?.addEventListener('click', () => {
        appState.setZoom(appState.zoom + 10);
    });

    document.getElementById('zoomOut')?.addEventListener('click', () => {
        if (appState.zoom > 25) appState.setZoom(appState.zoom - 10);
    });
}

function renderRegions(regions) {
    const svg = document.getElementById('regionsOverlay');
    svg.innerHTML = ''; // clear

    regions.forEach(reg => {
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", reg.x + "%");
        rect.setAttribute("y", reg.y + "%");
        rect.setAttribute("width", reg.w + "%");
        rect.setAttribute("height", reg.h + "%");
        rect.setAttribute("class", "region-box");
        rect.setAttribute("data-line", reg.line);

        rect.onclick = (e) => {
            e.stopPropagation();
            appState.setSelection(reg.line);
        };
        svg.appendChild(rect);
    });
}
