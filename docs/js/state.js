/**
 * prototype/js/state.js
 * Central State Management with EventTarget
 */

import { storage } from './services/storage.js';

/**
 * Generate a UUID v4
 */
function generateId() {
  return crypto.randomUUID();
}

/**
 * Application State
 * Central state management using native EventTarget for event dispatching
 */
class AppState extends EventTarget {
  constructor() {
    super();

    this.data = {
      // Active project
      project: {
        id: null,
        name: ''
      },

      // Document info (current page)
      document: {
        id: null,
        filename: '',
        mimeType: '',
        dataUrl: '',        // Base64 image data (current page)
        width: 0,
        height: 0
      },

      // Multi-page support
      pages: [],            // Array of page objects: { id, filename, dataUrl, width, height, pageXml? }
      currentPageIndex: 0,  // 0-based index

      // Per-page transcriptions: { [pageId]: { segments, columns, provider, model } }
      pageTranscriptions: {},

      // Legacy image (for backward compatibility with viewer.js)
      image: {
        url: 'assets/mock-document.jpg',
        width: 0,
        height: 0
      },

      // Bounding box regions (from LLM or PAGE-XML) - current page only
      regions: [],

      // Transcription data (current page)
      transcription: {
        id: null,
        provider: '',       // gemini, openai, anthropic, deepseek, ollama
        model: '',
        raw: '',            // Raw response from LLM
        segments: [],       // Parsed segments with line numbers
        columns: [],        // Column definitions for structured data
        lines: []           // Markdown table lines (generated from segments)
      },

      // Description data (illuminated initials analysis, current page)
      description: {
        id: null,
        provider: 'gemini', // Always 'gemini' for descriptions
        model: '',          // e.g., 'gemini-3-pro-preview'
        customPrompt: '',   // User's custom analysis prompt
        raw: '',            // LLM response text
        timestamp: null     // ISO timestamp
      },

      // Per-page descriptions: { [pageId]: {...}, ... }
      pageDescriptions: {},

      // Batch descriptions (all pages)
      batchDescriptions: [],  // Array of description results per page

      // Validation state
      validation: {
        status: 'idle',     // idle | running | complete | error
        rules: [],          // Rule-based validation results
        llmJudge: null,     // LLM Review result
        summary: null,      // Validation summary (totalIssues, etc.)
        timestamp: null,    // ISO timestamp of last validation
        customPrompt: '',   // User-defined expert validation prompt
        pipeline: null      // Post-processing pipeline metadata (stage2/stage3 status, duration)
      },

      // Corrections made by user
      corrections: [],

      // Batch results (all pages)
      batchTranscriptions: [],  // Array of transcription results per page
      batchValidations: [],     // Array of validation results per page

      // Batch operation state
      batch: {
        operation: null,      // 'transcription' | 'validation' | 'description' | null
        status: 'idle',       // 'idle' | 'running' | 'complete' | 'aborted'
        currentIndex: 0,
        total: 0,
        successCount: 0,
        errorCount: 0,
        abortRequested: false
      },

      // UI state
      ui: {
        zoom: 100,
        selectedLine: null,
        isLoading: false,
        loadingMessage: '',
        activeDialog: null,  // null | 'apiKey' | 'upload' | 'export' | 'settings'
        error: null
      },

      // Session metadata
      meta: {
        createdAt: null,
        updatedAt: null
      }
    };

    // Auto-save timer
    this._autoSaveTimer = null;
    this._autoSaveDelay = 30000; // 30 seconds

    // Don't auto-restore - let main.js handle the confirmation dialog
  }

  // ============================================
  // Getters
  // ============================================

  getState() {
    return this.data;
  }

  // Legacy getter for backward compatibility
  get transcription() {
    return this.data.transcription.lines;
  }

  get zoom() {
    return this.data.ui.zoom;
  }

  get selectedLine() {
    return this.data.ui.selectedLine;
  }

  /**
   * Check if regions have bounding box coordinates
   * Used for graceful degradation: full highlighting with coordinates,
   * editor-only highlighting without
   * @returns {boolean} True if at least one region has x coordinate
   */
  hasRegionCoordinates() {
    return this.data.regions?.length > 0 &&
           this.data.regions.some(r => r.x !== undefined);
  }

  // ============================================
  // Document Management
  // ============================================

