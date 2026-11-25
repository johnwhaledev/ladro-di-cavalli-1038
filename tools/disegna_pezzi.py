#!/usr/bin/env python3
"""
disegna_pezzi.py — i pezzi del borgo che non si generano: disegnati da codice.

Mura, porte, tende, stendardi, staccionate, lampioni e torce erano gli ultimi
ritagli delle tavole ChatGPT: un altro gioco, a un'altra grana. Il lotto nano
non li copre, e i pezzi modulari delle mura non verrebbero comunque da un
generatore: una campata deve combaciare con la successiva al pixel.

Qui sono pixel art procedurale nella grana dei personaggi (6,83 px per unita',
PPU_UMANO): contorno scuro di 1 px, pochi toni piatti per materiale, palette
campionata dalle case del lotto di Valdarno (pietra calda, legno scuro, crema,
coppi). Le fazioni hanno i loro colori: rosso l'altro villaggio, blu il borgo.

Non si lancia da solo: `innesta_nano.py` chiama `pezzi()` e li innesta per nome
come fa con le immagini generate. Per guardarli senza lanciare il gioco:
    python tools/disegna_pezzi.py        -> out/provino_pezzi.png
"""
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_mini  # noqa: E402
from percorsi import PROVINI  # noqa: E402

DENSITA = build_mini.PPU_UMANO

# campionati da torre, castello_mastio ed edificio_casa del lotto innestato
CONTORNO = (24, 16, 16)
PIETRA = [(88, 70, 66), (111, 88, 80), (143, 124, 109), (163, 142, 127),
          (190, 172, 150)]                       # ombra -> luce
MALTA = (71, 48, 43)
LEGNO = [(64, 36, 28), (91, 56, 44), (149, 101, 83)]
CREMA = [(208, 191, 148), (254, 241, 175)]
FERRO = [(52, 50, 58), (92, 94, 104)]
ORO = (226, 176, 64)
VETRO = (255, 214, 120)
BUIO = (40, 24, 22)
COPPI = [(112, 38, 30), (156, 56, 40), (194, 84, 58)]   # ombra -> luce, come i tetti del lotto
FAZIONE = {
    'rosso': [(104, 22, 22), (168, 36, 34), (212, 70, 56)],
    'blu':   [(30, 44, 96), (48, 78, 152), (96, 132, 204)],
    'bianco': [(196, 190, 176), (236, 232, 218), (250, 248, 240)],
}


def px(unita):
    return max(4, round(unita * DENSITA))


class Tela:
    """Un foglio RGBA con le poche primitive che servono, senza antialias."""

    def __init__(self, w, h):
        self.im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)
        self.w, self.h = w, h

    def rett(self, box, col):                  # (x0, y0, x1, y1), estremi inclusi
        self.d.rectangle(box, fill=col + (255,))

    def pol(self, punti, col):
        self.d.polygon(punti, fill=col + (255,))

    def punto(self, xy, col):
        if 0 <= xy[0] < self.w and 0 <= xy[1] < self.h:
            self.im.putpixel(xy, col + (255,))

    def chiudi(self, aperto=''):
        """Contorno di 1 px sul bordo della sagoma, come i Mini. `aperto`
        ('lr') lascia senza contorno i lati sinistro e destro: i pezzi
        modulari delle mura si toccano, e una riga scura a ogni giunto
        mostrerebbe la cucitura."""
        a = np.asarray(self.im).copy()
        pieno = a[..., 3] > 0
        p = np.pad(pieno, 1)
        if 'l' in aperto:
            p[1:-1, 0] = pieno[:, 0]
        if 'r' in aperto:
            p[1:-1, -1] = pieno[:, -1]
        if 't' in aperto:
            p[0, 1:-1] = pieno[0, :]
        if 'b' in aperto:
            p[-1, 1:-1] = pieno[-1, :]
        bordo = pieno & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])
        a[bordo, :3] = CONTORNO
        return Image.fromarray(a)


