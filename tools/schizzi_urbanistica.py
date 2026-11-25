"""schizzi_urbanistica.py — gli schizzi dell'urbanistica proposta (06/10) per
Valdarno, Fiordo (fiordo-3) e Costa (costa-5), accanto alla carta di oggi, in
out/urbanistica_*_2.png (il 06/10 sera anche il territorio: l'acqua
non sempre a ponente). Solo disegno: niente codice del gioco. Il pannello
"oggi" e' ritagliato dalle carte del collaudo (out/collaudo/). Coordinate in
tile (x a levante, y a sud)."""
import itertools
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

QUI = Path(__file__).resolve().parent
GIOCO = QUI.parent
OUT = GIOCO / "out"
S, N = 5, 128                       # px per tile, tile per lato del riquadro
F = ImageFont.truetype(r"C:\Windows\Fonts\arial.ttf", 13)
FB = ImageFont.truetype(r"C:\Windows\Fonts\arialbd.ttf", 15)
FT = ImageFont.truetype(r"C:\Windows\Fonts\arialbd.ttf", 19)
FN = ImageFont.truetype(r"C:\Windows\Fonts\arial.ttf", 14)

COL = {"bosco": (52, 92, 44), "prato": (122, 150, 78), "campi": (196, 164, 92),
       "acqua": (40, 86, 132), "borgo": (104, 88, 70), "via": (222, 210, 178),
       "pietra": (170, 170, 168), "legno": (122, 82, 46), "porta": (242, 193, 78),
       "corte": (184, 188, 196), "neve": (226, 232, 236), "sabbia": (198, 178, 120),
       "palme": (78, 112, 58), "giardini": (176, 160, 84)}