  /**
   * Reset document/transcription state for a fresh project.
   * Preserves UI settings but clears all document data.
   */
  _resetState() {
    if (this._autoSaveTimer) {
      clearTimeout(this._autoSaveTimer);
      this._autoSaveTimer = null;
    }
    this.data.project = { id: null, name: '' };
    this.data.document = { id: null, filename: '', mimeType: '', dataUrl: '', width: 0, height: 0 };
    this.data.pages = [];
    this.data.currentPageIndex = 0;
    this.data.pageTranscriptions = {};
    this.data.image = { url: '', width: 0, height: 0 };
    this.data.regions = [];
    this.data.transcription = { id: null, provider: '', model: '', raw: '', segments: [], columns: [], lines: [] };
    this.data.description = { id: null, provider: 'gemini', model: '', customPrompt: '', raw: '', timestamp: null };
    this.data.pageDescriptions = {};
    this.data.batchDescriptions = [];
    this.data.validation = { status: 'idle', rules: [], llmJudge: null, summary: null, timestamp: null, customPrompt: '', pipeline: null };
    this.data.corrections = [];
    this.data.batchTranscriptions = [];
    this.data.batchValidations = [];
    this.data.context = null;
    this.data.meta = { createdAt: null, updatedAt: null };
  }

  /**
   * Ensure a project exists. Auto-creates one from filename if needed.
   * Called before document upload to guarantee project context for IDB saves.
   * @param {string} filename - Used as project name if auto-creating
   * @returns {Promise<string>} The project ID
   */
  async ensureProject(filename) {
    // If a project is already active, save it and create a new one
    if (this.data.project.id) {
      await this._saveSession();
      this._resetState();
    }
    const project = await this.createProject(filename || 'New Project');
    return project.id;
  }

  /**
   * Set document from uploaded file
   * @param {File} file - The uploaded file
   * @param {string} dataUrl - Base64 data URL
   */
  setDocument(file, dataUrl) {
    const docId = generateId();

    this.data.document = {
      id: docId,
      filename: file.name,
      mimeType: file.type,
      dataUrl: dataUrl,
      width: 0,
      height: 0,
      pages: 1,
      currentPage: 1
    };

    // Also update legacy image for backward compatibility
    this.data.image.url = dataUrl;

    // Reset transcription, regions, and validation
    this.data.transcription = {
      ...this.data.transcription,
      id: null,
      provider: '',
      model: '',
      raw: '',
      segments: [],
      columns: [],
      lines: []
    };
    this.data.regions = [];  // Clear bounding boxes
    this._emit('regionsChanged', { regions: [] });  // Notify UI to clear overlays

    // Reset multi-page data for single-page documents
    this.data.pages = [];
    this.data.currentPageIndex = 0;
    this.data.pageTranscriptions = {};
    this.data.batchTranscriptions = [];
    this.data.batchValidations = [];

    this.data.validation = {
      status: 'idle',
      rules: [],
      llmJudge: null,
      summary: null,
      timestamp: null,
      customPrompt: '',
      pipeline: null
    };
    this.data.corrections = [];

    // Update metadata
    this.data.meta.createdAt = new Date().toISOString();
    this.data.meta.updatedAt = this.data.meta.createdAt;

    this._emit('documentLoaded', {
      filename: file.name,
      mimeType: file.type
    });
    this._emit('imageChanged', { url: dataUrl });

    // Save image to IndexedDB (fire-and-forget)
    if (this.data.project.id && dataUrl) {
      storage.saveImage(this.data.project.id, docId, dataUrl).catch(err =>
        console.warn('[State] Failed to save image to IDB:', err.message)
      );
    }

    this._scheduleAutoSave();
  }

  /**
   * Set document dimensions (called after image loads)
   */
  setDocumentDimensions(width, height) {
    this.data.document.width = width;
    this.data.document.height = height;
    this.data.image.width = width;
    this.data.image.height = height;
  }

  /**
   * Alias for setDocumentDimensions
   */
  setImageDimensions(width, height) {
    this.setDocumentDimensions(width, height);
  }

  // ============================================
  // Multi-Page Management
  // ============================================

  /**
   * Set multiple pages (from folder upload or METS-XML)
   * @param {Array} pages - Array of page objects
   */
  setPages(pages) {
    this.data.pages = pages.map((page, index) => ({
      id: page.id || generateId(),
      filename: page.filename || `page-${index + 1}`,
      dataUrl: page.dataUrl || page.image,
      width: page.width || 0,
      height: page.height || 0,
      pageXml: page.pageXml || null,
      order: page.order || index + 1
    }));

    this.data.currentPageIndex = 0;
    this.data.pageTranscriptions = {};

    // Load first page
    if (this.data.pages.length > 0) {
      this._loadPage(0);
    }

    this._emit('pagesLoaded', {
      count: this.data.pages.length,
      pages: this.data.pages.map(p => ({ id: p.id, filename: p.filename }))
    });

    // Save all page images to IndexedDB (fire-and-forget)
    if (this.data.project.id) {
      const imagesToSave = this.data.pages
        .filter(p => p.dataUrl)
        .map(p => ({ pageId: p.id, dataUrl: p.dataUrl }));
      if (imagesToSave.length > 0) {
        storage.saveImages(this.data.project.id, imagesToSave).catch(err =>
          console.warn('[State] Failed to save page images to IDB:', err.message)
        );
      }
    }
  }

