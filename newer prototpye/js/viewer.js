/**
 * vibing/js/viewer.js
 * Document Viewer Logic
 */
import { appState } from './state.js';

export function initViewer() {
    const img = document.getElementById('docImage');
    const svg = document.getElementById('regionsOverlay');
    const zoomLabel = document.getElementById('zoomLabel');

    if (!img || !svg) {
        console.error("Viewer elements not found");
        return;
    }

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

    // Zoom Controls
    document.getElementById('zoomIn')?.addEventListener('click', () => {
        appState.setZoom(state.zoom + 10);
    });

    document.getElementById('zoomOut')?.addEventListener('click', () => {
        if (state.zoom > 10) appState.setZoom(state.zoom - 10);
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
