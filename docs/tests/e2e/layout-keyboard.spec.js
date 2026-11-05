/**
 * E2E: the Validate step stays reachable on narrow screens, and the export
 * format can be chosen with the keyboard.
 */
import { test, expect } from '@playwright/test';

async function openApp(page) {
    await page.addInitScript(() => {
        localStorage.setItem('coocr:settings', JSON.stringify({ welcome_dismissed: true }));
    });
    const initialized = page.waitForEvent('console', msg => msg.text() === 'coOCR/HTR: Initialized');
    await page.goto('/');
    await initialized;
}

test('Validate button is visible at 1100 px width', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await openApp(page);
    await expect(page.locator('#btnValidate')).toBeVisible();
});

test('export format radios take keyboard focus and arrow keys change the format', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await openApp(page);
    await page.evaluate(() => document.getElementById('exportDialog').showModal());

    const txt = page.locator('input[name="exportFormat"][value="txt"]');
    await txt.focus();
    await expect(txt).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(page.locator('input[name="exportFormat"][value="json"]')).toBeChecked();
});
