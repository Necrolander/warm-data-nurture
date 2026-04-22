// Service Worker do app do entregador.
// Garante notificação com som mesmo se o app estiver em segundo plano.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Mensagens vindas da página (ex.: novo pedido detectado pelo realtime).
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "NEW_ORDER_NOTIFICATION") {
    const { title, body, tag } = data.payload || {};
    self.registration.showNotification(title || "🛵 Novo pedido!", {
      body: body || "Você tem um novo pedido disponível.",
      tag: tag || "new-order",
      renotify: true,
      requireInteraction: true,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      vibrate: [300, 150, 300, 150, 300],
      silent: false,
    });
  }
});

// Quando o usuário clica na notificação, foca/abre o app do entregador.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes("/entregador") && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow("/entregador");
      }
    })
  );
});