#!/usr/bin/env python3
"""
vetrina.py — mostra i pezzi di un atlante ALLA SCALA CHE AVRANNO NEL GIOCO.

Un montaggio normale mette tutto nella stessa cella e non dice niente sulle
proporzioni: e' esattamente l'errore che aveva fatto sembrare il borgo un
modellino. Qui ogni pezzo e' disegnato alto `hu` unita' su una linea di terra
comune, con accanto la sagoma di un villano (2.05 unita') come metro.

Uso:
    python3 vetrina.py costa              # tutte le categorie
    python3 vetrina.py costa edifici_ props_
"""
import json
import os
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
U = 14          # pixel per unita' di mondo nella vetrina
UOMO = 2.05


def vetrina(mappa, filtri=None, per_riga=26):
    d = os.path.join(ROOT, 'dist', mappa)
    man = json.load(open(os.path.join(d, 'manifest.json')))
    atlas = Image.open(os.path.join(d, 'atlas_world.png')).convert('RGBA')
    voci = [(k, v) for k, v in man['world']['rects'].items()
            if v.get('kind') != 'icon']
    if filtri:
        voci = [(k, v) for k, v in voci if any(k.startswith(f) for f in filtri)]
    voci.sort(key=lambda kv: (-kv[1].get('hu', 0), kv[0]))

    righe = [voci[i:i + per_riga] for i in range(0, len(voci), per_riga)]
    altezze = [max(v.get('hu', 1) for _, v in r) for r in righe]
    H = int(sum(a * U + 34 for a in altezze)) + 20
    W = per_riga * 46 + 60
    out = Image.new('RGB', (W, H), (26, 28, 34))
    dr = ImageDraw.Draw(out)
    y = 10
    for r, hmax in zip(righe, altezze):
        base = y + int(hmax * U)
        dr.line([(0, base), (W, base)], fill=(70, 76, 90))
        # il metro: un villano
        dr.rectangle([6, base - int(UOMO * U), 14, base], fill=(210, 170, 110))
        x = 28
        for k, v in r:
            hu = v.get('hu', 1)
            wu = v.get('wu', hu)
            im = atlas.crop((v['x'], v['y'], v['x'] + v['w'], v['y'] + v['h']))
            th, tw = max(2, int(hu * U)), max(2, int(wu * U))
            im = im.resize((tw, th), Image.NEAREST)
            out.paste(im, (x, base - th), im)
            dr.text((x, base + 3), k[:14], fill=(140, 144, 152))
            x += max(tw + 6, 46)
        y = base + 34
    dest = os.path.join(ROOT, 'out', f'vetrina_{mappa}.png')
    out.save(dest)
    print(f'{mappa}: {len(voci)} pezzi → {dest}  {out.size}')


if __name__ == '__main__':
    vetrina(sys.argv[1], sys.argv[2:] or None)
