/**
 * Service Worker for coOCR/HTR Workbench
 * Enables offline functionality by caching static assets
 */

// Bumping the version makes browsers install this worker and drop the old cache.
const CACHE_VERSION = 'coocr-v2';

// Static assets to cache on install
const STATIC_ASSETS = [
    './',
    './index.html',
    './help.html',
    './about.html',
    './manifest.json',
    // CSS
    './css/variables.css',
    './css/base.css',
    './css/layout.css',
    './css/components.css',
    './css/viewer.css',
    './css/editor.css',
    './css/validation.css',
    './css/dialogs.css',
    './css/pages.css',
    './css/styles.css',
    // JavaScript - Main
    './js/main.js',
    './js/state.js',
    './js/editor.js',
    './js/viewer.js',
    './js/ui.js',
    // JavaScript - Services
    './js/services/storage.js',
    './js/services/llm.js',
    './js/services/export.js',
    './js/services/validation.js',
    './js/services/samples.js',
    // JavaScript - Parsers
    './js/services/parsers/page-xml.js',
    './js/services/parsers/mets-xml.js',
    // JavaScript - Components
    './js/components/dialogs.js',
    './js/components/upload.js',
    './js/components/transcription.js',
    './js/components/validation.js',
    './js/components/context.js',
    // JavaScript - Utils
    './js/utils/constants.js',
    './js/utils/dom.js',
    './js/utils/textFormatting.js',
    // Assets
    './assets/logo.png',
    './assets/logo-icon.png'
];

// API endpoints that should never be cached
const API_HOSTS = [
    'generativelanguage.googleapis.com',
    'api.openai.com',
    'api.anthropic.com',
    'localhost:11434'  // Ollama
];

/**
 * Install event - cache static assets
 */
self.addEventListener('install', event => {
    console.log('[SW] Installing service worker...');

    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then(cache => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] Static assets cached');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('[SW] Failed to cache assets:', error);
            })
    );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', event => {
    console.log('[SW] Activating service worker...');

    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== CACHE_VERSION)
                        .map(name => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Service worker activated');
                return self.clients.claim();
            })
    );
});

/**
 * Fetch event - serve from network, fall back to cache when offline
 */
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Skip API calls - let them go to network
    if (API_HOSTS.some(host => url.hostname.includes(host))) {
        return;
    }

    // Skip cross-origin requests (IIIF, external resources)
    if (url.origin !== self.location.origin) {
        return;
    }

    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Network first, cache only as offline fallback. Cache-first kept serving
    // the modules of the first visit after every later deploy.
    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_VERSION)
                        .then(cache => cache.put(event.request, responseToCache));
                }
                return networkResponse;
            })
            .catch(async () => {
                const cached = await caches.match(event.request);
                if (cached) return cached;
                if (event.request.headers.get('accept')?.includes('text/html')) {
                    return caches.match('./index.html');
                }
                return Response.error();
            })
    );
});

/**
 * Message event - handle commands from main thread
 */
self.addEventListener('message', event => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
