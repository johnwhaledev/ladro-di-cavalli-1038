#!/usr/bin/env python3
"""
prepara_suoni.py — musiche e ambienti registrati, dal sorgente al gioco.

Tua scelta del 08/10 ("BELLISSIMI I SUONI", sul provino out/provino_suoni.html):
le miscele per luogo del provino. I sorgenti stanno in `_src/audio/` (copiati
dal provino, tutti CC0: crediti in CREDITS.md); qui diventano MP3 in
`assets/audio/`, che src/colonna.js suona. L'MP3 perche' lo suona ogni
browser (l'OGG no, su alcuni telefoni e tablet).

- musica: il brano intero, stereo, 96 kbps (si ripete da capo)
- ambiente: un tratto di AMBIENTE secondi, mono, 64 kbps, in loop senza stacco:
  la coda sfuma sulla testa (DISSOLVI secondi), cosi' la fine si attacca
  all'inizio. Un verso raro (l'allocco) sta in un tratto piu' lungo, con
  silenzio intorno: si sente ogni tanto, non di continuo
Il volume dei file resta quello del sorgente: i volumi delle miscele (colonna.js)
sono quelli del provino, scelti su questi file.

Serve PyAV (av), col Python della pipeline:
    python tools/prepara_suoni.py
"""
import os
import sys

import av
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from percorsi import ASSETS, sorgente  # noqa: E402

RATE = 44100
AMBIENTE, DISSOLVI, SALTA = 45.0, 3.0, 2.0     # secondi: il tratto, la sfumatura, l'inizio saltato

# nome nel gioco -> file sorgente (_src/audio/musica/)
MUSICHE = {
    'esplorazione': 'Exploration_0.mp3',           # RandomMind, Medieval: Exploration
    'raccolto': 'harvestseason_2.mp3',             # RandomMind, Medieval: Harvest Season
    'osteria': 'The_Old_Tower_Inn.mp3',            # RandomMind, Medieval: The Old Tower Inn
    'banchetto': 'Kings_Feast_0.mp3',              # RandomMind, Medieval: King's Feast
    'battaglia': 'battle_8.mp3',                   # RandomMind, Medieval: Battle
    'vichinghi': 'viking-march.ogg',               # nightm4re, Viking March
    'deserto': 'desert_loop_0.mp3',                # iamoneabe, Desert Loop
    'marinai': 'oga_jam_menu_music_loopable_0.ogg',  # Thimras, A Sailor's Chant
}

# nome nel gioco -> (id BigSoundBank, durata del tratto in secondi o None)
AMBIENTI = {
    'mercato': ('2728', None), 'alba': ('0222', None), 'campagna': ('0097', None),
    'ruscello': ('0864', None), 'usignolo': ('0315', None), 'vento_alberi': ('0904', None),
    'voci': ('3542', None), 'camino': ('2855', None), 'vento_fischio': ('0147', None),
    'gabbiani': ('2573', None), 'cicale': ('3002', None), 'onde': ('0267', None),
    'remi': ('1514', None), 'cime': ('2443', None), 'sottocoperta': ('0695', None),
    'pioggia': ('0740', None),
    'allocco': ('1763', 30.0),                     # 8,5 s di versi in 30 s
}


def leggi(percorso, mono):
    """Il file intero come (canali, campioni) float a 44,1 kHz."""
    with av.open(percorso) as c:
        res = av.AudioResampler(format='fltp', layout='mono' if mono else 'stereo', rate=RATE)
        parti = []
        for fr in c.decode(c.streams.audio[0]):
            parti += [r.to_ndarray() for r in res.resample(fr)]
        parti += [r.to_ndarray() for r in res.resample(None)]
    return np.concatenate(parti, axis=1)


def scrivi(percorso, a, kbps, mono):
    with av.open(percorso, 'w') as c:
        s = c.add_stream('libmp3lame', rate=RATE)
        s.layout = 'mono' if mono else 'stereo'
        s.bit_rate = kbps * 1000
        for i in range(0, a.shape[1], 1152):
            fr = av.AudioFrame.from_ndarray(np.ascontiguousarray(a[:, i:i + 1152], np.float32),
                                            format='fltp', layout=s.layout.name)
            fr.sample_rate = RATE
            for pk in s.encode(fr):
                c.mux(pk)
        for pk in s.encode(None):
            c.mux(pk)


def in_loop(a, secondi):
    """Un tratto di `secondi` che si ripete senza stacco: la coda (DISSOLVI
    secondi dopo la fine) sfuma sulla testa."""
    a = a[:, int(SALTA * RATE):]
    d = int(DISSOLVI * RATE)
    n = min(int(secondi * RATE), a.shape[1] - d)
    t = np.linspace(0, 1, d)
    testa = a[:, :d] * t + a[:, n:n + d] * (1 - t)
    return np.concatenate([testa, a[:, d:n]], axis=1)


def raro(a, secondi):
    """Un verso raro: tutto il suono, poi silenzio fino a `secondi`."""
    pieno = np.zeros((a.shape[0], int(secondi * RATE)), np.float32)
    pieno[:, :min(a.shape[1], pieno.shape[1])] = a[:, :pieno.shape[1]]
    return pieno


def main():
    for cartella in ('musica', 'ambiente'):
        os.makedirs(os.path.join(ASSETS, 'audio', cartella), exist_ok=True)
    totale = 0
    for nome, f in MUSICHE.items():
        out = os.path.join(ASSETS, 'audio', 'musica', nome + '.mp3')
        a = leggi(sorgente('audio', 'musica', f), False)
        scrivi(out, a, 96, False)
        totale += os.path.getsize(out)
        print(f'musica   {nome:13} {a.shape[1] / RATE:6.1f} s  {os.path.getsize(out) / 1e6:5.2f} MB')
    for nome, (ident, lungo) in AMBIENTI.items():
        out = os.path.join(ASSETS, 'audio', 'ambiente', nome + '.mp3')
        a = leggi(sorgente('audio', 'ambiente', ident + '.ogg'), True)
        a = raro(a, lungo) if lungo else in_loop(a, AMBIENTE)
        scrivi(out, a, 64, True)
        totale += os.path.getsize(out)
        print(f'ambiente {nome:13} {a.shape[1] / RATE:6.1f} s  {os.path.getsize(out) / 1e6:5.2f} MB')
    print(f'totale {totale / 1e6:.1f} MB in assets/audio/')


if __name__ == '__main__':
    main()
