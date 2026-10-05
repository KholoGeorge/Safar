// sw.js

// Bump this version number whenever you change your files
const CACHE_NAME = 'safar-cache-v3';

const ASSETS_TO_CACHE = [
  // --- Core App Files ---
  './',
  './index.html',
  './styles.css',
  './demo.html',
  
  // --- JavaScript Files ---
  './js/storage.js',
  './js/config.js',
  './js/state.js',
  './js/audio.js',
  './js/lessons.js',
  './js/story.js',
  './js/study.js',
  './js/rooms.js',
  './js/player.js',
  './js/enemies.js',
  './js/draw.js',
  './js/loop.js',
  './js/input.js',
  './js/flow.js',
  './js/demo.js',
  './js/boot.js',
  
  // --- Lesson Data (from your screenshot) ---
  './lessons/manifest.json',
  './lessons/aby1_1a.json',
  './lessons/aby1_1b.json',
  './lessons/aby1_2a.json',
  './lessons/aby1_2b.json',
  
  // --- Full Dialogue Audio (from your screenshot) ---
  './audio/1_1a_full.mp3',
  './audio/1_1b_full.mp3',
  './audio/1_2a_full.mp3',
  './audio/1_2b_full.mp3',

  // --- Individual Phrase Audio ---
  // IMPORTANT: You need to add the individual .mp3 files here.
  // For example:
  // './audio/1_1a_salam.mp3',
  // './audio/1_1a_waalaykum.mp3',
  // './audio/1_1a_khalid.mp3',
  // ... and so on for every phrase in your JSON files.
  
  // --- Icons / Extras ---
  './extras/favicon.png'
];

// 1. The 'install' event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. The 'fetch' event (Cache-First strategy)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // If the file is in our cache, return it.
      if (response) {
        return response;
      }
      // Otherwise, try to fetch it from the network.
      return fetch(event.request);
    })
  );
});

// 3. The 'activate' event (Cleans up old caches)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