class Tavola:
    def __init__(self, x0, y0, fondo):
        self.x0, self.y0 = x0, y0
        self.im = Image.new("RGB", (N * S, N * S), COL[fondo])
        self.d = ImageDraw.Draw(self.im, "RGBA")
        self.etichette = []

    def p(self, x, y):
        return ((x - self.x0) * S, (y - self.y0) * S)

    def rett(self, x0, y0, x1, y1, col, bordo=None, w=2):
        self.d.rectangle([*self.p(x0, y0), *self.p(x1, y1)], fill=col, outline=bordo, width=w)

    def poli(self, pts, col, bordo=None, w=2):
        self.d.polygon([self.p(*q) for q in pts], fill=col, outline=bordo, width=w)

    def linea(self, pts, col, w):
        self.d.line([self.p(*q) for q in pts], fill=col, width=w, joint="curve")

    def via(self, pts, semi=1.2):
        self.linea(pts, (60, 50, 40), int(semi * 2 * S) + 2)
        self.linea(pts, COL["via"], int(semi * 2 * S))

    def muro(self, pts, chiuso=True):
        q = pts + [pts[0]] if chiuso else pts
        self.linea(q, (40, 40, 40), 8)
        self.linea(q, COL["pietra"], 5)

    def palizzata(self, pts):
        self.linea(pts, (50, 32, 18), 7)
        self.linea(pts, COL["legno"], 4)
        for (xa, ya), (xb, yb) in itertools.pairwise(pts):
            n = max(1, int(math.hypot(xb - xa, yb - ya) / 1.6))
            for k in range(n):
                x, y = self.p(xa + (xb - xa) * k / n, ya + (yb - ya) * k / n)
                self.d.ellipse([x - 2.5, y - 2.5, x + 2.5, y + 2.5], fill=(70, 44, 24))

    def porta(self, x, y, nome=None, dx=8, dy=-8):
        a, b = self.p(x, y)
        self.d.rectangle([a - 6, b - 6, a + 6, b + 6], fill=COL["porta"], outline=(60, 40, 10), width=2)
        if nome:
            self.etichetta(nome, x, y, dx, dy, piccola=True)

    def riempi(self, griglia, col):
        for ty in range(self.y0, self.y0 + N):
            for tx in range(self.x0, self.x0 + N):
                if griglia(tx, ty):
                    self.rett(tx, ty, tx + 1, ty + 1, col)

    def zona(self, pts, col, nome=None, dove=None):
        self.poli(pts, col)
        if nome:
            self.etichetta(nome, *dove, corsivo=True)

    def poggio(self, cx, cy, rx, ry):
        for f in (1.0, 0.72, 0.45):
            a, b = self.p(cx - rx * f, cy - ry * f)
            c, d = self.p(cx + rx * f, cy + ry * f)
            for k in range(0, 360, 12):
                self.d.arc([a, b, c, d], k, k + 6, fill=(70, 52, 30), width=2)

    def corte(self, x0, y0, x1, y1, torre):
        self.rett(x0, y0, x1, y1, COL["corte"], (40, 40, 40), 2)
        a, b = self.p(*torre)
        self.d.rectangle([a - 9, b - 9, a + 9, b + 9], fill=(110, 100, 90), outline=(20, 20, 20), width=2)

    def punto(self, x, y, nome, col=(240, 200, 80), dx=8, dy=-8):
        a, b = self.p(x, y)
        self.d.ellipse([a - 5, b - 5, a + 5, b + 5], fill=col, outline=(30, 20, 10), width=2)
        self.etichetta(nome, x, y, dx, dy)

    def etichetta(self, testo, x, y, dx=0, dy=0, piccola=False, corsivo=False):
        self.etichette.append((testo, self.p(x, y), dx, dy, piccola, corsivo))

    def chiudi(self, titolo, note):
        for testo, (a, b), dx, dy, piccola, corsivo in self.etichette:
            f = F if (piccola or not corsivo) else FB
            if corsivo:
                bb = self.d.textbbox((0, 0), testo, font=FB)
                x, y = a - (bb[2] - bb[0]) / 2, b - (bb[3] - bb[1]) / 2
                self.d.text((x, y), testo, font=FB, fill=(255, 250, 235), stroke_width=3,
                            stroke_fill=(30, 24, 18))
                continue
            bb = self.d.textbbox((a + dx, b + dy), testo, font=f)
            self.d.rectangle([bb[0] - 3, bb[1] - 2, bb[2] + 3, bb[3] + 2], fill=(239, 230, 208),
                             outline=(60, 50, 40))
            self.d.text((a + dx, b + dy), testo, font=f, fill=(30, 24, 18))
        # scala: 10 tile = 40 unita'
        a, b = 12, N * S - 18
        self.d.rectangle([a, b, a + 10 * S, b + 5], fill=(250, 250, 250), outline=(0, 0, 0))
        self.d.text((a + 10 * S + 6, b - 5), "10 tile", font=F, fill=(255, 255, 255),
                    stroke_width=2, stroke_fill=(0, 0, 0))
        return incornicia(self.im, titolo, note)


def incornicia(im, titolo, note):
    alto = 46 + 20 * len(note) + 14
    tela = Image.new("RGB", (im.width + 16, im.height + alto), (34, 28, 40))
    tela.paste(im, (8, 40))
    d = ImageDraw.Draw(tela)
    d.text((10, 10), titolo, font=FT, fill=(242, 193, 78))
    for k, r in enumerate(note):
        d.text((10, im.height + 48 + k * 20), r, font=FN, fill=(230, 224, 210))
    return tela


def oggi(file, pannello, riga, x0, y0, titolo, note):
    """Il riquadro della carta di oggi (le carte del collaudo: 2 px per tile)."""
    im = Image.open(OUT / "collaudo" / file).convert("RGB")
    ox, oy = pannello * 388, riga * 388
    im = im.crop((ox + 2 * x0, oy + 2 * y0, ox + 2 * (x0 + N), oy + 2 * (y0 + N)))
    return incornicia(im.resize((N * S, N * S), Image.NEAREST), titolo, note)


