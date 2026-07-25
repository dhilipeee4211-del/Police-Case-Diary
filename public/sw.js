/**
 * AI Case Diary PWA - Service Worker
 */

const CACHE_NAME = 'case-diary-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Fail gracefully during asset install if not online/reachable
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle standard HTTP/HTTPS requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        // Cache new asset responses
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          // Do not cache API endpoints or dynamic auth
          if (!event.request.url.includes('/api/') && !event.request.url.includes('/__/auth/')) {
            cache.put(event.request, responseToCache);
          }
        });
        
        return response;
      }).catch(() => {
        // Fallback for offline fetch errors
      });
    })
  );
});
