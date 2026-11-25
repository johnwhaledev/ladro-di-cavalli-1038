"""collaudo_missioni.py — i tipi di missione nuovi, provati (27/09).

Le scene delle missioni di prova (campagna.js, CAMPAGNE.prova): scorta,
duello, bestia, gara, difesa, furto. Stesse regole di collaudo.py; le
raccoglie collaudo_campagna.py in SCENE_CAMPAGNA.
"""


# ------------------------------------------------ i tipi di missione nuovi
#
# Ognuno provato in una missione di prova (campagna.js, CAMPAGNE.prova),
# fuori dalla storia: si fa riuscire e, dove conta, fallire. Dopo l'avvio mai
# __game.debug.tp (posiziona svuota la gente, ostaggi compresi): il ladro si
# sposta a mano (_salta) o scivolando (_scivola).

ESITO = """() => ({ attiva: !!__game.campagna.attiva, esito: Storia.ultimaProva,
  prova: Storia.inProva(), cap: __game.campagna.cap, miss: __game.campagna.miss })"""


def _prova(c, n):
    """La missione di prova n: niente assalti, niente taglia, salute piena."""
    c.js("""() => { const g = __game; g.assalto.attivo = false; g.assalto.prossimo = 999;
      g.player.wanted = 0; g.player.hp = g.player.maxHp; g.player.dead = false; }""")
    return c.js(f"() => __game.debug.prova({n})")


def _salta(c, x, z, attesa=0.4):
    c.js("([x, z]) => { const p = __game.player; p.x = x; p.z = z; p.vx = p.vz = 0; }", [x, z])
    c.page.wait_for_timeout(int(attesa * 1000))


def _scivola(c, x, z, velocita=5.0):
    """Il ladro verso (x, z) a passo d'uomo, senza collisioni (per chi segue)."""
    c.js("""([x, z, v]) => new Promise(ok => { const p = __game.player;
      const t = setInterval(() => { const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
        const passo = v * 0.05;
        if (d <= passo) { p.x = x; p.z = z; clearInterval(t); ok(); return; }
        p.x += dx / d * passo; p.z += dz / d * passo; }, 50); })""", [x, z, velocita])


def _abbatti(c, chi, arma="alabarda", colpi=60):
    """Colpisce `chi` (espressione JS) col colpo vero finche' e' a terra."""
    return c.js(f"""async () => {{ const g = __game; let n = 0;
      for (; n < {colpi}; n++) {{ const e = {chi}; if (!e || e.dead) break;
        g.player.hp = g.player.maxHp; g.debug.colpisci(e, ARMI.{arma});
        await new Promise(r => setTimeout(r, 60)); }}
      return n; }}""")


def _aspetta_esito(c, secondi):
    c.page.wait_for_function("() => !Storia.inProva()", timeout=int(secondi * 1000))
    return c.js(ESITO)


