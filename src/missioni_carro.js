// missioni_carro.js — il furto del carro con un carro vero (14/10, tua
// segnalazione: "dice prendi il carro ma non c'e' niente").
//
// Prima (game.js) l'incarico era solo la stella d'arrivo: ci arrivavi su un
// mezzo qualunque, anche un cavallo, e il carro del testo non esisteva. Ora
// l'incarico fa nascere il suo carro, col segno sopra:
// - in viaggio, col carrettiere a cassetta, su una strada della zona
//   (traffico.js, Traffico.nasciPer): lo raggiungi e lo rubi (E), con la
//   regola dei testimoni di tutti i carri;
// - fermo e senza nessuno (`fermo`: il carro che il gabelliere ha lasciato in
//   strada, atto I capitolo 1).
// La stella sta sul carro finche' non lo prendi, poi sulla meta: il `luogo`
// dell'incarico (il campo del Capo dei fuorilegge, `briganti`) o un punto
// della zona. Vale solo quel carro; se si sfascia, l'incarico fallisce.

const CARRO = { lontano: [35, 120], meta: 6, carri: ['carro_coperto', 'carro_merci', 'carro_fieno'] };

// un punto di una via della zona, lontano dalla meta, dove un carro ci sta:
// sei unita' sgombre lungo il carro, in un verso o nell'altro (Nav.sgombro)
function postoLibero(m, g) {
  const w = g.world;
  for (let k = 0; k < 80; k++) {
    const c = g.puntoInZona(m.zona, CARRO.lontano[0]);
    if (Math.hypot(c.x - m.meta.x, c.z - m.meta.z) < 40) continue;
    if (!w.road[w.idx(Math.floor(c.x / TILE), Math.floor(c.z / TILE))]) continue;
    for (const rot of [0, Math.PI / 2]) {
      const dx = Math.cos(rot) * 3, dz = Math.sin(rot) * 3;
      if (Nav.sgombro(w, c.x - dx, c.z - dz, c.x + dx, c.z + dz, 1.6)) return { q: c, rot };
    }
  }
  return { q: g.puntoInZona(m.zona, CARRO.lontano[0]), rot: 0 };
}

// il carro fermo e senza nessuno: su una via della zona, lontano dalla meta,
// con lo spazio di un carro attorno (la prima prova lo metteva contro una
// palizzata, mezzo coperto)
function parcheggia(m, g) {
  const w = g.world, { q, rot } = postoLibero(m, g);
  const v = new Vehicle({ type: 'carro', name: g.pick(w.pianta.CARRI || CARRO.carri),
                          x: q.x, z: q.z, rot });
  v.bestia = Bestie.tiro(w.pianta, Math.random());          // bestie.js
  v.missione = true;
  g.vehicles.push(v);
  return v;
}

TIPI_MISSIONE.furto_mezzo = {
  avvia(m, g) {
    const p = g.player;
    const d = q => Math.hypot(q.x - p.x, q.z - p.z);
    m.meta = m.luogo ? Missioni.luogo(m.luogo) : g.puntoInZona(m.zona, 55);
    if (!m.fermo) {
      // in viaggio: un nodo delle strade vicino a un punto della zona, se c'e';
      // se no piu' lontano (dal campo del bosco, atto V: collaudo 54, nessun
      // nodo a 35-120)
      const q = g.puntoInZona(m.zona, CARRO.lontano[0]);
      m.carro = Traffico.nasciPer((n, dn) => dn > CARRO.lontano[0] &&
                                             Math.hypot(n.x - q.x, n.z - q.z) < 30) ||
                Traffico.nasciPer((n, dn) => dn > CARRO.lontano[0] && dn < CARRO.lontano[1]) ||
                Traffico.nasciPer(n => Math.hypot(n.x - m.meta.x, n.z - m.meta.z) > 40);
    }
    // il carro lasciato in strada (o, se non c'e' nessuna strada per uno in
    // viaggio, fermo lo stesso: l'incarico non resta mai senza carro)
    if (!m.carro) m.carro = parcheggia(m, g);
    m.goal = m.carro ? { x: m.carro.x, z: m.carro.z } : m.meta;
    m.dista = m.carro ? Math.round(d(m.carro)) : null;
  },

  aggiorna(m, dt, g) {
    const p = g.player, v = m.carro;
    if (!v) return TX('missioni.fallito.nessun_carro');
    if (v.rotto || !g.vehicles.includes(v)) return TX('missioni.fallito.carro_rotto');
    const sopra = p.vehicle === v;
    m.preso = m.preso || sopra;
    m.goal = sopra ? m.meta : { x: v.x, z: v.z };
    const qui = Math.hypot(p.x - m.meta.x, p.z - m.meta.z) < CARRO.meta;
    if (sopra && qui) return 'fatto';
    if (qui && !sopra)
      g.say(p.vehicle ? TX('missioni.carro.non_questo') : TX('missioni.carro.gambe'), 1.6);
    return null;
  },

  disegna(m, g) {
    g.drawMarker(m.goal);
    if (m.carro && g.player.vehicle !== m.carro) Missioni.segna(m.carro, 'segno_sacchetto');
  },

  suggerisci(m, g) {
    if (!m.carro) return '';
    return g.player.vehicle === m.carro ? TX('missioni.carro.tuo')
      : (m.carro.rider ? TX('missioni.carro.raggiungilo')
                       : TX('missioni.carro.fermo'));
  },

  plancia(m) {
    return `<p><b>${TX('missioni.carro.il_carro')}</b> ${m.preso ? TX('missioni.carro.preso') : TX('missioni.carro.da_prendere')}` +
           TX('missioni.carro.solo_quello') + '</p>';
  },

  // finito (o fallito) l'incarico, il carro torna un mezzo come gli altri
  chiudi(m) {
    if (m.carro) m.carro.missione = false;
  },
};
