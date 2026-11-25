"""collaudo_bestie.py — chi tira i carri e l'asino da cavalcare (bestie.js, 13/10).

Stesse regole di collaudo.py (che la importa in SCENE): misure, non giudizi;
la scena torna un dict, con "errore" se qualcosa non va. Gira in una pagina a
parte, che passa per Valdarno, il Fiordo 3 e la Costa 5: la partita delle
altre scene resta dov'e'.
"""

CITTA = ["valdarno", "fiordo-3", "costa-5"]

# i mezzi della citta': carri fermi e in transito per bestia, cavalli e asini
CONTA = r"""() => {
  const conta = (L, o = {}) => { for (const v of L) o[v.bestia || '-'] = (o[v.bestia || '-'] || 0) + 1;
                                 return o; };
  const V = __game.vehicles, pianta = __game.world.pianta;
  const sella = V.filter(v => v.type === 'cavallo');
  return { citta: pianta.chiave,
    fermi: conta(V.filter(v => v.type === 'carro' && !v.transito)),
    transito: conta(Traffico.carri),
    cavalli: sella.filter(v => !v.sella).length,
    asini: sella.filter(v => v.sella === 'ladro_asino').length,
    cammelli: sella.filter(v => Bestie.cammello(v)).length,
    atteso: Bestie.TIRO[pianta.stile || 'borgo'].map(([b]) => b) }; }"""

# il mezzo fermo piu' vicino al ladro che risponde a `filtro`
VICINO = r"""(filtro) => { const p = __game.player;
  const v = __game.vehicles.filter(new Function('v', 'return ' + filtro))
    .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  return v && { x: v.x, z: v.z, bestia: v.bestia || null, maxSpeed: v.maxSpeed, hp: v.maxHp }; }"""

# la direzione piu' libera davanti al ladro (fino a 40 unita')
LIBERO = r"""() => { const p = __game.player, w = __game.world;
  let best = null, bd = -1;
  for (const [k, dx, dz] of [['right', 1, 0], ['left', -1, 0], ['down', 0, 1], ['up', 0, -1]]) {
    let d = 0; while (d < 40 && !w.blocked(p.x + dx * (d + 1), p.z + dz * (d + 1))) d++;
    if (d > bd) { bd = d; best = k; } }
  return { tasto: best, libero: bd }; }"""

SELLA = r"""() => { const p = __game.player, v = p.vehicle;
  return { sprite: p.sprite, sella: v ? v.sella || null : null,
           velocita: v ? +Math.abs(v.speed).toFixed(2) : null }; }"""


def _apri(pagina, url):
    pagina.goto(url, wait_until="load")
    pagina.wait_for_function("() => document.getElementById('loading').textContent === 'pronto'",
                             timeout=60000)
    pagina.evaluate("() => { document.getElementById('title').style.display = 'none'; }")
    pagina.wait_for_timeout(1500)


def _sereno(pagina):
    pagina.evaluate("() => { Meteo.fissa(true); Meteo.imposta('sereno'); "
                    "__game.debug.setDay(0.4); __game.player.hp = 1e6; }")


def _tp(pagina, x, z, attesa=1500):
    pagina.evaluate("([x, z]) => __game.debug.tp(x, z)", [x, z])
    pagina.wait_for_timeout(attesa)


def _citta(pagina, cartella, chiave):
    """Le bestie di una citta': i carri fermi (dal mondo) e quelli in transito
    (dopo 10 s in piazza), la foto di un carro fermo con una bestia nuova."""
    if chiave != "valdarno":
        pagina.evaluate("(k) => __game.debug.citta(k)", chiave)
        pagina.wait_for_timeout(3000)
    _sereno(pagina)
    p = pagina.evaluate("() => __game.world.spawns.player")
    _tp(pagina, p["x"], p["z"], 10000)
    esito = pagina.evaluate(CONTA)
    # un carro fermo: quelli in transito sono a caso (collaudo 48)
    v = pagina.evaluate(VICINO, "v.type === 'carro' && !v.transito && v.bestia && "
                                "v.bestia !== 'cavallo_mini'")
    if v:
        _tp(pagina, v["x"], v["z"] + 4)
        _sereno(pagina)
        nome = f"bestie_{chiave.split('-')[0]}.png"
        pagina.screenshot(path=str(cartella / nome))
        esito["foto"] = (cartella / nome).as_posix()
    return esito


