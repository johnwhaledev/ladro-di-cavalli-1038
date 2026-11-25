// missioni_ritorno.js — i tipi di missione dell'atto V, il ritorno a
// Valdarno (13/10, storia_ritorno.js).
//
// { tipo: 'cattura', luogo, verso, sprite, nome, sgherri }: il Ciambellano
// preso vivo. Sta nel `luogo` (la corte del castello: Missioni.luogo) coi suoi
// sgherri (Nemici in divisa da guardia: ucciderli non e' reato) e ti viene
// addosso come il bersaglio di una caccia. Colpito fino a un terzo della
// vita si arrende: da li' non e' piu' un bersaglio, ti segue come un ostaggio
// (missioni.js, scorta: `segue`) e non muore piu' (la vita torna alta: i
// colpi dopo la resa non lo finiscono). Si vince portandolo nel luogo
// `verso` (la piazza); se muore prima della resa l'incarico fallisce: un
// traditore morto non confessa. La vita e' tanta perche' nessun colpo passi
// in una volta sola da sopra la resa a zero.

const CATTURA = { vita: 200, resa: 0.35, sgherri: 4, arrivo: 9, raggio: 10 };

TIPI_MISSIONE.cattura = {
  avvia(m, g) {
    const P = Missioni.luogo(m.luogo || 'corte');
    const n = new Npc(m.sprite || 'MiniNobleMan', P.x, P.z, 'assassino');
    // protetto: i suoi sgherri non lo prendono di mira (game.js,
    // bersaglioPerNemico: i nemici colpiscono anche i passanti)
    Object.assign(n, { hp: CATTURA.vita, maxHp: CATTURA.vita, speed: 2.8, bersaglio: true,
                       missione: true, protetto: true, state: 'hunt', nome: m.nome || null });
    g.npcs.push(n);
    m.gente.push(n);
    m.preso = n;
    m.arreso = false;
    for (let i = 0; i < (m.sgherri ?? CATTURA.sgherri); i++) {
      const a = i / CATTURA.sgherri * Math.PI * 2;
      const q = Missioni.libero(P.x + Math.cos(a) * 4, P.z + Math.sin(a) * 4);
      const e = new Nemico(g.pick(g.cast('guardia')), q.x, q.z,
                           { anchor: P, raggio: CATTURA.raggio, hp: 50 });
      e.missione = true;
      g.nemici.push(e);
      m.gente.push(e);
    }
    m.meta = Missioni.luogo(m.verso || 'piazza');
    m.goal = { x: n.x, z: n.z };
  },

  aggiorna(m, dt, g) {
    const p = g.player, n = m.preso;
    if (n.dead) return TX('missioni.fallito.ciambellano');
    // tolto da un'uscita da una stanza: rimesso in scena (come la caccia)
    if (!g.npcs.includes(n)) g.npcs.push(n);
    if (!m.arreso && n.hp <= n.maxHp * CATTURA.resa) {
      m.arreso = true;
      Object.assign(n, { bersaglio: false, ostaggio: true, state: 'wander', segue: p,
                         hp: 9999, maxHp: 9999 });
      g.say(TX('missioni.cattura.arreso'), 4);
    }
    if (!m.arreso) { m.goal = { x: n.x, z: n.z }; return null; }
    m.goal = m.meta;
    const qui = a => Math.hypot(a.x - m.meta.x, a.z - m.meta.z) < CATTURA.arrivo;
    return qui(n) && qui(p) ? 'fatto' : null;
  },

  disegna(m, g) {
    g.drawMarker(m.goal);
    if (!m.arreso) Missioni.segna(m.preso, 'segno_corona');
  },

  plancia(m) {
    const n = m.preso;
    if (m.arreso) return `<p><b>${TX('missioni.cattura.preso')}</b> ${TX('missioni.cattura.piazza')}</p>`;
    return `<p><b>${TX('missioni.cattura.ciambellano')}</b> ${TX('missioni.cattura.vita', { p: Math.round(n.hp / n.maxHp * 100) })}` +
           TX('missioni.cattura.senza_uccidere') + '</p>';
  },

  // a incarico chiuso va alla forca (la scena dopo): non resta in piazza.
  // Morto, resta a terra come gli altri
  chiudi(m, g) {
    const i = g.npcs.indexOf(m.preso);
    if (i >= 0 && !m.preso.dead) g.npcs.splice(i, 1);
  },
};
