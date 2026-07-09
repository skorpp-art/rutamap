// Service worker mínimo: requisito para que Chrome ofrezca instalar la app y
// para el empaquetado como APK (TWA). Estrategia red-primero: la app siempre
// muestra datos frescos; solo los estáticos ya vistos sirven de respaldo si
// se corta la conexión un momento.
const CACHE = "rutamap-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Estáticos de Next (inmutables): cache-first
  if (url.pathname.startsWith("/_next/static/") || url.pathname.match(/\.(png|ico|svg|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then((hit) =>
        hit ?? fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
      )
    );
    return;
  }

  // Todo lo demás (páginas, datos): red primero, caché solo como respaldo
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
