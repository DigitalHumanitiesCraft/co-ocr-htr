/**
 * The LLM review toggle is unchecked and disabled while no key exists. Once a
 * key is configured it must be checked again, or validation silently runs
 * the rules only.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../js/services/storage.js', () => ({
  storage: {
    loadSettings: vi.fn(() => ({ autoSave: false })),
    saveSettings: vi.fn(),
    loadValidationPrompt: vi.fn(() => ''),
    saveValidationPrompt: vi.fn()
  }
}));
vi.mock('../js/components/dialogs.js', () => ({
  dialogManager: { showToast: vi.fn(), openDialog: vi.fn(), showConfirm: vi.fn() }
}));
vi.mock('../js/viewer.js', () => ({ loadIIIFManifest: vi.fn() }));

import { llmService } from '../js/services/llm.js';
import { validationPanel } from '../js/components/validation.js';

describe('updateLLMModeHint', () => {
  it('should re-check the LLM review once a key is available', () => {
    document.body.innerHTML = `
      <div id="llmModeItem"></div>
      <p id="llmModeHint"></p>
      <input type="checkbox" id="enableLLM" checked>
    `;
    const hasKey = vi.spyOn(llmService, 'hasApiKey').mockReturnValue(false);
    validationPanel.updateLLMModeHint();
    expect(document.getElementById('enableLLM').checked).toBe(false);

    hasKey.mockReturnValue(true);
    validationPanel.updateLLMModeHint();
    const box = document.getElementById('enableLLM');
    expect(box.disabled).toBe(false);
    expect(box.checked).toBe(true);
  });

  it('should keep a deliberate uncheck while a key exists', () => {
    document.body.innerHTML = `
      <div id="llmModeItem"></div>
      <p id="llmModeHint"></p>
      <input type="checkbox" id="enableLLM">
    `;
    vi.spyOn(llmService, 'hasApiKey').mockReturnValue(true);
    validationPanel.updateLLMModeHint();
    expect(document.getElementById('enableLLM').checked).toBe(false);
  });
});
