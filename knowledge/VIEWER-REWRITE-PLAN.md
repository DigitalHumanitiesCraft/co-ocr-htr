# Viewer Rewrite Plan: OpenSeadragon + IIIF

**Status:** [x] IMPLEMENTED
**Priorität:** Hoch (blockiert korrekte Region-Synchronisation)

---

## Ziele

1. **Korrekte Region-Overlay** - SVG-Regionen exakt über Bildkoordinaten
2. **IIIF Support** - Bilder von externen Repositorien laden
3. **Professionelles Pan/Zoom** - Smooth, touch-fähig, bewährt
4. **Vereinfachter Code** - OpenSeadragon übernimmt komplexe Logik

---

## Architektur

### Aktuell (problematisch)
```
image-container
└── imageWrapper (transform: translate + scale)
    ├── docImage
    └── regionsOverlay (SVG, viewBox: 0 0 100 100)
        └── rect (Prozent-Koordinaten)
```

**Probleme:**
- SVG viewBox passt nicht zu Bildverhältnis
- Transform-Koordinaten werden nicht synchronisiert
- Eigene Pan/Zoom-Implementierung fehleranfällig

### Neu (OpenSeadragon)
```
#osd-viewer (OpenSeadragon Container)
├── Canvas (Bild-Rendering, managed by OSD)
└── SVG Overlay (via svg-overlay Plugin)
    └── rect (Pixel-Koordinaten, normalisiert 0-1)
```

**Vorteile:**
- Koordinaten werden automatisch transformiert
- Pan/Zoom/Fit eingebaut
- IIIF-Support eingebaut
- Touch/Mobile eingebaut

---

## Implementierung

### Phase 1: OpenSeadragon Integration [ ]

#### 1.1 Dependencies hinzufügen

**index.html:**
```html
<!-- OpenSeadragon -->
<script src="https://cdn.jsdelivr.net/npm/openseadragon@4.1/build/openseadragon/openseadragon.min.js"></script>
<!-- SVG Overlay Plugin -->
<script src="https://cdn.jsdelivr.net/npm/openseadragon-svg-overlay@2.0/openseadragon-svg-overlay.min.js"></script>
```

#### 1.2 HTML-Struktur anpassen

**Alt:**
```html
<div class="image-container">
    <div id="imageWrapper">
        <img src="" id="docImage">
        <svg id="regionsOverlay">...</svg>
    </div>
</div>
```

**Neu:**
```html
<div id="osd-viewer" class="osd-viewer">
    <!-- OpenSeadragon rendert hier -->
</div>
```

#### 1.3 Neuer viewer.js

