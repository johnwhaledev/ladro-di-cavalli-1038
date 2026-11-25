"""collaudo_comandi.py — i comandi del telefono (il menu ☰ dal 14/10), il tasto
della musica, la pagina dei crediti e i riquadri in basso (13-14/10).

Stesse regole di collaudo.py (che la importa in SCENE): misure, non giudizi.
Il telefono in una pagina a parte col tocco acceso (tocco.js): i cinque tasti
nuovi ci sono, e toccati fanno quel che fa la tastiera. La musica (colonna.js)
si spegne e si riaccende col tasto N, nella pagina delle altre scene.
"""

from collaudo_atto2 import CALMA, PRIMA, RIMETTI
from collaudo_atto4 import CHIUDI_PROVA

APERTI = """() => ({ plancia: document.getElementById('plancia').style.display,
  carta: document.getElementById('mapWrap').style.display, arma: __game.player.arma,
  musica: !Colonna.senzaMusica })"""


def _tocca(pagina, sel):
    """Tocca (un tocco vero, touchstart) l'elemento del selettore; poi lo stato."""
    pagina.locator(sel).first.tap()
    pagina.wait_for_timeout(300)
    return pagina.evaluate(APERTI)


def _voce(pagina, inizio):
    """Apre il menu (☰) e tocca la voce che comincia cosi'."""
    _tocca(pagina, "button.tbtn:has-text('☰')")
    return _tocca(pagina, f"#menuTocco button:has-text('{inizio}')")


# i tasti a schermo e il menu, misurati: dentro lo schermo, fuori dalla minimappa
MISURE = r"""() => {
  const W = innerWidth, H = innerHeight, r = e => e.getBoundingClientRect();
  const dentro = q => q.left >= 0 && q.top >= 0 && q.right <= W && q.bottom <= H;
  const su = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const mm = r(document.getElementById('minimap'));
  const tasti = [...document.querySelectorAll('button.tbtn')]
    .filter(b => getComputedStyle(b).display !== 'none');
  return { tasti: tasti.map(b => b.textContent),
           fuori: tasti.filter(b => !dentro(r(b))).map(b => b.textContent),
           sulla_minimappa: tasti.filter(b => su(r(b), mm)).map(b => b.textContent) }; }"""


def _telefono(c, larga, alta):
    contesto = c.page.context.browser.new_context(
        viewport={"width": larga, "height": alta}, has_touch=True)
    pagina = contesto.new_page()
    errori = []
    pagina.on("pageerror", lambda e: errori.append(str(e)))
    pagina.on("console", lambda m: m.type == "error" and errori.append(m.text))
    pagina.goto(c.page.url.split("?")[0], wait_until="load")
    pagina.wait_for_function("() => document.getElementById('loading').textContent === 'pronto'",
                             timeout=60000)
    pagina.evaluate("() => { document.getElementById('title').style.display = 'none'; "
                    "const p = __game.player; p.arsenale = ['spada', 'arco']; "
                    "p.equipaggia('spada'); }")
    pagina.wait_for_timeout(1500)
    return contesto, pagina, errori


