#!/usr/bin/env python3
"""
taglia_kenney.py — spacchetta i fogli roguelike di Kenney (CC0) in tile.

Sono griglie regolari: tile 16x16 con un pixel di margine, quindi passo 17.
Niente blob, niente euristiche: qui la griglia c'e' davvero, ed e' l'opposto
delle tavole generate con cui abbiamo litigato finora.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from percorsi import PROVINI, sorgente  # noqa: E402

TILE, PASSO = 16, 17


def taglia(path, dest):
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im)
    cols = (im.width + 1) // PASSO
    righe = (im.height + 1) // PASSO
    os.makedirs(dest, exist_ok=True)
    tenuti = []
    for r in range(righe):
        for c in range(cols):
            x, y = c * PASSO, r * PASSO
            t = im.crop((x, y, x + TILE, y + TILE))
            if np.asarray(t)[..., 3].max() == 0:
                continue
            nome = f'{r:02d}_{c:02d}'
            t.save(os.path.join(dest, nome + '.png'))
            tenuti.append({'id': nome, 'r': r, 'c': c})
    json.dump({'foglio': os.path.basename(path), 'tile': TILE,
               'righe': righe, 'colonne': cols, 'tiles': tenuti},
              open(os.path.join(dest, 'index.json'), 'w'), indent=1)
    return im, righe, cols, tenuti


def griglia_numerata(im, righe, cols, dest, S=3):
    o = Image.new('RGB', (im.width * S + 40, im.height * S + 30), (28, 32, 40))
    o.paste(im.resize((im.width * S, im.height * S), Image.NEAREST), (36, 26),
            im.resize((im.width * S, im.height * S), Image.NEAREST))
    d = ImageDraw.Draw(o)
    for c in range(cols):
        d.text((36 + c * PASSO * S + 2, 8), str(c % 10), fill=(150, 160, 180))
    for r in range(righe):
        d.text((4, 26 + r * PASSO * S + 12), f'{r:02d}', fill=(150, 160, 180))
    o.save(dest)


if __name__ == '__main__':
    for f, d in [('rl_roguelikeSheet_transparent', 'rpg'),
                 ('rc_roguelikeDungeon_transparent', 'dungeon')]:
        p = sorgente('kenney_prova', f + '.png')
        if not os.path.exists(p):
            continue
        im, righe, cols, t = taglia(p, os.path.join(PROVINI, 'kenney', d))
        griglia_numerata(im, righe, cols,
                         os.path.join(PROVINI, f'kenney_{d}_griglia.png'))
        print(f'{d}: {righe}x{cols} celle, {len(t)} tile non vuoti')
