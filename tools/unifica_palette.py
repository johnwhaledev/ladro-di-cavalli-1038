#!/usr/bin/env python3
"""
unifica_palette.py — riduce la palette di uno sprite al registro del gioco.

PERCHE'. Il progetto pesca da quattro fonti (pool Mini, Mana Seed, tavole
generate, Kenney) e ognuna ha la sua densita' di colore. Misurata come colori
distinti per blocco 16x16: personaggio Mini 8, terreno Mana Seed 9, edificio
generato ~21 (174 a risoluzione nativa), edificio delle vecchie tavole 65.
E' quel salto che si legge a schermo come "pot-pourri".

DUE COSE PROVATE, UNA SOLA FUNZIONA.

  1. Palette maestra globale (--globale): una palette unica costruita dai
     personaggi + dal terreno, e tutto il resto quantizzato sopra. FALLITA.
     Una palette dominata dai pixel dei personaggi non contiene i marroni di
     un edificio: la casa e' uscita coi muri bianchi e il tetto a pois. La
     cura era sbagliata perche' la malattia non e' il disaccordo di tinta, e'
     la DENSITA' di dettaglio. Lasciata nel file come monito, non usarla.

  2. Riduzione per-sprite (riduci, default): taglio mediano a N colori sul
     singolo sprite, SENZA dithering (il dithering inventa texture che la
     pixel art non ha), piu' un contorno normalizzato al colore piu' scuro
     cosi' tutti gli sprite hanno lo stesso peso di linea. Ogni sprite tiene
     le sue tinte, perde solo le sfumature.

LIMITE MISURATO, da tenere presente. Alla scala a cui la casa viene davvero
disegnata (64 px di altezza) la differenza fra originale, n=20, n=14 e n=10 e'
quasi invisibile: il ridimensionamento butta via il dettaglio da solo. Lo
strumento serve agli asset disegnati grandi e alle tavole vecchie a 65
col/blocco; non e' lui a chiudere il divario di registro. Quello si chiude
generando gli asset alla risoluzione a cui si vedono.

TARATURA. Sul dettaglio a risoluzione nativa: n=20 e' indistinguibile
dall'originale, n=14 e' pulito e piu' asciutto, n=10 comincia a spezzare il
motivo dei mattoni. Default 14.

Uso:
    python3 unifica_palette.py in.png out.png [-n 14]
    python3 unifica_palette.py --misura file...
    python3 unifica_palette.py --crea      # palette maestra, via sconsigliata
"""

import argparse
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PALETTE = os.path.join(ROOT, 'out', 'palette_maestra.png')

# Le fonti che dettano il registro. I personaggi per primi: sono l'unica cosa
# che non possiamo ridisegnare, quindi sono loro il metro.
RIFERIMENTI = [
    ('dist/borgo/atlas_chars.png', 3),     # peso 3: comandano
    ('src/roguelike/../manaseed/gentle_forest_v01.png', 2),
]


def pixel_di(path, peso):
    if not os.path.exists(path):
        return None
    a = np.asarray(Image.open(path).convert('RGBA'))
    m = a[..., 3] > 128
    px = a[..., :3][m]
    return np.repeat(px, peso, axis=0) if len(px) else None


def crea(colori=48, sorgenti=None):
    campioni = []
    for path, peso in (sorgenti or RIFERIMENTI):
        p = os.path.join(ROOT, path)
        px = pixel_di(p, peso)
        if px is None:
            print(f'  manca {path}')
            continue
        # campiono per non far esplodere la quantizzazione
        if len(px) > 400_000:
            idx = np.random.RandomState(0).choice(len(px), 400_000, replace=False)
            px = px[idx]
        campioni.append(px)
        print(f'  {os.path.basename(path)}: {len(px)} pixel (peso {peso})')
    if not campioni:
        raise SystemExit('nessuna fonte di riferimento')
    tutti = np.concatenate(campioni)
    lato = int(np.ceil(np.sqrt(len(tutti))))
    quad = np.zeros((lato * lato, 3), np.uint8)
    quad[:len(tutti)] = tutti
    im = Image.fromarray(quad.reshape(lato, lato, 3), 'RGB')
    q = im.quantize(colors=colori, method=Image.MEDIANCUT, dither=Image.Dither.NONE)
    pal = np.array(q.getpalette()[:colori * 3], np.uint8).reshape(-1, 3)
    os.makedirs(os.path.dirname(PALETTE), exist_ok=True)
    Image.fromarray(pal.reshape(1, -1, 3), 'RGB').save(PALETTE)
    print(f'palette maestra: {colori} colori → {PALETTE}')
    return pal


