/* Fahrzeit — Service Worker v1

   Нужен по двум причинам:
   1. Без service worker с обработчиком fetch Chrome не присылает
      beforeinstallprompt — то есть баннер установки на Android не появится.
   2. Приложение открывается офлайн (список участников лежит в localStorage).

   Стратегия намеренно разная:
     HTML / JS / stations.js — сеть, откат в кэш. Ты правишь приложение часто,
                               кэш-первым водители работали бы во вчерашней версии.
     png / svg / шрифты      — кэш, откат в сеть. Не меняются.
     /api/                   — только сеть, не кэшируется никогда
                               (расчёт времени, ключи, пароли, GitHub-загрузка).
     Чужие домены            — не трогаем (Google Maps, Firebase, CDN).

   ВАЖНО: подними CACHE при изменении списка CORE, иначе старый кэш останется
   жить. Обычные правки html/js подхватываются сами, поднимать не нужно.
*/

const CACHE = 'fahrzeit-v1';

const CORE = [
  '/',
  '/index.html',
  '/stations.js',
  '/console.js',
  '/install.js',
  '/icons/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // по одному: addAll падает целиком, если хоть один файл недоступен
      .then(c => Promise.all(CORE.map(u => c.add(u).catch(err => {
        console.warn('[sw] не закэшировал', u, err);
      }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isAsset = url => /\.(png|jpg|jpeg|svg|ico|webp|woff2?)$/i.test(url.pathname);

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Google Maps, Firebase, CDN
  if (url.pathname.startsWith('/api/')) return;      // расчёты и секреты — только сеть

  // Иконки и шрифты: сначала кэш
  if (isAsset(url)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(r => {
        if (r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return r;
      }))
    );
    return;
  }

  // Всё остальное: сначала сеть, офлайн — из кэша
  e.respondWith(
    fetch(req).then(r => {
      if (r.ok) {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return r;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('/index.html')))
  );
});
