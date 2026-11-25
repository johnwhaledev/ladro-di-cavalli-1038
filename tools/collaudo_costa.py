"""collaudo_costa.py — la Costa saracena (29/09, task 2).

La citta' della Costa (pianta_costa.js, world_costa.js, assets/costa/): la
pianta sua, l'atlante, la gente, le stanze, il cielo, il menu e la campagna.
Stesse regole di collaudo.py; la raccoglie collaudo_campagna.py in
SCENE_CAMPAGNA. Gli aiutanti (apri, MISURA_PIANTA, le carte) sono quelli di
collaudo.py, presi dal modulo che gira.
"""
import base64
import sys

SEMI = ["costa-5", "costa-3", "costa-1", "costa-2"]


def _collaudo():
    """Il modulo di collaudo.py: quello che gira (__main__) o importato."""
    m = sys.modules.get("__main__")
    if hasattr(m, "MISURA_PIANTA"):
        return m
    import collaudo
    return collaudo


# la gente e le cose della citta' caricata: chi c'e', di che fazione, cosa manca
GENTE = r"""() => { const w = __game.world, P = w.pianta;
  const ruoli = Object.keys(CAST_VALDARNO);
  const chiesti = new Set([...w.residents.map(r => r.sprite), ...w.spawns.givers.map(g => g.sprite),
    ...w.nemici.map(n => n.sprite + '@rosso'), ...ruoli.flatMap(r => castDi(P, r))]);
  const fazione = pre => [...chiesti].filter(n => n.startsWith(pre)).length;
  const capo = w.spawns.givers.find(g => /fuorilegge/.test(g.name));
  const nomi = w.props.map(p => p.name).filter(Boolean);
  return { citta: P.nome, chiave: P.chiave, atlante: Assets.manifest.mappa,
           mancano_pg: [...chiesti].filter(n => !Assets.charDef(n)),
           mancano_pezzi: [...new Set(nomi.filter(n => !Assets.world(n)))],
           vik: fazione('Vik'), ban: fazione('Ban'), sar: fazione('Sar'), pir: fazione('Pir'),
           guardie: castDi(P, 'guardia'), capo: capo && capo.sprite, bestia: castDi(P, 'bestia'),
           nemici: [...new Set(w.nemici.map(n => n.sprite))],
           committenti: w.spawns.givers.map(g => g.name),
           caravanserragli: nomi.filter(n => n === 'edificio_taverna').length,
           croci: nomi.filter(n => /croce|crocifisso/.test(n)).length,
           palazzo: nomi.includes(P.CASE.palazzo), hammam: nomi.includes(P.CASE.hammam),
           bancarelle: nomi.filter(n => P.CASE.bancarelle.includes(n)).length,
           oasi_erba: (() => { let k = 0; for (let y = -P.OASI.r - 5; y <= P.OASI.r + 5; y++)
             for (let x = -P.OASI.r - 5; x <= P.OASI.r + 5; x++)
               if (w.terrain[w.idx(P.OASI.x + x, P.OASI.y + y)] === T.ERBA) k++; return k; })(),
           meteo: P.METEO, fps: __game.fps,
           ladro: __game.player.sprite,
           doppione_ladro: ruoli.filter(r => !r.startsWith('nemico'))
                             .some(r => castDi(P, r).includes('MiniThief')) ||
                           w.residents.some(r => r.sprite === 'MiniThief'),
           staccionate: nomi.filter(n => /staccionata|recinto|siepe/.test(n)).length }; }"""

LUOGHI = r"""() => { const P = __game.world.pianta, c = n => n * TILE + TILE / 2;
  return { porta_mare: { x: c(P.GATES[0].x) + 8, z: c(P.GATES[0].y) + 3 },
           suk: { x: c(P.PLAZA.x), z: c(P.PLAZA.y) + 14 },
           casba: { x: c(P.CASTLE.x), z: c(P.CASTLE.y) + 16 },
           medina: { x: c(P.WALL.x0 + 14), z: c(P.WALL.y0 + 12) },
           porto: { x: c(P.PORT.x) - 4, z: c(P.PORT.y) + 2 },
           oasi: { x: c(P.OASI.x), z: c(P.OASI.y + P.OASI.r + 4) },
           pirati: { x: c(P.CAMP.x), z: c(P.CAMP.y) + 12 } }; }"""


