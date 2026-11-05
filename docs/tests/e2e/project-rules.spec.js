/**
 * E2E: the project rules dialog offers only the Markdown transcription rules,
 * which are the only rules any code reads. A project saved with the older
 * fields (edition model, XML schema, validation settings) still opens.
 */
import { test, expect } from './fixtures.js';

test('rules dialog opens a project with legacy fields and keeps only transcription rules', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('coocr:settings', JSON.stringify({ welcome_dismissed: true }));
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    const initialized = page.waitForEvent('console', msg => msg.text() === 'coOCR/HTR: Initialized');
    await page.goto('/');
    await initialized;

    await page.evaluate(async () => {
        const { storage } = await import('./js/services/storage.js');
        await storage.createProject({
            id: 'legacy-rules', name: 'Legacy rules', createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(), pageCount: 1,
            rules: {
                editionModel: 'diplomatic', xmlSchema: 'tei-p5',
                transcription: { markdown: '## Script\nKurrent' },
                validation: { autoValidate: true, customPrompt: 'old prompt' }
            }
        });
    });

    await page.locator('#btnProjects').click();
    await page.locator('[data-rules="legacy-rules"]').click();

    const md = page.locator('#rulesTranscriptionMd');
    await expect(md).toHaveValue('## Script\nKurrent');
    for (const id of ['rulesEditionModel', 'rulesXmlSchema', 'rulesAutoValidate', 'rulesCustomPrompt']) {
        await expect(page.locator(`#${id}`)).toHaveCount(0);
    }

    await page.locator('[data-action="save"]').click();
    // The save is asynchronous; the dialog closes once it is written
    await expect(md).toHaveCount(0);
    const rules = await page.evaluate(async () => {
        const { storage } = await import('./js/services/storage.js');
        return (await storage.getProject('legacy-rules')).rules;
    });
    expect(rules).toEqual({ transcription: { markdown: '## Script\nKurrent' } });
});
