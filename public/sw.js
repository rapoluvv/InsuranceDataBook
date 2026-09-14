const CACHE_VERSION = 'v2';
const CACHE_NAME = `databook-shell-${CACHE_VERSION}`;
const CACHE_PREFIX = 'databook-shell-';
const APP_SHELL_URL = new URL('index.html', self.registration.scope).toString();

const isCacheableResponse = (response) => response && response.ok && response.type === 'basic';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(APP_SHELL_URL)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      )
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  const acceptsHtml = request.headers.get('accept')?.includes('text/html');
  if (request.mode === 'navigate' || request.destination === 'document' || acceptsHtml) {
    event.respondWith(
      fetch(request).then(async (response) => {
        if (response.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.add(APP_SHELL_URL)).catch(() => {});
          return response;
        }

        const cachedShell = await caches.match(APP_SHELL_URL);
        return cachedShell || response;
      }).catch(async () => {
        const cachedShell = await caches.match(APP_SHELL_URL);
        return cachedShell || new Response('Offline', {
          status: 503,
          statusText: 'Offline',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        if (isCacheableResponse(response)) {
          const responseForCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseForCache));
        }
        return response;
      });
    }),
  );
});
