"""collaudo.py — il gioco aperto in Chromium, fotografato nei posti che contano.

Fotografa i quartieri, la corte, un campo nemico, una pineta, la guida su un
carro, un acquisto alla fucina e la notte in piazza; stampa errori di console,
fps e le misure di ogni scena. Le foto vanno guardate: "si carica" non vuol
dire "si vede".

I luoghi si calcolano nella pagina dal mondo generato (baricentro di quartiere,
cella con piu' conifere, veicoli, committenti), non da coordinate scritte a
mano: se cambia la pianta il collaudo segue.

La firma del mondo (props, strade, collisioni) serve a dire se un refactoring
ha cambiato qualcosa: due collaudi con la stessa firma hanno lo stesso mondo.

Uso, col venv che ha Playwright (niente Pillow li', qui non serve):
    C:\\app\\mcp\\tools\\.venv\\Scripts\\python.exe tools/collaudo.py
    ... tools/collaudo.py carro fucina          (solo alcune scene)
    ... tools/collaudo.py --url http://127.0.0.1:8123/ --out out/collaudo

Il server deve girare: python -m http.server 8123 --bind 127.0.0.1
Esce con 1 se ci sono errori in console o una scena fallisce.
"""

import argparse
import base64
import json
import sys
import time
from itertools import pairwise
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from collaudo_atto4 import SCENE_ATTO4  # l'atto IV alla Costa (13/10)
from collaudo_atto5 import SCENE_ATTO5  # l'atto V, il ritorno a Valdarno (13/10)
from collaudo_bestie import SCENE_BESTIE  # asini, muli e cammelli ai carri (13/10)
from collaudo_campagna import SCENE_CAMPAGNA  # le scene della campagna (27/09)
from collaudo_comandi import SCENE_COMANDI  # telefono e tasto della musica (13/10)
from collaudo_nave import SCENE_NAVE  # la nave pirata dell'atto III (07/10)
from collaudo_nave_passi import SCENE_NAVE_PASSI  # i passi 2-4 dell'atto III (09/10)
from collaudo_nebbia import SCENE_NEBBIA  # la carta da scoprire (01/10)

RADICE = Path(__file__).resolve().parent.parent

# Aiutanti iniettati nella pagina: tutto cio' che serve a trovare i luoghi e a
# misurare, in un posto solo. Usano solo window.__game e le costanti globali
# dei sorgenti (TILE, GIVER_CAP); la pianta da __game.world.pianta.
AIUTANTI = r"""
window.__collaudo = {
  g() { return window.__game; },

  // un punto per quartiere: la via del quartiere piu' vicina al suo
  // baricentro (il baricentro da solo puo' cadere in un fiume o in un muro)
  quartieri() {
    const w = this.g().world, n = 192;
    const nomi = ['bosco', 'campi', 'bassifondi', 'mercato', 'nobile', 'porto'];
    const out = {};
    nomi.forEach((nome, d) => {
      let sx = 0, sy = 0, k = 0;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
        if (w.district[w.idx(x, y)] === d) { sx += x; sy += y; k++; }
      if (!k) return;
      const cx = sx / k, cy = sy / k;
      let best = null, bd = 1e9;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        if (w.district[w.idx(x, y)] !== d) continue;
        const pen = w.road[w.idx(x, y)] ? 0 : 400;
        const dd = (x - cx) ** 2 + (y - cy) ** 2 + pen;
        if (dd < bd) { bd = dd; best = [x, y]; }
      }
      out[nome] = { x: best[0] * TILE + TILE / 2, z: best[1] * TILE + TILE / 2 };
    });
    return out;
  },

  corte() {
    const { CORTE, CASTLE } = this.g().world.pianta;
    return { x: ((CORTE.x0 + CORTE.x1) / 2) * TILE,
             z: (CASTLE.y + 1) * TILE };
  },

  campo() {
    const a = this.g().world.accampamenti[0];
    return { x: a.x - 14, z: a.z + 6, nome: a.nome };
  },

  // la cella di 32 unita' con piu' conifere: li' e' la pineta
  pineta() {
    const con = new Set(['pino', 'pino_b', 'abete', 'faggio_pc', 'faggio_pc_b',
                         'pioppo_pc', 'pioppo_pc_b']);
    const celle = new Map();
    for (const p of this.g().world.props) {
      const k = Math.floor(p.x / 32) + ',' + Math.floor(p.z / 32);
      const c = celle.get(k) || { con: 0, alt: 0 };
      if (con.has(p.name)) c.con++;
      else if (/albero|quercia|frassino/.test(p.name)) c.alt++;
      celle.set(k, c);
    }
    let best = null, bv = -1;
    for (const [k, c] of celle) if (c.con - c.alt > bv) { bv = c.con - c.alt; best = [k, c]; }
    const [cx, cz] = best[0].split(',').map(Number);
    return { x: cx * 32 + 16, z: cz * 32 + 16,
             conifere: best[1].con, latifoglie: best[1].alt };
  },

  piazza() { return this.g().world.spawns.player; },

  fabbro() {
    return this.g().world.spawns.givers.find(q => q.name === GIVER_CAP.fabbro);
  },

  // un carro fermo con 12 unita' libere davanti in una delle quattro
  // direzioni (la scena lo guida di li'): il primo a caso poteva stare col
  // muso contro una casa, e la scena dipendeva dalla disposizione del mondo
  carro() {
    const g = this.g(), w = g.world;
    const DIR = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };
    for (const v of g.vehicles) {
      if (v.type !== 'carro' || v.rider) continue;
      for (const [tasto, [dx, dz]] of Object.entries(DIR)) {
        let libero = true;
        for (let k = 2; k <= 12 && libero; k += 1)
          libero = !w.blocked(v.x + dx * k, v.z + dz * k);
        if (libero) return { v, tasto };
      }
    }
    return null;
  },

  // quanti attori ci sono intorno al giocatore, e quanti sono fermi
  intorno(r) {
    const g = this.g(), p = g.player;
    const vicino = a => Math.hypot(a.x - p.x, a.z - p.z) < r;
    return { npc: g.npcs.filter(vicino).length,
             residenti: g.npcs.filter(a => vicino(a) && a.residente !== undefined).length,
             guardie: g.guards.filter(vicino).length,
             nemici: g.nemici.filter(a => vicino(a) && !a.dead).length,
             bestie: g.beasts.filter(vicino).length };
  },

  // Il messaggero, simulato fuori dal gioco sulla stessa griglia: 40 coppie
  // di punti di ronda dentro le mura, a 20-45 unita', 15 s per arrivare a
  // 3,2 dalla meta. 'dritto' e' il vecchio modo (punta la meta, striscia
  // lungo i muri), 'rotta' la navigazione di nav.js.
  messaggero(metodo) {
    const w = this.g().world, rnd = mulberry32(7), dt = 1 / 30, v = 3.2 * 1.25;
    const P = w.patrol;
    const coppie = [];
    for (let k = 0; coppie.length < 40 && k < 5000; k++) {
      const a = P[Math.floor(rnd() * P.length)], b = P[Math.floor(rnd() * P.length)];
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d > 20 && d < 45) coppie.push([a, b]);
    }
    let arrivati = 0, tempo = 0;
    const t0 = performance.now();
    for (const [a, b] of coppie) {
      const e = { x: a.x, z: a.z };
      let t = 0, ok = false;
      for (; t < 15; t += dt) {
        if (Math.hypot(b.x - e.x, b.z - e.z) < 3.2) { ok = true; break; }
        let h = Math.atan2(b.z - e.z, b.x - e.x);
        if (metodo === 'rotta') {
          const r = Nav.direzione(w, e, b, t);
          if (r !== null) h = r;
        }
        const bx = e.x, bz = e.z;
        [e.x, e.z] = w.move(e.x, e.z, Math.cos(h) * v * dt, Math.sin(h) * v * dt, 0.45);
        e.fermoT = (e.x === bx && e.z === bz) ? (e.fermoT || 0) + dt : 0;
      }
      if (ok) { arrivati++; tempo += t; }
    }
    return { coppie: coppie.length, arrivati,
             tempo_medio_s: arrivati ? +(tempo / arrivati).toFixed(1) : null,
             calcolo_ms: Math.round(performance.now() - t0) };
  },

  // firma del mondo: props, strade e collisioni in un hash FNV-1a
  firma() {
    const w = this.g().world;
    let h = 0x811c9dc5;
    const mix = s => { for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } };
    for (const p of w.props) mix(p.name + (p.x * 10 | 0) + ',' + (p.z * 10 | 0));
    for (let i = 0; i < w.road.length; i++) if (w.road[i]) mix(String(i));
    let solidi = 0;
    if (w.solid) for (let i = 0; i < w.solid.length; i++) if (w.solid[i]) {
      solidi++; mix('s' + i); }
    return { hash: h.toString(16), props: w.props.length,
             luci: w.lights.length, veicoli: w.spawns.vehicles.length,
             celle_solide: solidi, accampamenti: w.accampamenti.length };
  },
};
// il tempo non cambia da solo durante il collaudo: la pioggia sposterebbe
// le misure delle altre scene (gente, vista delle guardie, carri). Meteo e'
// un `const` del gioco: non sta su window, e `if (window.Meteo)` non scattava
// mai (29/09: la scena "traffico" cadeva coi carri nel fango del temporale)
if (typeof Meteo !== 'undefined') { Meteo.fissa(true); Meteo.imposta('sereno'); }
"""


class Collaudo:
    """Una pagina di gioco aperta, con foto e misure per scena."""

    def __init__(self, page, cartella):
        self.page = page
        self.cartella = cartella
        self.log = []
        page.on("console", lambda m: self.log.append((m.type, m.text)))
        page.on("pageerror", lambda e: self.log.append(("pageerror", str(e))))
        page.on("requestfailed", self._fallita)
        # un 404 non e' una richiesta fallita per Chromium: va guardato a parte
        page.on("response", lambda r: r.status >= 400 and self.log.append(
            ("404?", f"{r.status} {r.url}")))

    def _fallita(self, r):
        # le HEAD con cui index.html legge le versioni degli script arrivano
        # (200 e Last-Modified), ma Chromium le chiude come ERR_ABORTED
        if r.method == "HEAD" and r.failure == "net::ERR_ABORTED":
            return
        # le musiche vanno in streaming (colonna.js): se la pagina si ricarica
        # o cambia citta' mentre un brano scarica, Chromium chiude la richiesta
        # come ERR_ABORTED (08/10). Un file che manca da' un 404 vero (sotto)
        if "/assets/audio/" in r.url and r.failure == "net::ERR_ABORTED":
            return
        self.log.append(("404?", f"{r.url} — {r.failure}"))

    def js(self, codice, arg=None):
        return self.page.evaluate(codice, arg)

    def tp(self, punto, attesa=2.5):
        self.js("([x, z]) => __game.debug.tp(x, z)", [punto["x"], punto["z"]])
        self.page.wait_for_timeout(int(attesa * 1000))

    def foto(self, nome):
        percorso = self.cartella / f"{nome}.png"
        self.page.screenshot(path=str(percorso))
        return str(percorso.resolve().relative_to(RADICE)).replace("\\", "/")

    def fps(self):
        return round(self.js("() => __game.fps"), 1)

    def pos(self):
        return self.js("() => ({x: +__game.player.x.toFixed(1), "
                       "z: +__game.player.z.toFixed(1)})")


# ---------------------------------------------------------------- scene

def scena_quartieri(c):
    punti = c.js("() => __collaudo.quartieri()")
    out = {}
    for nome, p in punti.items():
        c.tp(p, 3.0)
        out[nome] = {"punto": p, "foto": c.foto(f"quartiere_{nome}"),
                     "fps": c.fps(), **c.js("() => __collaudo.intorno(45)")}
    return out


def scena_corte(c):
    p = c.js("() => __collaudo.corte()")
    c.tp(p, 3.0)
    return {"punto": p, "foto": c.foto("corte"), "fps": c.fps(),
            **c.js("() => __collaudo.intorno(40)")}


def scena_campo(c):
    p = c.js("() => __collaudo.campo()")
    c.tp(p, 2.0)
    return {"punto": p, "foto": c.foto("campo_nemico"), "fps": c.fps(),
            **c.js("() => __collaudo.intorno(60)")}


def scena_pineta(c):
    p = c.js("() => __collaudo.pineta()")
    c.tp(p, 3.0)
    return {"punto": p, "foto": c.foto("pineta"), "fps": c.fps()}


def scena_carro(c):
    v = c.js("() => { const q = __collaudo.carro(); "
             "return q && {x: q.v.x, z: q.v.z, type: q.v.type, name: q.v.name, tasto: q.tasto}; }")
    if not v:
        return {"errore": "nessun carro libero"}
    c.tp({"x": v["x"] + 1.5, "z": v["z"] + 1.0}, 1.5)
    # un mezzo fermo non e' un furto: anche con una guardia a due passi che
    # guarda, salire non da' stelle
    # la guardia sta nella direzione libera (di lato una casa le toglieva la
    # vista); dopo la salita si sposta, se no il carro la travolge
    dx, dz = {"right": (1, 0), "left": (-1, 0), "down": (0, 1), "up": (0, -1)}[v["tasto"]]
    c.js(f"() => {{ __game.player.wanted = 0; const p = __game.player; "
         f"const g = __game.guards.find(g => !g.dead); window.__testimone = g; "
         f"if (g) {{ g.x = p.x + {dx * 4}; g.z = p.z + {dz * 4}; }} }}")
    testimone = c.js("() => !!__game.debug.testimone()")
    c.page.keyboard.press("e")
    c.page.wait_for_timeout(300)
    a_cassetta = c.js("() => !!__game.player.vehicle")
    stelle = c.js("() => ({stelle: __game.player.stars, taglia: __game.player.wanted})")
    c.js("() => { const g = window.__testimone; if (g) { g.x += 40; g.z += 40; } }")
    prima = c.pos()
    tasto = {"right": "ArrowRight", "left": "ArrowLeft", "down": "ArrowDown", "up": "ArrowUp"}[v["tasto"]]
    c.page.keyboard.down(tasto)
    c.page.wait_for_timeout(1800)
    foto = c.foto("carro_in_corsa")
    c.page.keyboard.up(tasto)
    dopo = c.pos()
    spostamento = round(((dopo["x"] - prima["x"]) ** 2 +
                         (dopo["z"] - prima["z"]) ** 2) ** 0.5, 1)
    esito = {"veicolo": v, "a_cassetta": a_cassetta, "testimone": testimone,
             "dopo_la_salita": stelle,
             "spostamento_1_8s": spostamento, "foto": foto, "fps": c.fps()}
    if not a_cassetta or spostamento < 3:
        esito["errore"] = "non si sale o il carro non si muove"
    elif stelle["taglia"] or not testimone:
        esito["errore"] = "un mezzo fermo non dev'essere un furto (e serve un testimone)"
    c.page.keyboard.press("e")          # si scende, per le scene dopo
    c.js("() => { __game.player.wanted = 0; }")   # il carro puo' aver travolto qualcuno
    return esito


