#!/usr/bin/env python3
"""
dress.py — veste il corpo base di Pixel Crawler con le palette dei mestieri.

Il pack gratuito fornisce solo il "Body_A": un manichino nudo animato a 4
direzioni. Gli abiti stanno nella versione a pagamento. Qui li dipingiamo:
la silhouette (braccia, busto, gambe) c'e' gia', quindi basta ricolorare le
fasce giuste della pelle lasciando fuori viso, mani e contorno nero.

Le palette non sono inventate: vengono campionate dagli sprite dei mestieri
dei fogli ChatGPT (cittadino, mercante, guardia, nobile, ladro, contadino,
monaco, assassino), cosi' il colore del mondo e il colore della gente
vengono dalla stessa fonte.
"""
import json
import os

import numpy as np
from PIL import Image

SKIN = (217, 160, 102)
SKIN_SH = (162, 101, 67)

# fasce verticali in frazione dell'altezza del corpo (misurate sul Body_A)
BAND_HAT = (0.00, 0.14)   # calotta del cranio → capelli/cappuccio/elmo
BAND_FACE = (0.14, 0.36)  # viso: resta pelle
BAND_TORSO = (0.36, 0.63)  # busto e braccia → tunica
BAND_LEGS = (0.63, 1.01)  # gambe → brache/saio


def shade(rgb, k):
    return tuple(int(max(0, min(255, c * k))) for c in rgb)


def dress_frame(arr, body_y0, body_y1, pal):
    """arr: HxWx4 uint8 di UN frame. Ritorna una copia vestita."""
    out = arr.copy()
    h = body_y1 - body_y0 + 1
    rgb = arr[:, :, :3]
    a = arr[:, :, 3]

    is_skin = (a > 0) & np.all(rgb == SKIN, axis=2)
    is_shade = (a > 0) & np.all(rgb == SKIN_SH, axis=2)

    def band(lo, hi):
        y = np.arange(arr.shape[0])[:, None]
        rel = (y - body_y0) / max(1, h - 1)
        return (rel >= lo) & (rel < hi) & np.ones((1, arr.shape[1]), bool)

    def paint(mask_band, main, dark):
        m1 = is_skin & mask_band
        m2 = is_shade & mask_band
        out[m1, :3] = main
        out[m2, :3] = dark

    paint(band(*BAND_HAT), pal['hair'], shade(pal['hair'], 0.7))
    paint(band(*BAND_TORSO), pal['tunic'], shade(pal['tunic'], 0.72))
    paint(band(*BAND_LEGS), pal['legs'], shade(pal['legs'], 0.72))

    # le mani sono i pixel piu' esterni delle righe basse del busto:
    # le riporto a pelle, altrimenti il personaggio sembra avere i guanti
    y0 = body_y0 + int(h * 0.46)
    y1 = body_y0 + int(h * 0.63)
    for y in range(max(0, y0), min(arr.shape[0], y1)):
        row = np.where(a[y] > 0)[0]
        if row.size < 4:
            continue
        for x in (row.min(), row.max(), row.min() + 1, row.max() - 1):
            if 0 <= x < arr.shape[1] and (is_skin[y, x] or is_shade[y, x]):
                out[y, x, :3] = SKIN if is_skin[y, x] else SKIN_SH
    return out


def sample_profession_palettes(catalog_path, slice_root, groups):
    """Colore dominante di busto e gambe per ogni mestiere dei fogli ChatGPT."""
    cat = json.load(open(catalog_path))
    pals = {}
    for key, name in groups.items():
        items = cat.get(key, [])
        buckets = {'hair': [], 'tunic': [], 'legs': []}
        for it in items:
            if it['h'] < 26 or it['w'] < 12:
                continue
            im = Image.open(os.path.join(slice_root, it['file'])).convert('RGBA')
            a = np.asarray(im)
            ys, xs = np.where(a[:, :, 3] > 0)
            if ys.size == 0:
                continue
            y0, y1 = ys.min(), ys.max()
            hh = max(1, y1 - y0)
            for band, (lo, hi) in (('hair', (0.00, 0.16)),
                                   ('tunic', (0.34, 0.60)),
                                   ('legs', (0.62, 0.95))):
                sel = (a[:, :, 3] > 0)
                yy = np.arange(a.shape[0])[:, None]
                rel = (yy - y0) / hh
                sel = sel & (rel >= lo) & (rel < hi)
                px = a[sel][:, :3].astype(int)
                # scarta il contorno scuro e i pixel quasi neri
                px = px[px.sum(axis=1) > 120]
                if px.size:
                    buckets[band].append(px)
        pal = {}
        for band, chunks in buckets.items():
            if not chunks:
                pal[band] = (120, 100, 80)
                continue
            px = np.concatenate(chunks)
            # Gli sprite ChatGPT hanno contorni molto scuri e tanta ombra: la
            # moda grezza restituirebbe sempre un marrone fangoso. Teniamo solo
            # la meta' piu' chiara dei pixel (il lato illuminato del vestito) e
            # ne prendiamo la moda quantizzata a 5 bit, che conserva la tinta.
            lum = px.max(axis=1)
            px = px[lum >= max(96, np.percentile(lum, 55))]
            if px.size == 0:
                pal[band] = (150, 130, 110)
                continue
            q = (px // 24) * 24
            cols, cnt = np.unique(q, axis=0, return_counts=True)
            c = cols[np.argmax(cnt)] + 12          # centro del bucket
            pal[band] = tuple(int(min(255, v)) for v in c)
        pals[name] = pal
    return pals


def build(src_dir, out_dir, pals, anims):
    os.makedirs(out_dir, exist_ok=True)
    manifest = {}
    for prof, pal in pals.items():
        manifest[prof] = {'palette': {k: list(v) for k, v in pal.items()},
                          'anims': {}}
        for anim, nframes in anims.items():
            for d in ('Down', 'Side', 'Up'):
                p = os.path.join(src_dir, f'{anim}_{d}.png')
                if not os.path.exists(p):
                    continue
                im = Image.open(p).convert('RGBA')
                arr = np.asarray(im).copy()
                ys, _ = np.where(arr[:, :, 3] > 0)
                dressed = dress_frame(arr, int(ys.min()), int(ys.max()), pal)
                name = f'{prof}_{anim}_{d}.png'
                Image.fromarray(dressed, 'RGBA').save(
                    os.path.join(out_dir, name))
                manifest[prof]['anims'].setdefault(anim, {})[d] = {
                    'file': name, 'frames': nframes,
                    'fw': im.height, 'fh': im.height}
    return manifest
