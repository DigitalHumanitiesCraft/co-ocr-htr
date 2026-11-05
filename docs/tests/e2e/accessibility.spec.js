/**
 * E2E: keyboard reachability and accessible names of controls that axe-core
 * and a keyboard walk-through flagged.
 */
import { test, expect } from './fixtures.js';

async function openApp(page) {
    await page.addInitScript(() => {
        localStorage.setItem('coocr:settings', JSON.stringify({ welcome_dismissed: true }));
    });
    const initialized = page.waitForEvent('console', msg => msg.text() === 'coOCR/HTR: Initialized');
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/');
    await initialized;
}

test('skip link becomes visible on focus and points to an existing target', async ({ page }) => {
    await openApp(page);
    const link = page.locator('.skip-link');
    await link.focus();
    // The link slides in with a short transition
    await expect.poll(async () => (await link.boundingBox()).y).toBeGreaterThanOrEqual(0);

    const target = await link.getAttribute('href');
    await expect(page.locator(target)).toHaveCount(1);
});

test('panel separators expose their current value', async ({ page }) => {
    await openApp(page);
    const separators = page.locator('[role="separator"].panel-resize-handle');
    await expect(separators.first()).toHaveAttribute('aria-valuenow', /\d+/);
});

test('LLM review toggle has an accessible name', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => document.getElementById('validateDialog').showModal());
    await expect(page.locator('#enableLLM')).toHaveAccessibleName(/LLM/);
});

test('status bar does not report a connection before a key is configured', async ({ page }) => {
    await openApp(page);
    const dot = page.locator('#statusIndicator');
    await expect(dot).toHaveClass(/status-uncertain/);
    await expect(dot).not.toHaveClass(/status-confident/);
});

test('LLM configuration indicator opens its dialog from the keyboard', async ({ page }) => {
    await openApp(page);
    const indicator = page.locator('#modelIndicator');
    await indicator.focus();
    await expect(indicator).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#apiKeyDialog')).toBeVisible();
});
