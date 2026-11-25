#!/usr/bin/env python3
"""
catalogo.py — unisce i nomi dei pannelli ai ritagli e produce il catalogo.

pannelli.py trova i pannelli, ritaglia.py estrae gli sprite dentro ciascuno,
e `out/pannelli/nomi.json` dice che cos'e' ogni pannello. Qui si chiude il
cerchio: ogni ritaglio eredita la categoria del suo pannello, e per ogni
categoria esce un montaggio da guardare.

E' il montaggio che serve davvero: la curatela (cosa entra nell'atlante di
quale mappa) si fa guardando una categoria alla volta, non 2349 file.

Le categorie che finiscono per `_concept` e `scarto` restano catalogate ma
sono marcate: la prima e' materiale generato che non regge come sprite
(analisi_sprite.py lo misura), la seconda sono titoli e legende.

Uso:
    python3 catalogo.py
"""
import json
import os
from collections import defaultdict

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAN = os.path.join(ROOT, 'out', 'pannelli')
TAGLI = os.path.join(ROOT, 'out', 'tagli')
OUT = os.path.join(ROOT, 'out', 'catalogo')

ESCLUSE = ('scarto',)


def eredita(tavola, mappa):
    """
    I pannelli 'residuo' (la rete di sicurezza di pannelli.py) nascono senza
    nome. Invece di rinominare tutto a mano, ereditano la categoria del
    pannello nominato piu' vicino: un residuo che sta fra due pannelli di
    props e' props, e nei casi in cui sbaglia si corregge una riga in
    nomi.json.
    """
    pj = os.path.join(PAN, tavola + '.json')
    if not os.path.exists(pj):
        return mappa
    pans = json.load(open(pj))['pannelli']
    noti = [p for p in pans if str(p['id']) in mappa]
    if not noti:
        return mappa
    fuori = dict(mappa)

    def dist(a, b):
        dx = max(0, max(a['x'] - (b['x'] + b['w']), b['x'] - (a['x'] + a['w'])))
        dy = max(0, max(a['y'] - (b['y'] + b['h']), b['y'] - (a['y'] + a['h'])))
        return (dx * dx + dy * dy) ** 0.5

    for p in pans:
        if str(p['id']) in fuori:
            continue
        vicino = min(noti, key=lambda q: dist(p, q))
        fuori[str(p['id'])] = mappa[str(vicino['id'])]
    return fuori


def costruisci():
    nomi = json.load(open(os.path.join(PAN, 'nomi.json')))
    cat = defaultdict(list)
    senza_nome = defaultdict(int)

    for tavola, mappa in nomi.items():
        if tavola.startswith('_'):
            continue
        mappa = eredita(tavola, mappa)
        idx_p = os.path.join(TAGLI, tavola, 'index.json')
        if not os.path.exists(idx_p):
            print(f'  {tavola}: nessun ritaglio, salto')
            continue
        for t in json.load(open(idx_p))['tagli']:
            c = mappa.get(str(t['pannello']))
            if c is None:
                senza_nome[tavola] += 1
                continue
            cat[c].append({**t, 'tavola': tavola})

    for c in cat:
        cat[c].sort(key=lambda t: (t['tavola'], -t['w'] * t['h']))
    for t, n in senza_nome.items():
        print(f'  {t}: {n} ritagli da pannelli senza nome')
    return cat


def montaggio(nome, items, dest, cell=130, cols=14):
    righe = (len(items) + cols - 1) // cols
    im = Image.new('RGB', (cols * cell, righe * (cell + 16) + 26), (20, 22, 28))
    d = ImageDraw.Draw(im)
    sosp = sum(1 for t in items if t.get('sospetto'))
    d.text((6, 7), f'{nome} — {len(items)} pezzi'
                   + (f' ({sosp} segnati come testo)' if sosp else ''),
           fill=(255, 220, 150))
    for i, t in enumerate(items):
        s = Image.open(t['file']).convert('RGBA')
        s.thumbnail((cell - 10, cell - 10), Image.NEAREST)
        cx = (i % cols) * cell + (cell - s.width) // 2
        cy = 26 + (i // cols) * (cell + 16) + (cell - s.height) // 2
        im.paste(s, (cx, cy), s)
        col = (200, 90, 90) if t.get('sospetto') else (140, 140, 138)
        d.text(((i % cols) * cell + 3, 26 + (i // cols) * (cell + 16) + cell),
               f"{t['tavola'][:9]} {t['id']}", fill=col)
    im.save(dest)


def main():
    os.makedirs(OUT, exist_ok=True)
    cat = costruisci()
    riepilogo = {}
    print(f"\n{'categoria':26} {'pezzi':>6} {'segnati':>8}  tavole")
    for c in sorted(cat, key=lambda k: -len(cat[k])):
        items = cat[c]
        sosp = sum(1 for t in items if t.get('sospetto'))
        tav = sorted({t['tavola'] for t in items})
        riepilogo[c] = {'pezzi': len(items), 'segnati': sosp, 'tavole': tav}
        print(f'{c:26} {len(items):6} {sosp:8}  {", ".join(t[:14] for t in tav)}')
        if c not in ESCLUSE:
            montaggio(c, items, os.path.join(OUT, c + '.png'))
    json.dump({'riepilogo': riepilogo, 'categorie': cat},
              open(os.path.join(OUT, 'catalogo.json'), 'w'), indent=1)
    tot = sum(len(v) for v in cat.values())
    utili = sum(len(v) for k, v in cat.items()
                if k not in ESCLUSE and not k.endswith('_concept'))
    print(f'\n{tot} ritagli catalogati · {utili} in categorie utilizzabili')


if __name__ == '__main__':
    main()
