"""collaudo_campagna.py — le scene della campagna in cinque atti (27/09).

Le fondamenta della campagna (campagna.js, passaggi.js, missioni*.js): la
storia fuori dal mondo, le scene di passaggio, il viaggio in barca, i tipi di
missione nuovi, il salvataggio per atti. Stesse regole di collaudo.py (che le
importa in SCENE): misure, non giudizi; una scena torna un dict, con "errore"
se qualcosa non va.
"""


def scena_campagna(c):
    """F2, la campagna per citta': l'atto I sono i cinque capitoli di sempre coi
    loro committenti; la storia sa in che citta' ti vuole (meta); il passaggio
    all'atto seguente toglie e rende quello che l'arrivo dice (in catene si
    perde tutto, al ritorno si ritrova la cassa del molo). Lo stato si rimette
    com'era alla fine."""
    esito = c.js("""() => {
      const s = Storia.stato, p = __game.player;
      const prima = { atto: s.atto, cap: s.cap, miss: s.miss, finita: s.finita,
                      soldi: p.money, arsenale: [...p.arsenale], arma: p.arma,
                      tenda: Tenda.perSalvare() };
      const r = {
        atto1_capitoli: Storia.campagna().capitoli === CAPITOLI,
        atto1_titoli: CAPITOLI.map(k => k.titolo),
        committente_cap3: Storia.committente('nocchiero'),
        stesso_oggetto: __game.campagna === Storia.stato,
        meta_valdarno: Storia.meta('valdarno'),
      };
      // atto II: la storia vuole il fiordo
      s.atto = 1;
      r.meta_atto2 = Storia.meta('valdarno');
      r.meta_atto2_nel_fiordo = Storia.meta('fiordo-3');
      // II -> III: in catene
      p.money = 500; p.arsenale = ['spada', 'arco', 'lancia']; p.equipaggia('arco');
      Tenda.rimetti({ posseduta: true });
      const c3 = Storia.passa({ player: p, tenda: Tenda });
      r.in_catene = { atto: s.atto, titolo: c3.titolo, soldi: p.money,
                      arsenale: [...p.arsenale], arma: p.arma,
                      tenda: Tenda.perSalvare().posseduta, cap: s.cap, miss: s.miss };
      // III -> IV -> V: al ritorno la cassa
      Storia.passa({ player: p, tenda: Tenda });
      p.money = 7;
      Storia.passa({ player: p, tenda: Tenda });
      r.ritorno = { atto: s.atto, soldi: p.money, meta: Storia.meta('fiordo-3') };
      r.oltre_l_ultimo = Storia.passa({ player: p, tenda: Tenda });
      // com'era
      Object.assign(s, { atto: prima.atto, cap: prima.cap, miss: prima.miss,
                         finita: prima.finita });
      p.money = prima.soldi; p.arsenale = prima.arsenale; p.equipaggia(prima.arma);
      Tenda.rimetti(prima.tenda);
      r.rimesso = s.atto === 0;
      return r;
    }""")
    guasti = []
    if not esito["atto1_capitoli"] or len(esito["atto1_titoli"]) != 5:
        guasti.append("l'atto I non sono i cinque capitoli di sempre")
    if esito["committente_cap3"] != "il Nocchiero" or not esito["stesso_oggetto"]:
        guasti.append("committenti o stato della storia sbagliati")
    if esito["meta_valdarno"] is not None:
        guasti.append("all'atto I la storia vuole un'altra citta'")
    if esito["meta_atto2"] != "fiordo-3" or esito["meta_atto2_nel_fiordo"] is not None:
        guasti.append(f"atto II: meta {esito['meta_atto2']}")
    k = esito["in_catene"]
    if (k["atto"], k["soldi"], k["arsenale"], k["arma"], k["tenda"], k["cap"]) != \
            (2, 0, ["spada"], "spada", False, 0):
        guasti.append(f"in catene non si e' perso tutto: {k}")
    if esito["ritorno"]["atto"] != 4 or esito["ritorno"]["soldi"] != 7 + 320:
        guasti.append(f"al ritorno: {esito['ritorno']}")
    if esito["ritorno"]["meta"] != "valdarno" or esito["oltre_l_ultimo"] is not None:
        guasti.append("il ritorno non porta a Valdarno, o si va oltre l'ultimo atto")
    if not esito["rimesso"]:
        guasti.append("lo stato non e' tornato com'era")
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


