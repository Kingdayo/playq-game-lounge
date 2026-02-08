import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useNotifications, NotificationPermissionState } from '@/hooks/useNotifications';
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
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const notifications = useNotifications();

  // Prompt for permission on first visit if not yet decided
  useEffect(() => {
    const hasAsked = localStorage.getItem('playq-notification-asked');
    if (!hasAsked && notifications.permission === 'default') {
      // Delay the prompt slightly so it doesn't fire immediately on page load
      const timer = setTimeout(() => {
        toast('🔔 Enable Notifications?', {
          description: 'Get notified about messages, game invites, and your turn alerts!',
          action: {
            label: 'Enable',
            onClick: async () => {
              const result = await notifications.requestPermission();
              localStorage.setItem('playq-notification-asked', 'true');
              if (result === 'granted') {
                toast.success('Notifications enabled! 🎉');
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
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notifications.permission, notifications.requestPermission]);

  return (
    <NotificationContext.Provider value={notifications}>
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
