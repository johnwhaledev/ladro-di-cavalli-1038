"""collaudo_atto4.py — l'atto IV alla Costa saracena, giocato (13/10).

I cinque capitoli dell'atto IV (storia_costa.js) coi committenti ai loro
posti: il mercante nello slargo del pozzo, l'emiro nel suo palazzo (ci si
entra); l'incarico parte col tipo e il luogo giusti e lo si chiude col gancio
di collaudo. Poi la carovana giocata davvero fino all'oasi, coi predoni per
strada; la corsa in cammello; il finale: la scena "La rotta di casa" e il
passaggio all'atto V, a Valdarno. Stesse regole di collaudo.py (che la
importa in SCENE); gli aiuti sono quelli dell'atto II (collaudo_atto2.py).
"""

from collaudo_atto2 import CALMA, INCARICO, PRIMA, RIMETTI, _parla

COSTA = "costa-5"

# quel che INCARICO non misura: la carovana, la sella del mezzo della gara,
# la zona della consegna
IN_PIU = r"""() => { const m = __game.campagna.attiva, w = __game.world;
  if (!m) return {};
  const zona = q => q ? w.district[w.idx(Math.floor(q.x / TILE), Math.floor(q.z / TILE))] : null;
  const d = (a, b) => +Math.hypot(a.x - b.x, a.z - b.z).toFixed(1);
  return { sella: m.mezzoGara ? m.mezzoGara.sella || null : null,
           dal_molo: m.tipo === 'colpo' && m.goal ? d(m.goal, Missioni.luogo('molo')) : null,
           zona_goal: m.goal ? zona(m.goal) : null,
           carovana: m.cammellieri ? { cammellieri: m.cammellieri.length,
             cammelli: m.cammelli.map(b => b.sprite),
             dal_caravanserraglio: d(m.partenza, Missioni.luogo('caravanserraglio')),
             all_oasi: d(m.meta, Missioni.luogo('oasi')) } : null }; }"""

# vicino a dove succede (senza debug.tp, che svuota la gente dell'incarico)
VICINO = r"""() => { const m = __game.campagna.attiva, p = __game.player;
  const q = m.partenza && m.cammellieri ? { x: m.partenza.x, z: m.partenza.z + 4 }
    : m.mezzoGara ? { x: m.mezzoGara.x, z: m.mezzoGara.z + 3 }
    : m.porta_ ? { x: m.porta_.x - m.fuori[0] * 18, z: m.porta_.z - m.fuori[1] * 18 }
    : m.goal ? { x: m.goal.x, z: m.goal.z + 3 } : null;
  if (q) { p.x = q.x; p.z = q.z; p.vx = p.vz = 0; }
  return !!q; }"""

# committente, e per passo il tipo e cosa misurare; il passo da fotografare
# (mai una consegna: portato alla meta, il ladro la chiuderebbe da solo)
ATTESI = [
    ("mercante", [("consegna", "mercato"), ("riscossione", None),
                  ("consegna", "caravanserraglio")], 1),
    ("mercante", [("carovana", None), ("caccia", "campo"), ("consegna", "piazza")], 0),
    ("mercante", [("consegna", "oasi"), ("caccia", None), ("gara", "cammello")], 2),
    ("emiro", [("colpo", "molo"), ("furto", None), ("consegna", "sala")], 0),
    # la difesa alla porta di terra (la sola: quella del porto e' un approdo)
    ("emiro", [("difesa", "S3"), ("caccia", "campo"), ("consegna", None)], 0),
]
ZONA_MERCATO = 3        # world.js, D.MERCATO: il suk

# una missione di prova rimasta aperta (una scena caduta a meta') sospende la
# storia e la rimetterebbe com'era alla chiusura: si chiude prima e dopo
CHIUDI_PROVA = """() => { const m = __game.campagna.attiva;
  if (m) { Missioni.chiudi(m); __game.campagna.attiva = null; }
  if (Storia.inProva()) Storia.fineProva('collaudo'); }"""


