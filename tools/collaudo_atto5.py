"""collaudo_atto5.py — l'atto V, il ritorno a Valdarno, giocato (13/10).

Valdarno cambiata (la forca in piazza, il Ciambellano non piu' committente
nella corte, il ladro in beige); i cinque capitoli (storia_ritorno.js) coi
committenti di Valdarno ai loro posti, ogni incarico col tipo e il luogo
giusti, chiuso col gancio di collaudo; poi il finale: il Ciambellano preso
vivo nella corte, portato in piazza, la scena "La forca" e la campagna
finita. Stesse regole di collaudo.py (che la importa in SCENE); gli aiuti
sono quelli dell'atto II e dell'atto IV.
"""

from collaudo_atto2 import CALMA, INCARICO, PRIMA, RIMETTI, _parla
from collaudo_atto4 import CHIUDI_PROVA, IN_PIU, STRADA, VICINO

ATTO_V = 4              # ATTI in campagna.js: l'indice di 'ritorno'

# Valdarno nell'atto V: la forca, i committenti, la veste del ladro
CAMBIATA = r"""() => { const w = __game.world, P = w.pianta, c = n => n * TILE + TILE / 2;
  const f = w.props.find(q => q.name === 'forca');
  return { forca: f ? +Math.hypot(f.x - c(P.PLAZA.x), f.z - c(P.PLAZA.y)).toFixed(1) : null,
           committenti: w.spawns.givers.map(q => q.name), sprite: __game.player.sprite }; }"""

# le guardie di ronda (14/10: 10 dentro le mura nell'atto V, campagna.js `ronde`)
RONDE = """() => ({ volute: Storia.ronde(), stelle: __game.player.stars,
  in_giro: __game.guards.filter(g => !g.dead && g.residente === undefined).length })"""

# committente, e per passo il tipo e cosa misurare; il passo da fotografare
# (mai una consegna: portato alla meta, il ladro la chiuderebbe da solo)
ATTESI = [
    ("nocchiero", [("consegna", "piazza"), ("fuga", None), ("consegna", "nocchiero")], 1),
    ("mercante", [("furto", None), ("consegna", None), ("caccia", None)], 2),
    ("briganti", [("scorta", "bosco"), ("furto_mezzo", None), ("colpo", None)], 0),
    ("fabbro", [("consegna", None), ("caccia", "guardia"), ("consegna", "nocchiero")], 1),
    ("briganti", [("consegna", None), ("cattura", None)], 1),
]
ZONA_BOSCO = 0          # world.js, D.BOSCO

# il Ciambellano della cattura: la vita, la resa, chi segue, dove sta
PRESO = r"""() => { const m = __game.campagna.attiva, n = m && m.preso;
  if (!n) return null;
  const P = __game.world.pianta, c = q => q * TILE + TILE / 2;
  const C = P.CORTE, nella_corte = n.x > C.x0 * TILE && n.x < C.x1 * TILE &&
    n.z > C.y0 * TILE && n.z < C.y1 * TILE;
  return { sprite: n.sprite, hp: Math.round(n.hp), arreso: m.arreso, bersaglio: !!n.bersaglio,
           segue: n.segue === __game.player, morto: n.dead, nella_corte,
           sgherri: __game.nemici.filter(e => e.missione && !e.dead).length,
           dalla_piazza: +Math.hypot(n.x - c(P.PLAZA.x), n.z - c(P.PLAZA.y)).toFixed(1) }; }"""


def _a_valdarno_v(c, cap=0, miss=0):
    """La storia all'atto V e il mondo rifatto: la forca e i committenti si
    decidono quando il mondo nasce."""
    c.js(PRIMA)
    c.js(CHIUDI_PROVA)
    c.js(f"""() => {{ const s = Storia.stato;
      Object.assign(s, {{ atto: {ATTO_V}, cap: {cap}, miss: {miss}, finita: false, attiva: null }});
      s.segni = ['taglia del Ciambellano']; __game.player.money = 0; }}""")
    c.js("() => __game.debug.citta('valdarno')")
    c.page.wait_for_timeout(3500)
    c.js("() => { Meteo.fissa(true); Meteo.imposta('sereno'); __game.debug.setDay(0.4); }")