def scena_comandi(c):
    """Sul telefono (pagina col tocco; 14/10 riorganizzati: "in orizzontale si
    perdono e sono davvero tanti"): a schermo la manopola, E, ⚔ e un ☰ solo;
    ☰ apre il menu al centro con le voci scritte (Plancia, Carta, Arma,
    Tenda, Musica); Plancia apre la plancia (Chiudi la chiude), Carta la carta (che si
    chiude toccandola), Arma passa all'arco, Musica la spegne e la
    riaccende; toccare fuori chiude il menu. In verticale (412x915) e in
    orizzontale (915x412) i tasti stanno nello schermo e fuori dalla
    minimappa. Da tastiera N fa lo stesso della voce Musica. Foto."""
    esito, guasti = {}, []
    contesto, pagina, errori = _telefono(c, 915, 412)
    try:
        esito["orizzontale"] = pagina.evaluate(MISURE)
        esito["suggerimento"] = pagina.evaluate("() => document.getElementById('hint').textContent")
        _tocca(pagina, "button.tbtn:has-text('☰')")
        esito["menu"] = pagina.evaluate("""() => ({ aperto: Tocco.aperto,
          voci: [...document.querySelectorAll('#menuTocco button')].map(b => b.textContent) })""")
        pagina.screenshot(path=str(c.cartella / "comandi_telefono.png"))
        pagina.locator("#menuTocco").tap(position={"x": 5, "y": 5})   # fuori: si chiude
        pagina.wait_for_timeout(300)
        esito["fuori"] = pagina.evaluate("() => Tocco.aperto")
        # aperta, la plancia copre lo schermo (anche ☰): si chiude col suo Chiudi
        esito["plancia"] = [_voce(pagina, "Plancia")["plancia"],
                            _tocca(pagina, "#planciaClose")["plancia"]]
        esito["carta"] = [_voce(pagina, "Carta")["carta"]]
        pagina.locator("#mapWrap").tap()               # la carta si chiude toccandola
        pagina.wait_for_timeout(300)
        esito["carta"].append(pagina.evaluate(APERTI)["carta"])
        esito["arma"] = _voce(pagina, "Arma")["arma"]
        esito["musica"] = [_voce(pagina, "Musica")["musica"], _voce(pagina, "Musica")["musica"]]
        esito["foto"] = "out/collaudo/comandi_telefono.png"
    finally:
        contesto.close()
    contesto, pagina, errori2 = _telefono(c, 412, 915)
    try:
        esito["verticale"] = pagina.evaluate(MISURE)
    finally:
        contesto.close()
    # da tastiera, nella pagina delle altre scene
    c.page.keyboard.press("KeyN")
    c.page.wait_for_timeout(200)
    spenta = c.js("() => Colonna.senzaMusica")
    c.page.keyboard.press("KeyN")
    c.page.wait_for_timeout(200)
    esito["tasto_n"] = [spenta, c.js("() => Colonna.senzaMusica")]
    for verso in ("orizzontale", "verticale"):
        m = esito[verso]
        if set(m["tasti"]) != {"E", "⚔", "☰"} or m["fuori"] or m["sulla_minimappa"]:
            guasti.append(f"i tasti a schermo in {verso}: {m}")
    if not esito["menu"]["aperto"] or len(esito["menu"]["voci"]) != 5 or esito["fuori"]:
        guasti.append(f"il menu ☰: {esito['menu']}, aperto dopo il tocco fuori: {esito['fuori']}")
    if "☰ comandi" not in esito["suggerimento"]:
        guasti.append(f"il suggerimento parla di tastiera: {esito['suggerimento']!r}")
    if esito["plancia"] != ["flex", "none"] or esito["carta"] != ["flex", "none"]:
        guasti.append(f"plancia {esito['plancia']}, carta {esito['carta']}")
    if esito["arma"] != "arco":
        guasti.append(f"la voce Arma non passa all'arco: {esito['arma']}")
    if esito["musica"] != [False, True] or esito["tasto_n"] != [True, False]:
        guasti.append(f"la musica: menu {esito['musica']}, N {esito['tasto_n']}")
    if errori or errori2:
        guasti.append(f"errori nella pagina: {(errori + errori2)[:3]}")
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


def scena_crediti(c):
    """La pagina dei crediti (crediti.js) nella schermata iniziale, in una
    pagina a parte col titolo in vista: nella barra in fondo c'e' CREDITI; il
    clic apre la pagina e il gioco non parte; un clic la chiude e si resta al
    titolo. Foto della pagina."""
    contesto = c.page.context.browser.new_context(viewport={"width": 1280, "height": 720})
    pagina = contesto.new_page()
    errori = []
    pagina.on("pageerror", lambda e: errori.append(str(e)))
    esito, guasti = {}, []
    stato = """() => ({ link: !!document.getElementById('linkCrediti'),
      crediti: !!document.getElementById('crediti') &&
               getComputedStyle(document.getElementById('crediti')).display !== 'none',
      titolo: getComputedStyle(document.getElementById('title')).display !== 'none',
      righe: Crediti.VOCI.reduce((s, [, r]) => s + r.length, 0) })"""
    try:
        pagina.goto(c.page.url.split("?")[0], wait_until="load")
        pagina.wait_for_function("() => document.getElementById('loading').textContent === 'pronto'",
                                 timeout=60000)
        pagina.wait_for_timeout(800)
        esito["prima"] = pagina.evaluate(stato)
        pagina.locator("#linkCrediti").click()
        pagina.wait_for_timeout(400)
        esito["aperti"] = pagina.evaluate(stato)
        pagina.screenshot(path=str(c.cartella / "crediti.png"))
        esito["foto"] = "out/collaudo/crediti.png"
        pagina.locator("#crediti").click()
        pagina.wait_for_timeout(400)
        esito["chiusi"] = pagina.evaluate(stato)
    finally:
        contesto.close()
    p, a, z = esito["prima"], esito["aperti"], esito["chiusi"]
    if not p["link"] or not a["crediti"] or not a["titolo"] or a["righe"] < 10:
        guasti.append(f"i crediti non si aprono sopra il titolo: {a}")
    if z["crediti"] or not z["titolo"]:
        guasti.append(f"chiusi i crediti non si torna al titolo: {z}")
    if errori:
        guasti.append(f"errori nella pagina: {errori[:3]}")
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