def _misura_traffico(c):
    return c.js("""() => Traffico.carri.map(v => {
      const m = v.misure, marcia = m.tempo - m.attesa - m.fermo;
      return { nome: v.name, carico: v.carico, tempo: +m.tempo.toFixed(1),
               strada: +m.strada.toFixed(1),
               media: +(m.strada / (m.tempo || 1)).toFixed(2),
               in_marcia: +(m.strada / (marcia || 1)).toFixed(2),
               attesa: +m.attesa.toFixed(1), fermo: +m.fermo.toFixed(1),
               bloccato_max: +m.bloccato.toFixed(1),
               distanza: +Math.hypot(v.x - __game.player.x,
                                     v.z - __game.player.z).toFixed(1) };
    })""")


def scena_traffico(c):
    """Carri in transito: 2-3 attorno al ladro, a ~4,5, per le strade. 20 s in
    piazza e 20 s sulla strada del bosco verso l'accampamento dei briganti;
    velocita' reale (media, e in marcia senza attese e urti) e incastrati."""
    luoghi = {"piazza": c.js("() => __collaudo.piazza()"),
              "bosco": c.js("() => { const s = __game.world.pianta.STRADE_CAMPAGNA[2]; return "
                            "{x: (s[0] + s[2]) / 2 * TILE + TILE / 2, "
                            "z: (s[1] + s[3]) / 2 * TILE + TILE / 2}; }")}
    out = {}
    # nel bosco i lupi sbranano il ladro fermo, che rinasce alla pieve: la
    # misura finirebbe in citta'
    c.js("() => { __game.player.hp = 1e6; }")
    for nome, p in luoghi.items():
        c.tp(p, 0.5)
        c.page.wait_for_timeout(20000)
        carri = _misura_traffico(c)
        # la foto accanto al carro piu' vicino: nascono fuori inquadratura
        vicino = c.js("() => { const p = __game.player; const v = Traffico.carri"
                      ".slice().sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - "
                      "Math.hypot(b.x - p.x, b.z - p.z))[0]; "
                      "return v && {x: v.x, z: v.z}; }")
        if vicino:
            _accanto(c, vicino, 3.0, 4.0)
        tempi = [k for k in carri if k["tempo"] > 5]
        out[nome] = {
            "carri": len(carri), "misure": carri,
            "velocita_media": round(sum(k["strada"] for k in tempi) /
                                    (sum(k["tempo"] for k in tempi) or 1), 2),
            "in_marcia": round(sum(k["in_marcia"] for k in tempi) / (len(tempi) or 1), 2),
            "incastrati": sum(1 for k in carri if k["bloccato_max"] > 5),
            "foto": c.foto(f"traffico_{nome}")}
    c.js("() => { const p = __game.player; p.hp = p.maxHp; }")
    out["grafo"] = c.js("() => { const g = Traffico.grafo; return {nodi: g.nodi.length, "
                        "archi: g.archi, componenti: g.componenti, "
                        "nella_rete: g.nella_rete, ms: g.ms}; }")
    out["conti"] = c.js("() => Traffico.conti")
    for nome in luoghi:
        o = out[nome]
        # la media con le attese (gente davanti al muso) oscilla: 2,94 il 09/10,
        # 2,95 il 14/10, da sole 3,5-4,1. Appena sotto 3 passa se, quando
        # vanno, i carri vanno davvero (in marcia almeno 3,5)
        va = 3.0 <= o["velocita_media"] <= 5.0 or (o["velocita_media"] >= 2.7 and o["in_marcia"] >= 3.5)
        if not 2 <= o["carri"] <= 3 or not va:
            out["errore"] = (f"traffico a {nome}: {o['carri']} carri a {o['velocita_media']} "
                             f"(in marcia {o['in_marcia']})")
    return out


def _ruba_un_carro(c, con_guardia):
    """Aspetta un carro in transito, ci si mette accanto e preme E."""
    for _ in range(40):
        if c.js("() => Traffico.carri.length"):
            break
        c.page.wait_for_timeout(250)
    # accanto al carro, di fianco (davanti lo fermerebbe); se serve una
    # guardia, una a quattro passi sulla stessa via
    prima = c.js("""(g) => {
      const v = Traffico.carri[0], p = __game.player;
      if (!v) return null;
      const lx = Math.cos(v.rot + Math.PI / 2), lz = Math.sin(v.rot + Math.PI / 2);
      p.x = v.x + lx * 1.6; p.z = v.z + lz * 1.6; p.wanted = 0;
      __game.cam.x = p.x; __game.cam.z = p.z;
      if (g) { const q = __game.guards.find(q => !q.dead);
               if (q) { q.x = v.x - Math.cos(v.rot) * 4; q.z = v.z - Math.sin(v.rot) * 4; } }
      window.__carro = v;
      return { soldi: p.money, carico: v.carico,
               testimone: !!__game.debug.testimone(v.x, v.z),
               guardie_entro_40: __game.guards.filter(q => !q.dead &&
                 Math.hypot(q.x - v.x, q.z - v.z) < 40).length };
    }""", con_guardia)
    if not prima:
        return {"errore": "nessun carro in transito"}
    c.page.keyboard.press("e")
    c.page.wait_for_timeout(250)
    messaggio = c.page.locator("#msg").inner_text()
    subito = c.js("""() => {
      const v = window.__carro, g = __game, n = g.npcs.find(n => n.prof === 'carrettiere'
        && Math.hypot(n.x - v.x, n.z - v.z) < 4);
      window.__carrettiere = n;
      return { a_cassetta: g.player.vehicle === v, in_traffico: Traffico.carri.includes(v),
               carico_rimasto: v.carico, soldi: g.player.money, stelle: g.player.stars,
               carrettiere: n ? { stato: n.state, vivo: !n.dead,
                 da_cassetta: +Math.hypot(n.x - v.x, n.z - v.z).toFixed(1) } : null };
    }""")
    foto = c.foto("furto_carro_" + ("citta" if con_guardia else "bosco"))
    c.page.wait_for_timeout(1500)
    dopo = c.js("() => { const n = window.__carrettiere, v = window.__carro; "
                "return n && {stato: n.state, vivo: !n.dead, colpibile: __game.npcs.includes(n), "
                "dal_carro: +Math.hypot(n.x - v.x, n.z - v.z).toFixed(1)}; }")
    c.page.keyboard.press("e")                       # si scende
    c.page.wait_for_timeout(300)
    bottino = subito["soldi"] - prima["soldi"]
    esito = {"prima": prima, "messaggio": messaggio, "subito": subito,
             "dopo_1_5s": dopo, "bottino": bottino, "foto": foto}
    ok = (subito["a_cassetta"] and not subito["in_traffico"]
          and subito["carico_rimasto"] == 0 and 30 <= bottino <= 80
          and subito["carrettiere"] and dopo and dopo["colpibile"]
          and dopo["dal_carro"] > subito["carrettiere"]["da_cassetta"])
    if not ok:
        esito["errore"] = "furto del carro non torna"
    return esito


def scena_furto_carro(c):
    """Rubare un carro in transito: in citta' con una guardia a quattro passi
    (reato, stella), sulla strada del bosco senza guardie (niente stella);
    bottino 30-80 in entrambi i casi, carrettiere a terra che fugge."""
    c.js("() => { __game.player.hp = 1e6; }")
    c.tp(c.js("() => __collaudo.piazza()"), 1.0)
    citta = _ruba_un_carro(c, True)
    # la stella della citta' va tolta prima del salto: con la taglia le
    # guardie nascono anche nel bosco (ti inseguono), ed e' giusto cosi'
    c.js("() => { __game.player.wanted = 0; }")
    # (06/10: la strada di campagna piu' lontana dal borgo, non la terza)
    c.tp(c.js("() => { const P = __game.world.pianta, W = P.WALL; "
              "const cx = (W.x0 + W.x1) / 2, cy = (W.y0 + W.y1) / 2; "
              "const m = P.STRADE_CAMPAGNA.map(s => [(s[0] + s[2]) / 2, (s[1] + s[3]) / 2]) "
              ".sort((a, b) => Math.hypot(b[0] - cx, b[1] - cy) - Math.hypot(a[0] - cx, a[1] - cy))[0]; "
              "return {x: m[0] * TILE + TILE / 2, z: m[1] * TILE + TILE / 2}; }"), 1.0)
    bosco = _ruba_un_carro(c, False)
    c.js("() => { const p = __game.player; p.hp = p.maxHp; p.wanted = 0; }")
    esito = {"citta": citta, "bosco": bosco}
    if "errore" in citta or "errore" in bosco:
        esito["errore"] = "furto del carro non torna"
    elif not citta["subito"]["stelle"] or bosco["subito"]["stelle"]:
        esito["errore"] = "la regola dei testimoni non torna (citta' con stella, bosco senza)"
    return esito


def _urto(c, salute_a, salute_b):
    """Carro A fermo sulla via, carro B 9 unita' piu' a levante; si sale su A e
    si va a levante per 1,4 s. Ritorna lo stato dei due dopo l'urto."""
    c.js("""([ha, hb]) => {
      const g = __game, p = window.__tratto, [a, b] = window.__coppia;
      for (const [v, dx, h] of [[a, 0, ha], [b, 9, hb]]) {
        v.x = p.x + dx; v.z = p.z; v.speed = 0; v.hp = h; v.rot = dx ? Math.PI / 2 : 0;
      }
      g.player.x = a.x; g.player.z = a.z + 1.5; g.cam.x = a.x; g.cam.z = a.z;
    }""", [salute_a, salute_b])
    c.page.wait_for_timeout(300)
    c.page.keyboard.press("e")
    c.page.wait_for_timeout(200)
    c.page.keyboard.down("ArrowRight")
    c.page.wait_for_timeout(1400)
    c.page.keyboard.up("ArrowRight")
    c.page.wait_for_timeout(300)
    return c.js("""() => { const [a, b] = window.__coppia, g = __game;
      return { a: { hp: Math.round(a.hp), rotto: !!a.rotto, nome: a.name },
               b: { hp: Math.round(b.hp), rotto: !!b.rotto,
                    spinto: +Math.hypot(b.x - window.__tratto.x - 9,
                                        b.z - window.__tratto.z).toFixed(1) },
               a_cassetta: g.player.vehicle === a,
               nel_mondo: g.vehicles.includes(a) }; }""")


def scena_incidente(c):
    """Incidenti: un carro contro un altro carro prende e da' la botta, e
    quando la salute finisce si sfascia (carro_rotto, a piedi)."""
    c.js("() => { __game.player.hp = 1e6; __game.player.wanted = 0; }")
    c.tp(c.js("() => __collaudo.piazza()"), 1.0)
    trovato = c.js("""() => {
      const w = __game.world, [x0, y0, x1, y1] = w.pianta.VIE[0];
      for (let t = 0.05; t < 0.5; t += 0.01) {
        const x = (x0 + (x1 - x0) * t) * TILE + 2, z = (y0 + (y1 - y0) * t) * TILE + 2;
        if (Nav.sgombro(w, x - 3, z, x + 16, z, 1.8)) {
          window.__tratto = { x, z };
          const carri = __game.vehicles.filter(v => v.type === 'carro' && !v.rider
                                                && !v.rotto && !v.transito);
          window.__coppia = carri.slice(0, 2);
          return { x, z, carri: carri.length };
        }
      }
      return null; }""")
    if not trovato:
        return {"errore": "nessun tratto di via sgombro per l'urto"}
    c.tp(trovato, 1.0)
    primo = _urto(c, 90, 90)
    foto = [c.foto("incidente_urto")]
    if primo["a_cassetta"]:
        c.page.keyboard.press("e")
    secondo = _urto(c, 10, 30)
    c.page.wait_for_timeout(600)
    foto.append(c.foto("incidente_sfasciato"))
    c.js("() => { const p = __game.player; p.hp = p.maxHp; }")
    esito = {"tratto": trovato, "primo_urto": primo, "secondo_urto": secondo,
             "foto": foto}
    if (primo["a"]["hp"] >= 90 or primo["b"]["hp"] >= 90 or primo["a"]["rotto"]
            or not secondo["a"]["rotto"] or secondo["a_cassetta"]
            or secondo["a"]["nome"] != "carro_rotto"):
        esito["errore"] = "gli urti fra carri non tornano"
    return esito


def _entra(c, tipo):
    """Davanti alla porta della stanza `tipo`, E, e si aspetta la dissolvenza."""
    porta = c.js("(t) => { const p = __game.Interni.porte.find(q => q.tipo === t); "
                 "return p && {x: p.x, z: p.z}; }", tipo)
    # un assalto lasciato dalla scena "assalti" porta la mischia alle porte
    # (e ai piantoni): la Lanterna sta a otto tile da quella di ponente
    c.js("() => { const g = __game; g.assalto.attivo = false; g.assalto.prossimo = 999; }")
    c.tp({"x": porta["x"], "z": porta["z"] + 1.0}, 2.0)
    # con la taglia la porta resta chiusa: una scena di prima puo' averla lasciata
    c.js("() => { __game.player.wanted = 0; }")
    fuori = c.page.locator("#prompt").inner_text()
    c.page.keyboard.press("e")
    c.page.wait_for_timeout(1200)
    return porta, fuori


def _davanti_a(c, nome, dz=1.6):
    """Il ladro davanti a un residente della stanza (per nome)."""
    c.js("([n, dz]) => { const s = __game.Interni.stanza; "
         "const r = s.residenti.find(q => q.nome === n); "
         "__game.player.x = r.x; __game.player.z = r.z + dz; }", [nome, dz])
    c.page.wait_for_timeout(400)


def _esci(c):
    c.js("() => { const e = __game.Interni.stanza.entrata; "
         "__game.player.x = e.x; __game.player.z = e.z; }")
    c.page.keyboard.down("ArrowDown")
    c.page.wait_for_timeout(1600)
    c.page.keyboard.up("ArrowDown")
    c.page.wait_for_timeout(900)


