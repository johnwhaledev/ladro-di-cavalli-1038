#!/usr/bin/env python3
"""
sincronizza_layers.py — porta i personaggi del character studio nella pipeline.

Da   star_drifter/generators/character_studio/characters/<Nome>/
         spritesheet.png · manifest.json · layers/<layer>.png
a    _src/mini/<Nome>.png + voce in _src/mini/_manifests.json   (per build_mini)
     _src/layers/<Nome>__<layer>.png + <Nome>__manifest.json     (per build_ladro
                                                                  e build_accessori)

Chi si sincronizza: i personaggi gia' nella pipeline (pool e layer), che si
aggiornano se nello studio sono cambiati, piu' quelli nominati a riga di
comando. I pacchetti nuovi nati da paint NON entrano da soli: il pool finisce
tutto nell'atlante della mappa, e un vichingo di prova non deve comparire nel
borgo. Lo strumento li elenca, e si aggiungono per nome.

Per default dice cosa cambierebbe e non scrive niente.

Il foglio del pool (26/09): i personaggi dipinti in paint hanno i layer nuovi
e lo spritesheet.png ancora quello del personaggio di partenza (i Vik, Ban,
Sar e Pir del 26/09: foglio del 30/07, layer del giorno). Quando un layer e'
piu' recente del foglio, il pool prende i layer visibili composti uno
sull'altro nell'ordine del manifest, non il foglio.

Uso:
    python tools/sincronizza_layers.py                   # solo il resoconto
    python tools/sincronizza_layers.py --scrivi
    python tools/sincronizza_layers.py --scrivi MiniVik_1
Poi la catena: build_ladro -> prepara_varianti -> build_atlanti borgo ->
innesta_nano.
"""
import argparse
import json
import os
import shutil
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from percorsi import ROOT, sorgente  # noqa: E402

STUDIO = os.path.join(os.path.dirname(ROOT), 'star_drifter', 'generators',
                      'character_studio', 'characters')
MINI = sorgente('mini')
LAYERS = sorgente('layers')
# figli della pipeline, non personaggi dello studio: li rifanno build_ladro e
# prepara_varianti
DERIVATI = ('ladro_', 'cavallo_mini')


def uguali(a, b):
    return os.path.exists(b) and open(a, 'rb').read() == open(b, 'rb').read()


def layer_visibili(d):
    """I file dei layer visibili, dal basso in alto (ordine del manifest)."""
    man = json.load(open(os.path.join(d, 'manifest.json'), encoding='utf8'))
    out = []
    for l in sorted(man.get('layers', []), key=lambda l: l.get('index', 0)):
        p = os.path.join(d, 'layers', l['name'].replace(' ', '') + '.png')
        if l.get('visible', True) and os.path.exists(p):
            out.append(p)
    return out


def foglio_vecchio(d):
    """Il foglio e' piu' vecchio dei layer: il pool va composto dai layer.
    Solo per i pacchetti nati da paint: i personaggi di partenza restano col
    loro foglio (MiniVillagerMan ha un layer "faction" del 30/07 che il gioco
    non ha mai usato, e non lo si cambia di nascosto)."""
    man = json.load(open(os.path.join(d, 'manifest.json'), encoding='utf8'))
    if man.get('creato_da') != 'paint':
        return False
    ls = layer_visibili(d)
    foglio = os.path.join(d, 'spritesheet.png')
    # un minuto di margine: i personaggi di partenza hanno foglio e layer
    # salvati nello stesso momento, a pochi millesimi l'uno dall'altro
    return bool(ls) and os.path.getmtime(foglio) + 60 < max(os.path.getmtime(p) for p in ls)


def componi(d, dest):
    """I layer visibili uno sull'altro, su una tela grande quanto il foglio,
    scritti in `dest`. Un layer puo' essere piu' corto del foglio: nel
    MiniArcher di partenza (e quindi in BanArciere) main e costume hanno 30
    fotogrammi su 42, e gli ultimi, del tiro, nel foglio vengono da altri
    personaggi. Dove il layer piu' corto finisce si tengono i fotogrammi del
    foglio, se no il personaggio restava senza corpo."""
    foglio = Image.open(os.path.join(d, 'spritesheet.png')).convert('RGBA')
    out = Image.new('RGBA', foglio.size, (0, 0, 0, 0))
    corto = min(Image.open(p).size[0] for p in layer_visibili(d))
    if corto < foglio.size[0]:
        out.paste(foglio.crop((corto, 0, foglio.size[0], foglio.size[1])), (corto, 0))
    for p in layer_visibili(d):
        im = Image.open(p).convert('RGBA')
        tela = Image.new('RGBA', out.size, (0, 0, 0, 0))
        tela.paste(im, (0, 0))
        out = Image.alpha_composite(out, tela)
    out.save(dest)


