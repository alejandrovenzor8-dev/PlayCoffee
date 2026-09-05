const CACHE_VERSION = "playcoffee-shell-v4";
const APP_SHELL = [
  "/",
  "/login",
  "/offline",
  "/manifest.webmanifest",
  "/pwa-icon/192",
  "/pwa-icon/512",
  "/favicon.ico",
];

async function precacheShell() {
  const cache = await caches.open(CACHE_VERSION);
  const pageAssets = new Set();

  await Promise.allSettled(
    APP_SHELL.map(async (url) => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) return;
      await cache.put(url, response.clone());
      if (url !== "/login" && url !== "/offline") return;
      const html = await response.text();
      for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
        const asset = match[1];
        if (asset.startsWith("/_next/static/")) pageAssets.add(asset);
      }
    }),
  );

  await Promise.allSettled(
    [...pageAssets].map(async (url) => {
      const response = await fetch(url);
      if (response.ok) await cache.put(url, response);
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    precacheShell().then(async () => {
      await self.skipWaiting();
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && url.origin === self.location.origin) {
            const copy = response.clone();
            void caches
              .open(CACHE_VERSION)
              .then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          return (
            (await caches.match(request)) || (await caches.match("/offline"))
          );
        }),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/pwa-icon/")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches
              .open(CACHE_VERSION)
              .then((cache) => cache.put(request, copy));
          }
          return response;
        });
      }),
    );
  }
});
