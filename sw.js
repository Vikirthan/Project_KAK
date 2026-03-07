/* ===========================
   KAK SYSTEM – SERVICE WORKER
   =========================== */

const CACHE_NAME = 'kak-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './css/style.css',
    './css/login.css',
    './js/app.js',
    './js/login.js',
    './icon-192.png',
    './icon-512.png',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => response || fetch(event.request))
    );
});