def conci(t, box, trama=(1, 8)):
    """Muratura a conci sfalsati nel riquadro `box`: righe alte 4 px (malta
    compresa), `trama` = (seme, larghezza del concio). Ogni concio ha il suo
    tono e un punto di luce in alto a sinistra."""
    x0, y0, x1, y1 = box
    seme, largo = trama
    alto = 4
    rnd = random.Random(seme)
    t.rett(box, MALTA)
    for r, y in enumerate(range(y0, y1 + 1, alto)):
        sfasa = (r % 2) * (largo // 2)
        for x in range(x0 - sfasa, x1 + 1, largo):
            a, b = max(x, x0), min(x + largo - 2, x1)
            if b < a:
                continue
            col = PIETRA[rnd.choice((1, 2, 2, 3))]
            t.rett((a, y, b, min(y + alto - 2, y1)), col)
            t.punto((a, y), PIETRA[4])


def merli(t, box, ritmo=(7, 4)):
    """Merlatura nel riquadro `box`; `ritmo` = (passo, larghezza del merlo)."""
    x0, y0, x1, y1 = box
    alto = y1 - y0 + 1
    passo, pieno = ritmo
    for x in range(x0, x1 + 1, passo):
        t.rett((x, y0, min(x + pieno - 1, x1), y0 + alto - 1), PIETRA[3])
        t.punto((x, y0), PIETRA[4])


# ------------------------------------------------------------------ mura

def cinta_campata():
    """Campata frontale: 12 unita' esatte, quante ne separano due campate."""
    w, h = px(12), px(5.7)
    t = Tela(w, h)
    conci(t, (0, 5, w - 1, h - 1), (1, 8))
    t.rett((0, 5, w - 1, 5), PIETRA[0])              # ombra sotto il parapetto
    merli(t, (1, 0, w - 1, 4))
    t.rett((0, h - 3, w - 1, h - 1), PIETRA[1])      # zoccolo
    for x in range(10, w - 6, 20):                 # feritoie
        t.rett((x, 14, x, 19), BUIO)
    return t.chiudi(aperto='lr'), 5.7


def cinta_cima():
    """Il muro di taglio com'e' davvero visto dall'alto: la cima, stesa
    all'altezza del camminamento delle mura di fronte (in gioco e' un quad a
    terra rialzato, `piano` in world_borgo.js). Camminamento lastricato in
    mezzo, merli sui due bordi, lungo 12 unita' e aperto in cima e in fondo:
    i pezzi si seguono lungo il lato. Il fianco verso levante e' in ombra.
    Prima una fila di pezzi in piedi ogni 0,3 tile, che faceva colonna."""
    w, h = px(3.0), px(12)
    t = Tela(w, h)
    _cima(t, (0, 0, w - 1, h - 1), 11)
    return t.chiudi(aperto='tb'), 12.0


def _muratura_lunga(t, box, seme):
    """Conci disposti lungo il muro (verticali nell'immagine) e sfalsati: con
    le righe orizzontali la cima sembrava una scala a pioli."""
    x0, y0, x1, y1 = box
    g = Tela(y1 - y0 + 1, x1 - x0 + 1)
    conci(g, (0, 0, g.w - 1, g.h - 1), (seme, 7))
    t.im.alpha_composite(g.im.transpose(Image.Transpose.ROTATE_90), (x0, y0))


def _cima(t, box, seme):
    """Cima di un muro vista dall'alto: parapetto merlato ai due bordi,
    camminamento in muratura in mezzo, ombra del parapetto di levante."""
    x0, y0, x1, y1 = box
    t.rett(box, PIETRA[1])
    _muratura_lunga(t, (x0 + 5, y0, x1 - 5, y1), seme)
    for xa in (x0 + 4, x1 - 4):                             # piede del parapetto
        t.rett((xa, y0, xa, y1), PIETRA[0])
    for xa in (x0, x1 - 3):                                 # merli chiari su vuoti scuri
        t.rett((xa, y0, xa + 3, y1), PIETRA[0])
        for y in range(y0, y1 + 1, 6):
            t.rett((xa, y, xa + 3, min(y + 3, y1)), PIETRA[4])
            if y + 1 <= y1:
                t.rett((xa + 1, y + 1, xa + 3, min(y + 3, y1)), PIETRA[3])
    t.rett((x1 - 5, y0, x1 - 5, y1), MALTA)                 # ombra verso levante


# Il torrione delle porte di levante e ponente, a pezzi (25/09 sera). Prima
# era un solo disegno steso sopra la via, torri e camminamento alla stessa
# altezza: da lassu' si leggeva piatto, come un tappeto. Ora ogni parte ha la
# sua altezza (world_borgo.js): il camminamento sopra l'arco a 7 unita', le due
# torri a 9,5, e la differenza si vede. La torre a sud mostra la faccia in
# piedi fino a terra, come le torri della cinta; di quella a nord, dietro il
# ponte, spunta solo la cima della faccia. La luce viene da nord-ovest: le
# ombre cadono a sud-est.
PORTA_LATO = {'torre_largo': 7.0, 'torre_lungo': 4.4, 'torre_alto': 9.5,
              'ponte_largo': 5.0, 'ponte_lungo': 10.0}


def _ombra(t, punti, forza=0.55):
    """Scurisce la sagoma gia' disegnata dentro il poligono: un'ombra netta,
    non un colore nuovo (la pietra sotto resta leggibile)."""
    m = Image.new('L', t.im.size, 0)
    ImageDraw.Draw(m).polygon(punti, fill=255)
    a = np.asarray(t.im).astype(np.float32)
    sel = (np.asarray(m) > 0) & (a[..., 3] > 0)
    a[sel, :3] *= forza
    t.im = Image.fromarray(a.astype(np.uint8))
    t.d = ImageDraw.Draw(t.im)


def porta_fianco():
    """Il camminamento sopra l'arco di una porta di levante o ponente, visto
    dall'alto: la via ci passa sotto da sinistra a destra. E' la cima delle
    mura (_cima) piu' larga, con le assi del ballatoio e la guida della
    saracinesca di traverso. In cima l'ombra della torre nord, che e' piu'
    alta: il suo taglio netto dice che la torre sta sopra il ponte."""
    P = PORTA_LATO
    w, h = px(P['ponte_largo']), px(P['ponte_lungo'])
    t = Tela(w, h)
    _cima(t, (0, 0, w - 1, h - 1), 17)
    for y in range(3, h - 3, 3):
        t.rett((6, y, w - 7, y), LEGNO[0])
    my = h // 2 + 3
    t.rett((5, my - 1, w - 6, my + 1), BUIO)
    for x in range(6, w - 5, 3):
        t.punto((x, my), FERRO[1])
    # l'ombra della torre nord: piu' lunga verso levante (luce da nord-ovest)
    _ombra(t, [(0, 0), (w, 0), (w, 13), (6, 8), (0, 8)])
    return t.chiudi(aperto='tb'), P['ponte_lungo']


def porta_torre():
    """La cima di una delle due torri della porta, vista dall'alto: merli sui
    quattro lati, piano di pietra, la botola della scala. I parapetti di
    ponente e di nord gettano l'ombra sul piano."""
    P = PORTA_LATO
    w, h = px(P['torre_largo']), px(P['torre_lungo'])
    t = Tela(w, h)
    t.rett((0, 0, w - 1, h - 1), PIETRA[0])                 # vuoti fra i merli
    for x in range(0, w, 5):
        for ya in (0, h - 4):
            t.rett((x, ya, min(x + 2, w - 1), ya + 3), PIETRA[4])
    for y in range(0, h, 5):
        for xa in (0, w - 4):
            t.rett((xa, y, xa + 3, min(y + 2, h - 1)), PIETRA[4])
    t.rett((4, 4, w - 5, h - 5), PIETRA[3])                 # il piano, al sole
    _muratura_lunga(t, (5, 5, w - 6, h - 6), 23)
    t.rett((4, 4, w - 5, 5), MALTA)                         # ombra del parapetto nord
    t.rett((4, 4, 5, h - 5), MALTA)                         # e di quello di ponente
    cx, cy = w // 2 + 4, h // 2 - 1
    t.rett((cx, cy, cx + 4, cy + 4), LEGNO[1])              # la botola
    t.rett((cx + 1, cy + 1, cx + 3, cy + 3), LEGNO[0])
    return t.chiudi(), P['torre_lungo']


def porta_torre_fronte():
    """La faccia sud di una torre della porta, in piedi come cinta_torre:
    conci, il ballatoio sporgente in cima con l'ombra sotto, le feritoie, lo
    zoccolo. E' in ombra (la luce viene da nord): piu' scura della cima.
    Serve a tutte e due le torri: di quella a nord il ponte copre il mezzo."""
    P = PORTA_LATO
    w, h = px(P['torre_largo']), px(P['torre_alto'])
    t = Tela(w, h)
    conci(t, (0, 0, w - 1, h - 1), (9, 8))
    conci(t, (0, 0, w - 1, 6), (10, 6))                     # ballatoio
    t.rett((0, 7, w - 1, 8), PIETRA[0])
    for x in range(1, w, 7):                                # mensole del ballatoio
        t.rett((x, 9, x + 1, 10), PIETRA[0])
    for x, y in ((w // 4, 20), (3 * w // 4, 20), (w // 2, 38)):
        t.rett((x, y, x, y + 6), BUIO)                      # feritoie
        t.punto((x - 1, y + 3), BUIO)
        t.punto((x + 1, y + 3), BUIO)
    t.rett((0, h - 4, w - 1, h - 1), PIETRA[1])             # zoccolo
    _ombra(t, [(0, 0), (w, 0), (w, h), (0, h)], 0.8)
    _ombra(t, [(0, h - 12), (w, h - 12), (w, h), (0, h)], 0.85)   # piede, piu' buio
    return t.chiudi(aperto='t'), P['torre_alto']


def cinta_torre():
    w, h = px(3.6), px(8.0)
    t = Tela(w, h)
    conci(t, (2, 10, w - 3, h - 1), (3, 8))
    conci(t, (0, 4, w - 1, 9), (4, 6))      # ballatoio sporgente
    t.rett((0, 9, w - 1, 9), PIETRA[0])
    t.rett((2, 10, w - 3, 10), PIETRA[0])
    merli(t, (0, 0, w - 1, 3), (6, 3))
    for y in (18, 34):                              # feritoie
        t.rett((w // 2, y, w // 2, y + 5), BUIO)
    t.rett((2, h - 3, w - 3, h - 1), PIETRA[1])
    return t.chiudi(), 8.0


def cinta_torre_cima():
    """La cima di una torre della cinta vista dall'alto, per le torri sui
    lati est e ovest (e negli angoli), dove il muro si vede di taglio: senza,
    la torre era solo una faccia dipinta e il fianco del muro le spuntava
    accanto fino a terra. Quadrata, larga quanto cinta_torre; merli sui
    quattro lati come porta_torre, ombra dei parapetti di nord e ponente."""
    w = h = px(3.6)
    t = Tela(w, h)
    t.rett((0, 0, w - 1, h - 1), PIETRA[0])
    for x in range(0, w, 5):
        for ya in (0, h - 3):
            t.rett((x, ya, min(x + 2, w - 1), ya + 2), PIETRA[4])
    for y in range(0, h, 5):
        for xa in (0, w - 3):
            t.rett((xa, y, xa + 2, min(y + 2, h - 1)), PIETRA[4])
    t.rett((3, 3, w - 4, h - 4), PIETRA[3])
    _muratura_lunga(t, (4, 4, w - 5, h - 5), 29)
    t.rett((3, 3, w - 4, 4), MALTA)
    t.rett((3, 3, 4, h - 4), MALTA)
    return t.chiudi(), 3.6


def porta_citta():
    """Due torrette e l'arco, con la saracinesca alzata: si deve leggere che
    si passa. Larga 12,5: fra le campate ai lati c'e' il posto di una campata
    (12) e la porta deve coprirlo tutto; a 8,5 restavano due spiragli."""
    w, h = px(12.5), px(7.2)
    t = Tela(w, h)
    tw = 14
    conci(t, (tw - 2, 9, w - tw + 1, h - 1), (5, 8))
    merli(t, (tw - 2, 4, w - tw + 1, 8))
    for x0 in (0, w - tw):
        conci(t, (x0, 5, x0 + tw - 1, h - 1), (6 + x0, 7))
        merli(t, (x0, 0, x0 + tw - 1, 4), (5, 3))
        t.rett((x0, 5, x0 + tw - 1, 5), PIETRA[0])
        t.rett((x0 + tw // 2, 16, x0 + tw // 2, 21), BUIO)
    # arco: passaggio buio, archivolto chiaro, saracinesca in alto
    cx, aw, top = w // 2, 18, h - 26
    t.pol([(cx - aw // 2, h - 1), (cx - aw // 2, top + 5), (cx - 5, top),
           (cx + 4, top), (cx + aw // 2 - 1, top + 5), (cx + aw // 2 - 1, h - 1)],
          PIETRA[4])
    t.pol([(cx - aw // 2 + 2, h - 1), (cx - aw // 2 + 2, top + 6), (cx - 4, top + 2),
           (cx + 3, top + 2), (cx + aw // 2 - 3, top + 6), (cx + aw // 2 - 3, h - 1)],
          BUIO)
    for x in range(cx - aw // 2 + 3, cx + aw // 2 - 3, 3):
        t.rett((x, top + 3, x, top + 9), FERRO[1])
    t.rett((cx - aw // 2 + 2, top + 9, cx + aw // 2 - 3, top + 9), FERRO[1])
    return t.chiudi(), 7.2


# ------------------------------------------------------------ accampamenti

# la tenda del ladro (tenda.js): verde a righe bianche come i teli della sua
# stanza (src/stanze/tenda.json, tile Kenney rpg:00_11), che nessuna fazione usa
TELO_VERDE = [(30, 72, 46), (54, 116, 72), (104, 164, 100)]


def tenda(colore):
    w, h = px(3.2), px(2.6)
    t = Tela(w, h)
    cx = w // 2
    base = FAZIONE.get(colore) or {'verde': TELO_VERDE}.get(colore)
    righe = colore != 'crema'
    telo = base[1] if base else CREMA[1]
    ombra = base[0] if base else CREMA[0]
    t.pol([(cx, 3), (w - 1, h - 1), (0, h - 1)], telo)
    if righe:                                      # teli a strisce col bianco
        a = np.asarray(t.im).copy()
        for x in range(w):
            if (x // 3) % 2:
                col = a[:, x, 3] > 0
                a[col, x, :3] = FAZIONE['bianco'][1]
        t.im = Image.fromarray(a)
        t.d = ImageDraw.Draw(t.im)
    t.pol([(cx + 1, 4), (w - 1, h - 1), (cx + 3, h - 1)], ombra)   # falda in ombra
    t.pol([(cx, 8), (cx + 3, h - 1), (cx - 3, h - 1)], BUIO)      # ingresso
    t.rett((cx, 0, cx, 3), LEGNO[1])                                 # palo
    pennone = base[2] if base else LEGNO[2]
    t.rett((cx + 1, 0, cx + 3, 1), pennone)
    return t.chiudi(), 2.6


def stendardo(colore, emblema):
    w, h = px(1.4), px(3.4)
    t = Tela(w, h)
    c = FAZIONE[colore]
    t.rett((1, 1, 2, h - 1), LEGNO[1])
    t.punto((1, 1), LEGNO[2])
    t.rett((1, 0, 2, 0), ORO)
    t.rett((1, 3, w - 1, 3), LEGNO[0])               # traversa
    t.rett((3, 4, w - 1, 16), c[1])
    t.rett((w - 1, 4, w - 1, 16), c[0])
    t.pol([(3, 17), (5, 20), (5, 17)], c[1])       # coda a rondine
    t.pol([(w - 1, 17), (w - 3, 20), (w - 3, 17)], c[0])
    mx = (3 + w - 1) // 2
    t.rett((mx, 6, mx, 13), emblema)                 # croce
    t.rett((mx - 2, 8, mx + 2, 8), emblema)
    return t.chiudi(), 3.4


def gonfalone(colore, emblema):
    w, h = px(1.9), px(3.2)
    t = Tela(w, h)
    c = FAZIONE[colore]
    cx = w // 2
    t.rett((cx, 1, cx, h - 1), LEGNO[1])
    t.rett((cx, 0, cx, 0), ORO)
    t.rett((0, 3, w - 1, 3), LEGNO[0])
    t.pol([(1, 4), (w - 2, 4), (w - 2, 14), (cx, 18), (1, 14)], c[1])
    t.pol([(cx + 1, 4), (w - 2, 4), (w - 2, 14), (cx + 1, 17)], c[0])
    t.rett((cx - 2, 8, cx + 2, 10), emblema)         # scudetto
    t.rett((cx - 1, 11, cx + 1, 11), emblema)
    return t.chiudi(), 3.2


# ---------------------------------------------------------------- arredo

def staccionata(lunghezza):
    w, h = px(lunghezza), px(1.2)
    t = Tela(w, h)
    for y in (2, 5):                                # traverse
        t.rett((0, y, w - 1, y), LEGNO[1])
        t.rett((0, y - 1, w - 1, y - 1), LEGNO[2])
    for x in list(range(0, w - 2, 6)) + [w - 2]:   # pali appuntiti
        t.rett((x, 1, x + 1, h - 1), LEGNO[1])
        t.punto((x, 0), LEGNO[1])
        t.punto((x, 1), LEGNO[2])
    return t.chiudi(), 1.2


def lampione(alto):
    w, h = 7, px(alto)
    t = Tela(w, h)
    t.rett((3, 6, 3, h - 1), FERRO[0])
    t.rett((2, h - 2, 4, h - 1), PIETRA[1])          # piede
    t.rett((1, 2, 5, 6), FERRO[0])                   # lanterna
    t.rett((2, 3, 4, 5), VETRO)
    t.pol([(1, 2), (3, 0), (5, 2)], FERRO[1])      # cappello
    return t.chiudi(), alto


def lanterna_palo():
    w, h = 9, px(2.4)
    t = Tela(w, h)
    t.rett((1, 1, 2, h - 1), LEGNO[1])
    t.rett((1, 1, 7, 2), LEGNO[0])                   # braccio
    t.rett((6, 3, 6, 4), FERRO[0])
    t.rett((5, 5, 8, 9), FERRO[0])
    t.rett((6, 6, 7, 8), VETRO)
    return t.chiudi(), 2.4


def torcia():
    """Palo e bracere, senza fiamma: il fuoco lo fa il motore, e illumina."""
    w, h = 7, px(2.2)
    t = Tela(w, h)
    t.rett((3, 4, 3, h - 1), LEGNO[1])
    t.rett((1, 2, 5, 4), FERRO[0])
    t.rett((2, 2, 4, 2), (220, 110, 50))             # brace
    t.rett((2, h - 2, 4, h - 1), LEGNO[0])
    return t.chiudi(), 2.2


def palo_insegna():
    w, h = 12, px(2.6)
    t = Tela(w, h)
    t.rett((1, 1, 2, h - 1), LEGNO[1])
    t.rett((1, 1, 10, 2), LEGNO[0])                  # braccio
    for x in (4, 9):
        t.rett((x, 3, x, 4), FERRO[1])               # catenelle
    t.rett((3, 5, 10, 10), CREMA[1])                 # tavola
    t.rett((3, 10, 10, 10), CREMA[0])
    t.rett((5, 7, 8, 8), LEGNO[0])                   # segno di bottega
    t.punto((6, 6), LEGNO[0])
    return t.chiudi(), 2.6


def insegna_osteria():
    """Le osterie in cui si entra (J1): il palo di bottega con la tavola e un
    boccale di birra, e sotto la frasca verde che era l'insegna vera delle
    osterie. Accanto all'uscio c'e' anche una lanterna (buildOsterie). La
    prima versione (tavola color crema, boccale arancio di 4x5 pixel)
    sembrava una tazza da caffe' (tua foto del 25/09 notte): ora la tavola e'
    di legno scuro e il boccale e' di doghe, coi cerchi di ferro, il manico
    grosso e la schiuma che trabocca."""
    w, h = 18, px(3.4)                               # 23 px
    t = Tela(w, h)
    t.rett((1, 1, 2, h - 1), LEGNO[1])
    t.rett((1, 1, 16, 2), LEGNO[0])                  # braccio
    for x in (5, 15):
        t.rett((x, 3, x, 3), FERRO[1])               # catenelle
    t.rett((3, 4, 16, 15), LEGNO[1])                 # tavola di legno
    t.rett((3, 4, 16, 4), LEGNO[2])
    t.rett((3, 15, 16, 15), LEGNO[0])
    doga, doga_luce = (170, 112, 58), (204, 146, 78)
    t.rett((6, 8, 11, 14), doga)                     # il boccale, a doghe
    for x in (7, 9):
        t.rett((x, 8, x, 14), doga_luce)
    for y in (9, 13):
        t.rett((6, y, 11, y), FERRO[1])              # i cerchi di ferro
    schiuma = (252, 250, 240)
    t.rett((5, 6, 12, 7), schiuma)                   # la schiuma che trabocca
    t.punto((7, 5), schiuma)
    t.punto((10, 5), schiuma)
    t.punto((5, 8), schiuma)
    t.rett((12, 9, 14, 9), LEGNO[0])                 # il manico
    t.rett((14, 9, 14, 12), LEGNO[0])
    t.rett((12, 12, 14, 12), LEGNO[0])
    scuro, chiaro = (52, 112, 44), (110, 178, 72)
    t.punto((9, 16), LEGNO[0])                       # la frasca, appesa sotto
    t.rett((7, 17, 11, 18), scuro)
    t.rett((8, 19, 10, 20), scuro)
    t.punto((9, 21), scuro)
    for x, y in [(7, 17), (9, 18), (11, 17), (8, 19), (10, 20)]:
        t.punto((x, y), chiaro)
    return t.chiudi(), 3.4


def botola():
    """La botola del cunicolo (B) nella corte del castello: un riquadro di
    assi incassato nel lastricato, con le bandelle e l'anello di ferro. Bassa:
    si legge come una cosa a terra, non come una cassa."""
    w, h = 14, 7
    t = Tela(w, h)
    t.rett((0, 0, w - 1, h - 1), PIETRA[1])          # la cornice di pietra
    t.rett((1, 1, w - 2, h - 2), LEGNO[1])
    for x in (4, 7, 10):
        t.rett((x, 1, x, h - 2), LEGNO[0])           # commessure delle assi
    for y in (2, h - 3):
        t.rett((1, y, w - 2, y), FERRO[0])           # bandelle
    t.rett((6, 3, 8, 3), FERRO[1])                   # l'anello
    t.punto((6, 2), FERRO[1])
    t.punto((8, 2), FERRO[1])
    return t.chiudi(), 1.0


def remo():
    """Un remo della galea visto dall'alto (07/10, il ponte della nave
    pirata): asta di legno lunga e sottile, il girone scuro dove entra nello
    scalmo, la pala in fondo. Verticale, il manico in alto: nave.js lo stende
    sull'acqua fuori dalla murata e lo fa vogare girandolo."""
    w, h = 5, px(6.0)
    t = Tela(w, h)
    t.rett((2, 0, 2, h - 9), LEGNO[2])                 # l'asta
    t.rett((1, 0, 3, 3), LEGNO[1])                     # il manico
    t.rett((1, 7, 3, 8), LEGNO[0])                     # il girone, allo scalmo
    t.rett((0, h - 9, w - 1, h - 1), LEGNO[1])         # la pala
    t.rett((2, h - 8, 2, h - 2), LEGNO[2])
    return t.chiudi(), 6.0


def schiuma():
    """L'acqua smossa attorno allo scafo di una barca, stesa sotto lo scafo e
    girata con lui (game.js, drawBarca). Senza, lo scafo scuro sull'acqua
    cupa sembrava affondare (tua foto del 25/09 notte): il bordo di schiuma lo
    stacca e lo tiene a galla. Un'ellisse verticale come gli scafi: bordo di
    schiuma a macchie, dentro acqua chiara e velata; il gioco la stira alla
    misura dello scafo."""
    w, h = 22, 44
    a = np.zeros((h, w, 4), np.uint8)
    rnd = random.Random(7)
    cx, cy = (w - 1) / 2, (h - 1) / 2
    for y in range(h):
        for x in range(w):
            d = ((x - cx) / (w / 2)) ** 2 + ((y - cy) / (h / 2)) ** 2
            if d > 1:
                continue
            if d > 0.62:                                # il bordo di schiuma
                if rnd.random() < 0.65:
                    chiaro = rnd.random() < 0.45
                    a[y, x] = (228, 242, 244, 190) if chiaro else (170, 214, 228, 150)
            else:                                       # acqua smossa, velata
                a[y, x] = (150, 204, 220, 90 if rnd.random() < 0.7 else 130)
    return Image.fromarray(a), 3.0


# ------------------------------------------------------------------ segni
#
# I segni sopra la testa: corona del committente, spada sul bersaglio di una
# caccia, sacchetto su chi deve pagare. Le icone del vecchio registro avevano
# i nomi sbagliati (la "corona" era uno scudo, le "spade" una figurina) e a
# 0,9 unita' erano una macchia: qui si disegnano a mano, alla grana dei
# personaggi, con un contorno esterno che le stacca da qualunque terreno.

def contorna(im):
    """Contorno ESTERNO di 1 px (chiudi() lo fa sul bordo della sagoma). Serve
    ai pezzi minuti: un'asta o un manico di 1 px con chiudi() diventerebbe
    tutto contorno. Chi disegna lascia 1 px di margine."""
    a = np.asarray(im).copy()
    pieno = a[..., 3] > 0
    p = np.pad(pieno, 1)
    vicino = p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    a[vicino & ~pieno] = CONTORNO + (255,)
    return Image.fromarray(a)


def segno(righe, tavolozza):
    """Bitmap da righe di caratteri ('.' vuoto) con contorno esterno di 1 px."""
    h, w = len(righe) + 2, len(righe[0]) + 2
    t = Tela(w, h)
    for y, riga in enumerate(righe):
        for x, ch in enumerate(riga):
            if ch != '.':
                t.punto((x + 1, y + 1), tavolozza[ch])
    return contorna(t.im)


ORO_CHIARO = (255, 230, 140)
ORO_SCURO = (168, 118, 40)


def segno_corona():
    im = segno(["o....o....o",
                "O...OOO...O",
                "OO.OOOOO.OO",
                "OOOOOOOOOOO",
                "DDRDDBDDRDD",
                "OOOOOOOOOOO"],
               {'o': ORO_CHIARO, 'O': ORO, 'D': ORO_SCURO,
                'R': (200, 40, 40), 'B': (60, 100, 200)})
    return im, round(im.height / DENSITA, 2)


def segno_spada():
    im = segno(["...O...",
                "...L...",
                "...L...",
                "OOORooo",
                "..SWS..",
                "..SWS..",
                "..SWS..",
                "..SWS..",
                "..SWS..",
                "...W..."],
               {'O': ORO, 'o': ORO_SCURO, 'L': LEGNO[1], 'R': (210, 40, 40),
                'W': (240, 240, 246), 'S': (150, 152, 166)})
    return im, round(im.height / DENSITA, 2)


def segno_sacchetto():
    im = segno(["..T..T..",
                "...TT...",
                "..tBBt..",
                ".BBBBBB.",
                "BBBBBBBB",
                "BBBOOBBB",
                "BBOoOOBB",
                "BBBOOBBb",
                ".bBBBBb."],
               {'T': (120, 84, 52), 't': (150, 110, 70),
                'B': (186, 146, 94), 'b': (136, 100, 62),
                'O': ORO, 'o': ORO_CHIARO})
    return im, round(im.height / DENSITA, 2)


# ------------------------------------------------------------------ arredo
#
# Casse, croci, carriola, gogna, rastrelliera, tavoli e moli: l'ultimo vecchio
# registro (ritagli a ~16 px per unita', il doppio dei personaggi). Stessi
# nomi, cosi' world.js non cambia: l'innesto li sostituisce nell'atlante.
# Tutti con contorno esterno; le misure sono in pixel di grana, compreso il
# margine del contorno, e l'altezza in unita' viene da li'.

LEGNO_CHIARO = [(122, 84, 58), (170, 124, 84), (204, 160, 112)]
TERRA = (96, 72, 50)


def _fine(t):
    im = contorna(t.im)
    return im, round(im.height / DENSITA, 2)


def cassa(w, h, legno):
    """Cassa di tre quarti: coperchio chiaro in alto, assi sul davanti."""
    t = Tela(w, h)
    x0, y0, x1, y1 = 1, 1, w - 2, h - 2
    t.rett((x0, y0, x1, y1), legno[1])
    t.rett((x0, y0, x1, y0 + 1), legno[2])            # coperchio
    t.rett((x0, y0 + 2, x1, y0 + 2), legno[0])        # spigolo
    for x in range(x0 + 2, x1, 3):
        t.rett((x, y0 + 3, x, y1), legno[0])          # assi
    t.punto((x0, y0 + 3), FERRO[1])
    t.punto((x1, y0 + 3), FERRO[1])
    return _fine(t)


def croce_legno():
    """Croce da cimitero sul suo tumulo."""
    t = Tela(9, 14)
    t.rett((4, 1, 4, 10), LEGNO[2])
    t.rett((5, 2, 5, 10), LEGNO[1])
    t.rett((1, 3, 7, 3), LEGNO[2])
    t.rett((1, 4, 7, 4), LEGNO[1])
    t.rett((2, 10, 6, 12), TERRA)
    t.rett((3, 10, 5, 10), (120, 92, 64))
    return _fine(t)


def crocifisso():
    """Croce di pietra su un basamento, per sagrato e crocicchi."""
    t = Tela(11, 16)
    t.rett((4, 1, 6, 11), PIETRA[3])
    t.rett((6, 1, 6, 11), PIETRA[1])
    t.rett((1, 3, 9, 5), PIETRA[3])
    t.rett((1, 5, 9, 5), PIETRA[1])
    t.punto((4, 1), PIETRA[4])
    t.rett((2, 11, 8, 14), PIETRA[2])
    t.rett((2, 11, 8, 11), PIETRA[4])
    t.rett((2, 14, 8, 14), PIETRA[0])
    return _fine(t)


def carriola():
    """Di fianco: ruota davanti, cassone di terra, stanghe dietro."""
    t = Tela(16, 10)
    t.pol([(4, 2), (12, 2), (11, 6), (5, 6)], LEGNO_CHIARO[1])
    t.rett((5, 2, 11, 3), TERRA)                      # il carico
    t.rett((6, 2, 8, 2), (120, 92, 64))
    t.rett((5, 6, 11, 6), LEGNO_CHIARO[0])
    t.rett((12, 4, 13, 4), LEGNO[1])                  # stanghe
    t.rett((14, 5, 14, 5), LEGNO[1])
    t.rett((10, 7, 10, 8), LEGNO[0])                  # piede
    t.rett((2, 5, 4, 8), LEGNO[0])                    # ruota
    t.rett((3, 6, 3, 7), FERRO[1])
    return _fine(t)


def gogna():
    """Palo, tavola coi tre fori, pedana."""
    t = Tela(13, 14)
    t.rett((5, 6, 7, 11), LEGNO[1])
    t.rett((6, 6, 6, 11), LEGNO[2])
    t.rett((1, 2, 11, 5), LEGNO_CHIARO[1])
    t.rett((1, 2, 11, 2), LEGNO_CHIARO[2])
    t.rett((1, 4, 11, 4), LEGNO_CHIARO[0])            # il taglio della tavola
    for x in (3, 9):
        t.punto((x, 4), BUIO)
    t.rett((5, 3, 7, 4), BUIO)                        # il foro del collo
    t.rett((2, 11, 10, 12), LEGNO[0])
    t.rett((2, 11, 10, 11), LEGNO[1])
    return _fine(t)


def forca():
    """La forca dell'atto V (13/10): il palco di assi con la scaletta, due
    montanti e la trave coi saettoni, tre corde col cappio (il Ciambellano
    e i suoi due complici, tua scelta del 13/10)."""
    t = Tela(31, 27)
    t.rett((2, 18, 28, 20), LEGNO[1])                 # il palco
    t.rett((2, 18, 28, 18), LEGNO_CHIARO[1])
    t.rett((2, 20, 28, 20), LEGNO[0])
    for x in (7, 12, 17, 22):
        t.rett((x, 19, x, 19), LEGNO[0])              # le commessure
    for x in (3, 16, 27):
        t.rett((x, 21, x, 25), LEGNO[0])              # le gambe
    for y in (22, 24):
        t.rett((28, y, 29, y), LEGNO_CHIARO[0])       # la scaletta
    for x in (4, 25):
        t.rett((x, 2, x + 1, 17), LEGNO[1])           # i montanti
        t.rett((x + 1, 2, x + 1, 17), LEGNO[2])
    t.rett((4, 1, 26, 2), LEGNO[1])                   # la trave
    t.rett((4, 1, 26, 1), LEGNO[2])
    for k in range(3):
        t.punto((6 + k, 5 - k), LEGNO[1])             # i saettoni
        t.punto((24 - k, 5 - k), LEGNO[1])
    for x in (10, 15, 20):
        t.rett((x, 3, x, 9), CREMA[0])                # la corda
        t.rett((x - 1, 10, x + 1, 10), CREMA[0])      # il cappio
        t.rett((x - 1, 11, x - 1, 12), CREMA[0])
        t.rett((x + 1, 11, x + 1, 12), CREMA[0])
        t.rett((x, 13, x, 13), CREMA[0])
    return _fine(t)


def rastrelliera():
    """Due montanti, due traverse, lance e un'ascia ritte."""
    t = Tela(12, 12)
    t.rett((1, 4, 1, 10), LEGNO[1])
    t.rett((10, 4, 10, 10), LEGNO[1])
    t.rett((1, 5, 10, 5), LEGNO[2])
    t.rett((1, 9, 10, 9), LEGNO[2])
    for x in (3, 5, 8):
        t.rett((x, 2, x, 10), LEGNO_CHIARO[2])        # aste
        t.rett((x, 1, x, 2), FERRO[1])                # punte
    t.rett((6, 2, 7, 3), FERRO[1])                    # ferro dell'ascia
    t.rett((6, 4, 6, 10), LEGNO_CHIARO[1])
    return _fine(t)


def tavolo(w, cose):
    """Piano di tre quarti, bordo scuro, due gambe; `cose` = [(x, y, colore)]
    appoggiate sul piano."""
    t = Tela(w, 10)
    t.rett((1, 3, w - 2, 5), LEGNO_CHIARO[1])
    t.rett((1, 3, w - 2, 3), LEGNO_CHIARO[2])
    t.rett((1, 6, w - 2, 6), LEGNO[0])
    t.rett((2, 7, 2, 8), LEGNO[0])
    t.rett((w - 3, 7, w - 3, 8), LEGNO[0])
    for x, y, col in cose:
        t.punto((x, y), col)
    return _fine(t)


def tavolaccio():
    """Il banco del fabbro: piano spesso, martello, tenaglie, un ferro caldo."""
    t = Tela(16, 11)
    t.rett((1, 3, 14, 6), LEGNO[1])
    t.rett((1, 3, 14, 3), LEGNO[2])
    t.rett((1, 7, 14, 7), LEGNO[0])
    for x in (2, 13):
        t.rett((x, 8, x + 1, 9), LEGNO[0])
    t.rett((3, 2, 5, 3), FERRO[0])                    # martello
    t.rett((6, 3, 8, 3), LEGNO_CHIARO[2])
    t.rett((10, 2, 10, 4), FERRO[1])                  # tenaglie
    t.rett((12, 2, 12, 4), FERRO[1])
    t.rett((9, 5, 11, 5), (230, 110, 50))             # ferro caldo
    return _fine(t)


def molo(lungo, testa):
    """Pontile visto dall'alto: passerella di assi trasversali dalla riva
    verso l'acqua (a sinistra: il fiume sta a ponente), pali ai bordi.
    `testa`: la piattaforma in punta, dove attraccano le barche."""
    w, h = lungo + 2, (22 if testa else 12)
    t = Tela(w, h)
    y0 = h - 10                                       # la passerella, in basso
    t.rett((1, y0, w - 2, y0 + 7), LEGNO_CHIARO[1])
    for x in range(1, w - 1, 3):
        t.rett((x, y0, x, y0 + 7), LEGNO_CHIARO[0])   # fughe fra le assi
        t.punto((x + 1, y0), LEGNO_CHIARO[2])
    if testa:
        t.rett((1, 1, 12, h - 2), LEGNO_CHIARO[1])
        for y in range(1, h - 1, 3):
            t.rett((1, y, 12, y), LEGNO_CHIARO[0])    # assi della testa
            t.punto((2, y + 1), LEGNO_CHIARO[2])
        for x, y in ((1, 1), (11, 1), (1, h - 3), (11, y0 - 1)):
            t.rett((x, y, x + 1, y + 1), LEGNO[0])    # pali
    for x in range(14 if testa else 2, w - 4, 8):
        t.rett((x, y0 - 1, x + 1, y0), LEGNO[0])
        t.rett((x, y0 + 7, x + 1, y0 + 8), LEGNO[0])
    return _fine(t)


def anello(n):
    """L'anello del segnaposto, a terra: due cerchi concentrici a pixel, chiari
    (il gioco li tinge d'oro e li fa pulsare)."""
    t = Tela(n, n)
    t.d.ellipse((0, 0, n - 1, n - 1), outline=(255, 255, 255, 255), width=2)
    t.d.ellipse((4, 4, n - 5, n - 5), outline=(255, 255, 255, 140), width=1)
    return t.im, round(n / DENSITA, 2)


def soglia_porta(w, h):
    """La soglia di una porta di levante o ponente, vista dall'alto: lastre
    di pietra per tutto il varco del muro (h) e, di traverso alla via, la
    guida scura della saracinesca con i due ferri alle estremita'. Stesa a
    terra: una porta in piedi copriva chi ci passa sotto."""
    t = Tela(w, h)
    t.rett((1, 1, w - 2, h - 2), PIETRA[1])
    for y in range(1, h - 1, 6):                       # giunti fra le lastre
        t.rett((1, y, w - 2, y), PIETRA[0])
    for i, y in enumerate(range(1, h - 1, 6)):
        for x in range(2 + (i % 2) * 3, w - 2, 7):     # sfalsati, come i conci
            t.rett((x, y, x, min(y + 5, h - 2)), PIETRA[1])
    g = w // 2
    t.rett((g - 1, 1, g + 1, h - 2), FERRO[0])         # la guida della saracinesca
    t.rett((g, 1, g, h - 2), BUIO)
    for y in (2, h - 4):
        t.rett((g - 3, y, g + 3, y + 1), FERRO[1])     # ferri alle estremita'
    return _fine(t)


# ------------------------------------------------------------------ barche
# (gli scafi vengono dalla tavola delle navi viste dall'alto: innesta_nano,
# SCAFI; qui le vele e le bandiere, che stanno in piedi)

def vela(tela, righe=None):
    """La vela, in piedi come i personaggi: albero, pennone e una vela quadra
    gonfia. `righe` = colore delle bande verticali, o nessuna."""
    w, h = px(3.4), px(4.6)
    t = Tela(w, h)
    cx = w // 2
    t.rett((cx, 0, cx, h - 1), LEGNO[0])                     # albero
    t.rett((2, 3, w - 3, 3), LEGNO[0])                       # pennone
    for y in range(4, h - 6):                                # vela gonfia
        bombo = round(1.5 * (1 - abs((y - 4) / (h - 10) * 2 - 1)))
        t.rett((3 - bombo, y, w - 4 + bombo, y), tela[1])
    for x in range(3, w - 3, 5):
        t.rett((x, 5, x, h - 8), tela[0])                    # cuciture
        if righe:
            t.rett((x + 1, 4, x + 2, h - 7), righe)
    t.rett((3, h - 7, w - 4, h - 7), tela[0])
    return t.chiudi(), 4.6


# Araldica: smalti (metalli e colori) e la regola dell'araldica, mai metallo
# su metallo ne' colore su colore. Le bandiere delle barche nascono da un
# seme: partizione, due smalti, una figura.
METALLI = {'oro': ORO, 'argento': (236, 232, 218)}
COLORI = {'rosso': (168, 36, 34), 'azzurro': (48, 78, 152), 'verde': (46, 118, 58),
          'nero': (40, 36, 44), 'porpora': (112, 46, 108)}
FIGURE = {
    'croce':    ['..#..', '..#..', '#####', '..#..', '..#..'],
    'stella':   ['..#..', '#####', '.###.', '.#.#.', '#...#'],
    'crescente': ['.##..', '#....', '#....', '#....', '.##..'],
    'torre':    ['#.#.#', '#####', '.###.', '.#.#.', '.###.'],
}


def bandiera(seme, stemma=None):
    """Una bandiera araldica da un seme (o da `stemma` = (partizione, smalto,
    smalto, figura)). Rettangolo con la coda mossa, in piedi: in gioco sta
    in cima all'albero e sventola."""
    rnd = random.Random(seme)
    if stemma:
        part, a, b, fig = stemma
    else:
        met = rnd.choice(list(METALLI.values()))
        col = rnd.choice(list(COLORI.values()))
        a, b = (met, col) if rnd.random() < 0.5 else (col, met)
        part = rnd.choice(['pieno', 'partito', 'troncato', 'inquartato', 'palato',
                           'fasciato', 'bandato'])
        fig = rnd.choice(['croce', 'stella', 'crescente', 'torre', None])
    w, h = px(1.8), px(1.2)
    t = Tela(w, h)
    for y in range(h):
        for x in range(w):
            if part == 'partito':
                s = x >= w // 2
            elif part == 'troncato':
                s = y >= h // 2
            elif part == 'inquartato':
                s = (x >= w // 2) != (y >= h // 2)
            elif part == 'palato':
                s = (x // 3) % 2
            elif part == 'fasciato':
                s = (y // 2) % 2
            elif part == 'bandato':
                s = ((x + y) // 3) % 2
            else:
                s = False
            if abs(y - (h - 1) / 2) < x - (w - 4):
                continue                                     # coda di rondine
            t.punto((x, y), b if s else a)
    if fig:
        # la figura prende lo smalto che contrasta col campo al centro
        campo = t.im.getpixel((w // 2, h // 2))[:3]
        smalto = b if campo == a else a
        if smalto == campo:
            smalto = CONTORNO
        ox, oy = w // 2 - 2, h // 2 - 2
        for r, riga in enumerate(FIGURE[fig]):
            for c, ch in enumerate(riga):
                if ch == '#':
                    t.punto((ox + c, oy + r), smalto)
    return t.chiudi(aperto='l'), 1.2


def pezzi():
    """[(nomi, immagine, altezza in unita')] — il primo nome e' quello vero,
    gli altri condividono la stessa regione dell'atlante."""
    b = FAZIONE['bianco'][1]
    return [
        (['cinta_campata'], *cinta_campata()),
        (['cinta_cima'], *cinta_cima()),
        (['porta_fianco'], *porta_fianco()),
        (['porta_torre'], *porta_torre()),
        (['porta_torre_fronte'], *porta_torre_fronte()),
        (['cinta_torre'], *cinta_torre()),
        (['cinta_torre_cima'], *cinta_torre_cima()),
        (['porta_citta'], *porta_citta()),
        (['tenda_rossa'], *tenda('rosso')),
        (['tenda_blu'], *tenda('blu')),
        (['tenda_crema'], *tenda('crema')),
        (['tenda_ladro'], *tenda('crema')),
        (['stendardo_rosso'], *stendardo('rosso', ORO)),
        (['stendardo_azzurro'], *stendardo('blu', b)),
        (['stendardo_bianco'], *stendardo('bianco', FAZIONE['blu'][1])),
        (['gonfalone_rosso'], *gonfalone('rosso', ORO)),
        (['gonfalone_blu'], *gonfalone('blu', b)),
        (['staccionata', 'recinto'], *staccionata(3.0)),
        (['staccionata_lunga'], *staccionata(4.4)),
        (['lampione'], *lampione(2.6)),
        (['lampione_alto'], *lampione(3.4)),
        (['lanterna_palo'], *lanterna_palo()),
        (['torcia'], *torcia()),
        (['palo_insegna'], *palo_insegna()),
        (['insegna_osteria'], *insegna_osteria()),
        (['botola'], *botola()),
        (['schiuma'], *schiuma()),
        (['remo'], *remo()),
        (['segno_corona'], *segno_corona()),
        (['segno_spada'], *segno_spada()),
        (['segno_sacchetto'], *segno_sacchetto()),
        (['cassa'], *cassa(11, 9, LEGNO)),
        (['cassa_b'], *cassa(9, 8, LEGNO_CHIARO)),
        (['croce_legno'], *croce_legno()),
        (['crocifisso'], *crocifisso()),
        (['carriola'], *carriola()),
        (['gogna'], *gogna()),
        (['forca'], *forca()),
        (['rastrelliera'], *rastrelliera()),
        (['tavolo'], *tavolo(13, [(4, 2, CREMA[1]), (4, 1, CREMA[0]),
                                  (8, 3, FERRO[1]), (10, 3, (200, 50, 40))])),
        (['tavolo_b'], *tavolo(11, [(3, 3, (196, 150, 80)), (4, 3, (196, 150, 80)),
                                    (7, 3, (200, 50, 40)), (8, 2, (90, 150, 60))])),
        (['tavolaccio'], *tavolaccio()),
        (['molo_a'], *molo(54, True)),
        (['molo_b'], *molo(46, False)),
        (['anello_marker'], *anello(px(3.0))),
        (['soglia_porta'], *soglia_porta(px(2.6), px(12.8))),
                (['vela_crema'], *vela(CREMA)),
        (['vela_righe'], *vela(CREMA, COLORI['rosso'])),
        (['vela_blu'], *vela([FAZIONE['blu'][0], FAZIONE['blu'][1]])),
        # la bandiera del borgo: azzurro, croce d'argento (come gli stendardi)
        (['bandiera_valdarno'], *bandiera(0, ('pieno', COLORI['azzurro'],
                                              METALLI['argento'], 'croce'))),
    ] + [([f'bandiera_{i}'], *bandiera(1000 + i)) for i in range(12)]


if __name__ == '__main__':
    tutti = pezzi()
    S = 4
    W = sum(im.width * S + 12 for _, im, _ in tutti)
    H = max(im.height for _, im, _ in tutti) * S + 24
    tela = Image.new('RGBA', (W, H), (120, 104, 84, 255))
    d = ImageDraw.Draw(tela)
    x = 6
    for nomi, im, _ in tutti:
        big = im.resize((im.width * S, im.height * S), Image.NEAREST)
        tela.alpha_composite(big, (x, H - 20 - big.height))
        d.text((x, H - 16), nomi[0][:14], fill='white')
        x += big.width + 12
    os.makedirs(PROVINI, exist_ok=True)
    tela.save(os.path.join(PROVINI, 'provino_pezzi.png'))
    print(f'{len(tutti)} pezzi -> out/provino_pezzi.png')