  /**
   * Navigate to a specific page
   * @param {number} index - 0-based page index
   */
  goToPage(index) {
    if (index < 0 || index >= this.data.pages.length) return;
    if (index === this.data.currentPageIndex) return;

    // Allow components to flush pending state (e.g. debounced textarea edits)
    // before we snapshot the current page. dispatchEvent is synchronous.
    this.dispatchEvent(new CustomEvent('beforePageChange'));

    // Save current page transcription, description, and validation
    this._saveCurrentPageTranscription();
    this._saveCurrentPageDescription();
    this._saveCurrentPageValidation();

    // Load new page
    this._loadPage(index);
  }

  /**
   * Go to next page
   */
  nextPage() {
    this.goToPage(this.data.currentPageIndex + 1);
  }

  /**
   * Go to previous page
   */
  prevPage() {
    this.goToPage(this.data.currentPageIndex - 1);
  }

  /**
   * Get current page info
   */
  getCurrentPage() {
    return this.data.pages[this.data.currentPageIndex] || null;
  }

  /**
   * Get total page count
   */
  getPageCount() {
    return this.data.pages.length;
  }

  /**
   * Check if multi-page document
   */
  isMultiPage() {
    return this.data.pages.length > 1;
  }

  /**
   * Internal: Load a specific page
   */
  _loadPage(index) {
    const page = this.data.pages[index];
    if (!page) return;

    this.data.currentPageIndex = index;

    // Update document info
    this.data.document = {
      id: page.id,
      filename: page.filename,
      mimeType: page.mimeType || 'image/jpeg',
      dataUrl: page.dataUrl,
      width: page.width,
      height: page.height
    };

    // Update legacy image
    this.data.image.url = page.dataUrl;
    this.data.image.width = page.width;
    this.data.image.height = page.height;

    // Load page transcription if exists
    const savedTranscription = this.data.pageTranscriptions[page.id];
    if (savedTranscription) {
      this.data.transcription = {
        ...this.data.transcription,
        ...savedTranscription,
        lines: this._segmentsToLines(savedTranscription.segments || [])
      };
      this.data.regions = savedTranscription.regions || [];
    } else {
      // Reset transcription for new page
      this.data.transcription = {
        id: null,
        provider: '',
        model: '',
        raw: '',
        segments: [],
        columns: [],
        lines: []
      };
      this.data.regions = [];
    }

    // Load validation for this page if exists
    const savedValidation = this.data.batchValidations.find(v => v.pageIndex === index);
    if (savedValidation?.success && savedValidation?.validation) {
      const normalizedPipeline = this._normalizePipelineMetadata(savedValidation.validation.pipeline || null);
      this.data.validation = {
        status: 'complete',
        rules: savedValidation.validation.rules || [],
        llmJudge: savedValidation.validation.llmJudge
          ? {
            ...savedValidation.validation.llmJudge,
            pipeline: normalizedPipeline
          }
          : null,
        summary: savedValidation.validation.summary || null,
        timestamp: savedValidation.validation.timestamp || null,
        customPrompt: savedValidation.validation.customPrompt || '',
        pipeline: normalizedPipeline
      };
    } else {
      // Reset validation for page without results
      this.data.validation = {
        status: 'idle',
        rules: [],
        llmJudge: null,
        summary: null,
        timestamp: null,
        customPrompt: '',
        pipeline: null
      };
    }

    // Load description for this page if exists
    const savedDescription = this.data.pageDescriptions[page.id];
    if (savedDescription) {
      this.data.description = {
        ...this.data.description,
        ...savedDescription
      };
    } else {
      // Reset description for new page
      this.data.description = {
        id: null,
        provider: 'gemini',
        model: '',
        customPrompt: '',
        raw: '',
        timestamp: null
      };
    }

    this._emit('pageChanged', {
      index,
      pageId: page.id,
      filename: page.filename,
      total: this.data.pages.length
    });
    this._emit('imageChanged', { url: page.dataUrl });
  }

  /**
   * Internal: Save current page transcription
   */
  _saveCurrentPageTranscription() {
    const page = this.data.pages[this.data.currentPageIndex];
    if (!page) return;

    const hasSegments = this.data.transcription.segments?.length > 0;
    const hasRaw = this.data.transcription.raw?.trim().length > 0;
    if (hasSegments || hasRaw) {
      this.data.pageTranscriptions[page.id] = {
        segments: this.data.transcription.segments,
        columns: this.data.transcription.columns,
        raw: this.data.transcription.raw,
        provider: this.data.transcription.provider,
        model: this.data.transcription.model,
        regions: this.data.regions
      };
    } else {
      // Delete empty transcriptions to prevent stale data on page switch
      delete this.data.pageTranscriptions[page.id];
    }
  }

