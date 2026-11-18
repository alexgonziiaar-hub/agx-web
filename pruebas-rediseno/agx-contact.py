"""Hojas de contacto de las capturas de agx-shots.cjs.

Uso: python3 -I agx-contact.py /ruta/con/capturas

Genera varias hojas por grupo (tamaño y tema), con el nombre de cada captura encima:
  contacto-ordenador-claro-1.png, contacto-ordenador-oscuro-1.png, contacto-tableta-claro-1.png,
  contacto-movil-claro-1.png, contacto-movil-oscuro-1.png, contacto-estrecho-oscuro-1.png ...
Las capturas muy largas se recortan a un alto máximo y se marca cuánto falta.
Cada hoja mide como mucho unos 1.900 x 1.560 px para que se lea bien.
"""
import glob
import os
import sys

from PIL import Image, ImageDraw, ImageFont

FONDO = (24, 22, 34)
TXT = (232, 228, 245)
TXT2 = (160, 152, 190)
MARCA = (142, 108, 255)
GAP, ROT, MARGEN = 16, 40, 18

# prefijo, nombre de la hoja, columnas, ancho de celda, alto máximo de imagen, filas por hoja
GRUPOS = [
    ("d-claro", "ordenador-claro", 3, 616, 700, 2),
    ("d-oscuro", "ordenador-oscuro", 3, 616, 700, 2),
    ("t-claro", "tableta-claro", 4, 456, 700, 2),
    ("m-claro", "movil-claro", 6, 298, 700, 2),
    ("m-oscuro", "movil-oscuro", 6, 298, 700, 2),
    ("n-oscuro", "estrecho-oscuro", 6, 298, 700, 2),
]


def fuente(tam):
    for f in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"):
        if os.path.exists(f):
            return ImageFont.truetype(f, tam)
    try:
        return ImageFont.load_default(tam)
    except TypeError:
        return ImageFont.load_default()


F1, F2 = fuente(13), fuente(11)


def recorta_texto(draw, txt, ancho, f):
    if draw.textlength(txt, font=f) <= ancho:
        return txt
    while len(txt) > 4 and draw.textlength(txt + "…", font=f) > ancho:
        txt = txt[:-1]
    return txt + "…"


def celda(ruta, ancho, alto_max):
    im = Image.open(ruta).convert("RGB")
    w0, h0 = im.size
    esc = ancho / w0
    visible = min(h0, int(alto_max / esc))
    cortada = visible < h0
    if cortada:
        im = im.crop((0, 0, w0, visible))
    im = im.resize((ancho, max(1, round(im.height * esc))), Image.LANCZOS)
    return im, (w0, h0), (round(100 * visible / h0) if cortada else 100)


def hoja(archivos, cols, ancho, alto_max, salida, titulo):
    celdas = [(os.path.basename(f)[:-4],) + celda(f, ancho, alto_max) for f in archivos]
    filas = [celdas[i:i + cols] for i in range(0, len(celdas), cols)]
    altos = [max(c[1].height for c in fila) + ROT for fila in filas]
    w = MARGEN * 2 + cols * ancho + (cols - 1) * GAP
    h = MARGEN * 2 + 26 + sum(altos) + (len(filas) - 1) * GAP
    lienzo = Image.new("RGB", (w, h), FONDO)
    d = ImageDraw.Draw(lienzo)
    d.text((MARGEN, MARGEN - 4), titulo, fill=MARCA, font=F1)
    y = MARGEN + 26
    for fila, alto in zip(filas, altos):
        for i, (nombre, im, (w0, h0), pct) in enumerate(fila):
            x = MARGEN + i * (ancho + GAP)
            # sin el prefijo de tamaño y tema, que ya va en el título de la hoja
            corto = nombre.split("-", 2)[2] if nombre.count("-") >= 2 else nombre
            d.text((x, y), recorta_texto(d, corto, ancho, F1), fill=TXT, font=F1)
            d.text((x, y + 18), f"{w0}×{h0}" + ("" if pct == 100 else f" · se ve el {pct} % de arriba"), fill=TXT2, font=F2)
            lienzo.paste(im, (x, y + ROT))
            if pct != 100:
                d.rectangle((x, y + ROT + im.height - 3, x + ancho - 1, y + ROT + im.height - 1), fill=MARCA)
        y += alto + GAP
    lienzo.save(salida, optimize=True)
    print(f"{os.path.basename(salida)} {lienzo.size[0]}x{lienzo.size[1]} ({len(celdas)} capturas)")


def main():
    if len(sys.argv) < 2:
        sys.exit("Uso: python3 -I agx-contact.py /ruta/con/capturas")
    carpeta = sys.argv[1]
    for viejo in glob.glob(os.path.join(carpeta, "contacto-*.png")):
        os.remove(viejo)
    total = 0
    for pref, nombre, cols, ancho, alto_max, filas in GRUPOS:
        archivos = sorted(glob.glob(os.path.join(carpeta, pref + "-*.png")))
        por_hoja = cols * filas
        n_hojas = (len(archivos) + por_hoja - 1) // por_hoja
        for k in range(n_hojas):
            trozo = archivos[k * por_hoja:(k + 1) * por_hoja]
            hoja(trozo, cols, ancho, alto_max, os.path.join(carpeta, f"contacto-{nombre}-{k + 1}.png"), f"AGX · {nombre} · hoja {k + 1} de {n_hojas} · prefijo {pref}-")
            total += 1
    print(f"{total} hojas de contacto en {carpeta}")


if __name__ == "__main__":
    main()
