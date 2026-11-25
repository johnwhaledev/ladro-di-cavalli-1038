#!/usr/bin/env python3
"""
pezzi_corte.py — la corte del castello di Valdarno come nel 1038 (05/10):
non piu' una cinta di pietra merlata ma un recinto di tronchi su un
terrapieno, con la porta di legno e le torrette di guardia agli angoli. La
torre dentro e' del lotto meta (innesta_nano.py, `castello_mastio`).

Disegnati da codice alla grana dei personaggi come quelli di disegna_pezzi.py
e pezzi_nord.py (di cui usano la Tela e il legno dei tronchi), ma senza neve.
Stanno solo nell'atlante del borgo.

Da solo scrive un provino in _src/provini/pezzi_corte.png.
"""
import os
import random
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from disegna_pezzi import TERRA, Tela, px
from percorsi import PROVINI
from pezzi_nord import NEVE, TRONCO, torretta

ZOLLA = [(70, 52, 38), TERRA, (128, 98, 68)]         # terra: ombra -> luce
ERBA = [(62, 92, 44), (96, 132, 62)]


def palo_terrapieno(alto, seme):
    """Un tronco appuntito piantato nel terrapieno: la zolla alla base e'
    piu' larga del tronco e tocca i bordi, cosi' i pali in fila (uno ogni
    0,55 unita') fanno un argine continuo, senza contorno ai giunti."""
    rnd = random.Random(seme)
    w, h, argine = 7, px(alto), 5
    t = Tela(w, h)
    y_pie = h - argine
    t.rett((1, 3, 5, y_pie + 1), TRONCO[1])
    t.rett((1, 3, 1, y_pie + 1), TRONCO[2])              # luce a sinistra
    t.rett((5, 3, 5, y_pie + 1), TRONCO[0])              # ombra a destra
    for _ in range(3):                                    # nodi e crepe
        t.punto((rnd.randrange(2, 5), rnd.randrange(6, y_pie)), TRONCO[0])
    t.pol([(1, 3), (3, 0), (5, 3)], TRONCO[2])            # la punta
    t.rett((0, y_pie, w - 1, h - 1), ZOLLA[1])            # il terrapieno
    t.rett((0, y_pie, w - 1, y_pie), ERBA[rnd.randrange(2)])
    t.rett((0, h - 2, w - 1, h - 1), ZOLLA[0])
    for _ in range(2):
        t.punto((rnd.randrange(w), rnd.randrange(y_pie + 1, h - 2)), ZOLLA[2])
    return t.chiudi(aperto='lr'), alto


def porta_corte():
    """La porta del recinto vista di fronte: due pali squadrati, l'architrave
    e un tettuccio di assi; sotto si passa (il vano e' vuoto)."""
    w, h = px(6.0), px(4.8)
    t = Tela(w, h)
    for x in (0, w - 6):
        t.rett((x, 9, x + 5, h - 1), TRONCO[1])
        t.rett((x, 9, x, h - 1), TRONCO[2])
        t.rett((x + 5, 9, x + 5, h - 1), TRONCO[0])
    t.rett((0, 9, w - 1, 13), TRONCO[2])                  # architrave
    t.rett((0, 13, w - 1, 14), TRONCO[0])
    for x in range(4, w - 4, 6):                          # le teste delle travi
        t.rett((x, 10, x + 1, 12), TRONCO[3])
    t.pol([(-1, 9), (3, 2), (w - 4, 2), (w, 9)], TRONCO[0])     # il tettuccio
    t.pol([(1, 8), (4, 3), (w - 5, 3), (w - 2, 8)], TRONCO[1])
    for x in range(5, w - 5, 4):
        t.rett((x, 4, x, 7), TRONCO[0])                   # le assi
    return t.chiudi(), 4.8


def senza_neve(im):
    """Il pezzo del fiordo con la neve fatta legno: dove c'era neve, il tono
    del tronco di pari luce."""
    a = np.array(im)
    for neve, legno in zip(NEVE, (TRONCO[1], TRONCO[2], TRONCO[3])):
        dove = (a[..., :3] == neve).all(axis=2)
        a[dove, :3] = legno
    return Image.fromarray(a)


def torretta_corte():
    """La torretta di guardia di legno del fiordo, senza la neve sul tetto."""
    im, alto = torretta()
    return senza_neve(im), alto


def pezzi():
    """[(nomi, immagine, altezza in unita')], come disegna_pezzi.pezzi()."""
    return [
        (['palo_corte_a'], *palo_terrapieno(3.4, 1)),
        (['palo_corte_b'], *palo_terrapieno(3.1, 2)),
        (['palo_corte_c'], *palo_terrapieno(3.6, 3)),
        (['porta_corte'], *porta_corte()),
        (['torretta_corte'], *torretta_corte()),
    ]


def provino():
    """Una fila di pali con la porta in mezzo e due torrette, ingrandita x4."""
    pz = {n[0]: im for n, im, _ in pezzi()}
    pali = [pz['palo_corte_a'], pz['palo_corte_b'], pz['palo_corte_c']]
    h = max(im.height for im in pz.values()) + 4
    w = 150
    tela = Image.new('RGBA', (w, h), (120, 110, 90, 255))
    porta, torr = pz['porta_corte'], pz['torretta_corte']
    xp = (w - porta.width) // 2
    for k, x in enumerate(range(0, w - 6, 4)):
        if xp - 6 < x < xp + porta.width:
            continue
        im = pali[(k * 7 + (k >> 2)) % 3]
        tela.alpha_composite(im, (x, h - im.height))
    tela.alpha_composite(porta, (xp, h - porta.height))
    for x in (2, w - torr.width - 2):
        tela.alpha_composite(torr, (x, h - torr.height))
    out = os.path.join(PROVINI, 'pezzi_corte.png')
    tela.resize((w * 4, h * 4), Image.NEAREST).save(out)
    print(out)


if __name__ == '__main__':
    provino()