def _guasti_passo(k, n, atteso, misura):
    """Cosa non va in un incarico appena partito, rispetto alla bozza."""
    tipo, cosa = atteso
    dove = f"cap {k + 1} passo {n + 1}"
    if misura["tipo"] != tipo:
        return [f"{dove}: tipo {misura['tipo']} invece di {tipo} ({misura.get('msg')!r})"]
    g = []
    if misura["goal_bloccato"] and tipo not in ("gara", "furto"):
        g.append(f"{dove}: la meta sta dentro un ostacolo")
    if tipo == "consegna" and cosa == "mercato" and misura["zona_goal"] != ZONA_MERCATO:
        g.append(f"{dove}: la consegna non e' nel suk (zona {misura['zona_goal']})")
    elif tipo == "consegna" and cosa not in (None, "mercato") and (
            misura["dal_luogo"] is None or misura["dal_luogo"] > 6):
        g.append(f"{dove}: la consegna non e' a {cosa} ({misura['dal_luogo']})")
    if tipo == "colpo" and cosa == "molo" and (misura["dal_molo"] is None or misura["dal_molo"] > 2):
        g.append(f"{dove}: il colpo non e' sul molo ({misura['dal_molo']})")
    if tipo == "difesa" and (misura["porta"], misura["ondate"]) != (cosa[0], int(cosa[1])):
        g.append(f"{dove}: difesa alla porta {misura['porta']}, {misura['ondate']} ondate")
    if tipo == "caccia":
        b = misura["bersaglio"] or {}
        # alla Costa i briganti sono i pirati (pianta_costa.js, CAST)
        if not str(b.get("sprite", "")).startswith("Pir"):
            g.append(f"{dove}: il bersaglio non e' un pirata: {b}")
        if cosa == "campo" and b.get("dal_luogo", 99) > 16:
            g.append(f"{dove}: il bersaglio non e' al campo: {b}")
    if tipo == "gara" and (misura["sella"] not in ("ladro_cammello", "ladro_dromedario")
                           or (misura["tappe"] or 0) < 3):
        g.append(f"{dove}: gara su {misura['sella']} con {misura['tappe']} tappe")
    k_ = misura.get("carovana")
    if tipo == "carovana" and (not k_ or k_["cammellieri"] != 3 or len(k_["cammelli"]) != 3
                               or k_["dal_caravanserraglio"] > 4 or k_["all_oasi"] > 4):
        g.append(f"{dove}: la carovana non e' quella della bozza: {k_}")
    return g


def _alla_costa(c, cap=0, miss=0):
    """La storia all'atto IV prima di partire: i nomi dei committenti del
    mondo si scrivono quando nasce (il mercante della Costa non e' Aldo)."""
    c.js(PRIMA)
    c.js(CHIUDI_PROVA)
    c.js(f"""() => {{ const s = Storia.stato;
      Object.assign(s, {{ atto: 3, cap: {cap}, miss: {miss}, finita: false, attiva: null }});
      s.segni = ['taglia del Ciambellano']; __game.player.money = 0; }}""")
    c.js(f"() => __game.debug.citta('{COSTA}')")
    c.page.wait_for_timeout(3500)
    c.js("() => { Meteo.fissa(true); Meteo.imposta('sereno'); __game.debug.setDay(0.4); }")


def _a_valdarno(c, esito, guasti):
    c.js(CHIUDI_PROVA)
    c.js(RIMETTI)
    c.js("() => __game.debug.citta('valdarno')")
    c.page.wait_for_timeout(3000)
    esito["firma"] = c.js("() => __collaudo.firma()")["hash"]
    c.tp(c.js("() => __collaudo.piazza()"), 1.0)
    if esito["firma"] != c.firma0:
        guasti.append(f"Valdarno al ritorno ha firma {esito['firma']}")