# un dialogo lungo, il tasto e la barra accesi insieme: i riquadri e quanto
# si sovrappongono (nello stesso giro: l'HUD li riscrive al fotogramma dopo)
SOVRAPPOSTI = r"""() => {
  const msg = document.getElementById('msg'), pr = document.getElementById('prompt');
  const cq = document.getElementById('conquista');
  msg.textContent = 'Il mercante ti gira intorno come a un cammello alla fiera. Quaranta dinari. '
    + 'Il pirata giurava che sei svelto di mano. Vediamo se lo sei anche per me. Non manca '
    + 'niente. Un ladro che non ruba: o sei furbo, o sei stanco. Domani parti con la carovana.';
  msg.style.opacity = 1;
  pr.textContent = 'E — parla con il mercante'; pr.style.display = 'block';
  cq.style.display = 'block';
  const r = e => e.getBoundingClientRect();
  const su = (a, b) => Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) *
    Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const [m, p, c] = [r(msg), r(pr), r(cq)];
  return { righe: Math.round(m.height / 19), msg_prompt: su(m, p), prompt_barra: su(p, c),
           msg_barra: su(m, c), in_vista: c.top > 0 }; }"""


def scena_hud_basso(c):
    """In basso il dialogo, il tasto ("E — ...") e la barra stanno in colonna
    (index.html, #basso; 14/10, tua segnalazione: i dialoghi lunghi finivano
    sotto il tasto): con un dialogo di quattro righe, il tasto e la barra
    accesi, nessuno copre l'altro e la barra resta nello schermo. Foto."""
    esito = c.js(SOVRAPPOSTI)
    esito["foto"] = c.foto("hud_basso")
    coperti = esito["msg_prompt"] or esito["prompt_barra"] or esito["msg_barra"]
    if esito["righe"] < 3 or coperti or not esito["in_vista"]:
        esito["errore"] = f"in basso i riquadri si coprono: {esito}"
    return esito


# la riga del volume nella plancia e quel che comanda
VOLUME = """() => { const r = document.getElementById('planciaVolume');
  const i = r && r.querySelector('input'), b = r && r.querySelector('button');
  return { riga: !!r, cursore: i ? +i.value : null, bottone: b ? b.textContent : null,
           colonna: Colonna.volume, effetti: Sfx.volume, musica: !Colonna.senzaMusica,
           salvato: localStorage.getItem('ladro1038_volume'),
           plancia: getComputedStyle(document.getElementById('plancia')).display }; }"""


def scena_volume(c):
    """Il volume nella plancia (volume.js; 14/10, tua scelta: "ok volume in
    plancia"): aperta la plancia (Tab), sotto la testata la riga Volume col
    cursore e il bottone della musica; il cursore a 40 porta musica, ambienti
    ed effetti a 0,4 e resta nel browser; il bottone spegne la musica come il
    tasto N, e N la riaccende e la scritta lo segue. Poi il volume torna
    com'era. Foto della plancia."""
    esito, guasti = {}, []
    prima = c.js("() => Volume.valore")
    c.page.keyboard.press("Tab")
    c.page.wait_for_timeout(400)
    esito["aperta"] = c.js(VOLUME)
    c.js("() => { const i = document.querySelector('#planciaVolume input'); "
         "i.value = 40; i.dispatchEvent(new Event('input')); }")
    esito["a_40"] = c.js(VOLUME)
    esito["foto"] = c.foto("volume_plancia")
    c.page.locator("#planciaVolume button").click()
    c.page.wait_for_timeout(200)
    esito["bottone"] = c.js(VOLUME)
    c.page.keyboard.press("KeyN")
    c.page.wait_for_timeout(200)
    esito["tasto_n"] = c.js(VOLUME)
    c.js("(v) => Volume.imposta(v)", prima)
    c.js("() => Hud.closeAll()")
    a, q, b, n = esito["aperta"], esito["a_40"], esito["bottone"], esito["tasto_n"]
    if not a["riga"] or a["plancia"] == "none" or not (a["bottone"] or "").startswith("Musica: "):
        guasti.append(f"nella plancia la riga del volume: {a}")
    if (q["cursore"], q["colonna"], q["effetti"], q["salvato"]) != (40, 0.4, 0.4, "0.4"):
        guasti.append(f"il cursore a 40: {q}")
    scritta = {True: "Musica: sì", False: "Musica: no"}
    if b["musica"] == a["musica"] or b["bottone"] != scritta[b["musica"]]:
        guasti.append(f"il bottone della musica: prima {a}, dopo {b}")
    if n["musica"] != a["musica"] or n["bottone"] != scritta[n["musica"]]:
        guasti.append(f"il tasto N dopo il bottone: {n}")
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