def _rimetti(c, esito, guasti):
    c.js(CHIUDI_PROVA)
    c.js(RIMETTI)
    c.js("() => __game.debug.citta('valdarno')")
    c.page.wait_for_timeout(3000)
    esito["firma"] = c.js("() => __collaudo.firma()")["hash"]
    esito["forca_dopo"] = c.js(CAMBIATA)["forca"]
    c.tp(c.js("() => __collaudo.piazza()"), 1.0)
    if esito["firma"] != c.firma0 or esito["forca_dopo"] is not None:
        guasti.append(f"Valdarno di nuovo all'atto I: firma {esito['firma']}, "
                      f"forca {esito['forca_dopo']}")


def _guasti_passo(k, n, atteso, misura):
    tipo, cosa = atteso
    dove = f"cap {k + 1} passo {n + 1}"
    if misura["tipo"] != tipo:
        return [f"{dove}: tipo {misura['tipo']} invece di {tipo} ({misura.get('msg')!r})"]
    g = []
    if misura["goal_bloccato"] and tipo not in ("furto",):
        g.append(f"{dove}: la meta sta dentro un ostacolo")
    if tipo == "consegna" and cosa and (misura["dal_luogo"] is None or misura["dal_luogo"] > 6):
        g.append(f"{dove}: la consegna non e' a {cosa} ({misura['dal_luogo']})")
    if tipo == "scorta" and (misura["ostaggi"], misura["meta_zona"]) != (2, ZONA_BOSCO):
        g.append(f"{dove}: scorta di {misura['ostaggi']} verso la zona {misura['meta_zona']}")
    return g


def scena_atto5(c):
    """L'atto V capitolo per capitolo, a Valdarno cambiata: la forca nuova in
    piazza, il Ciambellano non sta piu' fra i committenti, il ladro e' beige;
    per ogni passo si va dal committente (il Nocchiero al porto, Aldo in
    piazza, il Capo dei fuorilegge al campo, Ferrante nella fucina) e si
    preme E; l'incarico ha il tipo e il luogo della bozza (la scorta dei due
    fuorilegge verso il bosco coi soldati attorno, il capitano della guardia,
    il Ciambellano nella corte coi suoi sgherri); si chiude col gancio. A fine
    capitolo il premio, spada e scudo dopo il capitolo 3. Foto della piazza e
    una per capitolo. Poi Valdarno torna com'era (atto I: niente forca)."""
    _a_valdarno_v(c)
    esito = {"cambiata": c.js(CAMBIATA), "capitoli": [], "foto": []}
    guasti = []
    v = esito["cambiata"]
    if v["forca"] is None or v["forca"] > 30:
        guasti.append(f"la forca in piazza: {v['forca']}")
    if "il Ciambellano" in v["committenti"]:
        guasti.append("il Ciambellano e' ancora fra i committenti")
    if not v["sprite"].endswith("@beige"):
        guasti.append(f"il ladro nell'atto V non e' beige: {v['sprite']}")
    c.tp(c.js("() => { const P = __game.world.pianta; "
              "return { x: P.PLAZA.x * TILE + TILE / 2, z: P.PLAZA.y * TILE + TILE / 2 + 6 }; }"), 2.0)
    esito["foto"].append(c.foto("atto5_piazza"))
    esito["ronde"] = c.js(RONDE)
    if esito["ronde"]["volute"] != 10 or esito["ronde"]["in_giro"] < 10:
        guasti.append(f"le ronde dell'atto V: {esito['ronde']}")
    for k, (chiave, passi, da_foto) in enumerate(ATTESI):
        cap = {"committente": chiave, "passi": []}
        soldi0 = c.js("() => __game.player.money")
        cap["obiettivo"] = c.js("() => document.getElementById('objective').textContent")
        for n, atteso in enumerate(passi):
            subito = c.js(f"() => !!Storia.campagna().capitoli[{k}].missioni[{n}].subito")
            parla = {"subito": True, "trovato": True} if subito else _parla(c, chiave)
            c.page.wait_for_timeout(300)
            misura = {**c.js(INCARICO), **c.js(IN_PIU), "parla": parla}
            if atteso[0] == "cattura":
                misura["preso"] = c.js(PRESO)
            cap["passi"].append(misura)
            guasti += _guasti_passo(k, n, atteso, misura)
            if not parla.get("trovato"):
                guasti.append(f"cap {k + 1}: il committente {chiave} non c'e'")
            if n == da_foto and misura["tipo"]:
                if c.js(VICINO):
                    c.page.wait_for_timeout(2500)
                esito["foto"].append(c.foto(f"atto5_cap{k + 1}_{misura['tipo']}"))
            # la cattura no: la prova la scena del finale
            if misura["tipo"] and (k, n) != (4, 1):
                c.tp(c.js("() => __collaudo.piazza()"), 0.5)
                # prima si chiude l'incarico, poi si azzera la taglia: senza
                # stelle una fuga si chiude da sola, e il gancio chiuderebbe
                # anche il passo dopo (collaudo 44)
                c.js("() => __game.debug.avanza()")
                c.js(CALMA)
                c.page.wait_for_timeout(400)
        cap["soldi"] = c.js("() => __game.player.money") - soldi0
        cap["premio"] = c.js(f"() => Storia.campagna().capitoli[{k}].premio") if k < 4 else None
        esito["capitoli"].append(cap)
        if k and c.js("(k) => Storia.committente(k)", chiave) not in cap["obiettivo"]:
            guasti.append(f"cap {k + 1}: l'obiettivo non dice il committente: {cap['obiettivo']!r}")
        # la riscossione paga anche 12 per ogni debitore passato accanto al
        # ladro (game.js): nel conto ci stanno (collaudo 44)
        dovuti = 40 * (len(passi) - 1) + (cap["premio"] or 0)
        riscossi = cap["soldi"] - dovuti
        if k < 4 and not (riscossi == 0 or ("riscossione", None) in passi
                          and riscossi % 12 == 0 and 0 < riscossi <= 36):
            guasti.append(f"cap {k + 1}: pagati {cap['soldi']} invece di {dovuti}")
        if k == 2 and "scudo" not in c.js("() => __game.player.arsenale"):
            guasti.append("dopo il capitolo 3 niente spada e scudo")
    p = esito["capitoli"][4]["passi"][1].get("preso") or {}
    if p.get("sprite") != "MiniNobleMan" or not p.get("bersaglio") or p.get("sgherri", 0) < 4:
        guasti.append(f"il Ciambellano della cattura: {p}")
    esito["fps"] = c.fps()
    _rimetti(c, esito, guasti)
    if c.js("() => Storia.ronde()") != 7:
        guasti.append(f"tornati all'atto I, le ronde: {c.js('() => Storia.ronde()')}")
    if esito["fps"] < 30:
        guasti.append(f"fps {esito['fps']}")
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


