// sw.js

const CACHE_NAME = 'safar-cache-v12';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './demo.html',
  './extras/favicon.png',

  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',

  './js/ambient.js',
  './js/audio.js',
  './js/backup.js',
  './js/boot.js',
  './js/campfire.js',
  './js/config.js',
  './js/demo.js',
  './js/draw.js',
  './js/enemies.js',
  './js/flow.js',
  './js/grading.js',
  './js/guide.js',
  './js/input.js',
  './js/journal.js',
  './js/lessons.js',
  './js/loop.js',
  './js/player.js',
  './js/render3d.js',
  './js/review.js',
  './js/rooms.js',
  './js/run_save.js',
  './js/srs.js',
  './js/state.js',
  './js/storage.js',
  './js/story.js',
  './js/study.js',
  './js/summary.js',
  './js/sync.js',

  './lessons/aby1_10.json',
  './lessons/aby1_1_numbers.json',
  './lessons/aby1_1a.json',
  './lessons/aby1_1b.json',
  './lessons/aby1_2a.json',
  './lessons/aby1_2b.json',
  './lessons/aby1_3a.json',
  './lessons/aby1_3b.json',
  './lessons/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('SW: some assets failed to cache', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.map(n => n !== CACHE_NAME ? caches.delete(n) : null)
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.hostname.endsWith('.supabase.co')) return;

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(resp => {
        if (!resp || resp.status !== 200 || resp.type === 'opaque') return resp;
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
        return resp;
      }).catch(() => cached);
    })
  );
});