def scena_fucina(c):
    """La bottega di Ferrante: si entra, B davanti a lui, si compra davvero."""
    _porta, fuori = _entra(c, "fucina")
    dentro = c.js("() => __game.Interni.dentro")
    _davanti_a(c, "Ferrante", 3.9)   # davanti al bancone, non dentro
    suggerimento = c.page.locator("#prompt").inner_text()
    c.js("() => { __game.player.money = 1000; }")
    c.page.keyboard.press("b")
    c.page.wait_for_timeout(500)
    aperta = c.page.locator("#bottega").is_visible()
    foto_aperta = c.foto("fucina_bottega")
    prima = c.js("() => ({soldi: __game.player.money, "
                 "armi: __game.player.arsenale.slice()})")
    # clic vero sul bottone: il difetto del 22/09 era il clic che si perdeva
    bottoni = c.page.locator("#bottegaBody button[data-arma]")
    scelta = None
    for i in range(bottoni.count()):
        chiave = bottoni.nth(i).get_attribute("data-arma")
        if chiave not in prima["armi"] and bottoni.nth(i).is_enabled():
            scelta = chiave
            bottoni.nth(i).click()
            break
    c.page.wait_for_timeout(400)
    dopo = c.js("() => ({soldi: __game.player.money, "
                "armi: __game.player.arsenale.slice()})")
    c.page.keyboard.press("Escape")
    c.page.wait_for_timeout(300)
    foto_dentro = c.foto("fucina_dentro")
    _esci(c)
    fuori_b = c.js("() => { const f = __game.Interni.dentro; return f; }")
    # uscito, ci si muove (26/09: il banco davanti all'uscio chiudeva il ladro)
    liberi = 0
    for tasto in ("ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"):
        a = c.js("() => [__game.player.x, __game.player.z]")
        c.page.keyboard.down(tasto)
        c.page.wait_for_timeout(400)
        c.page.keyboard.up(tasto)
        b = c.js("() => [__game.player.x, __game.player.z]")
        liberi += abs(b[0] - a[0]) + abs(b[1] - a[1]) > 0.5
    c.page.keyboard.press("b")                   # fuori B non apre niente
    c.page.wait_for_timeout(300)
    fuori_aperta = c.page.locator("#bottega").is_visible()
    esito = {"suggerimento_porta": fuori, "dentro": dentro,
             "suggerimento_ferrante": suggerimento, "bottega_aperta": aperta,
             "comprata": scelta, "soldi": [prima["soldi"], dopo["soldi"]],
             "uscito": not fuori_b, "bottega_fuori": fuori_aperta, "direzioni_libere": liberi,
             "foto": [foto_aperta, foto_dentro]}
    if (not dentro or not aperta or not scelta or scelta not in dopo["armi"]
            or fuori_b or fuori_aperta or liberi < 3):
        esito["errore"] = "bottega di Ferrante non torna (o all'uscita non ci si muove)"
    return esito

def scena_pieve_castello(c):
    """La pieve e il castello: ci si entra come negli altri posti. Il pievano
    cura per un'offerta di 10; nella sala del trono il Re parla."""
    c.js("() => { const p = __game.player; p.hp = 40; p.money = 100; p.wanted = 0; }")
    porta, fuori = _entra(c, "chiesa")
    dentro = c.js("() => __game.Interni.dentro && __game.Interni.stanza.tipologia")
    foto = [c.foto("pieve_dentro")]
    _davanti_a(c, "il pievano", 1.8)
    sugg = c.page.locator("#prompt").inner_text()
    c.page.keyboard.press("e")
    c.page.wait_for_timeout(400)
    cura = c.js("() => ({hp: Math.round(__game.player.hp), soldi: __game.player.money})")
    _esci(c)
    uscito = not c.js("() => __game.Interni.dentro")
    porta_c, fuori_c = _entra(c, "castello")
    dentro_c = c.js("() => __game.Interni.dentro && __game.Interni.stanza.tipologia")
    _davanti_a(c, "il Re", 1.8)
    c.page.keyboard.press("e")
    c.page.wait_for_timeout(400)
    re = c.page.locator("#msg").inner_text()
    foto.append(c.foto("castello_dentro"))
    re_in_stanza = c.js("() => __game.npcs.filter(n => n.inStanza && "
                        "n.sprite === 'MiniKingMan').length")
    _esci(c)
    uscito_c = not c.js("() => __game.Interni.dentro")
    re_fuori = c.js("() => __game.npcs.filter(n => !n.inStanza && "
                    "n.sprite === 'MiniKingMan').length")
    c.page.keyboard.press("m")
    c.page.wait_for_timeout(500)
    foto.append(c.foto("carta_pieve"))
    c.page.keyboard.press("Escape")
    esito = {"pieve": {"porta": porta, "suggerimento_porta": fuori, "dentro": dentro,
                       "suggerimento_pievano": sugg, "dopo_la_cura": cura,
                       "uscito": uscito},
             "castello": {"porta": porta_c, "suggerimento_porta": fuori_c,
                          "dentro": dentro_c, "il_re_dice": re,
                          "re_dentro": re_in_stanza, "re_fuori": re_fuori,
                          "uscito": uscito_c},
             "foto": foto}
    if (dentro != "chiesa" or cura != {"hp": 100, "soldi": 90} or not uscito
            or dentro_c != "castello" or not re.startswith("Il Re") or not uscito_c
            or re_in_stanza != 1 or re_fuori):
        esito["errore"] = "pieve o castello non tornano"
    return esito


def scena_barca(c):
    """Barche: dalla testa del molo si sale (E), si va a vela sul fiume senza
    mai uscire dall'acqua, e si scende solo a riva."""
    testa = c.js("() => { const b = __game.vehicles.find(v => v.type === 'barca'); "
                 "if (!b) return null; const m = __game.world.moli.filter((q, i) => i % 2)"
                 ".sort((p, q) => Math.hypot(p.x0 - b.x, p.z0 - b.z) - "
                 "Math.hypot(q.x0 - b.x, q.z0 - b.z))[0]; "
                 "return {x: (m.x0 + m.x1) / 2, z: (m.z0 + m.z1) / 2, "
                 "barche: __game.vehicles.filter(v => v.type === 'barca').length}; }")
    if not testa:
        return {"errore": "nessuna barca nel porto"}
    c.js("() => { __game.player.hp = 1e6; }")
    c.tp(testa, 2.0)
    sul_molo = c.js("() => !__game.world.blocked(__game.player.x, __game.player.z)")
    foto = [c.foto("barca_molo")]
    c.page.keyboard.press("e")
    c.page.wait_for_timeout(300)
    a_bordo = c.js("() => __game.player.vehicle && __game.player.vehicle.type")
    # lungo il fiume e verso riva: col fiume a sud (il borgo di fiume, 06/10)
    # a ponente e a nord; col fiume a ponente a nord e a levante
    sud = c.js("() => __game.world.pianta.LATO_ACQUA === 'S'")
    lungo, a_riva = ("ArrowLeft", "ArrowUp") if sud else ("ArrowUp", "ArrowRight")
    prima = c.pos()
    fuori_acqua = 0
    c.page.keyboard.down(lungo)
    for _ in range(12):
        c.page.wait_for_timeout(250)
        fuori_acqua += c.js("() => { const v = __game.player.vehicle, w = __game.world; "
                            "return v && w.solid[Math.floor(v.z / w.solidS) * w.solidN + "
                            "Math.floor(v.x / w.solidS)] !== 2 ? 1 : 0; }")
    foto.append(c.foto("barca_a_vela"))
    c.page.keyboard.up(lungo)
    dopo = c.pos()
    percorso = round(((dopo["x"] - prima["x"]) ** 2 + (dopo["z"] - prima["z"]) ** 2) ** 0.5, 1)
    # in mezzo al fiume non si scende; poi si torna verso riva
    c.page.keyboard.press("e")
    c.page.wait_for_timeout(200)
    in_mezzo = c.js("() => !!__game.player.vehicle")
    c.page.keyboard.down(a_riva)
    c.page.wait_for_timeout(2500)
    c.page.keyboard.up(a_riva)
    c.page.wait_for_timeout(600)
    c.page.keyboard.press("e")
    c.page.wait_for_timeout(300)
    sceso = c.js("() => ({a_bordo: !!__game.player.vehicle, "
                 "all_asciutto: !__game.world.blocked(__game.player.x, __game.player.z)})")
    c.js("() => { const p = __game.player; p.hp = p.maxHp; }")
    esito = {"molo": testa, "sul_molo": sul_molo, "a_bordo": a_bordo,
             "percorso_3s": percorso, "campioni_fuori_acqua": fuori_acqua,
             "in_mezzo_al_fiume_resta_a_bordo": in_mezzo, "sceso": sceso, "foto": foto}
    if (not sul_molo or a_bordo != "barca" or percorso < 8 or fuori_acqua
            or sceso["a_bordo"] or not sceso["all_asciutto"]):
        esito["errore"] = "la barca non torna"
    return esito


def scena_notte(c):
    p = c.js("() => __collaudo.piazza()")
    c.js("() => __game.debug.setDay(0.93)")
    c.tp(p, 4.0)
    esito = {"punto": p, "foto": c.foto("notte_piazza"), "fps": c.fps(),
             **c.js("() => __collaudo.intorno(45)")}
    c.js("() => __game.debug.setDay(0.35)")
    return esito


def _accanto(c, a, dx=0.0, dz=4.0):
    # sposta il giocatore senza debug.tp, che svuoterebbe la folla (e con
    # lei i bersagli appena segnati)
    c.js("([x, z]) => { const g = __game; g.player.x = x; g.player.z = z; "
         "g.cam.x = x; g.cam.z = z; }", [a["x"] + dx, a["z"] + dz])
    c.page.wait_for_timeout(1500)


def scena_committente(c):
    """La corona del capitolo 1: sull'uscio della bottega e, dentro, su Ferrante."""
    porta = c.js("() => { const p = __game.Interni.porte.find(q => q.tipo === 'fucina'); "
                 "return {x: p.x, z: p.z}; }")
    c.tp({"x": porta["x"] + 2.0, "z": porta["z"] + 5.0}, 2.5)
    foto = [c.foto("committente_corona")]
    _entra(c, "fucina")
    _davanti_a(c, "Ferrante", 3.5)
    foto.append(c.foto("committente_dentro"))
    _esci(c)
    return {"foto": foto}

def scena_bersagli(c):
    """Caccia (capitolo 2) e riscossione (capitolo 1): il segno sopra la testa."""
    c.tp(c.js("() => __collaudo.piazza()"), 2.5)
    c.js("() => __game.debug.missione(1, 1)")
    c.page.wait_for_timeout(300)
    t = c.js("() => { const m = __game.campagna.attiva; "
             "return {tipo: m.tipo, x: m.target.x, z: m.target.z}; }")
    # fermo, a qualche passo: altrimenti ti corre addosso e i due sprite
    # si coprono
    c.js("() => { __game.campagna.attiva.target.speed = 0; }")
    _accanto(c, t, 5.0, 3.0)
    caccia = {"tipo": t["tipo"], "foto": c.foto("bersaglio_caccia"),
              **c.js("() => { const g = __game, a = g.campagna.attiva.target; "
                     "return {nella_folla: g.npcs.includes(a), vivo: !a.dead, "
                     "distanza: +Math.hypot(a.x - g.player.x, "
                     "a.z - g.player.z).toFixed(1)}; }")}
    # il bug del 25/09: lontano oltre 105 il bersaglio veniva tolto dalla
    # folla e restava la spada sospesa. Il ladro si allontana di 150
    c.js("() => { const p = __game.player, a = __game.campagna.attiva.target; "
         "p.x = a.x + 150; __game.cam.x = p.x; }")
    c.page.wait_for_timeout(1500)
    caccia["resta_lontano_150"] = c.js("() => __game.npcs.includes(__game.campagna.attiva.target)")
    c.js("() => { __game.campagna.attiva.target.dead = true; }")
    c.page.wait_for_timeout(300)

    c.tp(c.js("() => __collaudo.piazza()"), 3.0)
    c.js("() => __game.debug.missione(0, 1)")
    c.page.wait_for_timeout(800)
    deb = c.js("() => __game.campagna.attiva.debitori"
               ".map(n => ({x: n.x, z: n.z}))")
    if deb:
        _accanto(c, deb[0], 2.0, 3.0)
    risc = {"debitori": len(deb), "foto": c.foto("bersagli_riscossione")}
    c.js("() => { __game.campagna.attiva = null; }")
    esito = {"caccia": caccia, "riscossione": risc}
    if caccia["tipo"] != "caccia" or not deb:
        esito["errore"] = "missioni di prova non avviate"
    elif not caccia["resta_lontano_150"]:
        esito["errore"] = "il bersaglio della caccia sparisce da lontano"
    return esito


def _forza_assalto(c):
    # l'assalto parte quando scade il conto alla rovescia, col giocatore
    # dentro le mura: lo si azzera e si guarda cosa succede
    c.js("() => { const a = __game.assalto; a.attivo = false; a.prossimo = 0.1; }")
    c.page.wait_for_timeout(1500)
    return c.js("() => ({attivo: __game.assalto.attivo, "
                "assalitori: __game.nemici.filter(e => e.residente === undefined "
                "&& !e.dead).length})")


def scena_assalti(c):
    """Con tutti e tre i campi presi le scorrerie devono finire."""
    c.tp(c.js("() => __collaudo.piazza()"), 2.0)
    liberi = _forza_assalto(c)
    primo = c.js("() => { const e = __game.nemici.find(e => e.residente === "
                 "undefined && !e.dead); return e && {x: e.x, z: e.z}; }")
    if primo:
        _accanto(c, primo, 0.0, 8.0)
    foto = c.foto("assalto_campi_liberi")
    c.js("() => { const g = __game; g.nemici.length = 0; "
         "for (const a of g.world.accampamenti) g.world.issaColoriDelBorgo(a); }")
    presi = _forza_assalto(c)
    esito = {"campi_liberi": liberi, "campi_presi": presi, "foto": foto}
    if not liberi["attivo"] or presi["attivo"] or presi["assalitori"]:
        esito["errore"] = "l'assalto non dipende dai campi presi"
    return esito