```javascript
/**
 * coOCR/HTR - Document Viewer (OpenSeadragon)
 */
import { appState } from './state.js';

let viewer = null;
let svgOverlay = null;

export function initViewer() {
    const container = document.getElementById('osd-viewer');
    if (!container) return;

    // OpenSeadragon initialisieren
    viewer = OpenSeadragon({
        id: 'osd-viewer',
        prefixUrl: 'https://cdn.jsdelivr.net/npm/openseadragon@4.1/build/openseadragon/images/',

        // Kein Bild initial
        tileSources: [],

        // UI-Optionen
        showNavigationControl: false, // Wir nutzen eigene Toolbar
        showZoomControl: false,
        showHomeControl: false,
        showFullPageControl: false,

        // Verhalten
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
        visibilityRatio: 0.5
    });

    // SVG Overlay initialisieren
    svgOverlay = viewer.svgOverlay();

    // Event-Listener
    setupEventListeners();
    setupStateListeners();

    console.log('[Viewer] OpenSeadragon initialized');
}

function setupEventListeners() {
    // Zoom-Änderungen an State melden
    viewer.addHandler('zoom', (e) => {
        const zoomPercent = Math.round(e.zoom * 100);
        appState.setZoom(zoomPercent);
    });

    // Viewport-Änderungen loggen
    viewer.addHandler('viewport-change', () => {
        // Optional: Für Debugging
    });
}

function setupStateListeners() {
    // Dokument geladen
    appState.addEventListener('documentLoaded', (e) => {
        loadImage(e.detail.dataUrl, e.detail.filename);
    });

    // Bild geändert (Multi-Page)
    appState.addEventListener('imageChanged', (e) => {
        if (e.detail.url) {
            loadImage(e.detail.url);
        }
    });

    // Regionen geändert
    appState.addEventListener('regionsChanged', () => {
        renderRegions(appState.getState().regions);
    });

    // Transkription fertig
    appState.addEventListener('transcriptionComplete', () => {
        renderRegions(appState.getState().regions);
    });

    // Selektion geändert
    appState.addEventListener('selectionChanged', (e) => {
        highlightRegion(e.detail.line);
        panToRegion(e.detail.line);
    });

    // Zoom von außen geändert
    appState.addEventListener('zoomChanged', (e) => {
        const currentZoom = viewer.viewport.getZoom();
        const targetZoom = e.detail.zoom / 100;
        if (Math.abs(currentZoom - targetZoom) > 0.01) {
            viewer.viewport.zoomTo(targetZoom);
        }
    });
}

// ============================================
// IMAGE LOADING
// ============================================

function loadImage(url, filename) {
    // Typ erkennen
    if (url.startsWith('data:') || url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        // Lokales Bild oder Data-URL
        loadLocalImage(url);
    } else if (url.includes('/info.json') || url.includes('iiif')) {
        // IIIF Image
        loadIIIFImage(url);
    } else {
        // Fallback: Als lokales Bild behandeln
        loadLocalImage(url);
    }

    showViewer();
}

function loadLocalImage(url) {
    // Bildgröße ermitteln für TileSource
    const img = new Image();
    img.onload = () => {
        viewer.open({
            type: 'image',
            url: url,
            buildPyramid: false
        });

        // Bildgröße für Koordinaten-Konvertierung speichern
        appState.data.image = {
            url: url,
            width: img.naturalWidth,
            height: img.naturalHeight
        };

        console.log(`[Viewer] Loaded image: ${img.naturalWidth}x${img.naturalHeight}`);
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
    console.log(`[Viewer] Loading IIIF: ${infoUrl}`);
}

// ============================================
// IIIF MANIFEST SUPPORT
// ============================================

export async function loadIIIFManifest(manifestUrl) {
    try {
        const response = await fetch(manifestUrl);
        const manifest = await response.json();

        // Manifest Version erkennen
        const version = manifest['@context']?.includes('presentation/3') ? 3 : 2;

        // Canvases extrahieren
        const canvases = version === 3
            ? manifest.items
            : manifest.sequences?.[0]?.canvases;

        if (!canvases || canvases.length === 0) {
            throw new Error('No canvases found in manifest');
        }

        // Pages für Multi-Page Support
        const pages = canvases.map((canvas, index) => {
            const imageUrl = version === 3
                ? canvas.items?.[0]?.items?.[0]?.body?.id
                : canvas.images?.[0]?.resource?.['@id'];

            return {
                index,
                id: canvas['@id'] || canvas.id,
                label: canvas.label || `Page ${index + 1}`,
                imageUrl: imageUrl,
                width: canvas.width,
                height: canvas.height
            };
        });

        // State aktualisieren
        appState.setPages(pages);

        // Erste Seite laden
        if (pages[0]?.imageUrl) {
            loadIIIFImage(pages[0].imageUrl);
        }

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
    if (!svgOverlay) return;

    // SVG leeren
    const svg = svgOverlay.node();
    svg.innerHTML = '';

    if (!regions || regions.length === 0) {
        console.log('[Viewer] No regions to render');
        return;
    }

    // Bildgröße für Normalisierung
    const imgWidth = appState.data.image?.width || 1;
    const imgHeight = appState.data.image?.height || 1;

    regions.forEach(reg => {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');

        // Koordinaten normalisieren (0-1 für OpenSeadragon)
        // PAGE-XML speichert als Prozent (0-100), OSD erwartet 0-1
        const x = reg.x / 100;
        const y = reg.y / 100;
        const w = reg.w / 100;
        const h = reg.h / 100;

        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
        rect.setAttribute('class', 'region-box');
        rect.setAttribute('data-line', reg.line);

        // Confidence-Klasse
        if (reg.confidence) {
            rect.classList.add(reg.confidence);
        }

        // Click-Handler
        rect.addEventListener('click', (e) => {
            e.stopPropagation();
            appState.setSelection(reg.line);
        });

        svg.appendChild(rect);
    });

    console.log(`[Viewer] Rendered ${regions.length} regions`);
}

function highlightRegion(lineNumber) {
    // Alte Selektion entfernen
    document.querySelectorAll('.region-box.selected')
        .forEach(el => el.classList.remove('selected'));

    // Neue Selektion markieren
    const regionEl = document.querySelector(`.region-box[data-line="${lineNumber}"]`);
    if (regionEl) {
        regionEl.classList.add('selected');
    }
}

function panToRegion(lineNumber) {
    const regionEl = document.querySelector(`.region-box[data-line="${lineNumber}"]`);
    if (!regionEl || !viewer) return;

    // Region-Koordinaten (normalisiert 0-1)
    const x = parseFloat(regionEl.getAttribute('x'));
    const y = parseFloat(regionEl.getAttribute('y'));
    const w = parseFloat(regionEl.getAttribute('width'));
    const h = parseFloat(regionEl.getAttribute('height'));

    // Zentrum berechnen
    const centerX = x + w / 2;
    const centerY = y + h / 2;

    // Zu Region pannen
    viewer.viewport.panTo(new OpenSeadragon.Point(centerX, centerY));
}

// ============================================
// TOOLBAR CONTROLS
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
}

// ============================================
// UI STATE
// ============================================

function showViewer() {
    const emptyState = document.getElementById('viewerEmptyState');
    const osdViewer = document.getElementById('osd-viewer');

    if (emptyState) emptyState.classList.add('hidden');
    if (osdViewer) osdViewer.style.display = 'block';
}

function showEmptyState() {
    const emptyState = document.getElementById('viewerEmptyState');
    const osdViewer = document.getElementById('osd-viewer');

    if (emptyState) emptyState.classList.remove('hidden');
    if (osdViewer) osdViewer.style.display = 'none';
}

// Export für externe Nutzung
export { viewer, renderRegions };
```

