#!/usr/bin/env python3
"""
Aplica al catálogo maestro el CSV de cambios exportado desde revision.html.

Columnas del CSV de cambios: id, nombre, categoria, stock, publicar, nuevo, comentario

Reglas:
  - nombre, categoría, stock, publicar y nuevo se copian a catalogo.csv.
  - Un comentario se agrega a la nota del sticker ("comentario: ...").
  - stock = 0  ->  el sticker se ARCHIVA: sale de catalogo.csv (y por lo tanto
    de la tienda y de la planilla) y su PNG original se mueve a
    Archivo/<carpeta original>/ dentro del repo de originales, junto con una
    fila en Archivo/archivados.csv para poder recuperarlo.

Después hay que correr procesar_imagenes.py para regenerar la tienda.

Uso:
    python tools/aplicar_cambios.py cambios.csv ../mbsublimarte-originales
"""

import argparse
import csv
import shutil
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from procesar_imagenes import CAMPOS  # noqa: E402


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("cambios", help="CSV exportado desde revision.html")
    p.add_argument("originales", help="carpeta del repo mbsublimarte-originales")
    args = p.parse_args()

    base = Path(args.originales).resolve()
    csv_path = base / "catalogo.csv"
    filas = list(csv.DictReader(csv_path.open(encoding="utf-8-sig")))
    por_id = {f["id"]: f for f in filas}
    cambios = list(csv.DictReader(Path(args.cambios).open(encoding="utf-8-sig")))

    actualizados, archivados, faltan = 0, [], []
    for c in cambios:
        f = por_id.get(c["id"])
        if not f:
            faltan.append(c["id"])
            continue
        for k in ("nombre", "categoria", "stock", "nuevo"):
            f[k] = c[k].strip()
        f["publicar"] = "si" if c["publicar"].strip() == "si" else "no"
        comentario = c.get("comentario", "").strip()
        if comentario and f"comentario: {comentario}" not in f["nota"]:
            f["nota"] = (f["nota"] + "; " if f["nota"] else "") + f"comentario: {comentario}"
        if f["stock"] == "0":
            archivados.append(f)
        else:
            actualizados += 1

    # archivar los de stock 0
    reg_path = base / "Archivo" / "archivados.csv"
    reg_path.parent.mkdir(parents=True, exist_ok=True)
    nuevo_reg = not reg_path.exists()
    with reg_path.open("a", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=CAMPOS + ["archivado"], extrasaction="ignore")
        if nuevo_reg:
            w.writeheader()
        for f in archivados:
            origen = base / f["archivo"]
            destino = base / "Archivo" / f["archivo"]
            if origen.exists():
                destino.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(origen), str(destino))
            f["archivo"] = destino.relative_to(base).as_posix()
            w.writerow(dict(f, archivado=date.today().isoformat()))

    ids_archivados = {f["id"] for f in archivados}
    filas = [f for f in filas if f["id"] not in ids_archivados]
    with csv_path.open("w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=CAMPOS, extrasaction="ignore")
        w.writeheader()
        w.writerows(filas)

    print(f"{actualizados} stickers actualizados, {len(archivados)} archivados (stock 0).")
    if archivados:
        print("Archivados:", ", ".join(f"{f['id']} {f['nombre']}" for f in archivados))
    if faltan:
        print("No encontrados en el catálogo:", ", ".join(faltan))


if __name__ == "__main__":
    main()
