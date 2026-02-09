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
// Side-effect import: initializes tooltip positioning
import './utils/tooltips.js';

/**
 * Try to load local configuration file (for local development convenience)
 * This file is gitignored and allows developers to pre-configure API keys
 */
async function loadLocalConfig() {
    // Only attempt on localhost -- avoids 404 console noise on deployed versions
    const host = location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]') {
        return false;
    }

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

    // Load persistently saved API keys from IndexedDB (if user opted in)
    try {
        const savedKeys = await storage.loadAllApiKeys();
        for (const [provider, apiKey] of Object.entries(savedKeys)) {
            if (apiKey) {
                llmService.setApiKey(provider, apiKey);
                console.log(`coOCR/HTR: Loaded persistent ${provider} API key`);
            }
        }
    } catch {
        // IndexedDB not available or empty -- no problem
    }

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

    // Session restoration handled by checkForProjects() below

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

    // Wire up project management buttons
    initProjectButtons();

    // Check for saved projects and offer to restore
    await checkForProjects();

    console.log('coOCR/HTR: Initialized');
}

/**
 * Check for saved projects and offer to restore
 */
async function checkForProjects() {
    const activeProjectId = storage.getActiveProjectId();
    let projects;
    try {
        projects = await storage.listProjects();
    } catch {
        // IndexedDB unavailable -- fresh start
        return;
    }

    if (projects.length === 0) return;

    // If there's an active project, offer to resume it
    if (activeProjectId) {
        const activeProject = projects.find(p => p.id === activeProjectId);
        if (activeProject) {
            const timeDisplay = formatSessionTime(new Date(activeProject.updatedAt));
            const messageHtml = `
                <div class="session-info">
                    <div class="session-info-row">
                        <span class="session-label">Projekt:</span>
                        <span class="session-value session-filename">${escapeHtml(activeProject.name)}</span>
                    </div>
                    <div class="session-info-row">
                        <span class="session-label">Gespeichert:</span>
                        <span class="session-value">${timeDisplay}</span>
                    </div>
                    ${activeProject.filename ? `<div class="session-info-row">
                        <span class="session-label">Document:</span>
                        <span class="session-value">${escapeHtml(activeProject.filename)}</span>
                    </div>` : ''}
                    <div class="session-info-row">
                        <span class="session-label">Pages:</span>
                        <span class="session-value">${activeProject.pageCount || 0}</span>
                    </div>
                    <div class="session-info-row">
                        <span class="session-label">Status:</span>
                        <span class="session-value ${activeProject.hasTranscription ? 'status-success' : 'status-neutral'}">
                            ${activeProject.hasTranscription ? 'With transcription' : 'Without transcription'}
                        </span>
                    </div>
                </div>
            `;

            const shouldRestore = await dialogManager.showConfirm(
                'Continue project?',
                messageHtml,
                'Continue',
                projects.length > 1 ? 'Show projects' : 'Start new',
                { icon: 'restore', html: true }
            );

            if (shouldRestore) {
                await appState.restoreSession(activeProjectId);
                dialogManager.showToast('Project restored', 'success');
                updateProjectDisplay();
                return;
            }

            // If multiple projects exist, show the project list
            if (projects.length > 1) {
                await showProjectListDialog(projects);
                return;
            }

            // Single project, user chose "Neu starten" -- clear and start fresh
            storage.clearActiveProjectId();
            return;
        }
    }

    // No active project but projects exist -- show project list
    await showProjectListDialog(projects);
}

/**
 * Create a new project with user input
 */
async function createNewProject() {
    const name = await dialogManager.showPrompt(
        'Create New Project',
        'Please enter a name for the new project:',
        'New Project',
        'Create',
        'Cancel',
        {
            icon: 'question',
            hint: 'The name can be changed later',
            maxLength: 100,
            validate: (value) => value.length > 0 && value.length <= 100
        }
    );

    if (!name) return; // User cancelled

    try {
        await appState.createProject(name);
        dialogManager.showToast(`Project "${name}" created`, 'success');
        updateProjectDisplay();
    } catch (error) {
        console.error('[Main] Create project failed:', error);
        dialogManager.showToast('Project could not be created', 'error');
    }
}

/**
 * Show the project list dialog
 * @param {Array} projects
 */
