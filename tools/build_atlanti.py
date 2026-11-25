#!/usr/bin/env python3
"""
build_atlanti.py — un atlante per citta', invece di uno solo con tutto dentro.

`build_assets.py` costruiva un atlante unico: andava bene con una mappa. Con
tre citta' — il borgo, la costa saracena, il fiordo — mettere tutto insieme
significa caricare i drakkar mentre si cammina nel deserto, e l'atlante dei
personaggi sfonda i 1024 px.

Ogni mappa prende quello che le serve, in `dist/<mappa>/`:

    atlas_world.png    props, edifici, veicoli di quella citta'
    atlas_terrain.png  i suoi terreni, quattro varianti per tipo
    atlas_chars.png    i suoi personaggi e i suoi animali
    manifest.json

Da dove vengono i pezzi, per mappa (vedi `mappe.json`):
  · `picks`     — scelte curate a mano. Il borgo le ha: sono le stesse di
                  build_assets.py, migrate al nuovo schema di id da
                  migra_picks.py. Portano anche l'altezza in unita' di mondo,
                  che qualcuno ha deciso guardando i montaggi.
  · `categorie` — selezione automatica dal catalogo: i pezzi piu' grandi di
                  ogni categoria, scartando quelli segnati come testo. E' una
                  prima passata per vedere la mappa in piedi, NON curatela.
                  L'altezza viene stimata dalla categoria (vedi ALTEZZE) e
                  corretta con la radice del rapporto con la mediana della
                  categoria, cosi' un edificio piu' alto degli altri resta
                  piu' alto senza diventare una torre.

Uso:
    python3 build_atlanti.py              # tutte
    python3 build_atlanti.py borgo        # una sola
"""
import hashlib
import json
import os
import statistics
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_assets  # noqa: E402
import build_mini    # noqa: E402
import percorsi      # noqa: E402
from percorsi import ROOT, risolvi, sorgente, tagli  # noqa: E402
PPU = build_assets.PPU

# Altezza tipica in unita' di mondo per categoria, per i pezzi scelti
# automaticamente. Un villano e' alto 2.05: la scala di riferimento e' quella.
ALTEZZE = {
    'edifici': 7.0, 'edifici_deserto': 6.5, 'edifici_nord': 6.5,
    'edifici_notte': 7.0, 'edifici_nord_notte': 6.5,
    'edifici_deserto_notte': 6.5, 'edifici_speciali': 7.5,
    'tetti': 4.5, 'castello_mura': 7.0, 'strutture_difese': 5.0,
    'taverne': 5.5, 'botteghe': 2.2, 'tendoni': 2.4, 'accampamenti': 3.0,
    'props': 1.4, 'props_deserto': 1.5, 'props_neve': 1.5,
    'props_marittimi': 1.4, 'decorazioni': 1.8, 'elementi_ambientali': 1.8,
    'dettagli_costieri': 1.0, 'vegetazione': 4.0, 'natura': 4.0,
    'natura_deserto': 3.5, 'natura_neve': 4.5, 'rocce_palme': 4.0,
    'porto': 3.0, 'acqua': 4.0, 'strade': 2.0,
    'barche': 2.6, 'velieri': 5.0, 'navi_nord': 4.5, 'navi_guerra': 6.0,
    'navi_speciali': 6.0, 'nave_piccola': 2.4, 'nave_media': 4.0,
    'nave_grande': 6.5, 'nave_confronto': 3.0, 'vele': 3.0, 'bandiere': 2.0,
    'accessori_nave': 1.2, 'alberi': 5.0, 'dettagli_navi': 1.4,
    'interni_navi': 4.0, 'interni': 3.0,
    'carri': 2.6, 'carrozze': 2.7, 'veicoli': 2.5, 'cavalli_carri': 2.4,
    'carovane': 2.6, 'icone': 1.0,
}


def carica(t):
    return Image.open(risolvi(t['file'])).convert('RGBA')


def scegli(catalogo, categoria, quanti):
    """I pezzi piu' grandi della categoria, saltando quelli segnati come testo."""
    items = [t for t in catalogo.get(categoria, []) if not t.get('sospetto')]
    items.sort(key=lambda t: -(t['w'] * t['h']))
    return items[:quanti]


def altezza(categoria, h, mediana):
    base = ALTEZZE.get(categoria, 2.0)
    if not mediana:
        return base
    k = (h / mediana) ** 0.5
    return max(0.45 * base, min(2.2 * base, base * k))


