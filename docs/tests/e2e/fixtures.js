/**
 * Shared Playwright test with a safety net: the dev server serves docs/, where
 * a gitignored config.local.js may hold real API keys that the app loads on
 * start. Every spec imports `test` from here so that file is never served and
 * no request reaches an LLM provider. Specs that need provider responses mock
 * them with their own page.route, which takes precedence over these routes.
 */
import { test as base, expect } from '@playwright/test';

const LLM_HOSTS = [
    'generativelanguage.googleapis.com',
    'api.openai.com',
    'api.anthropic.com',
    'api.mistral.ai',
    'openai.azure.com',
    'services.ai.azure.com',
    'localhost:11434',
];

export const test = base.extend({
    context: async ({ context }, use) => {
        await context.route('**/config.local.js', route => route.fulfill({ status: 404, body: '' }));
        await context.route(url => LLM_HOSTS.some(host => url.host.includes(host)), route => route.abort());
        await use(context);
    },
});

export { expect };