---

### Phase 2: CSS-Anpassungen [ ]

#### 2.1 viewer.css aktualisieren

```css
/* OpenSeadragon Container */
#osd-viewer {
    width: 100%;
    height: 100%;
    background: var(--bg-viewer);
}

/* Region Boxes im SVG Overlay */
#osd-viewer .region-box {
    fill: transparent;
    stroke: var(--region-stroke);
    stroke-width: 2px;
    cursor: pointer;
    transition: all 0.2s ease;
    opacity: 0.6;
    /* Stroke-Width skaliert nicht mit Zoom */
    vector-effect: non-scaling-stroke;
}

#osd-viewer .region-box:hover {
    fill: var(--region-fill-hover);
    stroke: var(--region-stroke-hover);
    opacity: 1;
}

#osd-viewer .region-box.selected {
    stroke: var(--selection);
    stroke-width: 3px;
    fill: rgba(255, 193, 7, 0.15);
    opacity: 1;
}

/* Confidence-Farben */
#osd-viewer .region-box.confident {
    stroke: var(--confident);
}

#osd-viewer .region-box.uncertain {
    stroke: var(--uncertain);
}

#osd-viewer .region-box.problematic {
    stroke: var(--problematic);
}
```

---

### Phase 3: IIIF Integration [ ]

#### 3.1 IIIF Dialog hinzufügen

**dialogs.js erweitern:**
```javascript
// IIIF Manifest URL Dialog
showIIIFDialog() {
    const dialog = this.createDialog('iiif-dialog', `
        <div class="dialog-header">
            <h3>Load IIIF Document</h3>
            <button class="dialog-close">&times;</button>
        </div>
        <div class="dialog-body">
            <div class="form-group">
                <label>IIIF Manifest URL</label>
                <input type="url" id="iiifManifestUrl"
                    placeholder="https://example.org/manifest.json">
                <small>Enter a IIIF Presentation API manifest URL</small>
            </div>
            <div class="form-group">
                <label>Or IIIF Image URL</label>
                <input type="url" id="iiifImageUrl"
                    placeholder="https://example.org/image/info.json">
                <small>Enter a IIIF Image API info.json URL</small>
            </div>
        </div>
        <div class="dialog-footer">
            <button class="btn btn-secondary" data-action="cancel">Cancel</button>
            <button class="btn btn-primary" data-action="load">Load</button>
        </div>
    `);
    // ... Event handlers
}
```

