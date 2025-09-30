// Service Worker para Renda AI com Workbox + Firebase
// Este arquivo será processado pelo VitePWA injectManifest

// Importar Firebase
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Configuração Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAJMcwMil-dpZ9JsN9Ikwz_SqIz89huFFw",
  authDomain: "renda-ai-8e279.firebaseapp.com",
  projectId: "renda-ai-8e279",
  storageBucket: "renda-ai-8e279.firebasestorage.app",
  messagingSenderId: "993762838881",
  appId: "1:993762838881:web:19bc2019fde8e546671d20"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

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

// Push notification handling (FCM)
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Received background FCM message:', payload);

  const notificationTitle = payload.notification?.title || 'Nova Notificação';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: payload.data?.type || 'default',
    data: payload.data || {},
    requireInteraction: false,
    vibrate: [200, 100, 200],
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

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click received:', event);
  
  event.notification.close();

  const data = event.notification.data;
  let url = '/';
  
  if (event.action === 'view' || !event.action) {
    if (data?.type === 'expense_reminder') {
      url = '/expenses';
    } else if (data?.type === 'goal_deadline') {
      url = '/goals';
    } else if (data?.type === 'scheduled_transaction') {
      url = '/schedule';
    } else if (data?.url) {
      url = data.url;
    }

    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              data: data
            });
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
    );
  }
});
