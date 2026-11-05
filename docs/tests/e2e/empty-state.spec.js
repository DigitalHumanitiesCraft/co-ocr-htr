/**
 * E2E: the empty viewer offers "Load Demo" and "Load IIIF" (DESIGN-SYSTEM 6.1),
 * and no hint bar repeats what a panel's empty state already says.
 */
import { test, expect } from './fixtures.js';

async function openApp(page, lang = 'en') {
    await page.addInitScript((l) => {
        localStorage.setItem('coocr:settings', JSON.stringify({ welcome_dismissed: true }));
        localStorage.setItem('coocr:lang', l);
    }, lang);
    const initialized = page.waitForEvent('console', msg => msg.text() === 'coOCR/HTR: Initialized');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await initialized;
}

test('empty viewer opens the demo list and the IIIF dialog', async ({ page }) => {
    await openApp(page);
    await page.locator('#emptyLoadDemo').click();
    await expect(page.locator('#samplesMenu')).toHaveClass(/visible/);
    await expect(page.locator('#samplesMenu .samples-menu-item').first()).toBeFocused();

    await page.keyboard.press('Escape');
    await page.mouse.click(5, 5);
    await page.locator('#emptyLoadIIIF').click();
    await expect(page.locator('#iiifDialog')).toBeVisible();
});

test('no hint bar duplicates the empty states, and the editor names the real control', async ({ page }) => {
    await openApp(page, 'de');
    await expect(page.locator('.panel-hint')).toHaveCount(0);
    await expect(page.locator('#emptyLoadDemo')).toHaveText('Demo laden');
    await expect(page.locator('#editorContent')).toContainText('Stift-Symbol');
});
