"""collaudo_nave.py — la nave pirata dell'atto III (nave.js, 07/10).

Stesse regole di collaudo.py (che la importa in SCENE): misure, non giudizi;
la scena torna un dict, con "errore" se qualcosa non va. Gira in una pagina a
parte (?pianta=nave, il Fiordo dietro): la partita delle altre scene resta
dov'e'.
"""

URL_NAVE = "?pianta=nave"

STATO = r"""() => ({ dentro: Interni.dentro, stanza: Interni.dentro ? Interni.stanza.tipologia : null,
  catene: Nave.inCatene, citta: __game.world.pianta.chiave,
  pirati: __game.npcs.filter(n => n.inStanza && !n.dead).length,
  obiettivo: document.getElementById('objective').textContent,
  messaggio: document.getElementById('msg').textContent,
  bloccato: !Interni.dentro && !!__game.world.blocked(__game.player.x, __game.player.z),
  miscela: Colonna.miscela })"""

# il ladro nell'ultima fila della stanza, davanti al vano della cella data
AL_VANO = r"""(cella) => { const s = Interni.stanza, p = __game.player;
  p.x = -320 + (cella + 0.5) * s.C; p.z = -320 + (s.H - 0.5) * s.C; p.vx = p.vz = 0; }"""


def _oltre(pagina, cella):
    """Dal vano della cella, giu' oltre la soglia: la botola o la passerella.
    La freccia resta premuta 3 s, come fa chi gioca: le stanze attraversate
    (passaggi) devono essere una sola, non un avanti e indietro (07/10)."""
    pagina.evaluate(AL_VANO, cella)
    pagina.wait_for_timeout(300)
    pagina.evaluate("() => __game.debug.premi('down', true)")
    visti = [pagina.evaluate(STATO)["stanza"]]
    for _ in range(20):
        pagina.wait_for_timeout(150)
        s = pagina.evaluate(STATO)["stanza"]
        if s != visti[-1]:
            visti.append(s)
    pagina.evaluate("() => __game.debug.premi('down', false)")
    pagina.wait_for_timeout(1200)
    esito = pagina.evaluate(STATO)
    esito["passaggi"] = len(visti) - 1
    return esito


def _e_su(pagina, cella):
    """Il ladro al centro di una cella del ponte, poi E."""
    pagina.evaluate("""([i, k]) => { const s = Interni.stanza, p = __game.player;
      p.x = -320 + (i + 0.5) * s.C; p.z = -320 + (k + 0.5) * s.C; p.vx = p.vz = 0; }""", cella)
    pagina.wait_for_timeout(300)
    pagina.keyboard.press("KeyE")
    pagina.wait_for_timeout(1500)
    return pagina.evaluate(STATO)


# dove si ferma chi cammina 3 s da mezzo al ponte verso nord e verso sud (in celle)
FERMO = r"""() => { const s = Interni.stanza, p = __game.player;
  return { z: +((p.z + 320) / s.C).toFixed(2), stanza: Interni.dentro && s.tipologia }; }"""


def _cammina(pagina, tasto):
    pagina.evaluate("""() => { const s = Interni.stanza, p = __game.player;
      p.x = -320 + 8.5 * s.C; p.z = -320 + 5.5 * s.C; }""")
    pagina.evaluate(f"() => __game.debug.premi('{tasto}', true)")
    pagina.wait_for_timeout(3000)
    pagina.evaluate(f"() => __game.debug.premi('{tasto}', false)")
    return pagina.evaluate(FERMO)


# Il passo 1 nella stiva (storia_mare.js): dove stare (in celle) per parlare
# col vecchio al remo, col rematore giovane, con quello del sud e col nostromo
ASCOLTO = [[5.5, 3.5], [7.5, 5.5], [9.5, 3.5], [11.5, 3.5]]


def _passo1(pagina):
    """E accanto al vecchio al remo (il committente: apre il capitolo), poi
    accanto a ognuno dei quattro: ognuno dice la sua, e il capitolo si chiude."""
    def e_qui(xz):
        pagina.evaluate("""([x, z]) => { const s = Interni.stanza, p = __game.player;
          p.x = -320 + x * s.C; p.z = -320 + z * s.C; p.vx = p.vz = 0; }""", xz)
        pagina.wait_for_timeout(250)
        pagina.keyboard.press("KeyE")
        pagina.wait_for_timeout(400)
        return pagina.evaluate("() => document.getElementById('msg').textContent")
    e_qui(ASCOLTO[0])
    tipo = pagina.evaluate("() => { const m = __game.campagna.attiva; return m && m.tipo; }")
    battute = [e_qui(xz) for xz in ASCOLTO]
    # l'ultima battuta resta da leggere (LETTURA, 4 s), poi il capitolo si chiude
    pagina.wait_for_timeout(5000)
    fine = pagina.evaluate("""() => ({ cap: Storia.stato.cap, finita: Storia.stato.finita,
      attiva: !!__game.campagna.attiva, msg: document.getElementById('msg').textContent })""")
    return {"tipo": tipo, "battute": battute, **fine}


# chi suona ora (colonna.js): lo stato dell'audio e le musiche, senza gli ambienti
SUONANO = r"""() => ({ stato: Colonna.stato,
  musica: Colonna.suonano.filter(k => k.startsWith('m:')) })"""


def _musica_di_notte(pagina):
    """Sul ponte la musica dei marinai di giorno, di notte solo l'ambiente
    (09/10, tua scelta): la sfumata dura 2 s."""
    pagina.evaluate("() => __game.debug.setDay(0.4)")
    pagina.wait_for_timeout(2600)
    giorno = pagina.evaluate(SUONANO)
    pagina.evaluate("() => __game.debug.setDay(0.9)")
    pagina.wait_for_timeout(2600)
    notte = pagina.evaluate(SUONANO)
    pagina.evaluate("() => __game.debug.setDay(0.4)")
    return {"giorno": giorno, "notte": notte}


