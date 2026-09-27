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
- Datos editables por la dueña: `data/config.js` y `data/productos.js`
  (scripts que definen `window.CONFIG` / `window.PRODUCTOS`, para que funcione
  también abriendo el HTML con file://). En `productos.js`, lo que va después
  de `window.PRODUCTOS =` es JSON estricto: `tools/procesar_imagenes.py` lo lee
  y lo reescribe.
- Precio único para todos los stickers + combo (config). No hay precio por
  producto.
- Imágenes publicadas: siempre pasadas por `tools/procesar_imagenes.py`
  (WebP, 700 px, marca de agua "@mb.sublimarte"). Nunca subir originales sin
  marca; `originales/` está en `.gitignore`.
- Al cambiar archivos del sitio, subir la versión de `CACHE` en `sw.js`.