def scena_lanterna(c):
    """Lanterna Rossa: dentro, la tenutaria vende la salute; carta con l'etichetta."""
    c.js("() => { const p = __game.player; p.hp = 40; p.money = 100; }")
    porta, fuori = _entra(c, "casa_piacere")
    dentro = c.js("() => __game.Interni.dentro")
    foto = [c.foto("lanterna_rossa")]
    _davanti_a(c, "la tenutaria", 1.8)
    suggerimento = c.page.locator("#prompt").inner_text()
    prima = c.js("() => ({hp: Math.round(__game.player.hp), soldi: __game.player.money})")
    c.page.keyboard.press("e")
    c.page.wait_for_timeout(400)
    dopo = c.js("() => ({hp: Math.round(__game.player.hp), soldi: __game.player.money})")
    foto.append(c.foto("lanterna_rossa_dopo"))
    _esci(c)
    c.page.keyboard.press("m")
    c.page.wait_for_timeout(500)
    foto.append(c.foto("carta"))
    c.page.keyboard.press("Escape")
    esito = {"porta": porta, "suggerimento_porta": fuori, "dentro": dentro,
             "suggerimento_tenutaria": suggerimento, "prima": prima,
             "dopo": dopo, "foto": foto}
    # la salute risale da sola di qualche punto nel frattempo: tolleranza 2
    if (not dentro or dopo["hp"] != 100
            or abs(dopo["soldi"] - (100 - (100 - prima["hp"]))) > 2):
        esito["errore"] = "la ricarica non torna"
    return esito


def scena_strage(c):
    """Lanterna Rossa, come in GTA: chi sta dentro si colpisce e muore. Sul
    momento nessuna stella (dentro non ci sono guardie); uscendo le urla si
    sentono dalla strada, e la porta resta sbarrata."""
    c.js("() => { __game.player.wanted = 0; }")
    _entra(c, "casa_piacere")
    gente = c.js("() => __game.npcs.filter(n => n.inStanza).length")
    # due colpi veri per ognuno, per la stessa strada del giocatore
    for _ in range(3):
        c.js("() => { for (const n of __game.npcs) if (n.inStanza && !n.dead) "
             "__game.debug.colpisci(n, ARMI.spada); }")
        c.page.wait_for_timeout(300)
    morti = c.js("() => __game.npcs.filter(n => n.inStanza && n.dead).length")
    stelle_dentro = c.js("() => __game.player.stars")
    c.page.wait_for_timeout(1500)
    foto = c.foto("strage")
    _esci(c)
    urla = c.page.locator("#msg").inner_text()
    fuori = c.js("() => ({dentro: __game.Interni.dentro, stelle: __game.player.stars, "
                 "in_stanza: __game.npcs.filter(n => n.inStanza).length})")
    # di nuovo sull'uscio: la porta dev'essere sbarrata
    porta = c.js("() => { const p = __game.Interni.porte.find(q => q.tipo === "
                 "'casa_piacere'); return {x: p.x, z: p.z}; }")
    c.js("([x, z]) => { __game.player.x = x; __game.player.z = z + 1; }",
         [porta["x"], porta["z"]])
    c.page.wait_for_timeout(300)
    c.page.keyboard.press("e")
    c.page.wait_for_timeout(1200)
    riaperta = c.js("() => __game.Interni.dentro")
    messaggio = c.page.locator("#msg").inner_text()
    c.js("() => { __game.player.wanted = 0; }")
    esito = {"gente": gente, "morti": morti, "stelle_dentro": stelle_dentro,
             "urla": urla, "fuori": fuori, "porta_riaperta": riaperta,
             "messaggio": messaggio,
             "foto": foto}
    if (morti != gente or stelle_dentro or fuori["dentro"] or fuori["in_stanza"]
            or riaperta or not ("sbarrata" in messaggio or "chiusa" in messaggio)):
        esito["errore"] = "la strage non torna"
    return esito

def scena_folla(c):
    """Quanti passanti restano incastrati: 20 s in tre punti del borgo.
    Incastrato = fermo contro un ostacolo per piu' di 5 s su 20 (urti, il
    tempo in cui il gioco li ha mossi senza che si spostassero); rimbalzi =
    quante volte al minuto un passante sbatte; fermi = meno di 2 unita' in 20 s."""
    punti = c.js("() => __collaudo.quartieri()")
    out = {}
    for nome in ("mercato", "bassifondi", "nobile"):
        c.tp(punti[nome], 3.0)
        c.js("() => { for (const n of __game.npcs) { n.urti = 0; n.rimbalzi = 0; n.inizio = [n.x, n.z]; } }")
        c.page.wait_for_timeout(20000)
        out[nome] = {}
        for gruppo, filtro in (("passanti", "n.residente === undefined"),
                               ("residenti", "n.residente !== undefined")):
            out[nome][gruppo] = c.js("""() => {
          const L = __game.npcs.filter(n => n.inizio && !n.dead && !n.fisso &&
                                            """ + filtro + """);
          const inc = L.filter(n => n.urti > 5).length;
          const fermi = L.filter(n => Math.hypot(n.x - n.inizio[0],
                                                 n.z - n.inizio[1]) < 2).length;
          const urti = L.reduce((s, n) => s + n.urti, 0);
          const rimb = L.reduce((s, n) => s + n.rimbalzi, 0);
          return { npc: L.length, incastrati: inc, fermi,
                   quota_urti: +(urti / (L.length * 20 || 1)).toFixed(3),
                   rimbalzi_al_minuto: +(rimb * 3 / (L.length || 1)).toFixed(1) };
        }""")
    c.foto("folla_nobile")
    tot = {g: {k: sum(v[g][k] for v in out.values())
               for k in ("npc", "incastrati", "fermi")}
           for g in ("passanti", "residenti")}
    return {"per_quartiere": out, "totale": tot}


def scena_messaggero(c):
    return {"dritto": c.js("() => __collaudo.messaggero('dritto')"),
            "rotta": c.js("() => __collaudo.messaggero('rotta')")}


def scena_taverna(c):
    """Interni, fase 1: E sull'uscio, dentro, l'oste, fuori dalla porta."""
    porta = c.js("() => { const p = __game.Interni.porte[0]; return p && {x: p.x, z: p.z}; }")
    if not porta:
        return {"errore": "nessuna taverna con l'uscio nel mondo"}
    stato = ("() => ({dentro: __game.Interni.dentro, x: +__game.player.x.toFixed(1), "
             "z: +__game.player.z.toFixed(1)})")
    c.tp({"x": porta["x"], "z": porta["z"] + 1.0}, 2.5)
    fuori = c.page.locator("#prompt").inner_text()
    c.js("() => { __game.player.wanted = 10; }")      # con la taglia non si entra
    c.page.keyboard.press("e")
    c.page.wait_for_timeout(900)
    ricercato = c.js(stato)
    c.js("() => { __game.player.wanted = 0; }")
    c.page.wait_for_timeout(200)
    c.page.keyboard.press("e")
    c.page.wait_for_timeout(1200)
    dentro = c.js(stato)
    foto = [c.foto("taverna_ingresso")]
    # davanti al bancone, e si parla con l'oste
    c.js("() => { const s = __game.Interni.stanza; const o = s.residenti[0]; "
         "__game.player.x = o.x; __game.player.z = o.z + 2 * s.C; }")
    c.page.wait_for_timeout(400)
    oste = c.page.locator("#prompt").inner_text()
    c.page.keyboard.press("e")
    c.page.wait_for_timeout(500)
    foto.append(c.foto("taverna_oste"))
    # fuori: dall'entrata si cammina giu' oltre la soglia
    c.js("() => { const e = __game.Interni.stanza.entrata; "
         "__game.player.x = e.x; __game.player.z = e.z; }")
    # il tasto si lascia appena si e' fuori (30/09): tenuto 1,6 s il ladro
    # continuava a camminare in strada, e se niente lo fermava la misura di
    # "dove esce" cadeva lontano dall'uscio
    c.page.keyboard.down("ArrowDown")
    c.page.wait_for_function("() => !__game.Interni.dentro", timeout=4000)
    c.page.keyboard.up("ArrowDown")
    c.page.wait_for_timeout(900)
    uscito = c.js(stato)
    foto.append(c.foto("taverna_uscita"))
    esito = {"porte": c.js("() => __game.Interni.porte.length"),
             "suggerimento_fuori": fuori, "col_ricercato": ricercato,
             "dentro": dentro, "suggerimento_oste": oste, "uscito": uscito,
             "foto": foto}
    torna = abs(uscito["x"] - porta["x"]) < 3 and abs(uscito["z"] - porta["z"]) < 4
    if ricercato["dentro"] or not dentro["dentro"] or uscito["dentro"] or not torna:
        esito["errore"] = "ingresso o uscita non tornano"
    return esito


def scena_sconfino(c):
    """Corte del castello: prima del capitolo 5 avvertimento e poi una stella;
    dal capitolo 5 (il Ciambellano sta li') si entra liberi. Il punto e'
    nella parte aperta della corte: a ridosso del castello il mastio copre la
    vista alle guardie."""
    p = c.js("() => { const { CORTE } = __game.world.pianta; return {x: (CORTE.x0 + CORTE.x1) / 2 * TILE, z: (CORTE.y1 - 3) * TILE}; }")
    # di giorno: nel giro completo si arriva qui dopo un paio di minuti dalla
    # scena "notte", ed e' di nuovo notte (le guardie vedono meno, 25/09)
    c.js("() => __game.debug.setDay(0.4)")
    esito = {}
    for cap in (0, 4):
        c.js("(k) => { __game.campagna.cap = k; __game.player.wanted = 0; }", cap)
        c.tp(p, 1.0)
        messaggi = []
        for _ in range(12):                      # 12 s, un campione al secondo
            c.page.wait_for_timeout(1000)
            m = c.page.locator("#msg").inner_text()
            if m and m not in messaggi:
                messaggi.append(m)
        esito[f"capitolo_{cap + 1}"] = {
            "stelle": c.js("() => __game.player.stars"), "messaggi": messaggi}
        if cap == 0:
            esito["foto"] = c.foto("corte_sconfino")
    c.js("() => { __game.campagna.cap = 0; __game.player.wanted = 0; }")
    if esito["capitolo_1"]["stelle"] < 1 or esito["capitolo_5"]["stelle"] != 0:
        esito["errore"] = "la regola della corte non torna"
    return esito


def scena_fuga(c):
    """E1: la fuga del capitolo 2 avviata in pineta, lontano da ogni guardia.
    Prima partiva con un reato che segue la regola dei testimoni: nessuno
    vedeva, la taglia restava 0 e la missione si chiudeva da sola."""
    c.tp(c.js("() => __collaudo.pineta()"), 1.0)
    c.js("() => { __game.player.wanted = 0; }")
    testimone = c.js("() => !!__game.debug.testimone()")
    c.js("() => __game.debug.missione(1, 2)")
    c.page.wait_for_timeout(2000)
    esito = c.js("() => { const m = __game.campagna.attiva; "
                 "return {missione: m && m.tipo, stelle: __game.player.stars, "
                 "taglia: Math.round(__game.player.wanted)}; }")
    esito["testimone_all_avvio"] = testimone
    esito["foto"] = c.foto("fuga_pineta")
    c.js("() => { __game.campagna.attiva = null; __game.campagna.cap = 0; "
         "__game.campagna.miss = 0; __game.player.wanted = 0; }")
    if esito["missione"] != "fuga" or esito["stelle"] < 1:
        esito["errore"] = "la fuga senza testimoni parte senza stelle"
    return esito


def scena_cunicolo(c):
    """B: dalla botola nella corte al pozzo nel bosco. Prima della fine del
    capitolo 4 e' chiusa; poi si entra solo se nessuno ti vede, anche con la
    taglia addosso; si esce dall'altro capo."""
    porte = c.js("() => __game.world.cunicolo.porte")
    botola = porte["corte"]
    c.js("() => { __game.debug.setDay(0.4); __game.campagna.cap = 0; __game.player.wanted = 0; }")
    c.tp({"x": botola["x"], "z": botola["z"] + 0.5}, 1.5)
    c.page.keyboard.press("e")
    c.page.wait_for_timeout(800)
    esito = {"capitolo_1": {"dentro": c.js("() => __game.Interni.dentro"),
                            "messaggio": c.page.locator("#msg").inner_text()}}

    # dal capitolo 5: prima con una guardia accanto, poi senza nessuno
    c.js("() => { __game.campagna.cap = 4; }")
    c.tp({"x": botola["x"], "z": botola["z"] + 0.5}, 2.0)
    esito["foto"] = [c.foto("cunicolo_botola")]
    c.js("""() => { const g = __game, p = g.player;
            const q = g.guards.find(x => !x.dead);
            if (q) { q.x = p.x + 3; q.z = p.z + 2; } }""")
    c.page.wait_for_timeout(300)
    visto = c.js("() => !!__game.debug.testimone()")
    c.page.keyboard.press("e")
    c.page.wait_for_timeout(800)
    esito["con_testimone"] = {"testimone": visto, "dentro": c.js("() => __game.Interni.dentro"),
                              "messaggio": c.page.locator("#msg").inner_text()}

    c.js("() => { const g = __game; g.guards.length = 0; g.nemici.length = 0; "
         "g.player.wanted = 20; }")
    c.page.keyboard.press("e")
    c.page.wait_for_timeout(1500)
    esito["senza_testimoni"] = {"stelle": c.js("() => __game.player.stars"),
                                "dentro": c.js("() => __game.Interni.dentro && "
                                               "__game.Interni.stanza.tipologia")}
    esito["foto"].append(c.foto("cunicolo_dentro"))

    # all'altro capo: il vano verso il bosco
    c.js("""() => { const s = __game.Interni.stanza, u = s.uscite.find(v => v.verso === 'bosco');
            const p = __game.player; p.x = -320 + (u.cella + 0.5) * s.C; p.z = s.soglia + 1.2; }""")
    c.page.wait_for_timeout(1800)
    fuori = c.js("() => ({dentro: __game.Interni.dentro, x: __game.player.x, z: __game.player.z})")
    pozzo = porte["bosco"]
    fuori["dal_pozzo"] = round(((fuori["x"] - pozzo["x"]) ** 2 + (fuori["z"] - pozzo["z"]) ** 2) ** 0.5, 1)
    esito["uscita"] = fuori
    esito["foto"].append(c.foto("cunicolo_pozzo"))
    c.js("() => { __game.campagna.cap = 0; __game.player.wanted = 0; }")

    if esito["capitolo_1"]["dentro"]:
        esito["errore"] = "prima del capitolo 5 il cunicolo e' aperto"
    elif esito["con_testimone"]["testimone"] and esito["con_testimone"]["dentro"]:
        esito["errore"] = "si entra nel cunicolo sotto gli occhi di una guardia"
    elif esito["senza_testimoni"]["dentro"] != "cunicolo":
        esito["errore"] = "senza testimoni (e con la taglia) nel cunicolo non si entra"
    elif fuori["dentro"] or fuori["dal_pozzo"] > 3:
        esito["errore"] = "dall'altro capo non si esce al pozzo"
    return esito


