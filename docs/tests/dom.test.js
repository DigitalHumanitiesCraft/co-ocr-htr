/**
 * dom.test.js - Tests for DOM utility functions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    getById,
    select,
    selectAll,
    withElement,
    toggleVisibility,
    show,
    hide,
    toggleClass,
    addClass,
    removeClass,
    setText,
    setHTML,
    setDisabled,
    createSVGElement,
    clearChildren
} from '../js/utils/dom.js';

describe('DOM Utilities', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        container.id = 'test-container';
        document.body.appendChild(container);
    });

    afterEach(() => {
        container.remove();
    });

    describe('getById', () => {
        it('should return element by ID', () => {
            const el = document.createElement('div');
            el.id = 'test-element';
            container.appendChild(el);

            expect(getById('test-element')).toBe(el);
        });

        it('should return null for non-existent ID', () => {
            expect(getById('non-existent')).toBeNull();
        });
    });

    describe('select', () => {
        it('should select element by CSS selector', () => {
            const el = document.createElement('span');
            el.className = 'test-class';
            container.appendChild(el);

            expect(select('.test-class')).toBe(el);
        });

        it('should select within parent element', () => {
            const parent = document.createElement('div');
            const child = document.createElement('span');
            child.className = 'nested';
            parent.appendChild(child);
            container.appendChild(parent);

            expect(select('.nested', parent)).toBe(child);
        });

        it('should return null for non-existent selector', () => {
            expect(select('.non-existent')).toBeNull();
        });
    });

    describe('selectAll', () => {
        it('should select all matching elements', () => {
            container.innerHTML = '<span class="item">1</span><span class="item">2</span>';
            const elements = selectAll('.item');
            expect(elements.length).toBe(2);
        });

        it('should return empty NodeList for no matches', () => {
            const elements = selectAll('.non-existent');
            expect(elements.length).toBe(0);
        });
    });

    describe('withElement', () => {
        it('should execute callback if element exists', () => {
            const el = document.createElement('div');
            el.id = 'callback-test';
            container.appendChild(el);

            let called = false;
            withElement('callback-test', (element) => {
                called = true;
                expect(element).toBe(el);
            });

            expect(called).toBe(true);
        });

        it('should not execute callback if element does not exist', () => {
            let called = false;
            withElement('non-existent', () => {
                called = true;
            });

            expect(called).toBe(false);
        });
    });

    describe('toggleVisibility', () => {
        it('should toggle hidden attribute', () => {
            const el = document.createElement('div');
            el.id = 'toggle-test';
            container.appendChild(el);

            expect(el.hidden).toBe(false);
            toggleVisibility(el);
            expect(el.hidden).toBe(true);
            toggleVisibility(el);
            expect(el.hidden).toBe(false);
        });

        it('should set explicit visibility state', () => {
            const el = document.createElement('div');
            el.id = 'explicit-toggle';
            container.appendChild(el);

            toggleVisibility(el, false);
            expect(el.hidden).toBe(true);

            toggleVisibility(el, true);
            expect(el.hidden).toBe(false);
        });

        it('should accept element ID as string', () => {
            const el = document.createElement('div');
            el.id = 'string-toggle';
            container.appendChild(el);

            toggleVisibility('string-toggle', false);
            expect(el.hidden).toBe(true);
        });

        it('should handle non-existent element gracefully', () => {
            expect(() => toggleVisibility('non-existent')).not.toThrow();
        });
    });

    describe('show/hide', () => {
        it('should show element', () => {
            const el = document.createElement('div');
            el.hidden = true;
            container.appendChild(el);

            show(el);
            expect(el.hidden).toBe(false);
        });

        it('should hide element', () => {
            const el = document.createElement('div');
            container.appendChild(el);

            hide(el);
            expect(el.hidden).toBe(true);
        });
    });

    describe('toggleClass', () => {
        it('should toggle class on element', () => {
            const el = document.createElement('div');
            container.appendChild(el);

            toggleClass(el, 'active');
            expect(el.classList.contains('active')).toBe(true);

            toggleClass(el, 'active');
            expect(el.classList.contains('active')).toBe(false);
        });

        it('should force class state', () => {
            const el = document.createElement('div');
            container.appendChild(el);

            toggleClass(el, 'forced', true);
            expect(el.classList.contains('forced')).toBe(true);

            toggleClass(el, 'forced', true);
            expect(el.classList.contains('forced')).toBe(true);
        });
    });

    describe('addClass/removeClass', () => {
        it('should add classes', () => {
            const el = document.createElement('div');
            container.appendChild(el);

            addClass(el, 'one', 'two');
            expect(el.classList.contains('one')).toBe(true);
            expect(el.classList.contains('two')).toBe(true);
        });

        it('should remove classes', () => {
            const el = document.createElement('div');
            el.className = 'one two three';
            container.appendChild(el);

            removeClass(el, 'one', 'two');
            expect(el.classList.contains('one')).toBe(false);
            expect(el.classList.contains('two')).toBe(false);
            expect(el.classList.contains('three')).toBe(true);
        });
    });

    describe('setText', () => {
        it('should set text content', () => {
            const el = document.createElement('div');
            container.appendChild(el);

            setText(el, 'Hello World');
            expect(el.textContent).toBe('Hello World');
        });

        it('should accept element ID', () => {
            const el = document.createElement('div');
            el.id = 'text-test';
            container.appendChild(el);

            setText('text-test', 'Test Content');
            expect(el.textContent).toBe('Test Content');
        });
    });

    describe('setHTML', () => {
        it('should set HTML content', () => {
            const el = document.createElement('div');
            container.appendChild(el);

            setHTML(el, '<span>Test</span>');
            expect(el.innerHTML).toBe('<span>Test</span>');
        });
    });

    describe('setDisabled', () => {
        it('should disable element', () => {
            const btn = document.createElement('button');
            container.appendChild(btn);

            setDisabled(btn, true);
            expect(btn.disabled).toBe(true);

            setDisabled(btn, false);
            expect(btn.disabled).toBe(false);
        });

        it('should not throw for elements without disabled property', () => {
            const div = document.createElement('div');
            container.appendChild(div);

            expect(() => setDisabled(div, true)).not.toThrow();
        });
    });

    describe('createSVGElement', () => {
        it('should create SVG element with correct namespace', () => {
            const svg = createSVGElement('svg');
            expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
            expect(svg.tagName.toLowerCase()).toBe('svg');
        });

        it('should create SVG child elements', () => {
            const rect = createSVGElement('rect');
            expect(rect.namespaceURI).toBe('http://www.w3.org/2000/svg');
            expect(rect.tagName.toLowerCase()).toBe('rect');
        });
    });

    describe('clearChildren', () => {
        it('should remove all children', () => {
            container.innerHTML = '<div>1</div><div>2</div><div>3</div>';
            expect(container.children.length).toBe(3);

            clearChildren(container);
            expect(container.children.length).toBe(0);
        });

        it('should accept element ID', () => {
            const el = document.createElement('div');
            el.id = 'clear-test';
            el.innerHTML = '<span>Child</span>';
            container.appendChild(el);

            clearChildren('clear-test');
            expect(el.children.length).toBe(0);
        });
    });
});
