# MB Sublimarte · Tienda de stickers

Catálogo digital de stickers DTF UV de **MB Sublimarte** (@mb.sublimarte).
El cliente elige los stickers, los suma al carrito, completa su nombre y forma
de entrega, ve el **alias para transferir** y envía el pedido armado por
**WhatsApp**. Se puede instalar en el celu como una app.

- Precio: $1.000 c/u · Combo 3 × $2.500 (se combinan diseños distintos)
- Medida: aprox. 5 × 5 cm, proporcional según el diseño

## Estructura

```
index.html              página única: catálogo + carrito + pago
data/config.js          WhatsApp, alias, precios, opciones de entrega
data/productos.js       catálogo de stickers (nombre, categoría, stock, foto)
assets/css/styles.css   estilos (paleta lila/pastel)
assets/js/app.js        lógica del catálogo, carrito y pedido
assets/img/stickers/    fotos publicadas (con marca de agua)
assets/img/logo-mb.png  logo (solo las letras)
assets/icons/           íconos de la app
manifest.webmanifest    datos para instalar como app
sw.js                   service worker (carga rápida / sin conexión)
tools/procesar_imagenes.py  optimiza fotos y les pone marca de agua
originales/             fotos originales SIN marca (no se suben al repo)
```

## Cambiar datos de la tienda

Todo está en `data/config.js`: número de WhatsApp, alias (y opcionalmente
titular y CBU), precio unitario, combo, medida y opciones de entrega.

## Cargar stickers nuevos

1. Poner las fotos originales en `originales/`, con nombre
   `categoria_nombre-del-diseno.png` (ej: `kawaii_gatito-cafe.png`).
   Idealmente PNG con fondo transparente.
2. Correr:
   ```
   pip install pillow
   python tools/procesar_imagenes.py
   ```
   Esto genera las versiones web con marca de agua en `assets/img/stickers/`
   y agrega los stickers nuevos a `data/productos.js`.
3. Revisar `data/productos.js` y ajustar nombre, categoría y stock:
   - `"stock": 12` → hay 12 unidades físicas
   - `"stock": 0` → agotado
   - `"stock": null` → a pedido (se imprime cuando lo piden)
   - `"nuevo": true` → muestra la etiqueta "Nuevo"

Las fotos originales **nunca** se suben: `originales/` está en `.gitignore`.

## Ver en local

```
python -m http.server 8000
```
y abrir http://localhost:8000. También funciona abriendo `index.html`
directo en el navegador (sin la parte de app instalable).

## Publicar (GitHub Pages)

En GitHub: **Settings → Pages → Build and deployment → Deploy from a branch →
`main` / `(root)`**. Queda en
`https://juanandreola833-lab.github.io/mbsublimarte-tienda/`.

Después de actualizar archivos, subir el número de versión en `sw.js`
(`mb-tienda-v1` → `v2`) para que los celulares que la tienen instalada tomen
los cambios más rápido.