# Una citta' generata costruita nella pagina (accanto al mondo in gioco, che
# non si tocca), misurata e disegnata su una tela: quartieri, strade, ostacoli,
# e i luoghi che contano. "Raggiungibile" = una visita in ampiezza sulle tile
# libere a partire dalla piazza: porte, committenti, usci delle stanze.
# Un seme "fiordo-<n>" e' lo stile fiordo (25/09 notte): in piu' misura il mare, la
# neve, la flora che l'atlante deve avere, gli scogli e l'uscita in barca dal
# porto al mare aperto. Va misurato in una pagina col suo atlante caricato.
MISURA_PIANTA = r"""(seme) => {
  const st = /^([a-z]+)-(\d+)$/.exec(String(seme));
  const P = seme === 'valdarno' ? PIANTE.valdarno
          : st ? PIANTE.genera(Number(st[2]), st[1]) : PIANTE.genera(seme);
  const w = new World(P.seme || 20260917, P);
  const N = 192, libero = new Uint8Array(N * N), visto = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
    libero[y * N + x] = w.blockedTile(x + 0.5, y + 0.5) ? 0 : 1;
  const coda = [P.PLAZA.y * N + P.PLAZA.x];
  visto[coda[0]] = 1;
  while (coda.length) {
    const i = coda.pop(), x = i % N, y = (i - x) / N;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = ny * N + nx;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N || visto[k] || !libero[k]) continue;
      visto[k] = 1; coda.push(k);
    }
  }
  // un punto e' raggiunto se lo e' una tile entro 1 (gli usci stanno a ridosso)
  const preso = (x, z) => { const tx = Math.floor(x / TILE), ty = Math.floor(z / TILE);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const k = (ty + dy) * N + tx + dx; if (visto[k]) return true; }
    return false; };
  const mete = [];
  for (const g of P.GATES) mete.push(['porta ' + g.dir, g.x * TILE + 2, g.y * TILE + 2]);
  for (const g of w.spawns.givers) if (!g.stanza) mete.push([g.name, g.x, g.z]);
  for (const [nome, l] of [['fucina', w.fucina], ['pieve', w.chiesa], ['castello', w.castello],
                           ['lanterna', w.casaDiPiacere]])
    if (l) mete.push([nome, l.porta.x, l.porta.z]);
  mete.push(['cunicolo corte', w.cunicolo.porte.corte.x, w.cunicolo.porte.corte.z]);
  mete.push(['cunicolo bosco', w.cunicolo.porte.bosco.x, w.cunicolo.porte.bosco.z]);
  const osterie = w.props.filter(p => p.name === 'edificio_taverna');
  const fuori = mete.filter(([, x, z]) => !preso(x, z)).map(m => m[0]);
  const osterieIrraggiungibili = osterie.filter(p => !preso(p.x, p.z + 1.6)).length;

  // la carta: 2 px per tile
  const cv = document.createElement('canvas'); cv.width = cv.height = N * 2;
  const g = cv.getContext('2d');
  const tinta = ['#2f5d2e', '#b59a55', '#5b4a3a', '#8a7a5c', '#9aa0a8', '#6f6a60', '#3d6fa8', '#6b8f4a'];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    g.fillStyle = w.road[i] ? (w.road[i] === 2 ? '#d8cfb8' : '#a8845a')
                : (!libero[i] ? (w.terrain[i] === T.ACQUA_CUPA ? '#1d4463' : '#222')
                : (w.terrain[i] === T.NEVE ? '#dfe6ea' : (tinta[w.district[i]] || '#555')));
    g.fillRect(x * 2, y * 2, 2, 2);
  }
  const punto = (x, z, col, r = 4) => { g.fillStyle = col; g.beginPath();
    g.arc(x / TILE * 2, z / TILE * 2, r, 0, 7); g.fill(); };
  for (const [, x, z] of mete) punto(x, z, preso(x, z) ? '#ffd23c' : '#ff2a2a');
  for (const p of osterie) punto(p.x, p.z + 1.6, '#ffffff', 2.5);
  g.font = 'bold 14px monospace';                 // su fondo scuro: sulla neve spariva
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(2, 2, g.measureText(P.nome).width + 8, 18);
  g.fillStyle = '#fff'; g.fillText(P.nome, 6, 16);
  const esito = { nome: P.nome, cinta: P.WALL, props: w.props.length, residenti: w.residents.length,
           osterie: osterie.length, osterie_irraggiungibili: osterieIrraggiungibili,
           mete: mete.length, irraggiungibili: fuori, carta: cv.toDataURL() };
  if (!P.stile) return esito;

  // lo stile: l'acqua profonda cupa (06/10: ovunque stia, non piu' "a
  // ponente della riva": il fiordo ha l'acqua a levante), la neve, la flora,
  // gli scogli
  let mare = 0, mareTot = 0, erba = 0, neve = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const t = w.terrain[y * N + x];
    if (w.distAcqua(x, y) < 0.5) { mareTot++; if (t === T.ACQUA_CUPA) mare++; }
    if (t === T.ERBA) erba++;
    if (t === T.NEVE) neve++;
  }
  const inAcqua = p => { const t = w.terrain[w.idx(Math.floor(p.x / TILE), Math.floor(p.z / TILE))];
                         return t === T.ACQUA || t === T.ACQUA_CUPA; };
  // (i nomi: la Costa ha anche un numero, la densita' della macchia)
  const flora = [...new Set(Object.values(P.FLORA).flat())].filter(n => typeof n === 'string');
  // in barca dal porto: dalla barca del Nocchiero, per le celle d'acqua della
  // griglia delle collisioni (quelle dove naviga la barca), fino al largo, dove
  // si salpa (viaggio.js, alLargo: l'acqua al bordo della carta)
  const barca = w.spawns.vehicles.find(v => v.type === 'barca');
  let alMare = false;
  if (barca) {
    const S = w.solidS, M = w.solidN, fatto = new Uint8Array(M * M);
    const q = [Math.floor(barca.z / S) * M + Math.floor(barca.x / S)];
    fatto[q[0]] = 1;
    while (q.length && !alMare) {
      const i = q.pop(), cx = i % M, cy = (i - cx) / M;
      if (Viaggio.alLargo(w, cx * S + S / 2, cy * S + S / 2)) alMare = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy, k = ny * M + nx;
        if (nx < 0 || ny < 0 || nx >= M || ny >= M || fatto[k] || w.solid[k] !== 2) continue;
        fatto[k] = 1; q.push(k);
      }
    }
  }
  esito.stile = {
    stile: P.stile, atlante: P.ATLANTE,
    mare_cupo: +(mare / mareTot).toFixed(4), erba, neve,
    flora_mancante: flora.filter(n => !Assets.world(n)),
    scogli_in_mare: w.props.filter(p => /^scoglio/.test(p.name) && inAcqua(p)).length,
    barche: w.spawns.vehicles.filter(v => v.type === 'barca').length,
    moli: w.moli.length / 2, barca_al_mare: alMare,
  };
  return esito;
}"""


def _componi_carte(c, righe, nome):
    """Le carte in righe (una lista di PNG per riga), scritte in PNG senza
    Pillow (il venv non l'ha): le si passa alla pagina, che le compone."""
    composta = c.js("""async (righe) => {
      const carica = b => new Promise(ok => {
        const i = new Image(); i.onload = () => ok(i); i.src = 'data:image/png;base64,' + b; });
      const imgs = await Promise.all(righe.map(r => Promise.all(r.map(carica))));
      const cv = document.createElement('canvas');
      cv.width = Math.max(...imgs.map(r => r.length)) * 388; cv.height = imgs.length * 388;
      const g = cv.getContext('2d');
      imgs.forEach((r, j) => r.forEach((im, k) => g.drawImage(im, k * 388, j * 388)));
      return cv.toDataURL(); }""", [[base64.b64encode(b).decode() for b in r] for r in righe])
    percorso = c.cartella / f"{nome}.png"
    percorso.write_bytes(base64.b64decode(composta.split(",", 1)[1]))
    return str(percorso.resolve().relative_to(RADICE)).replace("\\", "/")


def _guasti_fiordo(m):
    """Cosa non va in un fiordo generato (le misure di MISURA_PIANTA.stile)."""
    s, guasti = m["stile"], []
    if s["mare_cupo"] < 0.99:
        guasti.append(f"mare cupo solo al {s['mare_cupo']:.1%} dell'acqua profonda")
    if s["erba"] or not s["neve"]:
        guasti.append(f"erba {s['erba']}, neve {s['neve']}")
    if s["flora_mancante"]:
        guasti.append(f"l'atlante non ha {s['flora_mancante']}")
    if s["scogli_in_mare"] < 20:
        guasti.append(f"scogli in mare {s['scogli_in_mare']}")
    if not s["barche"] or not s["barca_al_mare"]:
        guasti.append("dal porto la barca non arriva al mare aperto")
    return guasti


def scena_generatore(c):
    """Il generatore di citta' (genera_pianta.js): Valdarno e sei borghi
    generati, costruiti nella pagina, con la misura di cosa si raggiunge a
    piedi dalla piazza e la carta di ognuno in un'unica foto. Poi un borgo
    generato caricato davvero (?pianta=gen-2) e fotografato in piazza.
    Lo stile fiordo (25/09 notte): quattro fiordi (i due del menu, 3 e 7, e i borghi
    1 e 2 rifatti fiordi), misurati nella pagina di un fiordo (serve il suo
    atlante: la flora ha i nomi del fiordo), con la loro carta sotto quella dei
    borghi; poi il fiordo 3 giocato, fotografato al porto e in piazza."""
    esito, carte, carte_f = {}, [], []
    for seme in ["valdarno", 1, 2, 3, 4, 5, 6]:
        m = c.js(MISURA_PIANTA, seme)
        carte.append(base64.b64decode(m.pop("carta").split(",", 1)[1]))
        esito[str(seme)] = m

    # un borgo generato, giocato: si apre con ?pianta=gen-2 e si torna a Valdarno
    base = c.page.url.split("?")[0]
    apri(c.page, base + "?pianta=gen-2")
    c.tp(c.js("() => __collaudo.piazza()"), 3.0)
    foto = [c.foto("generato_piazza")]
    esito["giocato"] = c.js("() => ({citta: __game.world.pianta.nome, fps: __game.fps})")

    # i fiordi, nella pagina del fiordo 3 (atlante assets/fiordo/)
    apri(c.page, base + "?pianta=fiordo-3")
    for seme in ["fiordo-3", "fiordo-7", "fiordo-1", "fiordo-2"]:
        m = c.js(MISURA_PIANTA, seme)
        carte_f.append(base64.b64decode(m.pop("carta").split(",", 1)[1]))
        esito[seme] = m
    foto.insert(0, _componi_carte(c, [carte, carte_f], "generatore_carte"))
    c.js("() => { Meteo.imposta('sereno'); __game.debug.setDay(0.4); }")
    barca = c.js("""() => { const b = __game.vehicles.find(v => v.type === 'barca');
                            return { x: b.x + 5, z: b.z + 0.5 }; }""")
    c.tp(barca, 3.0)
    foto.append(c.foto("fiordo_porto"))
    c.js("() => Meteo.imposta('neve')")
    c.tp(c.js("() => __collaudo.piazza()"), 3.5)
    foto.append(c.foto("fiordo_piazza"))
    esito["fiordo_giocato"] = c.js("""() => ({ citta: __game.world.pianta.nome,
      atlante: Assets.manifest.mappa, meteo: Meteo.tipo, fps: __game.fps,
      // la gente del fiordo: i vichinghi del character studio
      vichinghi: !!Assets.charDef('VikJarl') && !!Assets.charDef('VikLanciere'),
      palizzata: __game.world.props.filter(p => /^palo_palizzata/.test(p.name)).length })""")
    c.js("() => Meteo.imposta('sereno')")
    apri(c.page, base)
    esito["foto"] = foto

    guasti = {k: v["irraggiungibili"] for k, v in esito.items()
              if isinstance(v, dict) and v.get("irraggiungibili")}
    guasti.update({k: g for k, v in esito.items()
                   if isinstance(v, dict) and "stile" in v and (g := _guasti_fiordo(v))})
    fg = esito["fiordo_giocato"]
    if fg["atlante"] != "fiordo" or not fg["vichinghi"] or fg["palizzata"] < 300:
        guasti["fiordo_giocato"] = "atlante, gente o palizzata del fiordo mancano"
    if guasti:
        esito["errore"] = f"generatore: {guasti}"
    return esito


