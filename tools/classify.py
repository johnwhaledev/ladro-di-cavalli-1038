#!/usr/bin/env python3
"""
classify.py — assegna ogni ritaglio al pannello del foglio da cui proviene.

I fogli sono organizzati a pannelli etichettati; le bande vuote fra i pannelli
sono state misurate sui bounding box dei ritagli (vedi PANELS). Ogni ritaglio
eredita la categoria del pannello che lo contiene; quello che cade fuori da
ogni pannello (titoli, didascalie, legenda a pie' di pagina) viene scartato.

Produce: catalog.json + un montaggio PNG per categoria, per la revisione.
"""
import json
import os
import sys

from PIL import Image, ImageDraw

# (y0, y1, [(x0, x1, categoria), ...])
PANELS = {
    'town': [
        (42, 280, [(20, 257, 'terreno'), (274, 491, 'strade'),
                   (515, 832, 'edifici'), (862, 1054, 'tetti'),
                   (1078, 1241, 'interni'), (1268, 1513, 'props')]),
        (288, 534, [(21, 247, 'vegetazione'), (272, 550, 'ambiente'),
                    (567, 923, 'porto'), (937, 1206, 'decorazioni'),
                    (1233, 1530, 'castello')]),
        (600, 780, [(28, 224, 'pg_cittadino'), (238, 405, 'pg_mercante'),
                    (417, 571, 'pg_guardia'), (590, 748, 'pg_nobile'),
                    (770, 944, 'pg_ladro'), (960, 1140, 'pg_contadino'),
                    (1159, 1320, 'pg_monaco'), (1347, 1530, 'pg_assassino')]),
        (808, 957, [(22, 291, 'cavalli'), (315, 595, 'carri'),
                    (621, 913, 'barche'), (937, 1202, 'animali'),
                    (1228, 1509, 'veicoli')]),
    ],
    'world': [
        (13, 288, [(12, 405, 'w_tilemap'), (412, 790, 'w_strade'),
                   (797, 1165, 'w_natura'), (1172, 1530, 'w_porto')]),
        (288, 703, [(12, 455, 'w_tetti'), (462, 965, 'w_strutture'),
                    (972, 1235, 'w_interni'), (1242, 1530, 'w_props')]),
        (733, 846, [(20, 231, 'wpg_cittadini'), (269, 407, 'wpg_mercanti'),
                    (431, 554, 'wpg_guardie'), (583, 736, 'wpg_nobili'),
                    (779, 936, 'wpg_ladri'), (959, 1099, 'wpg_contadini'),
                    (1125, 1257, 'wpg_monaci'), (1287, 1516, 'wpg_animali')]),
        (857, 1006, [(19, 202, 'w_cavalli'), (226, 392, 'w_carri'),
                     (415, 545, 'w_carrozze'), (568, 767, 'w_barche'),
                     (794, 897, 'w_anim_cammina'), (926, 1002, 'w_anim_corri'),
                     (1036, 1110, 'w_anim_attacca'), (1140, 1252, 'w_anim_guida'),
                     (1258, 1520, 'w_icone')]),
    ],
}


def classify(sheet_key, outdir):
    idx = json.load(open(os.path.join(outdir, 'index.json')))
    panels = PANELS[sheet_key]
    cat = {}
    orphans = 0

    for s in idx['slices']:
        cx, cy = s['x'] + s['w'] / 2, s['y'] + s['h'] / 2
        found = None
        for y0, y1, cols in panels:
            if not (y0 <= cy < y1):
                continue
            for x0, x1, name in cols:
                if x0 <= cx < x1:
                    found = name
                    break
            break
        if found is None:
            orphans += 1
            continue
        cat.setdefault(found, []).append(s)

    for k in cat:
        cat[k].sort(key=lambda s: (s['y'] // 20, s['x']))

    with open(os.path.join(outdir, 'catalog.json'), 'w') as f:
        json.dump(cat, f, indent=1)

    print(f'{sheet_key}: {sum(len(v) for v in cat.values())} classificati, '
          f'{orphans} fuori pannello (titoli/didascalie)', file=sys.stderr)
    for k, v in sorted(cat.items()):
        print(f'   {k:16} {len(v):3}', file=sys.stderr)
    return cat


def montage(cat, outdir, cell=110, cols=12):
    mdir = os.path.join(outdir, 'montaggi')
    os.makedirs(mdir, exist_ok=True)
    for name, items in cat.items():
        rows = (len(items) + cols - 1) // cols
        sheet = Image.new('RGBA', (cols * cell, rows * (cell + 14)),
                          (26, 28, 34, 255))
        d = ImageDraw.Draw(sheet)
        for i, k in enumerate(items):
            im = Image.open(os.path.join(outdir, k['file'])).convert('RGBA')
            im.thumbnail((cell - 8, cell - 8), Image.NEAREST)
            x = (i % cols) * cell + (cell - im.width) // 2
            y = (i // cols) * (cell + 14) + (cell - im.height) // 2
            sheet.alpha_composite(im, (x, y))
            d.text(((i % cols) * cell + 4, (i // cols) * (cell + 14) + cell),
                   f"{k['id']} {k['w']}x{k['h']}", fill=(205, 205, 195, 255))
        sheet.convert('RGB').save(os.path.join(mdir, f'{name}.png'))
    print(f'   montaggi → {mdir}', file=sys.stderr)


if __name__ == '__main__':
    key, out = sys.argv[1], sys.argv[2]
    montage(classify(key, out), out)