# il furto del carro (missioni_carro.js, 14/10): l'incarico in corso e il suo carro
CARRO = r"""() => { const g = __game, a = g.campagna.attiva, p = g.player;
  if (!a) return { attiva: false, cap: g.campagna.cap, miss: g.campagna.miss };
  const v = a.carro, d = (q, r) => +Math.hypot(q.x - r.x, q.z - r.z).toFixed(1);
  const capo = g.world.spawns.givers.find(u => u.name === Storia.committente('briganti'));
  return { attiva: true, tipo: a.tipo, cap: g.campagna.cap, miss: g.campagna.miss,
           carro: v && { nome: v.name, carrettiere: !!v.rider && v.rider !== p,
                         missione: !!v.missione, dista: d(v, p), nel_mondo: g.vehicles.includes(v) },
           meta_dal_carro: v && d(v, a.meta), meta_dal_capo: capo ? d(capo, a.meta) : null,
           stella_sul_carro: !!v && d(a.goal, v) < 0.5, sopra: !!v && p.vehicle === v,
           msg: document.getElementById('msg').textContent }; }"""

# davanti al carro dell'incarico, a due passi dal muso: poi E
DAVANTI = """() => { const g = __game, v = g.campagna.attiva.carro, p = g.player;
  const f = Math.sign(v.speed || 1);
  p.x = v.x + Math.cos(v.rot) * 2.2 * f; p.z = v.z + Math.sin(v.rot) * 2.2 * f;
  p.vx = p.vz = 0; g.cam.x = p.x; g.cam.z = p.z; }"""

# il ladro e un mezzo insieme sulla meta: 'suo' (il carro dell'incarico, gia'
# guidato) o 'altro' (un cavallo qualunque)
SULLA_META = """(quale) => { const g = __game, a = g.campagna.attiva, p = g.player;
  const v = quale === 'suo' ? a.carro
    : g.vehicles.find(q => q !== a.carro && !q.rider && q.type === 'cavallo' && !q.rotto);
  if (!v) return null;
  if (p.vehicle && p.vehicle !== v) { p.vehicle.rider = null; p.scendi(); }
  v.x = a.meta.x; v.z = a.meta.z + 1; v.speed = 0;
  p.x = v.x; p.z = v.z; v.rider = p; p.sali(v); g.cam.x = p.x; g.cam.z = p.z;
  return v.name; }"""

# accanto al carro dell'incarico, per la foto
ACCANTO = """() => { const v = __game.campagna.attiva.carro, p = __game.player;
  p.x = v.x + 7; p.z = v.z + 5; __game.cam.x = p.x; __game.cam.z = p.z; }"""

SCENDI = "() => { const p = __game.player; if (p.vehicle) { p.vehicle.rider = null; p.scendi(); } }"


def _prendi(c):
    """Davanti al carro dell'incarico, E: lo prendi (rubandolo, se ha il carrettiere)."""
    c.js(DAVANTI)
    c.page.wait_for_timeout(250)
    c.page.keyboard.press("e")
    c.page.wait_for_timeout(400)
    return c.js(CARRO)


