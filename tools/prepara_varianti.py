#!/usr/bin/env python3
"""
prepara_varianti.py — aggiunge al pool due famiglie di personaggi che non
esistono nel pool originale, in modo che il builder dell'atlas le veda come
personaggi qualunque e non debba sapere nulla di speciale:

  <nome>@rosso   la stessa persona con la divisa dell'altro villaggio
  ladro_<arma>   il protagonista, composto da build_ladro.py

Il rosso non e' una tinta sopra lo sprite: e' un rimpiazzo mirato dei pixel
BLU delle vesti. Incarnato, cuoio, metallo e contorno restano dov'erano,
quindi lo sprite non si spappola e resta leggibile come pixel art.
"""
import json
import os
import shutil

import numpy as np
from PIL import Image

from percorsi import sorgente  # noqa: E402

MINI = sorgente('mini')
LADRO = sorgente('ladro')

GUERRIERI = ['MiniSwordMan', 'MiniSpearMan', 'MiniShieldMan', 'MiniHalberdMan',
             'MiniArcher', 'MiniCrossBowMan', 'MiniOldManWarrior', 'MiniThief',
             'MiniHorseMan',
             # 26/09: le altre fazioni sono gli stessi sprite con altri colori
             # (il clan rivale del fiordo, in rosso)
             'VikSpadaccino', 'VikLanciere', 'VikScudiero', 'VikBerserker',
             'VikCacciatore',
             # 29/09: la Costa saracena (i campi nemici e gli assalti in rosso)
             'SarScimitarra', 'SarLanciere', 'SarScudo', 'SarPredone',
             'PirSciabola', 'PirArpioniere', 'PirCannoniere', 'PirNostromo']


def divisa_rossa(im):
    a = np.asarray(im.convert('RGBA')).astype(np.float32)
    r, g, b, alpha = (a[:, :, 0].copy(), a[:, :, 1].copy(),
                      a[:, :, 2].copy(), a[:, :, 3])
    mx = np.max(a[:, :, :3], axis=2)
    mn = np.min(a[:, :, :3], axis=2)
    d = mx - mn
    h = np.zeros_like(mx)
    nz = d > 1e-3
    i = nz & (mx == r); h[i] = ((g - b)[i] / d[i]) % 6
    i = nz & (mx == g); h[i] = ((b - r)[i] / d[i]) + 2
    i = nz & (mx == b); h[i] = ((r - g)[i] / d[i]) + 4
    h /= 6.0
    sat = np.where(mx > 0, d / np.maximum(mx, 1), 0)
    sel = (alpha > 0) & (h > 0.50) & (h < 0.78) & (sat > 0.20)
    if sel.any():
        R, G, B = r[sel].copy(), g[sel].copy(), b[sel].copy()
        # il canale piu' forte era il blu: passa al rosso, il resto si smorza
        r[sel] = np.minimum(255, B * 1.05)
        g[sel] = G * 0.42 + R * 0.25
        b[sel] = R * 0.50
    out = np.dstack([r, g, b, alpha])
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')


# Il mantello del ladro (29/09). Il protagonista e' l'unico col mantello grigio
# di MiniThief: gli altri ladri del gioco (banditi, bassifondi, sicari) portano
# lo stesso sprite con il mantello marrone (@bruno), e nella Costa saracena il
# protagonista si veste di beige (ladro_<arma>@beige). Si cambiano solo i due
# grigi del mantello; il grigio piu' scuro e' il contorno e resta.
MANTELLO = {(62, 59, 57): 0, (78, 75, 73): 1}
TINTE_MANTELLO = {
    'bruno': [(92, 62, 40), (122, 86, 54)],
    'beige': [(170, 142, 104), (206, 182, 140)],
}


def mantello(im, tinta):
    a = np.array(im.convert('RGBA'))
    for grigio, k in MANTELLO.items():
        sel = (a[..., 3] > 0) & np.all(a[..., :3] == grigio, axis=-1)
        a[sel, :3] = TINTE_MANTELLO[tinta][k]
    return Image.fromarray(a)


def main():
    mans = json.load(open(os.path.join(MINI, '_manifests.json')))
    base = {k: v for k, v in mans.items() if '@' not in k
            and not k.startswith('ladro_')}

    # --- divise rosse
    n_rossi = 0
    for nome in GUERRIERI:
        p = os.path.join(MINI, nome + '.png')
        if nome not in base or not os.path.exists(p):
            continue
        divisa_rossa(Image.open(p)).save(os.path.join(MINI, nome + '@rosso.png'))
        mans[nome + '@rosso'] = base[nome]
        n_rossi += 1

    # --- gli altri ladri: lo stesso sprite col mantello marrone
    mantello(Image.open(os.path.join(MINI, 'MiniThief.png')), 'bruno').save(
        os.path.join(MINI, 'MiniThief@bruno.png'))
    mans['MiniThief@bruno'] = base['MiniThief']

    # --- protagonista, e la sua veste beige della Costa
    n_ladro = 0
    if os.path.isdir(LADRO):
        lm = json.load(open(os.path.join(LADRO, '_manifest.json')))
        for nome, m in lm.items():
            shutil.copy(os.path.join(LADRO, nome + '.png'),
                        os.path.join(MINI, nome + '.png'))
            mans[nome] = m
            mantello(Image.open(os.path.join(LADRO, nome + '.png')), 'beige').save(
                os.path.join(MINI, nome + '@beige.png'))
            mans[nome + '@beige'] = m
            n_ladro += 1

    json.dump(mans, open(os.path.join(MINI, '_manifests.json'), 'w'), indent=0)
    print(f'{n_rossi} divise rosse, {n_ladro} varianti del protagonista, '
          f'{len(mans)} personaggi in tutto')


if __name__ == '__main__':
    main()
