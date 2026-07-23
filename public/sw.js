// MYRA PWA: свежая сеть при обычной работе и полноценная оболочка приложения
// при офлайне. Кэшируются только файлы собственного origin; Supabase, Sentry,
// платежи и другие внешние запросы service worker не перехватывает.

const CACHE_NAME = "myra-static-v3";
const APP_SHELL_URL = new URL("./", self.location.href).pathname;
const OFFLINE_URL = new URL("./offline.html", self.location.href).pathname;
const ASSET_RE = /\.(?:js|css|png|jpg|jpeg|webp|svg|gif|ico|woff2?|ttf|webmanifest)$/i;

async function cacheResponse(cache, request, response) {
  if (response && response.ok) await cache.put(request, response.clone());
  return response;
}

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.add(OFFLINE_URL).catch(() => {});

  try {
    const response = await fetch(new Request(APP_SHELL_URL, { cache: "reload" }));
    if (!response.ok) return;
    await cache.put(APP_SHELL_URL, response.clone());

    // Vite writes hashed entry chunks into index.html. Precache those exact
    // files during install so a newly installed PWA can start offline without
    // requiring a second online visit.
    const html = await response.text();
    const references = Array.from(
      html.matchAll(/(?:src|href)=["']([^"'#]+)["']/gi),
      (match) => match[1],
    );
    const urls = Array.from(new Set(references.map((reference) => {
      try {
        return new URL(reference, self.location.origin + APP_SHELL_URL);
      } catch {
        return null;
      }
    }).filter((url) => url && url.origin === self.location.origin && ASSET_RE.test(url.pathname))));

    await Promise.allSettled(urls.map(async (url) => {
      const assetResponse = await fetch(new Request(url.toString(), { cache: "reload" }));
      if (assetResponse.ok) await cache.put(url.toString(), assetResponse);
    }));
  } catch {
    // Offline page remains available even if the shell cannot be fetched on
    // this particular install attempt.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheAppShell());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith("myra-static-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(APP_SHELL_URL, response.clone());
        return response;
      } catch {
        return (await cache.match(APP_SHELL_URL))
          || (await cache.match(OFFLINE_URL))
          || Response.error();
      }
    })());
    return;
  }

  if (ASSET_RE.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      return cacheResponse(cache, request, await fetch(request));
    })());
  }
});
