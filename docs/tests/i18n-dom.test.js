/**
 * Real i18n module: the document language must follow the UI language, because
 * screen readers pick their voice and hyphenation from <html lang>.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dictionary = (lang) => JSON.parse(readFileSync(join(process.cwd(), 'i18n', `${lang}.json`), 'utf8'));

describe('i18n document language', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'en';
    globalThis.fetch = vi.fn(async (url) => {
      const lang = String(url).match(/(en|de)\.json/)[1];
      return { ok: true, json: async () => dictionary(lang) };
    });
  });

  it('should set <html lang> on init and on every language switch', async () => {
    vi.resetModules();
    const { i18n } = await import('../js/services/i18n.js');

    await i18n.init('en');
    expect(document.documentElement.lang).toBe('en');

    await i18n.setLang('de');
    expect(document.documentElement.lang).toBe('de');
  });

  it('should pick the German plural form instead of appending an English "s"', async () => {
    vi.resetModules();
    const { i18n } = await import('../js/services/i18n.js');
    await i18n.init('de');

    expect(i18n.t('dynamic.linesChanged', { count: 1 })).toBe('1 Zeile geändert');
    expect(i18n.t('dynamic.linesChanged', { count: 2 })).toBe('2 Zeilen geändert');
    expect(i18n.t('dynamic.daysAgo', { count: 3 })).toBe('Vor 3 Tagen');

    await i18n.setLang('en');
    expect(i18n.t('dynamic.issueCount', { count: 1 })).toBe('1 issue');
  });
});
