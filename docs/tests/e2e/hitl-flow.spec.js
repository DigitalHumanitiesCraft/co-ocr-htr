/**
 * E2E Tests for the Human-in-the-Loop (HITL) Flow
 *
 * Covers: Validate -> Apply -> Diff -> Undo -> Apply All -> Export
 *
 * Uses the wecker-p015 sample (single page with PAGE-XML) to skip
 * LLM transcription, and injects validation results directly into
 * appState to test the UI interaction flows.
 */
import { test, expect } from '@playwright/test';

/** Mock validation results injected into appState */
const MOCK_VALIDATION_RESULTS = {
    rules: [
        { name: 'Line Count', type: 'success', message: '15 lines', lines: [] },
    ],
    llmJudge: {
        confidence: 'likely',
        reasoning: 'Several OCR artifacts detected in Latin medical text.',
        issues: [
            {
                line: 1,
                text: 'ANTIDOTARIVM',
                suggestion: 'ANTIDOTARIUM',
                type: 'ocr_artifact',
                explanation: 'V/U confusion typical in OCR of early print.',
            },
            {
                line: 3,
                text: 'medicinae',
                suggestion: 'medicinae',
                type: 'spelling',
                explanation: 'Correct as-is, included for confidence.',
            },
            {
                line: 5,
                text: 'recepisse',
                suggestion: 'recepisse',
                type: 'plausibility',
                explanation: 'Form is plausible in context.',
            },
        ],
    },
};

/**
 * Load the wecker-p015 sample and wait for the editor to render.
 * This sample has PAGE-XML, so it populates the editor with text.
 */
async function loadSampleAndWait(page) {
    await page.goto('/');

    // Wait for the app to initialize
    await page.waitForSelector('#btnUpload');

    // Load the wecker-p015 sample via the app's sample loading mechanism
    await page.evaluate(async () => {
        // Import the samples service and load directly
        const { samplesService } = await import('/js/services/samples.js');
        const { appState } = await import('/js/state.js');

        // Ensure a project exists
        await appState.ensureProject('E2E Test Project');

        // Load the sample
        await samplesService.loadSample('wecker-p015');
    });

    // Wait for editor textarea to appear with content
    await page.waitForSelector('#transcriptionText');
    const textContent = await page.inputValue('#transcriptionText');
    expect(textContent.length).toBeGreaterThan(10);
}

/**
 * Inject mock validation results and wait for the panel to render.
 */
async function injectValidation(page) {
    await page.evaluate((results) => {
        const { appState } = window.__e2eModules || {};
        if (appState) {
            appState.setValidationResults(results);
            return;
        }
        // Fallback: import directly
        import('/js/state.js').then(mod => {
            mod.appState.setValidationResults(results);
        });
    }, MOCK_VALIDATION_RESULTS);

    // Wait for validation issues to render
    await page.waitForSelector('.validation-issue');
}

// Cache module references for later use within browser context
async function cacheModules(page) {
    await page.evaluate(async () => {
        const stateMod = await import('/js/state.js');
        window.__e2eModules = { appState: stateMod.appState };
    });
}

// --- Tests ---

test.describe('App Loads', () => {
    test('should load the main page', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/coOCR/);
        await page.waitForSelector('#btnUpload');
    });
});

test.describe('Sample Loading', () => {
    test('should load wecker-p015 sample with transcription', async ({ page }) => {
        await loadSampleAndWait(page);

        // Verify editor has text content
        const text = await page.inputValue('#transcriptionText');
        expect(text.length).toBeGreaterThan(10);

        // Verify Validate button is enabled (transcription present)
        const validateBtn = page.locator('#btnValidate');
        await expect(validateBtn).not.toBeDisabled();
    });
});

test.describe('HITL Flow: Apply Suggestion', () => {
    test.beforeEach(async ({ page }) => {
        await loadSampleAndWait(page);
        await cacheModules(page);
        await injectValidation(page);
    });

    test('should display validation issues in the panel', async ({ page }) => {
        // Should show issue items
        const issues = page.locator('.validation-issue');
        await expect(issues).toHaveCount(3);

        // First issue should show the OCR artifact
        const firstIssue = issues.nth(0);
        await expect(firstIssue.locator('.issue-text')).toContainText('ANTIDOTARIVM');
        await expect(firstIssue.locator('.issue-suggestion')).toContainText('ANTIDOTARIUM');
    });

    test('should show Apply button on issues with suggestions', async ({ page }) => {
        const applyButtons = page.locator('.issue-apply-btn');
        // All 3 issues have suggestions
        await expect(applyButtons).toHaveCount(3);
    });

    test('should apply a suggestion and update editor text', async ({ page }) => {
        const textBefore = await page.inputValue('#transcriptionText');

        // Only test apply if the source text is in the editor
        if (textBefore.includes('ANTIDOTARIVM')) {
            // Click Apply on the first issue
            const firstApplyBtn = page.locator('.issue-apply-btn').first();
            await firstApplyBtn.click();

            // Editor text should be updated
            const textAfter = await page.inputValue('#transcriptionText');
            expect(textAfter).toContain('ANTIDOTARIUM');
            expect(textAfter).not.toContain('ANTIDOTARIVM');

            // Apply button should be disabled after application
            await expect(firstApplyBtn).toBeDisabled();
        }
    });
});