def scena_atto4(c):
    """L'atto IV capitolo per capitolo, nella costa 5: per ogni passo si va dal
    committente (il mercante nello slargo, l'emiro nel palazzo) e si preme E;
    l'incarico ha il tipo, il luogo e la gente della bozza (le consegne nel
    suk, al caravanserraglio, all'oasi, alla sala; la carovana di tre
    cammellieri coi cammelli; i pirati come bersagli, al campo; la corsa in
    cammello; la difesa alla porta di terra con tre ondate); si chiude col
    gancio. A fine capitolo il premio, la sciabola dopo il capitolo 4. Nel
    palazzo dal capitolo 4 niente taglia. Una foto per capitolo."""
    _alla_costa(c)
    esito = {"capitoli": [], "foto": []}
    guasti = []
    for k, (chiave, passi, da_foto) in enumerate(ATTESI):
        cap = {"committente": chiave, "passi": []}
        soldi0 = c.js("() => __game.player.money")
        cap["obiettivo"] = c.js("() => document.getElementById('objective').textContent")
        for n, atteso in enumerate(passi):
            subito = c.js(f"() => !!Storia.campagna().capitoli[{k}].missioni[{n}].subito")
            parla = {"subito": True, "trovato": True} if subito else _parla(c, chiave)
            c.page.wait_for_timeout(300)
            misura = {**c.js(INCARICO), **c.js(IN_PIU), "parla": parla}
            cap["passi"].append(misura)
            guasti += _guasti_passo(k, n, atteso, misura)
            if not parla.get("trovato"):
                guasti.append(f"cap {k + 1}: il committente {chiave} non c'e'")
            if k == 3 and n == 0:
                cap["stelle_dopo_il_palazzo"] = c.js("() => __game.player.stars")
            if n == da_foto and misura["tipo"]:
                if c.js(VICINO):
                    c.page.wait_for_timeout(2500)
                esito["foto"].append(c.foto(f"atto4_cap{k + 1}_{misura['tipo']}"))
            # l'ultimo passo del capitolo 5 no: farebbe partire il finale
            if misura["tipo"] and (k, n) != (4, 2):
                c.tp(c.js("() => __collaudo.piazza()"), 0.5)
                # prima si chiude l'incarico, poi si azzera la taglia: senza
                # stelle una fuga si chiude da sola, e il gancio chiuderebbe
                # anche il passo dopo (collaudo 44)
                c.js("() => __game.debug.avanza()")
                c.js(CALMA)
                c.page.wait_for_timeout(400)
            if (k, n) == (0, 0):
                # si salva a ogni passo (14/10): il salvataggio e' gia' al passo dopo
                esito["salvato_al_passo"] = c.js("() => { const s = Salvataggio.leggiLocale(); "
                                                 "return s && [s.capitolo, s.missione]; }")
        if k == 1:
            # la tenda persa in catene torna dal mercante, finita la carovana
            esito["tenda"] = c.js("() => Tenda.perSalvare().posseduta")
        cap["soldi"] = c.js("() => __game.player.money") - soldi0
        cap["chiusura"] = c.js("() => document.getElementById('msg').textContent")
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
        if k == 3:
            esito["arsenale"] = c.js("() => [...__game.player.arsenale]")
            if "sciabola_emiro" not in esito["arsenale"]:
                guasti.append(f"dopo il capitolo 4 niente sciabola: {esito['arsenale']}")
            # la sciabola d'oro dell'emiro (14/10): in mano, il suo sprite beige
            esito["sciabola"] = c.js("() => { const p = __game.player, prima = p.arma; "
                                     "p.equipaggia('sciabola_emiro'); const s = p.sprite; "
                                     "p.equipaggia(prima); return s; }")
            if esito["sciabola"] != "ladro_sciabola_emiro@beige":
                guasti.append(f"la sciabola dell'emiro in mano: {esito['sciabola']}")
        if cap.get("stelle_dopo_il_palazzo"):
            guasti.append("cap 4: nel palazzo dell'emiro si prende la taglia")
    esito["fps"] = c.fps()
    c.js("() => { const m = __game.campagna.attiva; Missioni.chiudi(m); __game.campagna.attiva = null; }")
    if esito.get("tenda") is not True:
        guasti.append(f"finita la carovana niente tenda: {esito.get('tenda')}")
    if esito.get("salvato_al_passo") != [0, 1]:
        guasti.append(f"il salvataggio a ogni passo: {esito.get('salvato_al_passo')}")
    _a_valdarno(c, esito, guasti)
    if esito["fps"] < 30:
        guasti.append(f"fps {esito['fps']}")
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


