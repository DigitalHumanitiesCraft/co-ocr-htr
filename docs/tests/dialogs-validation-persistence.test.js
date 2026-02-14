import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

vi.mock('../js/services/storage.js', () => ({
  storage: {
    loadSettings: vi.fn(() => ({})),
    saveSettings: vi.fn(),
    saveApiKey: vi.fn().mockResolvedValue(undefined),
    deleteApiKey: vi.fn().mockResolvedValue(undefined),
    saveValidationProviderConfig: vi.fn(),
    clearValidationProviderConfig: vi.fn(),
    loadAllApiKeys: vi.fn().mockResolvedValue({}),
    loadValidationProviderConfig: vi.fn().mockResolvedValue(null),
    loadApiKey: vi.fn().mockResolvedValue(null)
  }
}));

vi.mock('../js/services/llm.js', () => ({
  llmService: {
    providers: {
      gemini: { apiKey: null },
      openai: { apiKey: null },
      anthropic: { apiKey: null },
      mistral: { apiKey: null },
      ollama: { apiKey: null }
    },
    activeProvider: 'gemini',
    setProvider: vi.fn(),
    setModel: vi.fn(),
    setApiKey: vi.fn(),
    setValidationProvider: vi.fn(),
    setValidationApiKey: vi.fn(),
    clearValidationProvider: vi.fn(),
    getValidationProvider: vi.fn(() => null),
    isOcrOnlyModel: vi.fn(() => true),
    getCurrentModel: vi.fn(() => 'mistral-ocr-latest'),
    hasValidationProviderConfigured: vi.fn(() => false)
  }
}));

vi.mock('../js/state.js', () => ({
  appState: {
    closeDialog: vi.fn(),
    openDialog: vi.fn(),
    isMultiPage: vi.fn(() => false),
    getPageCount: vi.fn(() => 1),
    data: { pageTranscriptions: {}, project: {} }
  }
}));

vi.mock('../js/viewer.js', () => ({
  loadIIIFManifest: vi.fn()
}));

import { storage } from '../js/services/storage.js';
import { llmService } from '../js/services/llm.js';

let dialogManager;

function setupDom() {
  document.body.innerHTML = `
    <select id="llmModel">
      <option value="mistral-ocr-latest" selected>Mistral OCR</option>
    </select>
    <input id="llmModelCustom" type="text" />
    <input id="llmApiKey" type="password" value="" />
    <input id="ollamaEndpoint" type="text" value="http://localhost:11434" />
    <input id="apiKeyPersist" type="checkbox" />

    <div id="validationProviderSection"></div>
    <select id="validationModel">
      <option value="gemini-3-flash-preview" data-provider="gemini" selected>Gemini</option>
    </select>
    <input id="validationApiKey" type="password" value="" />
    <input id="validationApiKeyPersist" type="checkbox" />
  `;
}

describe('Dialog validation key persistence regressions', () => {
  beforeAll(async () => {
    // Provide required dialogs before module auto-init runs.
    document.body.innerHTML = `
      <dialog id="apiKeyDialog"></dialog>
      <dialog id="exportDialog"></dialog>
      <div id="toastContainer"></div>
    `;

    const dialogsModule = await import('../js/components/dialogs.js');
    dialogManager = dialogsModule.dialogManager;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    setupDom();

    // Avoid unrelated DOM side effects in this focused unit test.
    dialogManager.showToast = vi.fn();
    dialogManager.closeDialog = vi.fn();
    dialogManager.updateModelIndicatorWithValidation = vi.fn();
  });

  it('deletes persisted validation key when persist is unchecked even if input is empty', async () => {
    await dialogManager.saveApiKeysWithValidation();

    expect(llmService.setValidationProvider).toHaveBeenCalledWith('gemini', 'gemini-3-flash-preview');
    expect(llmService.setValidationApiKey).not.toHaveBeenCalled();
    expect(storage.deleteApiKey).toHaveBeenCalledTimes(1);
    expect(storage.deleteApiKey).toHaveBeenCalledWith('gemini', true);
  });
});
