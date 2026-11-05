/**
 * Only offer image types the browser can display. TIFF was accepted and then
 * failed with "Failed to load image".
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../js/services/storage.js', () => ({
  storage: { loadSettings: vi.fn(() => ({ autoSave: false })), saveSettings: vi.fn() }
}));
vi.mock('../js/components/dialogs.js', () => ({ dialogManager: { showToast: vi.fn() } }));
vi.mock('../js/viewer.js', () => ({ loadIIIFManifest: vi.fn() }));

import { uploadManager } from '../js/components/upload.js';

describe('isImageFile', () => {
  it('should reject TIFF and accept browser-decodable formats', () => {
    expect(uploadManager.isImageFile(new File([''], 'scan.tif', { type: 'image/tiff' }))).toBe(false);
    expect(uploadManager.isImageFile(new File([''], 'scan.tiff', { type: '' }))).toBe(false);
    expect(uploadManager.isImageFile(new File([''], 'scan.png', { type: 'image/png' }))).toBe(true);
    expect(uploadManager.isImageFile(new File([''], 'scan.webp', { type: 'image/webp' }))).toBe(true);
  });
});