  /**
   * Internal: Save current page description to pageDescriptions
   */
  _saveCurrentPageDescription() {
    const page = this.data.pages[this.data.currentPageIndex];
    if (!page) return;

    const hasRaw = this.data.description.raw?.trim().length > 0;
    if (hasRaw) {
      this.data.pageDescriptions[page.id] = {
        id: this.data.description.id,
        provider: this.data.description.provider,
        model: this.data.description.model,
        customPrompt: this.data.description.customPrompt,
        raw: this.data.description.raw,
        timestamp: this.data.description.timestamp
      };
    }
    // Note: Unlike transcriptions, we do NOT delete existing pageDescriptions
    // when description.raw is empty. The user may have cleared the current
    // description view without intending to delete a previously saved one.
  }

  /**
   * Internal: Save current page validation
   */
  _saveCurrentPageValidation() {
    const currentIndex = this.data.currentPageIndex;
    const page = this.data.pages[currentIndex];
    if (!page) return;

    // Only save if validation has results
    if (this.data.validation.status !== 'complete') return;
    if (!this.data.validation.rules?.length && !this.data.validation.llmJudge) return;

    // Find existing entry or create new
    const existingIndex = this.data.batchValidations.findIndex(v => v.pageIndex === currentIndex);
    const validationEntry = {
      pageId: page.id,
      pageIndex: currentIndex,
      success: true,
      validation: {
        rules: this.data.validation.rules,
        llmJudge: this.data.validation.llmJudge,
        summary: this.data.validation.summary,
        timestamp: this.data.validation.timestamp,
        customPrompt: this.data.validation.customPrompt,
        pipeline: this.data.validation.pipeline
      }
    };

    if (existingIndex >= 0) {
      this.data.batchValidations[existingIndex] = validationEntry;
    } else {
      this.data.batchValidations.push(validationEntry);
    }
  }

  // ============================================
  // Image (Legacy compatibility)
  // ============================================

  setImage(url) {
    this.data.image.url = url;
    this._emit('imageChanged', { url });
  }

  // ============================================
  // Selection & Zoom
  // ============================================

  setSelection(lineNum) {
    this.data.ui.selectedLine = lineNum;
    this._emit('selectionChanged', { line: lineNum });
  }

  setZoom(level) {
    this.data.ui.zoom = Math.max(25, Math.min(400, level));
    this._emit('zoomChanged', { zoom: this.data.ui.zoom });
  }

  // ============================================
  // Transcription
  // ============================================

  /**
   * Set transcription data from LLM response
   * @param {object} data - Transcription data
   */
  setTranscription(data) {
    const segments = data.segments || [];
    const columns = data.columns || [];
    // Derive raw from segments if not provided
    const raw = data.raw || segments.map(s => s.text || '').join('\n') || '';

    this.data.transcription = {
      ...this.data.transcription,
      id: generateId(),
      provider: data.provider || '',
      model: data.model || '',
      raw,
      segments,
      columns,
      lines: this._segmentsToLines(segments)
    };

    this.data.meta.updatedAt = new Date().toISOString();

    this._emit('transcriptionComplete', {
      provider: data.provider
    });
    this._scheduleAutoSave();
  }

  /**
   * Update raw transcription text (from editor changes)
   * @param {string} text - The updated transcription text
   * @param {object} [options] - Update options
   * @param {boolean} [options.syncSegments=false] - Rebuild segments from raw text
   */
  setTranscriptionRaw(text, options = {}) {
    const { syncSegments = false } = options;
    this.data.transcription.raw = text;

    if (syncSegments) {
      this._syncTranscriptionSegmentsFromRaw(text);
    }

    this.data.meta.updatedAt = new Date().toISOString();
    this._scheduleAutoSave();
  }

  /**
   * Set batch transcriptions for all pages
   * @param {Array} results - Array of transcription results per page
   */
  setBatchTranscriptions(results) {
    // Store in simple array for easy access
    this.data.batchTranscriptions = results;

    // Also store in per-page lookup
    for (const result of results) {
      if (result.success && result.transcription) {
        this.data.pageTranscriptions[result.pageId] = {
          ...result.transcription,
          id: generateId(),
          timestamp: new Date().toISOString()
        };
      }
    }

    this.data.meta.updatedAt = new Date().toISOString();
    this._emit('batchTranscriptionComplete', {
      total: results.length,
      successful: results.filter(r => r.success).length
    });
    this._scheduleAutoSave();
  }

  /**
   * Set batch validations for all pages
   * @param {Array} results - Array of validation results per page
   */
  setBatchValidations(results) {
    this.data.batchValidations = results;

    this.data.meta.updatedAt = new Date().toISOString();
    this._emit('batchValidationComplete', {
      total: results.length,
      successful: results.filter(r => r.success).length
    });
    this._scheduleAutoSave();
  }

  // ============================================
  // Description (Illuminated Initials Analysis)
  // ============================================

