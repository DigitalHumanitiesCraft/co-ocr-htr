/**
 * Transcription Component
 *
 * Handles the transcription workflow:
 * 1. User clicks "Transcribe" button
 * 2. Validates document is loaded and API key is configured
 * 3. Calls LLM service with image
 * 4. Parses response and updates state
 * 5. Editor reflects the new transcription
 */

import { llmService } from '../services/llm.js';
import { appState } from '../state.js';
import { dialogManager } from './dialogs.js';

/**
 * Transcription Manager
 */
class TranscriptionManager {
    constructor() {
        this.transcribeBtn = null;
        this.isTranscribing = false;
    }

    /**
     * Initialize transcription functionality
     */
    init() {
        this.transcribeBtn = document.getElementById('btnTranscribe');
        if (!this.transcribeBtn) {
            console.warn('Transcribe button not found');
            return;
        }

        this.bindEvents();
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        this.transcribeBtn.addEventListener('click', () => this.handleTranscribe());

        // Listen for state changes
        appState.addEventListener('documentLoaded', () => {
            this.updateButtonState();
        });

        appState.addEventListener('transcriptionComplete', () => {
            this.setLoading(false);
        });
    }

    /**
     * Handle transcribe button click
     */
    async handleTranscribe() {
        if (this.isTranscribing) return;

        // Validate document is loaded
        const state = appState.getState();
        if (!state.document.dataUrl && state.image.url === 'assets/mock-document.jpg') {
            dialogManager.showToast('Please upload a document first', 'warning');
            return;
        }

        // Validate API key is configured
        if (!llmService.hasApiKey()) {
            const provider = llmService.activeProvider;
            if (provider !== 'ollama') {
                dialogManager.showToast(`Please configure ${provider} API key first`, 'warning');
                // Open API key dialog
                dialogManager.openDialog('apiKey');
                return;
            }
        }

        // Start transcription
        this.setLoading(true);

        try {
            // Get image as base64 (without data URL prefix)
            const imageUrl = state.document.dataUrl || state.image.url;
            const base64 = await this.getImageBase64(imageUrl);

            // Get document type from UI
            const documentTypeSelect = document.getElementById('documentType');
            const documentType = documentTypeSelect?.value || 'table';

            // Call LLM service with document type
            const result = await llmService.transcribe(base64, { documentType });

            // Update state with transcription
            appState.setTranscription({
                provider: result.provider,
                model: result.model,
                raw: result.raw,
                segments: result.segments,
                columns: result.columns
            });

            dialogManager.showToast(
                `Transcribed ${result.segments.length} lines with ${result.provider}`,
                'success'
            );

        } catch (error) {
            console.error('Transcription error:', error);

            // Handle specific error types
            if (error.type === 'auth') {
                dialogManager.showToast('Invalid API key. Please check your configuration.', 'error');
                dialogManager.openDialog('apiKey');
            } else if (error.type === 'rate_limit') {
                dialogManager.showToast('Rate limit exceeded. Please wait and try again.', 'warning');
            } else if (error.type === 'network') {
                dialogManager.showToast('Network error. Please check your connection.', 'error');
            } else {
                dialogManager.showToast(`Transcription failed: ${error.message}`, 'error');
            }

            this.setLoading(false);
        }
    }

    /**
     * Get image as base64 string (without data URL prefix)
     * @param {string} url - Image URL or data URL
     * @returns {Promise<string>} Base64 string
     */
    async getImageBase64(url) {
        // If already a data URL, extract base64 part
        if (url.startsWith('data:')) {
            const base64 = url.split(',')[1];
            return base64;
        }

        // Load image and convert to base64
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                // Get base64 (without data URL prefix)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                const base64 = dataUrl.split(',')[1];
                resolve(base64);
            };

            img.onerror = () => {
                reject(new Error('Failed to load image'));
            };

            img.src = url;
        });
    }

    /**
     * Set loading state
     * @param {boolean} loading - Whether loading
     */
    setLoading(loading) {
        this.isTranscribing = loading;

        if (!this.transcribeBtn) return;

        const btnText = this.transcribeBtn.querySelector('.btn-text');
        const btnSpinner = this.transcribeBtn.querySelector('.btn-spinner');

        if (loading) {
            this.transcribeBtn.disabled = true;
            this.transcribeBtn.classList.add('loading');
            if (btnText) btnText.hidden = true;
            if (btnSpinner) btnSpinner.hidden = false;
            appState.setLoading(true, 'Transcribing...');
        } else {
            this.transcribeBtn.disabled = false;
            this.transcribeBtn.classList.remove('loading');
            if (btnText) btnText.hidden = false;
            if (btnSpinner) btnSpinner.hidden = true;
            appState.setLoading(false);
        }
    }

    /**
     * Update button state based on app state
     */
    updateButtonState() {
        if (!this.transcribeBtn) return;

        const state = appState.getState();
        const hasDocument = state.document.dataUrl ||
            (state.image.url && state.image.url !== 'assets/mock-document.jpg');

        // Button is enabled if we have a document
        // (API key check happens on click)
        this.transcribeBtn.disabled = !hasDocument || this.isTranscribing;
    }
}

// Add spinner animation CSS
const spinnerStyles = `
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.btn .spinner {
    width: 16px;
    height: 16px;
    animation: spin 1s linear infinite;
}

.btn.loading {
    pointer-events: none;
    opacity: 0.8;
}

.btn-spinner {
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.btn-sm {
    padding: 6px 12px;
    font-size: var(--text-sm);
}
`;

// Inject styles
function injectStyles() {
    if (document.getElementById('transcriptionStyles')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'transcriptionStyles';
    styleEl.textContent = spinnerStyles;
    document.head.appendChild(styleEl);
}

// Export singleton instance
export const transcriptionManager = new TranscriptionManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        injectStyles();
        transcriptionManager.init();
    });
} else {
    injectStyles();
    transcriptionManager.init();
}
