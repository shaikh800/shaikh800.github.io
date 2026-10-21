/* Service worker for mdshaikh.me
   - Own files (pages, css, js, images): network first, so every edit shows up
     right away; if the network is slow (3 s) or offline, the saved copy is used.
   - Versioned cdnjs libraries (Font Awesome, jsPDF, html2pdf...): cache first,
     because those exact URLs never change.
   - Everything else (Google sign-in and Drive, GitHub API, Cloudflare Workers,
     Apps Script, JSON data files) is NOT touched at all. */
const VERSION = 'v1';
const PAGE_CACHE = 'mdshaikh-' + VERSION;
const CDN_CACHE = 'mdshaikh-cdn-' + VERSION;
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k !== PAGE_CACHE && k !== CDN_CACHE).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

function timeoutAfter(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function networkFirst(request) {
  const cache = await caches.open(PAGE_CACHE);
  const net = fetch(request);
  net.catch(() => {});
  try {
    const res = await Promise.race([net, timeoutAfter(NETWORK_TIMEOUT_MS)]);
    if (res && res.status === 200) {
      cache.put(request, res.clone()).catch(() => {});
    }
    return res;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return net;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CDN_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res && (res.status === 200 || res.type === 'opaque')) {
    cache.put(request, res.clone()).catch(() => {});
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith('.json')) return; // data files always read live
    event.respondWith(networkFirst(req));
    return;
  }

  if (url.hostname === 'cdnjs.cloudflare.com') {
    event.respondWith(cacheFirst(req));
  }
});
