#!/usr/bin/env python3
"""
innesta_nano.py — porta nel borgo gli sprite generati (lotto di Valdarno).

Il pot-pourri delle tavole ChatGPT non si ripara con la palette: si ripara
sostituendo i pezzi con asset nati nello stesso registro dei personaggi Mini.
Qui ogni immagine generata viene:

1. ripulita da `ripulisci_nano.py` (scacchiera finta, fattore d'ingrandimento);
2. ridotta alla DENSITA' DEI PERSONAGGI: 6,83 px d'arte per unita' di mondo,
   la stessa di un villano (14 px = 2,05 unita'). Provino del 22/09: a 16 px
   per unita', la densita' dell'atlante, il contorno di 1 px diventa un filo e
   la casa torna a essere un pezzo di un altro gioco;
3. innestata nell'atlante del mondo AL POSTO dei pezzi con quei nomi. Un'immagine
   puo' coprire piu' nomi: la stessa regione dell'atlante, niente copie.

Si innesta per nome perche' cosi' `world.js` non si tocca: le liste delle case,
dell'arredo e delle bancarelle restano quelle, cambia solo cosa disegnano.
Allo stesso modo entrano i pezzi disegnati da codice (`disegna_pezzi.py`):
mura, porte, tende, insegne, staccionate, lampioni.

Si parte dall'uscita di `build_atlanti.py` (`dist/borgo/`) e si scrive
`assets/` completo — personaggi e terreno copiati cosi' come sono, mondo con
l'innesto, manifest con la sua impronta. Le due righe qui sotto sono l'intera
catena: rilanciabile quante volte si vuole, e togliere una voce da LOTTO
rimette il pezzo vecchio.

Uso:
    python tools/build_atlanti.py borgo
    python tools/innesta_nano.py [--img <cartella immagini>]

Le altre citta' (25/09 sera, F3): `--mappa fiordo` parte da `dist/fiordo/` e
scrive `assets/fiordo/`, che il gioco carica per quella citta'. Il lotto nano
e' di Valdarno e li' non entra; i pezzi disegnati da codice e le tile delle
stanze si'. Il mondo e' generato dallo stesso codice e chiede gli stessi nomi
(casa_alta, botte, cinta_campata...): quelli che la citta' non ha li prende da
Valdarno (`assets/`, quindi prima va innestato il borgo), quelli che la citta'
rinomina stanno in `mappe.json` alla voce `nomi` (nome del gioco -> pezzo
della citta'). Il terreno segue l'ordine di Valdarno (il gioco lo indicizza
per posizione, T in world.js): ogni tipo e' la tile di Valdarno o quella
indicata da `terreni_nomi`. E' una prima passata per vedere la citta' in
piedi, non curatela: la scelta dei pezzi e' tua.
    python tools/build_atlanti.py fiordo
    python tools/innesta_nano.py --mappa fiordo
"""
import argparse
import hashlib
import json
import os
import io
import shutil
import sys
import zipfile

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_assets  # noqa: E402
import build_mini  # noqa: E402
import disegna_pezzi  # noqa: E402
import interni  # noqa: E402
import pezzi_corte  # noqa: E402
import pezzi_fuoco  # noqa: E402
import pezzi_nord  # noqa: E402
import ripulisci_nano  # noqa: E402
from percorsi import ASSETS, DIST, ROOT  # noqa: E402

MAPPA = 'borgo'
IMG = os.path.join(ROOT, '_archive', 'mcp_crt', 'mcp_crt', 'img')
PREFISSO = 'Borgo di Valdarno · '
DENSITA = build_mini.PPU_UMANO

