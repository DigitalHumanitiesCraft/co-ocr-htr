/**
 * panelResize.js - Resizable 3-column panel grid
 *
 * Absolute-positioned drag handles between panels.
 * Persists ratios to localStorage. Double-click resets to defaults.
 * Keyboard: Arrow +/-10px, Shift+Arrow +/-50px.
 */

import { MIN_PANEL_WIDTH, DEFAULT_PANEL_RATIOS, PANEL_RATIOS_KEY } from './constants.js';

/** @type {HTMLElement} */
let container;
/** @type {HTMLElement[]} */
let handles;
/** @type {HTMLElement[]} */
let panels;
/** @type {number[]} current ratios [0..1] summing to 1 */
let ratios;
const TWO_COLUMN_BREAKPOINT = 1200;
let twoColumnMql;

// ── Helpers ──────────────────────────────────────────────────────────────────

function isTwoColumnMode() {
    return window.matchMedia(`(max-width: ${TWO_COLUMN_BREAKPOINT}px)`).matches;
}

function loadRatios() {
    try {
        const stored = localStorage.getItem(PANEL_RATIOS_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length === 3 &&
                parsed.every(v => typeof v === 'number' && v > 0) &&
                Math.abs(parsed.reduce((a, b) => a + b, 0) - 1) < 0.01) {
                return parsed;
            }
        }
    } catch { /* ignore corrupt data */ }
    return [...DEFAULT_PANEL_RATIOS];
}

function saveRatios() {
    localStorage.setItem(PANEL_RATIOS_KEY, JSON.stringify(ratios));
}

function applyRatios() {
    if (isTwoColumnMode()) {
        container.style.removeProperty('grid-template-columns');
        return;
    }

    container.style.gridTemplateColumns =
        ratios.map(r => `${r}fr`).join(' ');
    positionHandles();
}

function positionHandles() {
    if (!panels.length || isTwoColumnMode()) return;
    for (const handle of handles) {
        const leftIdx = Number(handle.dataset.leftCol) - 1;
        const leftPanel = panels[leftIdx];
        if (!leftPanel) continue;
        const rect = leftPanel.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        handle.style.left = `${rect.right - containerRect.left}px`;
    }
}

// ── Drag ─────────────────────────────────────────────────────────────────────

function startDrag(handle, startX) {
    if (isTwoColumnMode()) return;

    const leftIdx = Number(handle.dataset.leftCol) - 1;
    const rightIdx = Number(handle.dataset.rightCol) - 1;
    const containerWidth = container.getBoundingClientRect().width;
    const startRatios = [...ratios];
    let rafId = null;

    handle.classList.add('dragging');
    document.body.classList.add('panel-resizing');

    function onMove(e) {
        if (e.touches && e.cancelable) e.preventDefault();

        const pointerX = e.clientX ?? e.touches?.[0]?.clientX ?? startX;
        const dx = pointerX - startX;
        const dRatio = dx / containerWidth;

        let newLeft = startRatios[leftIdx] + dRatio;
        let newRight = startRatios[rightIdx] - dRatio;

        // Enforce minimum widths
        const minRatio = MIN_PANEL_WIDTH / containerWidth;
        if (newLeft < minRatio) {
            newRight += newLeft - minRatio;
            newLeft = minRatio;
        }
        if (newRight < minRatio) {
            newLeft += newRight - minRatio;
            newRight = minRatio;
        }

        // Safety: both still above min after adjustment
        if (newLeft < minRatio || newRight < minRatio) return;

        ratios[leftIdx] = newLeft;
        ratios[rightIdx] = newRight;

        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            applyRatios();
            // Trigger resize for OpenSeadragon and other responsive components
            window.dispatchEvent(new Event('resize'));
        });
    }

    function onEnd() {
        handle.classList.remove('dragging');
        document.body.classList.remove('panel-resizing');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
        document.removeEventListener('touchcancel', onEnd);
        if (rafId) cancelAnimationFrame(rafId);
        applyRatios();
        saveRatios();
        window.dispatchEvent(new Event('resize'));
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
}

// ── Keyboard ─────────────────────────────────────────────────────────────────

function onKeydown(e) {
    if (isTwoColumnMode()) return;

    const handle = e.target;
    if (!handle.classList.contains('panel-resize-handle')) return;

    const step = e.shiftKey ? 50 : 10;
    let dx;
    if (e.key === 'ArrowLeft') dx = -step;
    else if (e.key === 'ArrowRight') dx = step;
    else return;

    e.preventDefault();

    const leftIdx = Number(handle.dataset.leftCol) - 1;
    const rightIdx = Number(handle.dataset.rightCol) - 1;
    const containerWidth = container.getBoundingClientRect().width;
    const dRatio = dx / containerWidth;
    const minRatio = MIN_PANEL_WIDTH / containerWidth;

    const newLeft = ratios[leftIdx] + dRatio;
    const newRight = ratios[rightIdx] - dRatio;

    if (newLeft < minRatio || newRight < minRatio) return;

    ratios[leftIdx] = newLeft;
    ratios[rightIdx] = newRight;
    applyRatios();
    saveRatios();
    window.dispatchEvent(new Event('resize'));
}

// ── Double-click reset ───────────────────────────────────────────────────────

function onDblClick() {
    if (isTwoColumnMode()) return;

    ratios = [...DEFAULT_PANEL_RATIOS];
    applyRatios();
    saveRatios();
    window.dispatchEvent(new Event('resize'));
}

// ── Init ─────────────────────────────────────────────────────────────────────

export function initPanelResize() {
    container = document.querySelector('.app-container');
    if (!container) return;

    handles = [...container.querySelectorAll('.panel-resize-handle')];
    panels = [
        container.querySelector('.panel-col-1'),
        container.querySelector('.panel-col-2'),
        container.querySelector('.panel-col-3')
    ].filter(Boolean);

    if (panels.length < 3 || handles.length < 2) return;

    ratios = loadRatios();
    applyRatios();

    // Bind drag events
    for (const handle of handles) {
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startDrag(handle, e.clientX);
        });
        handle.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startDrag(handle, e.touches[0].clientX);
        }, { passive: false });
        handle.addEventListener('dblclick', onDblClick);
        handle.addEventListener('keydown', onKeydown);
    }

    // Reposition handles on window resize
    window.addEventListener('resize', positionHandles);

    // Keep JS-driven columns aligned with the CSS 1200px breakpoint
    twoColumnMql = window.matchMedia(`(max-width: ${TWO_COLUMN_BREAKPOINT}px)`);
    const onBreakpointChange = () => applyRatios();
    if (typeof twoColumnMql.addEventListener === 'function') {
        twoColumnMql.addEventListener('change', onBreakpointChange);
    } else {
        twoColumnMql.addListener(onBreakpointChange);
    }

    // Initial positioning after layout settles
    requestAnimationFrame(positionHandles);
}
