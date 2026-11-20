/* QuickServe Firebase Cloud Messaging Service Worker */
self.addEventListener('push', function (event) {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { notification: { title: 'QuickServe Update', body: event.data.text() } };
  }
  const title = payload.notification?.title || 'QuickServe';
  const options = {
    body: payload.notification?.body || 'You have a new service update.',
    icon: '/icons/icon.svg',
    badge: '/icons/icon.svg',
    data: payload.data || { url: '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(clients.openWindow(targetUrl));
});
