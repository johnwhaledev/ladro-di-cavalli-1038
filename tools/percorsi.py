#!/usr/bin/env python3
"""
percorsi.py — dove stanno le cose della pipeline, scritto in un posto solo.

I sorgenti (pool Mini, layer, ritagli delle tavole, catalogo, Pixel Crawler)
stanno in `_src/`, fuori da `src/` che e' il codice del gioco: la licenza Mana
Seed vieta di ridistribuire i file sorgente, quindi non devono poter finire in
un repo pubblico insieme al gioco. Gli strumenti sono nati quando tutto stava
in `src/` e `out/`, e quei percorsi sono rimasti scritti anche DENTRO i dati
(`catalogo.json` ha `out/tagli/...`, `mappe.json` ha `src/mini`): `risolvi()`
li traduce, cosi' i json non vanno riscritti.

I ritagli delle tavole viaggiano zippati (`_src/tagli/<tavola>.zip`, 383 file
per tavola): `tagli()` li estrae la prima volta che servono.

`_src/riferimento/<mappa>/` e' l'ultimo atlante del mondo costruito quando
tutti i ritagli c'erano (18/09): `build_atlanti.py` ne eredita i pezzi scelti
il cui ritaglio non e' piu' su disco.
"""
import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '_src')
DIST = os.path.join(ROOT, 'dist')        # atlanti per mappa, da copiare in assets/
PROVINI = os.path.join(ROOT, 'out')      # immagini da guardare, non dati
ASSETS = os.path.join(ROOT, 'assets')
RIFERIMENTO = os.path.join(SRC, 'riferimento')


def sorgente(*parti):
    return os.path.join(SRC, *parti)


def tagli(tavola):
    """Cartella dei ritagli di una tavola, estratta dallo zip se serve."""
    d = sorgente('tagli', tavola)
    z = d + '.zip'
    if not os.path.isdir(d) and os.path.exists(z):
        with zipfile.ZipFile(z) as f:
            f.extractall(sorgente('tagli'))
    return d


def risolvi(rel):
    """Percorso d'epoca ('src/mini', 'out/tagli/<tavola>/...') -> _src/..."""
    if os.path.isabs(rel):
        return rel
    rel = rel.replace('\\', '/')
    if rel.startswith('out/tagli/'):
        tagli(rel.split('/')[2])
    for vecchio in ('src/', 'out/'):
        if rel.startswith(vecchio):
            return sorgente(*rel[len(vecchio):].split('/'))
    return os.path.join(ROOT, rel)
