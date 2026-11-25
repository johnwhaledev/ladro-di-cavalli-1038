"""collaudo_nave_passi.py — i passi 2-4 dell'atto III e l'arrivo dai saraceni
(missioni_nave.js, 09/10).

Stesse regole di collaudo.py (che la importa in SCENE): misure, non giudizi;
la scena torna un dict, con "errore" se qualcosa non va. Separata da
collaudo_nave.py (la nave e il passo 1) perche' quella stava oltre la
misura; ne usa gli aiuti (la pagina della prova, la botola, E su una cella).
"""

from collaudo_nave import STATO, URL_NAVE, _e_su, _oltre

# lo stato del passo in corso, il ladro in celle, suggerimento e barra dell'HUD
PASSO = r"""() => { const m = __game.campagna.attiva, s = Interni.stanza, p = __game.player;
  const r = s && s.residenti.find(q => q.nome === 'il nostromo');
  return { cap: Storia.stato.cap, tipo: m && m.tipo, prog: m ? +(m.prog || 0).toFixed(2) : 0,
    presi: m ? m.presi || 0 : 0, catene: Nave.inCatene, stanza: Interni.dentro && s.tipologia,
    cella: s ? [+((p.x + 320) / s.C).toFixed(2), +((p.z + 320) / s.C).toFixed(2)] : null,
    nostromo: r ? { flip: !!r.flip, gira: r.giraT !== undefined } : null,
    liberati: m && m.liberati ? m.liberati.length : null, armi: Nave.senzaArmi,
    msg: document.getElementById('msg').textContent,
    suggerimento: document.getElementById('prompt').textContent,
    barra: document.getElementById('conquista').style.display === 'block'
      && document.getElementById('conqLabel').textContent,
    prova: Storia.ultimaProva }; }"""

# il nostromo voltato e fermo cosi' (flip: guarda i banchi, a ponente)
VOLTA = r"""(flip) => { const r = Interni.stanza.residenti.find(q => q.nome === 'il nostromo');
  r.flip = flip; r.giraT = 99; }"""

QUI = r"""([x, z]) => { const s = Interni.stanza, p = __game.player;
  p.x = -320 + x * s.C; p.z = -320 + z * s.C; p.vx = p.vz = 0; }"""

# il nostromo sta nella cella (12, 3): alle spalle, a ponente, dove la sua
# cella piena ferma il ladro (1,64 dal centro); davanti a due celle
ALLE_SPALLE, DAVANTI, BANCO = [11.8, 3.5], [10.5, 3.5], [5.5, 4.5]

# il tasto E del touch tenuto e lasciato (game.js, bindInput)
TOCCO = r"""(tipo) => document.getElementById('btnE')
  .dispatchEvent(new Event(tipo, { cancelable: true }))"""


def _passo2(pagina, c):
    """La chiave: alle spalle del nostromo E tenuto riempie la barra; se si
    volta mentre la sfili ti rimanda al banco e si ricomincia; 3 s alle
    spalle e il capitolo si chiude, in catene. Poi la prova col tasto touch."""
    esito = {}
    pagina.evaluate("() => __game.debug.missione(1, 0)")
    pagina.wait_for_timeout(400)
    esito["avvio"] = pagina.evaluate(PASSO)
    pagina.evaluate(VOLTA, False)
    pagina.evaluate(QUI, ALLE_SPALLE)
    pagina.wait_for_timeout(300)
    esito["alle_spalle"] = pagina.evaluate(PASSO)
    pagina.keyboard.down("KeyE")
    pagina.wait_for_timeout(1200)
    esito["a_meta"] = pagina.evaluate(PASSO)
    pagina.screenshot(path=str(c.cartella / "nave_chiave.png"))
    pagina.evaluate(VOLTA, True)                       # si volta mentre la sfili
    pagina.wait_for_timeout(300)
    esito["voltato"] = pagina.evaluate(PASSO)
    pagina.keyboard.up("KeyE")
    pagina.evaluate(QUI, DAVANTI)                      # davanti, senza E: ti vede lo stesso
    pagina.wait_for_timeout(300)
    esito["davanti"] = pagina.evaluate(PASSO)
    pagina.evaluate(VOLTA, False)
    pagina.evaluate(QUI, ALLE_SPALLE)
    pagina.keyboard.down("KeyE")
    pagina.wait_for_timeout(3500)
    pagina.keyboard.up("KeyE")
    pagina.wait_for_timeout(300)
    esito["presa"] = pagina.evaluate(PASSO)
    # la prova n. 8 (campagna.js) col tasto E del touch tenuto 3,5 s
    pagina.evaluate("() => __game.debug.prova(8)")
    pagina.wait_for_timeout(400)
    pagina.evaluate(VOLTA, False)
    pagina.evaluate(QUI, ALLE_SPALLE)
    pagina.evaluate(TOCCO, "touchstart")
    pagina.wait_for_timeout(3500)
    pagina.evaluate(TOCCO, "touchend")
    pagina.wait_for_timeout(300)
    esito["tocco"] = pagina.evaluate(PASSO)
    return esito