def affianca(tavole, nome, testa):
    alto = max(t.height for t in tavole)
    tela = Image.new("RGB", (sum(t.width for t in tavole) + 8 * (len(tavole) + 1), alto + 44),
                     (24, 20, 28))
    ImageDraw.Draw(tela).text((12, 10), testa, font=FT, fill=(255, 255, 255))
    x = 8
    for t in tavole:
        tela.paste(t, (x, 40))
        x += t.width + 8
    tela.save(OUT / nome)
    print(OUT / nome, tela.size)


# ------------------------------------------------------------------ Valdarno
# 06/10 (2): anche il territorio. L'Arno corre da levante a ponente a sud del
# borgo: il borgo sta sulla riva nord e sale al castello sul poggio; di la' dal
# ponte i campi e il Campo del Guado. La porta del fiume si vede di fronte.


def fiume_v(x):
    return 146 + 4 * math.sin(x * 0.045 + 0.5) + 2 * math.sin(x * 0.12 + 1.3)


def valdarno(variante):
    t = Tavola(14, 40, "prato")
    t.rett(14, 40, 142, 54, COL["bosco"])
    t.poli([(110, 40), (142, 40), (142, 94), (128, 94)], COL["bosco"])
    t.riempi(lambda x, y: (x < 46 or x > 128) and y > 98, COL["campi"])
    t.riempi(lambda x, y: y > fiume_v(x) + 4.6, COL["campi"])
    t.riempi(lambda x, y: abs(y - fiume_v(x)) < 4.6, COL["acqua"])
    t.poggio(90, 68, 24, 18)
    if variante == "A":
        cinta = [(50, 96), (72, 96), (72, 52), (108, 52), (108, 96), (124, 96), (124, 132), (50, 132)]
        t.poli(cinta, COL["borgo"])
    elif variante == "B":
        cinta = [(50, 128), (50, 108), (58, 96), (68, 88), (72, 64), (84, 50), (100, 48), (112, 58),
                 (114, 84), (124, 96), (126, 118), (120, 132), (96, 135), (64, 134)]
        t.poli(cinta, COL["borgo"])
    else:
        castrum = [(70, 50), (110, 50), (110, 90), (70, 90)]
        borgo = [(70, 88), (58, 94), (50, 106), (50, 122), (58, 132), (80, 135), (104, 135),
                 (120, 130), (126, 116), (122, 100), (110, 90)]
        t.poli([*borgo, (110, 90), (70, 90)], COL["borgo"])
        t.poli(castrum, (126, 112, 96))
    t.zona([(52, 116), (78, 116), (78, 131), (52, 131)], (70, 52, 30, 120))
    t.zona([(74, 100), (100, 100), (100, 120), (74, 120)], (210, 170, 90, 70))
    t.zona([(102, 116), (122, 116), (122, 130), (102, 130)], (90, 140, 60, 150))
    t.zona([(72, 80), (108, 80), (108, 96), (72, 96)], (150, 150, 200, 80))
    t.via([(82, 140), (82, 132), (83, 124), (84, 117)], 1.6)          # dal fiume
    t.via([(84, 117), (85, 110), (85, 103)], 3.2)                     # il mercatale
    t.via([(85, 103), (80, 96), (93, 90), (90, 84), (90, 78)], 1.5)   # sale al castello
    t.via([(84, 110), (66, 112), (50, 114), (30, 117), (14, 119)], 1.4)
    t.via([(85, 108), (104, 112), (124, 114), (142, 115)], 1.4)
    t.via([(132, 115), (134, 92), (140, 62), (142, 50)], 1.2)
    t.via([(82, 139), (104, 139), (104, 158), (100, 168)], 1.2)       # al ponte
    for x in (58, 64, 70):
        t.via([(x, 113), (x + 1, 131)], 0.8)
    t.via([(52, 124), (82, 124)], 0.8)
    t.via([(74, 92), (106, 92)], 1.0)
    t.via([(96, 104), (122, 104)], 0.9)
    t.via([(104, 112), (106, 130)], 0.8)
    if variante in ("A", "B"):
        t.muro(cinta)
    else:
        t.palizzata(borgo)
        t.muro(castrum)
    for x in (70, 76, 90, 96):
        b = fiume_v(x) - 4.6
        t.linea([(x, b - 0.5), (x, b + 5)], (150, 110, 70), 6)
    t.linea([(104, fiume_v(104) - 5.5), (104, fiume_v(104) + 5.5)], (120, 84, 50), 12)
    t.corte(82, 58, 98, 78, (90, 66))
    t.rett(88, 106, 95, 111, (200, 196, 186), (40, 40, 40), 2)
    t.rett(89, 100, 96, 105, (120, 130, 100), (40, 40, 40), 1)
    porte = {"A": [(82, 132), (50, 114), (124, 114)],
             "B": [(82, 134.5), (50, 116), (125.5, 114)],
             "C": [(82, 135), (50, 114), (124.5, 110), (90, 90)]}[variante]
    nomi = ["porta del fiume", "porta di ponente", "porta di levante", "porta del castello"]
    spost = [(-112, 4), (-122, -24), (8, -24), (10, -8)]
    for (x, y), n, (dx, dy) in zip(porte, nomi, spost, strict=False):
        t.porta(x, y, n, dx, dy)
    t.punto(86, 138, "approdo", dx=10, dy=-2)
    t.etichetta("ponte", 104, 150, 10, -6, piccola=True)
    t.punto(92, 108, "pieve", dx=10, dy=-6)
    t.etichetta("cimitero", 96, 102, 6, -10, piccola=True)
    t.etichetta("mercatale", 85, 112, -78, -2, piccola=True)
    t.punto(90, 66, "castello", dx=14, dy=-8)
    t.etichetta("corte", 90, 74, -16, -2, piccola=True)
    t.punto(61, 127, "fucina", dx=-56, dy=-4)
    t.punto(76, 128, "Lanterna Rossa", dx=8, dy=-4)
    t.etichetta("bassifondi", 64, 120, 0, 0, corsivo=True)
    t.etichetta("mercato", 78, 104, 0, 0, corsivo=True)
    t.etichetta("orti e vigne", 112, 124, 0, 0, corsivo=True)
    t.etichetta("nobili", 100, 86, 0, 0, corsivo=True)
    t.etichetta("poggio", 112, 64, 4, -8, piccola=True)
    t.etichetta("bosco e briganti", 138, 52, -110, -6, piccola=True)
    t.etichetta("fiume", 34, fiume_v(34), 0, 0, corsivo=True)
    t.etichetta("campi", 30, 106, 0, 0, corsivo=True)
    t.etichetta("di la' dal ponte: campi e Campo del Guado", 104, 162, -150, -2, piccola=True)
    titoli = {"A": "A · cinta di pietra a gradini", "B": "B · cinta di pietra libera",
              "C": "C · castello di pietra, borgo a palizzata"}
    note = {
        "A": ["Pezzi di oggi; il codice della cinta va riscritto",
              "per gli angoli rientranti. Contorno squadrato,",
              "a gradoni verso il poggio."],
        "B": ["Segue fiume e poggio, ma i tratti di sbieco",
              "vogliono campate, torri e porte viste di sbieco:",
              "una famiglia di pezzi nuova. Lavoro grosso."],
        "C": ["Il castello sul poggio (corte e nobili) in pietra;",
              "il borgo sotto in palizzata su terrapieno (pali del",
              "Fiordo e del recinto del 05/10): contorno libero."],
    }
    return t.chiudi(titoli[variante], note[variante])


