/**
 * coOCR/HTR - Document Viewer (OpenSeadragon)
 * IIIF-compatible image viewer with SVG overlay for regions
 */
import { appState } from './state.js';
import { getById, show, hide, setText, setDisabled, addClass, removeClass, createSVGElement, selectAll, select } from './utils/dom.js';
import { IIIF_CONTEXT_V3, IIIF_VERSION } from './utils/constants.js';

let viewer = null;
let svgOverlay = null;

export function initViewer() {
    const container = document.getElementById('osd-viewer');
    const zoomLabel = document.getElementById('zoomLabel');
    const emptyState = document.getElementById('viewerEmptyState');
    const headerDocInfo = document.getElementById('headerDocInfo');
    const headerFilename = document.getElementById('headerFilename');

    if (!container) {
        console.error('[Viewer] OSD container not found');
        return;
    }

    console.log('[Viewer] Initializing OpenSeadragon viewer');

    // Initialize OpenSeadragon
    viewer = OpenSeadragon({
        id: 'osd-viewer',
        prefixUrl: 'https://cdn.jsdelivr.net/npm/openseadragon@4.1/build/openseadragon/images/',

        // No initial image
        tileSources: [],

        // UI options - we use our own toolbar
        showNavigationControl: false,
        showZoomControl: false,
        showHomeControl: false,
        showFullPageControl: false,

        // Behavior
        gestureSettingsMouse: {
            clickToZoom: false,
            dblClickToZoom: true
        },
        gestureSettingsTouch: {
            pinchToZoom: true
        },

        // Animation
        animationTime: 0.3,
        springStiffness: 10,

        // Constraints
        minZoomLevel: 0.5,
        maxZoomLevel: 10,
        visibilityRatio: 0.5,

        // Background
        background: 'transparent'
    });

    // Initialize SVG Overlay
    svgOverlay = viewer.svgOverlay();

    // Setup toolbar controls
    setupToolbarControls();

    // Setup state listeners
    setupStateListeners();

    // Setup page navigation
    setupPageNavigation();

    // Check initial state
    checkInitialState();

    console.log('[Viewer] OpenSeadragon ready - Pan: drag, Zoom: wheel/dblclick, Fit: toolbar');
}

// ============================================
// TOOLBAR CONTROLS
// ============================================