  /**
   * Set description data from LLM response
   * @param {object} data - Description data
   */
  setDescription(data) {
    this.data.description = {
      ...this.data.description,
      id: generateId(),
      provider: 'gemini',
      model: data.model || '',
      customPrompt: data.customPrompt || '',
      raw: data.raw || '',
      timestamp: new Date().toISOString()
    };

    this.data.meta.updatedAt = new Date().toISOString();

    this._emit('descriptionComplete', {
      provider: 'gemini',
      model: data.model
    });
    this._scheduleAutoSave();
  }

  /**
   * Update raw description text (from user edits)
   * @param {string} text - The updated description text
   */
  setDescriptionRaw(text) {
    this.data.description.raw = text;
    this.data.meta.updatedAt = new Date().toISOString();
    this._scheduleAutoSave();
  }

  /**
   * Set batch descriptions for all pages
   * @param {Array} results - Array of description results per page
   */
  setBatchDescriptions(results) {
    // Store in simple array for easy access
    this.data.batchDescriptions = results;

    // Also store in per-page lookup
    for (const result of results) {
      if (result.success && result.description) {
        this.data.pageDescriptions[result.pageId] = {
          ...result.description,
          id: generateId(),
          timestamp: new Date().toISOString()
        };
      }
    }

    this.data.meta.updatedAt = new Date().toISOString();
    this._emit('batchDescriptionComplete', {
      total: results.length,
      successful: results.filter(r => r.success).length
    });
    this._scheduleAutoSave();
  }

  /**
   * Get description for a specific page (or current page if not specified)
   * @param {string} pageId - Optional page ID (defaults to current page)
   * @returns {object|null} Description or null
   */
  getDescription(pageId = null) {
    if (pageId) {
      return this.data.pageDescriptions[pageId] || null;
    }
    return this.data.description;
  }

  // ============================================
  // Batch Operation Control
  // ============================================

  /**
   * Start a batch operation
   * @param {string} operation - 'transcription' or 'validation'
   * @param {number} total - Total number of pages
   */
  startBatch(operation, total) {
    this.data.batch = {
      operation,
      status: 'running',
      currentIndex: 0,
      total,
      successCount: 0,
      errorCount: 0,
      abortRequested: false
    };
    this._emit('batchStarted', { operation, total });
  }

  /**
   * Update batch progress
   * @param {number} index - Current page index (0-based)
   * @param {boolean} success - Whether this page succeeded
   */
  updateBatchProgress(index, success) {
    this.data.batch.currentIndex = index;
    if (success) {
      this.data.batch.successCount++;
    } else {
      this.data.batch.errorCount++;
    }
    this._emit('batchProgress', { ...this.data.batch });
  }

  /**
   * Request batch abort (checked in batch loop)
   */
  requestBatchAbort() {
    this.data.batch.abortRequested = true;
    this._emit('batchAbortRequested');
  }

  /**
   * Complete batch operation
   */
  completeBatch() {
    this.data.batch.status = this.data.batch.abortRequested ? 'aborted' : 'complete';
    this._emit('batchComplete', { ...this.data.batch });
  }

  /**
   * Get status of a specific page (for UI indicators)
   * @param {number} pageIndex - Page index (0-based)
   * @returns {object} Status object
   */
  getPageStatus(pageIndex) {
    const page = this.data.pages[pageIndex];
    if (!page) return { hasTranscription: false, hasValidation: false, transcriptionError: false };

    const pageTranscription = this.data.pageTranscriptions[page.id];
    const hasTranscription = !!(pageTranscription?.segments?.length || pageTranscription?.raw);

    const validation = this.data.batchValidations.find(v => v.pageIndex === pageIndex);
    const hasValidation = validation?.success ?? false;

    const transcriptionResult = this.data.batchTranscriptions.find(t => t.pageIndex === pageIndex);
    const transcriptionError = transcriptionResult?.success === false;

    return { hasTranscription, hasValidation, transcriptionError };
  }

  /**
   * Set document context for transcription
   * The expert provides context to improve LLM transcription quality
   * @param {object} context - Context information
   */
  setDocumentContext(context) {
    this.data.context = {
      documentType: context.documentType || '',
      period: context.period || '',
      language: context.language || '',
      description: context.description || '',
      // Extended structured context fields (PPV1-101)
      scriptType: context.scriptType || '',
      century: context.century || '',
      region: context.region || '',
      languages: Array.isArray(context.languages) ? context.languages : [],
      textType: context.textType || '',
      knownText: context.knownText || '',
      timestamp: new Date().toISOString()
    };
    this.data.meta.updatedAt = new Date().toISOString();
    this._emit('contextChanged', this.data.context);
    this._scheduleAutoSave();
  }

  /**
   * Get current document context
   * @returns {object|null} Context or null if not set
   */
  getDocumentContext() {
    return this.data.context || null;
  }

