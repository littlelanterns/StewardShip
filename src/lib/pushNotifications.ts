import { supabase } from './supabase';

// VAPID public key — set this in .env.local as VITE_VAPID_PUBLIC_KEY
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

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

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getPushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    return registration;
  } catch {
    return null;
  }
}

export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!isPushSupported() || !VAPID_PUBLIC_KEY) return false;

  try {
    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    // Get or register service worker
    const registration = await registerServiceWorker();
    if (!registration) return false;

    // Wait for service worker to be active
    await navigator.serviceWorker.ready;

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });

    const subscriptionJson = subscription.toJSON();

    // Save to Supabase
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: subscriptionJson.endpoint,
        p256dh_key: subscriptionJson.keys?.p256dh || '',
        auth_key: subscriptionJson.keys?.auth || '',
        device_label: navigator.userAgent.substring(0, 100),
        is_active: true,
      }, { onConflict: 'user_id,endpoint' });

    return !error;
  } catch {
    return false;
  }
}

export async function unsubscribeFromPush(userId: string): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return true; // Already unsubscribed

    const endpoint = subscription.endpoint;

    // Unsubscribe from browser
    await subscription.unsubscribe();

    // Mark inactive in Supabase
    await supabase
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('endpoint', endpoint);

    return true;
  } catch {
    return false;
  }
}

export async function getSubscriptionStatus(_userId: string): Promise<{
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
}> {
  if (!isPushSupported()) {
    return { supported: false, permission: 'unsupported', subscribed: false };
  }

  const permission = Notification.permission;

  // Check if we have an active subscription in the browser
  let subscribed = false;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      const subscription = await registration.pushManager.getSubscription();
      subscribed = !!subscription;
    }
  } catch {
    // Ignore errors
  }

  return { supported: true, permission, subscribed };
}

// Check quiet hours — returns true if in quiet hours
export function isInQuietHours(
  quietStart: string = '22:00',
  quietEnd: string = '07:00',
  timezone: string = 'America/Chicago',
): boolean {
  try {
    const hour = parseInt(
      new Date().toLocaleString('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      }),
      10,
    );

    const [startH] = quietStart.split(':').map(Number);
    const [endH] = quietEnd.split(':').map(Number);

    // Handle wrap-around (e.g., 22:00 to 07:00)
    if (startH > endH) {
      return hour >= startH || hour < endH;
    }
    return hour >= startH && hour < endH;
  } catch {
    return false;
  }
}

// Listen for messages from the service worker
export function setupServiceWorkerMessageListener(
  onNotificationClick: (url: string, reminderId: string | null) => void,
  onNotificationDismiss: (reminderId: string) => void,
): () => void {
  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'NOTIFICATION_CLICK') {
      onNotificationClick(event.data.url, event.data.reminderId);
    } else if (event.data?.type === 'NOTIFICATION_DISMISS') {
      onNotificationDismiss(event.data.reminderId);
    }
  };

  navigator.serviceWorker?.addEventListener('message', handler);
  return () => navigator.serviceWorker?.removeEventListener('message', handler);
}
