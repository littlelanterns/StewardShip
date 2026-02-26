/* eslint-disable no-restricted-globals */

// StewardShip Service Worker — Push Notifications + Offline Fallback

const CACHE_NAME = 'stewardship-v1';
const APP_SHELL = ['/', '/index.html'];

// Cache app shell on install for basic offline support
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Clean up old caches on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Serve cached app shell when offline (navigation requests only)
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
  }
});

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: 'StewardShip',
      body: event.data.text(),
    };
  }

  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: payload.tag || 'stewardship-notification',
    data: {
      url: payload.url || '/',
      reminderId: payload.reminder_id || null,
    },
    // Collapse multiple notifications with same tag
    renotify: !!payload.tag,
    // Don't require interaction to dismiss
    requireInteraction: false,
    // Vibration pattern (ms) — subtle
    vibrate: [100, 50, 100],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'StewardShip', options)
  );
});

// Handle notification click — open the app at the right page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If there's an open window, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            url,
            reminderId: event.notification.data?.reminderId,
          });
          return;
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

// Handle notification close (dismissed by user)
self.addEventListener('notificationclose', (event) => {
  const reminderId = event.notification.data?.reminderId;
  if (!reminderId) return;

  // Send dismiss event to any open client
  self.clients.matchAll({ type: 'window' }).then((clientList) => {
    for (const client of clientList) {
      client.postMessage({
        type: 'NOTIFICATION_DISMISS',
        reminderId,
      });
    }
  });
});
