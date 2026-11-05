/**
 * Tests for line alignment between transcription versions
 */

import { describe, it, expect } from 'vitest';
import { alignLines, diffLines } from '../js/utils/lineAlign.js';

describe('alignLines', () => {
  it('should map unchanged lines to themselves', () => {
    expect(alignLines(['a', 'b', 'c'], ['a', 'b', 'c'])).toEqual([0, 1, 2]);
  });

  it('should keep in-place edits paired with their old line', () => {
    expect(alignLines(['a', 'b', 'c'], ['a', 'B', 'c'])).toEqual([0, 1, 2]);
  });

  it('should give an inserted line no predecessor and keep later lines on their own origin', () => {
    expect(alignLines(['a', 'b', 'c'], ['a', 'new', 'b', 'c'])).toEqual([0, -1, 1, 2]);
  });

  it('should follow lines across a deletion', () => {
    expect(alignLines(['a', 'b', 'c', 'd'], ['a', 'c', 'd'])).toEqual([0, 2, 3]);
  });

  it('should drop geometry for an edit adjacent to an insertion', () => {
    expect(alignLines(['a', 'b', 'c'], ['a', 'B1', 'B2', 'c'])).toEqual([0, -1, -1, 2]);
  });

  it('should handle empty inputs', () => {
    expect(alignLines([], ['a'])).toEqual([-1]);
    expect(alignLines(['a'], [])).toEqual([]);
  });
});

describe('diffLines', () => {
  it('should report an inserted line as added and keep later lines unchanged', () => {
    expect(diffLines(['a', 'b'], ['x', 'a', 'b']).map(r => r.type)).toEqual(['added', 'same', 'same']);
  });

  it('should report a removed line as deleted and an edited line as modified', () => {
    expect(diffLines(['a', 'b', 'c'], ['a', 'c']).map(r => r.type)).toEqual(['same', 'deleted', 'same']);
    expect(diffLines(['a', 'b', 'c'], ['a', 'B', 'c']).map(r => r.type)).toEqual(['same', 'modified', 'same']);
  });
});
