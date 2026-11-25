#!/usr/bin/env python3
"""
build_accessori.py — vichinghi, saraceni e pirati senza comprare pacchetti.

Le sei tavole di personaggi generate non sono sprite: analisi_sprite.py le misura
a 0.19-0.68 di deriva di palette fra frame consecutivi, contro 0.047 delle strip
vere del pool. Imitano lo stile, non lo sono.

Ma per far leggere una fazione non serve un corpo nuovo: serve un cappello. Il
pool ha 57 corpi gia' animati e coerenti; un elmo cornuto e' largo nove pixel.
Quindi si disegna l'accessorio una volta, in chiaro, qui sotto — e lo si incolla
su TUTTI i frame di TUTTE le animazioni di qualunque personaggio, agganciato
alla testa fotogramma per fotogramma.

La testa si trova da sola: e' la fascia di pixel piu' alta del corpo. Non serve
annotare niente a mano, e funziona anche quando il personaggio si china o cade.

Uso:
    python3 build_accessori.py MiniVillagerMan:elmo_cornuto MiniSwordMan:tricorno
    python3 build_accessori.py --tutti elmo_cornuto          (su un set sensato)
"""
import argparse
import json
import os

import numpy as np
from PIL import Image, ImageDraw

from percorsi import PROVINI, sorgente  # noqa: E402

MINI = sorgente('mini')
LAYERS = sorgente('layers')
OUT = sorgente('accessori')

# o = contorno scuro · M = metallo · C = corno/osso · T = stoffa · S = stoffa scura
# F = feltro (cappello) · P = piuma · J = gemma
TAV = {
    'o': (26, 20, 24), 'M': (150, 158, 172), 'm': (104, 112, 128),
    'C': (222, 208, 178), 'T': (214, 206, 188), 'S': (150, 140, 124),
    'F': (44, 40, 52), 'f': (72, 66, 84), 'P': (208, 72, 64),
    'J': (232, 176, 64), 'R': (168, 48, 48), 't': (96, 88, 110),
}

ACCESSORI = {
    # vichingo: calotta con due corna che si aprono
    'elmo_cornuto': dict(dy=-1, art=[
        'Co.......oC',
        'CC.ooooo.CC',
        '.C.oMMMo.C.',
        '..oMMMMMo..',
        '..oMmmmMo..',
    ]),
    # normanno: calotta con nasale, per le guardie del borgo
    'elmo_nasale': dict(dy=-1, art=[
        '..ooooo..',
        '.oMMMMMo.',
        'oMMMMMMMo',
        '.oMmMmMo.',
        '...oMo...',
    ]),
    # saraceno
    'turbante': dict(dy=-1, art=[
        '..ooooo..',
        '.oTTTTTo.',
        'oTTSTTTTo',
        'oTTTTSTTo',
        '.oTTTTTo.',
    ]),
    # pirata: tesa larga, ali rialzate, piuma
    'tricorno': dict(dy=2, art=[
        'oo.....oo',
        'offfffffo',
        'oFFFFFFFo',
        '.ooooooo.',
    ]),
    # capitano: tricorno con piuma e gallone
    'tricorno_piumato': dict(dy=2, art=[
        '.....oPo.',
        'oo..oPPo.',
        'offffffPo',
        'oFFJFFFFo',
        '.ooooooo.',
    ]),
    # fuorilegge del bosco
    'cappuccio': dict(dy=0, art=[
        '..ooooo..',
        '.oSSSSSo.',
        'oSSSSSSSo',
        'oSSSSSSSo',
        '.oSSSSSo.',
        '..ooSSSo.',
    ]),
    # fascia da corsaro
    'bandana': dict(dy=1, art=[
        '..ooooo..',
        '.oRRRRRo.',
        'oRRRRRRRo',
        '.oRo..oRo',
        '......oRo',
    ]),
}


def disegna(nome):
    a = ACCESSORI[nome]['art']
    h, w = len(a), max(len(r) for r in a)
    im = np.zeros((h, w, 4), np.uint8)
    for y, riga in enumerate(a):
        for x, ch in enumerate(riga):
            if ch == '.' or ch == ' ':
                continue
            im[y, x, :3] = TAV[ch]
            im[y, x, 3] = 255
    return Image.fromarray(im)


def testa(frame, min_largh=4):
    """
    Centro e sommita' della testa.

    Primo tentativo: il pixel piu' in alto del frame. Sbagliato, e si vede
    subito guardando il provino — sullo spadaccino l'elmo finisce in cima alla
    spada alzata, sul contadino in cima al forcone. Quello che distingue una
    testa da un'arma non e' l'altezza, e' la larghezza: una lama e' larga uno o
    due pixel, un cranio almeno quattro. Quindi si scende dall'alto fino alla
    prima riga che ha una corsa piena larga almeno `min_largh`, e la si prende.
    """
    m = np.asarray(frame)[..., 3] > 40
    ys, xs = np.where(m)
    if len(ys) == 0:
        return None
    # La larghezza da sola non basta: una lama alzata di taglio e' larga
    # quanto un cranio. Ma il corpo sta al centro e l'arma sporge di lato,
    # quindi si accetta solo la corsa che passa per la mediana orizzontale
    # del soggetto — mediana e non media, perche' un'alabarda lunga
    # sposterebbe la media e non sposta la mediana.
    cx = int(np.median(xs))
    for y in range(m.shape[0]):
        riga = m[y]
        if not riga.any():
            continue
        idx = np.flatnonzero(riga)
        for sp in np.split(idx, np.flatnonzero(np.diff(idx) > 1) + 1):
            if len(sp) >= min_largh and sp[0] - 2 <= cx <= sp[-1] + 2:
                return int(round(sp.mean())), int(y)
    return cx, int(ys.min())


