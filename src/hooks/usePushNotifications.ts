import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Convert URL-safe base64 to Uint8Array for applicationServerKey
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(playerId: string | undefined) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  // Default to generated valid VAPID public key
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>("BK05wU7meph8D_xwlcxbAgHGacOaS17kvHZJkpAgp2IDh0UNYfvHJf1VXlXy7FN53nniJrrDpH0c0I-9A3w7NdY");
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Get VAPID public key on mount (optional since we have a default, but good for sync)
  useEffect(() => {
    const fetchVapidKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('generate-vapid-keys');
        if (!error && data?.publicKey) {
          setVapidPublicKey(data.publicKey);
        }
      } catch (e) {
        console.warn('Failed to fetch VAPID key from function:', e);
      }
    };
    fetchVapidKey();
  }, []);

  // Get service worker registration
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then((reg) => {
      setRegistration(reg);
      // Check if already subscribed
      reg.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub);
      });
    });
  }, []);

  const subscribe = useCallback(async () => {
    if (!registration || !vapidPublicKey || !playerId) return false;

    try {
      // Request notification permission if needed
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return false;

      // Check for existing subscription and unsubscribe if it might have a different key
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe();
      }

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });

      const subJson = subscription.toJSON();
      if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
        throw new Error('Invalid subscription');
      }

      // Store subscription in database
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            player_id: playerId,
            endpoint: subJson.endpoint,
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
          },
          { onConflict: 'player_id,endpoint' }
        );

      if (error) {
        console.error('Failed to save push subscription:', error);
        return false;
      }

      setIsSubscribed(true);
      return true;
    } catch (e) {
      console.error('Push subscription failed:', e);
      return false;
    }
  }, [registration, vapidPublicKey, playerId]);

  const unsubscribe = useCallback(async () => {
    if (!registration || !playerId) return;

    try {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();

        // Remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('player_id', playerId)
          .eq('endpoint', subscription.endpoint);
      }
      setIsSubscribed(false);
    } catch (e) {
      console.error('Push unsubscribe failed:', e);
    }
  }, [registration, playerId]);

  return { isSubscribed, subscribe, unsubscribe, vapidPublicKey };
}

// Helper to send push notification via edge function
export async function sendPushToPlayers(
  playerIds: string[],
  notification: { title: string; body: string; icon?: string; tag?: string; data?: Record<string, unknown> }
) {
  try {
    await supabase.functions.invoke('send-push-notification', {
      body: {
        player_ids: playerIds,
        ...notification,
      },
    });
  } catch (e) {
    console.warn('Failed to send push notification:', e);
  }
}