def diverso_da_composto(d, dest):
    if not os.path.exists(dest):
        return True
    tmp = dest + '.tmp.png'
    componi(d, tmp)
    diverso = open(tmp, 'rb').read() != open(dest, 'rb').read()
    os.remove(tmp)
    return diverso


def copie(nome, d, dove):
    """Coppie (sorgente nello studio, destinazione in _src) di un personaggio.
    `dove` dice quali destinazioni, 'pool' e/o 'layers': sono separate perche'
    MiniVillagerWarrior, per dire, presta solo le mani a build_ladro e nel pool
    non c'e'."""
    out = []
    if 'pool' in dove:
        out.append((os.path.join(d, 'spritesheet.png'),
                    os.path.join(MINI, nome + '.png')))
    if 'layers' in dove:
        out.append((os.path.join(d, 'manifest.json'),
                    os.path.join(LAYERS, f'{nome}__manifest.json')))
        cartella = os.path.join(d, 'layers')
        for f in sorted(os.listdir(cartella)) if os.path.isdir(cartella) else []:
            if f.endswith('.png'):
                # nel pool i layer non hanno spazi: 'Layer 1' e' Layer1.png
                out.append((os.path.join(cartella, f),
                            os.path.join(LAYERS, f'{nome}__{f.replace(" ", "")}')))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('nomi', nargs='*', help='personaggi nuovi da aggiungere')
    ap.add_argument('--scrivi', action='store_true')
    ap.add_argument('--da', default=STUDIO, help='cartella characters dello studio')
    a = ap.parse_args()

    studio = {n for n in os.listdir(a.da)
              if os.path.exists(os.path.join(a.da, n, 'manifest.json'))}
    mans = json.load(open(os.path.join(MINI, '_manifests.json'), encoding='utf8'))
    nel_pool = {n for n in mans if '@' not in n and not n.startswith(DERIVATI)}
    con_layers = {f.split('__')[0] for f in os.listdir(LAYERS)
                  if f.endswith('__manifest.json')}
    mancanti = [n for n in a.nomi if n not in studio]
    if mancanti:
        sys.exit(f'non sono nello studio: {", ".join(mancanti)}')

    scelti = sorted((nel_pool | con_layers | set(a.nomi)) & studio)
    nuovi, cambiati, pari = [], [], 0
    for nome in scelti:
        d = os.path.join(a.da, nome)
        man = json.load(open(os.path.join(d, 'manifest.json'), encoding='utf8'))
        pool = nome in nel_pool or nome in a.nomi
        dove = {k for k, si in (('pool', pool),
                                ('layers', nome in con_layers or nome in a.nomi))
                if si}
        comporre = 'pool' in dove and foglio_vecchio(d)
        lav = [(s, t) for s, t in copie(nome, d, dove)
               if not (comporre and s.endswith('spritesheet.png')) and not uguali(s, t)]
        if comporre and diverso_da_composto(d, os.path.join(MINI, nome + '.png')):
            lav.append(('<layer composti>', os.path.join(MINI, nome + '.png')))
        voce_nuova = pool and mans.get(nome) != man
        if not lav and not voce_nuova:
            pari += 1
            continue
        (cambiati if nome in nel_pool or nome in con_layers else nuovi).append(nome)
        for s, t in lav:
            print(f'  {nome:24} {os.path.relpath(t, ROOT)}' +
                  ('  (dai layer)' if s == '<layer composti>' else ''))
            if a.scrivi:
                if s == '<layer composti>':
                    componi(d, t)
                else:
                    shutil.copy2(s, t)
        if voce_nuova:
            print(f'  {nome:24} voce in _src/mini/_manifests.json')
            mans[nome] = man

    if a.scrivi and (nuovi or cambiati):
        json.dump(mans, open(os.path.join(MINI, '_manifests.json'), 'w',
                             encoding='utf8'), indent=0)
    da_paint = sorted(n for n in studio - nel_pool - set(a.nomi)
                      if json.load(open(os.path.join(a.da, n, 'manifest.json'),
                                        encoding='utf8')).get('creato_da') == 'paint')
    print(f'{len(scelti)} controllati · {pari} identici · {len(cambiati)} cambiati'
          f' · {len(nuovi)} nuovi' + ('' if a.scrivi else '  (prova: niente scritto)'))
    if da_paint:
        print(f'pacchetti di paint fuori dalla pipeline: {", ".join(da_paint)}'
              ' — si aggiungono per nome')


if __name__ == '__main__':
    main()