def scena_nave(c):
    """Dal menu del titolo, "La nave (prova)": si parte in catene nella stiva
    (niente colpi), con la storia all'atto III; il passo 1 (ai remi): il
    vecchio al remo apre il capitolo, i quattro dicono la loro e il capitolo
    si chiude; la botola porta sul ponte vero (08/10: la galea sul mare,
    coi pirati veri), dove si cammina solo fra le murate (file 4-6); E sulla
    grata riporta giu', E alla passerella rimette a terra nel Fiordo, libero
    e su un punto calpestabile (la cabina del capitano dal 09/10 e' fuori dal
    giro). Sul ponte la musica di giorno, di notte solo l'ambiente (09/10).
    Foto della stiva e del ponte."""
    contesto = c.page.context.browser.new_context(viewport={"width": 1280, "height": 720})
    pagina = contesto.new_page()
    errori = []
    pagina.on("pageerror", lambda e: errori.append(str(e)))
    pagina.on("console", lambda m: m.type == "error" and errori.append(m.text))
    esito = {}
    try:
        pagina.goto(c.page.url.split("?")[0] + URL_NAVE, wait_until="load")
        pagina.wait_for_function("() => document.getElementById('loading').textContent === 'pronto'",
                                 timeout=60000)
        pagina.evaluate("() => { document.getElementById('title').style.display = 'none'; }")
        # il sereno fisso: a terra nel Fiordo la pioggia a caso sceglieva la
        # miscela "temporale" al posto di "fiordo" (collaudo 39, 13/10)
        pagina.evaluate("() => { Meteo.fissa(true); Meteo.imposta('sereno'); }")
        pagina.wait_for_timeout(1500)
        esito["menu"] = pagina.evaluate("() => document.getElementById('cittaSel').value")
        esito["stiva"] = pagina.evaluate(STATO)
        pagina.keyboard.press("Space")
        pagina.wait_for_timeout(300)
        esito["colpo_in_catene"] = pagina.evaluate("() => document.getElementById('msg').textContent")
        pagina.screenshot(path=str(c.cartella / "nave_stiva.png"))
        esito["obiettivo"] = pagina.evaluate("() => document.getElementById('objective').textContent")
        esito["passo1"] = _passo1(pagina)
        esito["ponte"] = _oltre(pagina, 7)
        pagina.evaluate("() => __game.debug.setDay(0.4)")
        pagina.wait_for_timeout(800)
        pagina.screenshot(path=str(c.cartella / "nave_ponte.png"))
        esito["murata_nord"] = _cammina(pagina, "up")
        esito["murata_sud"] = _cammina(pagina, "down")
        esito["musica"] = _musica_di_notte(pagina)
        esito["di_nuovo_stiva"] = _e_su(pagina, [8, 5])          # accanto alla grata
        _oltre(pagina, 7)
        esito["a_terra"] = _e_su(pagina, [6, 6])                 # la passerella
    finally:
        contesto.close()
    esito["errori"] = errori
    s, p, g, t = esito["stiva"], esito["ponte"], esito["di_nuovo_stiva"], esito["a_terra"]
    n, su = esito["murata_nord"], esito["murata_sud"]
    if errori:
        esito["errore"] = "errori di console sulla nave"
    elif esito["menu"] != "nave" or s["stanza"] != "stiva" or not s["catene"]:
        esito["errore"] = "dal menu non si parte in catene nella stiva"
    elif "ferri" not in esito["colpo_in_catene"]:
        esito["errore"] = "in catene si colpisce"
    elif "vecchio al remo" not in esito["obiettivo"] or esito["passo1"]["tipo"] != "ascolta" \
            or not all(b.startswith(n) for b, n in zip(esito["passo1"]["battute"], (
                "il vecchio al remo:", "un rematore giovane:", "un rematore del sud:",
                "il nostromo:"))) \
            or esito["passo1"]["attiva"] or esito["passo1"]["cap"] != 1:
        esito["errore"] = f"il passo 1 (ai remi) non va: {esito['obiettivo']!r}, {esito['passo1']}"
    elif p["stanza"] != "ponte" or p["pirati"] < 5 or g["stanza"] != "stiva":
        esito["errore"] = "la botola non porta dalla stiva al ponte e ritorno"
    elif p["passaggi"] != 1:
        esito["errore"] = "con la freccia premuta si fa avanti e indietro dalla botola"
    elif n["stanza"] != "ponte" or su["stanza"] != "ponte" or n["z"] < 4.0 or su["z"] > 7.0:
        esito["errore"] = "sul ponte si cammina oltre le murate"
    elif esito["musica"]["giorno"]["stato"] == "running" and (
            not esito["musica"]["giorno"]["musica"] or esito["musica"]["notte"]["musica"]):
        esito["errore"] = f"sul ponte di notte suona la musica (o di giorno no): {esito['musica']}"
    elif t["dentro"] or t["catene"] or t["bloccato"] or t["citta"] != "fiordo-3":
        esito["errore"] = "la passerella non rimette a terra, libero, nel Fiordo"
    elif (s["miscela"], p["miscela"], t["miscela"]) != ("stiva", "ponte", "fiordo"):
        esito["errore"] = ("la colonna sonora non segue il posto (stiva, ponte, Fiordo): "
                           f"{s['miscela']}, {p['miscela']}, {t['miscela']}")
    return esito


SCENE_NAVE = {"nave": scena_nave}
