#!/usr/bin/env python3
"""
Genera las imágenes y el catálogo de la tienda a partir del repo privado de
originales (mbsublimarte-originales).

El repo de originales tiene:
  - las carpetas con los PNG originales (sin marca de agua)
  - catalogo.csv: la planilla maestra, una fila por sticker:
        id, nombre, categoria, tipo (sticker/plancha), publicar (si/no),
        stock (vacío = a pedido, 0 = agotado, número = unidades),
        nuevo (si/vacío), nota, archivo (ruta del PNG original)

Qué hace este script:
  1. Si hay PNG nuevos que no están en catalogo.csv, los agrega con un
     código nuevo, la categoría según la carpeta y el nombre del archivo.
  2. Para cada sticker genera dos WebP con marca de agua "@mb.sublimarte":
       assets/img/stickers/<id>.webp       (700 px, vista ampliada)
       assets/img/stickers/mini/<id>.webp  (360 px, grilla)
  3. Escribe data/productos.js (sólo los que tienen publicar = si) y
     data/revision.js (todos, para la página revision.html).
  4. Guarda catalogo.csv actualizado.

Los originales nunca se copian a la tienda: sólo las versiones con marca.

Uso:
    pip install pillow
    python tools/procesar_imagenes.py ../mbsublimarte-originales
    python tools/procesar_imagenes.py ../mbsublimarte-originales --forzar   # regenera todas
"""

import argparse
import csv
import hashlib
import json
import math
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "assets" / "img" / "stickers"
SALIDA_MINI = SALIDA / "mini"
EXTENSIONES = {".png", ".jpg", ".jpeg", ".webp"}
CAMPOS = ["id", "nombre", "categoria", "tipo", "publicar", "stock", "nuevo", "nota", "archivo"]
TAMANO, TAMANO_MINI = 700, 360

# Nombre de carpeta original -> categoría en la tienda.
# Una carpeta que no esté acá usa su propio nombre (sin "Sticker(s)").
CATEGORIAS_CARPETA = {
    "Sticker Goku Pokemon y Anime": "Anime",
    "Sticker del espacio": "Espacio",
    "Sticker manifestación y Universo": "Manifestación",
    "Stickers BTS y Stray Kids": "K-pop",
    "Stickers Bebidas": "Bebidas",
    "Stickers Caricaturas 2000 y Series": "Series y dibujitos",
    "Stickers Cocina": "Cocina",
    "Stickers Cute": "Cute",
    "Stickers Futbol en general": "Fútbol",
    "Stickers Marvel superheroes": "Marvel",
    "Stickers Memes": "Memes",
    "Stickers Música en general": "Música",
    "Stickers Patrios y Argentina (País)": "Argentina",
    "Stickers Personajes Disney": "Disney",
    "Stickers Selección Argenitina": "Selección",
    "Stickers Simpsons": "Simpsons",
}

CABECERA_PRODUCTOS = """\
/*
 * Catálogo publicado de MB Sublimarte.
 * NO editar a mano: se genera con tools/procesar_imagenes.py a partir de
 * catalogo.csv (repo mbsublimarte-originales).
 *
 * stock: número = unidades físicas, 0 = agotado, null = a pedido.
 */
window.PRODUCTOS = """

CABECERA_REVISION = """\
/*
 * Todos los stickers (publicados y ocultos) para revision.html.
 * Se genera con tools/procesar_imagenes.py. NO editar a mano.
 */
window.REVISION = """


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