affianca([oggi("generatore_carte.png", 0, 0, 14, 34, "Oggi",
               ["Fiume a ponente, rettangolo, 4 porte, croce di",
                "arterie, piazza tonda, castello in un angolo,",
                "quartieri a fasce verticali."]),
          valdarno("A"), valdarno("B"), valdarno("C")], "urbanistica_valdarno_2.png",
         "VALDARNO · il fiume corre a sud, da levante a ponente: il borgo sale dalla riva "
         "al castello sul poggio. Vie e luoghi uguali in A, B, C: cambia solo la cinta")


# -------------------------------------------------------------------- Fiordo
# Come Hedeby: il borgo sulla riva ovest di un'insenatura chiusa, che a levante
# si apre in un braccio di mare fino al bordo della carta (si salpa di li');
# il vallo di terra verso ponente


def acqua_f(x, y):
    if ((x - 120) / 24) ** 2 + ((y - 98) / 42) ** 2 < 1:
        return True
    return x >= 134 and abs(y - (98 + 7 * math.sin((x - 134) * 0.05))) < 7.5


def riva_f(y):
    return 120 - 24 * math.sqrt(max(0.0, 1 - ((y - 98) / 42) ** 2))


t = Tavola(26, 34, "neve")
t.poli([(26, 34), (62, 34), (50, 58), (26, 68)], COL["bosco"])
t.poli([(26, 122), (42, 118), (58, 150), (26, 160)], COL["bosco"])
t.rett(140, 34, 154, 86, COL["bosco"])
t.rett(140, 112, 154, 162, COL["bosco"])
t.rett(26, 152, 154, 162, (205, 190, 150))
t.riempi(acqua_f, COL["acqua"])
t.poggio(84, 44, 10, 7)
cx, cy, r = 98, 98, 36
arco = [(cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a)))
        for a in range(270, 89, -4)]
