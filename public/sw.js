// Service Worker para Renda AI com Workbox
// Este arquivo será processado pelo VitePWA injectManifest
// Firebase Messaging é gerenciado separadamente por firebase-messaging-sw.js

// Workbox vai injetar a lista de arquivos aqui
const manifest = self.__WB_MANIFEST;

const CACHE_NAME = 'renda-ai-runtime-v1';

// Install: precache dos arquivos do manifest
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Os arquivos do manifest serão cacheados automaticamente pelo Workbox
      return cache.addAll(manifest.map(entry => entry.url || entry));
    })
  );
  self.skipWaiting();
});

// Activate: limpar caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: estratégia de cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request).then((response) => {
        // Cachear respostas válidas
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      });
    })
  );
});

// Notification clicks são gerenciados pelo firebase-messaging-sw.js