def scena_piantoni(c):
    """Guardie di piantone alle 4 porte (25/09): quattro per porta (due dentro
    e due fuori), ferme; chi
    passa con la taglia e' visto; una sentinella che ha inseguito torna al
    suo posto. Foto della porta nord e di quella di ponente."""
    porte = c.js("""() => { const w = __game.world, c = n => n * TILE + TILE / 2;
      return w.pianta.GATES.map(g => ({ dir: g.dir, x: c(g.x), z: c(g.y),
        piantoni: w.residents.filter(r => r.prof === 'guardia' && r.fisso && r.raggio === 0 &&
          Math.hypot(r.x - c(g.x), r.z - c(g.y)) < 10).length })); }""")
    esito = {"porte": {p["dir"]: p["piantoni"] for p in porte}, "foto": []}
    c.js("() => { __game.debug.setDay(0.4); __game.player.wanted = 0; }")
    # la camera si mette a sud-est o a sud-ovest della porta, dentro le mura
    scosta = {"N": (0, 7), "S": (0, -9), "W": (18, 3), "E": (-18, 3)}
    for p in porte:
        dx, dz = scosta[p["dir"]]
        c.tp({"x": p["x"] + dx, "z": p["z"] + dz}, 2.0)
        esito["foto"].append(c.foto(f"piantoni_{p['dir']}"))
    # il torrione delle porte laterali (25/09 sera): torri a 9,5 e ponte a 7, la
    # faccia sud di tutte e due in piedi (quella nord dietro il ponte), uno
    # stendardo per torre, l'ombra dell'arco sulla via e della torre a terra.
    # Foto centrate sulla porta, dal lato del borgo
    esito["torrioni"] = c.js("""() => { const w = __game.world, c = n => n * TILE + TILE / 2;
      // il borgo di fiume (06/10) ha le porte di legno: niente torrioni
      if (w.pianta.PALIZZATA) return [];
      return w.pianta.GATES.filter(g => g.dir === 'W' || g.dir === 'E').map(g => {
        const qui = w.props.filter(p => Math.abs(p.x - c(g.x)) < 5 && Math.abs(p.z - c(g.y)) < 26);
        const n = nome => qui.filter(p => p.name === nome).length;
        const torri = qui.filter(p => p.name === 'porta_torre').map(p => p.piano.alto);
        const ponte = qui.find(p => p.name === 'porta_fianco');
        return { dir: g.dir, torri: torri.length, ponte: n('porta_fianco'),
                 facce: n('porta_torre_fronte'),
                 stendardi: qui.filter(p => p.name === 'stendardo_azzurro' && p.sopra).length,
                 ombre: qui.filter(p => p.ombraRett).length,
                 alto_torri: torri[0], alto_ponte: ponte && ponte.piano.alto }; }); }""")
    for p in porte:
        if p["dir"] in ("W", "E"):
            s = 1 if p["dir"] == "W" else -1
            c.tp({"x": p["x"] + s * 9, "z": p["z"] + 4}, 2.0)
            esito["foto"].append(c.foto(f"porta_{'ponente' if s > 0 else 'levante'}_torri"))
    # alla porta frontale (la nord, o la sud del borgo di fiume, 06/10): sono
    # vivi, fermi, e vedono chi passa
    n = next(p for p in porte if p["dir"] in ("N", "S"))
    c.tp({"x": n["x"], "z": n["z"] + 4}, 2.0)
    esito["alla_porta_nord"] = c.js("""() => { const g = __game.guards.filter(q => q.fisso &&
        q.residente !== undefined && Math.hypot(q.x - __game.player.x, q.z - __game.player.z) < 10);
      return { presenti: g.length, stati: g.map(q => q.state),
               vedono: !!__game.debug.testimone() }; }""")
    # una sentinella spostata di 12 passi torna al suo posto
    c.js("""() => { const g = __game.guards.find(q => q.fisso && q.residente !== undefined &&
        Math.hypot(q.x - __game.player.x, q.z - __game.player.z) < 10);
      g.x += 8; g.z += 9; window.__sentinella = g; }""")
    c.page.wait_for_timeout(8000)
    esito["ritorno"] = c.js("() => { const g = window.__sentinella; return {stato: g.state, "
                            "dal_posto: +Math.hypot(g.x - g.anchor.x, g.z - g.anchor.z).toFixed(1)}; }")
    # dal 26/09 niente camminamento sopra il varco (sembrava un muro pieno):
    # due torri coi loro stendardi, l'ombra di quella sud
    completo = {"torri": 2, "ponte": 0, "facce": 2, "stendardi": 2, "ombre": 1}
    # le porte di legno: due torrette ciascuna
    esito["torrette"] = c.js("""() => { const w = __game.world, c = n => n * TILE + TILE / 2;
      if (!w.pianta.PALIZZATA) return [];
      return w.pianta.GATES.map(g => w.props.filter(p => p.name === 'torretta_corte' &&
        Math.hypot(p.x - c(g.x), p.z - c(g.y)) < 14).length); }""")
    if any(v != 4 for v in esito["porte"].values()):
        esito["errore"] = "non ci sono quattro piantoni per porta"
    elif any(t[k] != v for t in esito["torrioni"] for k, v in completo.items()):
        esito["errore"] = "un torrione di porta laterale e' incompleto (o ha di nuovo il ponte)"
    elif any(n != 2 for n in esito["torrette"]):
        esito["errore"] = f"le porte di legno non hanno due torrette: {esito['torrette']}"
    elif esito["alla_porta_nord"]["presenti"] < 2 or not esito["alla_porta_nord"]["vedono"]:
        esito["errore"] = "i piantoni della porta frontale non ci sono o non vedono"
    elif esito["ritorno"]["dal_posto"] > 1.5:
        esito["errore"] = "la sentinella non torna al suo posto"
    return esito


def scena_meteo(c):
    """M, il meteo (25/09 sera): per ogni tempo il raggio di vista delle guardie,
    quanti passanti girano, la velocita' di punta di un carro e di un cavallo
    guidati (misurata su 6 s di guida simulata, senza ostacoli) e quella dei
    carri in transito; una foto per tempo, il temporale di notte col lampo.
    Poi un cambio lasciato fare al gioco (dal 25/09 notte a qualunque ora,
    ogni 1-3 minuti: qui gli si dice che manca mezzo secondo). Alla fine
    torna sereno e fisso, per le scene dopo."""
    piazza = c.js("() => __collaudo.piazza()")
    c.tp(piazza, 1.5)
    misura = r"""() => {
      const guida = tipo => {
        const v = new Vehicle({ type: tipo, name: 'prova', x: 0, z: 0, rot: 0 });
        v.rider = {};
        const libero = { move: (x, z, dx, dz) => [x + dx, z + dz] };
        for (let i = 0; i < 120; i++) v.update(0.05, libero, { right: 1 });
        return +v.speed.toFixed(2);
      };
      return { vista: __game.debug.vista(), gente: __game.debug.gente(),
               carro: guida('carro'), cavallo: guida('cavallo'),
               transito: +Traffico.velocita().toFixed(2) };
    }"""
    esito = {"tempi": {}, "foto": []}
    for tipo, ora in (("sereno", 0.4), ("pioggia", 0.4), ("nebbia", 0.4),
                      ("temporale", 0.9)):
        c.js(f"() => {{ Meteo.imposta('{tipo}'); __game.debug.setDay({ora}); }}")
        esito["tempi"][tipo] = c.js(misura)
        c.tp({"x": piazza["x"] + 6, "z": piazza["z"] + 14}, 1.5)
        if tipo == "temporale":
            c.js("() => Meteo.lampo()")
            c.page.wait_for_timeout(120)
            esito["tempi"][tipo]["lampo"] = c.js("() => __game.debug.flash()")
        esito["foto"].append(c.foto(f"meteo_{tipo}"))
    # un cambio lasciato al gioco
    c.js("() => { Meteo.imposta('sereno'); Meteo.resta = 0.5; Meteo.fissa(false); "
         "window.__cambi = Meteo.cambi; __game.debug.setDay(0.4); }")
    c.page.wait_for_timeout(2000)
    c.js("() => Meteo.fissa(true)")
    esito["cambio"] = c.js("() => ({ cambi: Meteo.cambi - window.__cambi, "
                           "ora: Meteo.tipo, salvato: Salvataggio.stato().meteo })")
    c.js("() => { Meteo.fissa(true); Meteo.imposta('sereno'); __game.debug.setDay(0.4); }")
    t = esito["tempi"]
    s, p, n, tt = t["sereno"], t["pioggia"], t["nebbia"], t["temporale"]
    if not (p["vista"] < s["vista"] and n["vista"] < p["vista"]):
        esito["errore"] = "con pioggia e nebbia le guardie devono vedere meno"
    elif not (p["gente"] < s["gente"] and tt["gente"] < p["gente"]):
        esito["errore"] = "con la pioggia deve girare meno gente"
    elif not (p["carro"] < s["carro"] * 0.85 and p["cavallo"] < s["cavallo"] * 0.85
              and p["transito"] < s["transito"]):
        esito["errore"] = "con la pioggia carri e cavalli devono andare piu' piano"
    elif not tt.get("lampo"):
        esito["errore"] = "il temporale di notte non lampeggia"
    elif esito["cambio"]["cambi"] != 1 or not esito["cambio"]["salvato"]:
        esito["errore"] = "il tempo non cambia da solo, o non va nel salvataggio"
    return esito


def scena_citta(c):
    """F3, un atlante per citta' (25/09 sera): dal menu del titolo si sceglie il
    Fiordo, la pagina si ricarica con ?pianta=fiordo e carica assets/fiordo/
    (case del nord, neve). In una pagina a parte: la partita del collaudo
    resta com'e'. Valdarno invariato lo dice la firma del mondo."""
    contesto = c.page.context.browser.new_context(viewport={"width": 1280, "height": 720})
    pagina = contesto.new_page()
    errori = []
    pagina.on("pageerror", lambda e: errori.append(str(e)))
    pagina.on("console", lambda m: m.type == "error" and errori.append(m.text))
    url = c.page.url.split("?")[0]
    try:
        pagina.goto(url, wait_until="load")
        pagina.wait_for_function("() => document.getElementById('loading').textContent === 'pronto'",
                                 timeout=60000)
        pagina.select_option("#cittaSel", "fiordo")
        pagina.wait_for_function("() => location.search.includes('fiordo') && "
                                 "document.getElementById('loading').textContent === 'pronto'",
                                 timeout=60000)
        pagina.evaluate("() => { document.getElementById('title').style.display = 'none'; "
                        "Meteo.imposta('neve'); }")
        pagina.wait_for_timeout(2500)
        esito = pagina.evaluate("""() => ({ citta: __game.world.pianta.nome,
          atlante: Assets.manifest.mappa, menu: document.getElementById('cittaSel').value,
          case_del_nord: !!Assets.world('casa_alta') && Assets.world('casa_alta').w ===
            Assets.world('edifici_nord_00').w, meteo: Meteo.tipo,
          fiordi_nel_menu: [...document.querySelectorAll('#cittaSel option')]
            .map(o => o.value).filter(v => /^fiordo-[0-9]+$/.test(v)) })""")
        foto = c.cartella / "citta_fiordo.png"
        pagina.screenshot(path=str(foto))
        esito["foto"] = str(foto.relative_to(RADICE)).replace("\\", "/")
    finally:
        contesto.close()
    esito["errori"] = errori
    if errori or esito["atlante"] != "fiordo" or not esito["case_del_nord"] \
            or esito["menu"] != "fiordo":
        esito["errore"] = "il Fiordo non si carica dal menu col suo atlante"
    elif len(esito["fiordi_nel_menu"]) < 2:
        esito["errore"] = "il menu non offre i fiordi generati"
    return esito


STATO_VIAGGIO = r"""() => { const g = __game, w = g.world, p = g.player;
  const tx = Math.floor(p.x / TILE), ty = Math.floor(p.z / TILE), t = w.terrain[w.idx(tx, ty)];
  return { citta: w.pianta.nome, chiave: w.pianta.chiave, atlante: Assets.manifest.mappa,
           soldi: p.money, arsenale: [...p.arsenale], capitolo: g.campagna.cap,
           in_acqua: t === T.ACQUA || t === T.ACQUA_CUPA, bloccato: !!w.blocked(p.x, p.z),
           committenti_al_posto: w.spawns.givers.length, porte: Interni.porte.length,
           barche: g.vehicles.filter(v => v.type === 'barca').length,
           tenda: { posseduta: Tenda.posseduta, piantata: Tenda.piantata },
           meteo: Meteo.tipo, fps: g.fps }; }"""


def _viaggia(c, chiave):
    c.js("(k) => __game.debug.citta(k)", chiave)        # la promessa si aspetta
    c.page.wait_for_timeout(3000)
    return c.js(STATO_VIAGGIO)


def scena_viaggio(c):
    """Il cambio di citta' a partita avviata (viaggio.js, 25/09 notte): da
    Valdarno al fiordo 3 e ritorno nella stessa pagina. Restano soldi,
    arsenale e capitolo; la tenda piantata torna nello zaino; il fiordo ha il
    suo atlante e il ladro sta all'asciutto in piazza; un salvataggio fatto nel
    fiordo, caricato da Valdarno, riporta nel fiordo; tornati a Valdarno il
    mondo ha la firma dell'inizio del collaudo."""
    c.js("""() => { const p = __game.player; p.money = 321; p.arsenale = ['spada', 'arco'];
      __game.campagna.cap = 2; Tenda.rimetti({ posseduta: true,
        piantata: { x: p.x + 40, z: p.z + 40 } });
      window.__salvato = localStorage.getItem(Salvataggio.CHIAVE); }""")
    esito = {"fiordo": _viaggia(c, "fiordo-3")}
    c.page.wait_for_timeout(1500)
    esito["foto"] = [c.foto("viaggio_fiordo")]
    esito["fiordo"]["fps"] = c.fps()
    # si salva nel fiordo, si torna a Valdarno, si carica: si torna nel fiordo
    c.js("() => { __game.player.money = 555; Salvataggio.salva(); }")
    esito["valdarno"] = _viaggia(c, "valdarno")
    c.js("() => Game.carica(Salvataggio.leggiLocale())")
    c.page.wait_for_timeout(3000)
    esito["dal_salvataggio"] = c.js(STATO_VIAGGIO)
    esito["ritorno"] = _viaggia(c, "valdarno")
    esito["foto"].append(c.foto("viaggio_ritorno"))
    esito["firma"] = c.js("() => __collaudo.firma()")["hash"]
    c.js("""() => { if (window.__salvato) localStorage.setItem(Salvataggio.CHIAVE, window.__salvato);
      else localStorage.removeItem(Salvataggio.CHIAVE); }""")

    f, v, s = esito["fiordo"], esito["ritorno"], esito["dal_salvataggio"]
    guasti = []
    if f["atlante"] != "fiordo" or f["chiave"] != "fiordo-3":
        guasti.append("nel fiordo non c'e' il suo atlante")
    if (f["soldi"], f["arsenale"], f["capitolo"]) != (321, ["spada", "arco"], 2):
        guasti.append("soldi, arsenale o capitolo persi nel viaggio")
    if f["in_acqua"] or f["bloccato"]:
        guasti.append("nel fiordo il ladro e' in acqua o dentro un ostacolo")
    if not f["tenda"]["posseduta"] or f["tenda"]["piantata"]:
        guasti.append("la tenda non e' tornata nello zaino")
    if not f["barche"] or not f["porte"]:
        guasti.append("nel fiordo mancano barche o usci")
    if s["chiave"] != "fiordo-3" or s["soldi"] != 555:
        guasti.append("il salvataggio del fiordo non riporta nel fiordo")
    if v["atlante"] != "borgo" or esito["firma"] != c.firma0:
        guasti.append(f"ritorno a Valdarno: atlante {v['atlante']}, firma {esito['firma']} "
                      f"invece di {c.firma0}")
    if f["fps"] < 30:
        guasti.append(f"fps {f['fps']}")
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


def _fuochi_qui(c, dove, notte=0.85):
    """Il ladro accanto a un fuoco o a un camino, di notte; quanti sbuffi e
    fiamme ci sono attorno dopo tre secondi."""
    c.js("(o) => __game.debug.setDay(o)", notte)
    c.tp(dove, 3.0)
    return c.js("() => Fuochi.quante")


