/**
 * TravelSathi - Progressive Web App (PWA) Service Worker
 * Enables offline caching, fast asset delivery, and Google Bubblewrap / GitHub Pages / PWA Builder compatibility.
 */

const CACHE_NAME = 'travelsathi-pwa-v1.3';

const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './assests/logo.png',
    './assests/topbar.avif',
    './assests/icon-96.png',
    './assests/icon-192.png',
    './assests/icon-512.png',
    './assests/icon-maskable-512.png',
    './frontend/html/index.html',
    './frontend/html/login.html',
    './frontend/html/weather.html',
    './frontend/html/alerts.html',
    './frontend/html/map.html',
    './frontend/html/sos.html',
    './frontend/html/profile.html',
    './frontend/html/privacy.html',
    './frontend/css/style.css',
    './frontend/css/weather.css',
    './frontend/css/alerts.css',
    './frontend/css/map.css',
    './frontend/css/sos.css',
    './frontend/css/profile.css',
    './frontend/css/login.css',
    './frontend/css/privacy.css',
    './backend/firebase-config.js',
    './backend/db.js',
    './backend/safety-analysis.js',
    './backend/index.js',
    './backend/weather.js',
    './backend/alerts.js',
    './backend/maps.js',
    './backend/sos.js',
    './backend/profile.js',
    './backend/login.js'
];

// Install Event: Cache Core App Shell Assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[TravelSathi SW] Pre-caching App Shell');
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('[TravelSathi SW] Some assets could not be cached on install:', err);
            });
        })
    );
    self.skipWaiting();
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(
                keyList.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[TravelSathi SW] Removing old cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event: Stale-While-Revalidate for static assets, Network-first for APIs
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Bypass caching for external cross-origin APIs (Open-Meteo, Firebase, BigDataCloud)
    if (url.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Background revalidation
                fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, networkResponse);
                        });
                    }
                }).catch(() => { });

                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            }).catch(() => {
                // Offline fallback
                if (event.request.headers.get('accept')?.includes('text/html')) {
                    return caches.match('./frontend/html/index.html') || caches.match('./index.html');
                }
            });
        })
    );
});