def scena_prova_scorta(c):
    """Scorta: due prigionieri legati nel bosco coi carcerieri. I carcerieri
    non li toccano; tolti di mezzo i carcerieri, accanto ai prigionieri li si
    libera e ti seguono per la strada fino alla meta (qui a ~22 unita', una
    via libera): prova riuscita. Poi di nuovo, e un ostaggio ucciso: fallita."""
    c.tp(c.js("() => __collaudo.piazza()"), 1.0)
    _prova(c, 0)
    m = c.js("""() => { const m = __game.campagna.attiva;
      return { prigione: m.prigione, ostaggi: m.ostaggi.length,
               carcerieri: m.gente.filter(e => e instanceof Nemico).length,
               sprite: m.ostaggi.map(n => n.sprite) }; }""")
    esito = {"avvio": m}
    P = m["prigione"]
    _salta(c, P["x"], P["z"] + 16, 3.0)
    esito["dopo_3s"] = c.js("""() => __game.campagna.attiva.ostaggi.map(n =>
      ({ hp: n.hp, fisso: n.fisso, prigioniero: n.prigioniero }))""")
    esito["foto"] = [c.foto("prova_scorta_prigione")]
    esito["colpi"] = _abbatti(c, "__game.campagna.attiva.gente.find(e => e instanceof Nemico && !e.dead)",
                              colpi=90)
    o = c.js("() => { const [a, b] = __game.campagna.attiva.ostaggi; "
             "return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }; }")
    _salta(c, o["x"], o["z"], 0.6)
    esito["liberati"] = c.js("() => __game.campagna.attiva.liberi")
    # la meta: un punto a una ventina di unita', in vista dalla prigione (il
    # ladro ci scivola dritto, gli ostaggi ci vanno per la strada di nav.js)
    meta = c.js("""() => { const g = __game, w = g.world, m = g.campagna.attiva, P = m.prigione;
      for (let r = 22; r < 40; r += 2) for (let k = 0; k < 24; k++) {
        const a = k / 24 * Math.PI * 2, x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
        if (!w.blocked(x, z) && Nav.sgombro(w, P.x, P.z, x, z, 0.45))
          { m.meta = { x, z }; return m.meta; } }
      return null; }""")
    esito["meta"] = meta
    if meta:
        _scivola(c, (o["x"] + meta["x"]) / 2, (o["z"] + meta["z"]) / 2, 4.0)
        esito["foto"].append(c.foto("prova_scorta_seguono"))
        _scivola(c, meta["x"], meta["z"], 4.0)
        esito["riuscita"] = _aspetta_esito(c, 15)
    # di nuovo: un ostaggio muore
    c.js("() => __game.debug.tp(__collaudo.piazza().x, __collaudo.piazza().z)")
    c.page.wait_for_timeout(800)
    _prova(c, 0)
    esito["uccisi"] = _abbatti(c, "(__game.campagna.attiva || {ostaggi: []}).ostaggi[0]", "alabarda", 10)
    c.page.wait_for_timeout(400)
    esito["fallita"] = c.js(ESITO)
    c.tp(c.js("() => __collaudo.piazza()"), 1.0)

    guasti = []
    if m["ostaggi"] != 2 or m["carcerieri"] != 3:
        guasti.append(f"avvio: {m}")
    if any(o["hp"] < 40 or not o["prigioniero"] for o in esito["dopo_3s"]):
        guasti.append(f"i carcerieri toccano i prigionieri: {esito['dopo_3s']}")
    if esito["liberati"] != 2:
        guasti.append(f"liberati {esito['liberati']} su 2")
    if not meta or (esito.get("riuscita") or {}).get("esito") != "riuscita":
        guasti.append(f"la scorta non arriva: {esito.get('riuscita')}")
    if "ostaggi" not in str(esito["fallita"]["esito"]) or esito["fallita"]["prova"]:
        guasti.append(f"un ostaggio morto non fa fallire: {esito['fallita']}")
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


