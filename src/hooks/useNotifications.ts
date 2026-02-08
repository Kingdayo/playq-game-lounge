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
    return Notification.permission as NotificationPermissionState;
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
    if (!('Notification' in window)) {
      setPermission('unsupported');
      return 'unsupported';
    }

    if (Notification.permission === 'granted') {
      setPermission('granted');
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      setPermission('denied');
      return 'denied';
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermissionState);
      return result as NotificationPermissionState;
    } catch {
      setPermission('default');
      return 'default';
    }
  }, []);

  const sendNotification = useCallback(({ title, body, icon, tag, requireInteraction, data }: NotificationOptions) => {
    if (!enabled) return;
    if (permission !== 'granted') return;
    // Don't notify if the page is focused
    if (document.visibilityState === 'visible' && document.hasFocus()) return;

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

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    } catch (e) {
      console.warn('Notification failed:', e);
    }
  }, [enabled, permission]);

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
