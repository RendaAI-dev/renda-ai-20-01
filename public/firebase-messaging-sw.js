// Firebase Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Configuração Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAJMcwMil-dpZ9JsN9Ikwz_SqIz89huFFw",
  authDomain: "renda-ai-8e279.firebaseapp.com",
  projectId: "renda-ai-8e279",
  storageBucket: "renda-ai-8e279.firebasestorage.app",
  messagingSenderId: "993762838881",
  appId: "1:993762838881:web:19bc2019fde8e546671d20",
  measurementId: "G-P3HM5BP951"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Obter instância do Messaging
const messaging = firebase.messaging();

// Handler para mensagens em background
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'Nova Notificação';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: payload.data?.type || 'default',
    data: payload.data || {},
    requireInteraction: false,
    vibrate: [200, 100, 200]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handler para clicks em notificações
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received:', event);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Verificar se já existe uma janela aberta
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            data: event.notification.data
          });
          return client.focus();
        }
      }

      // Se não houver janela aberta, abrir uma nova
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

console.log('[firebase-messaging-sw.js] Service Worker inicializado');