function setupToolbarControls() {
    const zoomLabel = document.getElementById('zoomLabel');

    // Zoom tracking
    viewer.addHandler('zoom', (e) => {
        const zoomPercent = Math.round(e.zoom * 100);
        if (zoomLabel) zoomLabel.textContent = `${zoomPercent}%`;
        appState.setZoom(zoomPercent);
    });

    // Zoom In button
    document.getElementById('zoomIn')?.addEventListener('click', () => {
        viewer.viewport.zoomBy(1.2);
    });

    // Zoom Out button
    document.getElementById('zoomOut')?.addEventListener('click', () => {
        viewer.viewport.zoomBy(0.8);
    });

    // Fit to View button
    document.getElementById('btnFitView')?.addEventListener('click', () => {
        viewer.viewport.goHome();
    });

    // Reset View button (also resets rotation)
    document.getElementById('btnResetView')?.addEventListener('click', () => {
        viewer.viewport.goHome();
        viewer.viewport.setRotation(0);
        viewer.viewport.setFlip(false);
    });

    // Rotate Left button (-90 degrees)
    document.getElementById('btnRotateLeft')?.addEventListener('click', () => {
        rotateLeft();
    });

    // Rotate Right button (+90 degrees)
    document.getElementById('btnRotateRight')?.addEventListener('click', () => {
        rotateRight();
    });

    // Flip Horizontal button
    document.getElementById('btnFlipH')?.addEventListener('click', () => {
        flipHorizontal();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Only when not typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // + or = to zoom in
        if (e.key === '+' || e.key === '=') {
            viewer.viewport.zoomBy(1.2);
            e.preventDefault();
        }
        // - to zoom out
        if (e.key === '-') {
            viewer.viewport.zoomBy(0.8);
            e.preventDefault();
        }
        // 0 to reset
        if (e.key === '0') {
            viewer.viewport.goHome();
            viewer.viewport.setRotation(0);
            viewer.viewport.setFlip(false);
            e.preventDefault();
        }
        // f to fit
        if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
            viewer.viewport.goHome();
            e.preventDefault();
        }
        // r to rotate left, R (shift+r) to rotate right
        if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
            rotateLeft();
            e.preventDefault();
        }
        if (e.key === 'R' && !e.ctrlKey && !e.metaKey) {
            rotateRight();
            e.preventDefault();
        }
        // h to flip horizontal
        if (e.key === 'h' && !e.ctrlKey && !e.metaKey) {
            flipHorizontal();
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
}

// ============================================
// ROTATION & FLIP
// ============================================

function rotateLeft() {
    if (!viewer || !viewer.viewport) return;
    const current = viewer.viewport.getRotation();
    viewer.viewport.setRotation(current - 90);
    console.log(`[Viewer] Rotated to ${current - 90}°`);
}

function rotateRight() {
    if (!viewer || !viewer.viewport) return;
    const current = viewer.viewport.getRotation();
    viewer.viewport.setRotation(current + 90);
    console.log(`[Viewer] Rotated to ${current + 90}°`);
}

function flipHorizontal() {
    if (!viewer || !viewer.viewport) return;
    const isFlipped = viewer.viewport.getFlip();
    viewer.viewport.setFlip(!isFlipped);
    console.log(`[Viewer] Flipped: ${!isFlipped}`);
}

// ============================================
// STATE LISTENERS
// ============================================

function setupStateListeners() {
    // Document loaded
    appState.addEventListener('documentLoaded', (e) => {
        console.log('[Viewer] Document loaded:', e.detail.filename);
        showViewer(e.detail.filename);
    });

    // Pages loaded (multi-page)
    appState.addEventListener('pagesLoaded', (e) => {
        console.log(`[Viewer] Pages loaded: ${e.detail.count}`);
        updatePageNavigation();
    });

    // Page changed
    appState.addEventListener('pageChanged', (e) => {
        console.log(`[Viewer] Page changed to ${e.detail.index + 1}/${e.detail.total}`);
        showViewer(e.detail.filename);
        updatePageNavigation();
    });

    // Image changed
    appState.addEventListener('imageChanged', (e) => {
        if (e.detail.url) {
            loadImage(e.detail.url);
        }
    });

    // Regions changed
    appState.addEventListener('regionsChanged', () => {
        renderRegions(appState.getState().regions);
    });

    // Transcription complete
    appState.addEventListener('transcriptionComplete', () => {
        renderRegions(appState.getState().regions);
    });

    // Selection changed
    appState.addEventListener('selectionChanged', (e) => {
        highlightRegion(e.detail.line);
        panToRegion(e.detail.line);
    });

    // Zoom changed from outside
    appState.addEventListener('zoomChanged', (e) => {
        if (!viewer || !viewer.viewport) return;
        const currentZoom = viewer.viewport.getZoom();
        const targetZoom = e.detail.zoom / 100;
        if (Math.abs(currentZoom - targetZoom) > 0.01) {
            viewer.viewport.zoomTo(targetZoom);
        }
    });
}

// ============================================
// PAGE NAVIGATION
// ============================================

function setupPageNavigation() {
    const btnPrevPage = document.getElementById('btnPrevPage');
    const btnNextPage = document.getElementById('btnNextPage');

    btnPrevPage?.addEventListener('click', () => {
        appState.prevPage();
    });

    btnNextPage?.addEventListener('click', () => {
        appState.nextPage();
    });
}

function updatePageNavigation() {
    const pageNavigation = getById('pageNavigation');
    const pageCount = appState.getPageCount();
    const currentIndex = appState.data.currentPageIndex;

    if (pageCount > 1) {
        show(pageNavigation);
        setText('pageInfo', `Page ${currentIndex + 1} / ${pageCount}`);
        setDisabled('btnPrevPage', currentIndex === 0);
        setDisabled('btnNextPage', currentIndex >= pageCount - 1);
    } else {
        hide(pageNavigation);
    }
}

// ============================================
// IMAGE LOADING
// ============================================

function loadImage(url) {
    if (!viewer) return;

    // Detect type
    if (url.startsWith('data:') || url.match(/\.(jpg|jpeg|png|gif|webp|tiff?)$/i)) {
        // Local image or Data-URL
        loadLocalImage(url);
    } else if (url.includes('/info.json') || url.includes('iiif')) {
        // IIIF Image
        loadIIIFImage(url);
    } else {
        // Fallback: treat as local image
        loadLocalImage(url);
    }
}

function loadLocalImage(url) {
    // Get image dimensions for TileSource
    const img = new Image();
    img.onload = () => {
        viewer.open({
            type: 'image',
            url: url,
            buildPyramid: false
        });

        // Store dimensions for coordinate conversion
        appState.setImageDimensions(img.naturalWidth, img.naturalHeight);

        // Render regions after image opens
        viewer.addOnceHandler('open', () => {
            renderRegions(appState.getState().regions);
        });

        console.log(`[Viewer] Loaded image: ${img.naturalWidth}x${img.naturalHeight}`);
    };
    img.onerror = () => {
        console.error('[Viewer] Failed to load image:', url);
    };
    img.src = url;
}

function loadIIIFImage(url) {
    // IIIF info.json URL
    let infoUrl = url;
    if (!url.endsWith('/info.json')) {
        infoUrl = url.replace(/\/?$/, '/info.json');
    }

    viewer.open(infoUrl);

    viewer.addOnceHandler('open', () => {
        renderRegions(appState.getState().regions);
    });

    console.log(`[Viewer] Loading IIIF: ${infoUrl}`);
}

// ============================================
// IIIF MANIFEST SUPPORT
// ============================================

export async function loadIIIFManifest(manifestUrl) {
    try {
        const response = await fetch(manifestUrl);
        const manifest = await response.json();

        // Detect manifest version
        const version = manifest['@context']?.includes(IIIF_CONTEXT_V3) ? IIIF_VERSION.V3 : IIIF_VERSION.V2;

        // Extract canvases
        const canvases = version === IIIF_VERSION.V3
            ? manifest.items
            : manifest.sequences?.[0]?.canvases;

        if (!canvases || canvases.length === 0) {
            throw new Error('No canvases found in manifest');
        }

        // Build pages for multi-page support
        const pages = canvases.map((canvas, index) => {
            const imageUrl = version === IIIF_VERSION.V3
                ? canvas.items?.[0]?.items?.[0]?.body?.id
                : canvas.images?.[0]?.resource?.['@id'];

            return {
                index,
                id: canvas['@id'] || canvas.id,
                label: canvas.label || `Page ${index + 1}`,
                dataUrl: imageUrl,
                width: canvas.width,
                height: canvas.height
            };
        });

        // Update state
        appState.setPages(pages);

        console.log(`[Viewer] Loaded IIIF manifest: ${pages.length} pages`);
        return pages;

    } catch (error) {
        console.error('[Viewer] Failed to load IIIF manifest:', error);
        throw error;
    }
}

// ============================================
// REGIONS OVERLAY
// ============================================

function renderRegions(regions) {
    if (!svgOverlay || !viewer) return;

    // Get SVG node from overlay
    const svg = svgOverlay.node();
    if (!svg) return;

    // Clear existing regions
    svg.innerHTML = '';

    if (!regions || regions.length === 0) {
        console.log('[Viewer] No regions to render');
        return;
    }

    // Get image dimensions for aspect ratio calculation
    const state = appState.getState();
    const imgWidth = state.image?.width || 1;
    const imgHeight = state.image?.height || 1;
    const aspectRatio = imgHeight / imgWidth;

    console.log(`[Viewer] Image dimensions: ${imgWidth}x${imgHeight}, aspect ratio: ${aspectRatio.toFixed(3)}`);

    regions.forEach(reg => {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');

        // Convert coordinates: PAGE-XML stores as percent (0-100)
        // OpenSeadragon SVG Overlay uses viewport coordinates:
        // - X is normalized to image width (0-1)
        // - Y is normalized to image width too, so multiply by aspect ratio
        const x = reg.x / 100;
        const y = (reg.y / 100) * aspectRatio;
        const w = reg.w / 100;
        const h = (reg.h / 100) * aspectRatio;

        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
        rect.setAttribute('class', 'region-box');
        rect.setAttribute('data-line', reg.line);

        // Confidence class
        if (reg.confidence) {
            rect.classList.add(reg.confidence);
        }

        // Click handler
        rect.addEventListener('click', (e) => {
            e.stopPropagation();
            appState.setSelection(reg.line);
        });

        svg.appendChild(rect);
    });

    console.log(`[Viewer] Rendered ${regions.length} regions`);
}

function highlightRegion(lineNumber) {
    // Remove old selection
    selectAll('.region-box.selected').forEach(el => el.classList.remove('selected'));

    // Mark new selection
    const regionEl = select(`.region-box[data-line="${lineNumber}"]`);
    if (regionEl) {
        regionEl.classList.add('selected');
    }
}

function panToRegion(lineNumber) {
    const regionEl = select(`.region-box[data-line="${lineNumber}"]`);
    if (!regionEl || !viewer) return;

    // Get region coordinates (already in viewport coordinates from renderRegions)
    const x = parseFloat(regionEl.getAttribute('x'));
    const y = parseFloat(regionEl.getAttribute('y'));
    const w = parseFloat(regionEl.getAttribute('width'));
    const h = parseFloat(regionEl.getAttribute('height'));

    // Calculate center in viewport coordinates
    const centerX = x + w / 2;
    const centerY = y + h / 2;

    // Pan to region center
    viewer.viewport.panTo(new OpenSeadragon.Point(centerX, centerY));

    // Optionally zoom to show the region better
    // const currentZoom = viewer.viewport.getZoom();
    // if (currentZoom < 1.5) {
    //     viewer.viewport.zoomTo(1.5);
    // }
}

// ============================================
// UI STATE
// ============================================

function showViewer(filename) {
    addClass('viewerEmptyState', 'hidden');
    show('osd-viewer');
    show('headerDocInfo');
    if (filename) setText('headerFilename', filename);
}

function showEmptyState() {
    removeClass('viewerEmptyState', 'hidden');
    hide('osd-viewer');
    hide('headerDocInfo');
}

function checkInitialState() {
    const state = appState.getState();
    const hasDocument = state.document?.dataUrl ||
        (state.image?.url && state.image.url !== 'assets/mock-document.jpg');

    if (hasDocument) {
        showViewer(state.document?.filename || 'Document');
        const imageUrl = state.document?.dataUrl || state.image?.url;
        if (imageUrl) {
            loadImage(imageUrl);
        }
    } else {
        showEmptyState();
    }

    // Initialize page navigation
    updatePageNavigation();
}

// ============================================
// EXPORTS
// ============================================

export function zoomIn() {
    viewer?.viewport.zoomBy(1.2);
}

export function zoomOut() {
    viewer?.viewport.zoomBy(0.8);
}

export function fitToContainer() {
    viewer?.viewport.goHome();
}

export function resetView() {
    viewer?.viewport.goHome();
    viewer?.viewport.setRotation(0);
    viewer?.viewport.setFlip(false);
}

export function rotate(degrees) {
    if (!viewer || !viewer.viewport) return;
    const current = viewer.viewport.getRotation();
    viewer.viewport.setRotation(current + degrees);
}

export function flip() {
    if (!viewer || !viewer.viewport) return;
    viewer.viewport.setFlip(!viewer.viewport.getFlip());
}

export { viewer, renderRegions };
