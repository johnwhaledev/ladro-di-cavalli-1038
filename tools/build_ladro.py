#!/usr/bin/env python3
"""
build_ladro.py — compone il protagonista a partire dai layer del pool.

Il principio e' quello di `mashup_character.py` del tuo toolkit: il layer
`main` (il corpo, cioe' l'identita') resta SEMPRE quello del ladro; a cambiare
sono solo `hands` e `slash`, cioe' le mani che impugnano e l'effetto del colpo.
Cosi' il protagonista e' uno solo e riconoscibile — cappuccio e mantello — ma
mostra l'arma che porta.

Per il cavallo il ragionamento si ribalta: sotto va il layer `Horse` di
MiniHorseMan, sopra il corpo del ladro alzato sulla sella. Lo stesso per
l'asino (`ladro_asino`, 13/10): sotto BanAsino del character studio.

Produce:
  _src/ladro/<variante>.png  strip di frame, stesso formato del pool
  _src/ladro/_manifest.json  animazioni per variante
  out/provino_ladro.png      provino da guardare prima di integrare
"""
import json
import os
import sys

import numpy as np
from PIL import Image

from percorsi import PROVINI, ROOT, sorgente  # noqa: E402

# il contorno si rigenera con la funzione del character studio, la stessa
# verificata al 100% sui contorni disegnati a mano dei villani
sys.path.insert(0, os.path.join(os.path.dirname(ROOT), 'star_drifter',
                                'generators', 'character_studio'))
from generate_outline import generate_outline_array  # noqa: E402

SRC = sorgente('layers')
OUT = sorgente('ladro')

CORPO = 'MiniThief'
# ordine di impilamento: il primo sta sotto
ORDINE = ['Layer1', 'main', 'hands', 'outline', 'slash']

# arma → chi presta le mani e l'effetto durante l'attacco
ARMI = {
    'spada':    'MiniSwordMan',
    'lancia':   'MiniSpearMan',
    'scudo':    'MiniShieldMan',
    'alabarda': 'MiniHalberdMan',
    'arco':     'MiniArcher',
    'balestra': 'MiniCrossBowMan',
    'pugnale':  None,        # il ladro ha gia' il suo
    # la sciabola dell'emiro (14/10, tua idea): le mani dello spadaccino con
    # la lama ridipinta d'oro (ORO); la "scimitarra" del character studio e'
    # la stessa spada, pixel per pixel
    'sciabola_emiro': 'MiniSwordMan',
}

# arma -> i colori del donatore da ridipingere: l'acciaio (due azzurri) e il
# bianco del filo diventano oro; il bianco del fendente un lampo dorato.
# Incarnato e impugnatura (i marroni) restano
ORO = {
    (140, 173, 198): (206, 150, 38),
    (181, 214, 222): (246, 204, 92),
    (255, 255, 255): (255, 240, 170),
}
TINTE = {'sciabola_emiro': ORO}


def ridipinto(im, tinta):
    """Il layer con i colori di `tinta` sostituiti, pixel per pixel."""
    if im is None or not tinta:
        return im
    a = np.array(im)
    for da, a_ in tinta.items():
        sel = (a[..., 3] > 0) & np.all(a[..., :3] == da, axis=-1)
        a[sel, :3] = a_
    return Image.fromarray(a)


def manifest(nome):
    p = os.path.join(SRC, f'{nome}__manifest.json')
    return json.load(open(p)) if os.path.exists(p) else None


def layer(nome, lay):
    p = os.path.join(SRC, f'{nome}__{lay}.png')
    if not os.path.exists(p):
        return None
    return Image.open(p).convert('RGBA')


def frames_of(man, anim):
    for a in man.get('animations', []):
        if a.get('name') != anim:
            continue
        if 'from' in a and 'to' in a:
            return list(range(a['from'], a['to'] + 1))
        if isinstance(a.get('frames'), list):
            return list(a['frames'])
    return None


def cella(img, i, fw, fh):
    """Un frame di una strip; fuori range torna trasparente."""
    if img is None or (i + 1) * fw > img.width:
        return Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
    return img.crop((i * fw, 0, (i + 1) * fw, fh))


def componi(fw, fh, pezzi):
    """pezzi: lista di (immagine_frame, dx, dy) dal basso verso l'alto."""
    out = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
    for im, dx, dy in pezzi:
        if im is None:
            continue
        if dx or dy:
            spost = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
            spost.alpha_composite(im, (dx, dy))
            im = spost
        out.alpha_composite(im)
    return out


