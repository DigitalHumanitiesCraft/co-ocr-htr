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
// eslint-disable-next-line no-unused-vars -- side-effect: registers DOM event listeners
import { descriptionManager } from './components/description.js';
import { validationPanel } from './components/validation.js';
// eslint-disable-next-line no-unused-vars -- side-effect: registers DOM event listeners
import { contextManager } from './components/context.js';
// eslint-disable-next-line no-unused-vars -- side-effect: auto-init thinking panel
import { thinkingPanel } from './components/thinking.js';

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
import { initPanelResize } from './utils/panelResize.js';
import { initValidationResize } from './utils/validationResize.js';
import { i18n, t } from './services/i18n.js';

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

    // Initialize i18n (loads dictionary, translates DOM)
    await i18n.init();
    initLanguageSwitcher();

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
    initPanelResize();
    initValidationResize();

    // Dialogs are auto-initialized via module import

    // Session restoration handled by checkForProjects() below

    // Global error handler for unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        dialogManager.showToast(t('toast.errorOccurred'), 'error');
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
            dialogManager.showToast(t('toast.exportedAs', { filename: result.filename }), 'success');
            updateWorkflowStep(5, 'completed');
        } catch (error) {
            console.error('Export error:', error);
            dialogManager.showToast(t('toast.exportFailed', { message: error.message }), 'error');
        }
    });

    // Initialize samples menu
    await initSamplesMenu();

    // Initialize guided workflow features
    initGuidedWorkflow();

    // Wire up project management buttons
    initProjectButtons();

    // Check for saved projects, show welcome overlay or restore dialog
    await handleStartup();

    console.log('coOCR/HTR: Initialized');
}

/**
 * Startup handler: show welcome overlay for first-time users, or restore session
 */
async function handleStartup() {
    const settings = storage.loadSettings() || {};
    const welcomeDismissed = settings.welcome_dismissed === true;
    const activeProjectId = storage.getActiveProjectId();

    let projects;
    try {
        projects = await storage.listProjects();
    } catch {
        projects = [];
    }

    // If there's an active project, always offer to restore (existing behavior)
    if (activeProjectId && projects.length > 0) {
        await checkForProjects();
        return;
    }

    // Show welcome overlay on first visit or when not dismissed
    if (!welcomeDismissed) {
        await showWelcomeOverlay(projects);
        return;
    }

    // Dismissed but projects exist with no active one: show project list
    if (projects.length > 0) {
        await showProjectListDialog(projects);
    }
}

/**
 * Welcome overlay for first-time users
 */
