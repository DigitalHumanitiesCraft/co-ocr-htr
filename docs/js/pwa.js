/**
 * PWA Support Module
 * Handles service worker registration and offline indicator
 */

/**
 * Initialize PWA features
 * - Register service worker
 * - Set up offline indicator
 */
export async function initPWA() {
    // Register service worker
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('./sw.js', {
                scope: './'
            });

            console.log('coOCR/HTR: Service Worker registered', registration.scope);

            // Check for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('coOCR/HTR: New service worker installing...');

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New version available
                        console.log('coOCR/HTR: New version available');
                        showUpdateNotification();
                    }
                });
            });

        } catch (error) {
            console.warn('coOCR/HTR: Service Worker registration failed:', error);
        }
    }

    // Set up offline indicator
    setupOfflineIndicator();
}

/**
 * Set up offline/online status indicator
 */
function setupOfflineIndicator() {
    // Initial state
    updateOnlineStatus();

    // Listen for connectivity changes
    window.addEventListener('online', () => {
        updateOnlineStatus();
        showConnectivityToast('online');
    });

    window.addEventListener('offline', () => {
        updateOnlineStatus();
        showConnectivityToast('offline');
    });
}

/**
 * Update the offline indicator UI
 */
function updateOnlineStatus() {
    const indicator = document.getElementById('offlineIndicator');
    if (!indicator) return;

    if (navigator.onLine) {
        indicator.hidden = true;
        indicator.setAttribute('aria-hidden', 'true');
    } else {
        indicator.hidden = false;
        indicator.setAttribute('aria-hidden', 'false');
    }
}

/**
 * Show a toast notification for connectivity changes
 * @param {string} status - 'online' or 'offline'
 */
function showConnectivityToast(status) {
    // Use the app's toast system via state event
    const event = new CustomEvent('toastRequested', {
        detail: {
            message: status === 'online'
                ? 'Connection restored'
                : 'You are offline. Some features may be unavailable.',
            type: status === 'online' ? 'success' : 'warning',
            duration: status === 'online' ? 2000 : 5000
        }
    });

    // Dispatch to appState if available, otherwise to window
    const target = window.appState || window;
    target.dispatchEvent(event);
}

/**
 * Show update notification when new version is available
 */
function showUpdateNotification() {
    const event = new CustomEvent('toastRequested', {
        detail: {
            message: 'New version available. Reload to update.',
            type: 'info',
            duration: 10000
        }
    });

    const target = window.appState || window;
    target.dispatchEvent(event);
}

/**
 * Check if app is running as installed PWA
 * @returns {boolean}
 */
export function isInstalledPWA() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
}

/**
 * Check if app can be installed
 * @returns {boolean}
 */
export function canInstall() {
    return 'BeforeInstallPromptEvent' in window;
}
