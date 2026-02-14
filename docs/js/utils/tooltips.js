/**
 * Tooltip positioning utility
 * Positions fixed tooltips relative to trigger elements to prevent clipping by parent containers
 */

/**
 * Position a tooltip relative to its trigger element
 * @param {HTMLElement} trigger - The tooltip trigger element
 * @param {HTMLElement} content - The tooltip content element
 */
function positionTooltip(trigger, content) {
    const triggerRect = trigger.getBoundingClientRect();
    const contentWidth = 260; // Must match CSS width
    const gap = 10; // Gap between trigger and tooltip

    // Calculate centered position below trigger
    let left = triggerRect.left + (triggerRect.width / 2) - (contentWidth / 2);
    let top = triggerRect.bottom + gap;

    // Viewport boundaries
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const contentHeight = content.offsetHeight || 100; // Estimate if not rendered

    // Adjust horizontal position to stay within viewport
    const margin = 10;
    if (left < margin) {
        left = margin;
    } else if (left + contentWidth > viewportWidth - margin) {
        left = viewportWidth - contentWidth - margin;
    }

    // Check if tooltip would go below viewport, flip to above if needed
    if (top + contentHeight > viewportHeight - margin) {
        top = triggerRect.top - contentHeight - gap;
        content.setAttribute('data-position', 'above');
    } else {
        content.setAttribute('data-position', 'below');
    }

    // Apply position
    content.style.left = `${left}px`;
    content.style.top = `${top}px`;
}

/**
 * Initialize tooltip positioning for all info tooltips
 */
export function initTooltips() {
    const tooltips = document.querySelectorAll('.info-tooltip');

    tooltips.forEach(tooltip => {
        const content = tooltip.querySelector('.info-tooltip-content');
        if (!content) return;

        // Position on hover (mouseenter)
        tooltip.addEventListener('mouseenter', () => {
            positionTooltip(tooltip, content);
        });

        // Reposition on scroll/resize
        const updatePosition = () => {
            if (content.style.opacity === '1' || content.style.visibility === 'visible') {
                positionTooltip(tooltip, content);
            }
        };

        window.addEventListener('scroll', updatePosition, { passive: true });
        window.addEventListener('resize', updatePosition, { passive: true });
    });
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTooltips);
} else {
    initTooltips();
}