# (file senza prefisso, altezza in unita' di mondo, nomi che sostituisce).
# Le altezze sono finali: il fattore architettura x1.35 e' gia' dentro. Chi e'
# piazzato con `scale` in world.js (torri x1.1, chiesa x1.2,
# fontana della piazza x1.3) prende la sua scala in piu'. Lo stesso file puo'
# comparire due volte con altezze diverse (vasca e fontana della piazza).
LOTTO = [
    ('edificio 1', 9.5, ['edificio_casa', 'casa_alta', 'palazzo_blu']),
    ('edificio 2', 8.0, ['edificio_bottega']),
    ('edificio 3', 8.5, ['edificio_taverna', 'casa_blu', 'casa_alta_b']),
    # solo nomi della piazza: tende e bancarelle blu/rosse arredano anche gli
    # accampamenti, dove un banco col tetto di coppi non ha senso
    ('edificio 4', 3.8, ['bancarella_righe', 'bancarella_grande',
                         'tenda_mercato']),
    ('edificio 5', 10.0, ['edificio_chiesa']),
    ('edificio 6', 10.5, ['torre', 'torre_guardia', 'palazzo_torre']),
    ('edificio 7', 8.5, ['fienile', 'edificio_stalla']),
    ('edificio 8', 11.5, ['casa_stretta', 'casa_tetto_rosso', 'palazzo_gotico']),
    # il castello del 1038 (05/10): una torre sola, la porta piu' alta di un
    # uomo; piazzata senza scala (world_corte.js). Era il mastio composto
    ('torre 2 (base di pietra, piano alto di legno)', 22.0, ['castello_mastio']),
    # la corte del 1038 (06/10): alte quanto basta perche' la porta superi un
    # uomo (porta su altezza, in pixel d'arte: sala 49/315, cappella 76/304,
    # apertura della stalla 153/355). Piazzate in world_corte.js
    ('sala del signore (1038)', 14.0, ['sala_signore']),
    ('cappella del castello (1038)', 10.0, ['cappella_corte']),
    ('stalla di legno (1038)', 7.0, ['stalla_corte']),
    # il ponte di pietra sul fiume di Valdarno (06/10, tua scelta fra tre
    # provini): visto dall'alto, si stende a terra (piano); qui l'altezza e'
    # la LUNGHEZZA da riva a riva. Largo 14,4
    ("ponte 2 (pietra a schiena d'asino)", 40.0, ['ponte_fiume']),
    ('edificio 10 (Dogana del porto fluviale)', 8.5, ['municipio',
                                                      'palazzo_lungo']),
    ('edificio 11 (Casa di piacere — locanda notturna)', 11.0, ['casa_rossa']),
    ('edificio 12 (Bancarella mercato — variante)', 3.8,
     ['bancarella_verde', 'tenda_carne']),
    ('prop 1', 1.3, ['botte', 'botte_b', 'barile']),
    ('prop 3', 1.5, ['carretto_fermo']),
    ('prop 4', 3.2, ['pozzo', 'pozzo_grande']),
    ('prop 5', 1.9, ['banco_mercato']),
    ('prop 6', 1.7, ['braciere', 'fuoco_cesto']),
    ('prop 9', 1.6, ['abbeveratoio', 'fontana']),
    ('prop 9', 2.4, ['fontana_grande']),
    ('prop 10', 1.6, ['catasta', 'tronchi']),
    ('prop 11', 1.4, ['mangiatoia']),
]
# Mezzi di terra, disegnati a piombo col muso in alto: finiscono nell'atlante
# con kind 'terra' e il gioco li stende sul terreno ruotati di heading. Qui
# l'altezza e' la LUNGHEZZA del mezzo in unita' di mondo. Nomi nuovi dove il
# vecchio e' usato anche come arredo in piedi (carro_telone all'accampamento).
MEZZI = [
    ('veicolo 1', 3.4, ['carro_coperto']),
    ('veicolo 2', 3.2, ['carro_merci']),
    ('veicolo 3', 3.2, ['carro_rotto']),
    # riprovati il 30/09 a misura di gioco (tua richiesta "forse alcune
    # carrozze"): la carrozza rossa e il carro del fieno si leggono
    ('veicolo 4', 3.4, ['carrozza']),
    ('veicolo 5', 3.3, ['carro_fieno']),
]
# Scafi delle barche, dai ritagli della tavola delle navi viste dall'alto
# (_src/tagli/<tavola>.zip): prua in cima come i carri, stesi sull'acqua e
# ruotati con la rotta. (tavola, ritaglio, lunghezza in unita', nome). La vela
# e la bandiera, in piedi, le mette il gioco (disegna_pezzi).
SCAFI = [
    ('pd_navi_topdown', 'p07_004', 5.5, 'scafo_barchetta'),
    ('pd_navi_topdown', 'p08_000', 8.0, 'scafo_lancia'),
    ('pd_navi_topdown', 'p12_007', 8.5, 'scafo_cocca'),
]
# I lotti meta delle altre citta' (30/09, tua indicazione: "fiordi e navi meglio
# meta, l'oggettistica meta al posto dei procedurali"). Stesso formato di LOTTO;
# si innestano per ultimi, dopo i pezzi presi da Valdarno e quelli disegnati
# da codice, e li sostituiscono. I nomi nuovi (vik_*, porto_*, bitta...) li
# chiedono le piante (CASE, arredo). La Costa tiene i legacy (tua scelta).
LOTTI_CITTA = {
    'fiordo': ('Il fiordo · ', [
        ('edificio 1', 7.5, ['vik_casa_lunga']),
        ('edificio 2', 8.5, ['vik_casa_a']),
        ('edificio 3', 8.0, ['vik_casa_b']),
        ('edificio 4', 9.0, ['vik_casa_c']),
        ('edificio 5', 7.0, ['vik_stalla']),
        ('edificio 6 (Castello — Sala dei Jarl)', 6.5, ['vik_sala']),   # in gioco x1.7
        ('edificio 7 (Porto — Cantiere navale vichingo)', 8.0, ['vik_cantiere']),
        ('edificio 8 (Osteria — Sala dell\'idromele)', 8.5, ['edificio_taverna']),
        # il lotto del 30/09: piu' varieta', e il tempio
        ('edificio 9', 7.5, ['vik_casa_torba']),
        ('edificio 10', 7.0, ['vik_capanna_pesce']),
        ('edificio 11', 9.5, ['vik_casa_ricca']),
        ('edificio 12', 6.0, ['vik_capanna_tonda']),
        ('edificio 13', 9.0, ['vik_granaio']),
        ('edificio 14', 8.0, ['vik_hof']),               # in gioco x1.25
        # gli alberi del 30/09 (3): la varieta' delle foreste (il fiordo 2, un
        # fungo grigio, e' scartato)
        ('albero 1', 6.0, ['vik_abete_neve']),
        ('albero 3', 5.0, ['vik_betulla']),
        ('albero 4', 4.6, ['vik_albero_morto']),
        ('albero 5', 3.2, ['vik_ginepro']),
        ('albero 6', 4.2, ['vik_abetini']),
        ('prop 1', 2.6, ['totem']),
        ('prop 6', 2.2, ['pietra_runica']),
        # le bancarelle del mercato sull'arteria, al posto delle tende (30/09)
        ('bancarella 1', 3.2, ['vik_banco_a']),
        ('bancarella 2', 3.2, ['vik_banco_b']),
        ('bancarella 3', 3.4, ['vik_banco_c']),
        ('bancarella 4', 3.0, ['vik_banco_d']),
    ], [
        # le navi del nord senza remi (lotto del 30/09); in gioco x1.7
        # (BARCHE.scala di pianta_fiordo.js): lunghezza vera 8,5, 6,8, 5,1
        ('barca 1 (senza remi)', 5.0, ['vik_drakkar']),
        ('barca 2 (senza remi)', 4.0, ['vik_knarr']),
        ('barca 3 (senza remi)', 3.0, ['vik_pesca']),
    ]),
    # alberi saraceni del 30/09 (3) generati e scartati dopo averli visti in
    # gioco ("osceni"): la Costa tiene le palme del catalogo
}
# Scartati a misura di gioco (30/09, provino e foto): la rastrelliera del pesce
# (una cornice nera, i pesci spariscono: resta quella disegnata); gli oggetti piccoli (scudo,
# catasta, calderone, botte, ceppo, corda del fiordo; bitta, corda, reti,
# cassa, ancora, barile, remi del porto) a 9-11 px sono macchie: vanno
# generati gia' piccoli. I due carri del fiordo visti dall'alto sono macchie
# scure. Faro, locanda, torre e casa del pescatore del porto hanno le pareti
# chiare, che la ripulitura dello sfondo bianco buca.
# Il porto, in tutte e tre le citta' ("Mare e porti"): gli edifici li chiedono
# il porto di Valdarno e quello del Fiordo; gli oggetti vanno ovunque (la
# cassa e la lanterna prendono il posto di quelle disegnate da codice)
PORTO = ('Mare e porti · ', [
    ('edificio 1 (Magazzino portuale)', 8.5, ['porto_magazzino']),
    ('edificio 3 (Dogana del porto)', 8.5, ['porto_dogana']),
    ('prop 7', 2.4, ['lanterna_palo']),
], [
    # gli scafi senza remi (lotto del 30/09) al posto di quelli della tavola
    # (SCAFI): le barche di Valdarno e della Costa. Lunghezza in unita'
    ('barca 1 (senza remi)', 8.5, ['scafo_cocca']),
    ('barca 2 (senza remi)', 5.5, ['scafo_barchetta']),
    ('barca 3 (senza remi)', 8.0, ['scafo_lancia']),
    ('barca 4 (senza remi)', 7.0, ['scafo_costiera']),
])
# La nave pirata dell'atto III (07/10, tua scelta fra tre provini): il ponte
# della galea con due timoni, visto dall'alto e steso a terra nella stanza del
# ponte (nave.js); la lunghezza e' quella della grana dei personaggi (305 px
# d'arte, 44,7 unita'). L'albero con la vela latina in piedi sul suo piede.
# In tutte le citta': la stiva e il ponte si caricano dappertutto
NAVE = ('Nave pirata · ', [
    ('albero 1 (vela latina)', 13.0, ['nave_albero']),
], [
    ('ponte 2 (galea, due timoni laterali)', 44.7, ['nave_ponte']),
])


