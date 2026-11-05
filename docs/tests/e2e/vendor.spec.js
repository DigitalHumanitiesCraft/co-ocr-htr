/**
 * E2E: viewer and ZIP export run on vendored libraries, with no script loaded
 * from a CDN, and the SVG overlay still draws the line regions.
 */
import { test, expect } from './fixtures.js';

test('loads no script from a CDN and draws PAGE-XML line regions', async ({ page }) => {
    const external = [];
    page.on('request', req => {
        const url = new URL(req.url());
        if (req.resourceType() === 'script' && url.hostname !== 'localhost') external.push(req.url());
    });
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

    await expect.poll(() => page.locator('#osd-viewer svg g > *').count(), { timeout: 10_000 })
        .toBeGreaterThan(0);
    expect(external).toEqual([]);
});

test('ZIP export loads JSZip from the site itself', async ({ page }) => {
    await page.goto('/');
    const loaded = await page.evaluate(async () => {
        const { exportService } = await import('./js/services/export.js');
        await exportService._loadScript('vendor/jszip/jszip.min.js');
        return typeof window.JSZip;
    });
    expect(loaded).toBe('function');
});
