#!/usr/bin/env python3
"""
analisi_sprite.py — le tavole di personaggi sono sprite veri o concept art?

La domanda non si risolve a occhio: una tavola generata imita benissimo lo stile
Mini, ma i frame di una stessa riga non appartengono alla stessa animazione.
Qui si misura, e si misura contro un metro noto: le strip vere del pool.

Per ogni riga di sprite calcola, fra frame consecutivi:
  - deriva di palette   (1 - intersezione degli istogrammi colore quantizzati)
  - deriva di silhouette (variazione relativa dell'area piena)
  - deriva di altezza    (variazione relativa dell'altezza del soggetto)
Un'animazione vera tiene la palette quasi identica e l'area entro pochi punti.
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage


def sfondo(rgb):
    b = np.concatenate([rgb[:3].reshape(-1, 3), rgb[-3:].reshape(-1, 3),
                        rgb[:, :3].reshape(-1, 3), rgb[:, -3:].reshape(-1, 3)])
    return np.median(b, axis=0)


def blob(path, thr=34, dil=3, min_area=200):
    im = Image.open(path).convert('RGB')
    rgb = np.asarray(im)
    bg = sfondo(rgb)
    m = np.linalg.norm(rgb.astype(np.float32) - bg, axis=2) > thr
    m = ndimage.binary_opening(m, np.ones((2, 2)))
    lab, n = ndimage.label(ndimage.binary_dilation(m, np.ones((dil, dil))))
    box = []
    for i, sl in enumerate(ndimage.find_objects(lab), start=1):
        if sl is None:
            continue
        ys, xs = sl
        h, w = ys.stop - ys.start, xs.stop - xs.start
        if w * h < min_area or w < 8 or h < 8 or w > 400 or h > 400:
            continue
        sub = m[ys, xs] & (lab[ys, xs] == i)
        if sub.mean() < 0.06:
            continue
        box.append((xs.start, ys.start, w, h, rgb[ys, xs], sub))
    return rgb, box


def righe(box, tol=0.45):
    """Raggruppa i box in righe per sovrapposizione verticale."""
    box = sorted(box, key=lambda b: b[1])
    out = []
    for b in box:
        posto = None
        for r in out:
            y0 = min(x[1] for x in r); y1 = max(x[1] + x[3] for x in r)
            if b[1] < y1 - tol * (y1 - y0) and b[1] + b[3] > y0:
                posto = r; break
        if posto is None:
            out.append([b])
        else:
            posto.append(b)
    for r in out:
        r.sort(key=lambda b: b[0])
    return [r for r in out if len(r) >= 3]


def istogramma(rgb, mask, bins=4):
    px = rgb[mask]
    if px.size == 0:
        return np.zeros(bins ** 3)
    q = (px.astype(np.uint16) * bins // 256).clip(0, bins - 1)
    idx = q[:, 0] * bins * bins + q[:, 1] * bins + q[:, 2]
    h = np.bincount(idx, minlength=bins ** 3).astype(np.float64)
    return h / max(h.sum(), 1)


def analizza(path, etichetta=None):
    rgb, box = blob(path)
    rr = righe(box)
    dp, da, dh, n = [], [], [], 0
    for r in rr:
        for a, b in zip(r, r[1:]):
            ha, hb = istogramma(a[4], a[5]), istogramma(b[4], b[5])
            dp.append(1 - np.minimum(ha, hb).sum())
            aa, ab = a[5].sum(), b[5].sum()
            da.append(abs(aa - ab) / max(aa, ab))
            dh.append(abs(a[3] - b[3]) / max(a[3], b[3]))
            n += 1
    if not n:
        return None
    return dict(file=os.path.basename(path), righe=len(rr), sprite=len(box),
                coppie=n, palette=float(np.median(dp)),
                area=float(np.median(da)), altezza=float(np.median(dh)))


if __name__ == '__main__':
    print(f"{'tavola':30} {'righe':>5} {'sprite':>6} {'palette':>8} "
          f"{'area':>7} {'altezza':>8}")
    for p in sys.argv[1:]:
        r = analizza(p)
        if r is None:
            print(f'{os.path.basename(p):30}  nessuna riga rilevata')
            continue
        print(f"{r['file']:30} {r['righe']:5} {r['sprite']:6} "
              f"{r['palette']:7.3f} {r['area']:6.3f} {r['altezza']:7.3f}")
