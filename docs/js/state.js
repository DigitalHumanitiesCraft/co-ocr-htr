/**
 * prototype/js/state.js
 * Central State Management with EventTarget
 */

import { storage } from './services/storage.js';

/**
 * Generate a simple UUID v4
 */
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Application State
 * Central state management using native EventTarget for event dispatching
 */
class AppState extends EventTarget {
  constructor() {
    super();

    this.data = {
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

      // Validation state
      validation: {
        status: 'idle',     // idle | running | complete | error
        rules: [],          // Rule-based validation results
        llmJudge: null,     // LLM-judge validation result
        perspective: 'paleographic'  // Current perspective
      },

      // Corrections made by user
      corrections: [],

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

    // Try to restore session
    this._restoreSession();
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

  // ============================================
  // Document Management
  // ============================================

  /**
   * Set document from uploaded file
   * @param {File} file - The uploaded file
   * @param {string} dataUrl - Base64 data URL
   */
  setDocument(file, dataUrl) {
    this.data.document = {
      id: generateId(),
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
    this.data.validation = {
      status: 'idle',
      rules: [],
      llmJudge: null,
      perspective: this.data.validation.perspective
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
  }

  /**
   * Navigate to a specific page
   * @param {number} index - 0-based page index
   */
  goToPage(index) {
    if (index < 0 || index >= this.data.pages.length) return;
    if (index === this.data.currentPageIndex) return;

    // Save current page transcription
    this._saveCurrentPageTranscription();

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

    // Reset validation
    this.data.validation = {
      status: 'idle',
      rules: [],
      llmJudge: null,
      perspective: this.data.validation.perspective
    };

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

    if (this.data.transcription.segments?.length > 0) {
      this.data.pageTranscriptions[page.id] = {
        segments: this.data.transcription.segments,
        columns: this.data.transcription.columns,
        provider: this.data.transcription.provider,
        model: this.data.transcription.model,
        regions: this.data.regions
      };
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
    this.data.transcription = {
      ...this.data.transcription,
      id: generateId(),
      provider: data.provider || '',
      model: data.model || '',
      raw: data.raw || '',
      segments: data.segments || [],
      columns: data.columns || [],
      lines: data.lines || this._segmentsToLines(data.segments || [])
    };

    // Update regions from segments - only use real coordinates (from PAGE-XML)
    // LLM transcriptions without coordinates will not have regions displayed
    if (data.segments?.length > 0) {
      this.data.regions = data.segments
        .filter(s => s.bounds && s.bounds.width > 0 && s.bounds.height > 0)
        .map(s => ({
          line: s.lineNumber,
          x: s.bounds.x,
          y: s.bounds.y,
          w: s.bounds.width,
          h: s.bounds.height
        }));
    }

    this.data.meta.updatedAt = new Date().toISOString();
    this._emit('transcriptionComplete', {
      provider: data.provider,
      segmentCount: data.segments?.length || 0
    });
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

  // ============================================
  // Validation
  // ============================================

  setValidationStatus(status, message = '') {
    this.data.validation.status = status;
    this._emit('validationStatusChanged', { status, message });
  }

  setValidationResults(results) {
    this.data.validation.rules = results.rules || [];
    this.data.validation.llmJudge = results.llmJudge || null;
    this.data.validation.status = 'complete';
    this.data.meta.updatedAt = new Date().toISOString();
    this._emit('validationComplete', results);
    this._scheduleAutoSave();
  }

  setPerspective(perspective) {
    this.data.validation.perspective = perspective;
    this._emit('perspectiveChanged', { perspective });
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

  // ============================================
  // Session Management
  // ============================================

  _scheduleAutoSave() {
    const settings = storage.loadSettings();
    if (!settings.autoSave) return;

    if (this._autoSaveTimer) {
      clearTimeout(this._autoSaveTimer);
    }

    this._autoSaveTimer = setTimeout(() => {
      this._saveSession();
    }, this._autoSaveDelay);
  }

  _saveSession() {
    storage.saveSession({
      document: this.data.document,
      transcription: this.data.transcription,
      validation: this.data.validation,
      corrections: this.data.corrections,
      regions: this.data.regions,
      meta: this.data.meta
    });
    this._emit('sessionSaved');
  }

  _restoreSession() {
    const session = storage.loadSession();
    if (session?.data) {
      // Restore data
      if (session.data.document) this.data.document = session.data.document;
      if (session.data.transcription) this.data.transcription = session.data.transcription;
      if (session.data.validation) this.data.validation = session.data.validation;
      if (session.data.corrections) this.data.corrections = session.data.corrections;
      if (session.data.regions) this.data.regions = session.data.regions;
      if (session.data.meta) this.data.meta = session.data.meta;

      // Update legacy image
      if (session.data.document?.dataUrl) {
        this.data.image.url = session.data.document.dataUrl;
      }

      this._emit('sessionRestored', { timestamp: session.timestamp });
    }
  }

  saveSessionNow() {
    this._saveSession();
  }

  clearSession() {
    storage.clearSession();
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