t.poli(arco + [(riva_f(y), y) for y in range(134, 61, -4)], (150, 140, 128))
rus = [(26, 101), (40, 100), (52, 99), (62, 98), (72, 99.5), (82, 97), (90, 98.5), (riva_f(98) + 1, 98)]
t.linea(rus, COL["acqua"], int(1.6 * S))
xs = [(riva_f(y) - 3, y) for y in range(64, 133, 4)]                     # la via di riva
t.via(xs, 1.1)
for y in range(70, 127, 8):                                              # i pontili, a levante
    t.linea([(riva_f(y) + 0.5, y), (riva_f(y) + 9, y)], (150, 110, 70), 6)
for y in (70, 78, 86, 94.5, 101.5, 110, 118, 126):                       # la lisca di pesce
    t.via([(cx - math.sqrt(r * r - (y - cy) ** 2) + 2.5, y), (riva_f(y) - 3, y)], 0.7)
t.via([(76, 104), (76, 128)], 0.7)
t.via([(62, 98), (50, 95.5), (26, 95)], 1.1)
t.via([(80, 66.8), (72, 56), (60, 44), (54, 34)], 1.0)
t.via([(80, 129.2), (78, 140), (70, 152), (66, 162)], 1.0)
t.palizzata([(riva_f(62) + 1, 62), *arco, (riva_f(134) + 1, 134)])
t.palizzata([(62, 104), (48, 110), (36, 114), (26, 116)])
t.corte(76, 72, 91, 86, (83.5, 78))
t.etichetta("il jarl sull'altura", 83, 72, -40, -26, piccola=True)
for x in (62, 84):
    t.linea([(x, 96.5), (x, 100)], (150, 110, 70), 7)
t.zona([(riva_f(90) - 8, 90), (riva_f(98) - 1, 90), (riva_f(98) - 1, 106), (riva_f(106) - 8, 106)],
       (210, 170, 90, 90))
