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
import { contextManager } from './components/context.js';

// Services
import { storage } from './services/storage.js';
import { llmService } from './services/llm.js';
import { exportService } from './services/export.js';
import { pageXMLParser } from './services/parsers/page-xml.js';
import { samplesService } from './services/samples.js';
import { appState } from './state.js';
import { escapeHtml } from './utils/textFormatting.js';

/**
 * Try to load local configuration file (for local development convenience)
 * This file is gitignored and allows developers to pre-configure API keys
 */
async function loadLocalConfig() {
    try {
        const module = await import('../config.local.js');
        const config = module.LOCAL_CONFIG;

        if (config?.apiKeys) {
            console.log('coOCR/HTR: Local config found, loading API keys...');

            // Set API keys from local config
            for (const [provider, apiKey] of Object.entries(config.apiKeys)) {
                if (apiKey && typeof apiKey === 'string' && apiKey.trim() !== '') {
                    llmService.setApiKey(provider, apiKey.trim());
                    console.log(`coOCR/HTR: Loaded ${provider} API key from local config`);
                }
            }
        }

        // Set default provider if specified
        if (config?.defaultProvider) {
            llmService.setProvider(config.defaultProvider);
        }

        // Configure Ollama from local config
        if (config?.ollama) {
            if (config.ollama.endpoint) {
                llmService.setEndpoint('ollama', config.ollama.endpoint);
            }
            if (config.ollama.model) {
                llmService.setModel('ollama', config.ollama.model);
            }
        }

        return true;
    } catch (e) {
        // config.local.js doesn't exist - this is normal for hosted version
        return false;
    }
}

/**
 * Initialize the application
 */
