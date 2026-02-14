/**
 * validationResize.js - Vertical resizing for validation panel sub-sections
 *
 * Drag handles between Thinking, Validation, and LLM Review sections.
 * Persists ratios to localStorage. Double-click resets to defaults.
 * Keyboard: ArrowUp/Down +/-10px, Shift +/-50px.
 */

import {
    MIN_SECTION_HEIGHT,
    DEFAULT_VALIDATION_RATIOS,
    VALIDATION_RATIOS_KEY
} from './constants.js';

/** @type {HTMLElement} */
let container;
/** @type {HTMLElement[]} sections [thinkingSection, ruleBasedSection, llmReviewSection] */
let sections;
/** @type {HTMLElement[]} handles [handle0, handle1] */
let handles;
/** @type {number[]} ratios for all 3 sections, sum ~1 */
let ratios;

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadRatios() {
    try {
        const stored = localStorage.getItem(VALIDATION_RATIOS_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length === 3 &&
                parsed.every(v => typeof v === 'number' && v > 0) &&
                Math.abs(parsed.reduce((a, b) => a + b, 0) - 1) < 0.01) {
                return parsed;
            }
        }
    } catch { /* ignore corrupt data */ }
    return [...DEFAULT_VALIDATION_RATIOS];
}

function saveRatios() {
    localStorage.setItem(VALIDATION_RATIOS_KEY, JSON.stringify(ratios));
}

function updateHandleVisibility() {
    // Handle 0: between sections[0] (thinking) and sections[1] (ruleBased)
    handles[0].hidden = sections[0].hidden || sections[1].hidden;
    // Handle 1: between sections[1] (ruleBased) and sections[2] (llmReview)
    handles[1].hidden = sections[1].hidden || sections[2].hidden;
}

function applyRatios() {
    const visibleIndices = [];
    for (let i = 0; i < 3; i++) {
        if (!sections[i].hidden) visibleIndices.push(i);
    }

    // Reset all sections to CSS defaults
    for (let i = 0; i < 3; i++) {
        sections[i].style.removeProperty('flex');
        sections[i].style.removeProperty('max-height');
    }

    // No resizing needed for 0 or 1 visible section
    if (visibleIndices.length <= 1) return;

    // Calculate available height (container height minus visible handle heights)
    const visibleHandles = handles.filter(h => !h.hidden);
    const handleTotalHeight = visibleHandles.reduce((sum, h) => sum + h.offsetHeight, 0);
    const availableHeight = container.clientHeight - handleTotalHeight;

    if (availableHeight <= 0) return;

    // Normalize visible ratios
    const totalRatio = visibleIndices.reduce((sum, i) => sum + ratios[i], 0);
    if (totalRatio <= 0) return;

    for (const i of visibleIndices) {
        const fraction = ratios[i] / totalRatio;
        const height = Math.round(fraction * availableHeight);
        sections[i].style.flex = `0 0 ${height}px`;
        sections[i].style.maxHeight = `${height}px`;
    }
}

// ── Drag ─────────────────────────────────────────────────────────────────────

function startDrag(handle, startY) {
    const aboveIdx = Number(handle.dataset.aboveIdx);
    const belowIdx = Number(handle.dataset.belowIdx);
    const containerHeight = container.clientHeight;
    const startRatios = [...ratios];

    const visibleIndices = sections.map((s, i) => s.hidden ? -1 : i).filter(i => i >= 0);
    const totalRatio = visibleIndices.reduce((sum, i) => sum + startRatios[i], 0);

    let rafId = null;

    handle.classList.add('dragging');
    document.body.classList.add('validation-resizing');

    function onMove(e) {
        if (e.touches && e.cancelable) e.preventDefault();

        const pointerY = e.clientY ?? e.touches?.[0]?.clientY ?? startY;
        const dy = pointerY - startY;
        const dRatio = (dy / containerHeight) * totalRatio;

        let newAbove = startRatios[aboveIdx] + dRatio;
        let newBelow = startRatios[belowIdx] - dRatio;

        // Enforce minimum heights
        const minRatio = (MIN_SECTION_HEIGHT / containerHeight) * totalRatio;
        if (newAbove < minRatio) {
            newBelow += newAbove - minRatio;
            newAbove = minRatio;
        }
        if (newBelow < minRatio) {
            newAbove += newBelow - minRatio;
            newBelow = minRatio;
        }

        // Safety: both still above min after adjustment
        if (newAbove < minRatio || newBelow < minRatio) return;

        ratios[aboveIdx] = newAbove;
        ratios[belowIdx] = newBelow;

        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(applyRatios);
    }

    function onEnd() {
        handle.classList.remove('dragging');
        document.body.classList.remove('validation-resizing');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
        document.removeEventListener('touchcancel', onEnd);
        if (rafId) cancelAnimationFrame(rafId);
        applyRatios();
        saveRatios();
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
}

// ── Keyboard ─────────────────────────────────────────────────────────────────

function onKeydown(e) {
    const handle = e.target;
    if (!handle.classList.contains('validation-resize-handle')) return;

    const step = e.shiftKey ? 50 : 10;
    let dy;
    if (e.key === 'ArrowUp') dy = -step;
    else if (e.key === 'ArrowDown') dy = step;
    else return;

    e.preventDefault();

    const aboveIdx = Number(handle.dataset.aboveIdx);
    const belowIdx = Number(handle.dataset.belowIdx);
    const containerHeight = container.clientHeight;
    const visibleIndices = sections.map((s, i) => s.hidden ? -1 : i).filter(i => i >= 0);
    const totalRatio = visibleIndices.reduce((sum, i) => sum + ratios[i], 0);
    const dRatio = (dy / containerHeight) * totalRatio;
    const minRatio = (MIN_SECTION_HEIGHT / containerHeight) * totalRatio;

    const newAbove = ratios[aboveIdx] + dRatio;
    const newBelow = ratios[belowIdx] - dRatio;

    if (newAbove < minRatio || newBelow < minRatio) return;

    ratios[aboveIdx] = newAbove;
    ratios[belowIdx] = newBelow;
    applyRatios();
    saveRatios();
}

// ── Double-click reset ───────────────────────────────────────────────────────

function onDblClick() {
    ratios = [...DEFAULT_VALIDATION_RATIOS];
    applyRatios();
    saveRatios();
}

// ── Init ─────────────────────────────────────────────────────────────────────

export function initValidationResize() {
    container = document.getElementById('validationContent');
    if (!container) return;

    sections = [
        document.getElementById('thinkingSection'),
        document.getElementById('ruleBasedSection'),
        document.getElementById('llmReviewSection')
    ];
    if (sections.some(s => !s)) return;

    handles = [...container.querySelectorAll('.validation-resize-handle')];
    if (handles.length < 2) return;

    ratios = loadRatios();

    // Bind drag + keyboard + dblclick
    for (const handle of handles) {
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startDrag(handle, e.clientY);
        });
        handle.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startDrag(handle, e.touches[0].clientY);
        }, { passive: false });
        handle.addEventListener('dblclick', onDblClick);
        handle.addEventListener('keydown', onKeydown);
    }

    // Observe section visibility changes (hidden attribute)
    const observer = new MutationObserver(() => {
        updateHandleVisibility();
        applyRatios();
    });
    for (const section of sections) {
        observer.observe(section, { attributes: true, attributeFilter: ['hidden'] });
    }

    // Initial state
    updateHandleVisibility();

    // Reapply on window resize
    window.addEventListener('resize', applyRatios);
}
