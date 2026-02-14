import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../js/state.js', () => ({
  appState: {
    getDocumentContext: vi.fn(() => null)
  }
}));

import { appState } from '../js/state.js';
import { contextManager } from '../js/components/context.js';

describe('contextManager.buildPromptContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses structured languages[] when available', () => {
    appState.getDocumentContext.mockReturnValue({
      languages: ['latin', 'middle high german'],
      language: 'ignored fallback'
    });

    const result = contextManager.buildPromptContext();
    expect(result).toContain('Language(s): latin, middle high german.');
    expect(result).not.toContain('ignored fallback');
  });

  it('falls back to legacy language string when languages[] is empty', () => {
    appState.getDocumentContext.mockReturnValue({
      languages: [],
      language: 'Latin, German'
    });

    const result = contextManager.buildPromptContext();
    expect(result).toContain('Language(s): Latin, German.');
  });
});