def scena_prova_duello(c):
    """Duello nel cerchio: il cerchio di pietre in una zona sgombra, lo
    sfidante al centro, la gente attorno. Entrando comincia; con la spada lo si
    batte (si arrende o cade) e la taglia non sale. Uscire dal cerchio per piu'
    di tre secondi, o tirare con l'arco dentro, fa perdere."""
    c.tp(c.js("() => __collaudo.quartieri().mercato"), 1.0)
    c.js("() => { const p = __game.player; if (!p.arsenale.includes('arco')) p.arsenale.push('arco'); p.equipaggia('spada'); }")
    _prova(c, 1)
    m = c.js("""() => { const m = __game.campagna.attiva;
      return { centro: m.centro, R: m.R, celle_piene: m.pieni, sfidante: m.sfidante.sprite,
               pubblico: m.gente.filter(n => n.spettatore).length }; }""")
    esito = {"avvio": m}
    C, R = m["centro"], m["R"]
    _salta(c, C["x"], C["z"] + R + 4, 2.0)
    # dopo due secondi il pubblico c'e' ancora tutto (la gente di troppo se ne va)
    esito["pubblico_resta"] = c.js("""() => __game.campagna.attiva.gente.filter(n =>
      n.spettatore && __game.npcs.includes(n)).length""")
    esito["foto"] = [c.foto("prova_duello_cerchio")]
    _salta(c, C["x"], C["z"] + R - 2.5, 0.8)
    esito["iniziato"] = c.js("() => __game.campagna.attiva.iniziato")
    taglia0 = c.js("() => __game.player.wanted")
    c.page.wait_for_timeout(1500)
    esito["foto"].append(c.foto("prova_duello_in_corso"))
    esito["colpi"] = _abbatti(c, "(__game.campagna.attiva || {}).sfidante", "spada", 40)
    esito["riuscita"] = _aspetta_esito(c, 5)
    esito["taglia"] = [taglia0, c.js("() => __game.player.wanted")]
    # fuori dal cerchio
    _prova(c, 1)
    m2 = c.js("() => { const m = __game.campagna.attiva; return { centro: m.centro, R: m.R }; }")
    _salta(c, m2["centro"]["x"], m2["centro"]["z"] + m2["R"] - 2.5, 0.5)
    _salta(c, m2["centro"]["x"], m2["centro"]["z"] + m2["R"] + 6, 0.2)
    esito["uscito"] = _aspetta_esito(c, 6)
    # l'arco nel cerchio
    _prova(c, 1)
    m3 = c.js("() => { const m = __game.campagna.attiva; return { centro: m.centro, R: m.R }; }")
    c.js("() => __game.player.equipaggia('arco')")
    _salta(c, m3["centro"]["x"], m3["centro"]["z"] + m3["R"] - 2.5, 0.6)
    c.page.keyboard.press("Space")
    c.page.wait_for_timeout(300)
    esito["arco"] = _aspetta_esito(c, 3)
    c.js("() => __game.player.equipaggia('spada')")
    c.tp(c.js("() => __collaudo.piazza()"), 1.0)

    guasti = []
    if m["pubblico"] != 6 or m["celle_piene"] > 3 or esito["pubblico_resta"] != 6:
        guasti.append(f"avvio: {m}, pubblico rimasto {esito['pubblico_resta']}")
    if m["sfidante"] in ("MiniArcher", "MiniCrossBowMan"):
        guasti.append(f"lo sfidante tira: {m['sfidante']}")
    if not esito["iniziato"] or esito["riuscita"]["esito"] != "riuscita":
        guasti.append(f"il duello non si vince: {esito['riuscita']}")
    if esito["taglia"][1] > esito["taglia"][0]:
        guasti.append(f"il duello alza la taglia: {esito['taglia']}")
    if "cerchio" not in str(esito["uscito"]["esito"]) or "uscito" not in str(esito["uscito"]["esito"]):
        guasti.append(f"uscire dal cerchio non fa perdere: {esito['uscito']}")
    if "tirato" not in str(esito["arco"]["esito"]):
        guasti.append(f"l'arco nel cerchio non fa perdere: {esito['arco']}")
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


