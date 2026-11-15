// Prosty tryb offline: strona z sieci (z zapasem w pamięci), reszta z pamięci.
const CACHE = 'sedno-v1';
// Plik z pamięci pasuje bez względu na nagłówek Vary serwera (inaczej skrypt pobrany raz „z Origin”, raz bez, nie zostałby znaleziony bez sieci).
const ANY = { ignoreVary: true };

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add('./')).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  // Sprawdzanie wersji (index.html?v=…) idzie zawsze prosto do sieci i nie trafia do pamięci.
  if (url.searchParams.has('v')) return;
  const put = (res) => {
    // Tylko pełne odpowiedzi: częściowych (206, np. dźwięk) pamięć podręczna nie przyjmuje.
    if (res.status === 200) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  };
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(put).catch(() => caches.match(req, ANY).then((r) => r || caches.match('./', ANY))));
    return;
  }
  e.respondWith(caches.match(req, ANY).then((hit) => hit || fetch(req).then(put)));
});

// Strona podaje listę plików, które pobrała przy pierwszym uruchomieniu.
self.addEventListener('message', (e) => {
  if (e.data?.type !== 'cache' || !Array.isArray(e.data.urls)) return;
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(
        e.data.urls.map((u) =>
          c.match(u).then((hit) => hit || fetch(u).then((r) => (r.ok ? c.put(u, r) : undefined)).catch(() => undefined)),
        ),
      ),
    ),
  );
});
