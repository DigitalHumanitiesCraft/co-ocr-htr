/**
 * Upload Component
 *
 * Handles file uploads via button click and drag & drop.
 * Supports images (JPG, PNG, TIFF), PAGE-XML, and METS-XML files.
 */

import { appState } from '../state.js';
import { dialogManager } from './dialogs.js';
import { metsXMLParser } from '../services/parsers/mets-xml.js';

// Supported file types
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/tiff', 'image/webp'];
const SUPPORTED_XML_TYPES = ['text/xml', 'application/xml'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Upload Manager
 * Handles file upload logic and drag & drop
 */
class UploadManager {
    constructor() {
        this.dropZone = null;
        this.fileInput = null;
        this.isDragging = false;
    }

    /**
     * Initialize upload functionality
     */
    init() {
        this.createFileInput();
        this.bindEvents();
        this.setupDropZone();
    }

    /**
     * Create hidden file input element
     */
    createFileInput() {
        // Check if already exists
        this.fileInput = document.getElementById('fileInput');
        if (this.fileInput) return;

        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.id = 'fileInput';
        this.fileInput.accept = [...SUPPORTED_IMAGE_TYPES, '.xml'].join(',');
        this.fileInput.style.display = 'none';
        document.body.appendChild(this.fileInput);
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // File input change
        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) {
                this.handleFile(file);
            }
            // Reset input so same file can be selected again
            e.target.value = '';
        });

        // Upload button
        const uploadBtn = document.getElementById('btnUpload');
        if (uploadBtn) {
            uploadBtn.onclick = (e) => {
                e.preventDefault();
                this.openFilePicker();
            };
        }

        // Drop zone indicator click - open file picker
        const dropZoneIndicator = document.querySelector('.drop-zone-indicator');
        if (dropZoneIndicator) {
            dropZoneIndicator.addEventListener('click', (e) => {
                e.preventDefault();
                this.openFilePicker();
            });
        }
    }

    /**
     * Setup drop zone on the document viewer
     */
    setupDropZone() {
        // Use the panel content area as drop zone
        this.dropZone = document.querySelector('.panel-content');
        this.emptyState = document.getElementById('viewerEmptyState');

        if (!this.dropZone) {
            console.warn('Drop zone element not found');
            return;
        }

        // Prevent default drag behaviors on document
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        // Highlight drop zone when dragging over
        ['dragenter', 'dragover'].forEach(eventName => {
            this.dropZone.addEventListener(eventName, (e) => {
                if (!this.isDragging) {
                    this.isDragging = true;
                    this.showDropFeedback();
                }
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            this.dropZone.addEventListener(eventName, (e) => {
                // Only hide if we're leaving the drop zone entirely
                if (eventName === 'dragleave') {
                    const rect = this.dropZone.getBoundingClientRect();
                    const x = e.clientX;
                    const y = e.clientY;
                    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                        this.isDragging = false;
                        this.hideDropFeedback();
                    }
                } else {
                    this.isDragging = false;
                    this.hideDropFeedback();
                }
            }, false);
        });

        // Handle drop
        this.dropZone.addEventListener('drop', (e) => {
            const file = e.dataTransfer?.files?.[0];
            if (file) {
                this.handleFile(file);
            }
        }, false);
    }

    /**
     * Show drop feedback - highlight empty state or show overlay
     */
    showDropFeedback() {
        // If empty state is visible, add dragging class
        if (this.emptyState && !this.emptyState.classList.contains('hidden')) {
            this.emptyState.classList.add('dragging');
        } else {
            // Show overlay for when document is loaded
            this.showDropOverlay();
        }
    }

    /**
     * Hide drop feedback
     */
    hideDropFeedback() {
        // Remove dragging class from empty state
        if (this.emptyState) {
            this.emptyState.classList.remove('dragging');
        }
        // Hide overlay
        this.hideDropOverlay();
    }

    /**
     * Show drop overlay
     */
    showDropOverlay() {
        // Check if overlay already exists
        let overlay = document.getElementById('dropOverlay');
        if (overlay) {
            overlay.classList.add('visible');
            return;
        }

        // Create overlay
        overlay = document.createElement('div');
        overlay.id = 'dropOverlay';
        overlay.className = 'drop-overlay';
        overlay.innerHTML = `
            <div class="drop-overlay-content">
                <svg class="drop-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <p>Drop file to upload</p>
                <span class="drop-hint">Images (JPG, PNG, TIFF), PAGE-XML, or METS-XML</span>
            </div>
        `;

        this.dropZone.appendChild(overlay);
        // Trigger animation
        requestAnimationFrame(() => overlay.classList.add('visible'));
    }

    /**
     * Hide drop overlay
     */
    hideDropOverlay() {
        const overlay = document.getElementById('dropOverlay');
        if (overlay) {
            overlay.classList.remove('visible');
        }
    }

    /**
     * Open file picker dialog
     */
    openFilePicker() {
        this.fileInput?.click();
    }

    /**
     * Handle uploaded file
     * @param {File} file - The uploaded file
     */
    async handleFile(file) {
        // Validate file
        const validation = this.validateFile(file);
        if (!validation.valid) {
            dialogManager.showToast(validation.error, 'error');
            return;
        }

        // Show loading state
        appState.setLoading(true, 'Loading file...');

        try {
            if (this.isImageFile(file)) {
                await this.handleImageFile(file);
            } else if (this.isXMLFile(file)) {
                await this.handleXMLFile(file);
            }
        } catch (error) {
            console.error('Error handling file:', error);
            dialogManager.showToast(`Failed to load file: ${error.message}`, 'error');
        } finally {
            appState.setLoading(false);
        }
    }

    /**
     * Validate file before processing
     * @param {File} file - The file to validate
     * @returns {object} Validation result
     */
    validateFile(file) {
        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            return { valid: false, error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` };
        }

        // Check file type
        const isImage = this.isImageFile(file);
        const isXML = this.isXMLFile(file);

        if (!isImage && !isXML) {
            return { valid: false, error: 'Unsupported file type. Use JPG, PNG, TIFF, or PAGE-XML.' };
        }

        return { valid: true };
    }

    /**
     * Check if file is an image
     * @param {File} file - The file to check
     */
    isImageFile(file) {
        return SUPPORTED_IMAGE_TYPES.includes(file.type) ||
            /\.(jpg|jpeg|png|tiff?|webp)$/i.test(file.name);
    }

    /**
     * Check if file is XML
     * @param {File} file - The file to check
     */
    isXMLFile(file) {
        return SUPPORTED_XML_TYPES.includes(file.type) ||
            /\.xml$/i.test(file.name);
    }

    /**
     * Handle image file upload
     * @param {File} file - The image file
     */
    async handleImageFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const dataUrl = e.target.result;

                // Get image dimensions
                const img = new Image();
                img.onload = () => {
                    appState.setDocument(file, dataUrl);
                    appState.setImageDimensions(img.width, img.height);

                    // Hide demo indicator when user uploads their own file
                    this.hideDemoIndicator();

                    dialogManager.showToast(`Loaded: ${file.name}`, 'success');
                    resolve();
                };
                img.onerror = () => {
                    reject(new Error('Failed to load image'));
                };
                img.src = dataUrl;
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsDataURL(file);
        });
    }

    /**
     * Hide demo indicator (user uploaded their own document)
     */
    hideDemoIndicator() {
        const demoIndicator = document.getElementById('demoIndicator');
        if (demoIndicator) {
            demoIndicator.style.display = 'none';
        }
        appState.isDemo = false;
    }

    /**
     * Handle XML file upload
     * @param {File} file - The XML file
     */
    async handleXMLFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                const xmlString = e.target.result;

                try {
                    // Check if it's a METS-XML file
                    if (metsXMLParser.isMetsXML(xmlString)) {
                        await this.handleMETSFile(file, xmlString);
                        resolve();
                        return;
                    }

                    // Check if it's a PAGE-XML file
                    if (xmlString.includes('PcGts') || xmlString.includes('page/2019')) {
                        // Dispatch event for PAGE-XML parser to handle
                        const event = new CustomEvent('pageXMLLoaded', {
                            detail: { filename: file.name, content: xmlString }
                        });
                        document.dispatchEvent(event);

                        // Hide demo indicator when user uploads their own file
                        this.hideDemoIndicator();

                        dialogManager.showToast(`Loaded PAGE-XML: ${file.name}`, 'success');
                        resolve();
                        return;
                    }

                    // Unknown XML format
                    dialogManager.showToast('Not a valid PAGE-XML or METS-XML file', 'warning');
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read XML file'));
            };

            reader.readAsText(file);
        });
    }

    /**
     * Handle METS-XML file upload
     * @param {File} file - The METS-XML file
     * @param {string} xmlString - The XML content
     */
    async handleMETSFile(file, xmlString) {
        try {
            // Parse METS-XML
            const metsData = metsXMLParser.parse(xmlString);

            if (metsData.pages.length === 0) {
                dialogManager.showToast('METS-XML contains no page references', 'warning');
                return;
            }

            // Set pages in state for multi-page navigation
            const pages = metsData.pages.map((page, index) => ({
                id: page.id,
                order: page.order,
                image: page.image,
                thumbnail: page.thumbnail,
                width: page.width,
                height: page.height,
                label: `Page ${page.order}`
            }));

            // Set pages in state
            appState.setPages(pages);

            // Set metadata
            if (metsData.metadata) {
                appState.data.meta.mets = metsData.metadata;
                appState.data.meta.title = metsData.metadata.title || file.name;
            }

            // Hide demo indicator
            this.hideDemoIndicator();

            dialogManager.showToast(
                `Loaded METS: ${metsData.metadata.title || file.name} (${pages.length} pages)`,
                'success'
            );

        } catch (error) {
            console.error('METS-XML parsing error:', error);
            dialogManager.showToast(`Failed to parse METS-XML: ${error.message}`, 'error');
        }
    }
}

// Add CSS for drop overlay
const dropOverlayStyles = `
.drop-overlay {
    position: absolute;
    inset: 0;
    background: rgba(var(--bg-rgb), 0.9);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s, visibility 0.2s;
    border: 2px dashed var(--accent-primary);
    border-radius: var(--radius-md);
    margin: var(--space-2);
}

.drop-overlay.visible {
    opacity: 1;
    visibility: visible;
}

.drop-overlay-content {
    text-align: center;
    color: var(--text-primary);
}

.drop-icon {
    width: 48px;
    height: 48px;
    margin-bottom: var(--space-4);
    color: var(--accent-primary);
}

.drop-overlay-content p {
    font-size: var(--text-lg);
    font-weight: 500;
    margin-bottom: var(--space-2);
}

.drop-hint {
    font-size: var(--text-sm);
    color: var(--text-secondary);
}
`;

// Inject styles
function injectStyles() {
    if (document.getElementById('uploadStyles')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'uploadStyles';
    styleEl.textContent = dropOverlayStyles;
    document.head.appendChild(styleEl);
}

// Export singleton instance
export const uploadManager = new UploadManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        injectStyles();
        uploadManager.init();
    });
} else {
    injectStyles();
    uploadManager.init();
}
