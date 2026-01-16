/**
 * coOCR/HTR - Document Viewer Logic
 * Enhanced with Pan, Zoom, and Fit controls
 */
import { appState } from './state.js';

// Viewer state
let isPanning = false;
let startX = 0;
let startY = 0;
let scrollLeft = 0;
let scrollTop = 0;
let currentZoom = 100;
let panX = 0;
let panY = 0;

export function initViewer() {
    const img = document.getElementById('docImage');
    const svg = document.getElementById('regionsOverlay');
    const zoomLabel = document.getElementById('zoomLabel');
    const imageWrapper = document.getElementById('imageWrapper');
    const imageContainer = document.querySelector('.image-container');
    const emptyState = document.getElementById('viewerEmptyState');
    const headerDocInfo = document.getElementById('headerDocInfo');
    const headerFilename = document.getElementById('headerFilename');

    if (!img || !svg || !imageContainer) {
        console.error("[Viewer] Elements not found");
        return;
    }

    console.log('[Viewer] Initializing with pan, zoom, and fit controls');

    // Helper: Apply transform (zoom + pan)
    function applyTransform() {
        const scale = currentZoom / 100;
        imageWrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
        imageWrapper.style.transformOrigin = 'center center';
        if (zoomLabel) zoomLabel.textContent = `${currentZoom}%`;
    }

    // Helper: Set zoom level
    function setZoom(newZoom, centerX = null, centerY = null) {
        const oldZoom = currentZoom;
        currentZoom = Math.max(25, Math.min(400, newZoom));

        // If center point provided, adjust pan to zoom towards that point
        if (centerX !== null && centerY !== null) {
            const scale = currentZoom / oldZoom;
            panX = centerX - (centerX - panX) * scale;
            panY = centerY - (centerY - panY) * scale;
        }

        applyTransform();
        appState.setZoom(currentZoom);
        console.log(`[Viewer] Zoom: ${currentZoom}%`);
    }

    // Helper: Reset view
    function resetView() {
        currentZoom = 100;
        panX = 0;
        panY = 0;
        applyTransform();
        appState.setZoom(currentZoom);
        console.log('[Viewer] View reset');
    }

    // Helper: Fit to container
    function fitToContainer(mode = 'contain') {
        if (!img.naturalWidth || !img.naturalHeight) return;

        const containerRect = imageContainer.getBoundingClientRect();
        const imgWidth = img.naturalWidth;
        const imgHeight = img.naturalHeight;

        let newZoom;
        if (mode === 'width') {
            newZoom = (containerRect.width * 0.9 / imgWidth) * 100;
        } else if (mode === 'height') {
            newZoom = (containerRect.height * 0.9 / imgHeight) * 100;
        } else {
            // Contain - fit both dimensions
            const scaleX = containerRect.width * 0.9 / imgWidth;
            const scaleY = containerRect.height * 0.9 / imgHeight;
            newZoom = Math.min(scaleX, scaleY) * 100;
        }

        panX = 0;
        panY = 0;
        setZoom(newZoom);
        console.log(`[Viewer] Fit ${mode}: ${Math.round(newZoom)}%`);
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

    // ============================================
    // PAN (Drag to move)
    // ============================================

    imageContainer.addEventListener('mousedown', (e) => {
        // Only pan with left mouse button, not on regions
        if (e.button !== 0 || e.target.classList.contains('region-box')) return;

        isPanning = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
        imageContainer.style.cursor = 'grabbing';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isPanning) return;

        panX = e.clientX - startX;
        panY = e.clientY - startY;
        applyTransform();
    });

    document.addEventListener('mouseup', () => {
        if (isPanning) {
            isPanning = false;
            imageContainer.style.cursor = 'grab';
        }
    });

    // ============================================
    // MOUSE WHEEL ZOOM
    // ============================================

    imageContainer.addEventListener('wheel', (e) => {
        e.preventDefault();

        // Get mouse position relative to container
        const rect = imageContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;

        // Zoom in/out based on scroll direction
        const delta = e.deltaY > 0 ? -10 : 10;
        setZoom(currentZoom + delta, mouseX, mouseY);
    }, { passive: false });

    // ============================================
    // ZOOM CONTROLS (Buttons)
    // ============================================

    document.getElementById('zoomIn')?.addEventListener('click', () => {
        setZoom(currentZoom + 10);
    });

    document.getElementById('zoomOut')?.addEventListener('click', () => {
        setZoom(currentZoom - 10);
    });

    // Fit Width button
    document.querySelector('[title="Fit Width"]')?.addEventListener('click', () => {
        fitToContainer('width');
    });

    // Fit Height button
    document.querySelector('[title="Fit Height"]')?.addEventListener('click', () => {
        fitToContainer('height');
    });

    // Reset/Fit button (toggle icon)
    document.querySelector('[title="Reset View"]')?.addEventListener('click', () => {
        resetView();
    });

    // ============================================
    // PAGE NAVIGATION
    // ============================================

    const pageNavigation = document.getElementById('pageNavigation');
    const pageInfo = document.getElementById('pageInfo');
    const btnPrevPage = document.getElementById('btnPrevPage');
    const btnNextPage = document.getElementById('btnNextPage');

    function updatePageNavigation() {
        const pageCount = appState.getPageCount();
        const currentIndex = appState.data.currentPageIndex;

        if (pageCount > 1) {
            pageNavigation.style.display = 'flex';
            pageInfo.textContent = `Page ${currentIndex + 1} / ${pageCount}`;
            btnPrevPage.disabled = currentIndex === 0;
            btnNextPage.disabled = currentIndex >= pageCount - 1;
        } else {
            pageNavigation.style.display = 'none';
        }
    }

    btnPrevPage?.addEventListener('click', () => {
        appState.prevPage();
    });

    btnNextPage?.addEventListener('click', () => {
        appState.nextPage();
    });

    // ============================================
    // STATE EVENTS
    // ============================================

    // React to document load
    appState.addEventListener('documentLoaded', (e) => {
        showDocument(e.detail.filename);
        resetView();
        updatePageNavigation();
        // Re-render regions (will be empty after setDocument clears them)
        const currentState = appState.getState();
        renderRegions(currentState.regions);
    });

    // React to pages loaded (multi-page documents)
    appState.addEventListener('pagesLoaded', (e) => {
        console.log(`[Viewer] Pages loaded: ${e.detail.count}`);
        updatePageNavigation();
    });

    // React to page changes
    appState.addEventListener('pageChanged', (e) => {
        console.log(`[Viewer] Page changed to ${e.detail.index + 1}/${e.detail.total}`);
        showDocument(e.detail.filename);
        resetView();
        updatePageNavigation();
        // Regions will be updated via imageChanged event
    });

    // React to image changes
    appState.addEventListener('imageChanged', (e) => {
        if (!e.detail.url) return;
        img.src = e.detail.url;
        showDocument(appState.data.document.filename);
        // Auto-fit when image loads
        img.onload = () => {
            fitToContainer('contain');
            // Render regions after image loads
            const currentState = appState.getState();
            renderRegions(currentState.regions);
        };
    });

    appState.addEventListener('zoomChanged', (e) => {
        if (e.detail.zoom !== currentZoom) {
            currentZoom = e.detail.zoom;
            applyTransform();
        }
    });

    appState.addEventListener('selectionChanged', (e) => {
        document.querySelectorAll('.region-box.selected').forEach(el => el.classList.remove('selected'));
        const regionEl = document.querySelector(`.region-box[data-line="${e.detail.line}"]`);
        if (regionEl) {
            regionEl.classList.add('selected');
        }
    });

    // Render initial regions
    const state = appState.getState();
    renderRegions(state.regions);

    // Listen for regions changes (e.g., from PAGE-XML import)
    appState.addEventListener('regionsChanged', () => {
        const currentState = appState.getState();
        renderRegions(currentState.regions);
    });

    // Also re-render regions when transcription completes
    appState.addEventListener('transcriptionComplete', () => {
        const currentState = appState.getState();
        renderRegions(currentState.regions);
    });

    // ============================================
    // KEYBOARD SHORTCUTS
    // ============================================

    document.addEventListener('keydown', (e) => {
        // Only when not typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // + or = to zoom in
        if (e.key === '+' || e.key === '=') {
            setZoom(currentZoom + 10);
            e.preventDefault();
        }
        // - to zoom out
        if (e.key === '-') {
            setZoom(currentZoom - 10);
            e.preventDefault();
        }
        // 0 to reset
        if (e.key === '0') {
            resetView();
            e.preventDefault();
        }
        // f to fit
        if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
            fitToContainer('contain');
            e.preventDefault();
        }
        // Arrow left/right for page navigation
        if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey && appState.isMultiPage()) {
            appState.prevPage();
            e.preventDefault();
        }
        if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey && appState.isMultiPage()) {
            appState.nextPage();
            e.preventDefault();
        }
    });

    // Initialize page navigation
    updatePageNavigation();

    console.log('[Viewer] Ready - Pan: drag, Zoom: wheel/+/-, Fit: f, Reset: 0, Pages: ←/→');
}

function renderRegions(regions) {
    const svg = document.getElementById('regionsOverlay');
    if (!svg) return;

    svg.innerHTML = ''; // clear

    regions.forEach(reg => {
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", reg.x + "%");
        rect.setAttribute("y", reg.y + "%");
        rect.setAttribute("width", reg.w + "%");
        rect.setAttribute("height", reg.h + "%");
        rect.setAttribute("class", "region-box");
        rect.setAttribute("data-line", reg.line);

        // Add confidence class if available
        if (reg.confidence) {
            rect.classList.add(reg.confidence);
        }

        rect.onclick = (e) => {
            e.stopPropagation();
            appState.setSelection(reg.line);
        };
        svg.appendChild(rect);
    });

    console.log(`[Viewer] Rendered ${regions.length} regions`);
}

// Export for external use
export { renderRegions };
