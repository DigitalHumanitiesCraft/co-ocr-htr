/**
 * E2E Tests for the Thinking Panel
 *
 * Verifies the thinking panel is visible in the browser, responds
 * to state events, and displays thinking tokens correctly.
 *
 * Uses programmatic event injection via appState to simulate
 * LLM streaming without requiring actual API calls.
 */
import { test, expect } from '@playwright/test';

/**
 * Load the wecker-p015 sample so the validation panel area is visible.
 */
async function loadSampleAndWait(page) {
    await page.goto('/');
    await page.waitForSelector('#btnUpload');

    await page.evaluate(async () => {
        const { samplesService } = await import('/js/services/samples.js');
        const { appState } = await import('/js/state.js');
        await appState.ensureProject('E2E Thinking Test');
        await samplesService.loadSample('wecker-p015');
    });

    await page.waitForSelector('#transcriptionText');
}

/**
 * Cache appState reference in window for later use.
 */
async function cacheModules(page) {
    await page.evaluate(async () => {
        const { appState } = await import('/js/state.js');
        window.__e2eModules = { appState };
    });
}

// --- Tests ---

test.describe('Thinking Panel', () => {
    test.beforeEach(async ({ page }) => {
        await loadSampleAndWait(page);
        await cacheModules(page);
    });

    test('thinking section exists in DOM and is initially hidden', async ({ page }) => {
        const section = page.locator('#thinkingSection');
        await expect(section).toBeAttached();
        await expect(section).toBeHidden();
    });

    test('panel becomes visible on thinkingStart', async ({ page }) => {
        const section = page.locator('#thinkingSection');
        await expect(section).toBeHidden();

        // Emit thinkingStart
        await page.evaluate(() => {
            const { appState } = window.__e2eModules;
            appState.emitThinkingStart({
                operation: 'transcription',
                provider: 'gemini',
                model: 'gemini-3-flash-preview'
            });
        });

        await expect(section).toBeVisible();
        await expect(section).toHaveClass(/thinking-active/);

        // Header should show operation + provider info
        const header = page.locator('#thinkingHeader');
        await expect(header).toContainText('Transcription');
        await expect(header).toContainText('gemini');
    });

    test('thinking chunks appear in the content area', async ({ page }) => {
        // Start thinking
        await page.evaluate(() => {
            const { appState } = window.__e2eModules;
            appState.emitThinkingStart({
                operation: 'validation',
                provider: 'anthropic',
                model: 'claude-sonnet-4-5-20250929'
            });
        });

        const content = page.locator('#thinkingContent');
        await expect(content).toHaveText('');

        // Send chunks
        await page.evaluate(() => {
            const { appState } = window.__e2eModules;
            appState.emitThinkingChunk({ text: 'Analyzing the transcription...', operation: 'validation' });
        });
        await expect(content).toContainText('Analyzing the transcription...');

        await page.evaluate(() => {
            const { appState } = window.__e2eModules;
            appState.emitThinkingChunk({ text: ' Found 3 potential issues.', operation: 'validation' });
        });
        await expect(content).toContainText('Analyzing the transcription... Found 3 potential issues.');
    });

    test('thinkingComplete changes status and shows duration', async ({ page }) => {
        const section = page.locator('#thinkingSection');
        const header = page.locator('#thinkingHeader');

        // Start + chunks
        await page.evaluate(() => {
            const { appState } = window.__e2eModules;
            appState.emitThinkingStart({
                operation: 'description',
                provider: 'gemini',
                model: 'gemini-3-pro-preview'
            });
            appState.emitThinkingChunk({ text: 'Examining initial...', operation: 'description' });
        });

        await expect(section).toHaveClass(/thinking-active/);

        // Complete
        await page.evaluate(() => {
            const { appState } = window.__e2eModules;
            appState.emitThinkingComplete({
                operation: 'description',
                duration: 4500
            });
        });

        // Should switch from active to complete
        await expect(section).not.toHaveClass(/thinking-active/);
        await expect(section).toHaveClass(/thinking-complete/);
        // Duration should appear in header
        await expect(header).toContainText('4.5s');
    });

    test('thinkingError changes status and shows error message', async ({ page }) => {
        const section = page.locator('#thinkingSection');
        const header = page.locator('#thinkingHeader');

        // Start
        await page.evaluate(() => {
            const { appState } = window.__e2eModules;
            appState.emitThinkingStart({
                operation: 'transcription',
                provider: 'ollama',
                model: 'deepseek-r1'
            });
        });

        await expect(section).toHaveClass(/thinking-active/);

        // Error
        await page.evaluate(() => {
            const { appState } = window.__e2eModules;
            appState.emitThinkingError({
                operation: 'transcription',
                message: 'Connection timeout'
            });
        });

        await expect(section).not.toHaveClass(/thinking-active/);
        await expect(section).toHaveClass(/thinking-error/);
        await expect(header).toContainText('Connection timeout');
    });

    test('thinking content is XSS-safe (textContent, not innerHTML)', async ({ page }) => {
        await page.evaluate(() => {
            const { appState } = window.__e2eModules;
            appState.emitThinkingStart({
                operation: 'transcription',
                provider: 'gemini',
                model: 'test'
            });
            appState.emitThinkingChunk({
                text: '<script>alert("xss")</script>',
                operation: 'transcription'
            });
        });

        const content = page.locator('#thinkingContent');
        // The literal text should appear (escaped), not be interpreted as HTML
        await expect(content).toContainText('<script>');

        // Verify no script element was injected
        const scriptCount = await page.locator('#thinkingContent script').count();
        expect(scriptCount).toBe(0);
    });

    test('panel resets and hides on documentLoaded', async ({ page }) => {
        const section = page.locator('#thinkingSection');
        const content = page.locator('#thinkingContent');

        // Start + chunk
        await page.evaluate(() => {
            const { appState } = window.__e2eModules;
            appState.emitThinkingStart({
                operation: 'transcription',
                provider: 'gemini',
                model: 'test'
            });
            appState.emitThinkingChunk({ text: 'Some thinking text', operation: 'transcription' });
        });

        await expect(section).toBeVisible();
        await expect(content).toContainText('Some thinking text');

        // Simulate document load (resets panel)
        await page.evaluate(() => {
            const { appState } = window.__e2eModules;
            appState.dispatchEvent(new CustomEvent('documentLoaded'));
        });

        await expect(section).toBeHidden();
    });

    test('panel CSS renders correctly (visible styling when active)', async ({ page }) => {
        // Emit start to make panel visible
        await page.evaluate(() => {
            const { appState } = window.__e2eModules;
            appState.emitThinkingStart({
                operation: 'transcription',
                provider: 'gemini',
                model: 'gemini-3-flash'
            });
            appState.emitThinkingChunk({ text: 'Reasoning about the manuscript text...', operation: 'transcription' });
        });

        const section = page.locator('#thinkingSection');
        await expect(section).toBeVisible();

        // Check computed styles to verify CSS is applied
        const styles = await page.evaluate(() => {
            const el = document.getElementById('thinkingSection');
            const computed = window.getComputedStyle(el);
            return {
                display: computed.display,
                maxHeight: parseInt(computed.maxHeight, 10),
                borderBottom: computed.borderBottomStyle
            };
        });

        expect(styles.display).toBe('flex');
        // max-height is managed by validationResize.js when multiple sections visible,
        // or by CSS default (220px) when only thinking section is visible
        expect(styles.maxHeight).toBeGreaterThan(0);
        expect(styles.borderBottom).toBe('solid');

        // Check content area has monospace font and flex-based sizing
        const contentStyles = await page.evaluate(() => {
            const el = document.getElementById('thinkingContent');
            const computed = window.getComputedStyle(el);
            return {
                flexGrow: computed.flexGrow,
                whiteSpace: computed.whiteSpace,
                overflowY: computed.overflowY
            };
        });

        expect(contentStyles.flexGrow).toBe('1');
        expect(contentStyles.whiteSpace).toBe('pre-wrap');
        expect(contentStyles.overflowY).toBe('auto');
    });

    test('header shows correct labels for different operations', async ({ page }) => {
        const header = page.locator('#thinkingHeader');

        // Transcription
        await page.evaluate(() => {
            const { appState } = window.__e2eModules;
            appState.emitThinkingStart({ operation: 'transcription', provider: 'gemini', model: 'flash' });
        });
        await expect(header).toContainText('Transcription');

        // Validation (labeled "LLM Review")
        await page.evaluate(() => {
            const { appState } = window.__e2eModules;
            appState.emitThinkingStart({ operation: 'validation', provider: 'anthropic', model: 'sonnet' });
        });
        await expect(header).toContainText('LLM Review');

        // Description
        await page.evaluate(() => {
            const { appState } = window.__e2eModules;
            appState.emitThinkingStart({ operation: 'description', provider: 'gemini', model: 'pro' });
        });
        await expect(header).toContainText('Description');
    });

    test('new thinkingStart clears previous content', async ({ page }) => {
        const content = page.locator('#thinkingContent');

        // First session
        await page.evaluate(() => {
            const { appState } = window.__e2eModules;
            appState.emitThinkingStart({ operation: 'transcription', provider: 'gemini', model: 'flash' });
            appState.emitThinkingChunk({ text: 'Old thinking content', operation: 'transcription' });
        });
        await expect(content).toContainText('Old thinking content');

        // Second session -- should clear
        await page.evaluate(() => {
            const { appState } = window.__e2eModules;
            appState.emitThinkingStart({ operation: 'validation', provider: 'anthropic', model: 'sonnet' });
        });
        await expect(content).toHaveText('');
    });
});
