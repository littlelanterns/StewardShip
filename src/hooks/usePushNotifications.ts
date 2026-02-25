import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import { useReminders } from './useReminders';
import {
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  getSubscriptionStatus,
  setupServiceWorkerMessageListener,
  registerServiceWorker,
} from '../lib/pushNotifications';
import type { Reminder } from '../lib/types';

export function usePushNotifications() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const { actOnReminder, dismissReminder } = useReminders();

  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [subscribed, setSubscribed] = useState(false);
  const [inAppAlert, setInAppAlert] = useState<Reminder | null>(null);

  // Check status on mount
  useEffect(() => {
    if (!user) return;

    getSubscriptionStatus(user.id).then((status) => {
      setSupported(status.supported);
      setPermission(status.permission);
      setSubscribed(status.subscribed);
    });
  }, [user]);

  // Register service worker on mount
  useEffect(() => {
    if (isPushSupported()) {
      registerServiceWorker();
    }
  }, []);

  // Listen for service worker messages
  useEffect(() => {
    if (!user) return;

    const cleanup = setupServiceWorkerMessageListener(
      // On notification click
      (url, reminderId) => {
        if (reminderId) {
          actOnReminder(reminderId);
        }
        if (url && url !== '/') {
          navigate(url);
        }
      },
      // On notification dismiss
      (reminderId) => {
        if (reminderId) {
          dismissReminder(reminderId);
        }
      },
    );

    return cleanup;
  }, [user, navigate, actOnReminder, dismissReminder]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    const result = await subscribeToPush(user.id);
    if (result) {
      setSubscribed(true);
      setPermission('granted');
    }
    return result;
  }, [user]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    const result = await unsubscribeFromPush(user.id);
    if (result) {
      setSubscribed(false);
    }
    return result;
  }, [user]);

  // Show an in-app alert
  const showInAppAlert = useCallback((reminder: Reminder) => {
    setInAppAlert(reminder);
  }, []);

  const dismissInAppAlert = useCallback(() => {
    if (inAppAlert) {
      dismissReminder(inAppAlert.id);
    }
    setInAppAlert(null);
  }, [inAppAlert, dismissReminder]);

  const actOnInAppAlert = useCallback(() => {
    if (inAppAlert) {
      actOnReminder(inAppAlert.id);
    }
    setInAppAlert(null);
  }, [inAppAlert, actOnReminder]);

  return {
    supported,
    permission,
    subscribed,
    inAppAlert,
    subscribe,
    unsubscribe,
    showInAppAlert,
    dismissInAppAlert,
    actOnInAppAlert,
  };
}
