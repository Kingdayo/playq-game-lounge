// Push notification handler for the service worker
// This file is imported by the main service worker

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: 'PlayQ',
      body: event.data.text(),
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
    };
  }

  const { title, body, icon, badge, tag, data } = payload;

  const options = {
    body: body || '',
    icon: icon || '/pwa-192x192.png',
    badge: badge || '/pwa-192x192.png',
    tag: tag || 'playq-notification',
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: data || {},
    actions: [],
  };

  // Add contextual actions based on notification type
  if (data?.type === 'chat') {
    options.actions = [
      { action: 'reply', title: '💬 Reply' },
      { action: 'dismiss', title: 'Dismiss' },
    ];
  } else if (data?.type === 'invite') {
    options.actions = [
      { action: 'join', title: '🎮 Join Game' },
      { action: 'dismiss', title: 'Dismiss' },
    ];
  } else if (data?.type === 'turn') {
    options.actions = [
      { action: 'play', title: '🎯 Play Now' },
    ];
  }

  event.waitUntil(
    self.registration.showNotification(title || 'PlayQ', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/';

  if (data.type === 'chat' && data.roomId) {
    if (data.lobbyCode) {
      url = `/lobby/${data.lobbyCode}`;
    } else {
      url = `/chat?roomId=${data.roomId}`;
    }
  } else if (data.type === 'invite' && data.lobbyCode) {
    url = `/lobby/${data.lobbyCode}`;
  } else if (data.type === 'turn' && data.gameType && data.lobbyCode) {
    url = `/game/${data.gameType}/${data.lobbyCode}`;
  } else if (data.type === 'gameStart' && data.gameType && data.lobbyCode) {
    url = `/game/${data.gameType}/${data.lobbyCode}`;
  } else if (data.type === 'gameStart' && data.lobbyCode) {
    url = `/lobby/${data.lobbyCode}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if found
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});
