// MYRA — минимальный service worker: только офлайн-подстраховка, не полноценный
// офлайн-режим приложения. Три правила, чтобы никогда не мешать живому сайту:
//
// 1. index.html и любая навигация — ВСЕГДА сначала сеть. Каждый деплой меняет
//    имена JS/CSS-чанков (см. main.tsx, обработчик vite:preloadError) — если
//    отдавать index.html из кэша, вкладка будет ссылаться на чанки, которых
//    уже нет на сервере. Кэш здесь — только резерв на случай реального офлайна.
// 2. Чужой origin (Supabase, Sentry, ЮKassa, шрифты и т.п.) не трогаем вообще —
//    ни кэша, ни перехвата, пусть идёт как обычный сетевой запрос.
// 3. Только свои статические ассеты (хэшированные JS/CSS/картинки) — кэш-фёрст,
//    это безопасно именно потому, что у них хэш в имени: новый деплой = новые
//    имена файлов, старые в кэше никогда не станут "неправильной" версией.

const CACHE_NAME = "myra-static-v1";
const OFFLINE_URL = new URL("./offline.html", self.location.href).pathname;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL])).catch(() => {
      // Не критично: без precache офлайн-страница просто не покажется офлайн
      // при самом первом визите (до первого успешного онлайн-захода)
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

const ASSET_RE = /\.(?:js|css|png|jpg|jpeg|webp|svg|gif|woff2?|ttf)$/i;

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // правило 2

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  if (ASSET_RE.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return res;
        });
      })
    );
  }
  // Всё остальное того же origin (manifest.webmanifest и т.п.) — обычная сеть,
  // без вмешательства
});