def _errore_passo2(e):
    """Il perche' del primo controllo del passo 2 che non torna, o None."""
    vicino = lambda a, b: abs(a[0] - b[0]) < 0.25 and abs(a[1] - b[1]) < 0.25
    if e["avvio"]["tipo"] != "chiave" or e["avvio"]["cap"] != 1:
        return f"il passo 2 non parte: {e['avvio']}"
    if "sfila la chiave" not in e["alle_spalle"]["suggerimento"]:
        return f"alle spalle del nostromo manca il suggerimento: {e['alle_spalle']['suggerimento']!r}"
    if e["a_meta"]["prog"] < 0.8 or e["a_meta"]["barra"] != "La chiave dei ferri":
        return f"E tenuto non riempie la barra: {e['a_meta']}"
    v = e["voltato"]
    if v["presi"] != 1 or v["prog"] != 0 or not vicino(v["cella"], BANCO) \
            or "nostromo" not in v["msg"]:
        return f"il nostromo si volta e non ti rimanda al banco: {v}"
    if e["davanti"]["presi"] != 2 or not vicino(e["davanti"]["cella"], BANCO):
        return f"davanti al nostromo non ti vede: {e['davanti']}"
    p = e["presa"]
    if p["cap"] != 2 or p["tipo"] or not p["catene"] or p["nostromo"]["gira"] \
            or p["nostromo"]["flip"]:
        return f"la chiave presa non chiude il capitolo in catene: {p}"
    if e["tocco"]["prova"] != "riuscita":
        return f"col tasto E del touch tenuto la chiave non si prende: {e['tocco']}"
    return None


# i sette rematori ai banchi della stiva: dove stare (in celle) nella corsia
# di mezzo, e quante volte E (il banco a nord e quello a sud; al 5 sud c'e'
# il tuo, vuoto)
REMATORI = [([3.5, 3.5], 2), ([5.5, 3.5], 1), ([7.5, 3.5], 2), ([9.5, 3.5], 2)]


def _scena_via(pagina):
    """E finche' la scena di passaggio non si chiude."""
    for _ in range(12):
        if not pagina.evaluate("() => Passaggi.attiva"):
            break
        pagina.keyboard.press("KeyE")
        pagina.wait_for_timeout(500)
    pagina.wait_for_timeout(900)


def _passo3(pagina, c):
    """L'abbordaggio: la scena della vela, il nostromo che sale (sparisce
    dalla stiva), E accanto ai sette rematori (la barra conta il tempo), poi
    sciolto anche tu ma a mani nude; nella prova n. 9 il tempo che finisce."""
    esito = {}
    pagina.evaluate("() => __game.debug.missione(2, 0)")
    pagina.wait_for_timeout(700)
    esito["scena"] = pagina.evaluate("""() => ({ attiva: Passaggi.attiva,
      titolo: document.getElementById('scenaTitolo').textContent })""")
    _scena_via(pagina)
    esito["avvio"] = pagina.evaluate(PASSO)
    for i, (xz, volte) in enumerate(REMATORI):
        pagina.evaluate(QUI, xz)
        pagina.wait_for_timeout(250)
        for _ in range(volte):
            pagina.keyboard.press("KeyE")
            pagina.wait_for_timeout(250)
        if i == 1:
            esito["a_meta"] = pagina.evaluate(PASSO)
            pagina.screenshot(path=str(c.cartella / "nave_liberi.png"))
    pagina.wait_for_timeout(500)
    esito["liberi"] = pagina.evaluate(PASSO)
    pagina.keyboard.press("Space")
    pagina.wait_for_timeout(300)
    esito["mani_nude"] = pagina.evaluate("() => document.getElementById('msg').textContent")
    pagina.evaluate("() => __game.debug.prova(9)")
    pagina.wait_for_timeout(400)
    pagina.evaluate("() => { __game.campagna.attiva.restano = 0.4; }")
    pagina.wait_for_timeout(1000)
    esito["tempo_scaduto"] = pagina.evaluate(PASSO)
    return esito