def chiudi_buchi(im, massimo=40):
    """I buchi dentro lo sprite (30/09, tua foto del granaio): pixel
    trasparenti chiusi da ogni lato, residui della ripulitura dello sfondo
    bianco, che si prende anche i pixel chiari (neve, pareti pallide). Ognuno
    fino a `massimo` pixel prende il colore del pixel pieno piu' vicino; i
    vani grandi e voluti (il cantiere aperto) restano. Quello che tocca il
    bordo non e' un buco: lo spazio fra i pali del granaio resta vuoto."""
    from scipy import ndimage
    a = np.array(im.convert('RGBA'))
    pieno = a[..., 3] > 0
    buchi = ndimage.binary_fill_holes(pieno) & ~pieno
    etichette, n = ndimage.label(buchi)
    if not n:
        return im
    aree = ndimage.sum(buchi, etichette, range(1, n + 1))
    piccoli = np.isin(etichette, [k + 1 for k, v in enumerate(aree) if v <= massimo])
    _, (iy, ix) = ndimage.distance_transform_edt(~pieno, return_indices=True)
    a[piccoli] = a[iy[piccoli], ix[piccoli]]
    a[piccoli, 3] = 255
    return Image.fromarray(a)


def solo_corpo(im):
    """Il pezzo senza il fumo dipinto sopra i camini (il fuoco e il fumo li fa
    il motore): via i frammenti staccati, piccoli (meno di un decimo della
    parte piu' grande) e tutti nel quarto alto dell'immagine. Quelli in basso
    restano: i pali del granaio, gli zoccoli (30/09, li perdeva)."""
    from scipy import ndimage
    a = np.array(im.convert('RGBA'))
    etichette, n = ndimage.label(a[..., 3] > 0, structure=np.ones((3, 3)))
    if n < 2:
        return im
    aree = ndimage.sum(np.ones_like(etichette), etichette, range(1, n + 1))
    fondo = ndimage.maximum(np.indices(etichette.shape)[0], etichette, range(1, n + 1))
    alto = a.shape[0] * 0.25
    # e le briciole di 1-3 pixel ovunque (sotto il magazzino del porto)
    via = [k + 1 for k in range(n)
           if (aree[k] < aree.max() * 0.1 and fondo[k] < alto) or aree[k] <= 3]
    a[np.isin(etichette, via), 3] = 0
    return build_assets.trim(Image.fromarray(a))