def eredita(wp, mappa, nomi):
    """Pezzi scelti il cui ritaglio non c'e' piu': si prendono, gia'
    normalizzati, dall'atlante di riferimento della mappa. Le tavole sono state
    riaffettate dopo la curatela — sheet_town.zip arriva al pannello 42, i
    picks citano fino al 48 — e senza questo sparivano in silenzio 46 pezzi
    del borgo, fra cui botti, casse, torri e tutte le icone della plancia."""
    d = os.path.join(percorsi.RIFERIMENTO, mappa)
    if not nomi or not os.path.isdir(d):
        return 0, nomi
    rects = json.load(open(os.path.join(d, 'manifest.json'),
                           encoding='utf8'))['world']['rects']
    atlas = Image.open(os.path.join(d, 'atlas_world.png')).convert('RGBA')
    presi = [n for n in nomi if n in rects]
    for n in presi:
        r = rects[n]
        meta = {k: v for k, v in r.items() if k not in ('x', 'y', 'w', 'h')}
        wp.add(n, atlas.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h'])),
               meta)
    return len(presi), [n for n in nomi if n not in rects]


def costruisci_mondo(cfg, catalogo, picks, mappa):
    wp = build_assets.Packer(2048)
    conteggio = {}

    def metti(nome, im, hu, kind='billboard'):
        im = build_assets.trim(im)
        if im.width < 2 or im.height < 2:
            return False
        if nome.startswith(build_assets.PREFISSI_EDIFICI):
            hu *= build_assets.SCALA_EDIFICI
        # Normalizzazione di risoluzione: un pezzo alto `hu` unita' non ha
        # motivo di occupare piu' di hu*PPU pixel nell'atlante, perche' tanto
        # a schermo viene disegnato a quella misura. I ritagli delle mega
        # tavole arrivano a 150 px per un edificio che ne vuole 104, e senza
        # questo l'atlante della costa usciva 2048x4096. Non si ingrandisce
        # mai: se il pezzo e' piu' piccolo del bersaglio resta com'e'.
        bersaglio = max(8, int(round(hu * PPU)))
        if im.height > bersaglio * 1.15:
            k = bersaglio / im.height
            im = im.resize((max(2, int(round(im.width * k))), bersaglio),
                           Image.LANCZOS)
        wp.add(nome, im, {'kind': kind, 'hu': round(hu, 2),
                          'wu': round(hu * im.width / im.height, 2)})
        return True

    if picks:
        n, orfani = 0, []
        for nome, v in picks['pezzi'].items():
            f = os.path.join(tagli(v['tavola']), 'png', v['id'] + '.png')
            if not os.path.exists(f):
                orfani.append(nome)
                continue
            n += metti(nome, Image.open(f).convert('RGBA'), v['hu'],
                       v.get('kind', 'billboard'))
        conteggio['curati'] = n
        conteggio['ereditati'], persi = eredita(wp, mappa, orfani)
        if persi:
            print(f'  ATTENZIONE {len(persi)} pezzi scelti senza ritaglio e '
                  f'senza riferimento: {", ".join(persi)}')

    for cat, quanti in (cfg.get('categorie') or {}).items():
        items = scegli(catalogo, cat, quanti)
        if not items:
            continue
        med = statistics.median([t['h'] for t in items])
        n = 0
        for i, t in enumerate(items):
            nome = f'{cat}_{i:02d}'
            kind = 'icon' if cat == 'icone' else 'billboard'
            n += metti(nome, carica(t), altezza(cat, t['h'], med), kind)
        conteggio[cat] = n

    # alberi Pixel Crawler: non vengono dai fogli, hanno una scala loro. Un
    # albero solo per voce, ritagliato dalla tavola (v. `_pixel_crawler` in
    # mappe.json): la tavola intera metteva sospesi gli alberi della fila alta
    for nome, v in (cfg.get('pixel_crawler') or {}).items():
        q = sorgente('pc', v['tavola'] + '.png')
        if os.path.exists(q):
            metti(nome, Image.open(q).convert('RGBA').crop(v['riquadro']),
                  v['hu'])

    # proiettili: disegnati, non ritagliati (nei fogli non c'e' niente di simile)
    for nome, (lung, a, b, c), hu in (
            ('freccia', (14, (92, 64, 38, 255), (198, 206, 214, 255),
                         (222, 214, 196, 255)), 0.22),
            ('quadrello', (10, (58, 52, 46, 255), (150, 158, 168, 255),
                           (120, 110, 96, 255)), 0.20)):
        im = Image.new('RGBA', (lung, 5), (0, 0, 0, 0))
        px = im.load()
        for x in range(lung):
            px[x, 2] = a
        for x in range(lung - 4, lung):
            px[x, 2] = b
        px[lung - 3, 1] = b
        px[lung - 3, 3] = b
        for y in (1, 3):
            px[0, y] = c
            px[1, y] = c
        metti(nome, im, hu)
    return wp, conteggio


