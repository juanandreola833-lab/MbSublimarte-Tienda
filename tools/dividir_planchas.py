#!/usr/bin/env python3
"""
Divide las planchas (imágenes con varios stickers) en stickers sueltos.

Toma las filas de catalogo.csv con tipo = plancha, detecta cada sticker por
el fondo transparente que los separa y guarda cada uno como PNG en
    <carpeta de la categoría>/recortes/<código de la plancha>-NN.png
dentro del repo de originales. Cada recorte se agrega a catalogo.csv como
sticker nuevo de la misma categoría (nota "recorte de <plancha>").

Las planchas ya divididas (con recortes en el CSV) se saltean.
Después hay que correr procesar_imagenes.py para generar las imágenes web.

Uso:
    pip install pillow scipy
    python tools/dividir_planchas.py ../mbsublimarte-originales
"""

import argparse
import csv
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parent))
from procesar_imagenes import CAMPOS, nuevo_id  # noqa: E402

ALFA_MIN = 20  # por debajo se considera transparente


def piezas(img):
    """Devuelve una máscara booleana por cada sticker de la plancha."""
    alfa = np.asarray(img.getchannel("A")) > ALFA_MIN
    etiquetas, n = ndimage.label(ndimage.binary_dilation(alfa, iterations=3))
    if n == 0:
        return []
    areas = ndimage.sum(alfa, etiquetas, range(1, n + 1))
    cajas = ndimage.find_objects(etiquetas)
    total = alfa.sum()
    candidatas = [i for i in range(n) if areas[i] > total * 0.004]
    if not candidatas:
        return []
    mediana = float(np.median([areas[i] for i in candidatas]))
    grandes = [i for i in candidatas if areas[i] >= mediana * 0.15]
    grupo = {i: [i] for i in grandes}

    # las piezas chicas (una pelota, unas estrellitas) se suman a la pieza
    # grande más cercana si están pegadas; si no, se descartan
    lado = max(img.size)
    for i in range(n):
        if i in grupo or areas[i] < total * 0.0005:
            continue
        cy = (cajas[i][0].start + cajas[i][0].stop) / 2
        cx = (cajas[i][1].start + cajas[i][1].stop) / 2

        def distancia(j):
            y, x = cajas[j]
            dy = max(y.start - cy, 0, cy - y.stop)
            dx = max(x.start - cx, 0, cx - x.stop)
            return (dx * dx + dy * dy) ** 0.5

        cercana = min(grandes, key=distancia)
        if distancia(cercana) < lado * 0.03:
            grupo[cercana].append(i)

    mascaras = []
    for i in sorted(grandes, key=lambda k: (cajas[k][0].start // (lado // 12), cajas[k][1].start)):
        m = np.isin(etiquetas, [k + 1 for k in grupo[i]]) & alfa
        mascaras.append(m)
    return mascaras


def recortar(img, mascara, margen=6):
    ys, xs = np.nonzero(mascara)
    y0, y1 = max(ys.min() - margen, 0), min(ys.max() + margen + 1, img.height)
    x0, x1 = max(xs.min() - margen, 0), min(xs.max() + margen + 1, img.width)
    rgba = np.asarray(img).copy()
    rgba[..., 3] = np.where(mascara, rgba[..., 3], 0)
    return Image.fromarray(rgba[y0:y1, x0:x1], "RGBA")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("originales", help="carpeta del repo mbsublimarte-originales")
    args = p.parse_args()

    base = Path(args.originales).resolve()
    csv_path = base / "catalogo.csv"
    filas = list(csv.DictReader(csv_path.open(encoding="utf-8-sig")))
    ya_divididas = {f["nota"].split("recorte de ")[1].split(";")[0].strip()
                    for f in filas if "recorte de " in f["nota"]}

    nuevas = 0
    for plancha in [f for f in filas if f["tipo"] == "plancha"]:
        if plancha["id"] in ya_divididas:
            continue
        img = Image.open(base / plancha["archivo"]).convert("RGBA")
        carpeta = Path(plancha["archivo"]).parts[0]
        destino = base / carpeta / "recortes"
        destino.mkdir(parents=True, exist_ok=True)
        titulo = plancha["nombre"].removeprefix("Plancha ").strip()
        mascaras = piezas(img)
        for n, m in enumerate(mascaras, 1):
            archivo = destino / f"{plancha['id']}-{n:02d}.png"
            recortar(img, m).save(archivo, optimize=True)
            filas.append({"id": nuevo_id(plancha["categoria"], filas), "nombre": f"{titulo} {n}",
                          "categoria": plancha["categoria"], "tipo": "sticker", "publicar": "si",
                          "stock": "", "nuevo": "", "nota": f"recorte de {plancha['id']}",
                          "archivo": archivo.relative_to(base).as_posix()})
            nuevas += 1
        print(f"  {plancha['id']} {plancha['nombre']}: {len(mascaras)} stickers")

    with csv_path.open("w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=CAMPOS, extrasaction="ignore")
        w.writeheader()
        w.writerows(filas)
    print(f"\nListo: {nuevas} stickers recortados y agregados a catalogo.csv.")


if __name__ == "__main__":
    main()