def scena_atto5_finale(c):
    """La fine della campagna: al capitolo 5 dal Capo dei fuorilegge parte la
    cattura; il Ciambellano colpito fin sotto un terzo si arrende (non e' piu'
    bersaglio, ti segue, un altro colpo non lo uccide); il ladro va in piazza
    per la strada di nav.js e lui gli viene dietro; arrivati, la scena "La
    forca" (cinque righe, coi due complici), poi l'ultimo passo: la campagna e'
    finita, 40 + 500 denari, l'obiettivo dei contratti liberi, il Ciambellano
    non c'e' piu'. Poi tutto com'era."""
    _a_valdarno_v(c, cap=4, miss=1)
    esito = {"parla": _parla(c, "briganti")}
    esito["prima"] = c.js(PRESO)
    guasti = []
    if not esito["prima"]:
        esito["errore"] = f"la cattura non parte: {c.js(INCARICO)}"
        _rimetti(c, esito, guasti)
        return esito
    # gli sgherri a terra (quel che portano addosso resta al ladro: i soldi si
    # contano dopo), il Ciambellano colpito due volte: sotto la resa
    c.js("() => { const g = __game; for (const e of g.nemici) "
         "if (e.missione) g.debug.colpisci(e, { danno: [999, 999] }); }")
    esito["soldi_prima"] = c.js("() => __game.player.money")
    esito["dopo_sgherri"] = {**c.js(INCARICO), "preso": c.js(PRESO)}
    if not esito["dopo_sgherri"]["tipo"]:
        esito["errore"] = f"caduti gli sgherri la cattura si chiude: {esito['dopo_sgherri']}"
        _rimetti(c, esito, guasti)
        return esito
    c.js("""() => { const g = __game, n = g.campagna.attiva.preso, p = g.player;
      p.x = n.x + 1.2; p.z = n.z + 0.6; p.hp = 1e6; p.wanted = 0;
      g.debug.colpisci(n, { danno: [70, 70] }); g.debug.colpisci(n, { danno: [70, 70] }); }""")
    c.page.wait_for_timeout(500)
    esito["arreso"] = c.js(PRESO)
    c.js("() => __game.debug.colpisci(__game.campagna.attiva.preso, { danno: [90, 90] })")
    c.page.wait_for_timeout(300)
    esito["dopo_un_altro_colpo"] = c.js(PRESO)
    c.js("""() => { const m = __game.campagna.attiva, p = __game.player;
      m.partenza = { x: p.x, z: p.z }; }""")
    strada = c.js(STRADA)
    for i in range(1, len(strada)):
        a, b = strada[i - 1], strada[i]
        lungo = ((b["x"] - a["x"]) ** 2 + (b["z"] - a["z"]) ** 2) ** 0.5
        for s in range(1, max(1, int(lungo / 1.25)) + 1):
            t = s / max(1, int(lungo / 1.25))
            c.js("([x, z]) => { const p = __game.player; p.x = x; p.z = z; p.vx = p.vz = 0; "
                 "p.hp = 1e6; p.wanted = 0; }",
                 [a["x"] + (b["x"] - a["x"]) * t, a["z"] + (b["z"] - a["z"]) * t])
            c.page.wait_for_timeout(250)
    try:
        c.page.wait_for_function("() => Passaggi.attiva", timeout=15000)
    except Exception:  # noqa: BLE001 — il guasto lo dice la misura sotto
        esito["errore"] = f"in piazza non parte la scena: {c.js(PRESO)}"
        _rimetti(c, esito, guasti)
        return esito
    c.page.wait_for_timeout(800)
    scena = c.js("() => ({ titolo: document.getElementById('scenaTitolo').textContent, "
                 "righe: SCENE_PASSAGGIO.forca.righe.length })")
    for _ in range(scena["righe"] - 1):
        c.page.keyboard.press("KeyE")
        c.page.wait_for_timeout(350)
    esito["foto"] = [c.foto("atto5_forca")]
    c.page.keyboard.press("KeyE")
    c.page.wait_for_function("() => !Passaggi.attiva", timeout=20000)
    c.page.wait_for_timeout(600)
    goal = c.js("() => { const m = __game.campagna.attiva; return m && m.goal; }")
    if goal:
        c.js("([x, z]) => { const p = __game.player; p.x = x; p.z = z + 1; p.vx = p.vz = 0; }",
             [goal["x"], goal["z"]])
    c.page.wait_for_timeout(1500)
    esito["scena"] = scena
    esito["dopo"] = c.js("""() => { const g = __game;
      return { finita: g.campagna.finita, attiva: !!g.campagna.attiva,
               soldi: g.player.money, obiettivo: document.getElementById('objective').textContent,
               msg: document.getElementById('msg').textContent,
               ciambellano: g.npcs.some(n => n.sprite === 'MiniNobleMan' && n.nome === 'il Ciambellano') }; }""")
    esito["foto"].append(c.foto("atto5_fine"))
    a, b, d = esito["arreso"], esito["dopo_un_altro_colpo"], esito["dopo"]
    if not a["arreso"] or a["bersaglio"] or not a["segue"] or a["morto"]:
        guasti.append(f"la resa: {a}")
    if b["morto"] or not b["arreso"]:
        guasti.append(f"dopo la resa un colpo lo uccide: {b}")
    if scena["titolo"] != "La forca" or scena["righe"] != 5:
        guasti.append(f"la scena: {scena}")
    if not d["finita"] or d["attiva"] or "libera" not in d["obiettivo"] or d["ciambellano"]:
        guasti.append(f"la fine della campagna: {d}")
    if d["soldi"] != esito["soldi_prima"] + 40 + 500:
        guasti.append(f"pagati {d['soldi'] - esito['soldi_prima']} invece di 540")
    _rimetti(c, esito, guasti)
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