# la carovana in prova: la strada di nav.js dalla partenza all'oasi, e il
# ladro che la percorre (5 unita' al secondo: chi segue corre a 7,2)
STRADA = r"""() => { const m = __game.campagna.attiva, w = __game.world;
  const via = Nav.percorso(w, m.partenza.x, m.partenza.z, m.meta.x, m.meta.z) || [m.meta];
  return [{ x: m.partenza.x, z: m.partenza.z }, ...via.map(q => ({ x: q.x, z: q.z }))]; }"""

PASSO = r"""([x, z]) => { const g = __game, p = g.player, m = g.campagna.attiva;
  p.x = x; p.z = z; p.vx = p.vz = 0; p.hp = 1e6;
  // i predoni appena nati: chi puntano, poi a terra (lo spadone del collaudo)
  const nuovi = g.nemici.filter(e => e.missione && !e.dead && !e.contato);
  const punta = nuovi.filter(e => e.bersaglioCorrente).map(e => e.bersaglioCorrente === p ? 'ladro'
    : (e.bersaglioCorrente.cammello ? 'cammello' : 'cammelliere'));
  for (const e of nuovi) if ((e.natoT = (e.natoT || 0) + 1) > 6) {
    e.contato = true; g.debug.colpisci(e, { danno: [999, 999] }); }
  return { ondata: m ? m.ondata : null, fatto: m ? +(m.fatto || 0).toFixed(2) : null,
           predoni: g.nemici.filter(e => e.missione).length, punta,
           attiva: !!m, prova: Storia.ultimaProva }; }"""


# dove sta la fila, quando la prova non si chiude: distanza dall'oasi e stato
FILA = r"""() => { const m = __game.campagna.attiva;
  if (!m || !m.cammellieri) return null;
  return [...m.cammellieri, ...m.cammelli].map(n => ({ sprite: n.sprite, morto: n.dead,
    d: +Math.hypot(n.x - m.meta.x, n.z - m.meta.z).toFixed(1), stato: n.state,
    segue: !!n.segue })); }"""


def _incastro(c):
    """La tua prova del 13/10 ("98%, non arrivano mai"): di nuovo la prova
    n. 11, la fila gia' all'oasi dietro al ladro ma un cammello incastrato a
    40 dall'acqua, fermo. Dopo 2 s non e' ancora fatta; dopo 8 (l'attesa e'
    6) si'."""
    c.js(CALMA)
    c.js("() => __game.debug.prova(11)")
    c.page.wait_for_timeout(300)
    c.js("""() => { const m = __game.campagna.attiva, p = __game.player;
      p.x = m.partenza.x; p.z = m.partenza.z; }""")
    c.page.wait_for_timeout(600)
    c.js("""() => { const m = __game.campagna.attiva, p = __game.player;
      p.x = m.meta.x; p.z = m.meta.z; p.hp = 1e6;
      [...m.cammellieri, ...m.cammelli].forEach((n, i) => {
        const q = Missioni.libero(m.meta.x - 4 - i * 3, m.meta.z + 2); n.x = q.x; n.z = q.z; });
      const b = m.cammelli[2], q = Missioni.libero(m.meta.x - 40, m.meta.z);
      b.x = q.x; b.z = q.z; b.segue = null; b.fisso = true; }""")
    esito = {}
    c.page.wait_for_timeout(2000)
    esito["dopo_2s"] = c.js("() => __game.campagna.attiva ? null : Storia.ultimaProva")
    c.page.wait_for_timeout(6000)
    esito["dopo_8s"] = c.js("() => __game.campagna.attiva ? null : Storia.ultimaProva")
    return esito