async function initApp() {
    console.log('coOCR/HTR: Initializing...');

    // Load saved settings
    const settings = storage.loadSettings();

    // Configure LLM service with saved model preferences
    // NOTE: API keys are NOT loaded from storage - they must be entered each session
    const providers = ['gemini', 'openai', 'anthropic'];
    providers.forEach(provider => {
        // Load model preference only (not API keys)
        const modelKey = `${provider}Model`;
        if (settings?.[modelKey]) {
            llmService.setModel(provider, settings[modelKey]);
        }
    });

    // Clean up any legacy stored API keys from previous versions
    storage.clearAllApiKeys();

    // Try to load local config file (for local development)
    const hasLocalConfig = await loadLocalConfig();

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

    // Toast event handler - allows modules to show toasts without importing dialogManager
    appState.addEventListener('toastRequested', (event) => {
        const { message, type, duration } = event.detail;
        dialogManager.showToast(message, type, duration);
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

    // Initialize guided workflow features
    initGuidedWorkflow();

    console.log('coOCR/HTR: Initialized');
}

/**
 * Connect empty state buttons to actions
 */
function initEmptyStateButtons() {
    const btnLoadDemo = document.getElementById('btnLoadDemo');
    const samplesBtn = document.getElementById('btnSamples');

    // "Load Demo" button opens the samples menu
    if (btnLoadDemo && samplesBtn) {
        btnLoadDemo.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent document click from closing menu
            samplesBtn.click();
        });
    }

    // "Load IIIF" button opens the IIIF dialog
    const btnLoadIIIF = document.getElementById('btnLoadIIIF');
    const btnIIIF = document.getElementById('btnIIIF');
    if (btnLoadIIIF && btnIIIF) {
        btnLoadIIIF.addEventListener('click', () => {
            btnIIIF.click();
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
        <button class="samples-menu-item" data-sample-id="${escapeHtml(sample.id)}">
            <span class="sample-name">${escapeHtml(sample.name)}</span>
            <span class="sample-desc">${escapeHtml(sample.description)}</span>
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
    });

    // Handle sample selection
    samplesMenu.addEventListener('click', async (e) => {
        const item = e.target.closest('.samples-menu-item');
        if (!item) return;

        const sampleId = item.dataset.sampleId;
        samplesMenu.classList.remove('visible');

        try {
            dialogManager.showToast('Loading sample...', 'info');
            const sample = await samplesService.loadSample(sampleId);

            // Mark as demo and show indicator
            appState.isDemo = true;
            showDemoIndicator(true);

            dialogManager.showToast(`Loaded: ${sample.name}`, 'success');
        } catch (error) {
            console.error('Failed to load sample:', error);
            dialogManager.showToast(`Failed to load sample: ${error.message}`, 'error');
        }
    });
}

/**
 * Initialize guided workflow features
 * - Workflow stepper updates based on app state
 * - Panel hints can be dismissed
 */
function initGuidedWorkflow() {
    // Panel hint dismissal
    document.querySelectorAll('[data-dismiss-hint]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const hintId = btn.dataset.dismissHint;
            const hint = document.getElementById(`${hintId}Hint`);
            if (hint) {
                hint.classList.add('hidden');
                // Remember dismissal
                storage.saveSettings({ [`hint_${hintId}_dismissed`]: true });
            }
        });
    });

    // Hide already-dismissed hints
    ['viewer', 'editor', 'validation'].forEach(hintId => {
        if (storage.loadSettings()?.[`hint_${hintId}_dismissed`]) {
            const hint = document.getElementById(`${hintId}Hint`);
            if (hint) hint.classList.add('hidden');
        }
    });

    // Workflow stepper state management
    const stepper = document.getElementById('workflowStepper');
    if (!stepper) return;

    // Listen to state changes and update stepper
    appState.addEventListener('imageChanged', () => {
        updateWorkflowStep(1, 'completed');
        updateWorkflowStep(2, 'active');
        // Hide viewer hint when document loaded
        const viewerHint = document.getElementById('viewerHint');
        if (viewerHint) viewerHint.classList.add('hidden');
    });

    appState.addEventListener('transcriptionComplete', () => {
        updateWorkflowStep(2, 'completed');
        updateWorkflowStep(3, 'completed');
        updateWorkflowStep(4, 'active');
        // Hide editor hint when transcription available
        const editorHint = document.getElementById('editorHint');
        if (editorHint) editorHint.classList.add('hidden');
    });

    // Also hide hints when document is loaded (for demo with pre-loaded transcription)
    appState.addEventListener('documentLoaded', () => {
        // Check if transcription already exists (e.g., from PAGE-XML)
        const state = appState.getState();
        if (state.transcription?.segments?.length > 0) {
            const editorHint = document.getElementById('editorHint');
            if (editorHint) editorHint.classList.add('hidden');
            updateWorkflowStep(2, 'completed');
            updateWorkflowStep(3, 'completed');
            updateWorkflowStep(4, 'active');
        }
    });

    appState.addEventListener('validationComplete', () => {
        updateWorkflowStep(4, 'completed');
        updateWorkflowStep(5, 'active');
        // Hide validation hint
        const validationHint = document.getElementById('validationHint');
        if (validationHint) validationHint.classList.add('hidden');
    });

    // Track edits for step 5
    appState.addEventListener('segmentUpdated', () => {
        updateWorkflowStep(5, 'completed');
        updateWorkflowStep(6, 'active');
    });
}

/**
 * Update workflow step state
 */
function updateWorkflowStep(stepNum, state) {
    const step = document.querySelector(`.workflow-step[data-step="${stepNum}"]`);
    if (!step) return;

    // Remove all states
    step.classList.remove('active', 'completed');

    // Add new state
    if (state === 'active' || state === 'completed') {
        step.classList.add(state);
    }

    // Mark all previous steps as completed if this step is active
    if (state === 'active') {
        for (let i = 1; i < stepNum; i++) {
            const prevStep = document.querySelector(`.workflow-step[data-step="${i}"]`);
            if (prevStep && !prevStep.classList.contains('completed')) {
                prevStep.classList.remove('active');
                prevStep.classList.add('completed');
            }
        }
    }
}

/**
 * Show demo indicator when demo data is active
 */
function showDemoIndicator(show = true) {
    const demoIndicator = document.getElementById('demoIndicator');
    if (demoIndicator) {
        demoIndicator.style.display = show ? 'flex' : 'none';
    }
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