async function showWelcomeOverlay(projects) {
    return new Promise((resolve) => {
        const dialog = document.createElement('dialog');
        dialog.className = 'confirm-dialog glass-panel welcome-overlay';

        const hasProjects = projects && projects.length > 0;

        dialog.innerHTML = `
            <div class="welcome-header">
                <img src="assets/logo-icon.png" alt="coOCR/HTR" class="welcome-logo">
                <div class="welcome-title-group">
                    <h2 class="welcome-title">${t('welcome.title')}</h2>
                    <p class="welcome-tagline">${t('welcome.tagline')}</p>
                </div>
            </div>
            <div class="dialog-body">
                <p class="welcome-description">${t('welcome.description')}</p>

                <div class="welcome-workflow">
                    <div class="welcome-step"><span class="welcome-step-num">1</span><span>${t('welcome.step1')}</span></div>
                    <div class="welcome-step"><span class="welcome-step-num">2</span><span>${t('welcome.step2')}</span></div>
                    <div class="welcome-step"><span class="welcome-step-num">3</span><span>${t('welcome.step3')}</span></div>
                    <div class="welcome-step"><span class="welcome-step-num">4</span><span>${t('welcome.step4')}</span></div>
                    <div class="welcome-step"><span class="welcome-step-num">5</span><span>${t('welcome.step5')}</span></div>
                </div>

                <h3 class="welcome-actions-title">${t('welcome.getStarted')}</h3>
                <div class="welcome-actions-grid">
                    <button class="welcome-action-card" data-action="new-project">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                            <line x1="12" y1="11" x2="12" y2="17"></line>
                            <line x1="9" y1="14" x2="15" y2="14"></line>
                        </svg>
                        <span class="welcome-action-label">${t('welcome.newProject')}</span>
                        <span class="welcome-action-hint">${t('welcome.newProjectHint')}</span>
                    </button>
                    <button class="welcome-action-card" data-action="load-demo">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polygon points="10 8 16 12 10 16 10 8"></polygon>
                        </svg>
                        <span class="welcome-action-label">${t('welcome.loadDemo')}</span>
                        <span class="welcome-action-hint">${t('welcome.loadDemoHint')}</span>
                    </button>
                    <button class="welcome-action-card" data-action="upload">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        <span class="welcome-action-label">${t('welcome.uploadFile')}</span>
                        <span class="welcome-action-hint">${t('welcome.uploadFileHint')}</span>
                    </button>
                    ${hasProjects ? `
                    <button class="welcome-action-card" data-action="open-projects">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        </svg>
                        <span class="welcome-action-label">${t('welcome.openProject')}</span>
                        <span class="welcome-action-hint">${t('welcome.openProjectHint', { count: projects.length })}</span>
                    </button>
                    ` : ''}
                </div>
            </div>
            <div class="welcome-footer">
                <label class="welcome-dismiss-label">
                    <input type="checkbox" id="welcomeDontShow">
                    <span>${t('welcome.dontShowAgain')}</span>
                </label>
                <button class="btn btn-secondary" data-action="close">${t('welcome.close')}</button>
            </div>
        `;

        const closeOverlay = () => {
            const checkbox = dialog.querySelector('#welcomeDontShow');
            if (checkbox?.checked) {
                storage.saveSettings({ welcome_dismissed: true });
            }
            dialog.close();
            dialog.remove();
            resolve();
        };

        dialog.addEventListener('click', async (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (!action) return;

            if (action === 'new-project') {
                closeOverlay();
                await createNewProject();
            } else if (action === 'load-demo') {
                closeOverlay();
                const samples = samplesService.getSamples();
                if (samples.length > 0) {
                    await samplesService.loadSample(samples[0].id);
                }
            } else if (action === 'upload') {
                closeOverlay();
                uploadManager.openFilePicker('image');
            } else if (action === 'open-projects') {
                closeOverlay();
                await showProjectListDialog(projects);
            } else if (action === 'close') {
                closeOverlay();
            }
        });

        dialog.addEventListener('cancel', (e) => {
            e.preventDefault();
            closeOverlay();
        });

        document.body.appendChild(dialog);
        dialog.showModal();
    });
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
                        <span class="session-label">${t('dynamic.project')}</span>
                        <span class="session-value session-filename">${escapeHtml(activeProject.name)}</span>
                    </div>
                    <div class="session-info-row">
                        <span class="session-label">${t('dynamic.saved')}</span>
                        <span class="session-value">${timeDisplay}</span>
                    </div>
                    ${activeProject.filename ? `<div class="session-info-row">
                        <span class="session-label">${t('dynamic.document')}</span>
                        <span class="session-value">${escapeHtml(activeProject.filename)}</span>
                    </div>` : ''}
                    <div class="session-info-row">
                        <span class="session-label">${t('dynamic.pages')}</span>
                        <span class="session-value">${activeProject.pageCount || 0}</span>
                    </div>
                    <div class="session-info-row">
                        <span class="session-label">${t('dynamic.statusLabel')}</span>
                        <span class="session-value ${activeProject.hasTranscription ? 'status-success' : 'status-neutral'}">
                            ${activeProject.hasTranscription ? t('dynamic.withTranscription') : t('dynamic.withoutTranscription')}
                        </span>
                    </div>
                </div>
            `;

            const shouldRestore = await dialogManager.showConfirm(
                t('confirm.restoreSession'),
                messageHtml,
                t('confirm.restore'),
                projects.length > 1 ? t('confirm.showProjects') : t('confirm.startFresh'),
                { icon: 'restore', html: true }
            );

            if (shouldRestore) {
                await appState.restoreSession(activeProjectId);
                dialogManager.showToast(t('toast.projectRestored'), 'success');
                updateProjectDisplay();
                return;
            }

            // If multiple projects exist, show the project list
            if (projects.length > 1) {
                await showProjectListDialog(projects);
                return;
            }

            // Single project, user chose "Start new" -- clear and start fresh
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
        t('dynamic.createNewProject'),
        t('dynamic.enterProjectName'),
        t('dynamic.newProject'),
        t('dynamic.create'),
        t('dialog.cancel'),
        {
            icon: 'question',
            hint: t('dynamic.nameHint'),
            maxLength: 100,
            validate: (value) => value.length > 0 && value.length <= 100
        }
    );

    if (!name) return; // User cancelled

    try {
        // Start a truly fresh project context (save + reset + create)
        await appState.ensureProject(name);

        dialogManager.showToast(t('toast.projectCreated', { name }), 'success');
        updateProjectDisplay();
    } catch (error) {
        console.error('[Main] Create project failed:', error);
        dialogManager.showToast(t('toast.projectCreateFailed'), 'error');
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
            const pc = p.pageCount || 0;
            return `
                <div class="project-card" data-project-id="${escapeHtml(p.id)}" tabindex="0">
                    <div class="project-card-header">
                        <span class="project-card-name">${escapeHtml(name)}</span>
                        <div class="project-card-actions">
                            <button class="project-rules-btn icon-btn" data-rules="${escapeHtml(p.id)}" title="${t('dynamic.rules')}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                </svg>
                            </button>
                            <button class="project-rename-btn icon-btn" data-rename="${escapeHtml(p.id)}" title="${t('dynamic.rename')}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                                </svg>
                            </button>
                            <button class="project-delete-btn icon-btn" data-delete="${escapeHtml(p.id)}" title="${t('dynamic.delete')}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="project-card-meta">
                        ${p.filename ? `<span>${escapeHtml(p.filename)}</span>` : ''}
                        <span>${t('dynamic.pagesCount', { count: pc, plural: pc === 1 ? '' : 's' })}</span>
                        <span>${time}</span>
                        <span class="${p.hasTranscription ? 'status-success' : 'status-neutral'}">${p.hasTranscription ? t('dynamic.transcribed') : t('dynamic.withoutTranscription')}</span>
                    </div>
                </div>
            `;
        }).join('');

        dialog.innerHTML = `
            <div class="dialog-header">
                <h3>${t('dialog.projects.title')}</h3>
            </div>
            <div class="dialog-body" style="max-height: 50vh; overflow-y: auto;">
                <div class="project-list">
                    ${projectCards}
                </div>
            </div>
            <div class="dialog-actions">
                <button class="btn btn-ghost" data-action="new">${t('dialog.projects.newProject')}</button>
                <button class="btn btn-ghost" data-action="cancel">${t('dialog.cancel')}</button>
            </div>
        `;

        // Handle project card click (load project)
        dialog.addEventListener('click', async (e) => {
            const card = e.target.closest('.project-card');
            const renameBtn = e.target.closest('.project-rename-btn');
            const deleteBtn = e.target.closest('.project-delete-btn');
            const rulesBtn = e.target.closest('.project-rules-btn');

            if (rulesBtn) {
                e.stopPropagation();
                const projectId = rulesBtn.dataset.rules;
                await showProjectRulesDialog(projectId);
                return;
            }

            if (deleteBtn) {
                e.stopPropagation();
                const projectId = deleteBtn.dataset.delete;
                const projectCard = deleteBtn.closest('.project-card');
                const projectName = projectCard?.querySelector('.project-card-name')?.textContent || 'this project';

                const confirmed = await dialogManager.showConfirm(
                    t('confirm.deleteProject'),
                    t('confirm.deleteProjectAll', { name: escapeHtml(projectName) }),
                    t('dynamic.delete'),
                    t('dialog.cancel'),
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
                    t('dynamic.renameProject'),
                    t('dynamic.enterNewName'),
                    currentName,
                    t('dynamic.rename'),
                    t('dialog.cancel'),
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
                dialogManager.showToast(t('toast.projectLoaded'), 'success');
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
 * Migrate old structured transcription rules to new Markdown format.
 * Old format: { scriptType, language, period, paleographicHints, specialCharacters }
 * New format: { markdown: string }
 * @param {object|null|undefined} transcription
 * @returns {{ markdown: string }}
 */
function migrateTranscriptionRules(transcription) {
    if (typeof transcription?.markdown === 'string') return transcription;
    if (transcription && typeof transcription === 'object') {
        const parts = [];
        if (transcription.scriptType) parts.push(`## Script Type\n${transcription.scriptType}`);
        if (transcription.language) parts.push(`## Language\n${transcription.language}`);
        if (transcription.period) parts.push(`## Period\n${transcription.period}`);
        if (transcription.paleographicHints) parts.push(`## Paleographic Hints\n${transcription.paleographicHints}`);
        if (transcription.specialCharacters) parts.push(`## Special Characters\n${transcription.specialCharacters}`);
        return { markdown: parts.join('\n\n') };
    }
    return { markdown: '' };
}

