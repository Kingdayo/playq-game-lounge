import { useState, useEffect, useCallback } from 'react';

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
  data?: Record<string, unknown>;
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermissionState>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    // Check if the Notification API is available and permission is accessible
    try {
      return (Notification.permission || 'default') as NotificationPermissionState;
    } catch (e) {
      console.warn('Notification API permission check failed:', e);
      return 'unsupported';
    }
  });

  const [enabled, setEnabledState] = useState<boolean>(() => {
    const stored = localStorage.getItem('playq-notifications-enabled');
    return stored !== null ? JSON.parse(stored) : true;
  });

  useEffect(() => {
    localStorage.setItem('playq-notifications-enabled', JSON.stringify(enabled));
  }, [enabled]);

  const setEnabled = useCallback((val: boolean) => {
    setEnabledState(val);
  }, []);

  const requestPermission = useCallback(async (): Promise<NotificationPermissionState> => {
    if (!('Notification' in window) || !Notification.requestPermission) {
      setPermission('unsupported');
      return 'unsupported';
    }

    try {
      if (Notification.permission === 'granted') {
        setPermission('granted');
        return 'granted';
      }

      if (Notification.permission === 'denied') {
        setPermission('denied');
        return 'denied';
      }

      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermissionState);
      return result as NotificationPermissionState;
    } catch (e) {
      console.warn('Failed to request notification permission:', e);
      setPermission('default');
      return 'default';
    }
  }, []);

  const fallbackNotification = useCallback(({ title, body, icon, tag, requireInteraction, data }: NotificationOptions) => {
    if (!('Notification' in window)) return;

    try {
      const notification = new Notification(title, {
        body,
        icon: icon || '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: tag || undefined,
        requireInteraction: requireInteraction || false,
        data,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      setTimeout(() => notification.close(), 5000);
    } catch (e) {
      console.warn('Fallback notification creation failed:', e);
    }
  }, []);

  const sendNotification = useCallback(({ title, body, icon, tag, requireInteraction, data }: NotificationOptions) => {
    if (!enabled) return;
    if (permission !== 'granted') return;

    // We prefer using the service worker to show notifications as it's more reliable on mobile
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        try {
          registration.showNotification(title, {
            body,
            icon: icon || '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            tag: tag || 'playq-local-notification',
            requireInteraction: requireInteraction || false,
            renotify: true,
            data,
          });
        } catch (e) {
          console.warn('Service worker notification failed, falling back to Notification API:', e);
          fallbackNotification({ title, body, icon, tag, requireInteraction, data });
        }
      }).catch(() => {
        fallbackNotification({ title, body, icon, tag, requireInteraction, data });
      });
    } else {
      fallbackNotification({ title, body, icon, tag, requireInteraction, data });
    }
  }, [enabled, permission, fallbackNotification]);

  // Specific notification helpers
  const notifyChatMessage = useCallback((senderName: string, message: string, roomId?: string) => {
    sendNotification({
      title: `💬 ${senderName}`,
      body: message.length > 100 ? message.substring(0, 100) + '…' : message,
      tag: `chat-${roomId || 'general'}`,
      data: { type: 'chat', roomId },
    });
  }, [sendNotification]);

  const notifyGameInvite = useCallback((hostName: string, gameType: string, lobbyCode: string) => {
    const gameEmojis: Record<string, string> = { uno: '🃏', ludo: '🎲', dominoes: '🁣', pictionary: '🎨' };
    sendNotification({
      title: `${gameEmojis[gameType] || '🎮'} Game Invite!`,
      body: `${hostName} invited you to play ${gameType.charAt(0).toUpperCase() + gameType.slice(1)}`,
      tag: `invite-${lobbyCode}`,
      requireInteraction: true,
      data: { type: 'invite', lobbyCode, gameType },
    });
  }, [sendNotification]);

  const notifyPlayerJoined = useCallback((playerName: string, lobbyCode: string) => {
    sendNotification({
      title: '👋 Player Joined',
      body: `${playerName} joined the lobby`,
      tag: `join-${lobbyCode}`,
      data: { type: 'join', lobbyCode },
    });
  }, [sendNotification]);

  const notifyPlayerLeft = useCallback((playerName: string, lobbyCode: string) => {
    sendNotification({
      title: '🚪 Player Left',
      body: `${playerName} left the lobby`,
      tag: `leave-${lobbyCode}`,
      data: { type: 'leave', lobbyCode },
    });
  }, [sendNotification]);

  const notifyGameStarting = useCallback((gameType: string) => {
    sendNotification({
      title: '🚀 Game Starting!',
      body: `Your ${gameType.charAt(0).toUpperCase() + gameType.slice(1)} game is about to begin!`,
      tag: 'game-start',
      requireInteraction: true,
      data: { type: 'gameStart', gameType },
    });
  }, [sendNotification]);

  const notifyYourTurn = useCallback((gameType: string) => {
    sendNotification({
      title: '🎯 Your Turn!',
      body: `It's your turn in ${gameType.charAt(0).toUpperCase() + gameType.slice(1)}`,
      tag: 'your-turn',
      data: { type: 'turn', gameType },
    });
  }, [sendNotification]);

  const notifyGameOver = useCallback((winnerName: string, gameType: string) => {
    sendNotification({
      title: '🏆 Game Over!',
      body: `${winnerName} won the ${gameType.charAt(0).toUpperCase() + gameType.slice(1)} game!`,
      tag: 'game-over',
      data: { type: 'gameOver', gameType },
    });
  }, [sendNotification]);

  const notifyPlayerReady = useCallback((playerName: string) => {
    sendNotification({
      title: '✅ Player Ready',
      body: `${playerName} is ready to play!`,
      tag: 'player-ready',
      data: { type: 'ready' },
    });
  }, [sendNotification]);

  return {
    permission,
    enabled,
    setEnabled,
    requestPermission,
    sendNotification,
    notifyChatMessage,
    notifyGameInvite,
    notifyPlayerJoined,
    notifyPlayerLeft,
    notifyGameStarting,
    notifyYourTurn,
    notifyGameOver,
    notifyPlayerReady,
  };
}
