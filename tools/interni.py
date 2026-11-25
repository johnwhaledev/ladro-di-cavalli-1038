#!/usr/bin/env python3
"""
interni.py — le tile delle stanze (src/stanze/*.json) portate nell'atlante.

Le stanze si scrivono a mano in json, una per tipologia (taverna, fucina, ...),
e nominano le tile del foglio RPG di Kenney (CC0) come "rpg:RR_CC" (riga e
colonna della griglia, v. out/kenney_rpg_griglia.png). Qui si raccolgono tutte
quelle citate e si danno a innesta_nano.py, che le innesta per nome come i
pezzi disegnati: "rpg:02_08" diventa "k_rpg_02_08" nell'atlante del mondo.

La grana c'e' gia': una tile e' 16 px, e a 6,83 px per unita' (PPU_UMANO) una
cella di stanza misura 2,34 unita', quanto basta a un tavolo o a una sedia
accanto a un personaggio alto 13 px. Pavimento e pareti restano tile intere;
gli arredi si ritagliano sul pieno (poggiano sul fondo del ritaglio) e prendono
il contorno esterno dei pezzi disegnati, come i Mini.

Da solo scrive un provino: python tools/interni.py -> out/provino_interni.png
"""
import glob
import json
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import disegna_pezzi  # noqa: E402
from percorsi import PROVINI, ROOT, sorgente  # noqa: E402

FOGLI = {'rpg': 'rl_roguelikeSheet_transparent.png'}
TILE, PASSO = 16, 17
DENSITA = disegna_pezzi.DENSITA
STANZE = os.path.join(ROOT, 'src', 'stanze')


def nome_atlante(rif):
    """'rpg:02_08' -> 'k_rpg_02_08' (lo stesso calcolo sta in interni.js)."""
    foglio, cella = rif.split(':')
    return f'k_{foglio}_{cella}'


_aperti = {}                   # fogli gia' letti


def tile(rif):
    foglio, cella = rif.split(':')
    if foglio not in _aperti:
        _aperti[foglio] = Image.open(sorgente('kenney_prova', FOGLI[foglio])).convert('RGBA')
    r, c = (int(n) for n in cella.split('_'))
    x, y = c * PASSO, r * PASSO
    return _aperti[foglio].crop((x, y, x + TILE, y + TILE))


def arredo(im):
    """Ritaglio sul pieno e contorno esterno, con il margine che gli serve."""
    box = im.getbbox()
    pieno = im.crop(box)
    tela = Image.new('RGBA', (pieno.width + 2, pieno.height + 2), (0, 0, 0, 0))
    tela.alpha_composite(pieno, (1, 1))
    return disegna_pezzi.contorna(tela)


def parete(righe):
    """Le tile della parete impilate dall'alto in basso: una colonna sola.
    Ogni tile conta per le righe che ha piene: il telo a righe della tenda
    (rpg:00_11) e' alto 10 px, e intero lasciava un buco fra una fascia e
    l'altra. Le pareti di pietra e di legno sono piene e non cambiano."""
    ims = []
    for r in righe:
        im = tile(r)
        _, y0, _, y1 = im.getbbox()
        ims.append(im.crop((0, y0, TILE, y1)))
    col = Image.new('RGBA', (TILE, sum(im.height for im in ims)), (0, 0, 0, 0))
    y = 0
    for im in ims:
        col.alpha_composite(im, (0, y))
        y += im.height
    return col


def stanze(mappa=None):
    """Le stanze di una citta': quelle di src/stanze/<mappa>/ (il fiordo,
    25/09 notte) al posto di quelle di Valdarno con la stessa tipologia, e le
    altre di Valdarno. In piu', in ogni citta', la stiva e il ponte della nave
    pirata (src/stanze/nave/, atto III): interni.js le carica dappertutto."""
    per_tipo = {}
    for f in sorted(glob.glob(os.path.join(STANZE, '*.json'))):
        s = json.load(open(f, encoding='utf8'))
        per_tipo[s['tipologia']] = s
    for cartella in ([mappa] if mappa else []) + ['nave']:
        for f in sorted(glob.glob(os.path.join(STANZE, cartella, '*.json'))):
            s = json.load(open(f, encoding='utf8'))
            per_tipo[s['tipologia']] = s
    return list(per_tipo.values())


def pezzi(mappa=None):
    """[(nomi, immagine, altezza in unita')], come disegna_pezzi.pezzi()."""
    out, visti = [], set()

    def aggiungi(nome, im):
        if nome not in visti:
            visti.add(nome)
            out.append(([nome], im, round(im.height / DENSITA, 2)))

    for s in stanze(mappa):
        for rif in s['pavimento'] + [s['bordo']] + tappeto(s):
            aggiungi(nome_atlante(rif), tile(rif))
        aggiungi(f"k_parete_{s['tipologia']}", parete(s['parete']))
        for a in s['arredo']:
            if 'tile' in a:                    # con "pezzo" e' uno sprite del mondo
                aggiungi(nome_atlante(a['tile']), arredo(tile(a['tile'])))
    return out


def tappeto(s):
    """I nove pezzi del tappeto (angoli, bordi, centro) a partire dalla base,
    l'angolo in alto a sinistra: interni.js sceglie il pezzo per cella."""
    t = s.get('tappeto')
    if not t:
        return []
    foglio, cella = t['base'].split(':')
    r, c = (int(n) for n in cella.split('_'))
    return [f'{foglio}:{r + dr:02d}_{c + dc:02d}' for dr in range(3) for dc in range(3)]


if __name__ == '__main__':
    tutti = pezzi()
    S = 5
    W = sum(im.width * S + 12 for _, im, _ in tutti) + 12
    H = max(im.height for _, im, _ in tutti) * S + 30
    tela = Image.new('RGBA', (W, H), (110, 100, 84, 255))
    d = ImageDraw.Draw(tela)
    x = 6
    for nomi, im, _ in tutti:
        big = im.resize((im.width * S, im.height * S), Image.NEAREST)
        tela.alpha_composite(big, (x, H - 22 - big.height))
        d.text((x, H - 16), nomi[0][2:], fill='white')
        x += big.width + 12
    tela.save(os.path.join(PROVINI, 'provino_interni.png'))
    print(f'{len(tutti)} pezzi -> out/provino_interni.png')