def scena_fuochi(c):
    """Il fuoco e il fumo animati (fuochi.js, 25/09 notte): a Valdarno le
    torce e i bracieri hanno la fiamma (prima la torcia non l'aveva), nel
    fiordo anche i focolari delle case e il fumo dai camini, a sbuffi che
    salgono. Foto di notte in piazza a Valdarno, e nel fiordo di giorno
    (il fumo) e di notte (i fuochi)."""
    esito = {"foto": []}
    torcia = c.js("""() => { const w = __game.world, P = w.pianta, X = P.PLAZA.x * TILE, Z = P.PLAZA.y * TILE;
      let m = null, d = 1e9;
      for (const p of w.props) if (p.name === 'torcia' || p.name === 'braciere') {
        const k = Math.hypot(p.x - X, p.z - Z); if (k < d) { d = k; m = p; } }
      return { x: m.x, z: m.z + 5 }; }""")
    esito["valdarno"] = _fuochi_qui(c, torcia)
    esito["foto"].append(c.foto("fuochi_valdarno"))
    base = c.page.url.split("?")[0]
    apri(c.page, base + "?pianta=fiordo-3")
    casa = c.js("""() => { const w = __game.world;
      const q = w.props.find(p => p.name === 'edificio_bottega');
      return { x: q.x, z: q.z + 7 }; }""")
    esito["fiordo_giorno"] = _fuochi_qui(c, casa, 0.45)
    esito["foto"].append(c.foto("fuochi_fiordo_giorno"))
    esito["fiordo_notte"] = _fuochi_qui(c, casa, 0.85)
    esito["foto"].append(c.foto("fuochi_fiordo_notte"))
    c.js("() => __game.debug.setDay(0.4)")
    apri(c.page, base)
    v, f = esito["valdarno"], esito["fiordo_giorno"]
    # Valdarno ha poche torce (5), 2 bracieri e i falo' dei campi. Nel fiordo
    # dal 30/09 le case e l'osteria sono meta (innesta_nano.py): l'osteria del
    # catalogo aveva il focolare in vista (una fiamma), la meta no: 19, non 20
    if v["fiamme"] < 8 or v["camini"] < 1 or f["fiamme"] < 15 or f["camini"] < 10 \
            or f["sbuffi"] < 5:
        esito["errore"] = "mancano fiamme o fumo animati"
    return esito


def scena_interni_fiordo(c):
    """Gli interni vichinghi (25/09 notte): nel fiordo 3 si entra nella sala
    del jarl, nello hof, nella sala dell'idromele, nella forgia e nella
    Lanterna Rossa; ognuna e' la stanza di src/stanze/fiordo/ (il nome lo
    dice), col jarl (VikJarl) e le fiamme vive nei focolari. Una foto per
    stanza."""
    base = c.page.url.split("?")[0]
    apri(c.page, base + "?pianta=fiordo-3")
    c.js("() => __game.debug.setDay(0.4)")
    esito, foto, guasti = {}, [], []
    attese = {"castello": "La sala del jarl", "chiesa": "Lo hof",
              "taverna": "La sala dell'idromele", "fucina": "La forgia del fabbro",   # 14/10
              "casa_piacere": "Lanterna Rossa"}
    for tipo, nome in attese.items():
        _entra(c, tipo)
        c.page.wait_for_timeout(1500)
        s = c.js("""() => { const s = __game.Interni.stanza;
          return s && { nome: s.nome, residenti: s.residenti.map(r => r.nome).filter(Boolean),
                        fuochi: s.arredo.filter(a => (Assets.world(a.nome) || {}).fiamme).length }; }""")
        esito[tipo] = s
        foto.append(c.foto(f"interni_fiordo_{tipo}"))
        if not s or s["nome"] != nome:
            guasti.append(f"{tipo}: {s and s['nome']}")
        if s:
            _esci(c)
    esito["jarl"] = c.js("() => !!Assets.charDef('VikJarl')")
    apri(c.page, base)
    esito["foto"] = foto
    if guasti or not esito["jarl"] or not esito["castello"]["fuochi"]:
        esito["errore"] = f"interni del fiordo: {guasti or 'jarl o focolare mancano'}"
    return esito


CONTA_CAST = r"""() => { const w = __game.world, P = w.pianta;
  const ruoli = Object.keys(CAST_VALDARNO);
  const chiesti = new Set([...w.residents.map(r => r.sprite), ...w.spawns.givers.map(g => g.sprite),
    ...w.nemici.map(n => n.sprite + '@rosso'), ...ruoli.flatMap(r => castDi(P, r))]);
  const mancano = [...chiesti].filter(n => !Assets.charDef(n));
  const per = pre => w.residents.filter(r => r.sprite.startsWith(pre)).length;
  const capo = w.spawns.givers.find(g => /fuorilegge/.test(g.name));
  return { citta: P.nome, mancano, residenti: w.residents.length,
           // il protagonista e' unico (29/09): nessuno ha il suo corpo MiniThief
           // (i ruoli dei nemici no: si disegnano sempre in rosso, @rosso)
           doppione_ladro: ruoli.filter(r => !r.startsWith('nemico'))
                             .some(r => castDi(P, r).includes('MiniThief')) ||
                           w.residents.some(r => r.sprite === 'MiniThief') ||
                           __game.npcs.some(n => n.sprite === 'MiniThief'),
           chi_doppione: __game.npcs.filter(n => n.sprite === 'MiniThief')
                           .map(n => ({ prof: n.prof, residente: n.residente, x: Math.round(n.x) })),
           banditi: per('Ban'), vichinghi: per('Vik'), capo: capo && capo.sprite,
           nemici: [...new Set(w.nemici.map(n => n.sprite))] }; }"""


def scena_cast(c):
    """Chi fa cosa per citta' (cast.js, 26/09): ogni personaggio che il mondo
    e i ruoli chiedono c'e' nell'atlante di quella citta' (uno che manca non si
    disegna e non da' errore); a Valdarno i banditi Ban* all'accampamento e il
    loro capo a cavallo; nel fiordo le guardie e i guerrieri vichinghi, il clan
    rivale vichingo, e niente saraceni ne' pirati. Foto del campo dei banditi e
    di una via del fiordo."""
    esito = {"valdarno": c.js(CONTA_CAST)}
    campo = c.js("() => { const P = __game.world.pianta; return { x: P.CAMP.x * TILE + 2, z: P.CAMP.y * TILE + 14 }; }")
    c.tp(campo, 3.0)
    esito["foto"] = [c.foto("cast_banditi_valdarno")]
    base = c.page.url.split("?")[0]
    apri(c.page, base + "?pianta=fiordo-3")
    esito["fiordo"] = c.js(CONTA_CAST)
    c.tp(c.js("() => __collaudo.piazza()"), 3.5)
    esito["fiordo"]["guardie_vicine"] = c.js("() => __game.guards.map(g => g.sprite)")
    esito["foto"].append(c.foto("cast_fiordo"))
    # il recinto della sala del jarl (26/09): chiuso tranne l'ingresso a sud,
    # e fuori dall'ingresso le guardie non ti trattano da intruso
    esito["fiordo"]["recinto_aperto"] = c.js("""() => { const w = __game.world, C = w.pianta.CORTE,
      T = TILE, cx = w.pianta.CASTLE.x * T + 2, aperti = [];
      const prova = (x, z, lungoZ) => { for (let d = -1.5; d <= 1.5; d += 0.25)
        if (w.blocked(lungoZ ? x + d : x, lungoZ ? z : z + d)) return; aperti.push([+x.toFixed(1), +z.toFixed(1)]); };
      for (let x = C.x0 * T; x <= C.x1 * T; x += 0.5) {
        prova(x, C.y0 * T, false); if (Math.abs(x - cx) > 2.6) prova(x, C.y1 * T, false); }
      for (let z = C.y0 * T; z <= C.y1 * T; z += 0.5) { prova(C.x0 * T, z, true); prova(C.x1 * T, z, true); }
      return aperti.length; }""")
    c.js("""() => { const G = __game, P = G.world.pianta; G.campagna.cap = 0; G.player.wanted = 0;
      G.debug.tp(P.CASTLE.x * TILE + 2, P.CORTE.y1 * TILE + 2.5); }""")
    c.page.wait_for_timeout(4000)
    esito["fiordo"]["fuori_dalla_porta"] = c.js("() => ({ stelle: __game.player.stars, messaggio: "
                                                "document.getElementById('msg').textContent })")
    apri(c.page, base)
    v, f = esito["valdarno"], esito["fiordo"]
    guasti = []
    if v["mancano"] or f["mancano"]:
        guasti.append(f"mancano nell'atlante: {v['mancano']} {f['mancano']}")
    if v["doppione_ladro"] or f["doppione_ladro"]:
        guasti.append("qualcuno ha lo sprite del protagonista (MiniThief)")
    if v["banditi"] < 3 or v["capo"] != "BanCapo":
        guasti.append("a Valdarno i banditi non ci sono")
    if f["vichinghi"] < 5 or not any(n.startswith("Vik") for n in f["nemici"]):
        guasti.append("nel fiordo i vichinghi non ci sono")
    if f["recinto_aperto"]:
        guasti.append(f"il recinto del jarl ha {f['recinto_aperto']} punti aperti fuori dall'ingresso")
    if f["fuori_dalla_porta"]["stelle"]:
        guasti.append("fuori dalla porta del recinto le guardie ti trattano da intruso")
    if any(n.startswith(("Sar", "Pir")) for n in v["nemici"] + f["nemici"]):
        guasti.append("saraceni o pirati fuori posto")
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


def scena_fiato(c):
    """Il fiato (26/09): si corre con Maiusc tenuto fino a fiato finito. Prima
    la corsa si spegneva e riaccendeva ogni pochi fotogrammi e l'animazione
    restava ferma al primo; ora, sfinito, si cammina finche' il fiato non
    torna a un terzo. Si campiona ogni 50 ms per circa 3 s: con Maiusc tenuto
    il ciclo (corsa, passo, corsa...) e' giusto, quanti cambi ci stanno dipende
    dalla velocita' della macchina. L'errore e' una corsa che riparte prima che
    il fiato sia tornato a un terzo (margine 0,28: il campione arriva qualche
    fotogramma dopo il cambio)."""
    c.tp(c.js("() => __collaudo.piazza()"), 1.0)
    c.js("() => { __game.player.stamina = 0.15; __game.player.sfinito = false; }")
    c.page.keyboard.down("Shift")
    c.page.keyboard.down("ArrowRight")
    anim = []
    for _ in range(45):
        anim.append(c.js("() => [__game.player.anim, +__game.player.stamina.toFixed(2)]"))
        c.page.wait_for_timeout(50)
    c.page.keyboard.up("ArrowRight")
    c.page.keyboard.up("Shift")
    moto = [a for a in anim if a[0] in ("run", "walk")]     # il primo campione e' da fermo
    coppie = list(pairwise(moto))
    cambi = sum(1 for a, b in coppie if a[0] != b[0])
    ripartenze = [b[1] for a, b in coppie if a[0] == "walk" and b[0] == "run"]
    esito = {"cambi": cambi, "prima": anim[0], "dopo": anim[-1],
             "corsa": sum(1 for a in anim if a[0] == "run"),
             "passo": sum(1 for a in anim if a[0] == "walk"),
             "ripartenze": ripartenze}
    presto = [s for s in ripartenze if s < 0.28]
    if presto or not esito["corsa"] or not esito["passo"]:
        esito["errore"] = f"a fiato finito la corsa riparte troppo presto (fiato {presto})"
    return esito


def scena_osterie(c):
    """J1: ogni osteria in cui si entra ha l'insegna col boccale e una lanterna
    accesa ai lati della facciata (entro 6 unita' dall'uscio). Foto di giorno e
    di notte di un'osteria che non ha case davanti a coprirla."""
    conta = c.js("""() => {
      const w = __game.world, porte = __game.Interni.porte.filter(p => p.tipo === 'taverna');
      const vicino = (nome, p) => w.props.some(q => q.name === nome &&
                                   Math.hypot(q.x - p.x, q.z - p.z) < 6);
      const luce = p => w.lights.some(L => Math.hypot(L.x - p.x, L.z - p.z) < 6);
      // coperta: un edificio alto poco piu' a sud dell'uscio (la camera guarda
      // da sud) nasconde porta, insegna e lanterna
      const coperta = p => w.props.some(q => q.hu > 4 && q.z > p.z &&
                                        q.z - p.z < 7 && Math.abs(q.x - p.x) < 6);
      const libera = porte.find(p => !coperta(p)) || porte[0];
      return { osterie: porte.length,
               con_insegna: porte.filter(p => vicino('insegna_osteria', p)).length,
               con_lanterna: porte.filter(p => vicino('lanterna_palo', p) && luce(p)).length,
               coperte_da_case_davanti: porte.filter(coperta).length,
               prima: {x: libera.x, z: libera.z} };
    }""")
    p = conta.pop("prima")
    c.js("() => __game.debug.setDay(0.4)")
    c.tp({"x": p["x"] + 1.0, "z": p["z"] + 6.0}, 2.5)
    foto = [c.foto("osteria_giorno")]
    c.js("() => __game.debug.setDay(0.93)")
    c.page.wait_for_timeout(1500)
    foto.append(c.foto("osteria_notte"))
    c.js("() => __game.debug.setDay(0.35)")
    esito = {**conta, "foto": foto}
    if not conta["osterie"] or conta["con_insegna"] < conta["osterie"] \
            or conta["con_lanterna"] < conta["osterie"]:
        esito["errore"] = "ci sono osterie senza insegna o lanterna"
    return esito


# un posto fuori dalle mura dove la tenda si puo' piantare: nei campi,
# lontano dalle strade (dove passano ronde e carri) e senza alberi alti
# davanti, che nella foto la coprirebbero
POSTO_TENDA = r"""() => {
  const w = __game.world, c = __collaudo.quartieri().campi;
  for (let r = 6; r < 140; r += 2)
    for (let a = 0; a < 6.28; a += 0.4) {
      const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      const tx = Math.floor(x / TILE), ty = Math.floor(z / TILE);
      if (w.road[w.idx(tx, ty)] || w.nearRoad(x, z, 3)) continue;
      // lontano dalle porte (06/10: nel borgo di fiume i campi stanno appena
      // di la' dal ponte, e le guardie che nascono vicino alla porta azzerano la barra)
      if (w.pianta.GATES.some(g => Math.hypot(g.x * TILE - x, g.y * TILE - z) < 70)) continue;
      if (w.props.some(p => p.hu > 2.5 && Math.hypot(p.x - x, p.z - z) < 8)) continue;
      if (!Tenda.divieto(x, z - 1.2) && !w.blocked(x, z)) return {x, z};
    }
  return null;
}"""


def _tieni_t(c, secondi, senza_occhi=False):
    """Tiene premuto T. senza_occhi: toglie di mezzo guardie e nemici che
    arrivano (il collaudo prova il lavoro, non la ronda)."""
    c.js("() => __game.debug.premi('tenda', true)")
    for _ in range(int(secondi * 4)):
        if senza_occhi:
            c.js("() => { __game.guards.length = 0; __game.nemici.length = 0; }")
        c.page.wait_for_timeout(250)
    c.js("() => __game.debug.premi('tenda', false)")