def innesta_lotto(pezzi, alias, img, lotto):
    """Un lotto meta (prefisso, voci in piedi, mezzi di terra) nei pezzi: come
    LOTTO, ma per nome del file col suo prefisso. Le immagini che mancano si
    saltano (e si dicono). Ritorna quante ne ha innestate."""
    prefisso, voci, mezzi = lotto
    n = 0
    for (file, hu, nomi), kind in [(v, 'billboard') for v in voci] + [(v, 'terra') for v in mezzi]:
        p = os.path.join(img, prefisso + file + '.png')
        if not os.path.exists(p):
            print(f'  manca {prefisso}{file}')
            continue
        im, _, _ = ripulisci_nano.ripulisci(p)
        sp = solo_corpo(riduci(im, max(6, round(hu * DENSITA))))
        pezzi[nomi[0]] = (sp, {'kind': kind, 'hu': hu,
                               'wu': round(hu * sp.width / sp.height, 2),
                               'nano': prefisso + file})
        for a in nomi[1:]:
            pezzi.pop(a, None)
            alias[a] = nomi[0]
        n += 1
    return n


# Scartati a scala di gioco (22/09): carrozza rossa (4), carro del fieno (5)
# (ripresi il 30/09, sopra), carro prigione (7) e carro dei briganti (8)
# visti dall'alto sono scatole
# piene e colorate, e a 25 px sembrano furgoni. Reggono solo i carri col piano
# di carico a vista. Veicolo 6 doveva essere un cavallo ed e' uscita una barca
# a remi; veicolo 9 (cavallo da soma) non serve: i cavalli sono personaggi.

# Scartati dopo averli guardati: prop 7 doveva essere una staccionata ed e'
# uscita una grata murata; prop 8 e' un'insegna appesa senza palo, a terra
# galleggerebbe; prop 12 doveva essere una panca e ha un tetto di coppi;
# prop 2 (casse) a 9 px e' un quadrato scuro, le vecchie si leggono meglio.
# Limite misurato: sotto i ~12 px nessuna riduzione salva un prop generato
# grande (provate palette a 10-20 colori e schiarite) — i prop piccoli vanno
# generati gia' alla loro misura.
# I terreni non sono ripetibili (si comprano, v. DA_FARE.md), le due
# "finestre accese" non sono registrate sulle case diurne.


