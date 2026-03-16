/* Hiba! Run! — Service Worker v3
   Background sync + persistent notifications */

const CACHE = 'hiba-run-v3';
const ASSETS = ['/', '/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  const isAPI = ['rss2json','allorigins','corsproxy','aljazeera','nna-leb',
    'mtv.com','lbci','aljadeed','alhadath','ipapi','googleapis'].some(s => url.includes(s));
  if (isAPI) {
    e.respondWith(fetch(e.request).catch(() => new Response('', {status: 503})));
  } else {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
  }
});

/* Background sync — wake up every 30s even when app is closed */
self.addEventListener('periodicsync', e => {
  if (e.tag === 'hiba-scan') {
    e.waitUntil(doBackgroundScan());
  }
});

/* Push notification from server */
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'Hiba! Run! — إنذار', {
      body: data.body || 'تم رصد تحذير بالقرب منك',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      vibrate: [300, 100, 300, 100, 600],
      requireInteraction: true,
      tag: data.tag || 'hiba-alert',
      dir: 'rtl',
      lang: 'ar',
      actions: [
        { action: 'open', title: 'Open App' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Focus existing window if open
      for (const client of list) {
        if (client.url.includes('index.html') || client.url.endsWith('/')) {
          return client.focus();
        }
      }
      return clients.openWindow('/');
    })
  );
});

/* Keep alive message from main app */
self.addEventListener('message', e => {
  if (e.data === 'keepalive') {
    // Respond to keep-alive ping from app
    e.source.postMessage('alive');
  }
  if (e.data && e.data.type === 'SHOW_NOTIFICATION') {
    const d = e.data;
    self.registration.showNotification(d.title, {
      body: d.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      vibrate: d.urgent ? [500,200,500,200,1000] : [200,100,200],
      requireInteraction: d.urgent || false,
      tag: d.tag || 'hiba-' + Date.now(),
      dir: 'rtl',
      lang: 'ar',
    });
  }
});

async function doBackgroundScan() {
  // Notify clients to scan
  const allClients = await clients.matchAll({ includeUncontrolled: true });
  for (const client of allClients) {
    client.postMessage({ type: 'BACKGROUND_SCAN' });
  }
}
