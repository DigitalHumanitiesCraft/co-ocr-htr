/**
 * The e2e server serves docs/ itself. A local config.local.js with real keys
 * must never reach the page, and no spec may contact an LLM provider.
 */
import { test, expect } from './fixtures.js';

test('config.local.js is not served to the page under test', async ({ page }) => {
    await page.goto('/');
    const status = await page.evaluate(() => fetch('config.local.js').then(r => r.status));
    expect(status).toBe(404);
});

test('requests to LLM providers are aborted', async ({ page }) => {
    await page.goto('/');
    const outcome = await page.evaluate(() =>
        fetch('https://generativelanguage.googleapis.com/v1beta/models')
            .then(() => 'reached', () => 'blocked'));
    expect(outcome).toBe('blocked');
});
