#!/usr/bin/env python3
"""
build_mini.py — impacchetta il pool "Mini" di character_studio nell'atlas del gioco.

Sono 43 personaggi gia' lavorati dal toolkit di Star Drifter: spritesheet a
celle quadrate piu' un manifest con le animazioni segmentate per intervallo di
frame. Qui non si ridisegna niente: si ritaglia, si misura e si impacchetta.

Due misure vanno prese per personaggio, altrimenti in gioco la gente
"galleggia" o cambia statura fra un'animazione e l'altra:

  ground : la riga piu' bassa toccata dal corpo in idle/walk. E' il piano di
           appoggio. Ogni frame viene poi alzato di quanto il suo ritaglio sta
           sopra questa riga.
  cx     : il centro orizzontale del corpo in idle. Serve perche' in molti
           frame d'attacco l'arma sporge da un lato e sposterebbe il centro
           del ritaglio, facendo scivolare il personaggio di lato.

La scala non e' uniforme: i corpi vanno da 12 a 25 px. Si calcola un PPU
efficace per personaggio in modo che tutti gli umani risultino alti uguale in
unita' di mondo, e gli animali alla loro taglia.
"""
import json
import os

import numpy as np
from PIL import Image

# UNA sola scala per tutti gli umani.
#
# Prima normalizzavo ogni personaggio alla stessa altezza dividendo per
# l'altezza del suo sprite. Sbagliato due volte: cancellava la variazione
# naturale di statura voluta dall'artista (il vecchio e' piu' basso
# dell'alabardiere, ed e' giusto cosi'), e soprattutto l'altezza dello sprite
# include l'attrezzo impugnato — forcone, spada, alabarda — che sporge sopra
# la testa. Piu' lungo l'attrezzo, piu' piccolo veniva l'omino.
#
# Il pool e' disegnato tutto alla stessa scala da una mano sola: basta un
# fattore unico e le proporzioni relative restano quelle originali.
PPU_UMANO = 14 / 2.05          # 14 px di villano = 2.05 unita' di mondo

# Gli animali fanno eccezione: l'artista li ha disegnati per riempire la cella,
# non in scala con le persone. Un lupo alto quanto un uomo non sta in piedi.
TARGET = {
    'montato': 2.80,
    'lupo': 1.05, 'orso': 1.55, 'cinghiale': 1.00, 'volpe': 0.75,
    'cervo': 1.60, 'lepre': 0.50, 'uccello': 0.40, 'drago': 3.60,
    # gli animali delle altre citta' (26/09)
    'renna': 1.55, 'capra': 0.95, 'lince': 0.85, 'orso_polare': 1.75,
    'mastino': 0.95, 'fennec': 0.55, 'iena': 0.95, 'leone': 1.25, 'orice': 1.45,
}

CATEGORY = {
    'MiniHorseMan': 'montato', 'MiniCavalierMan': 'montato',
    'MiniHorseMan@rosso': 'montato', 'ladro_cavallo': 'montato',
    'MiniWolf': 'lupo', 'MiniBear': 'orso', 'MiniBoar': 'cinghiale',
    'MiniFox': 'volpe', 'MiniDeer1': 'cervo', 'MiniDeer2': 'cervo',
    'MiniBunny': 'lepre', 'MiniBird': 'uccello', 'DragonOrange': 'drago',
    'MiniBerry': 'lepre',
    # 26/09: i personaggi delle altre citta' (character studio, Vik Ban Sar
    # Pir). Asino, mulo, cammello, dromedario e cavallo arabo sono
    # cavalcature senza cavaliere, disegnate alla scala delle persone come
    # il cavallo_mini: restano 'umano' (un solo fattore di scala)
    'BanCapo': 'montato', 'SarCavaliere': 'montato',
    'VikRenna': 'renna', 'VikCapra': 'capra', 'VikLince': 'lince',
    'VikLupoBianco': 'lupo', 'VikOrsoPolare': 'orso_polare', 'VikCorvo': 'uccello',
    'BanCinghiale': 'cinghiale', 'BanMastino': 'mastino',
    'SarFennec': 'fennec', 'SarIena': 'iena', 'SarLeone': 'leone', 'SarOrice': 'orice',
    'SarFalco': 'uccello', 'PirPappagallo': 'uccello',
}

# vocabolario del gioco → candidati nel manifest, in ordine di preferenza
ANIM_MAP = {
    'idle':   ['idle'],
    'walk':   ['walk', 'walk2', 'fly', 'idle'],
    'run':    ['walk2', 'walk', 'fly', 'idle'],
    'attack': ['attack', 'attack2', 'spell', 'work', 'steal', 'idle'],
    'hit':    ['hit', 'damage', 'idle'],
    'death':  ['death', 'hit', 'damage', 'idle'],
    'work':   ['work', 'work2', 'skinning', 'steal', 'idle2', 'idle3', 'idle'],
}

FRAME_RATES = {'idle': 6, 'walk': 10, 'run': 15, 'attack': 12,
               'hit': 10, 'death': 8, 'work': 9}


def frames_of(anim_list, name):
    """
    Il toolkit ha prodotto tre forme di voce nel manifest: intervallo
    from/to, lista esplicita di frame, e - per un paio di animazioni
    composte a mano - una mappa di layer che prende frame da altri
    personaggi. Le prime due si usano, la terza si salta.
    """
    for a in anim_list:
        if a.get('name') != name:
            continue
        if 'from' in a and 'to' in a:
            return list(range(a['from'], a['to'] + 1))
        if isinstance(a.get('frames'), list) and a['frames']:
            return list(a['frames'])
        return None
    return None


