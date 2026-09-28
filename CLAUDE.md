# MB Sublimarte — tienda de stickers

Sitio estático (HTML/CSS/JS puro, sin build ni framework) con el catálogo de
stickers DTF UV de MB Sublimarte. Carrito en localStorage, pedido por WhatsApp
(wa.me con mensaje armado) y pago por transferencia al alias. PWA instalable.
Se publica en Cloudflare (Workers con archivos estáticos, `wrangler.jsonc` +
`.assetsignore`) en https://mbsublimarte.com.ar, con deploy automático en cada
push a `main`. También sigue activo en GitHub Pages. Todas las rutas son
relativas.

Ver `README.md` para la estructura y el flujo de carga de stickers.

## Convenciones

- Todo en español (es-AR). Tipografías: Dancing Script (títulos, cursiva) y
  Quicksand (texto), de Google Fonts. Paleta lila + pasteles, tokens en `:root`
  de `assets/css/styles.css`.
- `data/config.js` se edita a mano. `data/productos.js` y `data/revision.js`
  son GENERADOS por `tools/procesar_imagenes.py` desde `catalogo.csv` del repo
  privado `mbsublimarte-originales` (fuente de verdad del catálogo). Son
  scripts (`window.PRODUCTOS` / `window.REVISION`) para que funcione también
  con file://.
- `revision.html` es la planilla de revisión para la dueña (noindex, no
  enlazada desde la tienda); exporta un CSV de cambios que se aplica con
  `tools/aplicar_cambios.py` (stock 0 = archivar: sale del catálogo y el PNG
  va a `Archivo/` del repo de originales).
- Precio único para todos los stickers + combo (config). No hay precio por
  producto.
- Imágenes publicadas: siempre pasadas por `tools/procesar_imagenes.py`
  (WebP 700 px + mini 360 px, marca de agua "@mb.sublimarte"), con el código
  del sticker como nombre de archivo. Nunca subir originales sin marca a este
  repo (público).
- Al cambiar archivos del sitio, subir la versión de `CACHE` en `sw.js`.
