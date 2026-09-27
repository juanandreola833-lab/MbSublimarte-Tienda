#!/usr/bin/env python3
"""
Procesa las fotos originales de los stickers para publicarlas en la tienda.

Para cada imagen de la carpeta de entrada (por defecto `originales/`):
  1. Recorta el borde transparente sobrante (si la imagen tiene transparencia).
  2. La achica a un tamaño web (por defecto 700 px del lado mayor).
  3. Le aplica marca de agua: texto "@mb.sublimarte" en diagonal repetido.
  4. La guarda en WebP liviano en `assets/img/stickers/`.
  5. Si el sticker todavía no está en `data/productos.js`, lo agrega con
     los datos que se deducen del nombre de archivo.

Convención de nombres de archivo:
    categoria_nombre-del-diseno.png
    ej:  kawaii_gatito-cafe.png   ->  categoría "Kawaii", nombre "Gatito cafe"
         frases_good-vibes.jpg    ->  categoría "Frases", nombre "Good vibes"

Las fotos originales NUNCA se suben al repo (la carpeta `originales/` está
en .gitignore): sólo se publican las versiones con marca de agua.

Uso:
    pip install pillow
    python tools/procesar_imagenes.py                 # procesa originales/
    python tools/procesar_imagenes.py carpeta/        # otra carpeta
    python tools/procesar_imagenes.py --forzar        # re-procesa todo
"""

import argparse
import json
import math
import re
import sys
import unicodedata
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "assets" / "img" / "stickers"
PRODUCTOS = RAIZ / "data" / "productos.js"
EXTENSIONES = {".png", ".jpg", ".jpeg", ".webp"}

CABECERA_PRODUCTOS = """\
/*
 * Catálogo de stickers de MB Sublimarte.
 *
 * Cada sticker tiene:
 *   id         código único (se usa en el pedido de WhatsApp)
 *   nombre     nombre visible
 *   categoria  para los filtros
 *   imagen     ruta a la foto con marca de agua (assets/img/stickers/...)
 *   stock      número de unidades físicas disponibles,
 *              0 = agotado, null = "a pedido" (se imprime cuando lo piden)
 *   nuevo      true para mostrar la etiqueta "Nuevo" (opcional)
 *
 * El precio es el mismo para todos y se configura en data/config.js.
 * Lo que está entre los corchetes [ ] tiene que ser JSON válido
 * (comillas dobles, sin coma después del último elemento).
 */
window.PRODUCTOS = """


def fuente(tamano):
    candidatas = [
        "DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
    ]
    for c in candidatas:
        try:
            return ImageFont.truetype(c, tamano)
        except OSError:
            continue
    return ImageFont.load_default(size=tamano)


def slug(texto):
    texto = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", texto.lower()).strip("-")


def datos_desde_nombre(archivo):
    base = archivo.stem
    if "_" in base:
        cat, nombre = base.split("_", 1)
    else:
        cat, nombre = "Varios", base
    limpiar = lambda s: re.sub(r"[-_]+", " ", s).strip()
    cat, nombre = limpiar(cat), limpiar(nombre)
    return cat[:1].upper() + cat[1:], nombre[:1].upper() + nombre[1:]


def marca_de_agua(img, texto):
    ancho, alto = img.size
    lado = int(math.hypot(ancho, alto))
    capa = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    f = fuente(max(14, ancho // 13))
    caja = d.textbbox((0, 0), texto, font=f)
    tw, th = caja[2] - caja[0], caja[3] - caja[1]
    paso_x, paso_y = int(tw * 1.35), int(th * 3.2)
    for fila, y in enumerate(range(0, lado, paso_y)):
        desfase = (paso_x // 2) * (fila % 2)
        for x in range(-paso_x, lado, paso_x):
            d.text(
                (x + desfase, y), texto, font=f,
                fill=(255, 255, 255, 105),
                stroke_width=max(1, ancho // 350), stroke_fill=(74, 48, 98, 80),
            )
    capa = capa.rotate(30, resample=Image.BICUBIC)
    izq, arr = (lado - ancho) // 2, (lado - alto) // 2
    capa = capa.crop((izq, arr, izq + ancho, arr + alto))

    # la marca sólo va sobre el sticker, no sobre el fondo transparente
    alfa_sticker = img.getchannel("A")
    alfa_marca = Image.composite(capa.getchannel("A"), Image.new("L", img.size, 0), alfa_sticker)
    capa.putalpha(alfa_marca)
    salida = img.copy()
    salida.alpha_composite(capa)

    return salida


def procesar(origen, destino, tamano, texto):
    img = Image.open(origen)
    img = img.convert("RGBA")
    caja = img.getchannel("A").getbbox()
    if caja:
        img = img.crop(caja)
    img.thumbnail((tamano, tamano), Image.LANCZOS)
    img = marca_de_agua(img, texto)
    img.save(destino, "WEBP", quality=82, method=6)


def leer_productos():
    if not PRODUCTOS.exists():
        return []
    txt = PRODUCTOS.read_text(encoding="utf-8")
    txt = txt[txt.index("window.PRODUCTOS"):]
    return json.loads(txt[txt.index("["): txt.rindex("]") + 1])


def guardar_productos(productos):
    cuerpo = json.dumps(productos, ensure_ascii=False, indent=2)
    PRODUCTOS.write_text(CABECERA_PRODUCTOS + cuerpo + ";\n", encoding="utf-8")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("entrada", nargs="?", default=str(RAIZ / "originales"))
    p.add_argument("--tamano", type=int, default=700, help="lado mayor en px (700)")
    p.add_argument("--texto", default="@mb.sublimarte", help="texto de la marca de agua")
    p.add_argument("--forzar", action="store_true", help="re-procesar aunque ya exista")
    args = p.parse_args()

    entrada = Path(args.entrada)
    if not entrada.is_dir():
        sys.exit(f"No existe la carpeta {entrada}")
    SALIDA.mkdir(parents=True, exist_ok=True)

    productos = leer_productos()
    por_imagen = {pr["imagen"]: pr for pr in productos}
    ids = {pr["id"] for pr in productos}
    nuevos = procesadas = 0

    for archivo in sorted(entrada.iterdir()):
        if archivo.suffix.lower() not in EXTENSIONES:
            continue
        categoria, nombre = datos_desde_nombre(archivo)
        destino = SALIDA / f"{slug(archivo.stem)}.webp"
        ruta_web = destino.relative_to(RAIZ).as_posix()
        if destino.exists() and not args.forzar:
            print(f"  = {archivo.name} (ya procesada)")
        else:
            procesar(archivo, destino, args.tamano, args.texto)
            procesadas += 1
            print(f"  + {archivo.name} -> {ruta_web}")

        if ruta_web not in por_imagen:
            prefijo = slug(categoria)[:2].upper() or "ST"
            n = 1
            while f"{prefijo}-{n:03d}" in ids:
                n += 1
            nuevo_id = f"{prefijo}-{n:03d}"
            ids.add(nuevo_id)
            pr = {"id": nuevo_id, "nombre": nombre, "categoria": categoria,
                  "imagen": ruta_web, "stock": None, "nuevo": True}
            productos.append(pr)
            por_imagen[ruta_web] = pr
            nuevos += 1

    guardar_productos(productos)
    print(f"\nListo: {procesadas} imágenes procesadas, {nuevos} stickers nuevos en el catálogo.")
    if nuevos:
        print("Revisá data/productos.js para ajustar nombres y stock.")


if __name__ == "__main__":
    main()
