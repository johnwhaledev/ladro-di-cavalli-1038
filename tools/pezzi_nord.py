#!/usr/bin/env python3
"""
pezzi_nord.py — i pezzi del fiordo vichingo disegnati da codice, alla grana
dei personaggi, come quelli di disegna_pezzi.py (di cui usa la Tela).

Il catalogo del fiordo ha case, navi e vele, ma non quello che fa leggere un
borgo vichingo invece di Valdarno sotto la neve: la palizzata di tronchi al
posto delle mura di pietra, le torrette di legno alle porte, le pietre runiche
e il cerchio di pietre del thing, i tumuli e la nave di pietre del sepolcreto,
le rastrelliere del pesce a seccare, le strade di assi. Stanno solo
nell'atlante del fiordo (innesta_nano.py --mappa fiordo).

La palizzata e' fatta di tronchi singoli: in fila lungo una curva qualsiasi si
leggono giusti da ogni lato (un tronco visto dalla camera e' sempre un
tronco), senza pezzi di fronte e di taglio come le mura di Valdarno.

Da solo scrive un provino in _src/provini/pezzi_nord.png.
"""
import os
import random
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from disegna_pezzi import Tela, px, CONTORNO  # noqa: E402
from percorsi import PROVINI  # noqa: E402

TRONCO = [(58, 40, 30), (86, 60, 42), (122, 88, 60), (150, 114, 80)]
PIETRA_N = [(70, 72, 80), (98, 100, 108), (132, 134, 140), (168, 170, 176)]
NEVE = [(196, 206, 218), (226, 234, 242), (246, 250, 252)]
RUNA = (168, 44, 36)
PESCE = [(120, 128, 136), (170, 178, 184), (206, 212, 214)]


def palo(alto, seme):
    """Un tronco della palizzata, appuntito, con la neve sulla punta."""
    rnd = random.Random(seme)
    w, h = 5, px(alto)
    t = Tela(w, h)
    t.rett((0, 3, w - 1, h - 1), TRONCO[1])
    t.rett((0, 3, 0, h - 1), TRONCO[2])               # luce a sinistra
    t.rett((w - 1, 3, w - 1, h - 1), TRONCO[0])       # ombra a destra
    for _ in range(3):                                 # nodi e crepe
        y = rnd.randrange(6, h - 2)
        t.punto((rnd.randrange(1, w - 1), y), TRONCO[0])
    t.pol([(0, 3), (2, 0), (4, 3)], TRONCO[2])         # la punta
    t.punto((2, 0), NEVE[2])
    t.rett((1, 1, 3, 2), NEVE[1])
    t.rett((0, h - 2, w - 1, h - 1), TRONCO[0])        # piede in ombra
    return t.chiudi(), alto


