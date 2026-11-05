/**
 * Text colour tokens must reach WCAG 2.2 AA (4.5:1) on every light background
 * token they are drawn on.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(process.cwd(), 'css', 'variables.css'), 'utf8');
const token = (name) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))[1];

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = ['text-primary', 'text-secondary', 'confident-text', 'uncertain-text', 'problematic-text'];
const BACKGROUNDS = ['bg-primary', 'bg-secondary', 'bg-tertiary', 'bg-viewer'];

describe('colour contrast of text tokens', () => {
  for (const text of TEXT) {
    it(`--${text} reaches 4.5:1 on all light backgrounds`, () => {
      for (const bg of BACKGROUNDS) {
        expect(ratio(token(text), token(bg)), `${text} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