def _errore_passo3(e):
    """Il perche' del primo controllo del passo 3 che non torna, o None."""
    if not e["scena"]["attiva"] or "vela" not in e["scena"]["titolo"].lower():
        return f"prima del passo 3 manca la scena della vela: {e['scena']}"
    if e["avvio"]["tipo"] != "liberi" or e["avvio"]["nostromo"] is not None:
        return f"il passo 3 non parte, o il nostromo resta nella stiva: {e['avvio']}"
    if e["a_meta"]["liberati"] != 3 or e["a_meta"]["barra"] != "Prima che torni il nostromo":
        return f"E accanto ai rematori non li libera: {e['a_meta']}"
    v = e["liberi"]
    if v["cap"] != 3 or v["tipo"] or v["catene"] or not v["armi"] or v["nostromo"] is None:
        return f"liberati tutti, il capitolo non si chiude a mani nude: {v}"
    if "arma" not in e["mani_nude"]:
        return f"a mani nude si colpisce: {e['mani_nude']!r}"
    if not str(e["tempo_scaduto"]["prova"]).startswith("fallita"):
        return f"finito il tempo il passo 3 non fallisce: {e['tempo_scaduto']}"
    return None


# l'ammutinamento: la fase, i pirati come Nemici nella stanza, la gente della
# stanza, le armi del ladro e la vita minima
LOTTA = r"""() => { const m = __game.campagna.attiva, p = __game.player;
  return { fase: m && m.fase, tipo: m && m.tipo,
    nemici: __game.nemici.filter(e => e.inStanza && !e.dead && e.fazione === 'nemico').length,
    alleati: __game.nemici.filter(e => e.inStanza && !e.dead && e.fazione === 'alleato').length,
    contro_i_pirati: __game.nemici.filter(e => e.fazione === 'alleato' && !e.dead &&
      e.bersaglioCorrente && e.bersaglioCorrente.fazione === 'nemico').length,
    gente: __game.npcs.filter(n => n.inStanza && !n.dead).length,
    arma: p.arma, arsenale: [...p.arsenale], armi: Nave.senzaArmi, catene: Nave.inCatene,
    hp: Math.round(p.hp), morto: !!p.dead, minimo: p.minimo || 0,
    stanza: Interni.dentro && Interni.stanza.tipologia,
    msg: document.getElementById('msg').textContent,
    suggerimento: document.getElementById('prompt').textContent,
    prova: Storia.ultimaProva }; }"""

# il ladro accanto al pirata vivo piu' vicino, a sinistra di lui
ACCANTO = r"""() => { const p = __game.player;
  const e = __game.nemici.filter(q => q.inStanza && !q.dead && q.fazione === 'nemico')
    .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  p.x = e.x - 1.2; p.z = e.z; p.vx = p.vz = 0; e.hp = e.maxHp; return e.maxHp; }"""


# l'obiettivo in alto e la stella (Gfx: l'anello a terra della meta) sulla nave
GUIDA = r"""() => document.getElementById('objective').textContent"""