def riduci(im, h, n_col=20):
    """Da immagine ripulita a sprite alto h px, con pixel netti e contorno."""
    a = np.asarray(im).astype(np.float32) / 255
    w = max(2, round(h * im.width / im.height))
    # media per area su colori premoltiplicati: niente frange scure al bordo
    pre = a.copy()
    pre[..., :3] *= pre[..., 3:4]
    small = np.asarray(Image.fromarray((pre * 255).astype(np.uint8))
                       .resize((w, h), Image.BOX)).astype(np.float32) / 255
    al = small[..., 3]
    rgb = small[..., :3] / np.maximum(al[..., None], 1e-3)
    pieno = al > 0.5
    # palette propria dello sprite, presa dall'originale: la media per area
    # inventa tinte di mezzo, la riproiezione le riporta a colori piatti
    src = np.asarray(im.convert('RGB'))[np.asarray(im)[..., 3] > 0]
    pal = Image.fromarray(src.reshape(1, -1, 3)).quantize(
        n_col, method=Image.Quantize.MEDIANCUT).getpalette()[:n_col * 3]
    pal = np.array(pal).reshape(-1, 3) / 255
    d = ((rgb[:, :, None, :] - pal[None, None]) ** 2).sum(-1)
    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = (pal[d.argmin(-1)] * 255).astype(np.uint8)
    out[..., 3] = np.where(pieno, 255, 0)
    # i buchi chiusi prima del contorno, che se no li cerchierebbe di scuro
    out = np.array(chiudi_buchi(Image.fromarray(out)))
    pieno = out[..., 3] > 0
    # anello interno di 1 px nel colore piu' scuro: e' il contorno dei Mini,
    # e quello disegnato dal generatore alla riduzione va perso
    p = np.pad(pieno, 1)
    bordo = pieno & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])
    scuro = np.minimum(pal[pal.sum(1).argmin()] * 255, 60).astype(np.uint8)
    out[bordo, :3] = scuro
    return build_assets.trim(Image.fromarray(out))


def uscita(mappa):
    """Dove va l'atlante innestato: assets/ per il borgo, assets/<mappa>/
    per le altre citta'."""
    return ASSETS if mappa == MAPPA else os.path.join(ASSETS, mappa)


def base(mappa=MAPPA):
    """Uscita fresca di build_atlanti.py: il mondo su cui innestare; personaggi
    e terreno vanno in assets/ cosi' come sono, accoppiati al loro manifest."""
    d = os.path.join(DIST, mappa)
    if not os.path.exists(os.path.join(d, 'manifest.json')):
        sys.exit(f'manca {d}: prima python tools/build_atlanti.py {mappa}')
    out = uscita(mappa)
    os.makedirs(out, exist_ok=True)
    manifest = json.load(open(os.path.join(d, 'manifest.json'), encoding='utf8'))
    atlas = Image.open(os.path.join(d, 'atlas_world.png')).convert('RGBA')
    for f in ('atlas_chars.png', 'atlas_terrain.png'):
        shutil.copy2(os.path.join(d, f), os.path.join(out, f))
    return manifest, atlas


# i pezzi del catalogo che hanno un dentro (case, tetti, tende)
PREFISSI_INTERNI = ('edifici_', 'tetti_', 'accampamenti_')
# i pezzi del catalogo che non hanno vuoti voluti dentro (chiudi_buchi)
PREFISSI_PIENI = ('rocce_palme_', 'edifici_', 'strutture_difese_', 'carovane_', 'porto_',
                  'tendoni_', 'botteghe_', 'props_deserto_', 'props_neve_', 'accampamenti_',
                  'natura_neve_01', 'natura_neve_02', 'natura_neve_12', 'carri_')
BUIO_DENTRO = np.array((26, 20, 20), float)      # sotto il tetto, in fondo
PAVIMENTO = np.array((70, 52, 40), float)        # la soglia, dove arriva luce


