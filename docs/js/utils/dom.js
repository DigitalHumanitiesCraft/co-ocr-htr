/**
 * dom.js - Safe DOM manipulation utilities
 * coOCR/HTR Application
 *
 * Provides null-safe DOM selection and manipulation helpers
 * to reduce boilerplate and prevent null pointer errors.
 */

/**
 * Safely select a single element by ID
 * @param {string} id - Element ID (without #)
 * @returns {HTMLElement|null}
 */
export function getById(id) {
    return document.getElementById(id);
}

/**
 * Safely select a single element by CSS selector
 * @param {string} selector - CSS selector
 * @param {Element} [parent=document] - Parent element to search within
 * @returns {Element|null}
 */
export function select(selector, parent = document) {
    return parent.querySelector(selector);
}

/**
 * Select all elements matching a CSS selector
 * @param {string} selector - CSS selector
 * @param {Element} [parent=document] - Parent element to search within
 * @returns {NodeListOf<Element>}
 */
export function selectAll(selector, parent = document) {
    return parent.querySelectorAll(selector);
}

/**
 * Safely get element by ID and perform an action if it exists
 * @param {string} id - Element ID
 * @param {function(HTMLElement): void} callback - Action to perform
 */
export function withElement(id, callback) {
    const el = document.getElementById(id);
    if (el) callback(el);
}

/**
 * Safely add event listener to an element found by ID
 * @param {string} id - Element ID
 * @param {string} event - Event name
 * @param {EventListener} handler - Event handler
 * @param {AddEventListenerOptions} [options] - Event options
 */
export function onById(id, event, handler, options) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler, options);
}

/**
 * Safely add event listener to an element found by selector
 * @param {string} selector - CSS selector
 * @param {string} event - Event name
 * @param {EventListener} handler - Event handler
 * @param {AddEventListenerOptions} [options] - Event options
 */
export function on(selector, event, handler, options) {
    const el = document.querySelector(selector);
    if (el) el.addEventListener(event, handler, options);
}

/**
 * Add event listeners to all elements matching selector
 * @param {string} selector - CSS selector
 * @param {string} event - Event name
 * @param {EventListener} handler - Event handler
 * @param {AddEventListenerOptions} [options] - Event options
 */
export function onAll(selector, event, handler, options) {
    document.querySelectorAll(selector).forEach(el => {
        el.addEventListener(event, handler, options);
    });
}

/**
 * Toggle visibility using the hidden attribute
 * @param {HTMLElement|string} elementOrId - Element or element ID
 * @param {boolean} [show] - Optional explicit state (true = show, false = hide)
 */
export function toggleVisibility(elementOrId, show) {
    const el = typeof elementOrId === 'string'
        ? document.getElementById(elementOrId)
        : elementOrId;

    if (!el) return;

    if (show === undefined) {
        el.hidden = !el.hidden;
    } else {
        el.hidden = !show;
    }
}

/**
 * Show element (remove hidden attribute)
 * @param {HTMLElement|string} elementOrId - Element or element ID
 */
export function show(elementOrId) {
    toggleVisibility(elementOrId, true);
}

/**
 * Hide element (add hidden attribute)
 * @param {HTMLElement|string} elementOrId - Element or element ID
 */
export function hide(elementOrId) {
    toggleVisibility(elementOrId, false);
}

/**
 * Toggle CSS class on element
 * @param {HTMLElement|string} elementOrId - Element or element ID
 * @param {string} className - Class to toggle
 * @param {boolean} [force] - Optional explicit state
 */
export function toggleClass(elementOrId, className, force) {
    const el = typeof elementOrId === 'string'
        ? document.getElementById(elementOrId)
        : elementOrId;

    if (el) {
        el.classList.toggle(className, force);
    }
}

/**
 * Add CSS class to element
 * @param {HTMLElement|string} elementOrId - Element or element ID
 * @param {...string} classNames - Classes to add
 */
export function addClass(elementOrId, ...classNames) {
    const el = typeof elementOrId === 'string'
        ? document.getElementById(elementOrId)
        : elementOrId;

    if (el) {
        el.classList.add(...classNames);
    }
}

/**
 * Remove CSS class from element
 * @param {HTMLElement|string} elementOrId - Element or element ID
 * @param {...string} classNames - Classes to remove
 */
export function removeClass(elementOrId, ...classNames) {
    const el = typeof elementOrId === 'string'
        ? document.getElementById(elementOrId)
        : elementOrId;

    if (el) {
        el.classList.remove(...classNames);
    }
}

/**
 * Set text content of element safely
 * @param {HTMLElement|string} elementOrId - Element or element ID
 * @param {string} text - Text content to set
 */
export function setText(elementOrId, text) {
    const el = typeof elementOrId === 'string'
        ? document.getElementById(elementOrId)
        : elementOrId;

    if (el) {
        el.textContent = text;
    }
}

/**
 * Set HTML content of element safely
 * @param {HTMLElement|string} elementOrId - Element or element ID
 * @param {string} html - HTML content to set
 */
export function setHTML(elementOrId, html) {
    const el = typeof elementOrId === 'string'
        ? document.getElementById(elementOrId)
        : elementOrId;

    if (el) {
        el.innerHTML = html;
    }
}

/**
 * Set element disabled state
 * @param {HTMLElement|string} elementOrId - Element or element ID
 * @param {boolean} disabled - Whether element should be disabled
 */
export function setDisabled(elementOrId, disabled) {
    const el = typeof elementOrId === 'string'
        ? document.getElementById(elementOrId)
        : elementOrId;

    if (el && 'disabled' in el) {
        el.disabled = disabled;
    }
}

/**
 * Create an SVG element with proper namespace
 * @param {string} tagName - SVG element tag name
 * @returns {SVGElement}
 */
export function createSVGElement(tagName) {
    return document.createElementNS('http://www.w3.org/2000/svg', tagName);
}

/**
 * Remove all children from element
 * @param {HTMLElement|string} elementOrId - Element or element ID
 */
export function clearChildren(elementOrId) {
    const el = typeof elementOrId === 'string'
        ? document.getElementById(elementOrId)
        : elementOrId;

    if (el) {
        el.innerHTML = '';
    }
}

/**
 * Focus element after a small delay (useful for dialogs)
 * @param {HTMLElement|string} elementOrId - Element or element ID
 * @param {number} [delay=50] - Delay in milliseconds
 */
export function focusDelayed(elementOrId, delay = 50) {
    setTimeout(() => {
        const el = typeof elementOrId === 'string'
            ? document.getElementById(elementOrId)
            : elementOrId;

        if (el && typeof el.focus === 'function') {
            el.focus();
        }
    }, delay);
}
