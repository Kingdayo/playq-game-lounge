// Push notification handler for the service worker
// This file is imported by the main service worker

async function trackEngagement(eventType, event) {
  const data = event.notification.data || {};
  const tag = event.notification.tag;
  const action = event.action;

  console.log(`[SW] Tracking ${eventType}:`, { tag, action, data });

  // If we have the supabase config in the data, we can try to call the tracking function
  if (data.supabaseUrl && data.supabaseAnonKey) {
    try {
      await fetch(`${data.supabaseUrl}/functions/v1/track-push-engagement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.supabaseAnonKey}`,
          'apikey': data.supabaseAnonKey
        },
        body: JSON.stringify({
          event_type: eventType,
          action_id: action,
          notification_tag: tag,
          notification_type: data.type,
          lobby_code: data.lobbyCode,
          player_id: data.playerId,
          timestamp: new Date().toISOString()
        })
      });
    } catch (err) {
      console.warn('[SW] Failed to send engagement tracking to edge function:', err);
    }
  }
}

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

  const { title, body, icon, badge, tag, data, actions } = payload;

  const options = {
    body: body || '',
    icon: icon || '/pwa-192x192.png',
    badge: badge || '/pwa-192x192.png',
    tag: tag || 'playq-notification',
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: data || {},
    actions: actions || [],
  };

  // Add contextual actions based on notification type if not provided by backend
  if (options.actions.length === 0) {
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
  }

  event.waitUntil(
    self.registration.showNotification(title || 'PlayQ', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const action = event.action;

  event.waitUntil(Promise.all([
    trackEngagement('click', event),
    handleNotificationClick(event)
  ]));
});

self.addEventListener('notificationclose', (event) => {
  event.waitUntil(trackEngagement('close', event));
});

async function handleNotificationClick(event) {
  const data = event.notification.data || {};
  const action = event.action;

  if (action === 'dismiss') return;

  let url = '/';

  if (action === 'reply') {
    url = data.roomId ? `/chat?roomId=${data.roomId}` : '/chat';
  } else if (action === 'join' || action === 'play') {
    if (data.lobbyCode) {
      url = data.gameType ? `/game/${data.gameType}/${data.lobbyCode}` : `/lobby/${data.lobbyCode}`;
    }
  } else {
    // Default behavior based on data type
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
  }

  const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });

  // Focus existing window if found
  for (const client of clientList) {
    if (client.url.includes(self.location.origin)) {
      await client.navigate(url);
      return client.focus();
    }
  }

  // Open new window
  return clients.openWindow(url);
}
