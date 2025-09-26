// Simple Service Worker para Renda AI
// Simplified to avoid conflicts with Workbox in production

const CACHE_NAME = 'renda-ai-simple-v1.0.1';

// Minimal caching for offline support
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Simple fetch handler - only cache essentials
self.addEventListener('fetch', (event) => {
  // Only handle navigation requests for offline support
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/') || caches.match('/index.html');
      })
    );
  }
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