#### 3.2 Header-Button für IIIF

**index.html:**
```html
<button class="icon-btn icon-md" title="Load IIIF" id="btnLoadIIIF">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
    </svg>
</button>
```

---

### Phase 4: Koordinaten-Konvertierung [ ]

#### 4.1 page-xml.js anpassen

Koordinaten werden bereits als Prozent (0-100) gespeichert, das passt zu unserem System.
Für OpenSeadragon müssen wir nur durch 100 teilen.

```javascript
// In renderRegions():
const x = reg.x / 100;  // 0-100 -> 0-1
const y = reg.y / 100;
const w = reg.w / 100;
const h = reg.h / 100;
```

---

### Phase 5: Migration & Cleanup [ ]

#### 5.1 Alte Dateien entfernen/ersetzen

| Datei | Aktion |
|-------|--------|
| `viewer.js` | Ersetzen durch neue Version |
| `viewer.css` | Teilweise aktualisieren |
| `index.html` | HTML-Struktur anpassen |

#### 5.2 Rückwärtskompatibilität

- Alle `appState` Events bleiben gleich
- Export-Funktionen bleiben gleich
- Editor-Integration bleibt gleich

---

## Testplan

### Funktionstest

| Test | Erwartung |
|------|-----------|
| Lokales Bild laden | Bild wird angezeigt |
| IIIF Image URL laden | Bild von externem Server |
| IIIF Manifest laden | Multi-Page mit Navigation |
| Pan (Drag) | Smooth Bewegung |
| Zoom (Wheel) | Smooth Zoom zum Cursor |
| Fit-Button | Bild passt in Container |
| Region-Click | Selektion im Editor |
| Editor-Click | Region wird gehighlighted + zentriert |
| Multi-Page Navigation | Seite wechselt, Regionen werden neu geladen |

### IIIF-Test-URLs

```
# Gallica (BnF)
https://gallica.bnf.fr/iiif/ark:/12148/btv1b8449691v/manifest.json

# e-codices
https://www.e-codices.unifr.ch/metadata/iiif/bge-gr0044/manifest.json

# British Library
https://api.bl.uk/metadata/iiif/ark:/81055/vdc_100022545251.0x000001/manifest.json
```

---

## Zeitschätzung

| Phase | Aufwand |
|-------|---------|
| Phase 1: OpenSeadragon | Mittel |
| Phase 2: CSS | Klein |
| Phase 3: IIIF Dialog | Klein |
| Phase 4: Koordinaten | Klein |
| Phase 5: Migration | Klein |

---

## Risiken

| Risiko | Mitigation |
|--------|------------|
| OpenSeadragon CDN nicht erreichbar | Fallback auf lokale Kopie |
| CORS bei IIIF-Servern | Proxy-Option dokumentieren |
| Große Bilder Performance | Tiling via IIIF empfehlen |

---

## Abhängigkeiten

**Externe:**
- OpenSeadragon 4.1+ (CDN)
- openseadragon-svg-overlay 2.0+ (CDN)

**Intern:**
- `state.js` - Keine Änderungen nötig
- `editor.js` - Keine Änderungen nötig
- `page-xml.js` - Keine Änderungen nötig

---

## Completion Notes (2026-01-18)

**Implemented Features:**
- OpenSeadragon 4.1 integration via CDN
- SVG Overlay Plugin for region rendering
- Coordinate conversion with aspect ratio fix
- Rotation controls (left/right)
- Flip horizontal control
- Keyboard shortcuts (r, R, h, 0, f, +, -)
- Region-Editor synchronization working correctly

**Key Fix:** OpenSeadragon SVG Overlay uses viewport coordinates where Y must be multiplied by the image aspect ratio (height/width), not just divided by 100.

**Open for Future:**
- IIIF Dialog for external repositories
- Multi-page IIIF manifest loading

---

## Referenzen

- [OpenSeadragon Docs](https://openseadragon.github.io/)
- [SVG Overlay Plugin](https://github.com/openseadragon/svg-overlay)
- [IIIF Image API](https://iiif.io/api/image/3.0/)
- [IIIF Presentation API](https://iiif.io/api/presentation/3.0/)
