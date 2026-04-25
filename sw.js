// SalePlan Service Worker
const CACHE = 'sp-v106'; // v2.5.7 print teacher+class view // v2.5.6 room abbr in view // v2.5.5 archive+statusbar fix // v2.5.4 wizard+hours fixes // v2.5.3 wizard step fix + import normalization // v2.5.2 bugfixes // v2.5.1 colKey validation // v2.5.0 building UX // v2.4.1 room uniqueness // v2.4.0 building migration // v2.3.1 sort fix // v2.3.0 settings panel // v2.2.0 baseClass feature // v2.1.0 bugfix release
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap',
];

// Instalacja — zakeszuj assety i od razu przejmij kontrolę
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())  // nie czekaj na zamknięcie starych klientów
  );
});

// Aktywacja — usuń stare cache, przejmij wszystkich klientów, wymuś reload
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => {
        // Powiadom wszystkich otwartych klientów o nowej wersji → przeładuj
        return self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
        });
      })
  );
});

// Fetch — network-first dla HTML (zawsze świeży), cache-first dla pozostałych
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // HTML — zawsze sieć, fallback cache
  if (url.origin === location.origin && (
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('/') ||
    url.pathname === '/salaplan'
  )) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(r => {
          if (r && r.status === 200) {
            caches.open(CACHE).then(c => c.put(e.request, r.clone()));
          }
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Pozostałe zasoby origin — cache-first
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(r => {
          if (r && r.status === 200)
            caches.open(CACHE).then(c => c.put(e.request, r.clone()));
          return r;
        }).catch(() => caches.match('./index.html'));
      })
    );
    return;
  }

  // Fonty — cache-first
  if (url.hostname.includes('fonts.')) {
    e.respondWith(
      caches.match(e.request)
        .then(cached => cached || fetch(e.request).then(r => {
          caches.open(CACHE).then(c => c.put(e.request, r.clone()));
          return r;
        }))
        .catch(() => new Response('', { status: 408 }))
    );
  }
});
