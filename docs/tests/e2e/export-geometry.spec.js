/**
 * E2E: a PAGE-XML export with a line that has no coordinates warns and names
 * the line, because the export invents no geometry.
 */
import { test, expect } from './fixtures.js';

test('warns about lines exported without Coords', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('coocr:settings', JSON.stringify({ welcome_dismissed: true }));
    });
    await page.setViewportSize({ width: 1400, height: 900 });
    const initialized = page.waitForEvent('console', msg => msg.text() === 'coOCR/HTR: Initialized');
    await page.goto('/');
    await initialized;

    await page.evaluate(async () => {
        const { samplesService } = await import('./js/services/samples.js');
        await samplesService.loadSample('wecker-p015');
    });
    const editor = page.locator('#transcriptionText');
    await expect(editor).toBeVisible();
    await editor.evaluate(el => {
        el.value = 'neue Zeile\n' + el.value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const download = page.waitForEvent('download');
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('exportRequested', {
        detail: { format: 'xml', includeValidation: false, includeMetadata: true }
    })));
    await download;

    await expect(page.locator('.toast-warning .toast-message')).toContainText('Coords');
});
