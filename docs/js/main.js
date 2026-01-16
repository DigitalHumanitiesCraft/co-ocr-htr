/**
 * coOCR/HTR - Application Entry Point
 *
 * Initializes all components and services.
 */

// Components
import { initViewer } from './viewer.js';
import { initEditor } from './editor.js';
import { initUI } from './ui.js';
import { dialogManager } from './components/dialogs.js';
import { uploadManager } from './components/upload.js';
import { transcriptionManager } from './components/transcription.js';
import { validationPanel } from './components/validation.js';

// Services
import { storage } from './services/storage.js';
import { llmService } from './services/llm.js';
import { exportService } from './services/export.js';
import { pageXMLParser } from './services/parsers/page-xml.js';
import { samplesService } from './services/samples.js';
import { appState } from './state.js';

/**
 * Initialize the application
 */
async function initApp() {
    console.log('coOCR/HTR: Initializing...');

    // Load saved settings
    const settings = storage.loadSettings();

    // Configure LLM service with saved API keys
    const providers = ['gemini', 'openai', 'anthropic', 'deepseek'];
    providers.forEach(provider => {
        const key = storage.loadApiKey(provider);
        if (key) {
            llmService.setApiKey(provider, key);
        }
        // Load model preference
        const modelKey = `${provider}Model`;
        if (settings?.[modelKey]) {
            llmService.setModel(provider, settings[modelKey]);
        }
    });

    // Configure Ollama
    if (settings?.ollamaEndpoint) {
        llmService.setEndpoint('ollama', settings.ollamaEndpoint);
    }
    if (settings?.ollamaModel) {
        llmService.setModel('ollama', settings.ollamaModel);
    }

    // Set active provider
    if (settings?.activeProvider) {
        llmService.setProvider(settings.activeProvider);
    }

    // Initialize UI components
    initViewer();
    initEditor();
    initUI();
    validationPanel.init();

    // Dialogs are auto-initialized via module import

    // Restore session if available
    const session = storage.loadSession();
    if (session) {
        console.log('coOCR/HTR: Restoring session...');
        // Session restoration handled by state module
    }

    // Global error handler for unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        dialogManager.showToast('An error occurred. Check console for details.', 'error');
    });

    // Export event handler
    document.addEventListener('exportRequested', (event) => {
        const { format, includeValidation, includeMetadata } = event.detail;
        try {
            const result = exportService.exportAndDownload(format, {
                includeValidation,
                includeMetadata
            });
            dialogManager.showToast(`Exported as ${result.filename}`, 'success');
        } catch (error) {
            console.error('Export error:', error);
            dialogManager.showToast(`Export failed: ${error.message}`, 'error');
        }
    });

    // Initialize samples menu
    await initSamplesMenu();

    // Connect empty state buttons
    initEmptyStateButtons();

    console.log('coOCR/HTR: Initialized');
}

/**
 * Connect empty state buttons to actions
 */
function initEmptyStateButtons() {
    const btnLoadDemo = document.getElementById('btnLoadDemo');
    const btnUploadEmpty = document.getElementById('btnUploadEmpty');
    const samplesBtn = document.getElementById('btnSamples');
    const btnUpload = document.getElementById('btnUpload');

    // "Load Demo" button opens the samples menu
    if (btnLoadDemo && samplesBtn) {
        btnLoadDemo.addEventListener('click', () => {
            samplesBtn.click();
        });
    }

    // "Upload Image" button triggers upload dialog
    if (btnUploadEmpty && btnUpload) {
        btnUploadEmpty.addEventListener('click', () => {
            btnUpload.click();
        });
    }
}

/**
 * Initialize samples dropdown menu
 */
async function initSamplesMenu() {
    const samplesBtn = document.getElementById('btnSamples');
    const samplesMenu = document.getElementById('samplesMenu');

    if (!samplesBtn || !samplesMenu) return;

    // Load samples manifest
    const samples = await samplesService.getSamples();

    if (samples.length === 0) {
        samplesBtn.style.display = 'none';
        return;
    }

    // Populate menu
    samplesMenu.innerHTML = samples.map(sample => `
        <button class="samples-menu-item" data-sample-id="${sample.id}">
            <span class="sample-name">${sample.name}</span>
            <span class="sample-desc">${sample.description}</span>
        </button>
    `).join('');

    // Toggle menu
    samplesBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        samplesMenu.classList.toggle('visible');
    });

    // Close menu on outside click
    document.addEventListener('click', () => {
        samplesMenu.classList.remove('visible');
        // Also close knowledge menu
        const knowledgeMenu = document.getElementById('knowledgeMenu');
        if (knowledgeMenu) knowledgeMenu.classList.remove('visible');
    });

    // Initialize knowledge menu toggle
    const knowledgeBtn = document.getElementById('btnKnowledge');
    const knowledgeMenu = document.getElementById('knowledgeMenu');
    if (knowledgeBtn && knowledgeMenu) {
        knowledgeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            knowledgeMenu.classList.toggle('visible');
            samplesMenu.classList.remove('visible'); // Close samples menu
        });
    }

    // Handle sample selection
    samplesMenu.addEventListener('click', async (e) => {
        const item = e.target.closest('.samples-menu-item');
        if (!item) return;

        const sampleId = item.dataset.sampleId;
        samplesMenu.classList.remove('visible');

        try {
            dialogManager.showToast('Loading sample...', 'info');
            const sample = await samplesService.loadSample(sampleId);
            dialogManager.showToast(`Loaded: ${sample.name}`, 'success');
        } catch (error) {
            console.error('Failed to load sample:', error);
            dialogManager.showToast(`Failed to load sample: ${error.message}`, 'error');
        }
    });
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