def scena_prova_bestia(c):
    """La bestia: le orme dal primo segno alla tana, una alla volta; all'ultima
    esce la bestia (un orso, tre volte un lupo) e abbatterla chiude la prova."""
    c.tp(c.js("() => __collaudo.quartieri().bosco"), 1.0)
    _prova(c, 2)
    m = c.js("""() => { const m = __game.campagna.attiva, w = __game.world;
      return { tracce: m.tracce, tana: m.tana,
               libere: m.tracce.every(t => !w.blocked(t.x, t.z)),
               lunga: Math.round(Math.hypot(m.tana.x - m.tracce[0].x, m.tana.z - m.tracce[0].z)) }; }""")
    esito = {"orme": len(m["tracce"]), "lunga": m["lunga"], "libere": m["libere"], "foto": []}
    for i, t in enumerate(m["tracce"]):
        _salta(c, t["x"], t["z"], 0.35)
        if i == len(m["tracce"]) // 2:
            c.page.wait_for_timeout(600)
            esito["foto"].append(c.foto("prova_bestia_orme"))
    c.page.wait_for_timeout(600)
    b = c.js("""() => { const b = __game.campagna.attiva.bestia;
      return b && { sprite: b.sprite, hp: b.maxHp, forza: b.forza,
                    d: +Math.hypot(b.x - __game.player.x, b.z - __game.player.z).toFixed(1) }; }""")
    esito["bestia"] = b
    esito["foto"].append(c.foto("prova_bestia_tana"))
    esito["colpi"] = _abbatti(c, "(__game.campagna.attiva || {}).bestia", "alabarda", 40)
    esito["riuscita"] = _aspetta_esito(c, 5)
    c.tp(c.js("() => __collaudo.piazza()"), 1.0)
    guasti = []
    if esito["orme"] < 6 or not esito["libere"] or not 50 < esito["lunga"] < 160:
        guasti.append(f"orme: {esito['orme']}, libere {esito['libere']}, lunga {esito['lunga']}")
    if not b or b["hp"] < 200 or b["sprite"] != "MiniBear":
        guasti.append(f"la bestia: {b}")
    if esito["riuscita"]["esito"] != "riuscita":
        guasti.append(f"abbattere la bestia non chiude: {esito['riuscita']}")
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


def _gara(c, n, nome):
    """Una gara di prova: sul mezzo, alla partenza, il via; le tappe passate
    col mezzo portato a mano. Poi di nuovo, fermi, e vince il rivale."""
    _prova(c, n)
    m = c.js("""() => { const m = __game.campagna.attiva, w = __game.world, v = m.mezzoGara;
      const acqua = t => w.solid[Math.floor(t.z / w.solidS) * w.solidN + Math.floor(t.x / w.solidS)] === 2;
      const strada = t => !!w.road[w.idx(Math.floor(t.x / TILE), Math.floor(t.z / TILE))];
      return { mezzo: v.type, tappe: m.tappe_.length, lunga: Math.round(m.lunga),
               sulla_via: m.tappe_.every(t => v.type === 'barca' ? acqua(t) : strada(t)),
               rivale_v: +m.rivale.v.toFixed(1), partenza: m.partenza }; }""")
    esito = {"avvio": m}
    c.js("() => { const g = __game, v = g.campagna.attiva.mezzoGara; "
         "g.player.x = v.x; g.player.z = v.z; v.rider = g.player; g.player.sali(v); }")
    c.page.wait_for_timeout(600)
    esito["via"] = c.js("() => __game.campagna.attiva.stato")
    c.page.wait_for_timeout(3400)
    esito["foto"] = [c.foto(f"prova_gara_{nome}_via")]
    esito["corsa"] = c.js("() => __game.campagna.attiva.stato")
    for i in range(m["tappe"]):
        c.js(f"() => {{ const m = __game.campagna.attiva; if (!m) return; const t = m.tappe_[{i}], v = m.mezzoGara; "
             "v.x = t.x; v.z = t.z; }")
        c.page.wait_for_timeout(250)
        if i == m["tappe"] // 2:
            esito["foto"].append(c.foto(f"prova_gara_{nome}_tappa"))
    esito["riuscita"] = _aspetta_esito(c, 4)
    # fermi alla partenza: vince il rivale. Il mezzo torna alla partenza della
    # prima gara: il traguardo cade a caso e, se e' in campagna, nei ~20 s da
    # fermi un cinghiale abbatte il cavallo e la gara finisce per "mezzo
    # lasciato" (01/10: la scena cadeva a volte per questo)
    c.js("([x, z]) => { const p = __game.player, v = p.vehicle; if (v) { v.x = x; v.z = z; v.speed = 0; } "
         "p.x = x; p.z = z; }", [m["partenza"]["x"], m["partenza"]["z"]])
    _prova(c, n)
    c.js("() => { const g = __game, v = g.campagna.attiva.mezzoGara; "
         "g.player.x = v.x; g.player.z = v.z; v.rider = g.player; g.player.sali(v); }")
    attesa = m["lunga"] / max(1, m["rivale_v"]) + 6
    esito["persa"] = _aspetta_esito(c, attesa + 4)
    c.js("() => { const p = __game.player; if (p.vehicle) { p.vehicle.rider = null; p.scendi(); } }")
    guasti = []
    if m["tappe"] < 3 or not m["sulla_via"]:
        guasti.append(f"percorso: {m}")
    if esito["via"] != "via" or esito["corsa"] != "corsa":
        guasti.append(f"la partenza: {esito['via']} -> {esito['corsa']}")
    if esito["riuscita"]["esito"] != "riuscita":
        guasti.append(f"le tappe passate non vincono: {esito['riuscita']}")
    if "rivale" not in str(esito["persa"]["esito"]):
        guasti.append(f"fermi non vince il rivale: {esito['persa']}")
    return esito, guasti