/**
 * Render simple Markdown to HTML (no external dependencies).
 * Supports: h2, h3, bold, italic, inline code, unordered lists, paragraphs.
 * @param {string} md
 * @returns {string} HTML string
 */
function renderSimpleMarkdown(md) {
    const escaped = md
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const lines = escaped.split('\n');
    const html = [];
    let inList = false;

    for (const line of lines) {
        if (line.startsWith('### ')) {
            if (inList) { html.push('</ul>'); inList = false; }
            html.push(`<h3>${line.slice(4)}</h3>`);
        } else if (line.startsWith('## ')) {
            if (inList) { html.push('</ul>'); inList = false; }
            html.push(`<h2>${line.slice(3)}</h2>`);
        } else if (/^- /.test(line)) {
            if (!inList) { html.push('<ul>'); inList = true; }
            html.push(`<li>${line.slice(2)}</li>`);
        } else if (line.trim() === '') {
            if (inList) { html.push('</ul>'); inList = false; }
        } else {
            if (inList) { html.push('</ul>'); inList = false; }
            html.push(`<p>${line}</p>`);
        }
    }
    if (inList) html.push('</ul>');

    return html.join('\n')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>');
}

/**
 * Show project rules dialog for a specific project
 * @param {string} projectId
 */
async function showProjectRulesDialog(projectId) {
    const project = await storage.getProject(projectId);
    if (!project) return;

    const rules = project.rules || {};
    const transcription = migrateTranscriptionRules(rules.transcription);
    const validation = rules.validation || {};

    const dialog = document.createElement('dialog');
    dialog.className = 'confirm-dialog glass-panel';
    dialog.style.maxWidth = '560px';
    dialog.style.width = '90vw';

    dialog.innerHTML = `
        <div class="dialog-header">
            <h3>${t('dialog.rules.title')}: ${escapeHtml(project.name || 'Project')}</h3>
        </div>
        <div class="dialog-body" style="max-height: 60vh; overflow-y: auto;">
            <p class="dialog-subtitle">${t('dialog.rules.subtitle')}</p>

            <div class="form-section">
                <label class="form-label">${t('dialog.rules.editionModel')}</label>
                <select id="rulesEditionModel" class="form-control">
                    <option value="" ${!rules.editionModel ? 'selected' : ''}>-- ${t('dialog.transcribe.select')} --</option>
                    <option value="diplomatic" ${rules.editionModel === 'diplomatic' ? 'selected' : ''}>${t('dialog.rules.diplomatic')}</option>
                    <option value="normalized" ${rules.editionModel === 'normalized' ? 'selected' : ''}>${t('dialog.rules.normalized')}</option>
                    <option value="critical" ${rules.editionModel === 'critical' ? 'selected' : ''}>${t('dialog.rules.critical')}</option>
                </select>
            </div>

            <div class="form-section">
                <label class="form-label">${t('dialog.rules.xmlSchema')}</label>
                <select id="rulesXmlSchema" class="form-control">
                    <option value="page-xml-2019" ${(rules.xmlSchema || 'page-xml-2019') === 'page-xml-2019' ? 'selected' : ''}>${t('dialog.rules.pageXml2019')}</option>
                    <option value="tei-p5" ${rules.xmlSchema === 'tei-p5' ? 'selected' : ''}>${t('dialog.rules.teiP5')}</option>
                </select>
            </div>

            <fieldset class="form-fieldset">
                <legend>
                    ${t('dialog.rules.transcription')}
                    <button type="button" class="btn btn-ghost btn-xs" data-action="upload-md">${t('dialog.rules.uploadMd')}</button>
                    <button type="button" class="btn btn-ghost btn-xs" data-action="toggle-preview">${t('dialog.rules.preview')}</button>
                </legend>
                <p class="text-secondary" style="font-size: var(--text-xs); margin-bottom: var(--space-2);">
                    ${t('dialog.rules.markdownHint')}
                </p>
                <textarea id="rulesTranscriptionMd" class="form-control" rows="12"
                    placeholder="${t('dialog.rules.markdownPlaceholder')}">${escapeHtml(transcription.markdown || '')}</textarea>
                <div id="rulesTranscriptionPreview" class="markdown-preview" style="display: none;"></div>
            </fieldset>

            <fieldset class="form-fieldset">
                <legend>${t('dialog.rules.validationRules')}</legend>

                <div class="form-section">
                    <label class="checkbox-wrapper">
                        <input type="checkbox" id="rulesAutoValidate" ${validation.autoValidate !== false ? 'checked' : ''}>
                        <span>${t('dialog.rules.autoValidate')}</span>
                    </label>
                </div>

                <div class="form-section">
                    <label class="form-label">${t('dialog.rules.customPrompt')}</label>
                    <textarea id="rulesCustomPrompt" class="form-control" rows="3"
                        placeholder="${t('dialog.rules.customPromptPlaceholder')}">${escapeHtml(validation.customPrompt || '')}</textarea>
                </div>
            </fieldset>
        </div>
        <div class="dialog-actions">
            <button class="btn btn-ghost" data-action="export">${t('dialog.rules.exportRules')}</button>
            <button class="btn btn-ghost" data-action="import">${t('dialog.rules.importRules')}</button>
            <span style="flex:1"></span>
            <button class="btn btn-ghost" data-action="cancel">${t('dialog.cancel')}</button>
            <button class="btn btn-primary" data-action="save">${t('dialog.rules.saveRules')}</button>
        </div>
    `;

    // Hidden file input for JSON import
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    dialog.appendChild(fileInput);

    // Hidden file input for Markdown upload
    const mdFileInput = document.createElement('input');
    mdFileInput.type = 'file';
    mdFileInput.accept = '.md,.txt,.markdown';
    mdFileInput.style.display = 'none';
    dialog.appendChild(mdFileInput);

    dialog.addEventListener('click', async (e) => {
        const action = e.target.dataset?.action;
        if (!action) return;

        if (action === 'save') {
            const newRules = {
                editionModel: dialog.querySelector('#rulesEditionModel').value || null,
                xmlSchema: dialog.querySelector('#rulesXmlSchema').value || 'page-xml-2019',
                transcription: {
                    markdown: dialog.querySelector('#rulesTranscriptionMd').value.trim()
                },
                validation: {
                    autoValidate: dialog.querySelector('#rulesAutoValidate').checked,
                    customPrompt: dialog.querySelector('#rulesCustomPrompt').value.trim()
                }
            };
            await storage.updateProjectRules(projectId, newRules);
            dialogManager.showToast(t('dialog.rules.rulesSaved'), 'success');
            dialog.close();
            dialog.remove();
        } else if (action === 'export') {
            const currentRules = {
                editionModel: dialog.querySelector('#rulesEditionModel').value || null,
                xmlSchema: dialog.querySelector('#rulesXmlSchema').value || 'page-xml-2019',
                transcription: {
                    markdown: dialog.querySelector('#rulesTranscriptionMd').value.trim()
                },
                validation: {
                    autoValidate: dialog.querySelector('#rulesAutoValidate').checked,
                    customPrompt: dialog.querySelector('#rulesCustomPrompt').value.trim()
                }
            };
            const blob = new Blob([JSON.stringify(currentRules, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(project.name || 'project').replace(/[^a-zA-Z0-9-_]/g, '_')}-rules.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        } else if (action === 'import') {
            fileInput.click();
        } else if (action === 'upload-md') {
            mdFileInput.click();
        } else if (action === 'toggle-preview') {
            const textarea = dialog.querySelector('#rulesTranscriptionMd');
            const preview = dialog.querySelector('#rulesTranscriptionPreview');
            const toggleBtn = e.target;
            if (preview.style.display === 'none') {
                preview.innerHTML = renderSimpleMarkdown(textarea.value);
                preview.style.display = 'block';
                textarea.style.display = 'none';
                toggleBtn.textContent = t('dialog.rules.edit');
            } else {
                preview.style.display = 'none';
                textarea.style.display = 'block';
                toggleBtn.textContent = t('dialog.rules.preview');
            }
        } else if (action === 'cancel') {
            dialog.close();
            dialog.remove();
        }
    });

    fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const imported = JSON.parse(text);
            // Populate form fields from imported rules (with migration for old format)
            if (imported.editionModel) dialog.querySelector('#rulesEditionModel').value = imported.editionModel;
            if (imported.xmlSchema) dialog.querySelector('#rulesXmlSchema').value = imported.xmlSchema;
            if (imported.transcription) {
                const migrated = migrateTranscriptionRules(imported.transcription);
                dialog.querySelector('#rulesTranscriptionMd').value = migrated.markdown;
            }
            if (imported.validation) {
                const val = imported.validation;
                if (val.autoValidate !== undefined) dialog.querySelector('#rulesAutoValidate').checked = val.autoValidate;
                if (val.customPrompt) dialog.querySelector('#rulesCustomPrompt').value = val.customPrompt;
            }
            dialogManager.showToast(t('dialog.rules.importSuccess'), 'success');
        } catch (err) {
            dialogManager.showToast(t('dialog.rules.importFailed', { message: err.message }), 'error');
        }
        fileInput.value = '';
    });

    mdFileInput.addEventListener('change', async () => {
        const file = mdFileInput.files?.[0];
        if (!file) return;
        const text = await file.text();
        dialog.querySelector('#rulesTranscriptionMd').value = text;
        dialogManager.showToast(t('dialog.rules.mdImported'), 'success');
        mdFileInput.value = '';
    });

    dialog.addEventListener('cancel', (e) => {
        e.preventDefault();
        dialog.close();
        dialog.remove();
    });

    document.body.appendChild(dialog);
    dialog.showModal();
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
    try {
        await appState.saveSessionNow();
    } catch (error) {
        console.warn('[Main] Could not save session before opening project list:', error);
        dialogManager.showToast(t('toast.saveFailed'), 'warning');
    }

    let projects;
    try {
        projects = await storage.listProjects();
    } catch {
        dialogManager.showToast(t('toast.projectsLoadFailed'), 'error');
        return;
    }

    if (projects.length === 0) {
        dialogManager.showToast(t('toast.noProjectsYet'), 'info');
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
    if (diffMins < 1) return t('dynamic.justNow');
    if (diffMins < 60) return t('dynamic.minutesAgo', { count: diffMins, plural: diffMins === 1 ? '' : 's' });
    if (diffHours < 24) return t('dynamic.hoursAgo', { count: diffHours, plural: diffHours === 1 ? '' : 's' });
    if (diffDays < 7) return t('dynamic.daysAgo', { count: diffDays, plural: diffDays === 1 ? '' : 's' });

    // Older: show date in locale format
    const locale = i18n.getLang() === 'de' ? 'de-DE' : 'en-US';
    return date.toLocaleDateString(locale, {
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
        details.push(`<dt>${t('dynamic.sampleLanguage')}</dt><dd>${escapeHtml(sample.language)}</dd>`);
    }
    if (sample.script) {
        details.push(`<dt>${t('dynamic.sampleScript')}</dt><dd>${escapeHtml(sample.script)}</dd>`);
    }

    // Type label
    const typeLabels = {
        print: t('dynamic.typePrint'),
        manuscript: t('dynamic.typeManuscript'),
        letter: t('dynamic.typeLetter'),
        card: t('dynamic.typeCard')
    };
    if (sample.type && typeLabels[sample.type]) {
        details.push(`<dt>${t('dynamic.sampleType')}</dt><dd>${typeLabels[sample.type]}</dd>`);
    }

    // Source
    if (sample.iiifManifest) {
        details.push(`<dt>${t('dynamic.sampleSource')}</dt><dd>${t('dynamic.sampleIiifExternal')}</dd>`);
    } else if (sample.pageXml || (sample.pages && sample.pages.some(p => p.pageXml))) {
        details.push(`<dt>${t('dynamic.sampleData')}</dt><dd>${t('dynamic.sampleWithTranscription')}</dd>`);
    } else {
        details.push(`<dt>${t('dynamic.sampleData')}</dt><dd>${t('dynamic.sampleImageOnly')}</dd>`);
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
            dialogManager.showToast(t('toast.loadingSample'), 'info');
            const sample = await samplesService.loadSample(sampleId);

            // Mark as demo and show indicator
            appState.isDemo = true;
            showDemoIndicator(true);

            dialogManager.showToast(t('toast.loadedSample', { name: sample.name }), 'success');
        } catch (error) {
            console.error('Failed to load sample:', error);
            dialogManager.showToast(t('toast.sampleFailed', { message: error.message }), 'error');
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
        updateWorkflowStep(3, 'active');
        // Hide editor hint when transcription available
        const editorHint = document.getElementById('editorHint');
        if (editorHint) editorHint.classList.add('hidden');
    });

    appState.addEventListener('descriptionComplete', (event) => {
        console.log('[Main] Description complete:', event.detail.provider);
        updateWorkflowStep(3, 'completed');
        updateWorkflowStep(4, 'active');
    });

    // Also hide hints when document is loaded (for demo with pre-loaded transcription)
    appState.addEventListener('documentLoaded', () => {
        // Check if transcription already exists (e.g., from PAGE-XML)
        const state = appState.getState();
        if (state.transcription?.segments?.length > 0) {
            const editorHint = document.getElementById('editorHint');
            if (editorHint) editorHint.classList.add('hidden');
            updateWorkflowStep(2, 'completed');
            if (state.description?.raw) {
                updateWorkflowStep(3, 'completed');
                if (state.validation?.status === 'complete') {
                    updateWorkflowStep(4, 'completed');
                    updateWorkflowStep(5, 'active');
                } else {
                    updateWorkflowStep(4, 'active');
                }
            } else {
                updateWorkflowStep(3, 'active');
            }
        }
    });

    appState.addEventListener('validationComplete', () => {
        updateWorkflowStep(4, 'completed');
        updateWorkflowStep(5, 'active');
        // Hide validation hint
        const validationHint = document.getElementById('validationHint');
        if (validationHint) validationHint.classList.add('hidden');
    });

    // Keep export step visible as the current action after edits
    appState.addEventListener('segmentUpdated', () => {
        const validateStep = document.querySelector('.workflow-step[data-step="4"]');
        if (validateStep?.classList.contains('completed')) {
            updateWorkflowStep(5, 'active');
        }
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

/**
 * Initialize language switcher toggle
 */
function initLanguageSwitcher() {
    const toggle = document.getElementById('langToggle');
    const label = document.getElementById('langToggleLabel');
    if (!toggle || !label) return;

    // Set initial label
    label.textContent = i18n.getLang().toUpperCase();

    toggle.addEventListener('click', async () => {
        const newLang = i18n.getLang() === 'en' ? 'de' : 'en';
        await i18n.setLang(newLang);
        label.textContent = newLang.toUpperCase();
    });
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