def costruisci_terreno(cfg, catalogo, picks, variants=4):
    sorgenti = []
    if picks and picks.get('terreni'):
        for nome, v in picks['terreni'].items():
            f = os.path.join(tagli(v['tavola']), 'png', v['id'] + '.png')
            if os.path.exists(f):
                sorgenti.append((nome, Image.open(f).convert('RGBA')))
    t = cfg.get('terreni')
    if t:
        items = scegli(catalogo, t['categoria'], t['quanti'])
        for i, it in enumerate(items):
            sorgenti.append((f"{t['categoria']}_{i:02d}", carica(it)))
    if not sorgenti:
        return None, [], variants

    order, tiles = [], []
    for nome, im in sorgenti:
        order.append(nome)
        for v in range(variants):
            tiles.append(build_assets.make_tileable(im, 64, v))
    sheet = Image.new('RGB', (64 * variants, 64 * len(order)))
    for i, tile in enumerate(tiles):
        sheet.paste(tile, ((i % variants) * 64, (i // variants) * 64))
    return sheet, order, variants


def costruisci_personaggi(cfg):
    cp = build_assets.Packer(1024)
    escludi = cfg.get('personaggi', {}).get('escludi', [])
    defs, rates = {}, {}
    for d in cfg.get('personaggi', {}).get('pool', ['src/mini']):
        src = risolvi(d)
        man = ('_manifests.json' if os.path.exists(
            os.path.join(src, '_manifests.json')) else '_manifest.json')
        if not os.path.exists(os.path.join(src, man)):
            continue
        nomi = set(json.load(open(os.path.join(src, man))))
        nomi = {n for n in nomi if not any(e in n for e in escludi)}
        dd, rr = build_mini.build(src, cp, PPU, soltanto=nomi, manifest=man)
        defs.update(dd)
        rates.update(rr)
    return cp, defs, rates


def main():
    mappe = json.load(open(os.path.join(ROOT, 'tools', 'mappe.json')))
    catalogo = json.load(open(sorgente('catalogo', 'catalogo.json'),
                              encoding='utf8'))['categorie']
    quali = sys.argv[1:] or [k for k in mappe if not k.startswith('_')]

    for nome in quali:
        cfg = mappe[nome]
        picks = None
        if cfg.get('picks'):
            picks = json.load(open(sorgente('catalogo', cfg['picks']),
                                   encoding='utf8'))
        dest = os.path.join(percorsi.DIST, nome)
        os.makedirs(dest, exist_ok=True)

        wp, conteggio = costruisci_mondo(cfg, catalogo, picks, nome)
        wsheet, wrects = wp.render()
        wsheet.save(os.path.join(dest, 'atlas_world.png'))

        tsheet, torder, tvar = costruisci_terreno(cfg, catalogo, picks)
        if tsheet:
            tsheet.save(os.path.join(dest, 'atlas_terrain.png'))

        cp, cdefs, crates = costruisci_personaggi(cfg)
        csheet, crects = cp.render()
        csheet.save(os.path.join(dest, 'atlas_chars.png'))

        # impronta dei tre atlanti: finisce nel manifest e da li' nelle URL,
        # perche' un atlante e il suo manifest non si possono disaccoppiare
        h = hashlib.sha1()
        for f in ('atlas_world.png', 'atlas_chars.png', 'atlas_terrain.png'):
            q = os.path.join(dest, f)
            if os.path.exists(q):
                h.update(open(q, 'rb').read())
        manifest = {
            'mappa': nome, 'titolo': cfg.get('titolo', nome), 'ppu': PPU,
            'build': h.hexdigest()[:12],
            'chars': {'atlas': 'atlas_chars.png', 'size': list(csheet.size),
                      'rects': crects, 'defs': cdefs, 'frame_rates': crates},
            'world': {'atlas': 'atlas_world.png', 'size': list(wsheet.size),
                      'rects': wrects},
            'terrain': {'atlas': 'atlas_terrain.png', 'tile': 64,
                        'order': torder, 'variants': tvar},
        }
        json.dump(manifest, open(os.path.join(dest, 'manifest.json'), 'w'),
                  separators=(',', ':'))
        mb = sum(os.path.getsize(os.path.join(dest, f))
                 for f in os.listdir(dest)) / 1e6
        print(f'{nome:8} mondo {str(wsheet.size):12} {len(wrects):4} pezzi '
              f'({conteggio.get("ereditati", 0)} ereditati) · '
              f'terra {len(torder):2} tipi · '
              f'pg {str(csheet.size):12} {len(cdefs):3} soggetti '
              f'{len(crects):4} frame · {mb:.1f} MB')


if __name__ == '__main__':
    main()
