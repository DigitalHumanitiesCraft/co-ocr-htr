/**
 * Error and warning toasts must stay long enough to be read; success and info
 * toasts may vanish quickly.
 */

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';

vi.mock('../js/services/storage.js', () => ({
  storage: {
    loadSettings: vi.fn(() => ({})),
    saveSettings: vi.fn(),
    loadAllApiKeys: vi.fn().mockResolvedValue({}),
    loadValidationProviderConfig: vi.fn().mockResolvedValue(null),
    loadApiKey: vi.fn().mockResolvedValue(null)
  }
}));
vi.mock('../js/viewer.js', () => ({ loadIIIFManifest: vi.fn() }));

let dialogManager;

beforeAll(async () => {
  document.body.innerHTML = '<div id="toastContainer"></div>';
  ({ dialogManager } = await import('../js/components/dialogs.js'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('showToast default duration', () => {
  it('should keep an error toast after five seconds and drop a success toast', () => {
    vi.useFakeTimers();
    const removed = vi.spyOn(dialogManager, 'removeToast').mockImplementation(() => {});

    dialogManager.showToast('Fehler', 'error');
    dialogManager.showToast('Fertig', 'success');
    vi.advanceTimersByTime(5000);

    const removedTypes = removed.mock.calls.map(([el]) => el.classList.contains('toast-error') ? 'error' : 'other');
    expect(removedTypes).toEqual(['other']);
  });
});