FERMO = """() => __game.npcs.reduce((a, n) => a + n.x + n.z, 0)"""


def scena_passaggio(c):
    """Una scena di passaggio (passaggi.js): il velo scende, il titolo e la
    prima riga; E porta la seconda e non arriva al gioco; il gioco e' fermo
    (la gente non si muove); E dopo l'ultima chiude e il gioco riparte."""
    c.tp(c.js("() => __collaudo.piazza()"), 1.5)
    c.js("() => { window.__fine = false; __game.debug.scena('prova').then(() => { window.__fine = true; }); }")
    c.page.wait_for_timeout(900)
    esito = {"aperta": c.js("() => ({ attiva: Passaggi.attiva, riga: Passaggi.riga, "
                            "opacita: +getComputedStyle(document.getElementById('scena')).opacity, "
                            "titolo: document.getElementById('scenaTitolo').textContent })")}
    a = c.js(FERMO)
    c.page.wait_for_timeout(1000)
    esito["gente_ferma"] = abs(c.js(FERMO) - a) < 1e-6
    esito["foto"] = [c.foto("passaggio_prima")]
    c.js("() => { document.getElementById('msg').textContent = ''; }")
    c.page.keyboard.press("KeyE")
    c.page.wait_for_timeout(400)
    esito["dopo_e"] = c.js("() => ({ riga: Passaggi.riga, righe: document.querySelectorAll('#scenaRighe p').length, "
                           "msg: document.getElementById('msg').textContent })")
    esito["foto"].append(c.foto("passaggio_seconda"))
    c.page.keyboard.press("KeyE")
    c.page.wait_for_timeout(1000)
    esito["chiusa"] = c.js("() => ({ attiva: Passaggi.attiva, fine: window.__fine, "
                           "display: document.getElementById('scena').style.display })")
    a = c.js(FERMO)
    c.page.wait_for_timeout(1000)
    esito["gente_riparte"] = abs(c.js(FERMO) - a) > 0.1
    guasti = []
    ap, de, ch = esito["aperta"], esito["dopo_e"], esito["chiusa"]
    if not ap["attiva"] or ap["riga"] != 0 or ap["opacita"] < 0.99 or not ap["titolo"]:
        guasti.append(f"la scena non si apre: {ap}")
    if not esito["gente_ferma"]:
        guasti.append("durante la scena il gioco va avanti")
    if de["riga"] != 1 or de["righe"] != 2 or "nulla da fare" in de["msg"]:
        guasti.append(f"E non porta la riga seguente o arriva al gioco: {de}")
    if ch["attiva"] or not ch["fine"] or ch["display"] != "none":
        guasti.append(f"la scena non si chiude: {ch}")
    if not esito["gente_riparte"]:
        guasti.append("dopo la scena il gioco resta fermo")
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


# la barca del Nocchiero portata al largo, sul bordo della carta, col ladro sopra
AL_LARGO = """() => {
  const g = __game, w = g.world, S = w.solidS, N = w.solidN, L = N * S;
  const b = Viaggio.approdo(g.vehicles);
  let punto = null;
  for (let k = 0; k < N && !punto; k++)             // la prima cella d'acqua sul bordo
    for (const [cx, cy] of [[k, 3], [k, N - 4], [3, k], [N - 4, k]]) {
      const x = cx * S + S / 2, z = cy * S + S / 2;
      if (w.solid[cy * N + cx] === 2 && Viaggio.alLargo(w, x, z)) { punto = { x, z }; break; }
    }
  g.debug.tp(punto.x, punto.z);
  b.x = punto.x; b.z = punto.z; b.rider = g.player; g.player.sali(b);
  return { x: +punto.x.toFixed(1), z: +punto.z.toFixed(1), L };
}"""

ARRIVO = """() => {
  const g = __game, w = g.world, p = g.player, v = p.vehicle;
  const molo = Math.min(...w.moli.map(m => Math.hypot(
    Math.max(m.x0, Math.min(m.x1, p.x)) - p.x, Math.max(m.z0, Math.min(m.z1, p.z)) - p.z)));
  return { chiave: w.pianta.chiave, citta: w.pianta.nome, in_barca: !!v && v.type === 'barca',
           dal_molo: +molo.toFixed(1), al_largo: Viaggio.alLargo(w, p.x, p.z),
           atlante: Assets.manifest.mappa };
}"""


