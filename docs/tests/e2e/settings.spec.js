/**
 * E2E: the settings dialog offers only settings that take effect, and saving
 * drops stored values of the removed ones.
 */
import { test, expect } from './fixtures.js';

test('settings dialog has no controls without effect and saving clears their stored values', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('coocr:settings', JSON.stringify({
            welcome_dismissed: true, showLineNumbers: false, defaultPerspective: 'linguistic'
        }));
    });
    const initialized = page.waitForEvent('console', msg => msg.text() === 'coOCR/HTR: Initialized');
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/');
    await initialized;

    await page.evaluate(() => document.getElementById('settingsDialog').showModal());
    for (const id of ['settingShowLineNumbers', 'settingHighlightUncertain', 'settingAutoValidate', 'settingDefaultPerspective']) {
        await expect(page.locator(`#${id}`)).toHaveCount(0);
    }

    const stored = await page.evaluate(async () => {
        const { dialogManager } = await import('./js/components/dialogs.js');
        dialogManager.saveSettings();
        return JSON.parse(localStorage.getItem('coocr:settings'));
    });
    expect(stored).not.toHaveProperty('showLineNumbers');
    expect(stored).not.toHaveProperty('defaultPerspective');
});
