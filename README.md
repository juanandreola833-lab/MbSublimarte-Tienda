# MB Sublimarte · Tienda de stickers

Catálogo digital de stickers DTF UV de **MB Sublimarte** (@mb.sublimarte).
El cliente elige los stickers, los suma al carrito, completa su nombre y forma
de entrega, ve el **alias para transferir** y envía el pedido armado por
**WhatsApp**. Se puede instalar en el celu como una app.

- Precio: $1.000 c/u · Combo 3 × $2.500 (se combinan diseños distintos)
- Medida: aprox. 5 × 5 cm, proporcional según el diseño

## Estructura

```
index.html              tienda: catálogo + carrito + pago
revision.html           planilla para revisar nombres/stock/publicar (no enlazada)
data/config.js          WhatsApp, alias, precios, opciones de entrega
data/productos.js       catálogo publicado (GENERADO, no editar a mano)
data/revision.js        todos los stickers para revision.html (GENERADO)
assets/css/styles.css   estilos (paleta lila/pastel)
assets/js/app.js        lógica del catálogo, carrito y pedido
assets/img/stickers/    fotos con marca de agua (700 px) y mini/ (360 px)
assets/img/logo-mb.png  logo (solo las letras)
assets/icons/           íconos de la app
manifest.webmanifest    datos para instalar como app
sw.js                   service worker (carga rápida / sin conexión)
tools/procesar_imagenes.py  genera imágenes y catálogo desde los originales
```

## Cambiar datos de la tienda

Todo está en `data/config.js`: número de WhatsApp, alias (y opcionalmente
titular y CBU), precio unitario, combo, medida y opciones de entrega.

## Catálogo e imágenes

Los PNG originales (sin marca de agua) viven en el repo **privado**
`mbsublimarte-originales`, junto con `catalogo.csv`, la planilla maestra
(código, nombre, categoría, tipo, publicar, stock, nuevo, nota, archivo).

Para actualizar la tienda:

1. Subir PNG nuevos al repo de originales (en la carpeta de su categoría)
   y/o editar `catalogo.csv`.
2. Con los dos repos uno al lado del otro, correr desde esta carpeta:
   ```
   pip install pillow
   python tools/procesar_imagenes.py ../mbsublimarte-originales
   ```
   Agrega al CSV los PNG nuevos, genera las imágenes con marca de agua y
   reescribe `data/productos.js` y `data/revision.js`.
3. Commit de los dos repos (el CSV actualizado va en el de originales).

Stock en el CSV: número = unidades, `0` = agotado, vacío = a pedido.
`publicar` = `si`/`no`. Las planchas y los repetidos arrancan en `no`.

`revision.html` (…/MbSublimarte-Tienda/revision.html) muestra todos los
stickers para corregir nombres, stock y qué se publica; exporta los cambios
como CSV para pasarlos a `catalogo.csv`.

## Ver en local

```
python -m http.server 8000
```
y abrir http://localhost:8000. También funciona abriendo `index.html`
directo en el navegador (sin la parte de app instalable).

## Publicar (GitHub Pages)

En GitHub: **Settings → Pages → Build and deployment → Deploy from a branch →
`main` / `(root)`**. Queda en
`https://juanandreola833-lab.github.io/MbSublimarte-Tienda/`.

Después de actualizar archivos, subir el número de versión en `sw.js`
(`mb-tienda-v1` → `v2`) para que los celulares que la tienen instalada tomen
los cambios más rápido.