  /**
   * Clear document context
   */
  clearDocumentContext() {
    this.data.context = null;
    this._emit('contextChanged', null);
    this._scheduleAutoSave();
  }

  /**
   * Set regions directly (from PAGE-XML import or manual definition)
   * @param {Array} regions - Array of region objects
   */
  setRegions(regions) {
    this.data.regions = regions;
    this._emit('regionsChanged', { count: regions.length });
  }

  /**
   * Update a single segment (after user edit)
   */
  updateSegment(lineNumber, updates) {
    const segment = this.data.transcription.segments.find(s => s.lineNumber === lineNumber);
    if (segment) {
      const original = { ...segment };
      Object.assign(segment, updates);

      // Track correction
      this.data.corrections.push({
        lineNumber,
        original: original.text,
        corrected: segment.text,
        timestamp: new Date().toISOString()
      });

      // Regenerate lines
      this.data.transcription.lines = this._segmentsToLines(this.data.transcription.segments);

      this.data.meta.updatedAt = new Date().toISOString();
      this._emit('transcriptionUpdated', { lineNumber, segment });
      this._scheduleAutoSave();
    }
  }

  _segmentsToLines(segments) {
    // Convert segments to markdown table lines
    if (!segments.length) return [];

    // Get columns or use default
    const columns = this.data.transcription.columns.length > 0
      ? this.data.transcription.columns
      : [{ id: 'text', label: 'Text' }];

    const lines = [];

    // Header
    lines.push('| ' + columns.map(c => c.label).join(' | ') + ' |');
    lines.push('|' + columns.map(() => '---').join('|') + '|');

    // Data rows
    for (const seg of segments) {
      if (seg.fields) {
        const values = columns.map(c => seg.fields[c.id] || '');
        lines.push('| ' + values.join(' | ') + ' |');
      } else {
        lines.push('| ' + seg.text + ' |');
      }
    }

    return lines;
  }

  /**
   * Rebuild transcription segments from raw text to keep exports in sync.
   * Keeps non-text metadata where possible (id/confidence/polygon/baseline).
   * @private
   * @param {string} text
   */
  _syncTranscriptionSegmentsFromRaw(text) {
    const rawLines = (text || '').split('\n');
    const previousSegments = this.data.transcription.segments || [];

    this.data.transcription.segments = rawLines.map((lineText, index) => {
      const previous = previousSegments[index] || {};
      const next = {
        lineNumber: index + 1,
        text: lineText
      };

      if (previous.id) next.id = previous.id;
      if (previous.confidence) next.confidence = previous.confidence;
      if (previous.polygon) next.polygon = previous.polygon;
      if (previous.baseline) next.baseline = previous.baseline;

      return next;
    });

    this.data.transcription.lines = this._segmentsToLines(this.data.transcription.segments);
  }

  /**
   * Normalize pipeline metadata into canonical object schema.
   * Supports legacy string schema for backward compatibility.
   * @private
   * @param {object|null} pipeline
   * @returns {object|null}
   */
  _normalizePipelineMetadata(pipeline) {
    if (!pipeline || typeof pipeline !== 'object') return null;

    const normalizeStage = (stage) => {
      if (typeof stage === 'string') {
        return { status: stage };
      }
      if (stage && typeof stage === 'object' && typeof stage.status === 'string') {
        const normalized = { status: stage.status };
        if (typeof stage.duration === 'number' && Number.isFinite(stage.duration)) {
          normalized.duration = stage.duration;
        }
        if (typeof stage.reason === 'string' && stage.reason.trim()) {
          normalized.reason = stage.reason;
        }
        return normalized;
      }
      return { status: 'skipped' };
    };

    const normalized = {
      stage2: normalizeStage(pipeline.stage2),
      stage3: normalizeStage(pipeline.stage3)
    };
    if (typeof pipeline.duration === 'number' && Number.isFinite(pipeline.duration)) {
      normalized.duration = pipeline.duration;
    }
    return normalized;
  }

  // ============================================
  // Validation
  // ============================================

  setValidationStatus(status, message = '') {
    this.data.validation.status = status;
    this._emit('validationStatusChanged', { status, message });
  }

  setValidationResults(results) {
    const normalizedPipeline = this._normalizePipelineMetadata(results.llmJudge?.pipeline || null);
    const normalizedLlmJudge = results.llmJudge
      ? {
        ...results.llmJudge,
        pipeline: normalizedPipeline
      }
      : null;

    this.data.validation.rules = results.rules || [];
    this.data.validation.llmJudge = normalizedLlmJudge;
    this.data.validation.summary = results.summary || null;
    this.data.validation.timestamp = results.timestamp || new Date().toISOString();
    this.data.validation.customPrompt = results.customPrompt || this.data.validation.customPrompt || '';
    this.data.validation.pipeline = normalizedPipeline;
    this.data.validation.status = 'complete';
    this.data.meta.updatedAt = new Date().toISOString();
    this._emit('validationComplete', results);
    this._scheduleAutoSave();
  }

