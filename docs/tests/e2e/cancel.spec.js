/**
 * E2E: a single-page transcription against a provider that never answers can
 * be cancelled, and the editor is usable again right away.
 */
import { test, expect } from './fixtures.js';

test('cancel stops a hanging transcription', async ({ page }) => {
    await page.route('**/generativelanguage.googleapis.com/**', () => { /* never answers */ });
    await page.addInitScript(() => {
        localStorage.setItem('coocr:settings', JSON.stringify({ welcome_dismissed: true }));
    });
    await page.setViewportSize({ width: 1400, height: 900 });
    const initialized = page.waitForEvent('console', msg => msg.text() === 'coOCR/HTR: Initialized');
    await page.goto('/');
    await initialized;

    await page.evaluate(async () => {
        const { samplesService } = await import('./js/services/samples.js');
        const { llmService } = await import('./js/services/llm.js');
        const { transcriptionManager } = await import('./js/components/transcription.js');
        await samplesService.loadSample('hsa-letter-2261');
        llmService.setApiKey('gemini', 'test-fake-key');
        transcriptionManager.handleTranscribe();
    });

    const cancel = page.locator('#cancelTranscription');
    await expect(cancel).toBeVisible();
    await cancel.click();

    await expect(page.locator('.toast-info .toast-message').last()).toBeVisible();
    await expect(page.locator('#editorLoadingOverlay')).toBeHidden();
});