def contornato(frame):
    """Il frame composto col contorno rifatto sulla SUA sagoma. Il layer
    outline del MiniHorseMan contorna cavallo, cavaliere e lancia insieme:
    tolto il cavaliere, il suo contorno restava sospeso sopra il cavallo."""
    _, _, anello = generate_outline_array([np.asarray(frame)])
    out = frame.copy()
    out.alpha_composite(Image.fromarray(anello))
    return out


def costruisci():
    os.makedirs(OUT, exist_ok=True)
    mC = manifest(CORPO)
    fw, fh = mC['frame_width'], mC['frame_height']
    layC = {l: layer(CORPO, l) for l in ORDINE}

    # animazioni del corpo che il protagonista tiene sempre sue
    proprie = ['idle', 'walk', 'run', 'steal', 'hit', 'death', 'idle2', 'jump']
    manifest_out = {}

    for arma, donatore in ARMI.items():
        mD = manifest(donatore) if donatore else None
        layD = ({l: ridipinto(layer(donatore, l), TINTE.get(arma)) for l in ORDINE}
                if donatore else {})

        strip, anims, cur = [], {}, 0
        for nome_anim in proprie + ['attack']:
            idx = frames_of(mC, nome_anim)
            if not idx:
                continue
            # l'attacco: corpo del ladro, mani e lampo del donatore
            innesto = (nome_anim == 'attack' and donatore)
            idxD = frames_of(mD, 'attack') if innesto else None
            n = len(idx) if not innesto else min(len(idx), len(idxD))
            for k in range(n):
                i = idx[k]
                pezzi = []
                for l in ORDINE:
                    da_donatore = innesto and l in ('hands', 'slash')
                    if da_donatore:
                        pezzi.append((cella(layD.get(l), idxD[k], fw, fh), 0, 0))
                    else:
                        pezzi.append((cella(layC.get(l), i, fw, fh), 0, 0))
                strip.append(componi(fw, fh, pezzi))
            anims[nome_anim] = {'from': cur, 'to': cur + n - 1}
            cur += n

        img = Image.new('RGBA', (fw * len(strip), fh), (0, 0, 0, 0))
        for i, f in enumerate(strip):
            img.alpha_composite(f, (i * fw, 0))
        img.save(os.path.join(OUT, f'ladro_{arma}.png'))
        manifest_out[f'ladro_{arma}'] = {
            'frame_width': fw, 'frame_height': fh,
            'frame_count': len(strip),
            'animations': [{'name': k, **v} for k, v in anims.items()],
        }

    # --- variante a cavallo: cavallo sotto, ladro sopra, alzato sulla sella
    mH = manifest('MiniHorseMan')
    fwH, fhH = mH['frame_width'], mH['frame_height']
    horse = layer('MiniHorseMan', 'Horse')
    # Layer1 del cavaliere e' la sua lancia: va tolta, altrimenti spunta
    # sopra la testa del ladro un'arma che lui non ha. Il suo outline pure:
    # contorna anche il cavaliere, si rifa' sulla sagoma (contornato)
    ALZATA = -7          # il ladro va spostato in su, in sella

    # Solo le andature. 'hit' e 'death' a cavallo non si possono comporre:
    # il cavallo si accascia con la sua animazione mentre il corpo del ladro
    # usa la propria, e il risultato e' un uomo sospeso sopra un cavallo morto.
    # Nel gioco chi viene abbattuto in sella scende, e torna lo sprite a piedi.
    # L'asino (13/10, src/bestie.js) e' BanAsino del character studio, sullo
    # stesso scheletro di fotogrammi del cavallo: sotto vanno il suo Horse e il
    # suo costume, sopra il ladro alla stessa alzata (tua scelta: -7).
    # Cammello e dromedario (13/10, la Costa): il costume sta sotto il Horse,
    # e il ladro siede sopra la gobba, due pixel piu' su (tua scelta: -9)
    SELLE = (('ladro_cavallo', 'MiniHorseMan', ['Horse'], ALZATA),
             ('ladro_asino', 'BanAsino', ['Horse', 'costume'], ALZATA),
             ('ladro_cammello', 'SarCammello', ['costume', 'Horse'], -9),
             ('ladro_dromedario', 'SarDromedario', ['costume', 'Horse'], -9))
    for nome_sella, bestia, strati, alzata in SELLE:
        mB = manifest(bestia)
        layB = [layer(bestia, s) for s in strati]
        strip, anims, cur = [], {}, 0
        for nome_anim in ['idle', 'walk', 'run']:
            idxH = frames_of(mB, nome_anim) or frames_of(mB, 'walk')
            idxC = frames_of(mC, nome_anim) or frames_of(mC, 'idle')
            if not idxH or not idxC:
                continue
            n = max(len(idxH), len(idxC))
            for k in range(n):
                ih, ic = idxH[k % len(idxH)], idxC[k % len(idxC)]
                pezzi = [(cella(lb, ih, fwH, fhH), 0, 0) for lb in layB] + [
                    (cella(layC.get('main'), ic, fw, fh), 0, alzata),
                    (cella(layC.get('hands'), ic, fw, fh), 0, alzata),
                ]
                strip.append(contornato(componi(fwH, fhH, pezzi)))
            anims[nome_anim] = {'from': cur, 'to': cur + n - 1}
            cur += n
        for a in ('attack', 'hit', 'death'):
            anims[a] = dict(anims.get('idle', {'from': 0, 'to': 0}))

        img = Image.new('RGBA', (fwH * len(strip), fhH), (0, 0, 0, 0))
        for i, f in enumerate(strip):
            img.alpha_composite(f, (i * fwH, 0))
        img.save(os.path.join(OUT, f'{nome_sella}.png'))
        manifest_out[nome_sella] = {
            'frame_width': fwH, 'frame_height': fhH, 'frame_count': len(strip),
            'animations': [{'name': k, **v} for k, v in anims.items()],
        }

    # --- il cavallo da solo: serve per la disarcionata. Quando la bestia cade
    # non si puo' mostrare lo sprite composto (il ladro cadrebbe insieme a lei
    # incollato in sella): cade il cavallo, e il ladro e' un'entita' a parte
    # che rotola a terra e si rialza.
    strip, anims, cur = [], {}, 0
    for nome_anim in ['idle', 'walk', 'run', 'death']:
        idxH = frames_of(mH, nome_anim) or frames_of(mH, 'walk')
        if not idxH:
            continue
        for ih in idxH:
            strip.append(contornato(cella(horse, ih, fwH, fhH)))
        anims[nome_anim] = {'from': cur, 'to': cur + len(idxH) - 1}
        cur += len(idxH)
    for a in ('attack', 'hit'):
        anims[a] = dict(anims.get('idle', {'from': 0, 'to': 0}))
    img = Image.new('RGBA', (fwH * len(strip), fhH), (0, 0, 0, 0))
    for i, f in enumerate(strip):
        img.alpha_composite(f, (i * fwH, 0))
    img.save(os.path.join(OUT, 'cavallo_mini.png'))
    manifest_out['cavallo_mini'] = {
        'frame_width': fwH, 'frame_height': fhH, 'frame_count': len(strip),
        'animations': [{'name': k, **v} for k, v in anims.items()],
    }

    json.dump(manifest_out, open(os.path.join(OUT, '_manifest.json'), 'w'), indent=1)
    return manifest_out