t.porta(62, 98, "porta di ponente (sul ruscello)", -170, -28)
t.porta(80, 66.8, "porta nord", 8, -22)
t.porta(80, 129.2, "porta sud", 8, 6)
t.etichetta("mercato sulla spiaggia", 92, 106, -40, 8, piccola=True)
t.etichetta("artigiani e fucina lungo il ruscello", 70, 101, -60, 6, piccola=True)
t.etichetta("case lunghe", 86, 118, 0, 0, corsivo=True)
t.etichetta("case lunghe", 70, 88, 0, 0, corsivo=True)
t.d.ellipse([*t.p(50, 58), *t.p(58, 66)], outline=(60, 60, 60), width=3)
t.punto(54, 62, "thing (fuori)", dx=8, dy=8)
t.zona([(40, 124), (54, 124), (54, 136), (40, 136)], (52, 92, 44, 200))
t.punto(47, 130, "hof e bosco sacro", dx=10, dy=4)
t.d.ellipse([*t.p(88, 142), *t.p(100, 146)], outline=(90, 90, 90), width=3)
t.etichetta("nave di pietre e tumuli", 94, 144, 8, 6, piccola=True)
t.etichetta("altura (rifugio)", 84, 44, 14, -6, piccola=True)
t.etichetta("vallo di terra verso ponente", 36, 114, -40, 8, piccola=True)
t.etichetta("insenatura", 122, 98, 0, 0, corsivo=True)
t.etichetta("al mare aperto: si salpa di qui", 150, 112, -190, 16, piccola=True)
t.etichetta("campi", 120, 157, 0, 0, corsivo=True)
fj = t.chiudi("Proposta · Hedeby",
              ["L'acqua a levante: un'insenatura chiusa, e un braccio di mare fino al",
               "bordo della carta (si salpa di li'). Via di riva coi pontili, vie a lisca",
               "di pesce, mercato sulla spiaggia, il ruscello; thing e hof fuori, il",
               "vallo di terra a ponente. Pezzi di oggi; i pontili guardano a levante."])
affianca([oggi("generatore_carte.png", 0, 1, 14, 34, "Oggi (fiordo-3, Asknes)",
               ["Mare a ponente come il fiume di Valdarno; mezzaluna", "di palizzata sulla riva, dentro la croce di",
                "Valdarno: il thing come piazza, il jarl in mezzo."]), fj],
         "urbanistica_fiordo_2.png", "IL FIORDO · oggi e la proposta (atto II)")


# --------------------------------------------------------------------- Costa
# Come Mahdia, ma verso nord: la citta' su un promontorio, il mare su tre lati,
# una cinta sola (quella di terra, sul collo, vista di fronte), il porto
# scavato, la casba in punta


def coast_c(x):
    return 114 + 3 * math.sin(x * 0.08)


def largo(y):
    """Mezza larghezza del promontorio, in tile, alla riga y."""
    if y < 38:
        return 0
    if y < 54:
        return 26 * math.sqrt((y - 38) / 16)
    if y < 94:
        return 26
    if y < 106:
        return 26 - (y - 94) / 12 * 8
    return 18 + (y - 106) / 10 * 20


def acqua_c(x, y):
    if 56 <= x <= 64 and 86 <= y <= 94:                  # il porto scavato
        return True
    if 50 <= x <= 57 and 89 <= y <= 91:                  # la sua bocca
        return True
    if math.hypot(x - 122, y - 140) < 6:                 # l'oasi
        return True
    return y < coast_c(x) and abs(x - 80) >= largo(y)


def vicolo(t, x, y, d):
    """Un vicolo cieco: d = (dx, dy, lungo, ramo); finisce contro un muro."""
    dx, dy, lungo, ramo = d
    t.via([(x, y), (x + dx * lungo, y + dy * lungo)], 0.55)
    if ramo:
        mx, my = x + dx * lungo * 0.6, y + dy * lungo * 0.6
        t.via([(mx, my), (mx + dy * ramo, my + dx * ramo)], 0.5)


t = Tavola(16, 30, "sabbia")
t.riempi(lambda x, y: y > 124, COL["giardini"])
t.riempi(lambda x, y: y > coast_c(x) and (x < 52 or x > 110) and y < 146, COL["palme"])
t.riempi(acqua_c, COL["acqua"])
citta = ([(80 - largo(y), y) for y in range(102, 37, -2)] +
         [(80 + largo(y), y) for y in range(38, 103, 2)])
