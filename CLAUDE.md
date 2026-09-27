# MB Sublimarte — tienda de stickers

Sitio estático (HTML/CSS/JS puro, sin build ni framework) con el catálogo de
stickers DTF UV de MB Sublimarte. Carrito en localStorage, pedido por WhatsApp
(wa.me con mensaje armado) y pago por transferencia al alias. PWA instalable.
Se publica con GitHub Pages desde `main` (raíz), así que todas las rutas son
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
  enlazada desde la tienda); exporta un CSV de cambios que se aplica a
  `catalogo.csv`.
- Precio único para todos los stickers + combo (config). No hay precio por
  producto.
- Imágenes publicadas: siempre pasadas por `tools/procesar_imagenes.py`
  (WebP 700 px + mini 360 px, marca de agua "@mb.sublimarte"), con el código
  del sticker como nombre de archivo. Nunca subir originales sin marca a este
  repo (público).
- Al cambiar archivos del sitio, subir la versión de `CACHE` en `sw.js`.