  // ============================================
  // UI State
  // ============================================

  setLoading(isLoading, message = '') {
    this.data.ui.isLoading = isLoading;
    this.data.ui.loadingMessage = message;
    this._emit('loadingChanged', { isLoading, message });
  }

  openDialog(dialogName) {
    this.data.ui.activeDialog = dialogName;
    this._emit('dialogOpened', { dialog: dialogName });
  }

  closeDialog() {
    const dialog = this.data.ui.activeDialog;
    this.data.ui.activeDialog = null;
    this._emit('dialogClosed', { dialog });
  }

  setError(error) {
    this.data.ui.error = error;
    this._emit('errorOccurred', { error });
  }

  clearError() {
    this.data.ui.error = null;
    this._emit('errorCleared');
  }

  /**
   * Request a toast notification
   * Decouples UI notification from components that shouldn't import dialogManager
   * @param {string} message - Toast message
   * @param {string} type - Toast type: 'info' | 'success' | 'warning' | 'error'
   * @param {number} duration - Duration in ms (default 3000)
   */
  showToast(message, type = 'info', duration = 3000) {
    this._emit('toastRequested', { message, type, duration });
  }

  // ============================================
  // Project Management
  // ============================================

  /**
   * Create a new project and set it as active
   * @param {string} name - Project name
   * @returns {Promise<object>} The created project
   */
  async createProject(name) {
    const id = generateId();
    const now = new Date().toISOString();
    const project = {
      id,
      name,
      filename: '',
      pageCount: 0,
      hasTranscription: false,
      createdAt: now,
      updatedAt: now
    };
    await storage.createProject(project);
    storage.setActiveProjectId(id);
    this.data.project = { id, name };
    this._emit('projectChanged', { id, name });
    return project;
  }

  /**
   * Switch to a different project (saves current, loads new)
   * @param {string} projectId
   */
  async switchProject(projectId) {
    // Save current project if active
    if (this.data.project.id) {
      await this._saveSession();
    }

    // Load new project
    await this.restoreSession(projectId);
    storage.setActiveProjectId(projectId);
  }

  // ============================================
  // Session Management (async -- IndexedDB)
  // ============================================

  _scheduleAutoSave() {
    const settings = storage.loadSettings();
    if (!settings.autoSave) return;

    if (this._autoSaveTimer) {
      clearTimeout(this._autoSaveTimer);
    }

    this._autoSaveTimer = setTimeout(() => {
      this._saveSession().catch(err =>
        console.warn('[State] Auto-save failed:', err.message)
      );
    }, this._autoSaveDelay);
  }

  async _saveSession() {
    const projectId = this.data.project.id;
    if (!projectId) return;

    // Save current page data before session save
    this._saveCurrentPageTranscription();
    this._saveCurrentPageDescription();
    this._saveCurrentPageValidation();

    // Session data -- images are stored separately in IDB images store
    const { dataUrl: _docImg, ...documentWithoutImage } = this.data.document;
    const pagesWithoutImages = this.data.pages.map(({ dataUrl: _pageImg, ...rest }) => rest);

    try {
      await storage.saveSession(projectId, {
        document: documentWithoutImage,
        transcription: this.data.transcription,
        description: this.data.description,
        pageDescriptions: this.data.pageDescriptions,
        batchDescriptions: this.data.batchDescriptions,
        validation: this.data.validation,
        corrections: this.data.corrections,
        regions: this.data.regions,
        context: this.data.context || null,
        meta: this.data.meta,
        pages: pagesWithoutImages,
        currentPageIndex: this.data.currentPageIndex,
        pageTranscriptions: this.data.pageTranscriptions,
        batchTranscriptions: this.data.batchTranscriptions,
        batchValidations: this.data.batchValidations
      });

      // Update project metadata
      const hasTranscription = this.data.transcription?.segments?.length > 0 ||
        this.data.transcription?.raw?.trim().length > 0 ||
        Object.keys(this.data.pageTranscriptions).length > 0;

      await storage.updateProject(projectId, {
        filename: this.data.document.filename || this.data.pages[0]?.filename || '',
        pageCount: Math.max(1, this.data.pages.length),
        hasTranscription
      });

      this._emit('sessionSaved');
    } catch (error) {
      console.error('[State] Save session failed:', error.message);
      throw error; // Re-throw to let callers handle the error
    }
  }

