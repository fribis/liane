// Minimaler Service-Worker für PWA-Install + Offline-Erstaufruf.
// Strategie: network-first, mit Cache-Fallback. Cache-Version bei Updates erhöhen.

const CACHE = 'liane-v1';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/main.js',
  './src/input.js',
  './src/touch.js',
  './src/render.js',
  './src/level.js',
  './src/player.js',
  './src/camera.js',
  './src/physics.js',
  './src/ui.js',
  './src/powerup.js',
  './src/bubble.js',
  './src/liana.js',
  './src/tree.js',
  './src/flag.js',
  './src/enemies/bird.js',
  './src/enemies/scorpion.js',
  './src/enemies/spider.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Cache-Bust-Querystrings (?v=…) ignorieren wir und cachen nur die Basis-URL.
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((m) => m || caches.match('./index.html')))
  );
});
