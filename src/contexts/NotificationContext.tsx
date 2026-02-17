import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useNotifications, NotificationPermissionState } from '@/hooks/useNotifications';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useGame } from '@/contexts/GameContext';
import { toast } from 'sonner';
import { Bell } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  unsubscribePush: () => Promise<boolean>;
  pushDebug: {
    swStatus: string;
    pushSupported: boolean;
    subscriptionStatus: string;
    lastError: string | null;
  };
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const notifications = useNotifications();
  const { currentPlayer } = useGame();
  const { isSubscribed, isChecking, subscribe, unsubscribe, vapidPublicKey, debugInfo } = usePushNotifications(currentPlayer?.id);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);

  // Synchronize enabled state with push subscription
  useEffect(() => {
    // Only attempt to synchronize once we've finished checking the current subscription status
    if (!isChecking && notifications.permission === 'granted' && currentPlayer?.id) {
      if (notifications.enabled && !isSubscribed && vapidPublicKey) {
        console.log('Push subscription missing but notifications enabled, subscribing...');
        subscribe();
      } else if (!notifications.enabled && isSubscribed) {
        console.log('Notifications disabled but push subscription exists, unsubscribing...');
        unsubscribe();
      }
    }
  }, [notifications.permission, notifications.enabled, isSubscribed, isChecking, vapidPublicKey, currentPlayer?.id, subscribe, unsubscribe]);

  // Set asked flag if permission is already decided
  useEffect(() => {
    if (notifications.permission !== 'default' && notifications.permission !== 'unsupported') {
      localStorage.setItem('playq-notification-asked', 'true');
    }
  }, [notifications.permission]);

  // Prompt for permission on first visit if not yet decided
  useEffect(() => {
    const hasAsked = localStorage.getItem('playq-notification-asked');
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = (window.navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches;

    if (!hasAsked && notifications.permission === 'default') {
      const timer = setTimeout(() => {
        // Special handling for iOS
        if (isIOS && !isStandalone) {
          toast('📱 Enable Mobile Notifications', {
            description: 'Push notifications on iOS require the app to be installed. Tap the Share button (square with arrow) and then "Add to Home Screen".',
            duration: 15000,
          });
          localStorage.setItem('playq-notification-asked', 'true');
          return;
        }

        setShowPermissionDialog(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notifications.permission]);

  const handleEnableNotifications = async () => {
    const result = await notifications.requestPermission();
    localStorage.setItem('playq-notification-asked', 'true');
    setShowPermissionDialog(false);

    if (result === 'granted') {
      toast.success('Notifications enabled! 🎉');
      await subscribe();
    } else if (result === 'denied') {
      toast.info('Notifications blocked. You can enable them in browser settings.');
    }
  };

  const handleDismissDialog = () => {
    localStorage.setItem('playq-notification-asked', 'true');
    setShowPermissionDialog(false);
  };

  return (
    <NotificationContext.Provider value={{
      ...notifications,
      isPushSubscribed: isSubscribed,
      unsubscribePush: unsubscribe,
      pushDebug: debugInfo
    }}>
      {children}

      <AlertDialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <AlertDialogContent className="glass-card border-primary/20 max-w-md">
          <AlertDialogHeader className="space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Bell className="w-8 h-8 text-primary animate-bounce" />
            </div>
            <AlertDialogTitle className="text-2xl font-display font-bold text-center gradient-text">
              Stay in the Game!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-base">
              Enable push notifications to receive:
              <ul className="mt-4 space-y-2 text-left list-none">
                <li className="flex items-center gap-2">
                  <span className="text-primary">🎯</span> Your turn alerts in Uno & Ludo
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">💬</span> New chat message notifications
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">🎮</span> Game invitations from friends
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">🚀</span> Alerts when a game is starting
                </li>
              </ul>
              <p className="mt-4 text-sm text-muted-foreground italic">
                You'll receive notifications even when the app is completely closed.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex flex-col sm:flex-row gap-2">
            <AlertDialogCancel
              onClick={handleDismissDialog}
              className="sm:flex-1 border-primary/20 hover:bg-primary/5"
            >
              Maybe Later
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEnableNotifications}
              className="sm:flex-1 bg-primary text-primary-foreground hover:bg-primary/90 neon-glow-cyan"
            >
              Enable Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