def riempi_interni(im):
    """Il dentro di una casa del catalogo, dove l'estrazione lo ha bucato.
    Il ritaglio automatico delle altre citta' scambia l'ombra sotto un portico
    o dentro un arco per sfondo, e la casa si vedeva vuota, col terreno dietro
    (tua foto del 25/09 notte, edifici_nord_14). Un pixel trasparente e'
    "dentro" se ha la casa a sinistra, a destra e sopra nella sua riga e nella
    sua colonna: il cielo fra due torri non ha niente sopra, e resta vuoto.
    Si riempie di buio, piu' chiaro in basso verso la soglia. Ritorna
    l'immagine e quanti pixel ha riempito."""
    a = np.array(im.convert('RGBA'))
    pieno = a[..., 3] >= 128
    sx = np.maximum.accumulate(pieno, axis=1)
    dx = np.maximum.accumulate(pieno[:, ::-1], axis=1)[:, ::-1]
    su = np.maximum.accumulate(pieno, axis=0)
    dentro = ~pieno & sx & dx & su
    n = int(dentro.sum())
    if n:
        h = a.shape[0]
        t = (np.arange(h, dtype=float) / max(1, h - 1))[:, None, None] ** 2
        tinta = (BUIO_DENTRO + (PAVIMENTO - BUIO_DENTRO) * t).repeat(a.shape[1], axis=1)
        a[dentro, :3] = tinta[dentro].astype(np.uint8)
        a[dentro, 3] = 255
    return Image.fromarray(a), n


def fuoco_e_fumo(pezzi, cfg):
    """Il fuoco e il fumo animati (src/fuochi.js, 25/09 notte), dai
    `ritocchi` di mappe.json, in pixel dello sprite: il fumo dipinto da
    cancellare (`via`, riquadri), i camini da cui esce quello vero (`camini`,
    punti) e i fuochi su cui va la fiamma animata (`fiamme`: [x, base,
    altezza]). Nei metadati del pezzo, in frazioni dello sprite. (Trovarli
    dal colore non va: i tetti rossi passavano per fuoco, e la brace della
    torcia e' di tre pixel.)"""
    for nome, rit in (cfg.get('ritocchi') or {}).items():
        if nome not in pezzi:
            continue
        im, meta = pezzi[nome]
        a = np.array(im.convert('RGBA'))
        for x0, y0, x1, y1 in rit.get('via') or []:
            a[y0:y1, x0:x1, 3] = 0
        pezzi[nome] = (Image.fromarray(a), meta)
        if rit.get('camini'):
            meta['camini'] = [[round(x / a.shape[1], 3), round(y / a.shape[0], 3)]
                              for x, y in rit['camini']]
        if rit.get('fiamme'):
            meta['fiamme'] = [[round(x / a.shape[1], 3), round(y / a.shape[0], 3),
                               round(hh / a.shape[0], 3)] for x, y, hh in rit['fiamme']]