def _passo4(pagina, c):
    """L'ammutinamento nella prova n. 10: nella stiva l'obiettivo dice di
    salire; sul ponte i pirati restano gente finche' non hai la sciabola, e
    l'obiettivo dice la rastrelliera; E sulla rastrelliera a poppa (09/10:
    sul ponte, non piu' nella cabina) e i pirati diventano Nemici, la sciabola
    li ferisce, i sette rematori liberati salgono e combattono i pirati
    (13/10, tua richiesta), la grata non si passa; un colpo da 5000 lascia la
    vita a 1 (non si muore), e allo stremo ti disarmano: di nuovo i ferri, niente
    sciabola, i pirati tornano gente, e 4 s dopo la prova e' riuscita."""
    esito = {}
    pagina.evaluate("() => __game.debug.prova(10)")
    # vita alta: cinque pirati addosso portano allo stremo prima delle misure
    pagina.evaluate("() => { const p = __game.player; p.maxHp = p.hp = 1000; }")
    pagina.wait_for_timeout(400)
    esito["guida_stiva"] = pagina.evaluate(GUIDA)
    _oltre(pagina, 7)
    esito["ponte_prima"] = pagina.evaluate(LOTTA)
    esito["guida_ponte"] = pagina.evaluate(GUIDA)
    pagina.evaluate(QUI, [4.2, 6.6])                        # accanto alla rastrelliera
    pagina.wait_for_timeout(400)
    esito["rastrelliera"] = pagina.evaluate(LOTTA)
    pagina.screenshot(path=str(c.cartella / "nave_rastrelliera.png"))
    pagina.keyboard.press("KeyE")
    pagina.wait_for_timeout(500)
    esito["lotta"] = pagina.evaluate(LOTTA)
    vita = pagina.evaluate(ACCANTO)
    for _ in range(3):
        pagina.keyboard.press("Space")
        pagina.wait_for_timeout(600)
    esito["colpito"] = pagina.evaluate("""(vita) => __game.nemici.some(e => e.inStanza &&
      e.fazione === 'nemico' && (e.dead || e.hp < vita))""", vita)
    esito["mischia"] = pagina.evaluate(LOTTA)          # i rematori, dopo 1,8 s di lotta
    pagina.screenshot(path=str(c.cartella / "nave_ammutinamento.png"))
    esito["grata"] = _e_su(pagina, [8, 5])
    esito["grata_msg"] = pagina.evaluate(LOTTA)["msg"]
    pagina.evaluate("() => __game.player.hurt(5000)")
    pagina.wait_for_timeout(300)
    esito["stremo"] = pagina.evaluate(LOTTA)
    pagina.wait_for_timeout(4500)
    esito["fine"] = pagina.evaluate(LOTTA)
    pagina.evaluate("() => { const p = __game.player; p.maxHp = p.hp = 100; }")
    return esito


def _errore_passo4(e):
    """Il perche' del primo controllo del passo 4 che non torna, o None."""
    if "Sali sul ponte" not in e["guida_stiva"] or "rastrelliera" not in e["guida_ponte"]:
        return f"la guida non dice dove andare: {e['guida_stiva']!r}, {e['guida_ponte']!r}"
    if e["ponte_prima"]["fase"] != "armi" or e["ponte_prima"]["nemici"] \
            or e["ponte_prima"]["gente"] < 5:
        return f"sul ponte i pirati attaccano prima della sciabola: {e['ponte_prima']}"
    if e["rastrelliera"]["stanza"] != "ponte" or "sciabola" not in e["rastrelliera"]["suggerimento"]:
        return f"accanto alla rastrelliera manca il suggerimento: {e['rastrelliera']}"
    lo = e["lotta"]
    if lo["arma"] != "sciabola" or lo["armi"] or lo["fase"] != "lotta" or lo["nemici"] < 5 \
            or lo["gente"] or lo["minimo"] != 1:
        return f"presa la sciabola i pirati non attaccano: {lo}"
    if not e["colpito"]:
        return "la sciabola non ferisce i pirati"
    if lo["alleati"] != 7 or not e["mischia"]["contro_i_pirati"]:
        return f"i rematori non combattono coi pirati: {lo['alleati']}, {e['mischia']}"
    if e["grata"]["stanza"] != "ponte" or "sbarrano" not in e["grata_msg"]:
        return f"durante l'ammutinamento la grata si passa: {e['grata']}, {e['grata_msg']!r}"
    s = e["stremo"]
    if s["morto"] or s["hp"] != 1 or s["fase"] != "disarmato" or not s["catene"] \
            or "sciabola" in s["arsenale"] or s["nemici"] or s["alleati"] or s["gente"] < 1:
        return f"allo stremo non ti disarmano (o si muore): {s}"
    if e["fine"]["prova"] != "riuscita" or e["fine"]["minimo"]:
        return f"dopo il disarmo l'ammutinamento non si chiude: {e['fine']}"
    return None


def _arrivo(pagina, c):
    """Il capitolo 4 vero chiuso (debug.avanza): la scena "La Costa", poi
    l'atto IV a Qasr Zarqa (costa-5), fuori dalle stanze, senza ferri."""
    pagina.evaluate("() => __game.debug.missione(3, 0)")
    pagina.wait_for_timeout(400)
    pagina.evaluate("() => __game.debug.avanza()")
    pagina.wait_for_function("() => Passaggi.attiva", timeout=8000)
    pagina.wait_for_timeout(800)
    esito = {"scena": pagina.evaluate("() => document.getElementById('scenaTitolo').textContent"),
             "scena_attesa": pagina.evaluate("() => TX('scena.costa.titolo')")}   # i nomi in it.js
    for _ in range(12):
        if not pagina.evaluate("() => Passaggi.attiva"):
            break
        pagina.keyboard.press("KeyE")
        pagina.wait_for_timeout(700)
    pagina.wait_for_function("() => !Passaggi.attiva", timeout=40000)
    pagina.wait_for_timeout(1500)
    esito["dopo"] = pagina.evaluate(STATO)
    esito["dopo"].update(pagina.evaluate("""() => { const p = __game.player,
      g = __game.world.spawns.givers.find(q => q.name === TX('committenti.atto4.mercante'));
      return { atto: Storia.stato.atto, titolo: Storia.titolo, armi: Nave.senzaArmi,
               in_barca: !!p.vehicle, mercante: g ? +Math.hypot(g.x - p.x, g.z - p.z).toFixed(1)
                                                  : null }; }"""))
    pagina.screenshot(path=str(c.cartella / "costa_arrivo.png"))
    return esito


def _errore_arrivo(e):
    """Venduto al mercato (09/10, tua scelta): a piedi nel suk, davanti al
    mercante che ti ha comprato, su un punto libero; l'obiettivo dice di
    aspettare i suoi ordini."""
    d = e["dopo"]
    if e["scena"] != e["scena_attesa"]:
        return f"alla fine dell'atto III manca la scena della Costa: {e['scena']!r}"
    if d["citta"] != "costa-5" or d["atto"] != 3 or d["dentro"] or d["catene"] \
            or d["armi"] or d["bloccato"] or d["in_barca"]:
        return f"dopo l'atto III non si arriva a piedi e libero a Qasr Zarqa: {d}"
    if d["mercante"] is None or d["mercante"] > 6 or "mercante" not in d["obiettivo"]:
        return f"a Qasr Zarqa non si arriva davanti al mercante: {d}"
    return None


def scena_nave_passi(c):
    """I passi 2-4 dell'atto III dal menu "La nave (prova)": il 2, la chiave
    del nostromo (E tenuto, da tastiera e dal tasto touch); il 3,
    l'abbordaggio (i ferri ai rematori); il 4, l'ammutinamento (la sciabola,
    i pirati, il disarmo); l'arrivo a Qasr Zarqa dopo la scena della Costa.
    Foto: la barra della chiave, i rematori a meta', la rastrelliera, la
    lotta sul ponte, l'arrivo."""
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
        pagina.wait_for_timeout(1500)
        esito["passo2"] = _passo2(pagina, c)
        esito["passo3"] = _passo3(pagina, c)
        esito["passo4"] = _passo4(pagina, c)
        esito["arrivo"] = _arrivo(pagina, c)
    finally:
        contesto.close()
    esito["errori"] = errori
    if errori:
        esito["errore"] = "errori di console sulla nave"
    else:
        perche = (_errore_passo2(esito["passo2"]) or _errore_passo3(esito["passo3"])
                  or _errore_passo4(esito["passo4"]) or _errore_arrivo(esito["arrivo"]))
        if perche:
            esito["errore"] = perche
    return esito


SCENE_NAVE_PASSI = {"nave_passi": scena_nave_passi}
