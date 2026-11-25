#!/usr/bin/env python3
"""
ritaglia.py — estrae gli sprite lavorando DENTRO i pannelli trovati da pannelli.py.

Il vecchio slice_sheet.py macinava il foglio intero e classify.py assegnava dopo
i blob ai pannelli. Invertire i due passi risolve tre cose insieme:
  - la cornice del pannello non diventa mai un blob, perche' resta fuori;
  - le etichette (il titolo in alto, la didascalia sotto i tile) stanno in bande
    note e si tolgono per posizione invece che per euristica sul colore — era
    l'euristica che una volta ha lasciato passare la scritta "(base)" saldata al
    tetto di una casa;
  - ogni ritaglio nasce gia' con l'indirizzo del pannello da cui viene.

Uso:
    python3 ritaglia.py out/pannelli/pa_deserto_pirati.json --raw raw --out out/tagli
"""
import argparse
import json
import os

import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pannelli import taglia as taglia_xy


def testo(patch_rgb, patch_mask):
    """Glifi: poco saturi, chiari, e riempiono poco il loro rettangolo."""
    px = patch_rgb[patch_mask]
    if px.size == 0:
        return True
    mx = px.max(axis=1).astype(np.float32)
    mn = px.min(axis=1).astype(np.float32)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    return sat.mean() < 0.22 and mx.mean() > 120 and patch_mask.mean() < 0.42


def griglia(sub, bg_tavola, bg_thresh, min_cella=22):
    """
    Pannelli fatti di riquadri adiacenti: stanze, tratti di strada, tile di
    terreno. Il ritaglio a blob non li vede — i riquadri si toccano, la
    dilatazione li salda e ne esce un unico pezzo grande quanto il pannello.

    Qui si riusa il taglio XY di pannelli.py alla scala del pannello: fra un
    riquadro e l'altro resta comunque un solco di un paio di pixel, e quello
    basta. Il ritaglio esce rettangolare e opaco, che per una stanza o un
    tile e' giusto: non e' un oggetto da scontornare.
    """
    # La maschera va ricalcolata sul fondo della TAVOLA, non su quello del
    # pannello: in un pannello di stanze i riquadri arrivano fino al bordo,
    # quindi la mediana del bordo e' gia' contenuto e il solco fra due stanze
    # risulterebbe "pieno" come tutto il resto.
    m = np.linalg.norm(sub.astype(np.float32) - bg_tavola, axis=2) > bg_thresh
    m = ndimage.binary_opening(m, np.ones((2, 2)))
    h, w = m.shape
    celle = taglia_xy(m, 0, h, 0, w, gutter=2, min_lato=min_cella,
                      eps=0.12, prof_max=6)
    fuori = []
    for (y0, y1, x0, x1) in celle:
        if y1 - y0 < min_cella or x1 - x0 < min_cella:
            continue
        ys, xs = np.where(m[y0:y1, x0:x1])
        if len(ys) == 0:
            continue
        a, b = y0 + ys.min(), y0 + ys.max() + 1
        c, d = x0 + xs.min(), x0 + xs.max() + 1
        if b - a < min_cella or d - c < min_cella:
            continue
        arr = np.zeros((b - a, d - c, 4), np.uint8)
        arr[..., :3] = sub[a:b, c:d]
        arr[..., 3] = 255
        fuori.append({'img': Image.fromarray(arr, 'RGBA'),
                      'x': int(c), 'y': int(a),
                      'w': int(d - c), 'h': int(b - a), 'sospetto': False,
                      'griglia': True})
    return fuori