def carica_palette():
    if not os.path.exists(PALETTE):
        return crea()
    return np.asarray(Image.open(PALETTE).convert('RGB')).reshape(-1, 3)


def riduci(path, n=14, contorno=True, pal_contorno=None):
    """
    Quantizzazione PER SPRITE, non su una palette globale.

    Il primo tentativo costruiva una palette maestra di 48 colori dalle fonti
    di riferimento e ci mappava sopra tutto. Risultato: la casa e' diventata
    bianca con il tetto arcobaleno, perche' una palette ricavata soprattutto
    da personaggi non contiene i bruni di un edificio, e il colore "piu'
    vicino" finisce dall'altra parte dello spettro.

    Ed era la cura sbagliata per la malattia giusta: le misure dicevano che
    il problema e' la DENSITA' di dettaglio (21 colori per blocco contro 9),
    non le tinte. Quindi si riduce ogni sprite alla sua palette di n colori,
    si lasciano le sue tinte, e si unifica solo il contorno.
    """
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im)
    m = a[..., 3] > 128
    rgb = Image.fromarray(a[..., :3], 'RGB')
    q = np.asarray(rgb.quantize(colors=n, method=Image.MEDIANCUT,
                                dither=Image.Dither.NONE).convert('RGB'))
    out = a.copy()
    out[..., :3] = q
    if contorno:
        scuro = (pal_contorno if pal_contorno is not None
                 else q[m][np.asarray(q[m], np.int32).sum(axis=1).argmin()])
        bordo = m & ~ndimage.binary_erosion(m, np.ones((3, 3)))
        out[bordo, :3] = scuro
    out[~m] = 0
    return Image.fromarray(out, 'RGBA')


def applica(path, pal, contorno=True):
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im).copy()
    m = a[..., 3] > 128
    rgb = a[..., :3].astype(np.int16)
    # colore piu' vicino, senza dithering: il dithering inventa una trama
    # che in pixel art non c'e' e a schermo si legge come sporco
    d = ((rgb[:, :, None, :] - pal[None, None, :, :]) ** 2).sum(axis=3)
    idx = d.argmin(axis=2)
    a[..., :3] = pal[idx]
    if contorno:
        scuro = pal[pal.astype(np.int32).sum(axis=1).argmin()]
        bordo = m & ~ndimage.binary_erosion(m, np.ones((3, 3)))
        a[bordo, :3] = scuro
    a[~m] = 0
    return Image.fromarray(a, 'RGBA')


def misura(path):
    a = np.asarray(Image.open(path).convert('RGBA'))
    m = a[..., 3] > 128
    if m.sum() < 40:
        return None
    q = (a[..., :3] // 16).astype(np.int32)
    k = q[..., 0] * 4096 + q[..., 1] * 64 + q[..., 2]
    blocchi = []
    for y in range(0, a.shape[0] - 15, 16):
        for x in range(0, a.shape[1] - 15, 16):
            bm = m[y:y + 16, x:x + 16]
            if bm.mean() < 0.6:
                continue
            blocchi.append(len(np.unique(k[y:y + 16, x:x + 16][bm])))
    return {'file': os.path.basename(path),
            'palette': int(len(np.unique(k[m]))),
            'colori_per_16px': round(float(np.median(blocchi)), 1) if blocchi else None}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('files', nargs='*')
    ap.add_argument('--crea', action='store_true')
    ap.add_argument('--colori', type=int, default=48)
    ap.add_argument('--misura', action='store_true')
    ap.add_argument('--no-contorno', action='store_true')
    ap.add_argument('--globale', action='store_true',
                    help='mappa sulla palette maestra (sconsigliato: vedi riduci)')
    ap.add_argument('-n', type=int, default=14,
                    help='colori per sprite')
    a = ap.parse_args()
    if a.crea:
        crea(a.colori)
        return
    if a.misura:
        for f in a.files:
            print(misura(f))
        return
    if a.globale:
        applica(a.files[0], carica_palette(), not a.no_contorno).save(a.files[1])
    else:
        # contorno comune preso dalla palette maestra: e' l'unica cosa che
        # conviene davvero condividere fra fonti diverse
        pal = carica_palette()
        scuro = pal[pal.astype(np.int32).sum(axis=1).argmin()]
        riduci(a.files[0], a.n, not a.no_contorno, scuro).save(a.files[1])
    print(misura(a.files[0]), '→', misura(a.files[1]))


if __name__ == '__main__':
    main()