def scena_prova_gara(c):
    """Gara a cavallo per le strade e in barca per il fiume: il percorso sta
    sulle vie (o sull'acqua), dopo il tre-due-uno si passano le tappe e si
    vince; restando fermi arriva prima il rivale."""
    c.tp(c.js("() => __collaudo.piazza()"), 1.0)
    esito = {}
    esito["cavallo"], g1 = _gara(c, 3, "cavallo")
    b = c.js("() => { const b = Viaggio.approdo(__game.vehicles); return { x: b.x, z: b.z }; }")
    c.tp({"x": b["x"] + 3, "z": b["z"]}, 1.5)
    esito["barca"], g2 = _gara(c, 4, "barca")
    esito["foto"] = esito["cavallo"]["foto"] + esito["barca"]["foto"]
    c.tp(c.js("() => __collaudo.piazza()"), 1.0)
    guasti = [f"cavallo: {x}" for x in g1] + [f"barca: {x}" for x in g2]
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


def scena_prova_difesa(c):
    """Difesa della porta: alla porta tre guardie al tuo fianco; arrivati suona
    il corno e vengono tre ondate da fuori; abbattute tutte la prova riesce e
    gli assalti di tutti i giorni restano zitti."""
    c.tp(c.js("() => __collaudo.piazza()"), 1.0)
    _prova(c, 5)
    m = c.js("""() => { const m = __game.campagna.attiva;
      return { porta: m.porta_, fuori: m.fuori,
               alleati: m.gente.filter(e => e instanceof Guard).length }; }""")
    esito = {"avvio": m, "foto": []}
    _salta(c, m["porta"]["x"], m["porta"]["z"], 5.0)
    esito["assedio"] = c.js("() => ({ stato: __game.campagna.attiva.stato, ondata: __game.campagna.attiva.ondata })")
    c.page.wait_for_timeout(7000)
    esito["foto"].append(c.foto("prova_difesa_ondata"))
    for _ in range(12):
        if not c.js("() => Storia.inProva()"):
            break
        _abbatti(c, "(__game.campagna.attiva || {nemiciOndate: []}).nemiciOndate.find(e => !e.dead)",
                 "alabarda", 30)
        c.js("() => { const m = __game.campagna.attiva; if (m) m.prossimaT = Math.min(m.prossimaT, 0.5); }")
        c.page.wait_for_timeout(1200)
    esito["riuscita"] = _aspetta_esito(c, 10)
    esito["assalto"] = c.js("() => __game.assalto.attivo")
    c.tp(c.js("() => __collaudo.piazza()"), 1.0)
    guasti = []
    if m["alleati"] != 3:
        guasti.append(f"alleati {m['alleati']}")
    if esito["assedio"]["stato"] != "assedio" or esito["assedio"]["ondata"] < 1:
        guasti.append(f"alla porta non comincia: {esito['assedio']}")
    if esito["riuscita"]["esito"] != "riuscita" or esito["assalto"]:
        guasti.append(f"la difesa non si chiude: {esito['riuscita']}, assalto {esito['assalto']}")
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