def scena_atto4_carovana(c):
    """La carovana (missioni_costa.js) giocata: la prova n. 11 alla Costa; al
    caravanserraglio tre cammellieri coi loro cammelli; ci si avvicina e si
    parte; il ladro va all'oasi per la strada di nav.js e la fila gli viene
    dietro; a un terzo e a due terzi i predoni (tre per volta, pirati)
    sbucano e puntano qualcuno della carovana o il ladro, poi cadono; arrivati
    tutti all'oasi la prova riesce. Foto della partenza e dell'assalto."""
    _alla_costa(c)
    c.js(CALMA)
    esito = {"prova": c.js("() => __game.debug.prova(11)")}
    c.page.wait_for_timeout(300)
    esito["incarico"] = {**c.js(INCARICO), **c.js(IN_PIU)}
    strada = c.js(STRADA)
    esito["foto"] = []
    visti, assalto = [], None
    for i in range(1, len(strada)):
        a, b = strada[i - 1], strada[i]
        lungo = ((b["x"] - a["x"]) ** 2 + (b["z"] - a["z"]) ** 2) ** 0.5
        passi = max(1, int(lungo / 1.25))
        for s in range(1, passi + 1):
            t = s / passi
            r = c.js(PASSO, [a["x"] + (b["x"] - a["x"]) * t, a["z"] + (b["z"] - a["z"]) * t])
            c.page.wait_for_timeout(250)
            visti.append(r)
            if r["punta"] and not assalto:
                assalto = r
                esito["foto"].append(c.foto("atto4_carovana_predoni"))
            if i == 1 and s == min(passi, 12):
                esito["foto"].append(c.foto("atto4_carovana_in_marcia"))
    for _ in range(40):                 # la fila arriva all'oasi dietro al ladro
        r = c.js(PASSO, [strada[-1]["x"], strada[-1]["z"]])
        visti.append(r)
        if not r["attiva"]:
            break
        c.page.wait_for_timeout(500)
    esito["fine"] = visti[-1]
    esito["fila"] = c.js(FILA)
    esito["incastro"] = _incastro(c)
    esito["ondate"] = max(v["ondata"] or 0 for v in visti)
    esito["predoni"] = max(v["predoni"] for v in visti)
    esito["assalto"] = assalto
    esito["fps"] = c.fps()
    guasti = []
    k = esito["incarico"].get("carovana") or {}
    if esito["incarico"]["tipo"] != "carovana" or k.get("cammellieri") != 3:
        guasti.append(f"la carovana non parte: {esito['incarico']}")
    if esito["ondate"] != 2 or esito["predoni"] < 6 or not assalto:
        guasti.append(f"predoni: {esito['ondate']} ondate, {esito['predoni']}, assalto {assalto}")
    if esito["fine"]["prova"] != "riuscita":
        guasti.append(f"la carovana non arriva all'oasi: {esito['fine']}")
    k = esito["incastro"]
    if k["dopo_2s"] is not None or k["dopo_8s"] != "riuscita":
        guasti.append(f"con un cammello incastrato la carovana non si chiude: {k}")
    _a_valdarno(c, esito, guasti)
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


