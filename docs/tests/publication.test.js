/**
 * GitHub Pages serves docs/ as it is. Project knowledge (knowledge/, journal,
 * plans) must not be served; readers find it in the repository on GitHub.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const SKIP = new Set(['node_modules', 'test-results', 'playwright-report', 'tests']);

function servedFiles(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (SKIP.has(entry.name) || entry.name.startsWith('.')) return [];
    const rel = prefix + entry.name;
    return entry.isDirectory() ? servedFiles(join(dir, entry.name), rel + '/') : [rel];
  });
}

describe('published site', () => {
  it('should serve no Markdown knowledge documents', () => {
    // Vitest runs from docs/
    const markdown = servedFiles(process.cwd()).filter(file => file.endsWith('.md'));
    expect(markdown).toEqual([]);
  });
});