def _nell_osteria(c):
    """Davanti all'uscio segnato dalla prova del furto, E: dentro."""
    u = c.js("() => { const u = __game.campagna.attiva.uscio; return { x: u.x, z: u.z }; }")
    c.js("([x, z]) => __game.debug.tp(x, z + 1.0)", [u["x"], u["z"]])
    c.page.wait_for_timeout(1500)
    c.page.keyboard.press("e")
    c.page.wait_for_timeout(1400)
    return c.js("() => __game.Interni.dentro && __game.Interni.porta === __game.campagna.attiva.uscio")


def _fuori(c):
    c.js("() => { const e = __game.Interni.stanza.entrata; "
         "__game.player.x = e.x; __game.player.z = e.z; }")
    c.page.keyboard.down("ArrowDown")
    c.page.wait_for_timeout(1600)
    c.page.keyboard.up("ArrowDown")
    c.page.wait_for_timeout(900)


# chi sorveglia guarda verso il forziere (verso = 1) o dall'altra parte (-1), fermo
VOLTA = """(verso) => { const m = __game.campagna.attiva, s = __game.Interni.stanza;
  const chi = s.combattimento ? __game.npcs.filter(n => n.inStanza && !n.dead) : s.residenti;
  for (const r of chi) { r.flip = (m.forziere.x < r.x) === (verso > 0); r.giraT = 999; }
  return chi.map(r => +Math.hypot(r.x - m.forziere.x, r.z - m.forziere.z).toFixed(1)); }"""


def scena_prova_furto(c):
    """Furto in stanza: l'uscio segnato di un'osteria; dentro il forziere a
    pochi passi da chi sorveglia. Chi guarda verso di te mentre forzi ti vede:
    prova fallita. Con tutti voltati dall'altra parte si forza, si esce e la
    prova riesce."""
    c.tp(c.js("() => __collaudo.piazza()"), 1.0)
    _prova(c, 6)
    esito = {"dentro": _nell_osteria(c)}
    c.page.wait_for_timeout(500)
    esito["forziere"] = c.js("() => __game.campagna.attiva.forziere")
    esito["distanze"] = c.js(VOLTA, 1)
    f = esito["forziere"]
    _salta(c, f["x"], f["z"] + 0.8, 1.2)
    esito["foto"] = [c.foto("prova_furto_visto")]
    esito["visto"] = _aspetta_esito(c, 3)
    _fuori(c)
    # di nuovo, tutti voltati
    _prova(c, 6)
    esito["dentro2"] = _nell_osteria(c)
    c.page.wait_for_timeout(500)
    c.js(VOLTA, -1)
    f = c.js("() => __game.campagna.attiva.forziere")
    _salta(c, f["x"], f["z"] + 0.8, 1.5)
    esito["foto"].append(c.foto("prova_furto_forza"))
    c.page.wait_for_timeout(5000)
    esito["preso"] = c.js("() => (__game.campagna.attiva || {}).preso")
    _fuori(c)
    esito["riuscita"] = _aspetta_esito(c, 3)
    c.tp(c.js("() => __collaudo.piazza()"), 1.0)
    guasti = []
    if not esito["dentro"] or not esito["dentro2"] or not f:
        guasti.append("non si entra nell'osteria segnata, o niente forziere")
    if not any(d <= 6 for d in esito["distanze"]):   # FURTO.vista (14/10)
        guasti.append(f"nessuno sorveglia il forziere: {esito['distanze']}")
    if "visto" not in str(esito["visto"]["esito"]):
        guasti.append(f"forzare sotto gli occhi non fa fallire: {esito['visto']}")
    if not esito["preso"] or esito["riuscita"]["esito"] != "riuscita":
        guasti.append(f"il furto non riesce: preso {esito['preso']}, {esito['riuscita']}")
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito
