/**
 * Tests for line alignment between transcription versions
 */

import { describe, it, expect } from 'vitest';
import { alignLines } from '../js/utils/lineAlign.js';

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
