#!/usr/bin/env python3
"""
migra_picks.py — porta le scelte del borgo dal vecchio schema di id al nuovo.

`build_assets.py` sceglie i pezzi del borgo per numero: PICK_TOWN['edificio_casa']
= ritaglio 35 di out/town. Quei numeri li assegnava il vecchio slice_sheet.py,
che macinava il foglio intero. Il nuovo ritaglia.py lavora dentro i pannelli e
numera in un altro modo, quindi gli stessi identici pezzi hanno nomi diversi.

Rifare a mano duecento scelte non ha senso: i due indici contengono entrambi il
bounding box sul foglio, quindi la corrispondenza si calcola. Per ogni vecchio
ritaglio si cerca il nuovo con la sovrapposizione (IoU) piu' alta, e si riporta
la qualita' dell'accoppiamento invece di fidarsi.

Uso:
    python3 migra_picks.py            # riporta e basta
    python3 migra_picks.py --scrivi   # scrive out/pannelli/picks_borgo.json
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_assets

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

COPPIE = [('out/town', 'sheet_town', build_assets.PICK_TOWN),
          ('out/world', 'sheet_world', build_assets.PICK_WORLD)]


def iou(a, b):
    ax1, ay1, ax2, ay2 = a['x'], a['y'], a['x'] + a['w'], a['y'] + a['h']
    bx1, by1, bx2, by2 = b['x'], b['y'], b['x'] + b['w'], b['y'] + b['h']
    ix = max(0, min(ax2, bx2) - max(ax1, bx1))
    iy = max(0, min(ay2, by2) - max(ay1, by1))
    inter = ix * iy
    if inter == 0:
        return 0.0
    return inter / (a['w'] * a['h'] + b['w'] * b['h'] - inter)


def migra():
    fuori, problemi = {}, []
    for vecchio, tavola, picks in COPPIE:
        old = {s['id']: s for s in
               json.load(open(os.path.join(ROOT, vecchio, 'index.json')))['slices']}
        new = json.load(open(os.path.join(ROOT, 'out/tagli', tavola,
                                          'index.json')))['tagli']
        for nome, val in list(picks.items()) :
            sid = val[0] if isinstance(val, tuple) else val
            hu = val[1] if isinstance(val, tuple) else 1.0
            o = old.get(sid)
            if o is None:
                problemi.append((nome, tavola, sid, 'id inesistente', 0.0))
                continue
            best, score = None, 0.0
            for n in new:
                s = iou(o, n)
                if s > score:
                    best, score = n, s
            if best is None or score < 0.35:
                problemi.append((nome, tavola, sid, 'nessun corrispondente',
                                 round(score, 2)))
                continue
            fuori[nome] = {'tavola': tavola, 'id': best['id'], 'hu': hu,
                           'iou': round(score, 3),
                           'vecchio': sid}
    # le icone usano un dizionario a parte, stesso trattamento
    old = {s['id']: s for s in
           json.load(open(os.path.join(ROOT, 'out/world', 'index.json')))['slices']}
    new = json.load(open(os.path.join(ROOT, 'out/tagli/sheet_world',
                                      'index.json')))['tagli']
    for nome, sid in build_assets.ICONS.items():
        o = old.get(sid)
        if o is None:
            problemi.append((nome, 'sheet_world', sid, 'id inesistente', 0.0))
            continue
        best, score = max(((n, iou(o, n)) for n in new), key=lambda t: t[1])
        if score < 0.35:
            problemi.append((nome, 'sheet_world', sid, 'nessun corrispondente',
                             round(score, 2)))
            continue
        fuori[nome] = {'tavola': 'sheet_world', 'id': best['id'], 'hu': 1.0,
                       'kind': 'icon', 'iou': round(score, 3), 'vecchio': sid}
    # terreni
    old = {s['id']: s for s in
           json.load(open(os.path.join(ROOT, 'out/town', 'index.json')))['slices']}
    new = json.load(open(os.path.join(ROOT, 'out/tagli/sheet_town',
                                      'index.json')))['tagli']
    terreni = {}
    for nome, sid in build_assets.TERRENI.items():
        o = old.get(sid)
        if o is None:
            problemi.append((nome, 'sheet_town', sid, 'id inesistente', 0.0))
            continue
        best, score = max(((n, iou(o, n)) for n in new), key=lambda t: t[1])
        if score < 0.35:
            problemi.append((nome, 'sheet_town', sid, 'nessun corrispondente',
                             round(score, 2)))
            continue
        terreni[nome] = {'tavola': 'sheet_town', 'id': best['id'],
                         'iou': round(score, 3), 'vecchio': sid}
    return fuori, terreni, problemi


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--scrivi', action='store_true')
    a = ap.parse_args()
    pezzi, terreni, problemi = migra()
    tot = len(pezzi) + len(terreni)
    bassi = sorted([(v['iou'], k) for k, v in {**pezzi, **terreni}.items()])[:10]
    print(f'{tot} scelte migrate, {len(problemi)} senza corrispondenza')
    print('accoppiamenti piu\' deboli:',
          ', '.join(f'{k} {i}' for i, k in bassi))
    for p in problemi:
        print(f'  MANCA  {p[0]:24} {p[1]:12} vecchio id {p[2]:5}  {p[3]} (iou {p[4]})')
    if a.scrivi:
        d = os.path.join(ROOT, 'out', 'pannelli', 'picks_borgo.json')
        json.dump({'pezzi': pezzi, 'terreni': terreni,
                   'irrisolti': [list(p) for p in problemi]},
                  open(d, 'w'), indent=1)
        print(f'→ {d}')


if __name__ == '__main__':
    main()