def _salpa(c):
    """Salpa dal largo (il gancio di collaudo: salpa() di game.js) e passa la
    scena del viaggio; torna il titolo della scena e la citta' d'arrivo."""
    c.js("() => { __game.debug.salpa(); return true; }")      # la promessa no
    c.page.wait_for_function("() => Passaggi.attiva", timeout=8000)
    c.page.wait_for_timeout(600)
    titolo = c.js("() => document.getElementById('scenaTitolo').textContent")
    for _ in range(c.js("() => SCENE_PASSAGGIO.viaggio.righe.length")):
        c.page.keyboard.press("KeyE")
        c.page.wait_for_timeout(350)
    c.page.wait_for_function("() => !Passaggi.attiva", timeout=20000)
    c.page.wait_for_timeout(2500)
    return {"titolo": titolo, "chiave": c.js("() => __game.world.pianta.chiave"),
            "nome": c.js("() => __game.world.pianta.nome"),
            "in_barca": c.js("() => !!__game.player.vehicle")}


def scena_citta_libere(c):
    """Dopo il finale (tua risposta del 26/09: citta' libere, il mare escluso):
    a campagna finita, dal largo si salpa verso la citta' dopo nel giro, col
    suo nome nella scena del viaggio: da Valdarno al Fiordo, alla Costa, di
    nuovo a Valdarno; si arriva sulla barca al molo. Poi tutto com'era."""
    _a_valdarno_v(c, cap=5)
    c.js("() => { __game.campagna.finita = true; }")
    esito = {"viaggi": [_salpa(c) for _ in range(3)], "ronde": c.js("() => Storia.ronde()")}
    guasti = [] if esito["ronde"] == 7 else [f"a citta' libere le ronde: {esito['ronde']}"]
    attese = ["fiordo-3", "costa-5", "valdarno"]
    for v, k in zip(esito["viaggi"], attese, strict=True):
        if v["chiave"] != k or v["nome"] not in v["titolo"] or not v["in_barca"]:
            guasti.append(f"verso {k}: {v}")
    c.js("() => { __game.campagna.finita = false; }")
    _rimetti(c, esito, guasti)
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


def _pronta(pagina):
    pagina.wait_for_function("() => document.getElementById('loading').textContent === 'pronto'",
                             timeout=60000)
    pagina.wait_for_timeout(800)


# la Valdarno dell'atto V e il ladro, dopo un caricamento
DOVE = r"""() => { const g = __game;
  return { chiave: g.world.pianta.chiave, atto: Storia.stato.atto, libere: Storia.libere,
           forca: g.world.props.some(q => q.name === 'forca'),
           ciambellano: g.world.spawns.givers.some(q => q.name === 'il Ciambellano'),
           sprite: g.player.sprite,
           titolo: getComputedStyle(document.getElementById('title')).display !== 'none' }; }"""


def scena_viaggi(c):
    """Il menu delle citta' dopo il finale (viaggi.js, 13/10) e il caricamento
    di una partita dell'atto V, in una pagina a parte: si salva a campagna
    finita e si ricarica la pagina; "Continua" ridà Valdarno com'e' nell'atto V
    (la forca, niente Ciambellano fra i committenti, il ladro in beige: prima
    il mondo nasceva con l'atto I e l'atto si rimetteva dopo); dalla plancia
    (Tab) la riga "Viaggia" porta alla Costa; ricaricata la pagina, nel titolo
    i bottoni delle citta' libere portano al Fiordo."""
    contesto = c.page.context.browser.new_context(viewport={"width": 1280, "height": 720})
    pagina = contesto.new_page()
    errori = []
    pagina.on("pageerror", lambda e: errori.append(str(e)))
    url = c.page.url.split("?")[0]
    esito, guasti = {}, []
    try:
        pagina.goto(url, wait_until="load")
        _pronta(pagina)
        pagina.evaluate("""() => { const s = Storia.stato;
          Object.assign(s, { atto: 4, cap: 5, miss: 0, finita: true, attiva: null });
          Salvataggio.salva(); }""")
        pagina.reload(wait_until="load")
        _pronta(pagina)
        esito["prima"] = pagina.evaluate(DOVE)
        pagina.locator("#continuaBtn").click()
        pagina.wait_for_timeout(4000)
        esito["continua"] = pagina.evaluate(DOVE)
        pagina.keyboard.press("Tab")
        pagina.wait_for_timeout(600)
        esito["plancia"] = pagina.evaluate("""() => [...document.querySelectorAll(
          '#planciaCitta button')].map(b => b.textContent + (b.disabled ? ' (qui)' : ''))""")
        esito["nome_valdarno"] = pagina.evaluate("() => TX('nomi.valdarno')")   # i nomi in it.js
        pagina.screenshot(path=str(c.cartella / "viaggi_plancia.png"))
        pagina.locator("#planciaCitta button[data-citta='costa-5']").click()
        pagina.wait_for_timeout(4000)
        esito["dalla_plancia"] = pagina.evaluate(DOVE)
        pagina.reload(wait_until="load")
        _pronta(pagina)
        esito["titolo"] = pagina.evaluate("""() => [...document.querySelectorAll(
          '#viaggiTitolo button')].map(b => b.textContent)""")
        pagina.screenshot(path=str(c.cartella / "viaggi_titolo.png"))
        pagina.locator("#viaggiTitolo button[data-citta='fiordo-3']").click()
        pagina.wait_for_timeout(5000)
        esito["dal_titolo"] = pagina.evaluate(DOVE)
        esito["foto"] = ["out/collaudo/viaggi_plancia.png", "out/collaudo/viaggi_titolo.png"]
    finally:
        contesto.close()
    k = esito["continua"]
    if (k["chiave"], k["atto"], k["forca"], k["ciambellano"], k["titolo"]) !=             ("valdarno", 4, True, False, False) or not k["sprite"].endswith("@beige"):
        guasti.append(f"Continua non ridà la Valdarno dell'atto V: {k}")
    if len(esito["plancia"]) != 3 or f"{esito['nome_valdarno']} (qui)" not in esito["plancia"]:
        guasti.append(f"la riga Viaggia della plancia: {esito['plancia']}")
    if esito["dalla_plancia"]["chiave"] != "costa-5" or not esito["dalla_plancia"]["libere"]:
        guasti.append(f"dalla plancia alla Costa: {esito['dalla_plancia']}")
    d = esito["dal_titolo"]
    if len(esito["titolo"]) != 3 or d["chiave"] != "fiordo-3" or d["titolo"]:
        guasti.append(f"dal titolo al Fiordo: {esito['titolo']}, {d}")
    if errori:
        guasti.append(f"errori nella pagina: {errori[:3]}")
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