def _asino(pagina, cartella):
    """A Valdarno: E accanto all'asino fermo piu' vicino, in sella e' ladro_asino;
    3 s di corsa nella direzione libera (la velocita' piu' alta: 10,5 al
    massimo, piu' di chi corre a piedi, 8,6); poi l'asino muore sotto di te e
    resta a terra la carcassa dell'asino, col messaggio giusto."""
    # lontano dai committenti: E accanto a uno di loro parla, non monta
    # (game.js; collaudo 48: l'asino accanto a suor Timotea)
    a = pagina.evaluate(VICINO, "v.sella === 'ladro_asino' && !__game.world.spawns.givers"
                                ".some(q => Math.hypot(q.x - v.x, q.z - v.z) < 6)")
    c = pagina.evaluate(VICINO, "v.type === 'cavallo' && !v.sella")
    if not a:
        return {"errore": "nessun asino da cavalcare a Valdarno"}
    _tp(pagina, a["x"] + 1.2, a["z"] + 0.8)
    pagina.keyboard.press("KeyE")
    pagina.wait_for_timeout(400)
    esito = {"asino": a, "cavallo": c, "in_sella": pagina.evaluate(SELLA)}
    d = pagina.evaluate(LIBERO)
    pagina.evaluate("(t) => __game.debug.premi(t, true)", d["tasto"])
    velocita = []
    for k in range(30):
        pagina.wait_for_timeout(100)
        velocita.append(pagina.evaluate(SELLA)["velocita"] or 0)
        if k == 15:
            pagina.screenshot(path=str(cartella / "bestie_asino.png"))
    pagina.evaluate("(t) => __game.debug.premi(t, false)", d["tasto"])
    esito["corsa"] = {"direzione": d, "massima": max(velocita), "foto": (cartella / "bestie_asino.png").as_posix()}
    esito["caduta"] = pagina.evaluate("""() => { const p = __game.player, v = p.vehicle;
      if (v) __game.disarciona(v);
      const c = __game.carcasse[__game.carcasse.length - 1];
      return { carcassa: c ? c.bestia || null : null, a_piedi: !p.vehicle, sprite: p.sprite }; }""")
    # il messaggio arriva sull'HUD al fotogramma dopo
    pagina.wait_for_timeout(300)
    esito["caduta"]["messaggio"] = pagina.evaluate("() => document.getElementById('msg').textContent")
    return esito


def scena_bestie(c):
    """Bestie.js (13/10): a Valdarno i carri li tirano cavallo, asino e mulo;
    nel Fiordo asini e muli; alla Costa cammelli e dromedari. Un cavallo fermo
    su tre a Valdarno e uno su due nel Fiordo e' un asino da cavalcare, alla
    Costa nessuno, ma cammelli e dromedari (un cavallo su due). In sella
    all'asino il ladro e' ladro_asino, piu' lento del cavallo, con la stessa
    salute (55)."""
    contesto = c.page.context.browser.new_context(viewport={"width": 1280, "height": 720})
    pagina = contesto.new_page()
    errori = []
    pagina.on("pageerror", lambda e: errori.append(str(e)))
    pagina.on("console", lambda m: m.type == "error" and errori.append(m.text))
    esito, guasti = {}, []
    try:
        _apri(pagina, c.page.url.split("?")[0])
        esito["valdarno"] = _citta(pagina, c.cartella, "valdarno")
        esito["sella"] = _asino(pagina, c.cartella)
        for chiave in CITTA[1:]:
            esito[chiave] = _citta(pagina, c.cartella, chiave)
    finally:
        contesto.close()
    for chiave in CITTA:
        m = esito[chiave]
        for dove in ("fermi", "transito"):
            fuori = [b for b in m[dove] if b not in m["atteso"]]
            if fuori:
                guasti.append(f"{chiave}: carri {dove} con {fuori}")
        if set(m["fermi"]) != set(m["atteso"]):
            guasti.append(f"{chiave}: fra i carri fermi mancano "
                          f"{sorted(set(m['atteso']) - set(m['fermi']))}")
    if not esito["valdarno"]["asini"] or not esito["fiordo-3"]["asini"]:
        guasti.append("nessun asino fermo a Valdarno o nel Fiordo")
    if esito["costa-5"]["asini"] or not esito["costa-5"]["cammelli"]:
        guasti.append("alla Costa asini, o nessun cammello da cavalcare")
    s = esito["sella"]
    if "errore" in s:
        guasti.append(s["errore"])
    else:
        if s["in_sella"]["sprite"] != "ladro_asino":
            guasti.append(f"in sella all'asino lo sprite e' {s['in_sella']['sprite']}")
        if s["asino"]["hp"] != 55 or (s["cavallo"] and s["cavallo"]["maxSpeed"] != 14):
            guasti.append("salute dell'asino o velocita' del cavallo cambiate")
        if not 8.6 < s["corsa"]["massima"] <= 10.55:
            guasti.append(f"l'asino corre a {s['corsa']['massima']} (voluto 8,6-10,5)")
        k = s["caduta"]
        if k["carcassa"] != "BanAsino" or not k["a_piedi"] or "L'asino" not in k["messaggio"]:
            guasti.append(f"la caduta dall'asino: {k}")
    if errori:
        guasti.append(f"errori nella pagina: {errori[:3]}")
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


SCENE_BESTIE = {"bestie": scena_bestie}
