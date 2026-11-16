// Service worker : reçoit les notifications push même quand la page est en arrière-plan.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // payload invalide : on affiche quand même une notification générique
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Commande prête', {
      body: data.body || 'Votre commande est prête • طلبك جاهز',
      icon: '/icon.svg',
      badge: '/icon.svg',
      vibrate: [300, 150, 300, 150, 600],
      tag: 'order-ready',
      renotify: true,
      requireInteraction: true,
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
