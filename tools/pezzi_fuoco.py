#!/usr/bin/env python3
"""
pezzi_fuoco.py — i fotogrammi del fuoco e del fumo, disegnati da codice, per
tutte le citta' (innesta_nano.py li innesta negli atlanti).

Il fuoco e il fumo dipinti negli sprite stavano fermi (tua nota del 25/09
notte: "fumo fermo finto da sprite non va bene e nemmeno fuochi"). Adesso li
anima src/fuochi.js: la fiamma cambia fotogramma e guizza, il fumo esce a
sbuffi che salgono, si allargano, piegano col vento e svaniscono. Lo sprite
non ha trasparenza graduale (il renderer non la fa): lo sbuffo svanisce per
retinatura, quattro fotogrammi dal pieno al rado.

Da solo scrive un provino in out/pezzi_fuoco.png.
"""
import os
import random
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from percorsi import PROVINI  # noqa: E402

FUOCO = [(150, 34, 20), (222, 84, 28), (250, 160, 44), (255, 222, 120), (255, 250, 220)]
FUMO = [(112, 116, 124), (150, 154, 162), (188, 192, 198)]


def fiamma(k):
    """Un fotogramma della fiamma (k = 0..3): lingue che salgono e
    ondeggiano, dal rosso fuori al bianco del cuore."""
    w, h = 10, 16
    rnd = random.Random(100 + k)
    a = np.zeros((h, w, 4), np.uint8)
    cx = (w - 1) / 2 + [0, 0.6, -0.4, 0.3][k]
    for y in range(h):
        t = y / (h - 1)                            # 0 in cima, 1 alla base
        largo = 4.6 * np.sin(np.pi * min(1.0, t * 0.95 + 0.05)) ** 0.8
        piega = np.sin(t * 5 + k * 1.6) * (1 - t) * 1.4
        for x in range(w):
            d = abs(x - cx - piega) / max(0.6, largo)
            if d > 1 or (t < 0.2 and rnd.random() < 0.35):
                continue
            livello = 0 if d > 0.8 else 1 if d > 0.55 else 2 if d > 0.3 else 3
            if t > 0.55 and d < 0.25:
                livello = 4                        # il cuore, in basso
            if t < 0.3:
                livello = min(livello, 2)          # le punte sono rosse e arancio
            a[y, x] = FUOCO[livello] + (255,)
    for _ in range(2):                             # scintille
        x, y = rnd.randrange(w), rnd.randrange(0, 4)
        a[y, x] = FUOCO[3] + (255,)
    return Image.fromarray(a), 1.2


def fumo(k):
    """Uno sbuffo di fumo (k = 0..3, dal pieno al rado): tondo, grigio, piu'
    chiaro in alto a sinistra; i buchi della retinatura crescono con k."""
    w = h = 12
    rnd = random.Random(200 + k)
    a = np.zeros((h, w, 4), np.uint8)
    buchi = [0.08, 0.32, 0.55, 0.78][k]
    # una nuvoletta: tre tondi sovrapposti, il piu' grande in basso
    tondi = [(5.5, 7.0, 4.2), (3.6, 4.6, 2.8), (7.8, 4.2, 3.0)]
    for y in range(h):
        for x in range(w):
            dentro = [(x - cx) ** 2 + (y - cy) ** 2 <= r * r for cx, cy, r in tondi]
            if not any(dentro) or rnd.random() < buchi:
                continue
            # chiaro sopra ogni tondo, scuro sotto il grande
            alto = any((x - cx) ** 2 + (y - cy + 1.2) ** 2 <= (r - 1.3) ** 2
                       for cx, cy, r in tondi)
            tono = 2 if alto and y < 7 else 0 if y > 9 else 1
            a[y, x] = FUMO[tono] + (255,)
    return Image.fromarray(a), 1.0


def pezzi():
    """[(nomi, immagine, altezza in unita')], come disegna_pezzi.pezzi()."""
    return ([([f'fiamma_{k}'], *fiamma(k)) for k in range(4)] +
            [([f'fumo_{k}'], *fumo(k)) for k in range(4)])


def main():
    fila = pezzi()
    S = 8
    W = sum(im.width * S + 10 for _, im, _ in fila) + 10
    H = max(im.height for _, im, _ in fila) * S + 20
    o = Image.new('RGBA', (W, H), (40, 44, 56, 255))
    x = 10
    for _, im, _ in fila:
        g = im.resize((im.width * S, im.height * S), Image.NEAREST)
        o.alpha_composite(g, (x, H - 10 - g.height))
        x += g.width + 10
    dest = os.path.join(PROVINI, 'pezzi_fuoco.png')
    o.save(dest)
    print(dest, o.size)


if __name__ == '__main__':
    main()