def da_valdarno(mappa, pezzi, alias, manifest):
    """Per una citta' che non e' il borgo: i nomi rinominati da mappe.json,
    poi i pezzi che mancano presi dall'atlante innestato di Valdarno, e il
    terreno nell'ordine di Valdarno. Ritorna il foglio del terreno."""
    cfg = json.load(open(os.path.join(ROOT, 'tools', 'mappe.json'), encoding='utf8'))[mappa]
    borgo = json.load(open(os.path.join(ASSETS, 'manifest.json'), encoding='utf8'))
    atlas = Image.open(os.path.join(ASSETS, 'atlas_world.png')).convert('RGBA')
    for nome, suo in (cfg.get('nomi') or {}).items():
        if suo in pezzi:
            pezzi[nome] = pezzi[suo]
    presi = 0
    for nome, r in borgo['world']['rects'].items():
        if nome in pezzi or nome in alias:
            continue
        meta = {k: v for k, v in r.items() if k not in ('x', 'y', 'w', 'h')}
        pezzi[nome] = (atlas.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h'])), meta)
        presi += 1
    # i pezzi di Valdarno con un'altra tinta (29/09, la Costa: le mura di
    # pietra grigia diventano di arenaria): i canali moltiplicati per [r, g, b]
    for nome, k in (cfg.get('tinte') or {}).items():
        if nome in pezzi:
            im, meta = pezzi[nome]
            a = np.asarray(im.convert('RGBA')).astype(np.float32)
            a[..., :3] = np.clip(a[..., :3] * np.array(k, np.float32), 0, 255)
            pezzi[nome] = (Image.fromarray(a.astype(np.uint8)), meta)
    # il terreno: stesso ordine di Valdarno, tile per tile
    T = borgo['terrain']
    V, L = T['variants'], T['tile']
    suo_t = manifest['terrain']
    fb = Image.open(os.path.join(ASSETS, 'atlas_terrain.png')).convert('RGB')
    fs = Image.open(os.path.join(DIST, mappa, 'atlas_terrain.png')).convert('RGB')
    foglio = Image.new('RGB', (L * V, L * len(T['order'])))
    scambi = cfg.get('terreni_nomi') or {}
    for i, nome in enumerate(T['order']):
        if scambi.get(nome) == '@assi':               # disegnata da codice (pezzi_nord)
            for v in range(V):
                foglio.paste(pezzi_nord.tile_assi(v).resize((L, L), Image.NEAREST), (v * L, i * L))
            continue
        src, riga = fb, i
        if scambi.get(nome) in T['order']:
            riga = T['order'].index(scambi[nome])
        elif scambi.get(nome) in suo_t['order']:
            src, riga = fs, suo_t['order'].index(scambi[nome])
        vv = V if src is fb else suo_t['variants']
        for v in range(V):
            foglio.paste(src.crop(((v % vv) * L, riga * L, (v % vv + 1) * L, (riga + 1) * L)),
                         (v * L, i * L))
    # i personaggi: i nomi di Valdarno puntano alle varianti della citta'
    defs = manifest['chars']['defs']
    for nome, suo in (cfg.get('personaggi_nomi') or {}).items():
        if suo in defs:
            defs[nome] = dict(defs[suo])
        else:
            print(f'  manca il personaggio {suo} (build_accessori.py, build_atlanti.py)')
    manifest['terrain'] = dict(T)
    orientate = [n for n in T['order'] if scambi.get(n) == '@assi']
    if orientate:
        manifest['terrain']['orientate'] = orientate      # gfx.js: solo mezzi giri
    print(f'{mappa}: {presi} pezzi presi da Valdarno, '
          f'{len(cfg.get("nomi") or {})} nomi rinominati, {len(scambi)} terreni scambiati')
    return foglio


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--img', default=IMG)
    ap.add_argument('--mappa', default=MAPPA, help="la citta' (voce di mappe.json)")
    args = ap.parse_args()
    out = uscita(args.mappa)

    manifest, atlas = base(args.mappa)
    vecchi = manifest['world']['rects']
    pezzi, alias = {}, {}
    for nome, r in vecchi.items():
        meta = {k: v for k, v in r.items() if k not in ('x', 'y', 'w', 'h')}
        im = atlas.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h']))
        pezzi[nome] = (im, meta)

    ripulite = {}
    voci = [v + ('billboard',) for v in LOTTO] + [v + ('terra',) for v in MEZZI]
    if args.mappa != MAPPA:
        voci = []                       # il lotto nano e' quello di Valdarno
    for file, hu, nomi, kind in voci:
        if file not in ripulite:
            ripulite[file] = ripulisci_nano.ripulisci(
                os.path.join(args.img, PREFISSO + file + '.png'))
        im, scala, _ = ripulite[file]
        sp = riduci(im, max(6, round(hu * DENSITA)))
        meta = {'kind': kind, 'hu': hu,
                'wu': round(hu * sp.width / sp.height, 2), 'nano': file}
        pezzi[nomi[0]] = (sp, meta)
        for n in nomi[1:]:
            pezzi.pop(n, None)
            alias[n] = nomi[0]
        print(f'{file[:34]:34} scala {scala:2} -> {sp.width:3}x{sp.height:<3} '
              f'hu {hu:4} · {", ".join(nomi)}')

    for tavola, ritaglio, hu, nome in (SCAFI if args.mappa == MAPPA else []):
        with zipfile.ZipFile(os.path.join(ROOT, '_src', 'tagli', tavola + '.zip')) as z:
            im = Image.open(io.BytesIO(z.read(f'{tavola}/png/{ritaglio}.png'))).convert('RGBA')
        sp = riduci(im, max(6, round(hu * DENSITA)))
        pezzi[nome] = (sp, {'kind': 'terra', 'hu': hu,
                            'wu': round(hu * sp.width / sp.height, 2),
                            'ritaglio': f'{tavola}/{ritaglio}'})
        print(f'{tavola}/{ritaglio:18} -> {sp.width:3}x{sp.height:<3} hu {hu:4} · {nome}')

    # i pezzi che non si generano (mura, porte, tende, insegne, staccionate,
    # lampioni): disegnati da codice alla stessa grana, innestati allo stesso modo
    # e le tile delle stanze (src/stanze/*.json), dal foglio RPG di Kenney
    # (e i pezzi vichinghi, pezzi_nord.py, solo nell'atlante del fiordo)
    nord = pezzi_nord.pezzi() if args.mappa == 'fiordo' else []
    corte = pezzi_corte.pezzi() if args.mappa == MAPPA else []     # il recinto del 1038
    stanze = interni.pezzi(None if args.mappa == MAPPA else args.mappa)
    for nomi, sp, hu in disegna_pezzi.pezzi() + stanze + pezzi_fuoco.pezzi() + nord + corte:
        pezzi[nomi[0]] = (sp, {'kind': 'billboard', 'hu': hu,
                               'wu': round(hu * sp.width / sp.height, 2),
                               'disegnato': True})
        for n in nomi[1:]:
            pezzi.pop(n, None)
            alias[n] = nomi[0]

    fuoco_e_fumo(pezzi, json.load(open(os.path.join(ROOT, 'tools', 'mappe.json'),
                                         encoding='utf8'))[args.mappa])

    if args.mappa != MAPPA:
        riempiti = {}
        for nome, (im, meta) in pezzi.items():
            if nome.startswith(PREFISSI_INTERNI):
                im, n = riempi_interni(im)
                pezzi[nome] = (im, meta)
                if n:
                    riempiti[nome] = n
        print(f'{args.mappa}: interni riempiti in {len(riempiti)} pezzi, '
              f'{sum(riempiti.values())} pixel')
        # e i buchi rimasti ai pezzi del catalogo (30/09, tua foto delle
        # rocce): il ritaglio automatico delle tavole ha bucato rocce, case,
        # carovane. Col colore vicino; non gli alberi (fra i rami il vuoto e'
        # giusto) ne' mura, recinti e vele
        chiusi = 0
        for nome, (im, meta) in pezzi.items():
            if nome.startswith(PREFISSI_PIENI):
                nuovo = chiudi_buchi(im, 900)
                if nuovo is not im:
                    pezzi[nome] = (nuovo, meta)
                    chiusi += 1
        print(f'{args.mappa}: buchi chiusi in {chiusi} pezzi del catalogo')
        foglio = da_valdarno(args.mappa, pezzi, alias, manifest)
        foglio.save(os.path.join(out, 'atlas_terrain.png'))

    # i lotti meta, per ultimi: quello della citta' e quello del porto; poi il
    # fumo dai loro camini (mappe.json, "ritocchi_meta": in pixel dello sprite
    # innestato, come "ritocchi")
    for lotto in ([LOTTI_CITTA[args.mappa]] if args.mappa in LOTTI_CITTA else []) + [PORTO, NAVE]:
        print(f'{args.mappa}: {innesta_lotto(pezzi, alias, args.img, lotto)} pezzi '
              f'meta da "{lotto[0].strip(" ·")}"')
    cfg = json.load(open(os.path.join(ROOT, 'tools', 'mappe.json'), encoding='utf8'))[args.mappa]
    fuoco_e_fumo(pezzi, {'ritocchi': cfg.get('ritocchi_meta') or {}})

    # il mare intorno al ponte della nave (nave.js, 07/10): le tile dell'acqua
    # cupa del terreno di questa citta', anche nell'atlante del mondo, perche'
    # le stanze disegnano solo da li'. Una tile e' una tile di terreno, 4 unita'
    terreno = Image.open(os.path.join(out, 'atlas_terrain.png')).convert('RGBA')
    T = manifest['terrain']['tile']
    riga = manifest['terrain']['order'].index('acqua_cupa')
    for v in range(manifest['terrain']['variants']):
        pezzi[f'mare_{v}'] = (terreno.crop((v * T, riga * T, (v + 1) * T, (riga + 1) * T)),
                              {'kind': 'terra', 'hu': 4.0, 'wu': 4.0})

    packer = build_assets.Packer(2048)
    for nome, (im, meta) in sorted(pezzi.items(), key=lambda kv: -kv[1][0].height):
        packer.add(nome, im, meta)
    sheet, rects = packer.render()
    for n, canone in alias.items():
        rects[n] = dict(rects[canone])
    sheet.save(os.path.join(out, 'atlas_world.png'))

    # impronta dei tre atlanti, come build_atlanti.py: finisce nelle URL
    h = hashlib.sha1()
    for f in ('atlas_world.png', 'atlas_chars.png', 'atlas_terrain.png'):
        h.update(open(os.path.join(out, f), 'rb').read())
    manifest['build'] = h.hexdigest()[:12]
    manifest['world']['size'] = list(sheet.size)
    manifest['world']['rects'] = rects
    json.dump(manifest, open(os.path.join(out, 'manifest.json'), 'w',
                             encoding='utf8'), separators=(',', ':'))
    nuovi = sum(1 for r in rects.values() if 'nano' in r)
    disegnati = sum(1 for r in rects.values() if r.get('disegnato'))
    print(f'atlante {sheet.size} · {len(rects)} pezzi, {nuovi} dal lotto nano, '
          f'{disegnati} disegnati da codice')


if __name__ == '__main__':
    main()
