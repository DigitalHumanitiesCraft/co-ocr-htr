/**
 * Guards the published docs/knowledge/ copy against drifting from knowledge/.
 */
import { describe, it, expect } from 'vitest';
import { checkProjection } from '../scripts/sync-knowledge.js';

describe('docs/knowledge projection', () => {
    it('is byte-identical to the documents knowledge.html offers', () => {
        expect(checkProjection()).toEqual([]);
    });
});
