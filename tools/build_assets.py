#!/usr/bin/env python3
"""
build_assets.py — costruisce l'atlas e il manifest del gioco.

Sorgenti:
  · out/town, out/world  — ritagli dai concept sheet ChatGPT (mondo, veicoli, UI)
  · src/pc               — Pixel Crawler: corpo animato 4 direzioni, alberi, fuoco

Produce in dist/:
  atlas_world.png   props, edifici, veicoli, terreno, icone
  atlas_chars.png   personaggi vestiti, tutte le animazioni e direzioni
  manifest.json     rettangoli, ancore, scale e definizioni di animazione
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_mini  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PPU = 16.0          # pixel sorgente per unita' di mondo

# Un villano e' alto 2.05 unita'. Una casa a graticcio di due-tre piani sta
# fra i 7 e i 10 metri, cioe' 4-5 volte una persona: le altezze scelte a
# occhio sui ritagli stavano sotto, e il borgo sembrava un modellino. Questo
# fattore si applica solo a cio' che e' architettura.
SCALA_EDIFICI = 1.35
PREFISSI_EDIFICI = ('edificio_', 'casa_', 'palazzo_', 'castello_', 'torre',
                    'mura_', 'porta_citta', 'municipio', 'fienile', 'tetto_')

# ---------------------------------------------------------------- curatela
# id dei ritagli scelti a mano guardando i montaggi di revisione.
PICK_TOWN = {
    # il ritaglio 22 aveva l'etichetta "(base)" del foglio cotta sopra il
    # tetto: il testo toccava le tegole e la dilatazione li ha fusi in un
    # unico blob, cosi' il filtro anti-etichetta non poteva vederlo. Uso il 35.
    'edificio_casa':    (35, 6.0), 'edificio_bottega': (33, 5.8),
    'edificio_stalla':  (34, 5.6), 'edificio_chiesa':  (104, 7.4),
    'edificio_taverna': (108, 6.4), 'castello_mastio': (109, 7.0),
    'torre':            (110, 6.6),
    'tetto_rosso': (42, 3.6), 'tetto_arancio': (37, 3.8), 'tetto_verde': (38, 3.6),
    'tetto_blu': (82, 3.6), 'tetto_bruno': (80, 3.6),
    'mura_lunghe': (186, 6.0), 'mura_torre': (205, 5.6), 'mura_cinta': (235, 6.4),
    'nave_grande': (181, 6.4), 'molo_a': (193, 5.0), 'molo_b': (194, 4.8),
    'barca_a': (228, 2.4), 'barca_b': (231, 2.2), 'chiatta': (257, 2.6),
    'botte': (43, 1.0), 'botte_b': (47, 1.0), 'barile': (44, 1.0),
    'cassa': (39, 1.1), 'cassa_b': (40, 1.0), 'tavolo': (41, 1.2),
    'tavolo_b': (67, 1.2), 'secchio': (69, 0.9), 'tino': (71, 0.9),
    'banco_mercato': (86, 1.8), 'mangiatoia': (93, 1.2), 'fuoco_cesto': (85, 1.2),
    'bancarella_frutta': (90, 1.6), 'bancarella_stoffa': (91, 1.6),
    'croce_legno': (116, 1.8), 'telaio': (118, 1.6), 'rastrelliera': (119, 1.4),
    'fiori_cassa': (138, 1.4), 'fiori_rossi': (139, 1.3), 'siepe_fiorita': (140, 1.3),
    'staccionata': (137, 1.5), 'staccionata_lunga': (141, 2.4),
    'stendardo_bianco': (195, 1.9), 'stendardo_azzurro': (196, 1.8),
    'stendardo_rosso': (197, 1.8), 'stendardo_croce': (198, 1.9),
    'stendardo_regio': (199, 2.0), 'insegna': (200, 2.0), 'panca': (201, 1.2),
    'gonfalone_rosso': (212, 2.3), 'gonfalone_blu': (213, 2.3),
    'tenda_mercato': (220, 2.2), 'tenda_carne': (221, 2.1), 'tenda_rossa': (211, 2.4),
    'palo_insegna': (240, 2.1), 'vessillo_verde': (241, 2.1),
    'stendardo_lungo': (242, 2.0), 'baldacchino': (243, 2.0),
    'statua': (192, 2.2), 'pozzo': (206, 1.9), 'fontana': (207, 1.9),
    'torcia': (202, 1.7), 'gogna': (208, 1.7), 'ceppi': (203, 1.4),
    'muretto': (209, 1.4), 'portale': (218, 2.3), 'panchina': (226, 1.6),
    'lanterna_palo': (227, 2.0), 'lampione': (210, 1.6), 'braciere': (239, 2.1),
    'recinto': (237, 1.7), 'tino_grande': (238, 1.7), 'crocifisso': (236, 2.0),
    'banco_legno': (248, 1.5), 'catasta': (246, 1.4), 'palo': (247, 1.7),
    'tavolaccio': (268, 1.7), 'carretto_fermo': (261, 2.2), 'falo': (258, 1.6),
    'albero_a': (187, 4.6), 'albero_b': (188, 4.8), 'albero_c': (189, 4.4),
    'albero_d': (190, 4.4), 'albero_e': (191, 4.2), 'albero_f': (224, 5.0),
    'albero_g': (229, 4.4), 'cespuglio_a': (219, 1.5), 'cespuglio_b': (225, 1.4),
    'melo': (223, 4.6), 'cespuglio_c': (234, 1.4), 'cespuglio_d': (255, 1.8),
    'cespuglio_e': (251, 1.7), 'cespuglio_f': (252, 1.5), 'cespuglio_g': (253, 1.6),
    'fiori_a': (265, 1.2), 'fiori_b': (274, 1.1), 'fiori_c': (271, 1.2),
    'erba_a': (280, 0.9), 'erba_b': (279, 0.9), 'arbusto': (232, 1.5),
    'cavallo_baio': (616, 2.3), 'cavallo_sauro': (618, 2.2),
    'cavallo_bianco': (614, 2.3), 'cavallo_morello': (619, 2.1),
    'cavallo_pezzato': (643, 2.4), 'cavallo_grigio': (644, 2.3),
    'carro_telone': (603, 2.6), 'carro_merci': (600, 2.5), 'carro_fieno': (601, 2.8),
    'carro_legno': (598, 2.6), 'carro_basso': (639, 2.4), 'carro_botti': (640, 2.3),
    'carrozza_rossa': (620, 2.6), 'carrozza_oro': (621, 2.8),
    'carrozza_rosa': (617, 2.7), 'carro_bue': (623, 2.7), 'carro_bue_b': (624, 2.6),
    'carro_regio': (652, 2.5), 'carro_circo': (653, 2.5), 'carro_grano': (649, 2.7),
    # Gli animali dei fogli ChatGPT sono immagini ferme: un mondo con mucche
    # statue accanto a cervi che scappano non regge. La fauna viene tutta dal
    # pool Mini, animata. Il pool pero' non ha bestiame: niente mucche,
    # pecore, maiali o galline, e le stalle restano vuote.
}

PICK_WORLD = {
    'palazzo_gotico': (157, 8.4), 'palazzo_torre': (156, 8.4),
    'casa_alta': (165, 7.4), 'casa_alta_b': (169, 7.4), 'fienile': (164, 7.0),
    'palazzo_lungo': (236, 7.2), 'municipio': (227, 7.4), 'torre_guardia': (237, 7.2),
    'palazzo_blu': (238, 7.0), 'porta_citta': (239, 7.2),
    'casa_tetto_rosso': (246, 8.0), 'casa_stretta': (259, 7.6),
    'casa_blu': (255, 7.6), 'casa_rossa': (254, 7.4),
    'tetto_grande_rosso': (158, 5.4), 'tetto_grande_arancio': (162, 5.2),
    'tetto_grande_blu': (163, 5.2), 'tetto_falda': (161, 5.0),
    'bancarella_blu': (283, 2.3), 'bancarella_verde': (284, 2.3),
    'bancarella_rossa': (281, 2.3), 'bancarella_righe': (282, 2.2),
    'bancarella_grande': (285, 2.1), 'tenda_blu': (304, 2.2), 'tenda_crema': (307, 2.2),
    'carriola': (308, 1.6), 'tavolo_erbe': (305, 1.8), 'transenna': (311, 1.4),
    'quercia': (29, 6.4), 'quercia_b': (30, 5.4), 'quercia_c': (31, 5.2),
    'pino': (62, 4.6), 'pino_b': (63, 4.4), 'frassino': (61, 5.2),
    'siepe_alta': (82, 2.2), 'abete': (79, 4.4), 'rovi': (92, 2.4),
    'boschetto': (99, 3.6), 'ceppaia': (106, 1.4), 'tronchi': (117, 1.6),
    'massi': (110, 2.2),
    'scaffale': (193, 2.6), 'panca_lunga': (196, 1.5), 'scala': (199, 2.2),
    'lampione_alto': (224, 2.6), 'palo_totem': (221, 2.7), 'banco_frutta': (245, 2.0),
    'fontana_grande': (252, 2.8), 'pergolato': (251, 2.5), 'cartello': (250, 2.9),
    'vessillo_a': (263, 1.9), 'vessillo_b': (264, 1.9), 'vessillo_c': (262, 1.9),
    'abbeveratoio': (265, 1.7), 'stendardo_alto': (275, 2.0), 'gabbia': (269, 2.0),
    'anfora': (277, 1.5), 'cippo': (274, 2.0), 'statua_grande': (292, 3.2),
    'scaffale_alto': (294, 3.0), 'vaso_fiori': (295, 2.4), 'statua_santo': (298, 2.6),
    'pozzo_grande': (301, 2.6), 'altare': (302, 2.4),
}

ICONS = {
    'icona_corona': 503, 'icona_scudo_verde': 507, 'icona_scudo_bianco': 495,
    'icona_stemma': 496, 'icona_gemma': 497, 'icona_cuore': 498,
    'icona_scudo_rosso': 535, 'icona_scudo_blu': 536, 'icona_ampolla': 537,
    'icona_fiala': 538, 'icona_spade': 539, 'icona_stella_piena': 542,
    'icona_stella_vuota': 540, 'icona_pergamena': 552, 'icona_bomba': 553,
    'icona_mappa': 555, 'icona_chiave': 551, 'icona_borsa': 583,
    'icona_pozione': 584, 'icona_sacchetto': 586, 'icona_sacco': 587,
}

TERRENI = {'erba': 48, 'terra': 49, 'fango': 50, 'sabbia': 51, 'ghiaia': 52,
           'pietra': 101, 'acqua': 102, 'acqua_cupa': 105, 'neve': 103,
           'roccia': 106}


# ---------------------------------------------------------------- utilita'

def load_slice(root, cat_or_index, sid):
    idx = json.load(open(os.path.join(root, 'index.json')))
    for s in idx['slices']:
        if s['id'] == sid:
            return Image.open(os.path.join(root, s['file'])).convert('RGBA')
    return None


def trim(im):
    a = np.asarray(im)
    ys, xs = np.where(a[:, :, 3] > 0)
    if ys.size == 0:
        return im
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def make_tileable(im, size=64, variant=0):
    """
    I tile del foglio non devono essere perfettamente ripetibili: il motore
    li disegna con rotazioni casuali e li mescola ai vicini. Devono pero'
    avere bordi NEUTRI, perche' il bordo scuro ereditato dal fondo del foglio
    e' cio' che disegnava la griglia nera sul terreno.

    Quindi: mordo il bordo, ruoto/specchio per generare varianti diverse, e
    sfumo gli ultimi pixel verso il colore medio del tile. Lo specchio a
    quattro quadranti (provato prima) rende il tile ripetibile ma introduce
    una simmetria da caleidoscopio ben peggiore della cucitura.
    """
    im = trim(im)
    b = max(1, int(min(im.size) * 0.17))
    im = im.crop((b, b, im.width - b, im.height - b))
    if variant & 1:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    if variant & 2:
        im = im.transpose(Image.FLIP_TOP_BOTTOM)
    if variant >= 4:
        im = im.transpose(Image.ROTATE_90)
    im = im.convert('RGB').resize((size, size), Image.LANCZOS)

    a = np.asarray(im).astype(np.float32)
    mean = a.reshape(-1, 3).mean(axis=0)
    # rampa: 1 al centro, 0 sul bordo estremo
    e = max(2, size // 12)
    ramp = np.ones(size, np.float32)
    ramp[:e] = np.linspace(0.45, 1, e)
    ramp[-e:] = np.linspace(1, 0.45, e)
    k = np.minimum(ramp[None, :], ramp[:, None])[..., None]
    a = a * k + mean * (1 - k)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGB')


class Packer:
    """Bin packing a scaffali: sufficiente, gli sprite hanno altezze simili."""

    def __init__(self, width):
        self.w = width
        self.shelves = []   # [y, height, x_cursor]
        self.h = 0
        self.items = []

    def add(self, name, im, meta=None):
        w, h = im.size
        for sh in self.shelves:
            if sh[1] >= h and self.w - sh[2] >= w + 1:
                x, y = sh[2], sh[0]
                sh[2] += w + 1
                break
        else:
            y = self.h
            self.shelves.append([y, h + 1, w + 1])
            self.h += h + 1
            x = 0
        self.items.append((name, im, x, y, meta or {}))
        return x, y

    def render(self):
        H = 1
        while H < self.h:
            H *= 2
        sheet = Image.new('RGBA', (self.w, H), (0, 0, 0, 0))
        rects = {}
        for name, im, x, y, meta in self.items:
            sheet.alpha_composite(im, (x, y))
            r = {'x': x, 'y': y, 'w': im.width, 'h': im.height}
            r.update(meta)
            rects[name] = r
        return sheet, rects


# ---------------------------------------------------------------- build

def build_world(packer):
    rects_meta = {}

    def put(name, im, height_units, kind='billboard'):
        im = trim(im)
        if im.width < 2 or im.height < 2:
            return
        if name.startswith(PREFISSI_EDIFICI):
            height_units *= SCALA_EDIFICI
        packer.add(name, im, {'kind': kind,
                              'hu': round(height_units, 2),
                              'wu': round(height_units * im.width / im.height, 2)})

    for name, (sid, hu) in PICK_TOWN.items():
        im = load_slice(os.path.join(ROOT, 'out/town'), None, sid)
        if im:
            put(name, im, hu)
    for name, (sid, hu) in PICK_WORLD.items():
        im = load_slice(os.path.join(ROOT, 'out/world'), None, sid)
        if im:
            put(name, im, hu)
    for name, sid in ICONS.items():
        im = load_slice(os.path.join(ROOT, 'out/world'), None, sid)
        if im:
            put(name, im, 1.0, kind='icon')

    # Proiettili: nei fogli non c'e' niente di simile e servono due sprite
    # minuscoli, quindi si disegnano qui invece di cercarli.
    def dardo(lung, col_asta, col_punta, col_coda):
        im = Image.new('RGBA', (lung, 5), (0, 0, 0, 0))
        px = im.load()
        for x in range(lung):
            px[x, 2] = col_asta
        for x in range(lung - 4, lung):
            px[x, 2] = col_punta
        px[lung - 3, 1] = col_punta
        px[lung - 3, 3] = col_punta
        for y in (1, 3):
            px[0, y] = col_coda
            px[1, y] = col_coda
        return im

    put('freccia', dardo(14, (92, 64, 38, 255), (198, 206, 214, 255),
                         (222, 214, 196, 255)), 0.22)
    put('quadrello', dardo(10, (58, 52, 46, 255), (150, 158, 168, 255),
                           (120, 110, 96, 255)), 0.20)

    # alberi Pixel Crawler: disegnati a scala molto maggiore, hu dedicato
    for f, name, hu in (('tree_01', 'quercia_pc', 9.0), ('tree_02', 'faggio_pc', 7.0),
                        ('tree_03', 'pioppo_pc', 10.0), ('tree_04', 'arbusto_pc', 3.0)):
        p = os.path.join(ROOT, 'src/pc', f + '.png')
        if os.path.exists(p):
            put(name, Image.open(p).convert('RGBA'), hu)
    return rects_meta


def build_terrain(variants=4):
    """Quattro varianti per terreno: il motore ne sceglie una per cella e la
    ripetizione smette di leggersi come una griglia."""
    order, tiles = [], []
    for name, sid in TERRENI.items():
        im = load_slice(os.path.join(ROOT, 'out/town'), None, sid)
        if not im:
            continue
        order.append(name)
        for v in range(variants):
            tiles.append(make_tileable(im, 64, v))
    sheet = Image.new('RGB', (64 * variants, 64 * len(order)))
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % variants) * 64, (i // variants) * 64))
    return sheet, order, variants


def main():
    os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)

    cp = Packer(1024)
    char_defs, frame_rates = build_mini.build(
        os.path.join(ROOT, 'src/mini'), cp, PPU)
    csheet, crects = cp.render()
    csheet.save(os.path.join(ROOT, 'dist/atlas_chars.png'))

    wp = Packer(2048)
    build_world(wp)
    wsheet, wrects = wp.render()
    wsheet.save(os.path.join(ROOT, 'dist/atlas_world.png'))

    tsheet, torder, tvar = build_terrain()
    tsheet.save(os.path.join(ROOT, 'dist/atlas_terrain.png'))

    manifest = {
        'ppu': PPU,
        'chars': {'atlas': 'atlas_chars.png', 'size': list(csheet.size),
                  'rects': crects, 'defs': char_defs,
                  'frame_rates': frame_rates},
        'world': {'atlas': 'atlas_world.png', 'size': list(wsheet.size),
                  'rects': wrects},
        'terrain': {'atlas': 'atlas_terrain.png', 'tile': 64,
                    'order': torder, 'variants': tvar},
    }
    with open(os.path.join(ROOT, 'dist/manifest.json'), 'w') as f:
        json.dump(manifest, f, separators=(',', ':'))

    print(f'chars  {csheet.size}  {len(crects)} frame, '
          f'{len(char_defs)} personaggi')
    print(f'world  {wsheet.size}  {len(wrects)} pezzi')
    print(f'terra  {tsheet.size}  {len(torder)} tile: {", ".join(torder)}')


if __name__ == '__main__':
    main()
