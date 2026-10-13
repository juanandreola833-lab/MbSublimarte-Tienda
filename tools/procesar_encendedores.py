#!/usr/bin/env python3
"""
Genera las imágenes y el catálogo de ENCENDEDORES a partir del repo privado de
originales (mbsublimarte-originales).

En el repo de originales:
  - Encendedores/<código>.png: el diseño plano tal como se imprime (la
    plantilla que envuelve el encendedor, con fondo transparente alrededor)
  - encendedores.csv: una fila por diseño:
        id, nombre, categoria, publicar (si/no),
        stock (vacío = a pedido, 0 = agotado, número = unidades),
        nuevo (si/vacío), nota, archivo (ruta del PNG original)

Qué hace:
  1. Para cada diseño genera dos WebP con marca de agua "@mb.sublimarte":
       assets/img/encendedores/<id>.webp       (700 px, vista ampliada)
       assets/img/encendedores/mini/<id>.webp  (360 px, grilla)
  2. Escribe data/encendedores.js (sólo los que tienen publicar = si) y
     data/revision-encendedores.js (todos, para la pestaña Encendedores de
     revision.html).
  3. Guarda encendedores.csv normalizado (con todas las columnas).

Los cambios hechos en revision.html se aplican con tools/aplicar_cambios.py,
igual que los de stickers.

Los códigos son EN-001, EN-002… y nunca se reutilizan.

Uso:
    pip install pillow
    python tools/procesar_encendedores.py ../mbsublimarte-originales
    python tools/procesar_encendedores.py ../mbsublimarte-originales --forzar   # regenera todas
"""

import argparse
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from procesar_imagenes import TAMANO, TAMANO_MINI, escribir_js, procesar, stock_js  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "assets" / "img" / "encendedores"
SALIDA_MINI = SALIDA / "mini"

CABECERA = """\
/*
 * Catálogo publicado de encendedores de MB Sublimarte.
 * NO editar a mano: se genera con tools/procesar_encendedores.py a partir de
 * encendedores.csv (repo mbsublimarte-originales).
 *
 * stock: número = unidades físicas, 0 = agotado, null = a pedido.
 */
window.ENCENDEDORES = """

CABECERA_REVISION = """\
/*
 * Todos los encendedores (publicados y ocultos) para revision.html.
 * Se genera con tools/procesar_encendedores.py. NO editar a mano.
 */
window.REVISION_ENCENDEDORES = """

CAMPOS = ["id", "nombre", "categoria", "publicar", "stock", "nuevo", "nota", "archivo"]


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("originales", help="carpeta del repo mbsublimarte-originales")
    p.add_argument("--forzar", action="store_true", help="regenerar todas las imágenes")
    args = p.parse_args()

    base = Path(args.originales).resolve()
    with open(base / "encendedores.csv", newline="", encoding="utf-8-sig") as fh:
        filas = list(csv.DictReader(fh))

    for f in filas:
        for k in CAMPOS:
            f[k] = (f.get(k) or "").strip()

    SALIDA_MINI.mkdir(parents=True, exist_ok=True)
    validas, generadas = [], 0
    for f in filas:
        origen = base / f["archivo"]
        if not origen.exists():
            print(f"  ! falta {f['archivo']} ({f['id']})")
            continue
        grande, mini = SALIDA / f"{f['id']}.webp", SALIDA_MINI / f"{f['id']}.webp"
        if args.forzar or not grande.exists() or not mini.exists():
            procesar(origen, [(grande, TAMANO), (mini, TAMANO_MINI)], "@mb.sublimarte")
            generadas += 1
            print(f"  + {f['id']} {f['nombre']}")
        validas.append(f)

    # imágenes de encendedores que ya no están en el CSV (archivados)
    ids = {f["id"] for f in filas}
    for viejo in list(SALIDA.glob("EN-*.webp")) + list(SALIDA_MINI.glob("EN-*.webp")):
        if viejo.stem not in ids:
            viejo.unlink()

    def item(f):
        return {
            "id": f["id"],
            "nombre": f["nombre"],
            "categoria": f["categoria"],
            "imagen": f"assets/img/encendedores/{f['id']}.webp",
            "mini": f"assets/img/encendedores/mini/{f['id']}.webp",
            "stock": stock_js(f["stock"]),
            "nuevo": f["nuevo"].lower() == "si",
        }

    publicados = [item(f) for f in validas if f["publicar"].lower() == "si"]
    escribir_js(RAIZ / "data" / "encendedores.js", CABECERA, publicados)
    revision = [dict(item(f), tipo="encendedor", publicar=f["publicar"].lower() == "si",
                     stockTexto=f["stock"], nota=f["nota"]) for f in validas]
    escribir_js(RAIZ / "data" / "revision-encendedores.js", CABECERA_REVISION, revision)

    with open(base / "encendedores.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=CAMPOS, extrasaction="ignore")
        w.writeheader()
        w.writerows(filas)

    print(f"{len(filas)} encendedores en encendedores.csv, {len(publicados)} publicados, "
          f"{generadas} imágenes generadas.")


if __name__ == "__main__":
    main()