def marca_de_agua(img, texto):
    ancho, alto = img.size
    lado = int(math.hypot(ancho, alto))
    capa = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    f = fuente(max(14, max(ancho, alto) // 13))
    caja = d.textbbox((0, 0), texto, font=f)
    tw, th = caja[2] - caja[0], caja[3] - caja[1]
    paso_x, paso_y = int(tw * 1.35), int(th * 3.2)
    for fila, y in enumerate(range(0, lado, paso_y)):
        desfase = (paso_x // 2) * (fila % 2)
        for x in range(-paso_x, lado, paso_x):
            d.text(
                (x + desfase, y), texto, font=f,
                fill=(255, 255, 255, 105),
                stroke_width=max(1, max(ancho, alto) // 350), stroke_fill=(74, 48, 98, 80),
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


def procesar(origen, destinos, texto):
    img = Image.open(origen).convert("RGBA")
    caja = img.getchannel("A").getbbox()
    if caja:
        img = img.crop(caja)
    for destino, tamano in destinos:
        copia = img.copy()
        copia.thumbnail((tamano, tamano), Image.LANCZOS)
        marca_de_agua(copia, texto).save(destino, "WEBP", quality=80, method=6)


def categoria_de(ruta):
    partes = Path(ruta).parts
    if "Stickers Simpsons" in partes:
        return "Simpsons"
    carpeta = partes[0] if len(partes) > 1 else "Varios"
    if carpeta in CATEGORIAS_CARPETA:
        return CATEGORIAS_CARPETA[carpeta]
    limpio = re.sub(r"^stickers?\s+", "", carpeta, flags=re.I).strip()
    return limpio[:1].upper() + limpio[1:]


def nombre_de(ruta):
    base = re.sub(r"[-_]+", " ", Path(ruta).stem).strip()
    return base[:1].upper() + base[1:]


def nuevo_id(categoria, filas):
    prefijo = next((f["id"].split("-")[0] for f in filas if f["categoria"] == categoria), None)
    if not prefijo:
        usados = {f["id"].split("-")[0] for f in filas}
        letras = re.sub(r"[^A-Z]", "", categoria.upper()) or "ST"
        prefijo = letras[:2]
        i = 2
        while prefijo in usados and i < len(letras):
            prefijo = letras[0] + letras[i]
            i += 1
    n = 1
    ids = {f["id"] for f in filas}
    while f"{prefijo}-{n:03d}" in ids:
        n += 1
    return f"{prefijo}-{n:03d}"


def stock_js(valor):
    valor = (valor or "").strip().lower()
    if valor in ("", "a pedido", "pedido"):
        return None
    try:
        return max(0, int(valor))
    except ValueError:
        return None


def escribir_js(ruta, cabecera, datos):
    ruta.write_text(cabecera + json.dumps(datos, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("originales", help="carpeta del repo mbsublimarte-originales")
    p.add_argument("--texto", default="@mb.sublimarte", help="texto de la marca de agua")
    p.add_argument("--forzar", action="store_true", help="regenerar todas las imágenes")
    args = p.parse_args()

    base = Path(args.originales).resolve()
    csv_path = base / "catalogo.csv"
    filas = list(csv.DictReader(csv_path.open(encoding="utf-8-sig"))) if csv_path.exists() else []
    conocidos = {f["archivo"] for f in filas}
    md5 = lambda ruta: hashlib.md5(ruta.read_bytes()).hexdigest()
    hashes = {md5(base / a) for a in conocidos if (base / a).exists()}

    # 1. archivos nuevos (las copias idénticas de uno que ya está se ignoran)
    agregados = repetidos = 0
    for archivo in sorted(base.rglob("*")):
        rel = archivo.relative_to(base).as_posix()
        if rel.startswith(".git") or archivo.suffix.lower() not in EXTENSIONES or rel in conocidos:
            continue
        h = md5(archivo)
        if h in hashes:
            repetidos += 1
            continue
        hashes.add(h)
        cat = categoria_de(rel)
        filas.append({"id": nuevo_id(cat, filas), "nombre": nombre_de(rel), "categoria": cat,
                      "tipo": "sticker", "publicar": "si", "stock": "", "nuevo": "si",
                      "nota": "nuevo: revisar nombre", "archivo": rel})
        agregados += 1

    # 2. imágenes
    SALIDA_MINI.mkdir(parents=True, exist_ok=True)
    procesadas, faltantes = 0, []
    for f in filas:
        origen = base / f["archivo"]
        if not origen.exists():
            faltantes.append(f["archivo"])
            continue
        grande, mini = SALIDA / f"{f['id']}.webp", SALIDA_MINI / f"{f['id']}.webp"
        if args.forzar or not grande.exists() or not mini.exists():
            procesar(origen, [(grande, TAMANO), (mini, TAMANO_MINI)], args.texto)
            procesadas += 1
            if procesadas % 25 == 0:
                print(f"  {procesadas} imágenes…")

    ids = {f["id"] for f in filas}
    for viejo in list(SALIDA.glob("*.webp")) + list(SALIDA_MINI.glob("*.webp")):
        if viejo.stem not in ids:
            viejo.unlink()

    # 3. catálogos para la web
    def item(f):
        return {"id": f["id"], "nombre": f["nombre"], "categoria": f["categoria"],
                "imagen": f"assets/img/stickers/{f['id']}.webp",
                "mini": f"assets/img/stickers/mini/{f['id']}.webp",
                "stock": stock_js(f["stock"]), "nuevo": f["nuevo"].strip().lower() == "si"}

    publicados = [item(f) for f in filas
                  if f["publicar"].strip().lower() == "si" and f["archivo"] not in faltantes]
    escribir_js(RAIZ / "data" / "productos.js", CABECERA_PRODUCTOS, publicados)
    revision = [dict(item(f), tipo=f["tipo"], publicar=f["publicar"].strip().lower() == "si",
                     stockTexto=f["stock"], nota=f["nota"]) for f in filas if f["archivo"] not in faltantes]
    escribir_js(RAIZ / "data" / "revision.js", CABECERA_REVISION, revision)

    # 4. planilla maestra
    with csv_path.open("w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=CAMPOS, extrasaction="ignore")
        w.writeheader()
        w.writerows(filas)

    print(f"\nListo: {len(filas)} stickers en catalogo.csv ({agregados} nuevos), "
          f"{len(publicados)} publicados, {procesadas} imágenes generadas, "
          f"{repetidos} copias idénticas ignoradas.")
    if faltantes:
        print(f"Atención: {len(faltantes)} archivos de catalogo.csv no existen:", *faltantes, sep="\n  ")


if __name__ == "__main__":
    sys.exit(main())
