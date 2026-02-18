// Push notification handler for the service worker
// This file is imported by the main service worker

async function trackEngagement(eventType, event) {
  const data = (event.notification && event.notification.data) || {};
  const tag = event.notification ? event.notification.tag : null;
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

async function isRoomActive(roomId) {
  if (!roomId) return false;

  const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clientList) {
    try {
      const url = new URL(client.url);
      const isChatPage = url.pathname.includes('/chat');
      const hasRoomId = url.searchParams.get('roomId') === roomId;
      const isLobbyPage = url.pathname.includes(`/lobby/${roomId}`);
      const isGamePage = url.pathname.includes(`/${roomId}`); // Catch-all for game pages with code

      if (client.focused && (hasRoomId || isLobbyPage || isGamePage || (isChatPage && !roomId))) {
        return true;
      }
    } catch (e) {
      console.error('[SW] Error checking client active state:', e);
    }
  }
  return false;
}

async function sendReply(data, replyText) {
  if (!data.roomId || !data.supabaseUrl || !data.supabaseAnonKey || !data.playerId) {
    console.error('[SW] Missing data for sending reply:', data);
    return;
  }

  try {
    const response = await fetch(`${data.supabaseUrl}/rest/v1/chat_messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.supabaseAnonKey}`,
        'apikey': data.supabaseAnonKey,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        room_id: data.roomId,
        sender_id: data.playerId,
        sender_name: data.playerName || 'User',
        sender_avatar: data.playerAvatar || '👤',
        content: replyText,
        is_system: false
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to send reply: ${response.statusText}`);
    }

    console.log('[SW] Reply sent successfully');
  } catch (err) {
    console.error('[SW] Error sending reply:', err);
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

  event.waitUntil((async () => {
    // Check if the chat room is already active and focused
    if (data?.type === 'chat' && data?.roomId) {
      const active = await isRoomActive(data.roomId);
      if (active) {
        console.log(`[SW] Suppressing notification for active room: ${data.roomId}`);
        return;
      }
    }

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

    // Notification grouping for chat
    if (data?.type === 'chat' && options.tag) {
      const notifications = await self.registration.getNotifications({ tag: options.tag });
      if (notifications.length > 0) {
        const oldNotification = notifications[0];
        const oldData = oldNotification.data || {};
        const messages = oldData.messages || [oldNotification.body];

        messages.push(body);
        if (messages.length > 5) messages.shift();

        options.body = messages.join('\n');
        options.data.messages = messages;
        options.data.messageCount = (oldData.messageCount || 1) + 1;

        // Update title to show count if multiple messages
        if (options.data.messageCount > 1) {
          options.title = `${title} (${options.data.messageCount})`;
        }
      }
    }

    // Add contextual actions based on notification type if not provided by backend
    if (options.actions.length === 0) {
      if (data?.type === 'chat') {
        options.actions = [
          { action: 'reply', title: 'Reply', type: 'text', placeholder: 'Type a message...' },
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

    return self.registration.showNotification(options.title || title || 'PlayQ', options);
  })());
});

self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data || {};
  const action = event.action;

  // Handle inline reply
  if (action === 'reply' && event.reply) {
    event.notification.close();
    event.waitUntil(Promise.all([
      trackEngagement('reply', event),
      sendReply(data, event.reply)
    ]));
    return;
  }

  event.notification.close();

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
