#!/usr/bin/env python3
"""
Aplica al catálogo maestro el CSV de cambios exportado desde revision.html.

Columnas del CSV de cambios: id, nombre, categoria, stock, publicar, nuevo, comentario

Los códigos EN-xxx son encendedores y van a encendedores.csv; el resto son
stickers y van a catalogo.csv. Para los dos valen las mismas reglas:
  - nombre, categoría, stock, publicar y nuevo se copian a la planilla.
  - Un comentario se agrega a la nota ("comentario: ...").
  - stock = 0  ->  se ARCHIVA: sale de la planilla (y por lo tanto de la
    tienda y de revision.html) y su PNG original se mueve a
    Archivo/<carpeta original>/ dentro del repo de originales, junto con una
    fila en Archivo/archivados.csv para poder recuperarlo.

Después hay que correr procesar_imagenes.py (stickers) y/o
procesar_encendedores.py (encendedores) para regenerar la tienda.

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
from procesar_encendedores import CAMPOS as CAMPOS_ENC  # noqa: E402


def aplicar(filas, cambios):
    """Aplica los cambios a las filas (en el lugar). Devuelve (actualizados, archivados, faltan)."""
    por_id = {f["id"]: f for f in filas}
    actualizados, archivados, faltan = 0, [], []
    for c in cambios:
        f = por_id.get(c["id"])
        if not f:
            faltan.append(c["id"])
            continue
        for k in ("nombre", "categoria"):
            if c[k].strip():  # un nombre o categoría vacíos no borran el actual
                f[k] = c[k].strip()
        for k in ("stock", "nuevo"):
            f[k] = c[k].strip()
        if c.get("comentario", "").strip().lower() == "repetido":
            f["stock"] = "0"  # los marcados como repetidos también se sacan
        f["publicar"] = "si" if c["publicar"].strip() == "si" else "no"
        comentario = c.get("comentario", "").strip()
        nota = f.get("nota") or ""
        if comentario and f"comentario: {comentario}" not in nota:
            f["nota"] = (nota + "; " if nota else "") + f"comentario: {comentario}"
        if f["stock"] == "0":
            archivados.append(f)
        else:
            actualizados += 1
    return actualizados, archivados, faltan


def leer_csv(ruta):
    with ruta.open(newline="", encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))


def escribir_csv(ruta, campos, filas, encoding):
    with ruta.open("w", newline="", encoding=encoding) as fh:
        w = csv.DictWriter(fh, fieldnames=campos, extrasaction="ignore")
        w.writeheader()
        w.writerows(filas)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("cambios", help="CSV exportado desde revision.html")
    p.add_argument("originales", help="carpeta del repo mbsublimarte-originales")
    args = p.parse_args()

    base = Path(args.originales).resolve()
    cambios = leer_csv(Path(args.cambios))
    es_enc = lambda c: c["id"].startswith("EN-")

    planillas = [("stickers", base / "catalogo.csv", CAMPOS, "utf-8-sig", [c for c in cambios if not es_enc(c)])]
    if any(es_enc(c) for c in cambios):
        planillas.append(("encendedores", base / "encendedores.csv", CAMPOS_ENC, "utf-8",
                          [c for c in cambios if es_enc(c)]))

    todos_archivados, faltan = [], []
    for nombre, ruta, campos, encoding, propios in planillas:
        if not propios:
            continue
        filas = leer_csv(ruta)
        act, arch, falt = aplicar(filas, propios)
        faltan += falt
        ids_arch = {f["id"] for f in arch}
        for f in arch:  # el PNG original va a Archivo/, con la misma ruta
            origen = base / f["archivo"]
            destino = base / "Archivo" / f["archivo"]
            if origen.exists():
                destino.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(origen), str(destino))
            f["archivo"] = destino.relative_to(base).as_posix()
        todos_archivados += [dict(f, tipo=f.get("tipo") or "encendedor") for f in arch]
        escribir_csv(ruta, campos, [f for f in filas if f["id"] not in ids_arch], encoding)
        print(f"{act} {nombre} actualizados, {len(arch)} archivados (stock 0).")
        if arch:
            print("  Archivados:", ", ".join(f"{f['id']} {f['nombre']}" for f in arch))

    # registro de archivados (stickers y encendedores), para poder recuperarlos
    if todos_archivados:
        reg_path = base / "Archivo" / "archivados.csv"
        reg_path.parent.mkdir(parents=True, exist_ok=True)
        nuevo_reg = not reg_path.exists()
        with reg_path.open("a", newline="", encoding="utf-8-sig") as fh:
            w = csv.DictWriter(fh, fieldnames=CAMPOS + ["archivado"], extrasaction="ignore")
            if nuevo_reg:
                w.writeheader()
            for f in todos_archivados:
                w.writerow(dict(f, archivado=date.today().isoformat()))

    if faltan:
        print("No encontrados en el catálogo:", ", ".join(faltan))


if __name__ == "__main__":
    main()
