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
// eslint-disable-next-line no-unused-vars -- side-effect: registers DOM event listeners
import { transcriptionManager } from './components/transcription.js';
import { validationPanel } from './components/validation.js';
// eslint-disable-next-line no-unused-vars -- side-effect: registers DOM event listeners
import { contextManager } from './components/context.js';

// Services
import { storage } from './services/storage.js';
import { llmService } from './services/llm.js';
import { exportService } from './services/export.js';
// eslint-disable-next-line no-unused-vars -- side-effect: registers pageXMLLoaded handler
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
    } catch (_e) {
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
    const _hasLocalConfig = await loadLocalConfig();

    // Configure Ollama
    if (settings?.ollamaEndpoint) {
        llmService.setEndpoint('ollama', settings.ollamaEndpoint);
    }
    if (settings?.ollamaModel) {
        llmService.setModel('ollama', settings.ollamaModel);
    }

    // Set active provider and model
    if (settings?.activeProvider) {
        llmService.setProvider(settings.activeProvider);
        // Restore active model after setProvider (which resets it)
        if (settings?.activeModel) {
            // Extract actual model name (remove provider prefix if present)
            let modelName = settings.activeModel;
            if (modelName.startsWith('ollama:')) {
                modelName = modelName.substring(7);
            }
            llmService.setModel(modelName);
        }
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

    // Initialize guided workflow features
    initGuidedWorkflow();

    // Check for saved session and offer to restore
    await checkSavedSession();

    console.log('coOCR/HTR: Initialized');
}

/**
 * Check if there's a saved session and offer to restore it
 */
async function checkSavedSession() {
    const savedSession = appState.hasSavedSession();
    if (!savedSession) return;

    // Format timestamp - show relative for recent, absolute for older
    const date = new Date(savedSession.timestamp);
    const timeDisplay = formatSessionTime(date);

    // Build structured HTML content
    const messageHtml = `
        <div class="session-info">
            <div class="session-info-row">
                <span class="session-label">Gespeichert:</span>
                <span class="session-value">${timeDisplay}</span>
            </div>
            <div class="session-info-row">
                <span class="session-label">Dokument:</span>
                <span class="session-value session-filename">${escapeHtml(savedSession.filename)}</span>
            </div>
            <div class="session-info-row">
                <span class="session-label">Status:</span>
                <span class="session-value ${savedSession.hasTranscription ? 'status-success' : 'status-neutral'}">
                    ${savedSession.hasTranscription ? 'Mit Transkription' : 'Ohne Transkription'}
                </span>
            </div>
        </div>
    `;

    // Show confirmation dialog with icon
    const shouldRestore = await dialogManager.showConfirm(
        'Letzte Sitzung fortsetzen?',
        messageHtml,
        'Fortsetzen',
        'Neu starten',
        { icon: 'restore', html: true }
    );

    if (shouldRestore) {
        appState.restoreSession();
        dialogManager.showToast('Sitzung wiederhergestellt', 'success');
    } else {
        appState.clearSession();
    }
}

/**
 * Format session timestamp - relative for recent, absolute date for older
 */
function formatSessionTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Recent: relative time
    if (diffMins < 1) return 'Gerade eben';
    if (diffMins < 60) return `Vor ${diffMins} Minute${diffMins === 1 ? '' : 'n'}`;
    if (diffHours < 24) return `Vor ${diffHours} Stunde${diffHours === 1 ? '' : 'n'}`;
    if (diffDays < 7) return `Vor ${diffDays} Tag${diffDays === 1 ? '' : 'en'}`;

    // Older: show date
    return date.toLocaleDateString('de-DE', {
        day: 'numeric',
        month: 'long',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}


/**
 * Generate badge HTML for a sample based on its properties
 */
function generateSampleBadges(sample) {
    const badges = [];

    // OCR vs HTR badge (based on type)
    const isHandwritten = ['manuscript', 'letter', 'card'].includes(sample.type);
    if (isHandwritten) {
        badges.push('<span class="sample-badge sample-badge-htr">HTR</span>');
    } else {
        badges.push('<span class="sample-badge sample-badge-ocr">OCR</span>');
    }

    // IIIF badge
    if (sample.iiifManifest) {
        badges.push('<span class="sample-badge sample-badge-iiif">IIIF</span>');
    }

    // PAGE-XML badge
    const hasPageXml = sample.pageXml ||
        (sample.pages && sample.pages.some(p => p.pageXml));
    if (hasPageXml) {
        badges.push('<span class="sample-badge sample-badge-xml">XML</span>');
    }

    // Multi-page badge
    if (sample.pages && sample.pages.length > 1) {
        badges.push(`<span class="sample-badge sample-badge-pages">${sample.pages.length}S</span>`);
    }

    return badges.join('');
}

/**
 * Generate tooltip HTML for sample details
 */
function generateSampleTooltip(sample) {
    const details = [];

    if (sample.language) {
        details.push(`<dt>Sprache</dt><dd>${escapeHtml(sample.language)}</dd>`);
    }
    if (sample.script) {
        details.push(`<dt>Schrift</dt><dd>${escapeHtml(sample.script)}</dd>`);
    }

    // Type label
    const typeLabels = {
        print: 'Druck',
        manuscript: 'Handschrift',
        letter: 'Brief',
        card: 'Karteikarte'
    };
    if (sample.type && typeLabels[sample.type]) {
        details.push(`<dt>Typ</dt><dd>${typeLabels[sample.type]}</dd>`);
    }

    // Source
    if (sample.iiifManifest) {
        details.push('<dt>Quelle</dt><dd>IIIF (extern)</dd>');
    } else if (sample.pageXml || (sample.pages && sample.pages.some(p => p.pageXml))) {
        details.push('<dt>Daten</dt><dd>Mit Transkription</dd>');
    } else {
        details.push('<dt>Daten</dt><dd>Nur Bild</dd>');
    }

    return `<dl class="sample-info-tooltip">${details.join('')}</dl>`;
}

/**
 * Initialize upload dropdown menu with all load options
 */
async function initSamplesMenu() {
    const uploadBtn = document.getElementById('btnUpload');
    const uploadMenu = document.getElementById('uploadMenu');
    const uploadDropdown = uploadBtn?.closest('.upload-dropdown');
    const samplesBtn = document.getElementById('btnSamples');
    const samplesMenu = document.getElementById('samplesMenu');
    const btnIIIF = document.getElementById('btnIIIF');
    const btnUploadFile = document.getElementById('btnUploadFile');
    const btnUploadPageXML = document.getElementById('btnUploadPageXML');

    if (!uploadBtn || !uploadMenu) return;

    // Load samples manifest for submenu
    const samples = await samplesService.getSamples();

    // Populate samples submenu with badges
    if (samplesMenu && samples.length > 0) {
        samplesMenu.innerHTML = samples.map(sample => {
            const badges = generateSampleBadges(sample);
            const tooltip = generateSampleTooltip(sample);

            return `
            <button class="samples-menu-item" data-sample-id="${escapeHtml(sample.id)}">
                <div class="sample-header">
                    <span class="sample-name">${escapeHtml(sample.name)}</span>
                    <span class="sample-badges">
                        ${badges}
                        <span class="sample-info">i${tooltip}</span>
                    </span>
                </div>
                <span class="sample-desc">${escapeHtml(sample.description)}</span>
            </button>
        `}).join('');
    }

    // Toggle upload menu
    uploadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        uploadMenu.classList.toggle('visible');
        uploadDropdown?.classList.toggle('open');
        // Close samples menu when opening upload menu
        samplesMenu?.classList.remove('visible');
    });

    // Close menus on outside click
    document.addEventListener('click', () => {
        uploadMenu.classList.remove('visible');
        uploadDropdown?.classList.remove('open');
        samplesMenu?.classList.remove('visible');
    });

    // Upload Image button - trigger file input for images
    btnUploadFile?.addEventListener('click', (e) => {
        e.stopPropagation();
        uploadMenu.classList.remove('visible');
        uploadDropdown?.classList.remove('open');
        uploadManager.openFilePicker('image');
    });

    // Upload PAGE-XML button - trigger file input for XML
    btnUploadPageXML?.addEventListener('click', (e) => {
        e.stopPropagation();
        uploadMenu.classList.remove('visible');
        uploadDropdown?.classList.remove('open');
        uploadManager.openFilePicker('xml');
    });

    // Demo button - show samples submenu
    samplesBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        // Keep upload dropdown open state but show samples menu instead
        uploadMenu.classList.remove('visible');
        samplesMenu?.classList.add('visible');
    });

    // IIIF button - open IIIF dialog
    btnIIIF?.addEventListener('click', (e) => {
        e.stopPropagation();
        uploadMenu.classList.remove('visible');
        uploadDropdown?.classList.remove('open');
        dialogManager.showDialog('iiifDialog');
    });

    // Prevent samples menu from closing when clicking inside it
    samplesMenu?.addEventListener('click', async (e) => {
        e.stopPropagation();

        const item = e.target.closest('.samples-menu-item');
        if (!item) return;

        const sampleId = item.dataset.sampleId;
        samplesMenu.classList.remove('visible');
        uploadDropdown?.classList.remove('open');

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