def scena_atto4_corsa(c):
    """La corsa in cammello (missioni_luoghi.js, gara): la prova n. 12 alla
    Costa; il mezzo e' un cammello o un dromedario a due passi; E: in sella il
    ladro e' ladro_cammello (o dromedario) beige; alla partenza il tre-due-uno
    e la corsa, col rivale sul dromedario. Foto della corsa."""
    _alla_costa(c)
    c.js(CALMA)
    esito = {"prova": c.js("() => __game.debug.prova(12)")}
    c.page.wait_for_timeout(300)
    esito["incarico"] = {**c.js(INCARICO), **c.js(IN_PIU)}
    esito["distanza"] = c.js("() => { const m = __game.campagna.attiva, p = __game.player; "
                             "return +Math.hypot(m.mezzoGara.x - p.x, m.mezzoGara.z - p.z).toFixed(1); }")
    c.js("() => { const v = __game.campagna.attiva.mezzoGara, p = __game.player; "
         "p.x = v.x + 1.2; p.z = v.z + 0.8; p.vx = p.vz = 0; }")
    c.page.wait_for_timeout(400)
    c.page.keyboard.press("KeyE")
    c.page.wait_for_timeout(500)
    esito["sprite"] = c.js("() => __game.player.sprite")
    c.js("() => { const m = __game.campagna.attiva, p = __game.player, v = p.vehicle; "
         "if (v) { v.x = m.partenza.x; v.z = m.partenza.z; p.x = v.x; p.z = v.z; } }")
    c.page.wait_for_timeout(4500)
    esito["stato"] = c.js("() => __game.campagna.attiva && __game.campagna.attiva.stato")
    c.page.wait_for_timeout(1500)
    # la foto accanto al rivale, che e' gia' avanti (lungoSpezzata: missioni_luoghi.js)
    c.js("""() => { const m = __game.campagna.attiva, p = __game.player, v = p.vehicle;
      const q = lungoSpezzata(m.strada, m.rivale.s + 3);
      if (v) { v.x = q.x + 2; v.z = q.z + 3; v.speed = 0; p.x = v.x; p.z = v.z; } }""")
    c.page.wait_for_timeout(250)
    esito["foto"] = [c.foto("atto4_corsa")]
    esito["rivale"] = c.js("() => +(__game.campagna.attiva.rivale.s).toFixed(1)")
    c.js("() => __game.debug.avanza()")
    c.page.wait_for_timeout(300)
    c.js("() => { const p = __game.player; if (p.vehicle) { p.vehicle.rider = null; p.scendi(); } }")
    esito["fps"] = c.fps()
    guasti = []
    if esito["incarico"]["sella"] not in ("ladro_cammello", "ladro_dromedario") \
            or esito["distanza"] > 31:
        guasti.append(f"il mezzo della corsa: {esito['incarico']['sella']} a {esito['distanza']}")
    if esito["sprite"] not in ("ladro_cammello@beige", "ladro_dromedario@beige"):
        guasti.append(f"in sella al cammello lo sprite e' {esito['sprite']}")
    if esito["stato"] != "corsa" or esito["rivale"] <= 0:
        guasti.append(f"la corsa non parte: {esito['stato']}, rivale a {esito['rivale']}")
    _a_valdarno(c, esito, guasti)
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


def scena_atto4_finale(c):
    """Il finale dell'atto IV e il passaggio all'atto V: al capitolo 5
    dall'emiro (nel palazzo) parte la caccia al capo dei pirati; chiusa
    quella, la consegna al porto parte da se'; arrivati, la scena "La rotta di
    casa" (tre righe), poi l'atto V: Valdarno, sulla barca al molo, coi soldi
    di prima piu' la cassa sotto il molo (320), vestito di beige, col
    capitolo 1 da cominciare dal Nocchiero (dal 13/10 l'atto V c'e':
    collaudo_atto5.py). Poi tutto com'era."""
    _alla_costa(c, cap=4, miss=1)
    c.js("() => { const p = __game.player; p.money = 111; "
         "p.arsenale = ['spada', 'sciabola_emiro']; p.equipaggia('sciabola_emiro'); }")
    esito = {"parla": _parla(c, "emiro")}
    esito["caccia"] = c.js(INCARICO)["tipo"]
    c.tp(c.js("() => __collaudo.piazza()"), 0.5)
    c.js("() => __game.debug.avanza()")
    c.page.wait_for_timeout(400)
    esito["incarico"] = c.js(INCARICO)
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
                 "righe: SCENE_PASSAGGIO.rotta.righe.length })")
    for _ in range(scena["righe"] - 1):
        c.page.keyboard.press("KeyE")
        c.page.wait_for_timeout(350)
    esito["foto"] = [c.foto("atto4_rotta")]
    c.page.keyboard.press("KeyE")
    c.page.wait_for_function("() => !Passaggi.attiva", timeout=20000)
    c.page.wait_for_timeout(1500)
    esito["scena"] = scena
    esito["dopo"] = c.js("""() => { const g = __game, p = g.player;
      return { chiave: g.world.pianta.chiave, atto: Storia.stato.atto, titolo: Storia.titolo,
               soldi: p.money, arsenale: [...p.arsenale], in_barca: !!p.vehicle,
               sprite: p.sprite, msg: document.getElementById('msg').textContent,
               sciabola: !!Assets.charDef('ladro_sciabola_emiro@beige'),
               attiva: !!g.campagna.attiva, capitolo: !!Storia.capitolo(),
               obiettivo: document.getElementById('objective').textContent }; }""")
    esito["foto"].append(c.foto("atto5_arrivo"))
    d = esito["dopo"]
    if scena["titolo"] != "La rotta di casa" or scena["righe"] != 3:
        guasti.append(f"la scena del finale: {scena}")
    if (d["chiave"], d["atto"], d["titolo"]) != ("valdarno", 4, "Il ritorno"):
        guasti.append(f"dopo il finale: {d['chiave']}, atto {d['atto']}, {d['titolo']}")
    if d["soldi"] != 111 + 40 + 320 or "sciabola_emiro" not in d["arsenale"] or not d["sciabola"]:
        guasti.append(f"all'arrivo i soldi o le armi non tornano: {d}")
    if not d["in_barca"] or d["attiva"] or not d["capitolo"]:
        guasti.append(f"all'arrivo non in barca, con un incarico o senza capitolo: {d}")
    if "il Nocchiero" not in d["obiettivo"] or not d["sprite"].endswith("@beige"):
        guasti.append(f"l'obiettivo o la veste dell'atto V: {d['obiettivo']!r}, {d['sprite']}")
    _a_valdarno(c, esito, guasti)
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


