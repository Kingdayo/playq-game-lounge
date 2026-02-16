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
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [debugInfo, setDebugInfo] = useState<{
    swStatus: string;
    pushSupported: boolean;
    subscriptionStatus: string;
    lastError: string | null;
  }>({
    swStatus: 'checking',
    pushSupported: false,
    subscriptionStatus: 'checking',
    lastError: null
  });

  // Get VAPID public key on mount
  useEffect(() => {
    const fetchVapidKey = async () => {
      try {
        console.log('Fetching VAPID public key...');
        const { data, error } = await supabase.functions.invoke('generate-vapid-keys');
        if (error) throw error;
        if (data?.publicKey) {
          console.log('VAPID key fetched successfully');
          setVapidPublicKey(data.publicKey);
        } else {
          throw new Error('No public key returned from function');
        }
      } catch (e: any) {
        console.warn('Failed to fetch VAPID key from function:', e);
        setDebugInfo(prev => ({ ...prev, lastError: `VAPID fetch failed: ${e.message}` }));
      }
    };
    fetchVapidKey();
  }, []);

  // Get service worker registration
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      setDebugInfo(prev => ({ ...prev, swStatus: 'unsupported', pushSupported: false }));
      return;
    }

    console.log('Checking service worker registration...');
    navigator.serviceWorker.ready.then((reg) => {
      console.log('Service worker ready');
      setRegistration(reg);
      const pushSupported = 'pushManager' in reg;
      setDebugInfo(prev => ({
        ...prev,
        swStatus: 'active',
        pushSupported
      }));

      // Check if already subscribed
      if (pushSupported) {
        reg.pushManager.getSubscription().then((sub) => {
          setIsSubscribed(!!sub);
          setDebugInfo(prev => ({
            ...prev,
            subscriptionStatus: !!sub ? 'subscribed' : 'not-subscribed'
          }));
        }).catch(err => {
          console.warn('Failed to get push subscription:', err);
          setDebugInfo(prev => ({ ...prev, lastError: `Get subscription error: ${err.message}` }));
        });
      } else {
        setDebugInfo(prev => ({ ...prev, subscriptionStatus: 'unsupported' }));
      }
    }).catch(err => {
      console.error('Service worker not ready:', err);
      setDebugInfo(prev => ({ ...prev, swStatus: 'failed', lastError: `SW error: ${err.message}` }));
    });
  }, []);

  const subscribe = useCallback(async () => {
    if (!playerId) {
      console.warn('Cannot subscribe: No player ID');
      return false;
    }
    if (!registration) {
      console.warn('Cannot subscribe: Service worker registration missing');
      return false;
    }
    if (!vapidPublicKey) {
      console.warn('Cannot subscribe: VAPID public key missing');
      return false;
    }
    if (!registration.pushManager) {
      console.warn('PushManager not supported on this browser');
      setDebugInfo(prev => ({ ...prev, pushSupported: false }));
      return false;
    }

    try {
      console.log('Starting push subscription process...');
      setDebugInfo(prev => ({ ...prev, subscriptionStatus: 'subscribing', lastError: null }));

      // Request notification permission if needed
      if (!('Notification' in window)) {
        throw new Error('Notification API not supported');
      }

      const permission = await Notification.requestPermission();
      console.log('Notification permission status:', permission);
      if (permission !== 'granted') {
        throw new Error(`Notification permission ${permission}`);
      }

      // Check for existing subscription and unsubscribe if it might have a different key
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        console.log('Found existing subscription, unsubscribing first...');
        try {
          await existingSub.unsubscribe();
        } catch (e) {
          console.warn('Failed to unsubscribe from existing push:', e);
        }
      }

      // Subscribe to push
      console.log('Calling pushManager.subscribe...');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });

      console.log('Push subscription successful:', subscription.endpoint);

      const subJson = subscription.toJSON();
      if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
        throw new Error('Invalid subscription object received from browser');
      }

      // Store subscription in database
      console.log('Saving subscription to database...');
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
        console.error('Failed to save push subscription to DB:', error);
        throw error;
      }

      console.log('Subscription saved successfully');
      setIsSubscribed(true);
      setDebugInfo(prev => ({ ...prev, subscriptionStatus: 'subscribed' }));
      return true;
    } catch (e: any) {
      console.error('Push subscription failed:', e);
      setDebugInfo(prev => ({
        ...prev,
        subscriptionStatus: 'failed',
        lastError: e.message || String(e)
      }));
      return false;
    }
  }, [registration, vapidPublicKey, playerId]);

  const unsubscribe = useCallback(async () => {
    if (!registration || !playerId) {
      console.warn('Cannot unsubscribe: Missing registration or player ID');
      return false;
    }

    try {
      console.log('Starting push unsubscribe process...');
      setDebugInfo(prev => ({ ...prev, subscriptionStatus: 'unsubscribing' }));

      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        const success = await subscription.unsubscribe();
        console.log('Push unsubscribe success:', success);

        // Remove from database
        console.log('Removing subscription from database...');
        const { error } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('player_id', playerId)
          .eq('endpoint', endpoint);

        if (error) {
          console.error('Failed to remove subscription from DB:', error);
        }
      }

      setIsSubscribed(false);
      setDebugInfo(prev => ({ ...prev, subscriptionStatus: 'not-subscribed' }));
      return true;
    } catch (e: any) {
      console.error('Push unsubscribe failed:', e);
      setDebugInfo(prev => ({ ...prev, lastError: `Unsubscribe error: ${e.message}` }));
      return false;
    }
  }, [registration, playerId]);

  return { isSubscribed, subscribe, unsubscribe, vapidPublicKey, debugInfo };
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
        title: notification.title,
        body: notification.body,
        icon: notification.icon,
        tag: notification.tag || 'playq-notification',
        renotify: true,
        data: notification.data || {},
      },
    });
  } catch (e) {
    console.warn('Failed to send push notification:', e);
  }
}
