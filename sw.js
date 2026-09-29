// Drum Timing Trainer – offline support.
// The page itself: network first (so a new upload shows up on the next start), cached copy when offline.
// Icons and manifest: from the cache.
const CACHE = 'dtt-v6';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  // cache: 'reload' – take the files from the server, not from an older copy in the browser cache
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('dtt-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function networkFirst(request, key) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (!done && r) { done = true; resolve(r); } };
    const fromCache = () => caches.match(key).then(finish);
    const timer = setTimeout(fromCache, 4000);          // slow network in the rehearsal room: use the cached copy
    // no-cache: ask the server every time (cheap if nothing changed), so a new upload shows up at the next start
    fetch(new Request(request.url, { cache: 'no-cache', credentials: 'same-origin' })).then((res) => {
      clearTimeout(timer);
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); }
      finish(res);
    }).catch(() => {
      clearTimeout(timer);
      caches.match(key).then((r) => { if (!done) { done = true; resolve(r || Response.error()); } });
    });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope).pathname;
  if (url.pathname === scope || url.pathname === scope + 'index.html') {
    e.respondWith(networkFirst(req, './index.html'));
    return;
  }
  const rel = './' + url.pathname.slice(scope.length);
  if (SHELL.includes(rel)) e.respondWith(caches.match(rel).then((r) => r || fetch(req)));
});
