// sw.js

// Bump this version number whenever you change your files
const CACHE_NAME = 'safar-cache-v5';

const ASSETS_TO_CACHE = [
  // --- Core App Files ---
  './',
  './index.html',
  './styles.css',
  './demo.html',
  
  // --- JavaScript Files ---
  './js/ambient.js'
  './js/audio.js',
  './js/boot.js',
  './js/config.js',
  './js/demo.js',
  './js/draw.js',
  './js/enemies.js',
  './js/flow.js',
  './js/input.js',
  './js/lessons.js',
  './js/loop.js',
  './js/player.js',
  './js/rooms.js',
  './js/state.js',
  './js/storage.js',
  './js/story.js',
  './js/study.js',
  
  // --- Lesson Data (from your screenshot) ---
  './lessons/aby1_10.json'
  './lessons/aby1_1_numbers.json'
  './lessons/aby1_1a.json',
  './lessons/aby1_1b.json',
  './lessons/aby1_2a.json',
  './lessons/aby1_2b.json',
  './lessons/aby1_3a.json'
  './lessons/aby1_3b.json'
  './lessons/manifest.json',
  
  // --- Full Dialogue Audio (from your screenshot) ---
  './audio/1_10_full.mp3'
  './audio/1_11_full.mp3'
  './audio/1_1a_full.mp3',
  './audio/1_1b_full.mp3',
  './audio/1_1numbers_full.mp3'
  './audio/1_2a_full.mp3',
  './audio/1_2b_full.mp3',
  './audio/1_3a_full.mp3'
  './audio/1_3b_full.mp3'

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
  self.skipWaiting();   // activate immediately, don't wait for old clients
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache', CACHE_NAME);
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. The 'fetch' event (Cache-First strategy)
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
    }).then(() => self.clients.claim())   // take over open pages right now
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
