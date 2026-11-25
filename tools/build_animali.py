#!/usr/bin/env python3
"""
build_animali.py — porta la tavola di animali nel formato del pool.

Delle sette tavole di personaggi nuove, questa e' l'unica che ha superato il
test di analisi_sprite.py con i numeri delle strip vere (deriva di palette
0.056 contro 0.047 del pool, area 0.023 contro 0.029). Le altre sei sono
concept art: imitano lo stile ma i frame di una stessa riga non appartengono
alla stessa animazione.

Un problema c'e': due animali diversi possono stare sulla stessa banda
orizzontale (alligatore e orso si alternano, lupo e serpente pure). Quindi non
basta raggruppare per riga — si collega un frame al successivo solo se stanno
alla stessa quota E hanno la stessa palette, e le componenti connesse di quel
grafo sono gli animali.

Produce strip PNG con alfa + manifest nel formato di src/mini.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from analisi_sprite import blob, istogramma

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'animali')


def gruppi(box, dy=16, dpal=0.26, dasp=0.45, dx_max=2.2):
    """
    Componenti connesse su un grafo di prossimita'. Il primo tentativo
    incatenava solo elementi consecutivi in un ordinamento globale, e bastava
    che due righe si sfiorassero in quota perche' la catena saltasse dall'una
    all'altra: il cammello finiva spezzato in quattro e l'alligatore cucito
    all'orso. Con 148 sprite il confronto a coppie costa nulla, quindi si
    collega ogni coppia che sta alla stessa quota, vicina in orizzontale, con
    la stessa palette E la stessa proporzione — e' la proporzione a separare
    l'alligatore (lungo e basso) dall'orso (compatto), che di palette si
    somigliano piu' di quanto sembri.
    """
    n = len(box)
    hist = [istogramma(b[4], b[5], bins=6) for b in box]
    cy = [b[1] + b[3] / 2 for b in box]
    asp = [b[2] / max(b[3], 1) for b in box]
    padre = list(range(n))

    def find(i):
        while padre[i] != i:
            padre[i] = padre[padre[i]]
            i = padre[i]
        return i

    for i in range(n):
        for j in range(i + 1, n):
            if abs(cy[i] - cy[j]) > dy:
                continue
            gap = abs(box[i][0] - box[j][0])
            if gap > dx_max * max(box[i][2], box[j][2]):
                continue
            if abs(asp[i] - asp[j]) / max(asp[i], asp[j]) > dasp:
                continue
            if 1 - np.minimum(hist[i], hist[j]).sum() > dpal:
                continue
            padre[find(i)] = find(j)

    g = {}
    for i in range(n):
        g.setdefault(find(i), []).append(i)
    fuori = [sorted(v, key=lambda i: box[i][0]) for v in g.values() if len(v) >= 3]
    fuori.sort(key=lambda v: (round(cy[v[0]] / 40), box[v[0]][0]))
    return fuori


def strip(path, nomi=None, thr=34):
    rgb, box = blob(path, thr=thr)
    gg = gruppi(box)
    os.makedirs(OUT, exist_ok=True)
    man = {}
    for k, idxs in enumerate(gg):
        bs = [box[i] for i in idxs]
        fw = max(b[2] for b in bs) + 2
        fh = max(b[3] for b in bs) + 2
        img = Image.new('RGBA', (fw * len(bs), fh), (0, 0, 0, 0))
        for j, b in enumerate(bs):
            x, y, w, h, sub, mask = b
            a = ndimage.binary_dilation(mask, np.ones((3, 3)))
            arr = np.zeros((h, w, 4), np.uint8)
            arr[..., :3] = sub
            arr[..., 3] = a.astype(np.uint8) * 255
            # appoggiato a terra e centrato, come il resto del pool
            img.alpha_composite(Image.fromarray(arr, 'RGBA'),
                                (j * fw + (fw - w) // 2, fh - h - 1))
        nome = nomi[k] if nomi and k < len(nomi) else f'animale{k}'
        img.save(os.path.join(OUT, nome + '.png'))
        n = len(bs)
        man[nome] = {'frame_width': fw, 'frame_height': fh, 'frame_count': n,
                     'animations': [
                         {'name': 'idle', 'from': 0, 'to': min(1, n - 1)},
                         {'name': 'walk', 'from': min(2, n - 1),
                          'to': min(n - 1, max(2, n // 2))},
                         {'name': 'run', 'from': min(n // 2 + 1, n - 1),
                          'to': n - 1},
                     ]}
    json.dump(man, open(os.path.join(OUT, '_manifest.json'), 'w'), indent=1)
    return man


def provino(man, dest, S=4):
    righe = list(man.items())
    W = max(m['frame_width'] * m['frame_count'] for _, m in righe) * S + 150
    H = sum(m['frame_height'] for _, m in righe) * S + len(righe) * 12 + 16
    o = Image.new('RGB', (W, H), (26, 28, 36))
    d = ImageDraw.Draw(o)
    y = 8
    for nome, m in righe:
        im = Image.open(os.path.join(OUT, nome + '.png')).convert('RGBA')
        im = im.resize((im.width * S, im.height * S), Image.NEAREST)
        o.paste(im, (140, y), im)
        d.text((6, y + im.height // 2), f"{nome} ({m['frame_count']})",
               fill=(255, 220, 150))
        y += im.height + 12
    o.save(dest)


if __name__ == '__main__':
    nomi = sys.argv[2:] or None
    m = strip(sys.argv[1], nomi)
    provino(m, os.path.join(ROOT, 'out', 'provino_animali.png'))
    for k, v in m.items():
        print(f"{k:14} {v['frame_count']:3} frame  {v['frame_width']}x{v['frame_height']}")
