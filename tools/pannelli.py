#!/usr/bin/env python3
"""
pannelli.py — trova da solo i pannelli di una tavola.

Storia breve dei tentativi, perche' serve a chi ci rimette mano:
  1. rettangoli scritti a mano (classify.py) — non scala oltre due tavole;
  2. "le linee lunghe sono cornici" — dentro il pannello del porto i moli sono
     linee lunghe quanto una cornice e spezzano tutto;
  3. "la cornice e' un rettangolo chiuso" — ma gli sprite la attraversano e le
     cornici vicine si saldano fra loro: zero pannelli trovati.

Quello che funziona e' non guardare le cornici affatto. I pannelli sono separati
da corridoi di fondo vuoto, e questo e' il taglio XY ricorsivo: si cerca la
banda vuota piu' larga, si taglia, si ricorre sui due pezzi. Non gli importa se
il pannello ha una cornice, se e' arrotondata, se qualcosa la attraversa.

Uso:
    python3 pannelli.py raw/*.png --gutter 10
"""
import argparse
import json
import os

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage


def contenuto(path, thr=18):
    im = Image.open(path).convert('RGB')
    rgb = np.asarray(im)
    b = np.concatenate([rgb[:3].reshape(-1, 3), rgb[-3:].reshape(-1, 3),
                        rgb[:, :3].reshape(-1, 3), rgb[:, -3:].reshape(-1, 3)])
    bg = np.median(b, axis=0)
    m = np.linalg.norm(rgb.astype(np.float32) - bg, axis=2) > thr
    return im, ndimage.binary_opening(m, np.ones((2, 2)))


def corridoi(prof, gutter, eps):
    """Intervalli [a,b) lunghi almeno `gutter` in cui il profilo sta sotto eps."""
    vuoto = prof <= eps
    out, i, n = [], 0, len(vuoto)
    while i < n:
        if not vuoto[i]:
            i += 1
            continue
        j = i
        while j < n and vuoto[j]:
            j += 1
        if j - i >= gutter:
            out.append((i, j))
        i = j
    return out


def taglia(m, y0, y1, x0, x1, gutter, min_lato, eps, prof_max, liv=0):
    h, w = y1 - y0, x1 - x0
    if liv >= prof_max or h < 2 * min_lato and w < 2 * min_lato:
        return [(y0, y1, x0, x1)]
    sub = m[y0:y1, x0:x1]

    # il corridoio interno piu' largo, sull'asse dove e' piu' largo
    ph = sub.mean(axis=1)
    pv = sub.mean(axis=0)
    ch = [c for c in corridoi(ph, gutter, eps) if c[0] > min_lato and c[1] < h - min_lato]
    cv = [c for c in corridoi(pv, gutter, eps) if c[0] > min_lato and c[1] < w - min_lato]
    best_h = max(ch, key=lambda c: c[1] - c[0]) if ch else None
    best_v = max(cv, key=lambda c: c[1] - c[0]) if cv else None

    scelta = None
    if best_h and best_v:
        scelta = ('h', best_h) if (best_h[1] - best_h[0]) >= (best_v[1] - best_v[0]) else ('v', best_v)
    elif best_h:
        scelta = ('h', best_h)
    elif best_v:
        scelta = ('v', best_v)
    if scelta is None:
        return [(y0, y1, x0, x1)]

    asse, (a, b) = scelta
    if asse == 'h':
        return (taglia(m, y0, y0 + a, x0, x1, gutter, min_lato, eps, prof_max, liv + 1) +
                taglia(m, y0 + b, y1, x0, x1, gutter, min_lato, eps, prof_max, liv + 1))
    return (taglia(m, y0, y1, x0, x0 + a, gutter, min_lato, eps, prof_max, liv + 1) +
            taglia(m, y0, y1, x0 + b, x1, gutter, min_lato, eps, prof_max, liv + 1))


def stringi(m, y0, y1, x0, x1, marg=2):
    """Restringe il rettangolo al contenuto effettivo."""
    sub = m[y0:y1, x0:x1]
    ys, xs = np.where(sub)
    if len(ys) == 0:
        return None
    return (y0 + max(0, ys.min() - marg), y0 + min(y1 - y0, ys.max() + 1 + marg),
            x0 + max(0, xs.min() - marg), x0 + min(x1 - x0, xs.max() + 1 + marg))


