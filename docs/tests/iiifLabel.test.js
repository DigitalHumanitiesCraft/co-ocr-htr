import { describe, it, expect } from 'vitest';
import { iiifLabel } from '../js/utils/iiifLabel.js';

describe('iiifLabel', () => {
  it('should read Presentation 3 language maps, including the "none" key', () => {
    expect(iiifLabel({ en: ['Letter'] })).toBe('Letter');
    expect(iiifLabel({ none: ['Al-Muqtataf 1'] })).toBe('Al-Muqtataf 1');
  });

  it('should read Presentation 2 strings and value lists', () => {
    expect(iiifLabel('fol. 1r')).toBe('fol. 1r');
    expect(iiifLabel([{ '@value': 'fol. 2v', '@language': 'la' }])).toBe('fol. 2v');
  });

  it('should fall back when there is no label', () => {
    expect(iiifLabel(undefined, 'Page 3')).toBe('Page 3');
    expect(iiifLabel({}, 'Page 3')).toBe('Page 3');
  });
});