def _salpa(c, nome):
    """Dal largo, E: la scena del viaggio; E fino in fondo; si aspetta l'arrivo."""
    c.js(AL_LARGO)
    c.page.wait_for_timeout(600)
    sugg = c.js("() => document.getElementById('prompt').textContent")
    c.page.keyboard.press("KeyE")
    c.page.wait_for_timeout(1200)
    scena = c.js("() => ({ attiva: Passaggi.attiva, titolo: document.getElementById('scenaTitolo').textContent })")
    foto = c.foto(f"salpa_{nome}_scena")
    # una E per riga: una di troppo, a scena chiusa, farebbe scendere dalla barca
    for _ in range(c.js("() => SCENE_PASSAGGIO.viaggio.righe.length")):
        c.page.keyboard.press("KeyE")
        c.page.wait_for_timeout(500)
    c.page.wait_for_function("() => !Passaggi.attiva", timeout=20000)
    c.page.wait_for_timeout(1500)
    return {"suggerimento": sugg, "scena": scena, "foto_scena": foto, "arrivo": c.js(ARRIVO)}


def scena_salpa(c):
    """Il viaggio vero (viaggio.js): all'atto II, dalla barca al largo di
    Valdarno, E salpa verso il fiordo con la scena del viaggio; si arriva sulla
    barca del Nocchiero, a un molo del fiordo. Tornati all'atto I, dal largo del
    fiordo si torna a Valdarno, con la firma dell'inizio del collaudo. All'atto
    I da Valdarno non si salpa."""
    prima = c.js("() => ({ ...Storia.perSalvare(), cap: Storia.stato.cap })")
    c.js(AL_LARGO)
    c.page.wait_for_timeout(500)
    esito = {"senza_meta": c.js("() => document.getElementById('prompt').textContent")}
    c.js("() => { Storia.stato.atto = 1; }")
    esito["andata"] = _salpa(c, "fiordo")
    esito["foto"] = [esito["andata"]["foto_scena"], c.foto("salpa_fiordo_arrivo")]
    esito["fps"] = c.fps()
    c.js("() => { Storia.stato.atto = 0; }")
    esito["ritorno"] = _salpa(c, "valdarno")
    esito["foto"] += [esito["ritorno"]["foto_scena"], c.foto("salpa_valdarno_arrivo")]
    esito["firma"] = c.js("() => __collaudo.firma()")["hash"]
    c.js("(s) => { Storia.rimetti(s); Storia.stato.cap = s.cap; }", prima)
    c.js("() => { const p = __game.player; if (p.vehicle) { p.vehicle.rider = null; p.scendi(); } }")
    c.tp(c.js("() => __collaudo.piazza()"), 1.0)

    guasti = []
    an, ri = esito["andata"], esito["ritorno"]
    if "salpa" in esito["senza_meta"]:
        guasti.append("all'atto I da Valdarno si salpa")
    if "salpa verso" not in an["suggerimento"] or not an["scena"]["attiva"]:
        guasti.append(f"al largo niente 'salpa' o niente scena: {an['suggerimento']!r}")
    if an["arrivo"]["chiave"] != "fiordo-3" or an["arrivo"]["atlante"] != "fiordo":
        guasti.append(f"non si arriva nel fiordo: {an['arrivo']}")
    if not an["arrivo"]["in_barca"] or an["arrivo"]["dal_molo"] > 4:
        guasti.append(f"nel fiordo non si arriva in barca a un molo: {an['arrivo']}")
    if ri["arrivo"]["chiave"] != "valdarno" or not ri["arrivo"]["in_barca"] \
            or ri["arrivo"]["dal_molo"] > 4:
        guasti.append(f"ritorno: {ri['arrivo']}")
    if esito["firma"] != c.firma0:
        guasti.append(f"Valdarno al ritorno ha firma {esito['firma']} invece di {c.firma0}")
    if esito["fps"] < 30:
        guasti.append(f"fps {esito['fps']}")
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