def _carro_fermo(c, esito, guasti):
    """Atto I, capitolo 1, passo 3: il carro fermo; un cavallo non vale; il carro si'."""
    c.js("() => __game.debug.missione(0, 2)")
    c.page.wait_for_timeout(500)
    f = esito["fermo"] = c.js(CARRO)
    if (f.get("tipo") != "furto_mezzo" or not f.get("carro") or f["carro"]["carrettiere"]
            or not f["stella_sul_carro"] or f["carro"]["dista"] < 30):
        guasti.append(f"il carro fermo: {f}")
        return
    c.js(ACCANTO)
    c.page.wait_for_timeout(1200)
    esito["foto"].append(c.foto("carro_fermo"))
    esito["altro_sulla_meta"] = c.js(SULLA_META, "altro")
    c.page.wait_for_timeout(600)
    n = esito["con_un_cavallo"] = c.js(CARRO)
    if not n["attiva"] or "Non questo" not in n["msg"]:
        guasti.append(f"un cavallo sulla meta chiude il passo: {n}")
    c.js(SCENDI)
    s = esito["preso"] = _prendi(c)
    if not s.get("sopra"):
        guasti.append(f"il carro fermo non si prende con E: {s}")
    c.js(SULLA_META, "suo")
    c.page.wait_for_timeout(600)
    d = esito["sulla_meta"] = c.js(CARRO)
    if d["attiva"] and d.get("tipo") == "furto_mezzo":
        guasti.append(f"il carro sulla meta non chiude il passo: {d}")


def _carro_in_viaggio(c, esito, guasti):
    """Atto I, capitolo 4, passo 2: il carro col carrettiere; la meta dal Capo."""
    c.js("() => __game.debug.missione(3, 1)")
    c.page.wait_for_timeout(500)
    t = esito["in_viaggio"] = c.js(CARRO)
    if (t.get("tipo") != "furto_mezzo" or not t.get("carro") or not t["carro"]["carrettiere"]
            or (t["meta_dal_capo"] or 99) > 6):
        guasti.append(f"il carro in viaggio: {t}")
        return
    c.js(ACCANTO)
    c.page.wait_for_timeout(900)
    esito["foto"].append(c.foto("carro_in_viaggio"))
    r = esito["rubato"] = _prendi(c)
    if not r.get("sopra") or r["carro"]["carrettiere"]:
        guasti.append(f"il carro in viaggio non si ruba con E: {r}")
    c.js(SULLA_META, "suo")
    c.page.wait_for_timeout(600)
    d = esito["al_campo"] = c.js(CARRO)
    if d["attiva"] and d.get("tipo") == "furto_mezzo":
        guasti.append(f"il carro al campo non chiude il passo: {d}")


def scena_carro(c):
    """Il furto del carro con un carro vero (missioni_carro.js; 14/10, tua
    segnalazione: "dice prendi il carro ma non c'e' niente"). Atto I, capitolo
    1: il carro fermo e senza nessuno, col segno e la stella sopra; un cavallo
    portato sulla meta non vale ("Non questo"); preso il carro (E) e portato
    sulla meta, il passo si chiude. Capitolo 4: il carro in viaggio col
    carrettiere, la meta al campo davanti al Capo dei fuorilegge; E lo ruba
    (il carrettiere a terra) e sulla meta il passo si chiude. Foto dei due
    carri col segno. Poi tutto com'era."""
    c.js(PRIMA)
    c.js(CHIUDI_PROVA)
    c.js("() => { __game.player.hp = 1e6; }")
    esito, guasti = {"foto": []}, []
    _carro_fermo(c, esito, guasti)
    c.js(CHIUDI_PROVA)
    c.js(SCENDI)
    c.tp(c.js("() => __collaudo.piazza()"), 1.0)
    _carro_in_viaggio(c, esito, guasti)
    c.js(CHIUDI_PROVA)
    c.js(RIMETTI)
    c.js(CALMA)
    c.tp(c.js("() => __collaudo.piazza()"), 1.0)
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


