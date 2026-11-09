/* YEVA — Service Worker v2

   Стратегия намеренно разная для разного добра:

   HTML и JS      — сеть, откат в кэш. Ты правишь игру каждый день,
                    и кэш-первым ребёнок играл бы во вчерашнюю версию.
   mp3 и картинки — кэш сразу, а следом тихая проверка. Раньше тут был
                    чистый кэш: считалось, что имя файла равно содержимому.
                    Это перестало быть правдой — слово переозвучивают, имя
                    у него прежнее, и в игре вечно играл старый звук.
                    Теперь ответ отдаётся из кэша мгновенно, а в фоне файл
                    перепроверяется (сервер отвечает 304, если не менялся)
                    и кэш обновляется. Переозвученное слово звучит
                    по-новому со второго раза, ждать ничего не нужно.
   /api/          — только сеть, не кэшируется вообще.

   Ещё страница может попросить сбросить весь звук разом:
       navigator.serviceWorker.controller.postMessage({ type: 'voice-drop' })
   Это делает озвучка сразу после записи слов.

   ВАЖНО: поднимай CACHE при изменении списка CORE, иначе старый кэш
   останется жить. Обычные правки html/js подхватываются сами.
*/

const CACHE = 'yeva-v3';

const CORE = [
  '/',
  '/index.html',
  '/bubbles.html',
  '/words.js',
  '/console.js',
  '/home.js',
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

const isAsset = url => /\.(mp3|m4a|ogg|png|jpg|jpeg|svg|ico|woff2?)$/i.test(url.pathname);

// Озвучка просит забыть записанные слова: после переозвучки файл в кэше
// старый, а имя у него прежнее.
self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type !== 'voice-drop') return;
  const done = caches.open(CACHE)
    .then(c => c.keys().then(keys => {
      const old = keys.filter(k => /\/voice\//.test(k.url));
      return Promise.all(old.map(k => c.delete(k))).then(() => old.length);
    }))
    .then(n => {
      if (e.source && e.source.postMessage) e.source.postMessage({ type: 'voice-dropped', count: n });
      return n;
    })
    .catch(() => {});
  e.waitUntil(done);
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // шрифты Google, cdnjs
  if (url.pathname.startsWith('/api/')) return;      // озвучка и коммиты — только сеть

  // Звуки и картинки: сначала кэш, следом тихая проверка
  if (isAsset(url)) {
    const job = caches.open(CACHE).then(c => c.match(req).then(hit => {
      // Проверка стоит дёшево: файл не менялся — сервер ответит 304,
      // это пара сотен байт, а не новая закачка. Зато переозвученное
      // слово доезжает само, не дожидаясь, пока кто-то вспомнит про кэш.
      const fresh = fetch(req).then(r => {
        if (!r.ok) return r;
        return c.put(req, r.clone()).then(() => r);
      }).catch(() => null);
      return { hit: hit, fresh: fresh };
    }));

    // 504 — когда файла нет ни в кэше, ни в сети. Игра увидит «не ok»
    // и попробует сама. В statusText только латиница: кириллица там
    // недопустима, и конструктор Response падает.
    e.respondWith(job.then(x => x.hit || x.fresh || null).then(
      r => r || new Response('', { status: 504, statusText: 'offline' })
    ));
    e.waitUntil(job.then(x => x.fresh).catch(() => {}));
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