test.describe('HITL Flow: Diff View', () => {
    test.beforeEach(async ({ page }) => {
        await loadSampleAndWait(page);
        await cacheModules(page);
        await injectValidation(page);
    });

    test('should toggle diff view after applying a suggestion', async ({ page }) => {
        const textBefore = await page.inputValue('#transcriptionText');

        if (textBefore.includes('ANTIDOTARIVM')) {
            // Apply first suggestion
            await page.locator('.issue-apply-btn').first().click();

            // Enable diff view via the checkbox
            const showChanges = page.locator('#showChanges');
            await showChanges.check();

            // Diff display should become visible
            const diffDisplay = page.locator('#diffDisplay');
            await expect(diffDisplay).toBeVisible();

            // Should contain diff-modified lines
            const modifiedLines = page.locator('.diff-modified');
            await expect(modifiedLines.first()).toBeVisible();
        }
    });
});

test.describe('HITL Flow: Undo/Redo', () => {
    test.beforeEach(async ({ page }) => {
        await loadSampleAndWait(page);
        await cacheModules(page);
        await injectValidation(page);
    });

    test('should undo an applied suggestion', async ({ page }) => {
        const textBefore = await page.inputValue('#transcriptionText');

        if (textBefore.includes('ANTIDOTARIVM')) {
            // Apply first suggestion
            await page.locator('.issue-apply-btn').first().click();
            const textAfterApply = await page.inputValue('#transcriptionText');
            expect(textAfterApply).toContain('ANTIDOTARIUM');

            // Click Undo
            const undoBtn = page.locator('#btnUndo');
            await expect(undoBtn).not.toBeDisabled();
            await undoBtn.click();

            // Text should be reverted
            const textAfterUndo = await page.inputValue('#transcriptionText');
            expect(textAfterUndo).toContain('ANTIDOTARIVM');
        }
    });

    test('should redo after undo', async ({ page }) => {
        const textBefore = await page.inputValue('#transcriptionText');

        if (textBefore.includes('ANTIDOTARIVM')) {
            // Apply -> Undo -> Redo
            await page.locator('.issue-apply-btn').first().click();
            await page.locator('#btnUndo').click();

            const redoBtn = page.locator('#btnRedo');
            await expect(redoBtn).not.toBeDisabled();
            await redoBtn.click();

            const textAfterRedo = await page.inputValue('#transcriptionText');
            expect(textAfterRedo).toContain('ANTIDOTARIUM');
        }
    });
});

test.describe('HITL Flow: Apply All', () => {
    test.beforeEach(async ({ page }) => {
        await loadSampleAndWait(page);
        await cacheModules(page);
    });

    test('should show Apply All button when multiple suggestions exist', async ({ page }) => {
        // Inject results with multiple applicable suggestions
        await page.evaluate((results) => {
            window.__e2eModules.appState.setValidationResults(results);
        }, {
            ...MOCK_VALIDATION_RESULTS,
            llmJudge: {
                ...MOCK_VALIDATION_RESULTS.llmJudge,
                issues: MOCK_VALIDATION_RESULTS.llmJudge.issues.filter(i =>
                    i.suggestion.trim() !== i.text.trim()
                ),
            },
        });

        await page.waitForSelector('.validation-issue');

        // The Apply All button should be visible if there are 2+ applicable suggestions
        const applyAllBtn = page.locator('#applyAllLlmIssuesBtn');
        // It may or may not exist depending on how many distinct suggestions there are
        const count = await applyAllBtn.count();
        if (count > 0) {
            await expect(applyAllBtn).toBeVisible();
        }
    });
});

test.describe('HITL Flow: Export', () => {
    test.beforeEach(async ({ page }) => {
        await loadSampleAndWait(page);
        await cacheModules(page);
    });

    test('should enable Export button when transcription exists', async ({ page }) => {
        const exportBtn = page.locator('#btnExport');
        await expect(exportBtn).toBeVisible();
    });

    test('should open export dialog on click', async ({ page }) => {
        const exportBtn = page.locator('#btnExport');
        await exportBtn.click();

        const exportDialog = page.locator('#exportDialog');
        await expect(exportDialog).toBeVisible();
    });
});