# le consegne e i colpi (missioni_base.js, 15/10): l'incarico in corso, misurato
BASE = r"""() => { const g = __game, m = g.campagna.attiva;
  const msg = document.getElementById('msg').textContent;
  if (!m) return { attiva: false, cap: g.campagna.cap, miss: g.campagna.miss, msg };
  const d = (a, b) => a && b ? +Math.hypot(a.x - b.x, a.z - b.z).toFixed(1) : null;
  return { attiva: true, tipo: m.tipo, cap: g.campagna.cap, miss: g.campagna.miss,
           chi: m.chi_ ? { sprite: m.chi_.sprite, dalla_meta: d(m.chi_, m.goal), fermo: !!m.chi_.fisso } : null,
           timer: m.timer ?? null, prog: m.prog ?? null, durata: m.durata ?? null,
           ondata: m.ondata ? g.nemici.filter(e => e.missione && !e.dead).length : null,
           ricevente: m.ricevente ? { dal_carico: d(m.ricevente, m.goal), visto: !!m.visto } : null, msg }; }"""

# sul punto dell'incarico, senza debug.tp (svuoterebbe chi aspetta)
SULLA = """(lontano) => { const m = __game.campagna.attiva, p = __game.player;
  p.x = m.goal.x; p.z = m.goal.z + (lontano || 1); p.vx = p.vz = 0;
  __game.cam.x = p.x; __game.cam.z = p.z; }"""