def scena_armaiolo(c):
    """Il fabbro della Costa (14/10, "almeno i nomi diversi"): fra i
    committenti del mondo "l'armaiolo", non Ferrante; si entra nella sua
    bottega (stanze/costa/fucina.json), lui e' SarScimitarra e dice il suo
    nome; B apre la bottega delle armi. Foto."""
    _alla_costa(c, cap=3)
    esito = {"committenti": c.js("() => __game.world.spawns.givers.map(q => q.name)")}
    porta = c.js("() => { const p = Interni.porte.find(q => q.tipo === 'fucina'); "
                 "return p && { x: p.x, z: p.z }; }")
    c.tp({"x": porta["x"], "z": porta["z"] + 1.0}, 1.5)
    c.js(CALMA)
    c.page.keyboard.press("KeyE")
    c.page.wait_for_timeout(1300)
    esito["stanza"] = c.js("""() => { const I = __game.Interni, s = I.dentro && I.stanza;
      const r = s && s.residenti.find(q => q.committente === 'fabbro');
      if (r) { const p = __game.player; p.x = r.x; p.z = r.z + 1.6; p.vx = p.vz = 0; }
      return s ? { nome: s.nome, fabbro: r && { sprite: r.sprite, nome: r.nome } } : null; }""")
    c.page.wait_for_timeout(500)
    esito["suggerimento"] = c.js("() => document.getElementById('prompt').textContent")
    c.page.keyboard.press("KeyB")
    c.page.wait_for_timeout(500)
    esito["bottega"] = c.js("() => Hud.bottegaAperta()")
    esito["titolo"] = c.js("() => document.getElementById('bottegaTitolo').textContent")
    esito["foto"] = c.foto("armaiolo_bottega")
    c.page.keyboard.press("KeyB")
    guasti = []
    s = esito["stanza"] or {}
    if "l'armaiolo" not in esito["committenti"] or "Ferrante il fabbro" in esito["committenti"]:
        guasti.append(f"i committenti della Costa: {esito['committenti']}")
    if s.get("nome") != "La bottega dell'armaiolo" or (s.get("fabbro") or {}).get("sprite") != "SarScimitarra":
        guasti.append(f"la bottega dell'armaiolo: {s}")
    titolo_giusto = esito["titolo"] == "La bottega dell'armaiolo"
    if "armaiolo" not in esito["suggerimento"] or not esito["bottega"] or not titolo_giusto:
        guasti.append(f"dall'armaiolo: {esito['suggerimento']!r}, bottega {esito['bottega']}")
    c.js("() => { const e = __game.Interni.stanza.entrata; "
         "__game.player.x = e.x; __game.player.z = e.z; }")
    c.page.keyboard.down("ArrowDown")
    c.page.wait_for_timeout(1600)
    c.page.keyboard.up("ArrowDown")
    _a_valdarno(c, esito, guasti)
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


SCENE_ATTO4 = {"armaiolo": scena_armaiolo, "atto4": scena_atto4, "atto4_carovana": scena_atto4_carovana,
               "atto4_corsa": scena_atto4_corsa, "atto4_finale": scena_atto4_finale}