def torretta():
    """La torretta di guardia di legno ai lati delle porte: quattro pali, il
    ballatoio col parapetto di assi, il tetto a due falde con la neve."""
    w, h = px(3.4), px(6.4)
    t = Tela(w, h)
    y_ball = h // 2 - 2
    for x in (2, w - 5):                               # pali
        t.rett((x, y_ball, x + 2, h - 1), TRONCO[1])
        t.rett((x, y_ball, x, h - 1), TRONCO[2])
    for y in range(y_ball + 6, h - 2, 7):              # croci di rinforzo
        for k in range(w - 8):
            t.punto((4 + k, y + k * 5 // (w - 8)), TRONCO[0])
    t.rett((0, y_ball - 7, w - 1, y_ball), TRONCO[1])  # il parapetto di assi
    for x in range(0, w, 3):
        t.rett((x, y_ball - 7, x, y_ball), TRONCO[0])
    t.rett((0, y_ball - 7, w - 1, y_ball - 7), TRONCO[3])
    t.rett((w // 2 - 3, y_ball - 5, w // 2 + 2, y_ball - 3), (24, 18, 18))  # feritoia
    cx = w // 2
    t.pol([(-1, y_ball - 8), (cx, 1), (w, y_ball - 8)], TRONCO[0])   # tetto
    t.pol([(1, y_ball - 9), (cx, 3), (cx, y_ball - 9)], TRONCO[1])
    t.pol([(cx - 3, 3), (cx, 0), (cx + 3, 3), (cx + 1, 6), (cx - 1, 6)], NEVE[1])
    t.rett((2, y_ball - 10, w - 3, y_ball - 9), NEVE[0])
    return t.chiudi(), 6.4


def porta_palizzata():
    """La porta della palizzata vista di fronte: due pali alti con la testa
    di drago intagliata e l'architrave; sotto si passa (il vano e' vuoto)."""
    w, h = px(6.0), px(4.6)
    t = Tela(w, h)
    for x in (0, w - 5):
        t.rett((x, 6, x + 4, h - 1), TRONCO[1])
        t.rett((x, 6, x, h - 1), TRONCO[2])
        t.rett((x + 4, 6, x + 4, h - 1), TRONCO[0])
    t.rett((0, 6, w - 1, 10), TRONCO[2])               # architrave
    t.rett((0, 10, w - 1, 11), TRONCO[0])
    for x in range(3, w - 3, 4):
        t.punto((x, 8), RUNA)                          # intaglio dipinto
    for x0, verso in ((0, -1), (w - 5, 1)):            # teste di drago
        cx = x0 + 2
        t.pol([(cx - 2, 6), (cx - 1, 1), (cx + 2, 0), (cx + 2, 3), (cx + 1, 6)], TRONCO[1])
        t.punto((cx + verso, 2), RUNA)
    t.rett((2, 5, w - 3, 6), NEVE[1])                  # neve sull'architrave
    return t.chiudi(), 4.6


def pietra_runica():
    """La pietra runica: una lastra alta dalla cima tonda e un po' storta, col
    nastro del serpente che ne segue il profilo (due righe rosse e le rune
    incise fra l'una e l'altra), la testa in basso a sinistra, e nel mezzo
    una croce a nodo incisa, come a Jelling. La prima versione, piccola e
    dritta, sembrava una "H" su una lapide (tua foto del 25/09 notte)."""
    from scipy import ndimage
    w, h = px(2.6), px(4.0)
    rnd = random.Random(11)
    yy, xx = np.mgrid[0:h, 0:w]
    cx = (w - 1) / 2 - 0.4
    # la sagoma: un rettangolo con la cima a semiellisse, piu' alta a sinistra
    top = 7.0
    dentro = (np.abs(xx - cx) <= w / 2 - 0.6) & (yy >= 0)
    cima = yy < top
    ell = ((xx - cx) / (w / 2 - 0.4)) ** 2 + ((yy - top) / (top + 0.3 - (xx - cx) * 0.12)) ** 2 <= 1
    dentro &= ~cima | ell
    dist = ndimage.distance_transform_edt(np.pad(dentro, 1))[1:-1, 1:-1]
    a = np.zeros((h, w, 4), np.uint8)
    for y in range(h):
        for x in range(w):
            if not dentro[y, x]:
                continue
            k = 3 if x < cx - 3 else (1 if x > cx + 3 else 2)
            if rnd.random() < 0.1:
                k = max(0, k - 1)
            a[y, x] = PIETRA_N[k] + (255,)
    base = h - 5                                      # sotto il nastro si apre
    riga = lambda d0: (dist > d0 - 0.5) & (dist <= d0 + 0.5) & (yy < base)
    esterna, interna, mezzo = riga(2.0), riga(4.2), riga(3.1)
    a[esterna] = RUNA + (255,)
    a[interna] = RUNA + (255,)
    # le rune fra le due righe: tacche scure a passo irregolare
    for y in range(h):
        for x in range(w):
            if mezzo[y, x] and not (esterna[y, x] or interna[y, x]) and rnd.random() < 0.45:
                a[y, x] = PIETRA_N[0] + (255,)
    # la testa del serpente in basso a sinistra, la coda che si chiude a destra
    for x, y in ((1, base), (2, base), (3, base), (2, base + 1), (3, base + 1), (4, base + 1)):
        a[y, x] = RUNA + (255,)
    a[base, 2] = (240, 220, 160, 255)
    for x, y in ((w - 3, base), (w - 4, base + 1), (w - 5, base + 1)):
        a[y, x] = RUNA + (255,)
    # la croce a nodo incisa nel campo
    mx, my = int(round(cx)), 11
    for y in range(my - 3, my + 7):
        a[y, mx] = PIETRA_N[0] + (255,)
    for x in range(mx - 2, mx + 3):
        a[my, x] = PIETRA_N[0] + (255,)
    for dx, dy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        a[my + dy, mx + dx] = PIETRA_N[0] + (255,)
    # neve sulla cima e al piede
    for y in range(h):
        for x in range(w):
            if dentro[y, x] and y < 3 and dist[y, x] < 3.5:
                a[y, x] = NEVE[1 if x < cx else 0] + (255,)
    a[h - 1, :] = NEVE[0] + (255,)
    a[h - 1, :, 3] = np.where(dentro[h - 1], 255, 0)
    t = Tela(w, h)
    t.im = Image.fromarray(a)
    return t.chiudi(), 4.0


def pietra_ritta(seme):
    """Una pietra in piedi, grezza: il cerchio del thing, la nave di pietre."""
    rnd = random.Random(seme)
    alto = 1.2 + rnd.random() * 0.6
    w, h = px(0.8), px(alto)
    t = Tela(w, h)
    t.pol([(0, h - 1), (1, 2), (w // 2, 0), (w - 1, 3), (w - 1, h - 1)], PIETRA_N[2])
    t.rett((w // 2 + 1, 2, w - 1, h - 1), PIETRA_N[1])
    t.punto((1, rnd.randrange(3, h - 2)), PIETRA_N[3])
    t.rett((1, 0, w - 2, 1), NEVE[2])
    return t.chiudi(), round(alto, 2)


def insegna_corno():
    """L'insegna delle sale dell'idromele del fiordo: al braccio di un palo
    uno scudo tondo (azzurro e bianco, i colori del borgo) col corno da bere
    di traverso, bianco con la bocca d'ottone."""
    w, h = 18, px(3.4)
    t = Tela(w, h)
    t.rett((1, 1, 2, h - 1), TRONCO[1])
    t.rett((1, 1, 16, 2), TRONCO[0])                  # braccio
    t.rett((9, 3, 9, 3), (92, 94, 104))              # la catena
    t.d.ellipse((3, 4, 16, 17), fill=(236, 232, 218, 255))          # il bordo chiaro
    t.d.ellipse((4, 5, 15, 16), fill=(48, 78, 152, 255))            # lo scudo azzurro
    corno = [(5, 13), (6, 12), (7, 12), (8, 11), (9, 10), (10, 9), (11, 8), (12, 7)]
    for x, y in corno:                                # il corno, di traverso, col suo scuro
        t.rett((x, y + 2, x + 1, y + 2), (70, 50, 40))
    for x, y in corno:
        t.rett((x, y, x + 1, y + 1), (240, 228, 196))
    t.rett((12, 5, 14, 7), (226, 176, 64))            # la bocca d'ottone
    t.punto((13, 6), (150, 106, 30))
    t.rett((4, 14, 5, 14), (120, 96, 70))             # la punta
    return t.chiudi(), 3.4


def focolare_lungo():
    """Il focolare lungo in mezzo alla sala: un letto di braci fra due file di
    pietre. Le fiamme vive le mette fuochi.js (i "ritocchi" di mappe.json)."""
    w, h = px(4.6), px(1.0)
    t = Tela(w, h)
    t.rett((0, 1, w - 1, h - 1), PIETRA_N[1])
    t.rett((2, 2, w - 3, h - 3), (70, 30, 20))         # le braci
    rnd = random.Random(8)
    for _ in range(18):
        x, y = rnd.randrange(3, w - 3), rnd.randrange(2, h - 2)
        t.punto((x, y), rnd.choice([(220, 90, 30), (250, 160, 50), (150, 50, 24)]))
    for x in range(0, w, 3):                           # le pietre del bordo
        t.rett((x, 0, x + 1, 1), PIETRA_N[2])
        t.rett((x, h - 2, x + 1, h - 1), PIETRA_N[0])
    return t.chiudi(), 1.0


def scudo_parete(colori, seme):
    """Uno scudo tondo appeso alla parete: due colori a spicchi, l'umbone di
    ferro al centro, il bordo di cuoio."""
    s = 11
    t = Tela(s, s)
    a, b = colori
    t.d.ellipse((0, 0, s - 1, s - 1), fill=TRONCO[0] + (255,))
    t.d.ellipse((1, 1, s - 2, s - 2), fill=a + (255,))
    inizio = [0, 45, 90][seme % 3]
    for k in range(0, 360, 90):
        t.d.pieslice((1, 1, s - 2, s - 2), inizio + k, inizio + k + 45, fill=b + (255,))
    t.rett((4, 4, 6, 6), (150, 158, 172))
    t.punto((4, 4), (206, 212, 220))
    return t.chiudi(), 1.4


def palo_sala():
    """Un palo della sala, intagliato: fasce di intreccio e in cima la testa
    di drago che regge la trave."""
    w, h = 8, px(3.8)
    t = Tela(w, h)
    t.rett((2, 4, 5, h - 1), TRONCO[1])
    t.rett((2, 4, 2, h - 1), TRONCO[2])
    for y in range(8, h - 3, 6):                       # intreccio
        for k in range(3):
            t.punto((2 + (y // 2 + k) % 4, y + k), TRONCO[0])
    t.pol([(0, 5), (2, 1), (6, 0), (7, 3), (5, 5)], TRONCO[2])   # la testa
    t.punto((5, 2), RUNA)
    t.rett((1, h - 2, 6, h - 1), TRONCO[0])
    return t.chiudi(), 3.8


def seggio_alto():
    """Il seggio alto del jarl: una panca larga con lo schienale, due pali
    intagliati coi draghi ai lati e una pelle d'orso sul sedile."""
    w, h = 18, px(2.8)
    t = Tela(w, h)
    for x in (0, w - 3):                               # i pali
        t.rett((x, 3, x + 2, h - 1), TRONCO[1])
        t.pol([(x, 3), (x + 1, 0), (x + 3, 1), (x + 2, 3)], TRONCO[2])
        t.punto((x + 1, 1), RUNA)
    t.rett((3, 6, w - 4, 11), TRONCO[0])               # lo schienale
    for x in range(4, w - 4, 3):
        t.rett((x, 7, x, 10), TRONCO[2])
    t.rett((3, 12, w - 4, 14), TRONCO[1])              # il sedile
    t.rett((4, 11, w - 5, 13), (104, 76, 50))          # la pelle
    t.punto((5, 11), (140, 104, 70))
    t.rett((3, 15, 4, h - 1), TRONCO[0])
    t.rett((w - 5, 15, w - 4, h - 1), TRONCO[0])
    return t.chiudi(), 2.8


def idolo():
    """Un idolo di legno dello hof: un palo con la faccia intagliata (un occhio
    solo, la barba), le braccia in rilievo e l'elmo."""
    w, h = 10, px(3.4)
    t = Tela(w, h)
    t.rett((2, 2, 7, h - 1), TRONCO[2])
    t.rett((6, 2, 7, h - 1), TRONCO[1])
    t.rett((2, 1, 7, 3), (150, 158, 172))              # l'elmo
    t.punto((4, 5), (30, 20, 16))                      # l'occhio
    t.rett((6, 5, 6, 5), TRONCO[0])                    # l'occhio che non c'e'
    t.rett((3, 7, 6, 11), (200, 196, 180))             # la barba
    t.rett((1, 12, 2, 18), TRONCO[1])                  # le braccia
    t.rett((7, 12, 8, 18), TRONCO[1])
    t.rett((3, 14, 6, 14), RUNA)                       # la cintura dipinta
    t.rett((1, h - 2, 8, h - 1), TRONCO[0])
    return t.chiudi(), 3.4


def tumulo():
    """Un tumulo sotto la neve, con qualche pietra che spunta."""
    w, h = px(5.0), px(1.7)
    t = Tela(w, h)
    t.d.ellipse((0, 1, w - 1, 2 * h - 2), fill=NEVE[1] + (255,))
    t.d.ellipse((w // 2, 3, w - 2, 2 * h - 3), fill=NEVE[0] + (255,))
    t.d.ellipse((3, 2, w // 2, h), fill=NEVE[2] + (255,))
    rnd = random.Random(3)
    for _ in range(6):
        x, y = rnd.randrange(4, w - 5), rnd.randrange(h // 2, h - 2)
        t.rett((x, y, x + 1, y), PIETRA_N[1])
    a = np.asarray(t.im).copy()
    a[h:, :, 3] = 0                                   # solo la cupola
    t.im = Image.fromarray(a)
    return t.chiudi(), 1.7


def rastrelliera_pesce():
    """La rastrelliera del pesce a seccare: due cavalletti di pali, tre
    traverse, e i merluzzi appesi a coppie."""
    w, h = px(4.2), px(2.4)
    t = Tela(w, h)
    for x in (1, w - 4):                               # cavalletti
        t.pol([(x, h - 1), (x + 1, 0), (x + 2, h - 1)], TRONCO[1])
    rnd = random.Random(5)
    for y in (2, 7, 12):
        t.rett((1, y, w - 2, y), TRONCO[0])
        for x in range(4, w - 5, 3):
            if rnd.random() < 0.8:
                lung = rnd.randrange(3, 6)
                t.rett((x, y + 1, x + 1, y + lung), PESCE[rnd.randrange(3)])
                t.punto((x, y + lung), PESCE[0])
    return t.chiudi(), 2.4


def tile_assi(variante):
    """Una tile di terreno 64x64 di assi di legno (le strade del fiordo, che
    il gioco disegna col terreno 'pietra'): assi orizzontali di tre toni, le
    fughe scure, qualche chiodo, un velo di neve negli angoli."""
    rnd = random.Random(40 + variante)
    a = np.zeros((64, 64, 3), np.uint8)
    y = 0
    while y < 64:
        alta = 8        # file alte uguali in tutte le varianti: le assi continuano
        tono = np.array(TRONCO[rnd.choice((1, 2, 2, 3))], float)
        for yy in range(y, min(64, y + alta)):
            for x in range(64):
                v = rnd.uniform(-10, 10)
                a[yy, x] = np.clip(tono + v, 0, 255)
        a[min(63, y + alta - 1), :] = TRONCO[0]       # fuga
        taglio = rnd.randrange(8, 56)
        a[y:min(64, y + alta), taglio] = TRONCO[0]    # giunto fra due assi
        for x in (taglio - 2, taglio + 2):
            a[min(63, y + alta // 2 - 1), x] = (40, 34, 30)    # chiodi
        y += alta
    for _ in range(40):                                # neve fra le fughe
        x, yy = rnd.randrange(64), rnd.randrange(64)
        a[yy, x] = NEVE[rnd.randrange(3)]
    return Image.fromarray(a)


def pezzi():
    """[(nomi, immagine, altezza in unita')], come disegna_pezzi.pezzi()."""
    return [
        (['palo_palizzata_a'], *palo(3.4, 1)),
        (['palo_palizzata_b'], *palo(3.1, 2)),
        (['palo_palizzata_c'], *palo(3.6, 3)),
        (['torretta_legno'], *torretta()),
        (['porta_palizzata'], *porta_palizzata()),
        (['pietra_runica'], *pietra_runica()),
        (['pietra_ritta_a'], *pietra_ritta(1)),
        (['pietra_ritta_b'], *pietra_ritta(2)),
        (['pietra_ritta_c'], *pietra_ritta(3)),
        (['tumulo'], *tumulo()),
        (['insegna_corno'], *insegna_corno()),
        (['focolare_lungo'], *focolare_lungo()),
        (['scudo_parete_a'], *scudo_parete(((48, 78, 152), (236, 232, 218)), 0)),
        (['scudo_parete_b'], *scudo_parete(((226, 176, 64), (40, 34, 30)), 1)),
        (['scudo_parete_c'], *scudo_parete(((60, 120, 70), (236, 232, 218)), 2)),
        (['palo_sala'], *palo_sala()),
        (['seggio_alto'], *seggio_alto()),
        (['idolo'], *idolo()),
        (['rastrelliera_pesce'], *rastrelliera_pesce()),
    ]


def main():
    fila = pezzi()
    S = 4
    W = sum(im.width * S + 8 for _, im, _ in fila) + 8
    H = max(im.height for _, im, _ in fila) * S + 16
    o = Image.new('RGBA', (W + 4 * 64 + 40, max(H, 80)), (90, 104, 120, 255))
    x = 8
    for _, im, _ in fila:
        g = im.resize((im.width * S, im.height * S), Image.NEAREST)
        o.alpha_composite(g, (x, H - 8 - g.height))
        x += g.width + 8
    for v in range(4):
        o.paste(tile_assi(v), (x + v * 66, 8))
    dest = os.path.join(PROVINI, 'pezzi_nord.png')
    os.makedirs(PROVINI, exist_ok=True)
    o.save(dest)
    print(dest, o.size)


if __name__ == '__main__':
    main()