def _consegne_atto1(c, esito, guasti):
    """Il plico col destinatario, la chiatta col tempo, l'imboscata con l'ondata."""
    c.js("() => __game.debug.missione(0, 0)")
    c.page.wait_for_timeout(500)
    a = esito["plico"] = c.js(BASE)
    if not a.get("chi") or a["chi"]["dalla_meta"] > 4 or not a["chi"]["fermo"]:
        guasti.append(f"il plico: nessuno ad aspettarlo alla meta: {a}")
    c.js(SULLA, 9)
    c.page.wait_for_timeout(1200)
    esito["foto"].append(c.foto("consegna_destinatario"))
    c.js(SULLA, 1)
    c.page.wait_for_timeout(700)
    detto = esito["plico_detto"] = c.js(BASE)
    c.page.wait_for_timeout(4500)
    fatto = esito["plico_fatto"] = c.js(BASE)
    if "Ferrante sceglie bene" not in detto["msg"] or fatto["attiva"]:
        guasti.append(f"il plico: la riga o la chiusura del passo: {detto['msg']!r}, {fatto}")
    c.js(CHIUDI_PROVA)
    c.js("() => __game.debug.missione(2, 0)")
    c.page.wait_for_timeout(500)
    t = esito["chiatta"] = c.js(BASE)
    c.js("() => { __game.campagna.attiva.timer = 0.3; }")
    c.page.wait_for_timeout(900)
    s = esito["chiatta_scaduta"] = c.js(BASE)
    if not t.get("timer") or t["timer"] < 15 or s["attiva"] or "troppo tardi" not in s["msg"]:
        guasti.append(f"la chiatta: il tempo non torna: {t}, {s}")
    c.js(CHIUDI_PROVA)
    c.js(CALMA)
    c.js("() => __game.debug.missione(3, 2)")
    c.page.wait_for_timeout(500)
    c.js(SULLA, 1)
    c.page.wait_for_timeout(6500)
    o = esito["imboscata"] = c.js(BASE)
    esito["foto"].append(c.foto("colpo_ondata"))
    if not o.get("ondata") or o["ondata"] < 3:
        guasti.append(f"l'imboscata: nessuna ondata a un terzo del colpo: {o}")
    c.js(CHIUDI_PROVA)
    c.js(CALMA)


def _ricevente_costa(c, esito, guasti):
    """Atto IV, capitolo 4, passo 1: l'uomo dei pirati viene al carico."""
    c.js("() => { const s = Storia.stato; Object.assign(s, { atto: 3, cap: 3, miss: 0, "
         "finita: false, attiva: null }); }")
    c.js("() => __game.debug.citta('costa-5')")
    c.page.wait_for_timeout(3500)
    c.js("() => __game.debug.missione(3, 0)")
    c.page.wait_for_timeout(500)
    c.js(SULLA, 1)
    visto = None
    for _ in range(22):          # oltre i 12 s del ripiego
        c.page.wait_for_timeout(700)
        visto = c.js(BASE)
        if visto.get("ricevente") and visto["ricevente"]["visto"]:
            break
    esito["ricevente"] = visto
    esito["foto"].append(c.foto("colpo_ricevente"))
    r = visto.get("ricevente") if visto else None
    if not r or not r["visto"] or "orecchio mozzo" not in visto["msg"]:
        guasti.append(f"il carico al molo: nessuno viene a riceverlo: {visto}")


def scena_consegne(c):
    """Le consegne e i colpi (missioni_base.js; 15/10, tua segnalazione: "dice
    prendi il carro ma non c'e' niente", e le altre "raggiungi la stella").
    Atto I: il plico ha chi lo aspetta alla meta, fermo e col segno; arrivati,
    la sua riga resta a schermo e poi il passo si chiude. La chiatta ha il suo
    tempo (almeno 15 s), finito il tempo l'incarico fallisce ("troppo
    tardi"). L'imboscata: a un terzo del colpo arriva un'ondata (almeno 3).
    Atto IV, alla Costa: mentre sei sul molo l'uomo dei pirati viene al carico
    e si dice cosa fa. Foto. Poi tutto com'era."""
    c.js(PRIMA)
    c.js(CHIUDI_PROVA)
    c.js("() => { __game.player.hp = 1e6; }")
    esito, guasti = {"foto": []}, []
    _consegne_atto1(c, esito, guasti)
    _ricevente_costa(c, esito, guasti)
    _rimetti(c, esito, guasti)
    c.js(CALMA)
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


SCENE_ATTO5 = {"atto5": scena_atto5, "atto5_finale": scena_atto5_finale,
               "citta_libere": scena_citta_libere, "viaggi": scena_viaggi,
               "consegne": scena_consegne}