def scena_salvataggio_atti(c):
    """Salvataggio per atti: un vecchio salvataggio (versione 1, senza la
    storia) si carica ed e' dell'atto I; il posto dell'atto II, scritto
    all'atto II, si rilegge e riporta all'atto II; il file esportato dice
    l'atto nel nome. Il browser torna com'era."""
    c.tp(c.js("() => __collaudo.piazza()"), 1.0)
    c.js("""() => { window.__prima = {};
      for (const k of Object.keys(localStorage)) if (k.startsWith(Salvataggio.CHIAVE))
        window.__prima[k] = localStorage.getItem(k); }""")
    esito = c.js("""async () => {
      const r = {}, st = Storia.stato;
      // un salvataggio di prima del 27/09: versione 1, niente storia
      const vecchio = Salvataggio.stato();
      delete vecchio.storia; vecchio.versione = 1; vecchio.capitolo = 2; vecchio.missione = 1;
      st.atto = 3;
      await Game.carica(vecchio);
      r.vecchio = { atto: st.atto, cap: st.cap, miss: st.miss };
      // il posto dell'atto II
      st.atto = 1; st.cap = 0; st.miss = 0;
      const a2 = Salvataggio.salvaAtto();
      r.posto = { nel_browser: a2.nelBrowser, versione: a2.versione };
      st.atto = 0; st.cap = 3;
      const atti = Salvataggio.leggiAtti();
      r.atti = atti.map(x => x.atto);
      await Game.carica(atti.find(x => x.atto === 1).s);
      r.ripreso = { atto: st.atto, cap: st.cap, titolo: Storia.titolo };
      r.file = Salvataggio.nomeFile(a2);
      st.atto = 0; st.cap = 0; st.miss = 0;
      return r; }""")
    c.js("""() => { for (const k of Object.keys(localStorage)) if (k.startsWith(Salvataggio.CHIAVE))
        localStorage.removeItem(k);
      for (const [k, v] of Object.entries(window.__prima)) localStorage.setItem(k, v); }""")
    guasti = []
    if esito["vecchio"] != {"atto": 0, "cap": 2, "miss": 1}:
        guasti.append(f"il salvataggio vecchio non e' dell'atto I: {esito['vecchio']}")
    if not esito["posto"]["nel_browser"] or esito["posto"]["versione"] != 2 or 1 not in esito["atti"]:
        guasti.append(f"il posto dell'atto II: {esito['posto']}, atti {esito['atti']}")
    if esito["ripreso"]["atto"] != 1 or esito["ripreso"]["cap"] != 0:
        guasti.append(f"dal posto dell'atto II: {esito['ripreso']}")
    if "_atto2_" not in esito["file"]:
        guasti.append(f"il nome del file: {esito['file']}")
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


def _leggi_scena(c, nome):
    """Una scena di passaggio aperta: foto, poi E riga per riga fino in fondo."""
    c.page.wait_for_function("() => Passaggi.attiva", timeout=8000)
    c.page.wait_for_timeout(800)
    info = c.js("() => ({ titolo: document.getElementById('scenaTitolo').textContent, "
                f"righe: SCENE_PASSAGGIO['{nome}'].righe.length }})")
    for _ in range(info["righe"] - 1):
        c.page.keyboard.press("KeyE")
        c.page.wait_for_timeout(350)
    info["foto"] = c.foto(f"finale_{nome}")
    c.page.keyboard.press("KeyE")
    return info