def trova(path, gutter=5, min_lato=40, eps=0.05, prof_max=7, min_area=7000):
    im, m = contenuto(path)
    H, W = m.shape
    r = stringi(m, 0, H, 0, W, 0) or (0, H, 0, W)
    box = taglia(m, *r, gutter, min_lato, eps, prof_max)
    pans = []
    for (y0, y1, x0, x1) in box:
        s = stringi(m, y0, y1, x0, x1)
        if s is None:
            continue
        y0, y1, x0, x1 = s
        if (y1 - y0) * (x1 - x0) < min_area or y1 - y0 < 30 or x1 - x0 < 30:
            continue
        pans.append({'x': int(x0), 'y': int(y0), 'w': int(x1 - x0),
                     'h': int(y1 - y0)})
    pans.sort(key=lambda p: (p['y'] // max(40, H // 22), p['x']))
    for k, p in enumerate(pans):
        p['id'] = k

    # --- rete di sicurezza: il contenuto che non sta in nessun pannello
    #
    # Il taglio XY produce anche regioni troppo piccole, che il filtro di area
    # scarta — e con loro sparisce quello che contenevano. Si vede solo a valle:
    # migrando le scelte del borgo, 36 pezzi su 216 (botti, staccionate, tutte
    # le icone) non trovavano piu' corrispondenza, e stavano tutti in bande
    # rimaste fuori da ogni rettangolo.
    #
    # Qui si prende quello che avanza, lo si raggruppa e lo si aggiunge in
    # coda. In coda e non in mezzo: gli id dei pannelli gia' nominati non si
    # devono spostare.
    coperto = np.zeros_like(m)
    for p in pans:
        coperto[p['y']:p['y'] + p['h'], p['x']:p['x'] + p['w']] = True
    resto = m & ~coperto
    lab2, _ = ndimage.label(ndimage.binary_dilation(resto, np.ones((14, 14))))
    extra = []
    for i, sl in enumerate(ndimage.find_objects(lab2), start=1):
        if sl is None:
            continue
        ys, xs = sl
        sub = resto[ys, xs] & (lab2[ys, xs] == i)
        if sub.sum() < 220:
            continue
        s2 = stringi(resto, ys.start, ys.stop, xs.start, xs.stop)
        if s2 is None:
            continue
        y0, y1, x0, x1 = s2
        if y1 - y0 < 12 or x1 - x0 < 12:
            continue
        extra.append({'x': int(x0), 'y': int(y0), 'w': int(x1 - x0),
                      'h': int(y1 - y0), 'residuo': True})
    extra.sort(key=lambda p: (p['y'] // max(40, H // 22), p['x']))
    for k, p in enumerate(extra, start=len(pans)):
        p['id'] = k
    return im, pans + extra


def overlay(im, pans, dest):
    o = im.convert('RGB').copy()
    d = ImageDraw.Draw(o)
    for p in pans:
        d.rectangle([p['x'], p['y'], p['x'] + p['w'] - 1, p['y'] + p['h'] - 1],
                    outline=(255, 45, 45), width=3)
        # il badge va in alto a DESTRA: a sinistra c'e' il titolo del pannello,
        # ed e' l'unica cosa che serve leggere per dargli un nome
        bx = p['x'] + p['w'] - 40
        d.rectangle([bx, p['y'] + 2, bx + 36, p['y'] + 28], fill=(255, 45, 45))
        d.text((bx + 8, p['y'] + 9), str(p['id']), fill=(255, 255, 255))
    o.save(dest)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('sheets', nargs='+')
    ap.add_argument('--outdir', default='out/pannelli')
    ap.add_argument("--gutter", type=int, default=5)
    ap.add_argument("--min-lato", type=int, default=40)
    a = ap.parse_args()
    os.makedirs(a.outdir, exist_ok=True)
    for s in a.sheets:
        base = os.path.splitext(os.path.basename(s))[0]
        im, pans = trova(s, gutter=a.gutter, min_lato=a.min_lato)
        overlay(im, pans, os.path.join(a.outdir, base + '.png'))
        json.dump({'sheet': os.path.basename(s), 'size': [im.width, im.height],
                   'pannelli': pans},
                  open(os.path.join(a.outdir, base + '.json'), 'w'), indent=1)
        print(f'{base:26} {len(pans):3} pannelli')


if __name__ == '__main__':
    main()