def scena_discorsi(c):
    """I discorsi da rileggere (discorsi.js; 14/10, tua richiesta): nella
    plancia la scheda "Discorsi"; un incarico avviato e una scena di prova
    finiscono nella lista, la piu' recente in alto. Foto."""
    c.js(PRIMA)
    esito, guasti = {}, []
    esito["scheda"] = c.js("() => [...document.querySelectorAll('#planciaTabs .tab')]"
                           ".map(b => b.textContent)")
    c.js("() => __game.debug.missione(0, 0)")
    c.page.wait_for_timeout(800)
    testo = c.js("() => __game.campagna.attiva && __game.campagna.attiva.testo")
    c.js(CHIUDI_PROVA)
    c.js("() => { __game.debug.scena('prova'); }")   # senza aspettarne la fine: si chiude con E
    c.page.wait_for_timeout(900)
    c.page.keyboard.press("KeyE")
    c.page.wait_for_timeout(700)
    c.page.keyboard.press("KeyE")
    c.page.wait_for_timeout(900)
    c.page.keyboard.press("Tab")
    c.page.wait_for_timeout(300)
    c.page.locator("#planciaTabs .tab[data-tab='discorsi']").click()
    c.page.wait_for_timeout(500)
    esito["lista"] = c.js("() => [...document.querySelectorAll('#planciaBody .card p:last-child')]"
                          ".map(p => p.textContent).slice(0, 6)")
    esito["foto"] = c.foto("discorsi")
    c.js("() => Hud.closeAll()")
    c.js(RIMETTI)
    righe = " | ".join(esito["lista"])
    if "Discorsi" not in esito["scheda"]:
        guasti.append(f"nella plancia non c'e' la scheda: {esito['scheda']}")
    if not testo or testo not in righe or "scena di passaggio di prova" not in righe:
        guasti.append(f"nella lista mancano l'incarico o la scena: {esito['lista']}")
    elif righe.index("scena di passaggio") > righe.index(testo):
        guasti.append("la riga piu' recente non e' in alto")
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


# la barca del ladro: gli sbuffi di prua e di poppa che ci sono ora
SBUFFI = """() => { const v = __game.player.vehicle; const s = (v && v.scia) || [];
  return { prua: s.filter(q => q.prua).length, poppa: s.filter(q => !q.prua).length,
           velocita: v ? +Math.abs(v.speed).toFixed(1) : null }; }"""


def scena_barche(c):
    """La scia delle barche di citta' (scia.js; 14/10, tua nota: "la coda si',
    la punta no, e c'e' un effetto stagnante"): ferma, niente onda di prua ne'
    scia; in corsa l'onda di prua (sbuffi a V sui fianchi) e la scia a poppa;
    ferma di nuovo, l'onda sparisce. Sotto lo scafo un bordino, non la pozza.
    Foto ferma e in corsa."""
    esito, guasti = {}, []
    b = c.js("() => { const b = __game.vehicles.find(v => v.type === 'barca'); "
             "if (!b) return null; const m = __game.world.moli.filter((q, i) => i % 2)"
             ".sort((p, q) => Math.hypot(p.x0 - b.x, p.z0 - b.z) - "
             "Math.hypot(q.x0 - b.x, q.z0 - b.z))[0]; "
             "return {x: (m.x0 + m.x1) / 2, z: (m.z0 + m.z1) / 2}; }")
    if not b:
        return {"errore": "nessuna barca nel porto"}
    c.js("() => { __game.player.hp = 1e6; }")
    c.tp(b, 2.0)
    c.page.keyboard.press("e")
    c.page.wait_for_timeout(1500)
    esito["ferma"] = c.js(SBUFFI)
    esito["foto"] = [c.foto("barca_ferma")]
    sud = c.js("() => __game.world.pianta.LATO_ACQUA === 'S'")
    lungo = "ArrowLeft" if sud else "ArrowUp"
    c.page.keyboard.down(lungo)
    c.page.wait_for_timeout(2200)
    esito["in_corsa"] = c.js(SBUFFI)
    esito["foto"].append(c.foto("barca_in_corsa"))
    c.page.keyboard.up(lungo)
    c.page.wait_for_timeout(3500)
    esito["di_nuovo_ferma"] = c.js(SBUFFI)
    c.js(SCENDI)
    c.js("() => { const p = __game.player; p.hp = p.maxHp; }")
    c.tp(c.js("() => __collaudo.piazza()"), 1.0)
    f, k, n = esito["ferma"], esito["in_corsa"], esito["di_nuovo_ferma"]
    if f["velocita"] is None or f["prua"] or f["poppa"]:
        guasti.append(f"ferma ha gia' schiuma o non e' a bordo: {f}")
    if k["prua"] < 4 or k["poppa"] < 4:
        guasti.append(f"in corsa manca l'onda di prua o la scia: {k}")
    if n["prua"]:
        guasti.append(f"ferma di nuovo resta l'onda di prua: {n}")
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


SCENE_COMANDI = {"comandi": scena_comandi, "crediti": scena_crediti, "hud_basso": scena_hud_basso,
                 "volume": scena_volume, "carro_incarico": scena_carro, "discorsi": scena_discorsi,
                 "barche": scena_barche}