def scena_costa(c):
    """La Costa saracena: quattro citta' generate (5, 3, 1, 2) misurate nella
    pagina della Costa (ogni porta, uscio e osteria si raggiunge a piedi dalla
    piazza; il mare a ponente e' cupo; dal porto in barca si esce in mare;
    la flora c'e' nell'atlante), con le carte in una foto; poi la 5, quella
    della campagna, giocata: l'atlante della Costa, i saraceni di guardia, i
    pirati al campo col loro capitano, i predoni in rosso ai campi nemici,
    niente vichinghi ne' banditi, niente croci; il palazzo, il hammam, cinque
    caravanserragli al piu', le bancarelle del suk, l'erba attorno all'oasi,
    il sole quasi sempre (pioggia e temporali insieme al 5% al piu'), niente
    neve ne' nebbia. Si entra nel palazzo dell'emiro, nel hammam
    e nel caravanserraglio. Il menu offre le coste e la campagna vuole la 5.
    Una foto per luogo e per stanza."""
    C = _collaudo()
    base = c.page.url.split("?")[0]
    C.apri(c.page, base + "?pianta=costa-5")
    c.js("() => { Meteo.imposta('sereno'); __game.debug.setDay(0.4); }")
    esito, carte, guasti = {"misure": {}}, [], []
    for seme in SEMI:
        m = c.js(C.MISURA_PIANTA, seme)
        carte.append(base64.b64decode(m.pop("carta").split(",", 1)[1]))
        esito["misure"][seme] = m
        s = m.get("stile", {})
        if m["irraggiungibili"] or m["osterie_irraggiungibili"]:
            guasti.append(f"{seme}: irraggiungibili {m['irraggiungibili']}, "
                          f"osterie {m['osterie_irraggiungibili']}")
        if not 1 <= m["osterie"] <= 5:
            guasti.append(f"{seme}: {m['osterie']} caravanserragli")
        if s.get("stile") != "costa" or s.get("mare_cupo", 0) < 0.99 or s.get("neve"):
            guasti.append(f"{seme}: stile {s.get('stile')}, mare cupo {s.get('mare_cupo')}, "
                          f"neve {s.get('neve')}")
        if [n for n in s.get("flora_mancante", []) if isinstance(n, str)]:
            guasti.append(f"{seme}: l'atlante non ha {s['flora_mancante']}")
        if not s.get("barche") or not s.get("barca_al_mare"):
            guasti.append(f"{seme}: dal porto la barca non arriva al mare aperto")
    foto = [C._componi_carte(c, [carte], "costa_carte")]

    g = c.js(GENTE)
    esito["gente"] = g
    for nome, p in c.js(LUOGHI).items():
        c.tp(p, 2.5)
        foto.append(c.foto(f"costa_{nome}"))
    esito["stanze"] = {}
    for tipo, nome in {"castello": "Il palazzo dell'emiro", "chiesa": "Il hammam",
                       "taverna": "Il caravanserraglio"}.items():
        C._entra(c, tipo)
        c.page.wait_for_timeout(1500)
        s = c.js("() => { const I = __game.Interni; return I.dentro && { nome: I.stanza.nome, "
                 "residenti: I.stanza.residenti.map(r => r.nome).filter(Boolean) }; }")
        esito["stanze"][tipo] = s
        foto.append(c.foto(f"interni_costa_{tipo}"))
        if not s or s["nome"] != nome:
            guasti.append(f"stanza {tipo}: {s and s['nome']} invece di {nome}")
        if s:
            C._esci(c)
    esito["menu"] = c.js("() => [...document.querySelectorAll('#cittaSel option')].map(o => o.value)"
                         ".filter(v => v.startsWith('costa'))")
    esito["campagna"] = c.js("() => CAMPAGNE.costa.citta")
    esito["foto"] = foto
    C.apri(c.page, base)

    if g["atlante"] != "costa" or g["mancano_pg"] or g["mancano_pezzi"]:
        guasti.append(f"atlante {g['atlante']}, mancano {g['mancano_pg']} {g['mancano_pezzi']}")
    if g["vik"] or g["ban"] or not g["sar"] or not g["pir"]:
        guasti.append(f"fazioni: vik {g['vik']}, ban {g['ban']}, sar {g['sar']}, pir {g['pir']}")
    if g["capo"] != "PirCapitano" or g["bestia"] != ["SarLeone"] or \
            not all(n.startswith("Sar") for n in g["guardie"]):
        guasti.append(f"capo {g['capo']}, bestia {g['bestia']}, guardie {g['guardie']}")
    if not g["nemici"] or not all(n.startswith("Sar") for n in g["nemici"]):
        guasti.append(f"i campi nemici non sono predoni: {g['nemici']}")
    if g["croci"] or not g["palazzo"] or not g["hammam"] or g["bancarelle"] < 12:
        guasti.append(f"croci {g['croci']}, palazzo {g['palazzo']}, hammam {g['hammam']}, "
                      f"bancarelle {g['bancarelle']}")
    if not 1 <= g["caravanserragli"] <= 5 or g["oasi_erba"] < 30:
        guasti.append(f"caravanserragli {g['caravanserragli']}, erba dell'oasi {g['oasi_erba']}")
    m = g["meteo"]
    if m.get("sereno", 0) < 0.9 or m.get("pioggia", 0) + m.get("temporale", 0) > 0.05 \
            or "neve" in m or "nebbia" in m:
        guasti.append(f"il cielo della Costa: {g['meteo']}")
    if set(esito["menu"]) != {"costa-3", "costa-5"} or esito["campagna"] != "costa-5":
        guasti.append(f"menu {esito['menu']}, campagna {esito['campagna']}")
    if not g["ladro"].endswith("@beige") or g["doppione_ladro"]:
        guasti.append(f"il ladro nella Costa: {g['ladro']}, doppione {g['doppione_ladro']}")
    if g["staccionate"]:
        guasti.append(f"staccionate e siepi di Valdarno nella Costa: {g['staccionate']}")
    if g["fps"] < 30:
        guasti.append(f"fps {g['fps']}")
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito
