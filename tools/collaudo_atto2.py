"""collaudo_atto2.py — l'atto II nel Fiordo, giocato (29/09).

I cinque capitoli dell'atto II (storia_fiordo.js) coi committenti ai loro
posti: si va dal committente (il pescatore al porto, il jarl nella sua sala,
la veggente nello hof) e si preme E; l'incarico parte col tipo e il luogo
giusti e lo si chiude col gancio di collaudo (i tipi sono provati uno per uno
nelle missioni di prova, collaudo_missioni.py). Poi il finale: la scena "Il
prezzo" e il passaggio all'atto III. Stesse regole di collaudo.py; le
raccoglie collaudo_campagna.py in SCENE_CAMPAGNA.
"""

# i salvataggi del browser e il ladro com'erano: si rimettono alla fine
PRIMA = """() => { window.__prima = {};
  for (const k of Object.keys(localStorage)) if (k.startsWith(Salvataggio.CHIAVE))
    window.__prima[k] = localStorage.getItem(k);
  const p = __game.player;
  window.__ladro = { soldi: p.money, arsenale: [...p.arsenale], arma: p.arma,
                     tenda: Tenda.perSalvare() }; }"""

RIMETTI = """() => { const s = Storia.stato;
  Object.assign(s, { atto: 0, cap: 0, miss: 0, finita: false, attiva: null }); s.segni = [];
  const p = __game.player, l = window.__ladro;
  if (p.vehicle) { p.vehicle.rider = null; p.scendi(); }
  p.money = l.soldi; p.arsenale = l.arsenale; p.equipaggia(l.arma); Tenda.rimetti(l.tenda);
  p.wanted = 0;
  for (const k of Object.keys(localStorage)) if (k.startsWith(Salvataggio.CHIAVE))
    localStorage.removeItem(k);
  for (const [k, v] of Object.entries(window.__prima)) localStorage.setItem(k, v); }"""

CALMA = """() => { const g = __game; g.assalto.attivo = false; g.assalto.prossimo = 999;
  g.player.wanted = 0; g.player.hp = g.player.maxHp; g.player.dead = false; }"""

# l'incarico in corso, misurato: il tipo, la meta, e per ogni tipo quel che
# dice se e' nel posto giusto
INCARICO = r"""() => { const g = __game, m = g.campagna.attiva, w = g.world;
  const d = (a, b) => a && b ? +Math.hypot(a.x - b.x, a.z - b.z).toFixed(1) : null;
  if (!m) return { tipo: null, msg: document.getElementById('msg').textContent };
  const goal = m.goal || m.centro || m.porta_ || m.prigione || null;
  const luogo = m.luogo ? Missioni.luogo(m.luogo) : null;
  const dir = m.fuori ? ({ '0,-1': 'N', '0,1': 'S', '-1,0': 'W', '1,0': 'E' })[m.fuori.join(',')] : null;
  const zona = q => q ? w.district[w.idx(Math.floor(q.x / TILE), Math.floor(q.z / TILE))] : null;
  return { tipo: m.tipo, cap: g.campagna.cap, miss: g.campagna.miss,
           goal_bloccato: goal ? !!w.blocked(goal.x, goal.z) : null,
           dal_luogo: m.tipo === 'consegna' ? d(m.goal, luogo) : null,
           cerchio_dal_thing: m.centro ? d(m.centro, Missioni.luogo('thing')) : null,
           pieni: m.pieni ?? null, porta: dir, ondate: m.ondate ?? null,
           bersaglio: m.target ? { sprite: m.target.sprite, dal_luogo: d(m.target, luogo) } : null,
           ostaggi: m.ostaggi ? m.ostaggi.length : null, meta_zona: m.ostaggi ? zona(m.meta) : null,
           mezzo: m.mezzoGara ? m.mezzoGara.type : null, tappe: m.tappe_ ? m.tappe_.length : null,
           orme: m.tracce ? m.tracce.length : null,
           msg: document.getElementById('msg').textContent }; }"""

# vicino a dove succede, senza debug.tp (svuota la gente dell'incarico)
VICINO = """() => { const m = __game.campagna.attiva, p = __game.player;
  const q = m.centro ? { x: m.centro.x, z: m.centro.z + m.R + 4 }
    : m.prigione ? { x: m.prigione.x, z: m.prigione.z + 16 }
    : m.tracce ? { x: m.tracce[0].x, z: m.tracce[0].z + 4 }
    : m.porta_ ? { x: m.porta_.x - m.fuori[0] * 18, z: m.porta_.z - m.fuori[1] * 18 }
    : m.mezzoGara ? { x: m.mezzoGara.x, z: m.mezzoGara.z + 3 } : null;
  if (q) { p.x = q.x; p.z = q.z; p.vx = p.vz = 0; }
  return !!q; }"""

# i capitoli come devono uscire: committente, e per passo il tipo e cosa
# misurare (None: niente oltre il tipo). La foto: il passo che si fotografa
ATTESI = [
    ("pescatore", [("consegna", "recinto"), ("gara", "barca"), ("consegna", None)], 1),
    ("pescatore", [("caccia", "brigante"), ("scorta", "porto"), ("difesa", "N2")], 1),
    ("jarl", [("consegna", "thing"), ("duello", "thing"), ("consegna", "sala")], 1),
    ("veggente", [("bestia", None), ("consegna", "hof"), ("gara", "barca")], 0),
    # la seconda porta di terra (storia_fiordo.js, porta: 1): dal 06/10 quella
    # di ponente, perche' a levante c'e' l'insenatura (la bozza dice levante)
    ("jarl", [("difesa", "W3"), ("caccia", "campo"), ("consegna", "sala")], 0),
]


def _parla(c, chiave):
    """Dal committente `chiave`, E. Per strada ci si mette davanti a lui; se sta
    in una stanza (il jarl, la veggente) si entra, E davanti a lui, e si esce."""
    c.js(CALMA)
    g = c.js("""(k) => { const n = Storia.committente(k);
      const g = __game.world.spawns.givers.find(q => q.name === n);
      return g && { x: g.x, z: g.z, stanza: g.stanza || null, nome: n }; }""", chiave)
    if not g:
        return {"trovato": False}
    if not g["stanza"]:
        c.tp({"x": g["x"], "z": g["z"] + 2.0}, 1.2)
        c.page.keyboard.press("KeyE")
        c.page.wait_for_timeout(700)
        return {"trovato": True, "nome": g["nome"], "stanza": None}
    porta = c.js("(t) => { const p = __game.Interni.porte.find(q => q.tipo === t); "
                 "return p && { x: p.x, z: p.z }; }", g["stanza"])
    c.tp({"x": porta["x"], "z": porta["z"] + 1.0}, 1.5)
    c.js(CALMA)
    c.page.keyboard.press("KeyE")
    c.page.wait_for_timeout(1300)
    dentro = c.js("""(k) => { const I = __game.Interni, s = I.dentro && I.stanza;
      const r = s && s.residenti.find(q => q.committente === k);
      if (!r) return { dentro: !!s, residente: false };
      const p = __game.player; p.x = r.x; p.z = r.z + 1.6; p.vx = p.vz = 0;
      return { dentro: true, residente: true, stanza: s.nome }; }""", chiave)
    c.page.wait_for_timeout(400)
    dentro["prompt"] = c.js("() => document.getElementById('prompt').textContent")
    c.page.keyboard.press("KeyE")
    c.page.wait_for_timeout(700)
    dentro["dopo_e"] = c.js("() => ({ msg: document.getElementById('msg').textContent, "
                            "morto: __game.player.dead, scena: Passaggi.attiva })")
    if dentro["dentro"]:
        c.js("() => { const e = __game.Interni.stanza.entrata; "
             "__game.player.x = e.x; __game.player.z = e.z; }")
        c.page.keyboard.down("ArrowDown")
        c.page.wait_for_timeout(1600)
        c.page.keyboard.up("ArrowDown")
        c.page.wait_for_timeout(900)
    return {"trovato": True, "nome": g["nome"], "stanza": g["stanza"], **dentro}


def _guasti_passo(k, n, atteso, misura):
    """Cosa non va in un incarico appena partito, rispetto a quel che deve essere."""
    tipo, cosa = atteso
    dove = f"cap {k + 1} passo {n + 1}"
    if misura["tipo"] != tipo:
        return [f"{dove}: tipo {misura['tipo']} invece di {tipo} ({misura.get('msg')!r})"]
    g = []
    # la gara in barca parte dalla barca, che sta in acqua (e l'acqua blocca)
    if misura["goal_bloccato"] and tipo != "gara":
        g.append(f"{dove}: la meta sta dentro un ostacolo")
    if tipo == "consegna" and cosa and (misura["dal_luogo"] is None or misura["dal_luogo"] > 6):
        g.append(f"{dove}: la consegna non e' a {cosa} ({misura['dal_luogo']})")
    if tipo == "duello" and (misura["cerchio_dal_thing"] > 14 or misura["pieni"] > 4):
        g.append(f"{dove}: il cerchio non e' al thing o non e' sgombro: {misura}")
    if tipo == "difesa" and (misura["porta"], misura["ondate"]) != (cosa[0], int(cosa[1])):
        g.append(f"{dove}: difesa alla porta {misura['porta']}, {misura['ondate']} ondate")
    if tipo == "caccia":
        b = misura["bersaglio"] or {}
        if cosa == "brigante" and not str(b.get("sprite", "")).startswith("Ban"):
            g.append(f"{dove}: il bersaglio non e' un bandito: {b}")
        # nasce al campo e ti viene incontro: qualche passo l'ha gia' fatto
        if cosa == "campo" and (b.get("sprite") != "VikBerserker@rosso" or b.get("dal_luogo", 99) > 16):
            g.append(f"{dove}: il capo del clan rosso non e' al campo: {b}")
    if tipo == "scorta" and (misura["ostaggi"], misura["meta_zona"]) != (2, 5):
        g.append(f"{dove}: scorta di {misura['ostaggi']} verso la zona {misura['meta_zona']}")
    if tipo == "gara" and (misura["mezzo"] != cosa or (misura["tappe"] or 0) < 3):
        g.append(f"{dove}: gara in {misura['mezzo']} con {misura['tappe']} tappe")
    return g


def scena_atto2(c):
    """L'atto II capitolo per capitolo, nel fiordo 3: per ogni passo si va dal
    committente e si preme E; l'incarico ha il tipo, il luogo e la gente della
    bozza (la consegna alla sala, al thing, allo hof; il duello nel thing; la
    difesa alla porta nord con due ondate e a ponente con tre; il bandito al
    porto, il capo del clan rosso al suo campo; la scorta dei due ragazzi
    verso il porto; le gare in barca); si chiude col gancio. A fine capitolo
    il premio e il committente seguente. Il recinto del jarl, dal capitolo 3,
    non da' la taglia. Una foto per capitolo."""
    c.js(PRIMA)
    c.js("() => __game.debug.citta('fiordo-3')")
    c.page.wait_for_timeout(3000)
    c.js("""() => { const s = Storia.stato;
      Object.assign(s, { atto: 1, cap: 0, miss: 0, finita: false, attiva: null });
      s.segni = ['taglia del Ciambellano']; __game.player.money = 0; }""")
    esito = {"capitoli": [], "foto": []}
    guasti = []
    for k, (chiave, passi, da_foto) in enumerate(ATTESI):
        cap = {"committente": chiave, "passi": []}
        soldi0 = c.js("() => __game.player.money")
        cap["obiettivo"] = c.js("() => document.getElementById('objective').textContent")
        for n, atteso in enumerate(passi):
            # un passo `subito` e' gia' partito alla chiusura del precedente
            subito = c.js(f"() => !!Storia.campagna().capitoli[{k}].missioni[{n}].subito")
            parla = {"subito": True, "trovato": True} if subito else _parla(c, chiave)
            c.page.wait_for_timeout(300)
            misura = c.js(INCARICO)
            misura["parla"] = parla
            cap["passi"].append(misura)
            guasti += _guasti_passo(k, n, atteso, misura)
            if not parla.get("trovato"):
                guasti.append(f"cap {k + 1}: il committente {chiave} non c'e'")
            if n == da_foto and misura["tipo"]:
                if c.js(VICINO):
                    c.page.wait_for_timeout(2500)
                esito["foto"].append(c.foto(f"atto2_cap{k + 1}_{misura['tipo']}"))
            if k == 2 and n == 0:
                # nella sala del jarl (capitolo 3): stelle dopo il recinto
                cap["stelle_dopo_il_recinto"] = c.js("() => __game.player.stars")
            # l'ultimo passo del capitolo 5 no: farebbe partire il finale
            if misura["tipo"] and (k, n) != (4, 2):
                c.tp(c.js("() => __collaudo.piazza()"), 0.5)   # via dal bosco e dalle bestie
                c.js("() => __game.debug.avanza()")
                c.page.wait_for_timeout(400)
        cap["soldi"] = c.js("() => __game.player.money") - soldi0
        cap["chiusura"] = c.js("() => document.getElementById('msg').textContent")
        cap["premio"] = c.js(f"() => Storia.campagna().capitoli[{k}].premio") if k < 4 else None
        esito["capitoli"].append(cap)
        # l'obiettivo del capitolo lo scrive la chiusura del precedente
        if k and c.js("(k) => Storia.committente(k)", chiave) not in cap["obiettivo"]:
            guasti.append(f"cap {k + 1}: l'obiettivo non dice il committente: {cap['obiettivo']!r}")
        if k < 4 and cap["soldi"] != 40 * (len(passi) - 1) + cap["premio"]:
            guasti.append(f"cap {k + 1}: pagati {cap['soldi']} invece di "
                          f"{40 * (len(passi) - 1) + cap['premio']}")
        if cap.get("stelle_dopo_il_recinto"):
            guasti.append("cap 3: nel recinto del jarl si prende la taglia")
    # l'ultimo passo e' partito ma non chiuso: lo chiude la scena atto2_finale
    esito["fps"] = c.fps()
    c.js("() => { const m = __game.campagna.attiva; Missioni.chiudi(m); __game.campagna.attiva = null; }")
    c.js(RIMETTI)
    c.js("() => __game.debug.citta('valdarno')")
    c.page.wait_for_timeout(3000)
    esito["firma"] = c.js("() => __collaudo.firma()")["hash"]
    c.tp(c.js("() => __collaudo.piazza()"), 1.0)
    if esito["firma"] != c.firma0:
        guasti.append(f"Valdarno al ritorno ha firma {esito['firma']}")
    if esito["fps"] < 30:
        guasti.append(f"fps {esito['fps']}")
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