def ritaglia_pannello(rgb, p, bg_thresh, dilate, min_side, min_area,
                      titolo=30, didascalia=22, pad=1, bordo=4, bg_tavola=None):
    """Ritagli dentro un pannello, esclusa la banda del titolo e quella in fondo."""
    x0, y0, w, h = p['x'] + bordo, p['y'] + bordo, p['w'] - 2 * bordo, p['h'] - 2 * bordo
    if w < 20 or h < 20:
        return []
    sub = rgb[y0:y0 + h, x0:x0 + w]

    # il fondo del pannello e' il suo, non quello della tavola
    ang = np.concatenate([sub[:3].reshape(-1, 3), sub[-3:].reshape(-1, 3),
                          sub[:, :3].reshape(-1, 3), sub[:, -3:].reshape(-1, 3)])
    bg = np.median(ang, axis=0)
    m = np.linalg.norm(sub.astype(np.float32) - bg, axis=2) > bg_thresh
    m = ndimage.binary_opening(m, np.ones((2, 2)))

    lab, _ = ndimage.label(ndimage.binary_dilation(m, np.ones((dilate, dilate))))
    fuori = []
    for i, sl in enumerate(ndimage.find_objects(lab), start=1):
        if sl is None:
            continue
        ys, xs = sl
        a, b, c, d = ys.start, ys.stop, xs.start, xs.stop
        hh, ww = b - a, d - c
        if ww < min_side or hh < min_side or ww * hh < min_area:
            continue
        if ww > 0.98 * w and hh > 0.98 * h:
            continue
        mm = m[a:b, c:d] & (lab[a:b, c:d] == i)
        # bande riservate alle scritte
        in_titolo = b <= titolo
        in_didascalia = a >= h - didascalia
        if (in_titolo or in_didascalia) and testo(sub[a:b, c:d], mm):
            continue
        if testo(sub[a:b, c:d], mm):
            continue
        alpha = ndimage.binary_dilation(mm, np.ones((3, 3)))
        out = np.zeros((hh + 2 * pad, ww + 2 * pad, 4), np.uint8)
        out[pad:pad + hh, pad:pad + ww, :3] = sub[a:b, c:d]
        out[pad:pad + hh, pad:pad + ww, 3] = alpha.astype(np.uint8) * 255
        # Le scritte dei titoli passano i filtri di colore: sono pixel-font
        # piene e sature quanto uno sprite. L'unica cosa che le tradisce senza
        # falsi positivi e' la forma — larghe e basse. Non le butto, le segno:
        # la curatela che sceglie cosa entra nell'atlante le scarta gratis, e
        # se il flag sbaglia non ho perso niente.
        sospetto = (ww / max(hh, 1) > 2.4 and hh < 64)
        fuori.append({'img': Image.fromarray(out, 'RGBA'),
                      'x': int(x0 + c), 'y': int(y0 + a),
                      'w': int(ww), 'h': int(hh),
                      'sospetto': bool(sospetto)})
    # Se il pannello e' una scacchiera di riquadri attaccati, il ciclo sopra
    # restituisce niente o un pezzo solo grande quanto tutto il pannello.
    # E' il caso degli interni, delle strade e di certi tilemap: si passa al
    # taglio a griglia.
    grande = sum(f['w'] * f['h'] for f in fuori) > 0.55 * w * h
    if len(fuori) <= 1 and (not fuori or grande) and m.mean() > 0.5:
        g = griglia(sub, bg_tavola, bg_thresh)
        if len(g) > len(fuori):
            for f in g:
                f['x'] += x0
                f['y'] += y0
            return g

    fuori.sort(key=lambda k: (k['y'] // 16, k['x']))
    return fuori


def contact(items, dest, cell=112, cols=14, titolo=''):
    if not items:
        return
    righe = (len(items) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cell, righe * (cell + 14) + 22), (22, 24, 30))
    d = ImageDraw.Draw(sheet)
    d.text((6, 6), titolo, fill=(255, 220, 150))
    for i, it in enumerate(items):
        im = Image.open(it['file']).convert('RGBA')
        im.thumbnail((cell - 8, cell - 8), Image.NEAREST)
        cx = (i % cols) * cell + (cell - im.width) // 2
        cy = 22 + (i // cols) * (cell + 14) + (cell - im.height) // 2
        sheet.paste(im, (cx, cy), im)
        d.text(((i % cols) * cell + 3, 22 + (i // cols) * (cell + 14) + cell),
               f"{it['id']}", fill=(190, 190, 185))
    sheet.save(dest)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('panels_json', nargs='+')
    ap.add_argument('--raw', default='raw')
    ap.add_argument('--out', default='out/tagli')
    ap.add_argument('--bg-thresh', type=float, default=26)
    ap.add_argument('--dilate', type=int, default=3)
    ap.add_argument('--min-side', type=int, default=10)
    ap.add_argument('--min-area', type=int, default=260)
    ap.add_argument('--no-contact', action='store_true')
    a = ap.parse_args()

    for pj in a.panels_json:
        meta = json.load(open(pj))
        base = os.path.splitext(meta['sheet'])[0]
        rgb = np.asarray(Image.open(os.path.join(a.raw, meta['sheet'])).convert('RGB'))
        ang = np.concatenate([rgb[:3].reshape(-1, 3), rgb[-3:].reshape(-1, 3),
                              rgb[:, :3].reshape(-1, 3), rgb[:, -3:].reshape(-1, 3)])
        bg_tavola = np.median(ang, axis=0)
        dest = os.path.join(a.out, base)
        os.makedirs(os.path.join(dest, 'png'), exist_ok=True)
        indice, tot = [], 0
        for p in meta['pannelli']:
            items = ritaglia_pannello(rgb, p, a.bg_thresh, a.dilate,
                                      a.min_side, a.min_area,
                                      bg_tavola=bg_tavola)
            for k, it in enumerate(items):
                nome = f"p{p['id']:02d}_{k:03d}.png"
                f = os.path.join(dest, 'png', nome)
                it['img'].save(f)
                it.pop('img')
                it.update(id=f"p{p['id']:02d}_{k:03d}", file=f, pannello=p['id'])
                indice.append(it)
            tot += len(items)
            if items and not a.no_contact:
                os.makedirs(os.path.join(dest, 'contact'), exist_ok=True)
                contact(items, os.path.join(dest, 'contact', f"p{p['id']:02d}.png"),
                        titolo=f"{base} · pannello {p['id']}  ({len(items)} pezzi)")
        json.dump({'sheet': meta['sheet'], 'tagli': indice},
                  open(os.path.join(dest, 'index.json'), 'w'), indent=1)
        print(f'{base:26} {len(meta["pannelli"]):3} pannelli → {tot:4} ritagli')


if __name__ == '__main__':
    main()