def scena_finale_atto1(c):
    """Il nuovo finale dell'atto I (task 2): al capitolo 5, preso il cortile,
    dal Ciambellano parte la scena dell'arresto; poi l'incarico "imbarco" con
    la taglia al massimo; alla barca del Nocchiero finisce l'atto: la scena
    "Sotto le reti" e si arriva nel Fiordo, all'atto II, senza stelle, al molo
    sulla barca; la storia si segna la taglia del Ciambellano; c'e' il posto
    dell'atto II. Poi tutto torna com'era, e Valdarno ha la sua firma."""
    c.js("""() => { window.__prima = {};
      for (const k of Object.keys(localStorage)) if (k.startsWith(Salvataggio.CHIAVE))
        window.__prima[k] = localStorage.getItem(k);
      const s = Storia.stato; s.atto = 0; s.cap = 4; s.miss = 2; s.finita = false; s.attiva = null;
      __game.player.wanted = 0; }""")
    ciamb = c.js("() => { const g = __game.world.spawns.givers.find(q => q.name === 'il Ciambellano'); "
                 "return { x: g.x, z: g.z }; }")
    c.tp({"x": ciamb["x"], "z": ciamb["z"] + 2.0}, 1.5)
    c.page.keyboard.press("KeyE")
    esito = {"arresto": _leggi_scena(c, "arresto")}
    c.page.wait_for_timeout(1500)
    esito["imbarco"] = c.js("""() => { const m = __game.campagna.attiva;
      return { tipo: m && m.tipo, stelle: __game.player.stars, barca: !!(m && m.barca) }; }""")
    esito["foto"] = [esito["arresto"]["foto"], c.foto("finale_taglia")]
    # al porto: accanto alla barca del Nocchiero
    b = c.js("() => { const b = __game.campagna.attiva.barca; return { x: b.x, z: b.z }; }")
    c.js("([x, z]) => { const p = __game.player; p.x = x + 3; p.z = z; }", [b["x"], b["z"]])
    esito["fuga"] = _leggi_scena(c, "fuga")
    esito["foto"].append(esito["fuga"]["foto"])
    c.page.wait_for_function("() => !Passaggi.attiva", timeout=20000)
    c.page.wait_for_timeout(2000)
    esito["arrivo"] = c.js("""() => { const g = __game, p = g.player, w = g.world;
      const molo = Math.min(...w.moli.map(m => Math.hypot(
        Math.max(m.x0, Math.min(m.x1, p.x)) - p.x, Math.max(m.z0, Math.min(m.z1, p.z)) - p.z)));
      return { chiave: w.pianta.chiave, atto: Storia.stato.atto, cap: Storia.stato.cap,
               stelle: p.stars, in_barca: !!p.vehicle && p.vehicle.type === 'barca',
               dal_molo: +molo.toFixed(1), segni: Storia.stato.segni,
               posto_atto2: Salvataggio.leggiAtti().some(x => x.atto === 1),
               obiettivo: document.getElementById('objective').textContent,
               msg: document.getElementById('msg').textContent }; }""")
    esito["foto"].append(c.foto("finale_fiordo"))
    # com'era: atto I, Valdarno, i salvataggi di prima
    c.js("""() => { const s = Storia.stato; s.atto = 0; s.cap = 0; s.miss = 0; s.segni = [];
      const p = __game.player; if (p.vehicle) { p.vehicle.rider = null; p.scendi(); }
      for (const k of Object.keys(localStorage)) if (k.startsWith(Salvataggio.CHIAVE))
        localStorage.removeItem(k);
      for (const [k, v] of Object.entries(window.__prima)) localStorage.setItem(k, v); }""")
    c.js("() => __game.debug.citta('valdarno')")
    c.page.wait_for_timeout(3000)
    esito["firma"] = c.js("() => __collaudo.firma()")["hash"]
    c.tp(c.js("() => __collaudo.piazza()"), 1.0)

    guasti = []
    if esito["arresto"]["titolo"] != "Il ladro della corona":
        guasti.append(f"niente scena dell'arresto: {esito['arresto']}")
    if esito["imbarco"] != {"tipo": "imbarco", "stelle": 5, "barca": True}:
        guasti.append(f"dopo l'arresto: {esito['imbarco']}")
    if esito["fuga"]["titolo"] != "Sotto le reti":
        guasti.append(f"niente scena della fuga: {esito['fuga']}")
    a = esito["arrivo"]
    if (a["chiave"], a["atto"], a["cap"], a["stelle"]) != ("fiordo-3", 1, 0, 0):
        guasti.append(f"l'arrivo nel Fiordo: {a}")
    if not a["in_barca"] or a["dal_molo"] > 4:
        guasti.append(f"nel Fiordo non si arriva in barca al molo: {a}")
    if "taglia del Ciambellano" not in a["segni"] or not a["posto_atto2"]:
        guasti.append(f"segni o posto dell'atto II: {a}")
    if esito["firma"] != c.firma0:
        guasti.append(f"Valdarno al ritorno ha firma {esito['firma']}")
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


