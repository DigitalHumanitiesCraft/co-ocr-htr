/**
 * A new LLM transcription must not silently replace an existing one: the
 * corrections in it are not recoverable through undo afterwards.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../js/services/storage.js', () => ({
  storage: {
    loadSettings: vi.fn(() => ({ autoSave: false })),
    saveSettings: vi.fn()
  }
}));

vi.mock('../js/components/dialogs.js', () => ({
  dialogManager: {
    showConfirm: vi.fn(),
    showToast: vi.fn(),
    openDialog: vi.fn()
  }
}));

import { appState } from '../js/state.js';
import { llmService } from '../js/services/llm.js';
import { dialogManager } from '../js/components/dialogs.js';
import { transcriptionManager } from '../js/components/transcription.js';

describe('handleTranscribe with an existing transcription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(llmService, 'hasApiKey').mockReturnValue(true);
    vi.spyOn(llmService, 'transcribe').mockResolvedValue({ provider: 'gemini', model: 'm', raw: 'new text' });
    vi.spyOn(transcriptionManager, 'getImageBase64').mockResolvedValue('base64');
    transcriptionManager.transcribeDialog = { close: vi.fn() };
    appState.setPages([]);
    appState.setTranscription({ provider: 'page-xml', model: 'import', raw: 'corrected line' });
  });

  it('should keep the existing text when the user declines to replace it', async () => {
    dialogManager.showConfirm.mockResolvedValue(false);

    await transcriptionManager.handleTranscribe();

    expect(dialogManager.showConfirm).toHaveBeenCalledTimes(1);
    expect(llmService.transcribe).not.toHaveBeenCalled();
    expect(appState.getState().transcription.raw).toBe('corrected line');
  });

  it('should replace the text after confirmation', async () => {
    dialogManager.showConfirm.mockResolvedValue(true);

    await transcriptionManager.handleTranscribe();

    expect(appState.getState().transcription.raw).toBe('new text');
  });
});
