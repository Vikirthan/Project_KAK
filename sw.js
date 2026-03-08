/* =========================================
   KAK HYGIENE SYSTEM – SERVICE WORKER (V2)
   Optimized for Subdirectory/GitHub Pages
   ========================================= */

const CACHE_NAME = 'kak-cache-v2';
const ASSETS_TO_CACHE = [
    'index.html',
    'css/style.css',
    'css/login.css',
    'js/app.js',
    'js/login.js',
    'icon-192.png',
    'icon-512.png',
    'manifest.json'
];

// Install Event: Cache critical assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Pre-caching critical assets');
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => self.skipWaiting())
    );
});

// Activate Event: Clear old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[SW] Clearing old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event: Mixed Strategy
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. API Calls (Supabase) — Network ONLY
    if (url.hostname.includes('supabase.co')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // 2. Static Assets — Stale-While-Revalidate
    if (event.request.method === 'GET') {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                const fetchedResponse = fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                }).catch(() => cachedResponse);

                return cachedResponse || fetchedResponse;
            })
        );
    }
});

// Notification Click Handler: Deep Linking
self.addEventListener('notificationclick', (event) => {
    const notification = event.notification;
    const ticketId = (notification.data && notification.data.ticketId) ? notification.data.ticketId : null;
    const role = (notification.data && notification.data.role) ? notification.data.role : 'supervisor';

    event.notification.close();

    // Focus existing window or open new one
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Determine the URL to open
            let targetUrl = role === 'supervisor' ? 'supervisor/index.html' : 'index.html';
            if (ticketId) targetUrl += `?ticketId=${ticketId}`;

            // Try to find an open window belonging to the appropriate portal
            for (let client of windowClients) {
                if (client.url.includes(role) && 'focus' in client) {
                    return client.focus().then(c => {
                        if (ticketId) return c.navigate(targetUrl);
                        return c;
                    });
                }
            }

            // If no window found, open a new one
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