from collaudo_atto2 import scena_atto2, scena_atto2_finale
from collaudo_costa import scena_costa
from collaudo_missioni import (
    scena_prova_bestia,
    scena_prova_difesa,
    scena_prova_duello,
    scena_prova_furto,
    scena_prova_gara,
    scena_prova_scorta,
)

# i testi della storia e le loro chiavi (lingua.js, lingue/it.js; 15/10)
LINGUA = r"""() => {
  const valori = new Set(Object.values(TESTI_IT));
  const dati = { CAPITOLI, CAPITOLI_FIORDO, CAPITOLI_MARE, CAPITOLI_COSTA, CAPITOLI_RITORNO,
                 SCENE_PASSAGGIO, ARMI, GIVER_CAP, GIVER_FIORDO, GIVER_MARE, GIVER_COSTA,
                 GIVER_RITORNO };
  const chiavi = [], fuori = [], visti = new Set();
  const giro = (v, dove) => {
    if (typeof v === 'string') {
      if (/^[a-z0-9_]+(\.[\w]+)+$/.test(v)) chiavi.push(dove + ' = ' + v);
      else if (/\s/.test(v) && !valori.has(v)) fuori.push(dove + ': ' + v.slice(0, 50));
    } else if (v && typeof v === 'object' && !visti.has(v)) {
      visti.add(v);
      for (const [k, x] of Object.entries(v)) giro(x, dove + '.' + k);
    }
  };
  for (const [k, v] of Object.entries(dati)) giro(v, k);
  const sel = document.getElementById('linguaSel');
  return { lingua: Lingua.codice, chiavi_it: Object.keys(TESTI_IT).length,
           vuote: Object.entries(TESTI_IT).filter(([, v]) => !String(v).trim()).map(([k]) => k),
           chiavi_a_schermo: chiavi.slice(0, 5), quante_chiavi_a_schermo: chiavi.length,
           fuori_dal_file: fuori.slice(0, 5), quanti_fuori: fuori.length,
           scelta: sel ? [...sel.options].map(o => o.value + (o.disabled ? ' (spenta)' : '')) : null,
           titolo_cap1: CAPITOLI[0].titolo, arma: ARMI.spada.nome }; }"""


def scena_lingua(c):
    """L'inglese, parte 1 (lingua.js, lingue/it.js; 15/10): i testi della
    storia (i capitoli dei cinque atti, le scene, le armi, i committenti)
    stanno nel file della lingua, per chiave. La lingua e' l'italiano; nei
    dati della storia non resta nessuna chiave al posto del testo e nessun
    testo fuori dal file; nella schermata iniziale c'e' la scelta della
    lingua, con l'inglese spento finche' la traduzione non c'e'."""
    esito = c.js(LINGUA)
    guasti = []
    if esito["lingua"] != "it" or esito["chiavi_it"] < 280 or esito["vuote"]:
        guasti.append(f"il file dell'italiano: {esito['lingua']}, {esito['chiavi_it']} chiavi, "
                      f"vuote {esito['vuote'][:3]}")
    if esito["quante_chiavi_a_schermo"] or esito["quanti_fuori"]:
        guasti.append(f"chiavi al posto del testo {esito['chiavi_a_schermo']}, "
                      f"testi fuori dal file {esito['fuori_dal_file']}")
    if esito["scelta"] != ["it", "en (spenta)"]:
        guasti.append(f"la scelta della lingua nel titolo: {esito['scelta']}")
    if esito["titolo_cap1"] != "Fango e paglia" or esito["arma"] != "Spada corta":
        guasti.append(f"i testi non sono quelli di prima: {esito['titolo_cap1']}, {esito['arma']}")
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


SCENE_CAMPAGNA = {
    "lingua": scena_lingua,
    "campagna": scena_campagna,
    "finale_atto1": scena_finale_atto1,
    "salvataggio_atti": scena_salvataggio_atti,
    "passaggio": scena_passaggio,
    "salpa": scena_salpa,
    "prova_scorta": scena_prova_scorta,
    "prova_duello": scena_prova_duello,
    "prova_bestia": scena_prova_bestia,
    "prova_gara": scena_prova_gara,
    "prova_difesa": scena_prova_difesa,
    "prova_furto": scena_prova_furto,
    "atto2": scena_atto2,
    "atto2_finale": scena_atto2_finale,
    "costa": scena_costa,
}