async function showProjectListDialog(projects) {
    return new Promise((resolve) => {
        const dialog = document.createElement('dialog');
        dialog.className = 'confirm-dialog glass-panel';
        dialog.style.maxWidth = '480px';
        dialog.style.width = '90vw';

        const projectCards = projects.map(p => {
            const time = formatSessionTime(new Date(p.updatedAt));
            const name = p.name || p.filename || 'Unnamed';
            return `
                <div class="project-card" data-project-id="${escapeHtml(p.id)}" tabindex="0">
                    <div class="project-card-header">
                        <span class="project-card-name">${escapeHtml(name)}</span>
                        <div class="project-card-actions">
                            <button class="project-rename-btn icon-btn" data-rename="${escapeHtml(p.id)}" title="Rename">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                                </svg>
                            </button>
                            <button class="project-delete-btn icon-btn" data-delete="${escapeHtml(p.id)}" title="Delete">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="project-card-meta">
                        ${p.filename ? `<span>${escapeHtml(p.filename)}</span>` : ''}
                        <span>${p.pageCount || 0} page${(p.pageCount || 0) === 1 ? '' : 's'}</span>
                        <span>${time}</span>
                        <span class="${p.hasTranscription ? 'status-success' : 'status-neutral'}">${p.hasTranscription ? 'Transcribed' : 'Without transcription'}</span>
                    </div>
                </div>
            `;
        }).join('');

        dialog.innerHTML = `
            <div class="dialog-header">
                <h3>Projects</h3>
            </div>
            <div class="dialog-body" style="max-height: 50vh; overflow-y: auto;">
                <div class="project-list">
                    ${projectCards}
                </div>
            </div>
            <div class="dialog-actions">
                <button class="btn btn-ghost" data-action="new">New Project</button>
                <button class="btn btn-ghost" data-action="cancel">Cancel</button>
            </div>
        `;

        // Handle project card click (load project)
        dialog.addEventListener('click', async (e) => {
            const card = e.target.closest('.project-card');
            const renameBtn = e.target.closest('.project-rename-btn');
            const deleteBtn = e.target.closest('.project-delete-btn');

            if (deleteBtn) {
                e.stopPropagation();
                const projectId = deleteBtn.dataset.delete;
                const projectCard = deleteBtn.closest('.project-card');
                const projectName = projectCard?.querySelector('.project-card-name')?.textContent || 'this project';

                const confirmed = await dialogManager.showConfirm(
                    'Delete project?',
                    `Do you really want to delete the project "${escapeHtml(projectName)}"? All data will be lost.`,
                    'Delete',
                    'Cancel',
                    { icon: 'warning' }
                );

                if (confirmed) {
                    await storage.deleteProject(projectId);
                    projectCard.remove();
                    // If no more projects, close dialog
                    if (dialog.querySelectorAll('.project-card').length === 0) {
                        dialog.close();
                        dialog.remove();
                        resolve();
                    }
                }
                return;
            }

            if (renameBtn) {
                e.stopPropagation();
                const projectId = renameBtn.dataset.rename;
                const projectCard = renameBtn.closest('.project-card');
                const currentName = projectCard?.querySelector('.project-card-name')?.textContent || '';

                const newName = await dialogManager.showPrompt(
                    'Rename Project',
                    'Please enter a new name:',
                    currentName,
                    'Rename',
                    'Cancel',
                    {
                        maxLength: 100,
                        validate: (value) => value.length > 0 && value.length <= 100
                    }
                );

                if (newName) {
                    await storage.renameProject(projectId, newName);
                    const nameEl = projectCard?.querySelector('.project-card-name');
                    if (nameEl) nameEl.textContent = newName;
                }
                return;
            }

            if (card && !renameBtn && !deleteBtn) {
                const projectId = card.dataset.projectId;
                dialog.close();
                dialog.remove();
                await appState.restoreSession(projectId);
                dialogManager.showToast('Project loaded', 'success');
                updateProjectDisplay();
                resolve();
                return;
            }

            const action = e.target.dataset?.action;
            if (action === 'new') {
                dialog.close();
                dialog.remove();
                await createNewProject();
                resolve();
            } else if (action === 'cancel') {
                dialog.close();
                dialog.remove();
                resolve();
            }
        });

        // Handle escape
        dialog.addEventListener('cancel', (e) => {
            e.preventDefault();
            dialog.close();
            dialog.remove();
            resolve();
        });

        document.body.appendChild(dialog);
        dialog.showModal();
    });
}

/**
 * Update project name display in header
 */
function updateProjectDisplay() {
    const headerDocInfo = document.getElementById('headerDocInfo');
    const headerFilename = document.getElementById('headerFilename');
    if (headerDocInfo && headerFilename && appState.data.project.name) {
        headerFilename.textContent = appState.data.project.name;
        headerDocInfo.hidden = false;
    }
}

// Listen for project changes to update header display
appState.addEventListener('projectChanged', () => updateProjectDisplay());

/**
 * Open the project list dialog (callable from UI buttons)
 */
async function openProjectList() {
    // Flush pending session data so project metadata is current
    await appState.saveSessionNow();

    let projects;
    try {
        projects = await storage.listProjects();
    } catch {
        dialogManager.showToast('Projects could not be loaded', 'error');
        return;
    }

    if (projects.length === 0) {
        dialogManager.showToast('No projects available yet', 'info');
        return;
    }

    await showProjectListDialog(projects);
}

// Wire up project list buttons after DOM is ready
function initProjectButtons() {
    const btnProjects = document.getElementById('btnProjects');
    if (btnProjects) {
        btnProjects.addEventListener('click', () => openProjectList());
    }

    const headerDocInfo = document.getElementById('headerDocInfo');
    if (headerDocInfo) {
        headerDocInfo.addEventListener('click', () => openProjectList());
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
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

    // Older: show date
    return date.toLocaleDateString('en-US', {
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
        details.push('<dt>Source</dt><dd>IIIF (external)</dd>');
    } else if (sample.pageXml || (sample.pages && sample.pages.some(p => p.pageXml))) {
        details.push('<dt>Data</dt><dd>With transcription</dd>');
    } else {
        details.push('<dt>Data</dt><dd>Image only</dd>');
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
        dialogManager.openDialog('iiif');
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