def _presso_arredo(c, azione):
    c.js("""(az) => { const s = __game.Interni.stanza, a = s.arredo.find(q => q.azione === az);
            const p = __game.player; p.x = a.x; p.z = a.z + s.C * 0.6; }""", azione)
    c.page.wait_for_timeout(300)


def scena_tenda(c):
    """G: la tenda arriva con la fine del capitolo 1; dentro le mura non si
    pianta, fuori si' (T tenuto 4 s); si entra, si riposa fino al mattino e si
    salva (la tenda sta nel salvataggio); si esce e si smonta."""
    c.tp(c.js("() => __collaudo.piazza()"), 1.5)
    # fine del capitolo 1: ultimo incarico chiuso
    c.js("() => { const g = __game; g.campagna.cap = 0; g.campagna.miss = 2; "
         "g.campagna.attiva = null; g.debug.avanza(); }")
    esito = {"dono": c.js("() => ({tenda: Tenda.posseduta, "
                          "arsenale: __game.player.arsenale.join(',')})")}
    c.js("() => __game.player.wanted = 0")

    _tieni_t(c, 5.0)
    esito["dentro_le_mura"] = {"piantata": c.js("() => !!Tenda.piantata"),
                               "messaggio": c.page.locator("#msg").inner_text()}

    posto = c.js(POSTO_TENDA)
    c.tp(posto, 1.5)
    c.js("() => __game.player.wanted = 0")
    _tieni_t(c, 1.5, True)
    esito["barra"] = c.page.locator("#conquista").inner_text().replace("\n", " · ")
    # fino a 12 s in tutto: una guardia che rinasce in vista fra una pulizia e
    # l'altra azzera la barra (e' la regola), e nel giro completo capita
    c.js("() => __game.debug.premi('tenda', true)")
    tenuto = 1.5
    while tenuto < 12 and not c.js("() => !!Tenda.piantata"):
        c.js("() => { __game.guards.length = 0; __game.nemici.length = 0; }")
        c.page.wait_for_timeout(100)
        tenuto += 0.1
    c.js("() => __game.debug.premi('tenda', false)")
    t = c.js("() => Tenda.piantata")
    esito["fuori"] = {"posto": posto, "piantata": t, "tenuto_s": round(tenuto, 1)}
    if not t:
        esito["errore"] = "fuori dalle mura la tenda non si pianta"
        return esito
    c.js("([x, z]) => { const p = __game.player; p.x = x + 3; p.z = z + 4; }", [t["x"], t["z"]])
    c.page.wait_for_timeout(600)
    esito["foto"] = [c.foto("tenda_piantata")]

    # dentro
    c.js("([x, z]) => { const p = __game.player; p.x = x; p.z = z + 2.2; }", [t["x"], t["z"]])
    c.page.wait_for_timeout(300)
    c.page.keyboard.press("e")
    c.page.wait_for_timeout(1500)
    esito["dentro"] = c.js("() => __game.Interni.dentro && __game.Interni.stanza.tipologia")
    esito["foto"].append(c.foto("tenda_dentro"))

    c.js("() => { __game.player.hp = 30; __game.debug.setDay(0.85); }")
    _presso_arredo(c, "riposa")
    esito["suggerimento_giaciglio"] = c.page.locator("#prompt").inner_text()
    c.page.keyboard.press("e")
    c.page.wait_for_timeout(1500)
    esito["riposo"] = c.js("() => ({salute: Math.round(__game.player.hp), "
                           "ora: Math.round(Salvataggio.stato().ora * 100) / 100})")
    _presso_arredo(c, "salva")
    esito["suggerimento_cassa"] = c.page.locator("#prompt").inner_text()
    c.js("() => localStorage.removeItem(Salvataggio.CHIAVE)")
    c.page.keyboard.press("e")
    c.page.wait_for_timeout(500)
    esito["salvato"] = c.js("() => { const s = Salvataggio.leggiLocale(); "
                            "return s && {tenda: s.tenda, posizione: s.posizione}; }")

    # fuori e smontata
    c.js("() => { const p = __game.player; p.z = __game.Interni.stanza.soglia + 1.5; }")
    c.page.wait_for_timeout(1500)
    esito["uscito"] = not c.js("() => __game.Interni.dentro")
    _tieni_t(c, 5.0, True)
    esito["smontata"] = c.js("() => !Tenda.piantata && Tenda.posseduta")

    r = esito["riposo"]
    if not esito["dono"]["tenda"]:
        esito["errore"] = "la fine del capitolo 1 non da' la tenda"
    elif esito["dentro_le_mura"]["piantata"]:
        esito["errore"] = "la tenda si pianta dentro le mura"
    elif esito["dentro"] != "tenda":
        esito["errore"] = "nella tenda non si entra"
    elif r["salute"] < 99 or not (0.2 <= r["ora"] <= 0.3):
        esito["errore"] = "il riposo non rimette in salute fino al mattino"
    elif not esito["salvato"] or not esito["salvato"]["tenda"]["piantata"]:
        esito["errore"] = "nella tenda non si salva (o la tenda manca nel salvataggio)"
    elif not esito["uscito"] or not esito["smontata"]:
        esito["errore"] = "la tenda non si smonta"
    return esito


STATO_PROVA = r"""() => {
  const g = __game, p = g.player, s = __collaudo.piazza();
  return { soldi: p.money, salute: Math.round(p.hp), arma: p.arma,
           arsenale: p.arsenale.join(','), capitolo: g.campagna.cap,
           missione: g.campagna.miss, campo0: !!g.world.accampamenti[0].preso,
           ora: Math.round(Salvataggio.stato().ora * 100) / 100,
           meteo: Meteo.tipo,
           dx: Math.round(p.x - s.x), dz: Math.round(p.z - s.z) };
}"""

# lo stato che si salva: diverso da quello d'avvio in ogni campo
IMPOSTA_PROVA = r"""() => {
  const g = __game, p = g.player, s = __collaudo.piazza();
  g.debug.tp(s.x + 12, s.z + 7);
  p.money = 345; p.hp = 64; p.arsenale = ['spada', 'pugnale', 'arco'];
  p.equipaggia('arco');
  g.campagna.cap = 2; g.campagna.miss = 1;
  g.debug.setDay(0.55);
  Meteo.imposta('nebbia');
  g.world.issaColoriDelBorgo(g.world.accampamenti[0]);
}"""

# e lo stato "sbagliato" da cui si ricarica
SPORCA_PROVA = r"""() => {
  const g = __game, p = g.player, s = __collaudo.piazza();
  g.debug.tp(s.x - 40, s.z - 30);
  p.money = 1; p.hp = 20; p.arsenale = ['spada']; p.equipaggia('spada');
  g.campagna.cap = 0; g.campagna.miss = 0; g.debug.setDay(0.9);
  Meteo.imposta('sereno');
}"""


def scena_salvataggio(c):
    """F4: salva (localStorage), sporca lo stato, ricarica e confronta; poi lo
    stesso dal file esportato e reimportato col selettore della schermata
    titolo; infine "Continua" dopo aver ricaricato la pagina. Il confronto e'
    campo per campo. L'ultima perche' ricarica la pagina."""
    c.tp(c.js("() => __collaudo.piazza()"), 1.5)
    c.js(IMPOSTA_PROVA)
    c.page.wait_for_timeout(300)
    atteso = c.js(STATO_PROVA)
    salvato = c.js("() => Salvataggio.salva()")
    esito = {"atteso": atteso, "nel_browser": salvato.get("nelBrowser")}
    # il gioco non e' fermo: l'ora corre (1 s = 0,004 di giorno), la salute
    # risale da sola (1,6 al secondo), la gente spinge
    tolleranza = {"ora": 0.03, "salute": 6, "dx": 2, "dz": 2}

    def diff(a):
        fuori = {}
        for k, v in atteso.items():
            t = tolleranza.get(k)
            if (abs(a[k] - v) > t) if t else (a[k] != v):
                fuori[k] = (v, a[k])
        return fuori

    # 1. dal browser
    c.js(SPORCA_PROVA)
    c.page.wait_for_timeout(300)
    c.js("() => Game.carica(Salvataggio.leggiLocale())")
    c.page.wait_for_timeout(1500)
    esito["da_localstorage"] = diff(c.js(STATO_PROVA))
    esito["foto"] = [c.foto("salvataggio_ripreso")]

    # 2. dal file: "Esporta partita" scarica, "Importa partita" rilegge
    with c.page.expect_download() as dl:
        c.js("() => Game.esportaUltimo()")
    file = c.cartella / "salvataggio_prova.json"
    dl.value.save_as(str(file))
    esito["file"] = {"nome": dl.value.suggested_filename,
                     "byte": file.stat().st_size}
    c.js(SPORCA_PROVA)
    c.js("() => { document.getElementById('title').style.display = 'flex'; }")
    c.page.wait_for_timeout(300)
    esito["foto"].append(c.foto("salvataggio_titolo"))
    c.page.set_input_files("#importaFile", str(file))
    c.page.wait_for_timeout(1500)
    esito["da_file"] = diff(c.js(STATO_PROVA))
    esito["titolo_chiuso"] = c.js("() => document.getElementById('title').style.display === 'none'")

    # 3. un file che non e' un salvataggio: rifiutato, lo stato non cambia
    rotto = c.cartella / "salvataggio_rotto.json"
    rotto.write_text('{"gioco": "altro"}', encoding="utf-8")
    c.js("() => { document.getElementById('title').style.display = 'flex'; }")
    c.page.set_input_files("#importaFile", str(rotto))
    c.page.wait_for_timeout(500)
    esito["file_rotto"] = c.page.locator("#loading").inner_text()
    esito["dopo_file_rotto"] = diff(c.js(STATO_PROVA))

    # 4. "Continua" dopo aver riaperto la pagina
    c.page.reload(wait_until="load")
    c.page.wait_for_function(
        "() => document.getElementById('loading').textContent === 'pronto'", timeout=60000)
    c.page.evaluate(AIUTANTI)
    cont = c.page.locator("#continuaBtn")
    esito["continua"] = cont.inner_text() if cont.is_visible() else None
    if esito["continua"]:
        cont.click()
        c.page.wait_for_timeout(2000)
        esito["da_continua"] = diff(c.js(STATO_PROVA))
        esito["foto"].append(c.foto("salvataggio_continua"))

    guasti = [k for k in ("da_localstorage", "da_file", "da_continua")
              if esito.get(k)]
    if (not esito["nel_browser"] or guasti or not esito["titolo_chiuso"]
            or not esito["continua"] or "non valido" not in esito["file_rotto"]
            or esito["dopo_file_rotto"] != {}):
        esito["errore"] = f"il salvataggio non rimette tutto com'era: {guasti}"
    return esito


SCENE = {
    "quartieri": scena_quartieri, "corte": scena_corte, "campo": scena_campo,
    "pineta": scena_pineta, "carro": scena_carro, "fucina": scena_fucina,
    "notte": scena_notte, "committente": scena_committente,
    "bersagli": scena_bersagli, "assalti": scena_assalti,
    "lanterna": scena_lanterna, "folla": scena_folla,
    "messaggero": scena_messaggero, "taverna": scena_taverna,
    "sconfino": scena_sconfino, "strage": scena_strage,
    "traffico": scena_traffico, "furto_carro": scena_furto_carro,
    "incidente": scena_incidente, "pieve_castello": scena_pieve_castello,
    "barca": scena_barca, "fuga": scena_fuga, "tenda": scena_tenda,
    "osterie": scena_osterie, "cunicolo": scena_cunicolo,
    "generatore": scena_generatore, "piantoni": scena_piantoni,
    "meteo": scena_meteo, "citta": scena_citta, "viaggio": scena_viaggio,
    "fuochi": scena_fuochi, "interni_fiordo": scena_interni_fiordo, "cast": scena_cast,
    "fiato": scena_fiato,
    **SCENE_CAMPAGNA,
    **SCENE_NEBBIA,
    **SCENE_NAVE,
    **SCENE_NAVE_PASSI,
    **SCENE_BESTIE,
    **SCENE_ATTO4,
    **SCENE_ATTO5,
    **SCENE_COMANDI,
    "salvataggio": scena_salvataggio,     # ultima: ricarica la pagina
}


def apri(page, url):
    page.goto(url, wait_until="load", timeout=60000)
    page.wait_for_function(
        "() => document.getElementById('loading').textContent !== 'caricamento…'",
        timeout=60000)
    page.evaluate("() => { document.getElementById('title').style.display = 'none'; }")
    page.evaluate(AIUTANTI)
    page.wait_for_timeout(2000)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("scene", nargs="*", help="scene da girare (default: tutte)")
    ap.add_argument("--url", default="http://127.0.0.1:8123/index.html")
    ap.add_argument("--out", default=str(RADICE / "out" / "collaudo"))
    ap.add_argument("--headed", action="store_true", help="finestra visibile")
    args = ap.parse_args()

    scelte = args.scene or list(SCENE)
    ignote = [s for s in scelte if s not in SCENE]
    if ignote:
        sys.exit(f"scene sconosciute: {ignote}; disponibili: {list(SCENE)}")
    cartella = Path(args.out)
    cartella.mkdir(parents=True, exist_ok=True)

    rapporto = {"quando": time.strftime("%Y-%m-%d %H:%M:%S"), "scene": {}}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=not args.headed,
            args=["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11"])
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        c = Collaudo(page, cartella)
        t0 = time.time()
        apri(page, args.url)
        rapporto["caricamento_s"] = round(time.time() - t0, 1)
        rapporto["firma"] = c.js("() => __collaudo.firma()")
        c.firma0 = rapporto["firma"]["hash"]
        for nome in scelte:
            try:
                rapporto["scene"][nome] = SCENE[nome](c)
            except Exception as e:  # noqa: BLE001 — una scena rotta non ferma le altre
                rapporto["scene"][nome] = {"errore": f"{type(e).__name__}: {e}"}
        browser.close()

    errori = [f"[{t}] {m}" for t, m in c.log if t in ("error", "pageerror", "404?")]
    rapporto["errori_console"] = errori
    rapporto["avvisi_console"] = [m for t, m in c.log if t == "warning"][:20]
    (cartella / "rapporto.json").write_text(
        json.dumps(rapporto, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(rapporto, indent=1, ensure_ascii=False))

    falliti = [n for n, s in rapporto["scene"].items()
               if isinstance(s, dict) and "errore" in s]
    print(f"\nerrori di console: {len(errori)} · scene fallite: {falliti or 'nessuna'}")
    sys.exit(1 if errori or falliti else 0)


if __name__ == "__main__":
    main()
