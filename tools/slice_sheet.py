#!/usr/bin/env python3
"""
slice_sheet.py — estrae sprite utilizzabili dai concept sheet generati da ChatGPT.

I fogli non sono tileset: fondo scuro invece di alfa, etichette cotte nell'immagine,
pannelli con griglie diverse. Questo script:
  1. costruisce la maschera "non-sfondo" per distanza dal colore di fondo;
  2. raggruppa i pixel in blob con una dilatazione breve (le parti di uno stesso
     sprite si toccano quasi sempre entro 2-3 px);
  3. scarta cornici dei pannelli, etichette di testo e polvere;
  4. ritaglia ogni blob in un PNG con alfa e scrive un indice JSON;
  5. produce un contact sheet numerato per la revisione a occhio.

Uso:
    python3 slice_sheet.py raw/sheet_town.png out/town --bg-thresh 26
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage


# ---------------------------------------------------------------- maschera

def background_color(rgb: np.ndarray) -> np.ndarray:
    """Colore di fondo = mediana della cornice esterna (4 px)."""
    border = np.concatenate([
        rgb[:4].reshape(-1, 3), rgb[-4:].reshape(-1, 3),
        rgb[:, :4].reshape(-1, 3), rgb[:, -4:].reshape(-1, 3),
    ])
    return np.median(border, axis=0)


def foreground_mask(rgb: np.ndarray, bg: np.ndarray, thresh: float) -> np.ndarray:
    """True dove il pixel si stacca dal fondo."""
    d = np.linalg.norm(rgb.astype(np.float32) - bg, axis=2)
    m = d > thresh
    # toglie il sale-e-pepe della compressione senza mangiare i dettagli a 1 px
    m = ndimage.binary_opening(m, structure=np.ones((2, 2)))
    return m


# ---------------------------------------------------------------- filtri

def is_text_like(patch_rgb: np.ndarray, patch_mask: np.ndarray) -> bool:
    """
    Le etichette del foglio sono glifi crema/bianchi sottili: saturazione bassa,
    luminosita' alta, pochissimi pixel pieni rispetto al rettangolo.
    Gli sprite veri sono saturi e riempiono il proprio bounding box.
    """
    px = patch_rgb[patch_mask]
    if px.size == 0:
        return True
    mx = px.max(axis=1).astype(np.float32)
    mn = px.min(axis=1).astype(np.float32)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    fill = patch_mask.mean()
    bright = mx.mean()
    return (sat.mean() < 0.22 and bright > 120 and fill < 0.42)


def is_frame_like(w: int, h: int, fill: float) -> bool:
    """Cornici dei pannelli: rettangoli enormi, molto allungati o quasi vuoti."""
    ratio = max(w, h) / max(1, min(w, h))
    return (ratio > 14) or (fill < 0.06)


# ---------------------------------------------------------------- estrazione

def slice_sheet(path, outdir, bg_thresh, dilate, min_side, min_area, max_frac,
                pad):
    im = Image.open(path).convert('RGB')
    rgb = np.asarray(im)
    H, W = rgb.shape[:2]

    bg = background_color(rgb)
    mask = foreground_mask(rgb, bg, bg_thresh)

    grouped = ndimage.binary_dilation(mask, np.ones((dilate, dilate)))
    labels, n = ndimage.label(grouped)
    print(f'{os.path.basename(path)}: fondo {bg.astype(int).tolist()}, '
          f'{n} blob grezzi', file=sys.stderr)

    os.makedirs(outdir, exist_ok=True)
    slices_dir = os.path.join(outdir, 'slices')
    os.makedirs(slices_dir, exist_ok=True)

    max_area = H * W * max_frac
    kept, rejected = [], {'small': 0, 'frame': 0, 'text': 0, 'huge': 0}

    for idx, sl in enumerate(ndimage.find_objects(labels), start=1):
        if sl is None:
            continue
        ys, xs = sl
        y0, y1, x0, x1 = ys.start, ys.stop, xs.start, xs.stop
        h, w = y1 - y0, x1 - x0

        if w < min_side or h < min_side or w * h < min_area:
            rejected['small'] += 1
            continue
        if w * h > max_area:
            rejected['huge'] += 1
            continue

        sub_mask = mask[y0:y1, x0:x1] & (labels[y0:y1, x0:x1] == idx)
        fill = sub_mask.mean()
        if is_frame_like(w, h, fill):
            rejected['frame'] += 1
            continue
        if is_text_like(rgb[y0:y1, x0:x1], sub_mask):
            rejected['text'] += 1
            continue

        # ritaglio con alfa: alfa = maschera ammorbidita di 1 px per non
        # mangiare l'outline scuro degli sprite pixel-art
        alpha = ndimage.binary_dilation(sub_mask, np.ones((3, 3)))
        out = np.zeros((h + 2 * pad, w + 2 * pad, 4), dtype=np.uint8)
        out[pad:pad + h, pad:pad + w, :3] = rgb[y0:y1, x0:x1]
        out[pad:pad + h, pad:pad + w, 3] = alpha.astype(np.uint8) * 255

        name = f'{idx:04d}.png'
        Image.fromarray(out, 'RGBA').save(os.path.join(slices_dir, name))
        kept.append({'id': idx, 'file': f'slices/{name}',
                     'x': x0, 'y': y0, 'w': w, 'h': h,
                     'fill': round(float(fill), 3)})

    kept.sort(key=lambda k: (k['y'] // 24, k['x']))
    with open(os.path.join(outdir, 'index.json'), 'w') as f:
        json.dump({'source': os.path.basename(path),
                   'sheet_size': [W, H], 'slices': kept}, f, indent=1)

    print(f'  tenuti {len(kept)} · scartati {rejected}', file=sys.stderr)
    return kept, slices_dir, outdir


# ---------------------------------------------------------------- contact sheet

def contact_sheet(kept, slices_dir, outdir, cell=96, cols=16):
    """Griglia numerata per identificare a occhio cosa e' stato estratto."""
    from PIL import ImageDraw
    rows = (len(kept) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cell, rows * (cell + 12)), (24, 26, 32, 255))
    draw = ImageDraw.Draw(sheet)
    for i, k in enumerate(kept):
        im = Image.open(os.path.join(os.path.dirname(slices_dir),
                                     k['file'])).convert('RGBA')
        im.thumbnail((cell - 6, cell - 6), Image.NEAREST)
        cx = (i % cols) * cell + (cell - im.width) // 2
        cy = (i // cols) * (cell + 12) + (cell - im.height) // 2
        sheet.alpha_composite(im, (cx, cy))
        draw.text(((i % cols) * cell + 3, (i // cols) * (cell + 12) + cell),
                  f"{k['id']} {k['w']}x{k['h']}", fill=(200, 200, 190, 255))
    out = os.path.join(outdir, 'contact.png')
    sheet.convert('RGB').save(out)
    print(f'  contact sheet → {out}', file=sys.stderr)
    return out


def main():
    p = argparse.ArgumentParser()
    p.add_argument('sheet')
    p.add_argument('outdir')
    p.add_argument('--bg-thresh', type=float, default=26)
    p.add_argument('--dilate', type=int, default=3)
    p.add_argument('--min-side', type=int, default=10)
    p.add_argument('--min-area', type=int, default=260)
    p.add_argument('--max-frac', type=float, default=0.06)
    p.add_argument('--pad', type=int, default=1)
    p.add_argument('--cols', type=int, default=16)
    a = p.parse_args()

    kept, sdir, odir = slice_sheet(a.sheet, a.outdir, a.bg_thresh, a.dilate,
                                   a.min_side, a.min_area, a.max_frac, a.pad)
    if kept:
        contact_sheet(kept, sdir, odir, cols=a.cols)


if __name__ == '__main__':
    main()
