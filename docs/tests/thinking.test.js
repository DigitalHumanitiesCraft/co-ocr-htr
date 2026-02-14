/**
 * Tests for ThinkingPanel component
 *
 * Verifies event-driven lifecycle:
 *   thinkingStart -> show panel, set header
 *   thinkingChunk -> append text, auto-scroll
 *   thinkingComplete -> show duration, change status
 *   thinkingError -> show error status
 *   documentLoaded/pageChanged -> reset
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Minimal DOM setup for ThinkingPanel
function setupDOM() {
    document.body.innerHTML = `
        <div class="thinking-section" id="thinkingSection" hidden>
            <div class="thinking-header">
                <svg class="icon-sm thinking-icon" id="thinkingIcon"></svg>
                <span class="thinking-label" id="thinkingHeader">LLM Thinking</span>
            </div>
            <pre class="thinking-content" id="thinkingContent"></pre>
        </div>
    `;
}

// Import after DOM is set up (auto-init fires on import)
// eslint-disable-next-line no-unused-vars -- imported for side-effect auto-init
let thinkingPanel;
let appState;

beforeEach(async () => {
    vi.resetModules();
    setupDOM();

    // Import fresh instances -- auto-init in thinking.js fires on import
    const stateModule = await import('../js/state.js');
    appState = stateModule.appState;

    const thinkingModule = await import('../js/components/thinking.js');
    thinkingPanel = thinkingModule.thinkingPanel;
    // Auto-init already ran during import (DOM is ready in jsdom)
    // Do NOT call init() again to avoid double event binding
});

describe('ThinkingPanel', () => {
    describe('thinkingStart', () => {
        it('should show the panel when thinkingStart is emitted', () => {
            const section = document.getElementById('thinkingSection');
            expect(section.hidden).toBe(true);

            appState.emitThinkingStart({
                operation: 'transcription',
                provider: 'gemini',
                model: 'gemini-3-flash'
            });

            expect(section.hidden).toBe(false);
            expect(section.classList.contains('thinking-active')).toBe(true);
        });

        it('should set the header with operation and provider info', () => {
            appState.emitThinkingStart({
                operation: 'transcription',
                provider: 'gemini',
                model: 'gemini-3-flash'
            });

            const header = document.getElementById('thinkingHeader');
            expect(header.textContent).toBe('Transcription -- LLM Thinking');
        });

        it('should clear previous content on new start', () => {
            const content = document.getElementById('thinkingContent');
            content.textContent = 'old thinking text';

            appState.emitThinkingStart({
                operation: 'validation',
                provider: 'anthropic',
                model: 'claude-sonnet-4-5-20250929'
            });

            expect(content.textContent).toBe('');
        });

        it('should use operation label for validation', () => {
            appState.emitThinkingStart({
                operation: 'validation',
                provider: 'gemini',
                model: 'gemini-3-flash'
            });

            const header = document.getElementById('thinkingHeader');
            expect(header.textContent).toContain('LLM Review');
        });

        it('should use operation label for description', () => {
            appState.emitThinkingStart({
                operation: 'description',
                provider: 'gemini',
                model: 'gemini-3-pro'
            });

            const header = document.getElementById('thinkingHeader');
            expect(header.textContent).toContain('Description');
        });
    });

    describe('thinkingChunk', () => {
        it('should append text to content', () => {
            appState.emitThinkingStart({ operation: 'transcription', provider: 'gemini' });

            appState.emitThinkingChunk({ text: 'First chunk. ', operation: 'transcription' });
            appState.emitThinkingChunk({ text: 'Second chunk.', operation: 'transcription' });

            const content = document.getElementById('thinkingContent');
            expect(content.textContent).toBe('First chunk. Second chunk.');
        });

        it('should ignore empty chunks', () => {
            appState.emitThinkingStart({ operation: 'transcription', provider: 'gemini' });

            appState.emitThinkingChunk({ text: 'Real content', operation: 'transcription' });
            appState.emitThinkingChunk({ text: '', operation: 'transcription' });
            appState.emitThinkingChunk({ text: null, operation: 'transcription' });

            const content = document.getElementById('thinkingContent');
            expect(content.textContent).toBe('Real content');
        });

        it('should use textContent for XSS safety', () => {
            appState.emitThinkingStart({ operation: 'transcription', provider: 'gemini' });

            appState.emitThinkingChunk({
                text: '<script>alert("xss")</script>',
                operation: 'transcription'
            });

            const content = document.getElementById('thinkingContent');
            expect(content.textContent).toContain('<script>');
            // innerHTML should contain escaped content, not executable script
            expect(content.innerHTML).not.toContain('<script>');
        });
    });

    describe('thinkingComplete', () => {
        it('should change status class from active to complete', () => {
            const section = document.getElementById('thinkingSection');

            appState.emitThinkingStart({ operation: 'transcription', provider: 'gemini' });
            expect(section.classList.contains('thinking-active')).toBe(true);

            appState.emitThinkingComplete({ operation: 'transcription', duration: 5000 });
            expect(section.classList.contains('thinking-active')).toBe(false);
            expect(section.classList.contains('thinking-complete')).toBe(true);
        });

        it('should append duration to header', () => {
            appState.emitThinkingStart({
                operation: 'transcription',
                provider: 'gemini',
                model: 'gemini-3-flash'
            });

            appState.emitThinkingComplete({ operation: 'transcription', duration: 3200 });

            const header = document.getElementById('thinkingHeader');
            expect(header.textContent).toContain('3.2s');
        });
    });

    describe('thinkingError', () => {
        it('should change status class to error', () => {
            const section = document.getElementById('thinkingSection');

            appState.emitThinkingStart({ operation: 'transcription', provider: 'gemini' });
            appState.emitThinkingError({ operation: 'transcription', message: 'API timeout' });

            expect(section.classList.contains('thinking-active')).toBe(false);
            expect(section.classList.contains('thinking-error')).toBe(true);
        });

        it('should show error message in header', () => {
            appState.emitThinkingStart({
                operation: 'transcription',
                provider: 'gemini',
                model: 'gemini-3-flash'
            });

            appState.emitThinkingError({ operation: 'transcription', message: 'Rate limit' });

            const header = document.getElementById('thinkingHeader');
            expect(header.textContent).toContain('Rate limit');
        });
    });

    describe('reset behavior', () => {
        it('should reset on documentLoaded', () => {
            const section = document.getElementById('thinkingSection');
            const content = document.getElementById('thinkingContent');

            appState.emitThinkingStart({ operation: 'transcription', provider: 'gemini' });
            appState.emitThinkingChunk({ text: 'thinking...', operation: 'transcription' });

            expect(section.hidden).toBe(false);
            expect(content.textContent).toBe('thinking...');

            appState.dispatchEvent(new CustomEvent('documentLoaded'));

            expect(section.hidden).toBe(true);
            expect(content.textContent).toBe('');
        });

        it('should reset on pageChanged', () => {
            const section = document.getElementById('thinkingSection');

            appState.emitThinkingStart({ operation: 'transcription', provider: 'gemini' });
            expect(section.hidden).toBe(false);

            appState.dispatchEvent(new CustomEvent('pageChanged'));

            expect(section.hidden).toBe(true);
            expect(section.classList.contains('thinking-active')).toBe(false);
        });

        it('should restore default header text on reset', () => {
            appState.emitThinkingStart({
                operation: 'transcription',
                provider: 'gemini',
                model: 'gemini-3-flash'
            });

            const header = document.getElementById('thinkingHeader');
            expect(header.textContent).not.toBe('LLM Thinking');

            appState.dispatchEvent(new CustomEvent('documentLoaded'));
            expect(header.textContent).toBe('LLM Thinking');
        });
    });

    describe('feature flag', () => {
        it('should not initialize if feature flag is disabled', async () => {
            vi.resetModules();
            setupDOM();

            // Mock FEATURE_FLAGS with thinkingPanel=false
            vi.doMock('../js/utils/constants.js', () => ({
                FEATURE_FLAGS: { thinkingPanel: false },
                CLOUD_TIMEOUT_MS: 60000,
                OLLAMA_TIMEOUT_MS: 120000,
                LOCAL_TIMEOUT_MS: 15000,
                IIIF_TIMEOUT_MS: 30000,
                URL_REVOKE_DELAY: 60000,
                PROVIDERS: {}
            }));

            const { thinkingPanel: disabledPanel } = await import('../js/components/thinking.js');
            disabledPanel._initialized = false;
            disabledPanel.init();

            // Panel should have been initialized (guard triggered) but DOM refs null
            const section = document.getElementById('thinkingSection');
            expect(section.hidden).toBe(true); // stays hidden

            // Emitting events should not throw
            const stateModule = await import('../js/state.js');
            stateModule.appState.emitThinkingStart({ operation: 'test', provider: 'test' });
            expect(section.hidden).toBe(true); // still hidden
        });
    });
});
