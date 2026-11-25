"""collaudo_nebbia.py — la carta da scoprire (nebbia.js, 01/10).

Stesse regole di collaudo.py (che la importa in SCENE): misure, non giudizi;
la scena torna un dict, con "errore" se qualcosa non va.
"""

# una cella mai vista con le vicine mai viste anche loro, 2 celle sopra e
# sotto e 5 ai lati (il velo sfumato al centro e' buio pieno, e le etichette
# dei luoghi scoperti sbordano in largo), la piu' lontana dal ladro
BUIA = r"""() => { const N = Nebbia.N, L = Nebbia.CELLA * TILE, p = __game.player;
  const mai = (i, j) => i >= 0 && j >= 0 && i < N && j < N && !Nebbia.scoperto((i + .5) * L, (j + .5) * L);
  let best = null, bd = -1;
  for (let j = 2; j < N - 2; j++) for (let i = 5; i < N - 5; i++) {
    let ok = true;
    for (let dj = -2; dj <= 2 && ok; dj++) for (let di = -5; di <= 5; di++) if (!mai(i + di, j + dj)) { ok = false; break; }
    if (!ok) continue;
    const x = (i + .5) * L, z = (j + .5) * L, d = Math.hypot(x - p.x, z - p.z);
    if (d > bd) { bd = d; best = { i, j, x, z }; }
  }
  return best; }"""

# il colore della carta al centro della cella (i, j)
PIXEL_CARTA = r"""([i, j]) => { const c = document.getElementById('mapCanvas'), W = c.width, H = c.height;
  const s = Math.min(W, H) / WT, ox = (W - WT * s) / 2, oy = (H - WT * s) / 2;
  const t = (k) => (k + .5) * Nebbia.CELLA;
  return [...c.getContext('2d').getImageData(Math.round(ox + t(i) * s), Math.round(oy + t(j) * s), 1, 1).data]; }"""

STATO = r"""(q) => ({ scoperto: Nebbia.scoperto(q.x, q.z), in_vista: Nebbia.inVista(q.x, q.z),
                    viste: Nebbia.celleViste })"""


def scena_nebbia(c):
    """La carta da scoprire: una cella lontana mai vista e' buia sulla carta M;
    andandoci diventa scoperta e in vista, tornando in piazza resta scoperta
    ma non piu' in vista. La griglia va nel salvataggio sotto la chiave della
    citta' e torna uguale; svuotata, nessuna cella e' vista. Foto della carta
    e della minimappa."""
    piazza = c.js("() => __collaudo.piazza()")
    c.tp(piazza, 1.0)
    totale = c.js("() => Nebbia.N * Nebbia.N")
    q = c.js(BUIA)
    esito = {"celle": totale, "buia": q, "foto": []}
    guasti = []
    if not q:
        return {**esito, "errore": "nessuna cella buia: la carta e' gia' tutta scoperta"}
    esito["prima"] = c.js(STATO, q)
    c.js("() => Hud.toggleMap()")
    c.page.wait_for_timeout(400)
    esito["pixel_buio"] = c.js(PIXEL_CARTA, [q["i"], q["j"]])
    esito["foto"].append(c.foto("nebbia_carta"))
    c.js("() => Hud.toggleMap()")
    c.tp(q, 1.0)
    esito["la"] = c.js(STATO, q)
    esito["foto"].append(c.foto("nebbia_mini"))
    c.tp(piazza, 1.0)
    esito["dopo"] = c.js(STATO, q)
    esito["salvataggio"] = c.js("""() => { const s = Salvataggio.stato(), k = __game.world.pianta.chiave;
      const prima = Nebbia.celleViste, salvata = Nebbia.perSalvare();
      Nebbia.rimetti({}, __game.world); const vuota = Nebbia.celleViste;
      Nebbia.rimetti(salvata, __game.world);
      return { chiave: k, nel_salvataggio: !!(s.nebbia && s.nebbia[k]), prima, vuota,
               rimessa: Nebbia.celleViste }; }""")

    b, la, d, s = esito["prima"], esito["la"], esito["dopo"], esito["salvataggio"]
    if b["scoperto"] or b["in_vista"] or not 0 < b["viste"] < totale:
        guasti.append(f"prima: {b}")
    if max(abs(x - y) for x, y in zip(esito["pixel_buio"][:3], (27, 25, 46), strict=True)) > 6:
        guasti.append(f"la cella mai vista non e' buia sulla carta: {esito['pixel_buio']}")
    if not la["scoperto"] or not la["in_vista"] or la["viste"] <= b["viste"]:
        guasti.append(f"andandoci non si scopre: {la}")
    if not d["scoperto"] or d["in_vista"]:
        guasti.append(f"tornati in piazza: {d}")
    if not s["nel_salvataggio"] or s["vuota"] or s["rimessa"] != s["prima"]:
        guasti.append(f"salvataggio: {s}")
    if guasti:
        esito["errore"] = "; ".join(guasti)
    return esito


SCENE_NEBBIA = {"nebbia": scena_nebbia}