# I nemici sono la stessa gente con un'altra divisa: invece di sbiancare tutto
# con una tinta, si rimappa il BLU delle vesti sul ROSSO. L'incarnato, il
# cuoio e il contorno restano dove sono, quindi lo sprite non si spappola.
def divisa_rossa(im):
    a = np.asarray(im.convert('RGBA')).astype(np.float32)
    rgb, alpha = a[:, :, :3], a[:, :, 3]
    mx = rgb.max(axis=2); mn = rgb.min(axis=2)
    d = mx - mn
    # tinta (0..1) alla maniera di HSV, senza convertire tutto
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    h = np.zeros_like(mx)
    nz = d > 1e-3
    idx = nz & (mx == r); h[idx] = ((g - b)[idx] / d[idx]) % 6
    idx = nz & (mx == g); h[idx] = ((b - r)[idx] / d[idx]) + 2
    idx = nz & (mx == b); h[idx] = ((r - g)[idx] / d[idx]) + 4
    h = h / 6.0
    sat = np.where(mx > 0, d / np.maximum(mx, 1), 0)
    # blu e azzurri saturi: 0.50..0.75 di tinta
    sel = (alpha > 0) & (h > 0.50) & (h < 0.76) & (sat > 0.22)
    if sel.any():
        # scambio semplice dei canali: quanto c'era di blu passa al rosso
        R, G, B = r.copy(), g.copy(), b.copy()
        r[sel], g[sel], b[sel] = B[sel], G[sel] * 0.55 + R[sel] * 0.2, R[sel] * 0.55
    out = np.dstack([r, g, b, alpha])
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')


def build(src_dir, packer, ppu, soltanto=None, manifest='_manifests.json'):
    """
    packer: oggetto con .add(key, image, meta). Ritorna le definizioni.

    `soltanto`: se dato, un insieme di nomi da includere — serve a costruire
    un atlante per mappa invece di uno solo con tutto dentro.
    """
    mans = json.load(open(os.path.join(src_dir, manifest)))
    if soltanto is not None:
        mans = {k: v for k, v in mans.items() if k in soltanto}
    defs = {}

    for name, m in sorted(mans.items()):
        path = os.path.join(src_dir, name + '.png')
        if not os.path.exists(path):
            continue
        sheet = np.asarray(Image.open(path).convert('RGBA'))
        fw, fh = m['frame_width'], m['frame_height']
        ncell = sheet.shape[1] // fw
        anims = m.get('animations', [])

        def cell(i):
            return sheet[:, i * fw:(i + 1) * fw]

        # piano d'appoggio e centro: misurati su idle + walk, non su attack
        ref = (frames_of(anims, 'idle') or [0]) + (frames_of(anims, 'walk') or [])
        ref = [i for i in ref if i < ncell]
        acc = np.zeros((fh, fw), bool)
        for i in ref:
            acc |= cell(i)[:, :, 3] > 0
        ys, xs = np.where(acc)
        if ys.size == 0:
            continue
        ground = int(ys.max()) + 1
        body_h = int(ys.max() - ys.min() + 1)
        cx = float((xs.min() + xs.max() + 1) / 2)

        cat = CATEGORY.get(name, CATEGORY.get(name.split('@')[0], 'umano'))
        if cat == 'umano':
            eff_ppu = PPU_UMANO
        else:
            # per gli animali serve l'altezza del CORPO, non dello sprite: la
            # riga si conta solo se e' larga almeno un terzo della piu' larga,
            # cosi' code, corna e orecchie non gonfiano la misura
            counts = acc.sum(axis=1)
            thr = max(3, counts.max() * 0.33)
            rows = np.where(counts >= thr)[0]
            core_h = int(rows.max() - rows.min() + 1) if rows.size else body_h
            eff_ppu = core_h / TARGET[cat]

        entry = {'ppu': round(eff_ppu, 3), 'cell': fw, 'cellH': fh,
                 'ground': ground, 'cx': round(cx, 2),
                 'cat': cat, 'anims': {}}

        for game_anim, candidates in ANIM_MAP.items():
            idxs = None
            for c in candidates:
                idxs = frames_of(anims, c)
                if idxs:
                    break
            if not idxs:
                continue
            idxs = [i for i in idxs if i < ncell]
            # bbox comune all'animazione: il ritaglio non deve ballare fra frame
            acc = np.zeros((fh, fw), bool)
            for i in idxs:
                acc |= cell(i)[:, :, 3] > 0
            if not acc.any():
                continue
            ys, xs = np.where(acc)
            bx0, bx1 = int(xs.min()), int(xs.max()) + 1
            by0, by1 = int(ys.min()), int(ys.max()) + 1
            keys = []
            for k, i in enumerate(idxs):
                sub = cell(i)[by0:by1, bx0:bx1]
                if sub[:, :, 3].max() == 0:
                    continue
                key = f'{name}/{game_anim}/{k}'
                packer.add(key, Image.fromarray(sub, 'RGBA'),
                           {'ox': bx0, 'oy': by0})
                keys.append(key)
            if keys:
                entry['anims'][game_anim] = keys

        defs[name] = entry

    return defs, FRAME_RATES
