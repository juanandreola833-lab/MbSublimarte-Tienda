// Service worker: permite instalar la tienda como app y que cargue rápido.
// Páginas, estilos, scripts y catálogo: primero red (para ver siempre lo último),
// si no hay conexión usa la copia guardada. Imágenes: primero la copia guardada.
const CACHE = "mb-tienda-v7";
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
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
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
  const esImagen = req.destination === "image" || url.hostname.includes("fonts.gstatic.com");

  if (esImagen) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok || res.type === "opaque") {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return res;
      }))
    );
    return;
  }

  if (url.origin !== location.origin && !url.hostname.includes("fonts.googleapis.com")) return;
  e.respondWith(
    fetch(req)
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