def applica(nome_pg, nome_acc, man, dy_extra=0):
    src = os.path.join(MINI, nome_pg + '.png')
    if not os.path.exists(src):
        return None
    m = man[nome_pg]
    fw, fh = m['frame_width'], m['frame_height']
    strip = Image.open(src).convert('RGBA')
    n = strip.width // fw

    # Per trovare la testa conviene guardare il layer `main`, cioe' il corpo
    # senza mani ne' arma: sullo spadaccino fermo la lama sta dritta davanti
    # alla faccia, larga quanto un cranio e centrata quanto un cranio, e
    # nessuna euristica sulla silhouette composta la distingue. Se il layer
    # non c'e' si ripiega sullo sprite intero, che sbaglia solo sui pochi
    # personaggi che tengono l'arma verticale davanti a se'.
    corpo_p = os.path.join(LAYERS, nome_pg + '__main.png')
    corpo = Image.open(corpo_p).convert('RGBA') if os.path.exists(corpo_p) else strip
    acc = disegna(nome_acc)
    dy = ACCESSORI[nome_acc].get('dy', 0) + dy_extra

    fuori = Image.new('RGBA', strip.size, (0, 0, 0, 0))
    messi = 0
    for i in range(n):
        f = strip.crop((i * fw, 0, (i + 1) * fw, fh))
        fuori.alpha_composite(f, (i * fw, 0))
        rif = corpo.crop((i * fw, 0, (i + 1) * fw, fh)) if (i + 1) * fw <= corpo.width else f
        t = testa(rif)
        if t is None:
            continue
        cx, ty = t
        px = i * fw + cx - acc.width // 2
        py = ty - acc.height + 2 + dy
        if py < 0:
            py = 0
        fuori.alpha_composite(acc, (px, py))
        messi += 1

    dest = f'{nome_pg}@{nome_acc}'
    os.makedirs(OUT, exist_ok=True)
    fuori.save(os.path.join(OUT, dest + '.png'))
    voce = {k: v for k, v in m.items() if k != 'source_file'}
    voce['source_file'] = f'{nome_pg} + accessorio {nome_acc}'
    return dest, voce, messi, n


def provino(fatti, dest, man, S=5, quanti=10):
    righe = []
    for nome in fatti:
        im = Image.open(os.path.join(OUT, nome + '.png')).convert('RGBA')
        fw = man[nome]['frame_width']
        fh = man[nome]['frame_height']
        righe.append((nome, im.crop((0, 0, fw * quanti, fh))))
    W = max(r[1].width for r in righe) * S + 230
    H = sum(r[1].height for r in righe) * S + len(righe) * 10 + 16
    o = Image.new('RGB', (W, H), (26, 28, 36))
    d = ImageDraw.Draw(o)
    y = 8
    for nome, im in righe:
        im2 = im.resize((im.width * S, im.height * S), Image.NEAREST)
        o.paste(im2, (225, y), im2)
        d.text((6, y + im2.height // 2 - 6), nome, fill=(255, 220, 150))
        y += im2.height + 10
    o.save(dest)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('coppie', nargs='*', help='Personaggio:accessorio')
    ap.add_argument('--elenco', action='store_true')
    a = ap.parse_args()
    if a.elenco:
        for k in ACCESSORI:
            print(k)
        return

    man = json.load(open(os.path.join(MINI, '_manifests.json')))
    # le varianti stanno in _src/accessori con un manifest loro: registrarle in
    # quello del pool significherebbe dichiarare PNG che in _src/mini non ci sono
    manp = os.path.join(OUT, '_manifest.json')
    os.makedirs(OUT, exist_ok=True)
    if os.path.exists(manp):
        man.update(json.load(open(manp)))
    fatti = []
    for c in a.coppie:
        pg, acc = c.split(':')
        r = applica(pg, acc, man)
        if r is None:
            print(f'  {pg}: non trovato in _src/mini')
            continue
        nome, voce, messi, n = r
        man[nome] = voce
        fatti.append(nome)
        print(f'{nome:34} {messi}/{n} frame con accessorio')
    json.dump({k: v for k, v in man.items() if '@' in k},
              open(manp, 'w'), indent=1)
    if fatti:
        provino(fatti, os.path.join(PROVINI, 'provino_accessori.png'), man)


if __name__ == '__main__':
    main()