def scena_atto2_finale(c):
    """Il finale dell'atto II e il passaggio all'atto III: al capitolo 5 dal
    jarl parte la caccia al capo del clan rosso; chiusa quella, l'ultimo passo
    (la consegna alla sala) parte da se' ("subito"); arrivati alla sala, la
    scena "Il prezzo" (sei righe), poi l'atto III: soldi a zero, la sola spada corta,
    niente tenda; dal 08/10 ci si sveglia in catene nella stiva della galea
    (prima si restava nel fiordo col messaggio "l'atto III e' ancora da
    fare"), col capitolo 1 da cominciare e il posto dell'atto III fra i
    salvataggi. Il vecchio al remo apre il passo 1 (ascolta). Poi tutto com'era."""
    c.js(PRIMA)
    c.js("() => __game.debug.citta('fiordo-3')")
    c.page.wait_for_timeout(3000)
    c.js("""() => { const s = Storia.stato, p = __game.player;
      Object.assign(s, { atto: 1, cap: 4, miss: 1, finita: false, attiva: null });
      s.segni = ['taglia del Ciambellano'];
      p.money = 333; p.arsenale = ['spada', 'arco', 'lancia']; p.equipaggia('arco');
      Tenda.rimetti({ posseduta: true }); }""")
    esito = {"parla": _parla(c, "jarl")}
    esito["caccia"] = c.js(INCARICO)["tipo"]
    # la caccia si chiude lontano dalla sala (al campo): qui dalla piazza
    c.tp(c.js("() => __collaudo.piazza()"), 0.5)
    c.js("() => __game.debug.avanza()")
    c.page.wait_for_timeout(400)
    esito["incarico"] = c.js(INCARICO)
    esito["soldi_prima"] = c.js("() => __game.player.money")
    goal = c.js("() => { const m = __game.campagna.attiva; return m && m.goal; }")
    guasti = []
    if esito["caccia"] != "caccia" or esito["incarico"]["tipo"] != "consegna":
        guasti.append(f"caccia e poi la consegna da se': {esito['caccia']}, {esito['incarico']}")
    if not goal:
        esito["errore"] = f"dopo la caccia non parte l'ultimo passo: {esito['incarico']}"
        c.js(RIMETTI)
        return esito
    c.js("([x, z]) => { const p = __game.player; p.x = x; p.z = z + 1; p.vx = p.vz = 0; }",
         [goal["x"], goal["z"]])
    c.page.wait_for_function("() => Passaggi.attiva", timeout=8000)
    c.page.wait_for_timeout(800)
    scena = c.js("() => ({ titolo: document.getElementById('scenaTitolo').textContent, "
                 "righe: SCENE_PASSAGGIO.prezzo.righe.length })")
    for _ in range(scena["righe"] - 1):
        c.page.keyboard.press("KeyE")
        c.page.wait_for_timeout(350)
    esito["foto"] = [c.foto("atto2_prezzo")]
    c.page.keyboard.press("KeyE")
    c.page.wait_for_function("() => !Passaggi.attiva", timeout=20000)
    c.page.wait_for_timeout(1500)
    esito["scena"] = scena
    esito["dopo"] = c.js("""() => { const g = __game, p = g.player;
      return { chiave: g.world.pianta.chiave, atto: Storia.stato.atto, titolo: Storia.titolo,
               soldi: p.money, arsenale: [...p.arsenale], arma: p.arma,
               tenda: Tenda.perSalvare().posseduta, in_barca: !!p.vehicle,
               attiva: !!g.campagna.attiva, capitolo: !!Storia.capitolo(),
               posto_atto3: Salvataggio.leggiAtti().some(x => x.atto === 2),
               nel_recinto: (C => p.x > C.x0 * TILE && p.x < C.x1 * TILE && p.z > C.y0 * TILE &&
                                  p.z < C.y1 * TILE)(g.world.pianta.CORTE),
               obiettivo: document.getElementById('objective').textContent,
               msg: document.getElementById('msg').textContent,
               dentro: Interni.dentro, stanza: Interni.dentro && Interni.stanza.tipologia,
               catene: Nave.inCatene }; }""")
    esito["foto"].append(c.foto("atto3_stiva"))
    # il vecchio al remo, accanto a lui nella stiva: apre il passo 1
    c.js("""() => { const s = Interni.stanza, p = __game.player;
      p.x = -320 + 5.5 * s.C; p.z = -320 + 3.5 * s.C; p.vx = p.vz = 0; }""")
    c.page.wait_for_timeout(300)
    c.page.keyboard.press("KeyE")
    c.page.wait_for_timeout(500)
    esito["passo1"] = c.js(INCARICO)["tipo"]
    c.js(RIMETTI)
    c.js("() => __game.debug.citta('valdarno')")
    c.page.wait_for_timeout(3000)
    esito["firma"] = c.js("() => __collaudo.firma()")["hash"]
    c.tp(c.js("() => __collaudo.piazza()"), 1.0)

    d = esito["dopo"]
    if scena["titolo"] != "Il prezzo" or scena["righe"] != 6:
        guasti.append(f"la scena del finale: {scena}")
    if (d["chiave"], d["atto"], d["titolo"]) != ("fiordo-3", 2, "Il mare"):
        guasti.append(f"dopo il finale: {d['chiave']}, atto {d['atto']}, {d['titolo']}")
    if (d["soldi"], d["arsenale"], d["arma"], d["tenda"]) != (0, ["spada"], "spada", False):
        guasti.append(f"in catene non si e' perso tutto: {d}")
    if d["in_barca"] or d["attiva"] or not d["capitolo"]:
        guasti.append(f"dopo il finale in barca, con un incarico o senza capitolo: {d}")
    if (d["dentro"], d["stanza"], d["catene"]) != (True, "stiva", True):
        guasti.append(f"dopo il finale non ci si sveglia in catene nella stiva: {d}")
    if "Parla col vecchio al remo" not in d["msg"] or not d["posto_atto3"]:
        guasti.append(f"niente messaggio dell'atto III o niente posto: {d}")
    if esito["passo1"] != "ascolta":
        guasti.append(f"il vecchio al remo non apre il passo 1: {esito['passo1']!r}")
    if esito["firma"] != c.firma0:
        guasti.append(f"Valdarno al ritorno ha firma {esito['firma']}")
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito
