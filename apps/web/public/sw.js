const SW_VERSION = "ecoheat-sw-v3";
const STATIC_CACHE = `${SW_VERSION}-static`;
const RUNTIME_CACHE = `${SW_VERSION}-runtime`;
const SYNC_TAG = "ecoheat-sync";

const STATIC_ASSETS = ["/", "/manifest.json", "/icon-192x192.png", "/icon-512x512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => {
              if (key === STATIC_CACHE || key === RUNTIME_CACHE) return false;
              return true;
            })
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Nunca intercepta API nem métodos mutáveis.
  if (request.method !== "GET" || url.pathname.startsWith("/api/")) {
    return;
  }

  // Navegação: network-first com fallback para cache/home.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, cloned)).catch(() => undefined);
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match("/");
        }),
    );
    return;
  }

  // Assets estáticos: stale-while-revalidate simples.
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const cloned = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, cloned)).catch(() => undefined);
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    }),
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag !== SYNC_TAG) return;

  event.waitUntil(
    self.clients
      .matchAll({ includeUncontrolled: true, type: "window" })
      .then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: "TRIGGER_SYNC",
            source: "service_worker_sync",
            timestamp: Date.now(),
          });
        });
      })
      .catch(() => undefined),
  );
});
