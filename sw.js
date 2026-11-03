/* Service worker: offline cache with stale-while-revalidate + "updated" notification */
const V = 'kp-v2.5.0';
const ASSETS = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
function notify() { self.clients.matchAll().then(cs => cs.forEach(c => c.postMessage('updated'))); }
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(caches.open(V).then(async c => {
    const hit = await c.match(r, { ignoreSearch: true });
    const net = fetch(r).then(res => {
      if (res && res.ok) {
        if (hit) {
          const a = hit.headers.get('etag'), b = res.headers.get('etag');
          const changed = (a && b) ? a !== b : hit.headers.get('last-modified') !== res.headers.get('last-modified');
          if (changed) notify();
        }
        c.put(r, res.clone());
      }
      return res;
    }).catch(() => null);
    if (hit) return hit;
    const n = await net;
    if (n) return n;
    return r.mode === 'navigate' ? (await c.match('index.html')) || Response.error() : Response.error();
  }));
});
