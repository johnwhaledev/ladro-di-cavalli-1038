#!/usr/bin/env python3
"""
ripulisci_nano.py — porta un'immagine generata al formato del gioco.

Due problemi che i generatori danno sempre, e che a occhio non si vedono:

1. il "fondo trasparente" NON e' trasparente: la scacchiera e' DISEGNATA
   dentro l'immagine (alfa 255 ovunque). Va tolta davvero, e va tolta solo
   fuori dall'oggetto, senza bucare i grigi del soggetto.
2. l'immagine e' pixel art ingrandita di un fattore non dichiarato. Va
   trovato quel fattore e ridotta, altrimenti ogni pixel d'arte diventa
   venti pixel di atlante.

Uso:
    python3 ripulisci_nano.py src/nano/casa_giorno.png out/casa.png
    python3 ripulisci_nano.py --coppia giorno.png notte.png out/casa
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage


def pulisci_isole(m, minimo):
    """Via i coriandoli: chiazze isolate piu' piccole di `minimo` pixel.
    Sono il residuo del rumore della scacchiera, e a schermo sembrano
    sporco intorno allo sprite."""
    lab, n = ndimage.label(m)
    if n == 0:
        return m
    dim = np.bincount(lab.ravel())
    dim[0] = 0
    return np.isin(lab, np.flatnonzero(dim >= minimo))


def scacchiera(rgb, tol=26):
    """
    Maschera del fondo a scacchi. Non basta "questo colore e' grigio":
    si prendono i due colori che occupano gli angoli, si tiene cio' che
    somiglia a uno dei due, e poi si riempie DAL BORDO — cosi' un grigio
    identico dentro l'oggetto (una pietra, un'ombra) resta al suo posto.
    """
    h, w = rgb.shape[:2]
    # Il primo tentativo cercava i due colori esatti degli angoli con una
    # tolleranza: non regge, perche' la scacchiera ha rumore e i due grigi
    # non sono mai identici a se stessi. Quello che invece e' sempre vero:
    # la scacchiera e' ACROMATICA (R=G=B) e il soggetto no. Quindi si prende
    # la saturazione quasi nulla e si riempie dal bordo — le pietre grigie
    # della casa restano, perche' non toccano il bordo.
    mx = rgb.max(axis=2).astype(np.float32)
    mn = rgb.min(axis=2).astype(np.float32)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    # e CHIARA (30/09): il fondo e' bianco o grigio chiaro; il contorno scuro
    # e' acromatico anche lui, e senza questa soglia il riempimento lo
    # attraversava e si mangiava i grigi dentro (gli scafi grigio-argento
    # sparivano, "le barche sembrano affondate"; i buchi nelle case)
    simile = (sat < 0.10) & (mx > 170)
    # riempimento dal bordo dentro la sola area "simile"
    lab, _ = ndimage.label(simile)
    bordo = set(lab[0].tolist()) | set(lab[-1].tolist()) | \
            set(lab[:, 0].tolist()) | set(lab[:, -1].tolist())
    bordo.discard(0)
    return np.isin(lab, list(bordo))


def passo(gray, mn=3, mx=32):
    """
    Fattore di ingrandimento: per ogni candidato si campiona il centro di
    ogni cella, si rigonfia e si misura l'errore. Vince quello che ricostruisce
    l'immagine meglio — e' il modo diretto di chiedere "di quanto e' scalata?".
    """
    h, w = gray.shape
    err = {}
    for s in range(mn, mx + 1):
        hh, ww = h // s, w // s
        if hh < 8 or ww < 8:
            continue
        cen = gray[s // 2::s, s // 2::s][:hh, :ww]
        ric = np.kron(cen, np.ones((s, s)))[:h, :w]
        err[s] = float(np.abs(gray[:ric.shape[0], :ric.shape[1]] - ric).mean())
    if not err:
        return 1, 0.0
    # NON si prende l'errore minimo: a scala 2 o 3 l'errore e' sempre basso
    # perche' si sta quasi copiando l'immagine. La scala vera e' la PIU'
    # GRANDE che ricostruisce ancora bene. Al primo giro questo errore mi
    # ha fatto ridurre di 3 invece che di 20.
    emin = min(err.values())
    soglia = max(emin * 1.6, 0.8)
    buoni = [s for s, e in err.items() if e <= soglia]
    best = max(buoni) if buoni else min(err, key=err.get)
    return best, err[best]


def ripulisci(path, scala=None, taglia=True):
    im = Image.open(path).convert('RGBA')
    rgb = np.asarray(im)[..., :3]
    fondo = scacchiera(rgb)
    a = np.asarray(im).copy()
    a[..., 3] = np.where(fondo, 0, 255)
    g = np.asarray(Image.fromarray(a, 'RGBA').convert('L')).astype(np.float32)
    s, err = (scala, 0.0) if scala else passo(g)
    # riduzione per campionamento del centro cella: nessuna interpolazione
    small = Image.fromarray(a, 'RGBA').resize(
        (a.shape[1] // s, a.shape[0] // s), Image.NEAREST)
    arr = np.asarray(small).copy()
    arr[..., 3] = np.where(arr[..., 3] > 128, 255, 0)
    arr[..., 3] = pulisci_isole(arr[..., 3] > 0, 6) * 255
    out = Image.fromarray(arr, 'RGBA')
    if not taglia:
        return out, s, err
    bb = out.getbbox()
    return (out.crop(bb) if bb else out), s, err


def sottrai(giorno, notte):
    """L'overlay notturno come DIFFERENZA fra le due immagini: registrazione
    perfetta per costruzione, cosa che chiedendola al generatore non si ha."""
    A = np.asarray(giorno).astype(np.int16)
    B = np.asarray(notte).astype(np.int16)
    if A.shape != B.shape:
        return None
    d = np.abs(B[..., :3] - A[..., :3]).sum(axis=2)
    m = (d > 34) & (B[..., 3] > 0)
    m = ndimage.binary_closing(m, np.ones((2, 2)))
    m = pulisci_isole(m, 4)
    o = np.zeros_like(B, dtype=np.uint8)
    o[..., :3] = B[..., :3]
    o[..., 3] = np.where(m, 255, 0)
    return Image.fromarray(o, 'RGBA')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('files', nargs='+')
    ap.add_argument('--coppia', action='store_true')
    ap.add_argument('--scala', type=int)
    a = ap.parse_args()
    if a.coppia:
        # I due fotogrammi vanno tagliati con lo STESSO rettangolo, o la
        # differenza non si puo' nemmeno calcolare: al primo giro uscivano
        # 246x243 e 244x248, disallineati di qualche pixel.
        g, s1, e1 = ripulisci(a.files[0], a.scala, taglia=False)
        n, s2, e2 = ripulisci(a.files[1], a.scala or s1, taglia=False)
        bb1, bb2 = g.getbbox(), n.getbbox()
        if bb1 and bb2:
            bb = (min(bb1[0], bb2[0]), min(bb1[1], bb2[1]),
                  max(bb1[2], bb2[2]), max(bb1[3], bb2[3]))
            g, n = g.crop(bb), n.crop(bb)
        base = a.files[2]
        g.save(base + '_giorno.png')
        n.save(base + '_notte.png')
        ov = sottrai(g, n)
        if ov:
            ov.save(base + '_luci.png')
        print(f'scala {s1} · giorno {g.size} · notte {n.size} · '
              f'overlay luci {"ok" if ov else "dimensioni diverse"}')
    else:
        im, s, e = ripulisci(a.files[0], a.scala)
        im.save(a.files[1])
        print(f'{os.path.basename(a.files[0])}: scala {s}, errore {e:.1f} → '
              f'{im.size} → {a.files[1]}')


if __name__ == '__main__':
    main()