  /**
   * Restore session from IndexedDB for a project
   * @param {string} projectId
   * @returns {Promise<boolean>} true if restored
   */
  async restoreSession(projectId) {
    const project = await storage.getProject(projectId);
    if (!project) return false;

    const session = await storage.loadSession(projectId);

    // Set project info
    this.data.project = { id: project.id, name: project.name };
    storage.setActiveProjectId(projectId);

    if (session) {
      // Restore data
      if (session.document) this.data.document = { ...this.data.document, ...session.document };
      if (session.transcription) this.data.transcription = session.transcription;
      if (session.description) this.data.description = session.description;
      if (session.validation) {
        this.data.validation = {
          status: 'idle',
          rules: [],
          llmJudge: null,
          summary: null,
          timestamp: null,
          customPrompt: '',
          pipeline: null,
          ...session.validation
        };
      }
      if (session.corrections) this.data.corrections = session.corrections;
      if (session.regions) this.data.regions = session.regions;
      if (session.context !== undefined) this.data.context = session.context;
      if (session.meta) this.data.meta = session.meta;

      // Restore multi-page data
      if (session.pages) this.data.pages = session.pages;
      if (session.currentPageIndex !== undefined) this.data.currentPageIndex = session.currentPageIndex;
      if (session.pageTranscriptions) this.data.pageTranscriptions = session.pageTranscriptions;
      if (session.pageDescriptions) this.data.pageDescriptions = session.pageDescriptions;
      if (session.batchTranscriptions) this.data.batchTranscriptions = session.batchTranscriptions;
      if (session.batchDescriptions) this.data.batchDescriptions = session.batchDescriptions;
      if (session.batchValidations) this.data.batchValidations = session.batchValidations;
    } else {
      // Reset to empty state when no session exists (prevents stale data from previous project)
      this.data.document = { id: null, filename: '', mimeType: '', dataUrl: '', width: 0, height: 0 };
      this.data.image = { url: '', width: 0, height: 0 };
      this.data.transcription = { id: null, provider: '', model: '', raw: '', segments: [], columns: [], lines: [] };
      this.data.description = { id: null, provider: 'gemini', model: '', customPrompt: '', raw: '', timestamp: null };
      this.data.pageDescriptions = {};
      this.data.batchDescriptions = [];
      this.data.validation = { status: 'idle', rules: [], llmJudge: null, summary: null, timestamp: null, customPrompt: '', pipeline: null };
      this.data.corrections = [];
      this.data.regions = [];
      this.data.context = null;
      this.data.meta = { createdAt: null, updatedAt: null };
      this.data.pages = [];
      this.data.currentPageIndex = 0;
      this.data.pageTranscriptions = {};
      this.data.batchTranscriptions = [];
      this.data.batchValidations = [];
      this.data.batch = {
        operation: null,
        status: 'idle',
        currentIndex: 0,
        total: 0,
        successCount: 0,
        errorCount: 0,
        abortRequested: false
      };
    }

    // Restore images from IDB
    const images = await storage.loadAllImages(projectId);
    if (Object.keys(images).length > 0) {
      // Restore single-doc image
      if (this.data.document.id && images[this.data.document.id]) {
        this.data.document.dataUrl = images[this.data.document.id];
        this.data.image.url = this.data.document.dataUrl;
      }
      // Restore page images
      for (const page of this.data.pages) {
        if (images[page.id]) {
          page.dataUrl = images[page.id];
        }
      }
      // If on a specific page, update current doc/image
      const currentPage = this.data.pages[this.data.currentPageIndex];
      if (currentPage?.dataUrl) {
        this.data.document.dataUrl = currentPage.dataUrl;
        this.data.image.url = currentPage.dataUrl;
      }
    }

    this._emit('projectChanged', { id: project.id, name: project.name });
    this._emit('sessionRestored', { projectId });
    this._emit('documentLoaded', {
      filename: this.data.document.filename || '',
      mimeType: this.data.document.mimeType || ''
    });
    if (this.data.document.dataUrl) {
      this._emit('imageChanged', { url: this.data.document.dataUrl });
    }
    if (this.data.pages.length > 0) {
      this._emit('pagesLoaded', {
        count: this.data.pages.length,
        pages: this.data.pages.map(p => ({ id: p.id, filename: p.filename }))
      });
    }
    if (this.data.description?.raw) {
      this._emit('descriptionComplete', {
        provider: this.data.description.provider,
        model: this.data.description.model
      });
    }
    if (this.data.validation?.status === 'complete') {
      this._emit('validationComplete', {
        rules: this.data.validation.rules,
        llmJudge: this.data.validation.llmJudge,
        summary: this.data.validation.summary
      });
    }

    return true;
  }

  async saveSessionNow() {
    await this._saveSession();
  }

  async clearSession() {
    const projectId = this.data.project.id;
    if (projectId) {
      await storage.clearSession(projectId);
    }
    this._emit('sessionCleared');
  }

  // ============================================
  // Event Emission
  // ============================================

  _emit(eventName, detail = {}) {
    this.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
}

// Export singleton instance
export const appState = new AppState();
