/**
 * constants.js - Centralized magic numbers, strings, and configuration values
 * coOCR/HTR Application
 */

// =============================================================================
// TIMING CONSTANTS
// =============================================================================

/** Default toast notification duration in milliseconds */
export const TOAST_DURATION_DEFAULT = 3000;

/** Toast animation duration in milliseconds */
export const TOAST_ANIMATION_DURATION = 300;

/** Autosave debounce delay in milliseconds */
export const AUTOSAVE_DELAY = 1000;

/** Focus delay for dialog inputs in milliseconds */
export const DIALOG_FOCUS_DELAY = 50;

/** Page reload delay after clear session in milliseconds */
export const PAGE_RELOAD_DELAY = 500;

/** URL revoke delay for downloads in milliseconds */
export const URL_REVOKE_DELAY = 100;

/** Validation menu close delay in milliseconds */
export const MENU_CLOSE_DELAY = 150;

// =============================================================================
// FILE SIZE LIMITS
// =============================================================================

/** Maximum file upload size in bytes (50MB) */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Maximum file size in MB for display */
export const MAX_FILE_SIZE_MB = 50;

// =============================================================================
// UI LIMITS
// =============================================================================

/** Maximum number of preview labels to show in IIIF dialog */
export const MAX_PREVIEW_LABELS = 5;

/** Zoom percentage conversion factor */
export const ZOOM_PERCENT_FACTOR = 100;

// =============================================================================
// API ENDPOINTS
// =============================================================================

/** Default Ollama endpoint */
export const DEFAULT_OLLAMA_ENDPOINT = 'http://localhost:11434';

/** Gemini API base URL */
export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** OpenAI API endpoint */
export const OPENAI_API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

/** Anthropic API endpoint */
export const ANTHROPIC_API_ENDPOINT = 'https://api.anthropic.com/v1/messages';

// =============================================================================
// IIIF CONSTANTS
// =============================================================================

/** IIIF Presentation API version 3 context */
export const IIIF_CONTEXT_V3 = 'presentation/3';

/** IIIF API versions */
export const IIIF_VERSION = {
    V2: 2,
    V3: 3
};

// =============================================================================
// STORAGE KEYS
// =============================================================================

export const STORAGE_KEYS = {
    SETTINGS: 'coocr_settings',
    SESSION: 'coocr_session',
    API_KEYS: 'coocr_api_keys',
    DISMISSED_HINTS: 'coocr_hints_dismissed'
};

// =============================================================================
// EVENT NAMES
// =============================================================================

export const EVENTS = {
    STATE_CHANGED: 'stateChanged',
    SELECTION_CHANGED: 'selectionChanged',
    TRANSCRIPTION_CHANGED: 'transcriptionChanged',
    VALIDATION_RESULTS: 'validationResults',
    PAGE_CHANGED: 'pageChanged',
    IMAGE_LOADED: 'imageLoaded',
    ZOOM_CHANGED: 'zoomChanged',
    SET_ZOOM: 'setZoom'
};

// =============================================================================
// CSS CLASSES
// =============================================================================

export const CSS_CLASSES = {
    HIDDEN: 'hidden',
    ACTIVE: 'active',
    LOADING: 'loading',
    VISIBLE: 'visible',
    SELECTED: 'selected',
    COMPLETED: 'completed'
};

// =============================================================================
// PAGE-XML CONSTANTS
// =============================================================================

/** PAGE-XML namespace */
export const PAGE_XML_NAMESPACE = 'http://schema.primaresearch.org/PAGE/gts/pagecontent/2019-07-15';

// =============================================================================
// CONFIDENCE CATEGORIES
// =============================================================================

export const CONFIDENCE = {
    CONFIDENT: 'confident',
    UNCERTAIN: 'uncertain',
    PROBLEMATIC: 'problematic'
};

/** Confidence threshold for normalization (values > 1 are assumed to be percentages) */
export const CONFIDENCE_THRESHOLD_PERCENT = 1;

// =============================================================================
// TOAST TYPES
// =============================================================================

export const TOAST_TYPES = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
};

// =============================================================================
// DOCUMENT TYPES
// =============================================================================

export const DOCUMENT_TYPES = {
    TABLE: 'table',
    TEXT: 'text'
};

// =============================================================================
// IMAGE PROCESSING
// =============================================================================

/** JPEG quality for canvas export (0.0 - 1.0) */
export const JPEG_QUALITY = 0.9;