def provino(man):
    from PIL import ImageDraw
    S = 5
    righe = list(man.items())
    larg = 15
    out = Image.new('RGBA', (larg * 34 * S + 160, len(righe) * 36 * S + 20),
                    (34, 36, 44, 255))
    d = ImageDraw.Draw(out)
    for r, (nome, m) in enumerate(righe):
        img = Image.open(os.path.join(OUT, nome + '.png')).convert('RGBA')
        fw = m['frame_width']
        y = 10 + r * 36 * S
        d.text((6, y + 60), nome.replace('ladro_', ''), fill=(255, 220, 150, 255))
        att = next((a for a in m['animations'] if a['name'] == 'attack'), None)
        cam = next((a for a in m['animations'] if a['name'] == 'walk'), None)
        seq = []
        if cam:
            seq += list(range(cam['from'], min(cam['to'] + 1, cam['from'] + 5)))
        if att:
            seq += list(range(att['from'], min(att['to'] + 1, att['from'] + 8)))
        x = 150
        for i in seq[:larg]:
            f = img.crop((i * fw, 0, (i + 1) * fw, m['frame_height']))
            f = f.resize((f.width * S, f.height * S), Image.NEAREST)
            out.alpha_composite(f, (x, y))
            x += f.width + 4
    out.convert('RGB').save(os.path.join(PROVINI, 'provino_ladro.png'))


if __name__ == '__main__':
    m = costruisci()
    provino(m)
    for k, v in m.items():
        print(f"{k:18} {v['frame_count']:3} frame  " +
              ', '.join(a['name'] for a in v['animations']))