t.poli(citta, COL["borgo"])
t.poggio(80, 52, 14, 10)
t.via([(80, 158), (80, 102), (79, 94), (80, 86)], 1.3)
t.via([(80, 75), (81, 70), (80.5, 65)], 1.2)
t.via([(64, 90), (70, 84), (73, 80.5)], 1.2)
t.via([(87, 80.5), (96, 82), (104, 80)], 1.2)
t.via([(73, 75), (87, 75), (87, 86), (73, 86), (73, 75)], 0.6)
t.via([(80, 112), (100, 124), (116, 136)], 1.0)
for a, b in (((80, 86), (79.5, 98)), ((87, 80.5), (98, 81.5)), ((66, 88), (73, 81))):
    t.linea([a, b], (120, 60, 40), int(2.4 * S))
for i, y in enumerate((90, 95, 99)):
    vicolo(t, 79, y, (-1, 0, 12 + 2 * (i % 2), (3, -3, 0)[i]))
    vicolo(t, 81, y + 1.5, (1, 0, 12 + 2 * ((i + 1) % 2), (-3, 3, 2)[i]))
for i, x in enumerate((60, 67, 93, 100)):
    vicolo(t, x, 81, (0, -1, 10 + 2 * (i % 2), (-3, 4, 0, 3)[i]))
    vicolo(t, x + 2, 84, (0, 1, 8 + 2 * (i % 2), (3, -3, 4, 0)[i]))
vicolo(t, 79, 70, (-1, 0, 13, 3))
vicolo(t, 82, 71, (1, 0, 13, -3))
t.muro([(80 - largo(102), 102), (80 + largo(102), 102)], chiuso=False)
t.corte(72, 46, 89, 65, (80.5, 53))
t.rett(75, 76, 85, 85, (236, 230, 214), (40, 40, 40), 2)
for x in (58, 61):
    t.linea([(x, 86.5), (x, 89)], (150, 110, 70), 5)
t.porta(80, 102, "porta di terra (di fronte)", 10, 6)
t.punto(80, 80.5, "moschea grande (serve il pezzo)", (250, 250, 240), dx=12, dy=-36)
t.etichetta("suk coperto", 96, 82, 4, 6, piccola=True)
t.punto(88, 91, "hammam", dx=8, dy=-4)
t.punto(95, 97, "fabbri", dx=8, dy=-2)
t.etichetta("casba sul punto alto", 80, 46, -64, -26, piccola=True)
t.punto(60, 90, "porto scavato", dx=-110, dy=-26)
for x, y in ((72, 98), (90, 99), (64, 82)):
    t.punto(x, y, "funduq", (200, 120, 60), dx=6, dy=4)
t.rett(92, 108, 102, 114, (150, 140, 120), (40, 40, 40), 1)
t.etichetta("cimitero", 97, 111, 8, 6, piccola=True)
t.punto(30, 120, "pirati", (200, 80, 60), dx=8, dy=-4)
t.etichetta("oasi", 122, 140, -14, -30, piccola=True)
t.etichetta("giardini irrigati", 80, 140, 0, 0, corsivo=True)
t.etichetta("palmeto", 130, 124, 0, 0, corsivo=True)
t.etichetta("mare", 36, 60, 0, 0, corsivo=True)
t.etichetta("mare", 124, 60, 0, 0, corsivo=True)
co = t.chiudi("Proposta · Mahdia (verso nord)",
              ["Il mare su tre lati: una cinta sola, quella di terra sul collo del",
               "promontorio, vista di fronte con la sua porta (meno mura di oggi);",
               "il porto scavato; la casba in punta. Dentro, come prima: moschea",
               "grande all'incrocio, suk coperto, vicoli ciechi, funduq."])
affianca([oggi("costa_carte.png", 0, 0, 20, 34, "Oggi (costa-5, Qasr Zarqa)",
               ["Mare a ponente; il rettangolo di Valdarno con le", "vie a griglia, piazza del suk al centro,",
                "casba nell'angolo nord-est."]), co],
         "urbanistica_costa_2.png", "LA COSTA SARACENA · oggi e la proposta (atto IV)")
