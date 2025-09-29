// Service Worker para Renda AI
// Gerado automaticamente pelo sistema de branding

const CACHE_NAME = 'renda-ai-v1.0.1';
const urlsToCache = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/App.css',
  '/src/index.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});

// Push notification handling
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      data: data.data,
      vibrate: [200, 100, 200],
      requireInteraction: false,
      actions: [
        {
          action: 'view',
          title: 'Ver'
        },
        {
          action: 'dismiss',
          title: 'Dispensar'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    // Open the app and navigate based on notification type
    const data = event.notification.data;
    let url = '/';
    
    if (data?.type === 'expense_reminder') {
      url = '/expenses';
    } else if (data?.type === 'goal_deadline') {
      url = '/goals';
    } else if (data?.type === 'scheduled_transaction') {
      url = '/schedule';
    }

    event.waitUntil(
      clients.openWindow(url)
    );
  }
});

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
});
