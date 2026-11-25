#!/usr/bin/env python3
"""
provino_alberi.py — gli alberi ridotti alla grana dei personaggi, SOLO PROVINO.

Gli alberi dell'atlante sono di due mani e a due grane: le tavole ChatGPT a
~10 px per unita', i Pixel Crawler a 14-16, contro i 6,83 dei personaggi
(PPU_UMANO). Qui ogni albero passa da riduci() di innesta_nano.py all'altezza
che avrebbe alla grana dei personaggi, e si mette accanto all'originale alla
STESSA misura in unita' (come si vedrebbe in gioco), con un personaggio per
scala. Non tocca l'atlante: e' materiale per decidere (PLAN.md, famiglia di
alberi).

    python tools/provino_alberi.py        -> out/provino_alberi.png
"""
import json
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import innesta_nano  # noqa: E402
from percorsi import ASSETS, PROVINI  # noqa: E402

DENSITA = innesta_nano.DENSITA
FAMIGLIE = {
    'tavole ChatGPT': ['pino', 'pino_b', 'abete', 'frassino', 'albero_a',
                       'albero_b', 'albero_c', 'albero_f', 'melo'],
    'Pixel Crawler': ['faggio_pc', 'faggio_pc_b', 'pioppo_pc', 'quercia_pc',
                      'quercia_pc_b'],
}
S = 4                 # pixel del provino per pixel di grana (6,83 px/unita')
ERBA = (74, 98, 52, 255)


def ritaglio(atlante, r):
    return atlante.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h']))


def alla_misura(im, hu):
    """Scala l'immagine perche' sia alta hu unita' nel provino (NEAREST)."""
    h = round(hu * DENSITA * S)
    return im.resize((max(1, round(im.width * h / im.height)), h), Image.NEAREST)


def main():
    with open(os.path.join(ASSETS, 'manifest.json'), encoding='utf8') as f:
        m = json.load(f)
    mondo = Image.open(os.path.join(ASSETS, 'atlas_world.png')).convert('RGBA')
    pers = Image.open(os.path.join(ASSETS, 'atlas_chars.png')).convert('RGBA')
    rects = m['world']['rects']
    uomo_r = m['chars']['rects'][m['chars']['defs']['MiniVillagerMan']['anims']['idle'][0]]
    uomo = ritaglio(pers, uomo_r)
    uomo = uomo.resize((uomo.width * S, uomo.height * S), Image.NEAREST)

    righe = []
    for famiglia, nomi in FAMIGLIE.items():
        coppie = []
        for n in nomi:
            r = rects[n]
            orig = ritaglio(mondo, r)
            # in gioco il bosco li scala di 1,35 (world.js, buildForest)
            hu = r['hu'] * 1.35
            ridotto = innesta_nano.riduci(orig, max(6, round(hu * DENSITA)))
            coppie.append((n, r, alla_misura(orig, hu), alla_misura(ridotto, hu),
                           ridotto.size))
        righe.append((famiglia, coppie))

    W = max(sum(o.width + d.width + 30 for *_, o, d, _ in c) + uomo.width + 40
            for _, c in righe)
    alte = [max(o.height for *_, o, _, _ in c) + 60 for _, c in righe]
    tela = Image.new('RGBA', (W, sum(alte) + 20), ERBA)
    dr = ImageDraw.Draw(tela)
    y = 10
    for (famiglia, coppie), h in zip(righe, alte, strict=True):
        dr.text((10, y), f'{famiglia}: originale | ridotto a {DENSITA:.2f} px/unita\'',
                fill='white')
        base = y + h - 30
        x = 10
        tela.alpha_composite(uomo, (x, base - uomo.height))
        x += uomo.width + 20
        for n, r, o, d, (wr, hr) in coppie:
            tela.alpha_composite(o, (x, base - o.height))
            tela.alpha_composite(d, (x + o.width + 4, base - d.height))
            dr.text((x, base + 4), f'{n} {r["w"]}x{r["h"]}->{wr}x{hr}', fill='white')
            x += o.width + d.width + 30
        y += h
    os.makedirs(PROVINI, exist_ok=True)
    tela.save(os.path.join(PROVINI, 'provino_alberi.png'))
    print(f'{sum(len(c) for _, c in righe)} alberi -> out/provino_alberi.png '
          f'{tela.size}')


if __name__ == '__main__':
    main()
