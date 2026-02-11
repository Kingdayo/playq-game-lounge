import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useNotifications, NotificationPermissionState } from '@/hooks/useNotifications';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useGame } from '@/contexts/GameContext';
import { toast } from 'sonner';

interface NotificationContextType {
  permission: NotificationPermissionState;
  enabled: boolean;
  setEnabled: (val: boolean) => void;
  requestPermission: () => Promise<NotificationPermissionState>;
  notifyChatMessage: (senderName: string, message: string, roomId?: string) => void;
  notifyGameInvite: (hostName: string, gameType: string, lobbyCode: string) => void;
  notifyPlayerJoined: (playerName: string, lobbyCode: string) => void;
  notifyPlayerLeft: (playerName: string, lobbyCode: string) => void;
  notifyGameStarting: (gameType: string) => void;
  notifyYourTurn: (gameType: string) => void;
  notifyGameOver: (winnerName: string, gameType: string) => void;
  notifyPlayerReady: (playerName: string) => void;
  isPushSubscribed: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const notifications = useNotifications();
  const { currentPlayer } = useGame();
  const { isSubscribed, subscribe, vapidPublicKey } = usePushNotifications(currentPlayer?.id);

  // Auto-subscribe to push when permission is granted
  useEffect(() => {
    if (notifications.permission === 'granted' && notifications.enabled && !isSubscribed && vapidPublicKey && currentPlayer?.id) {
      subscribe();
    }
  }, [notifications.permission, notifications.enabled, isSubscribed, vapidPublicKey, currentPlayer?.id, subscribe]);

  // Prompt for permission on first visit if not yet decided
  useEffect(() => {
    const hasAsked = localStorage.getItem('playq-notification-asked');
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

    if (!hasAsked) {
      const timer = setTimeout(() => {
        // Special handling for iOS
        if (isIOS && !isStandalone) {
          toast('📱 Enable Mobile Notifications', {
            description: 'To receive notifications on iOS, tap the Share button and select "Add to Home Screen".',
            duration: 10000,
          });
          localStorage.setItem('playq-notification-asked', 'true');
          return;
        }

        if (notifications.permission === 'default') {
          toast('🔔 Enable Notifications?', {
            description: 'Get notified about messages, game invites, and your turn alerts even when the app is closed!',
            action: {
              label: 'Enable',
              onClick: async () => {
                const result = await notifications.requestPermission();
                localStorage.setItem('playq-notification-asked', 'true');
                if (result === 'granted') {
                  toast.success('Notifications enabled! 🎉');
                  // Subscribe to push notifications
                  await subscribe();
                } else if (result === 'denied') {
                  toast.info('Notifications blocked. You can enable them in browser settings.');
                }
              },
            },
            cancel: {
              label: 'Later',
              onClick: () => {
                localStorage.setItem('playq-notification-asked', 'true');
              },
            },
            duration: 15000,
          });
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notifications.permission, notifications.requestPermission, subscribe]);

  return (
    <NotificationContext.Provider value={{ ...notifications, isPushSubscribed: isSubscribed }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
};
