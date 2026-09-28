// Service worker: permite instalar la tienda como app y que cargue rápido,
// sin quedarse nunca con una versión vieja:
//  - Páginas, estilos, scripts y catálogo: siempre se piden a la red (revalidando
//    con el servidor); la copia guardada sólo se usa si no hay conexión.
//  - Imágenes: se muestra la copia guardada al instante y en segundo plano se
//    baja la versión actual, así un cambio de foto aparece en la próxima visita.
const CACHE = "mb-tienda-v9";
const BASE = [
  "./",
  "index.html",
  "assets/css/styles.css",
  "assets/js/app.js",
  "data/config.js",
  "data/productos.js",
  "assets/img/logo-mb.png",
  "manifest.webmanifest",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(BASE.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/")) return;
  const esImagen = req.destination === "image" || url.hostname.includes("fonts.gstatic.com");

  if (esImagen) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const guardada = await cache.match(req);
        const red = fetch(req)
          .then((res) => {
            if (res.ok || res.type === "opaque") cache.put(req, res.clone());
            return res;
          })
          .catch(() => guardada);
        if (guardada) {
          e.waitUntil(red);
          return guardada;
        }
        return red;
      })
    );
    return;
  }

  if (url.origin !== location.origin && !url.hostname.includes("fonts.googleapis.com")) return;
  // las navegaciones no admiten opciones extra; el resto se revalida siempre
  const pedido = req.mode === "navigate" ? fetch(req) : fetch(req, { cache: "no-cache" });
  e.respondWith(
    pedido
      .then((res) => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("index.html")))
  );
});
