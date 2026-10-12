# MB Sublimarte — tienda de stickers

Sitio estático (HTML/CSS/JS puro, sin build ni framework) con el catálogo de
stickers DTF UV de MB Sublimarte. Carrito en localStorage, pedido por WhatsApp
(wa.me con mensaje armado) y pago por transferencia al alias. PWA instalable.
Se publica en Cloudflare (Workers con archivos estáticos, `wrangler.jsonc` +
`.assetsignore`) en https://mbsublimarte.com.ar, con deploy automático en cada
push a `main`. El link viejo de GitHub Pages redirige al dominio (salvo
`revision.html`). Todas las rutas son relativas.

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

## El negocio

- MB Sublimarte (Instagram @mb.sublimarte), emprendimiento de sublimación y
  personalizados: stickers DTF UV (esta tienda), y además tazas, remeras y
  gorras (DTF y sublimación), llaveros, cintas, agendas.
- Stickers: aprox. 5 × 5 cm, $1.000 c/u, combo 3 × $2.500 combinando diseños
  (todo en `data/config.js`, junto con WhatsApp y alias).
- Pedido: el cliente arma el carrito → nombre y entrega → ve el alias →
  "Enviar pedido por WhatsApp" (número MB-DDMM-XXXX). Al enviarlo, el Worker
  (`src/worker.js`, POST `/api/pedido`) manda una copia por mail desde
  pedidos@mbsublimarte.com.ar con los códigos para armar la plancha.
  `GET /api/pedido` muestra si el envío está configurado.
- Los pedidos del cliente quedan en su dispositivo ("Mis pedidos").

## Infraestructura

- Dominio `mbsublimarte.com.ar` en NIC Argentina, delegado a Cloudflare
  (stanley/stevie.ns.cloudflare.com). Vence el 27/09/2027.
- Cloudflare: Worker `mbsublimarte-tienda` (deploy automático desde GitHub,
  `npx wrangler deploy`). Email Routing activo: consultas@ y pedidos@
  reenvían a la casilla de la dueña; esa casilla está verificada como
  destino y se usa en `MAIL_TO` (`vars` de `wrangler.jsonc`, provisorio: el
  repo es público). Cloudflare compara la casilla en minúsculas.
- `keep_vars: true` y observability (logs) activados en `wrangler.jsonc`.
- Repos: `MbSublimarte-Tienda` (público, este), `mbsublimarte-originales`
  (privado: PNG sin marca + `catalogo.csv` + `Archivo/`),
  `mbsublimarte-originales-planchas` (privado: planchas 58×100 para imprimir,
  respaldo).
- `sw.js`: HTML/JS/CSS/catálogo siempre revalidados, imágenes
  stale-while-revalidate; la página avisa "Hay novedades · Actualizar" si
  cambió algo en el servidor.

## Flujos habituales

- **Cambios de la planilla** (CSV exportado desde `revision.html`):
  `python tools/aplicar_cambios.py cambios.csv ../mbsublimarte-originales`
  y después `python tools/procesar_imagenes.py ../mbsublimarte-originales`.
  Stock vacío = a pedido, número = unidades, `0` = sacar (se archiva).
  Comentario "repetido" también archiva. Nombre vacío no borra el actual.
- **Diseños nuevos**: llegan como planchas (PNG o PDF, fondo transparente).
  Recortar por transparencia (`tools/dividir_planchas.py` o separación por
  erosión si los bordes se tocan), comparar contra `catalogo.csv` y
  `Archivo/archivados.csv` para no duplicar, nombrar mirando cada sticker,
  copiar a `Nuevos/` en originales, agregar al CSV y procesar. Un sticker
  de ~5 cm con varios dibujos (ej. SKZOO) es un solo producto.
- Los códigos (AN-001, FR-001…) nunca se reutilizan, aunque el sticker esté
  archivado. Categorías nuevas toman 2 letras (FR = Frida, HP, VI, MT, DE).
- Siempre probar con Playwright (Chromium en /opt/pw-browsers) antes de
  publicar, y commitear en los dos repos.

## Pendientes

- Sacar la casilla de `wrangler.jsonc` (secreto en el panel o repo privado).
- `www.mbsublimarte.com.ar` (redirección a la raíz).
- Planchas completas como producto: sin definir precio.
- Renovar el dominio antes del 27/09/2027.
