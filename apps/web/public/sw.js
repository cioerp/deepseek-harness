/* DeepSeek Harness installability service worker: pass-through only, and
   only for static GETs. The /api plane (RPCs, SSE) and every non-GET bypass
   the service worker entirely — a SW hop must never become a failure point
   for the harness's live traffic. Registering a fetch handler is what makes
   the PWA installable on Android Chrome. */
self.addEventListener('install', () => { self.skipWaiting() })
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()) })
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) return
  event.respondWith(fetch(event.request))
})
