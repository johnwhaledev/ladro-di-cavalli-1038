// missioni_costa.js — i tipi di missione dell'atto IV, la Costa saracena
// (13/10, storia_costa.js). La corsa in cammello e' la `gara` di
// missioni_luoghi.js; qui la carovana.
//
// { tipo: 'carovana', quanti, ondate, perOndata, chi }: la carovana del
// mercante (capitolo 2). Al caravanserraglio aspettano `quanti` cammellieri
// (il ruolo `chi` di cast.js), ognuno col suo cammello o dromedario dietro.
// Arrivato da loro si parte: il primo cammelliere segue te, ognuno degli
// altri il cammello di chi gli sta davanti, e ogni bestia il suo cammelliere,
// in fila come la scorta (missioni.js: `segue`). Per strada verso l'oasi, a
// un terzo e a due terzi del cammino, i predoni (i pirati, il ruolo
// 'brigante' della Costa) sbucano di lato e assaltano: ucciderli non e'
// reato. Se muore un cammelliere o un cammello l'incarico fallisce; si vince
// quando sono tutti all'oasi. Finito, restano li' (tua scelta del 13/10: la
// carovana coi cammelli che camminano).

// All'oasi la fila continua a seguirti (se torni indietro a prenderli, ti
// vengono dietro). sosta: il ladro e' all'oasi entro questa distanza;
// arrivo: la carovana e' arrivata quando tutta la fila sta entro questa
// distanza (in fila ognuno sta a ~4,5 da chi lo precede: la coda di sei e'
// a ~25); se qualcuno si incastra (le palme), dopo `attesa` secondi col
// ladro all'oasi basta che tutti stiano entro `largo` (13/10, la tua prova:
// "98%, non arrivano mai": prima ognuno andava a un posto fisso sulla
// strada e la coda restava fuori dal raggio)
const CAROVANA = { quanti: 3, ondate: 2, perOndata: 3, sosta: 8, arrivo: 30, attesa: 6,
                   largo: 50, partenza: 5, avanti: 14, lato: 18 };
const BESTIE_CAROVANA = ['SarCammello', 'SarDromedario'];

TIPI_MISSIONE.carovana = {
  avvia(m, g) {
    const S = Missioni.luogo('caravanserraglio');
    m.partenza = S;
    m.meta = Missioni.luogo('oasi');
    m.lunga = Math.max(1, Math.hypot(m.meta.x - S.x, m.meta.z - S.z));
    m.cammellieri = [];
    m.cammelli = [];
    for (let i = 0; i < (m.quanti || CAROVANA.quanti); i++) {
      const q = Missioni.libero(S.x + (i - 1) * 2.4, S.z + 2.5);
      const n = new Npc(g.pick(g.cast(m.chi || 'carrettiere')), q.x, q.z, 'cittadino');
      Object.assign(n, { hp: 40, maxHp: 40, speed: 2.4, fisso: true, ostaggio: true,
                         missione: true });
      const r = Missioni.libero(q.x, q.z + 2);
      const b = new Npc(BESTIE_CAROVANA[i % 2], r.x, r.z, 'cittadino');
      Object.assign(b, { hp: 60, maxHp: 60, speed: 2.4, segue: n, ostaggio: true,
                         missione: true, cammello: true });
      g.npcs.push(n, b);
      m.cammellieri.push(n);
      m.cammelli.push(b);
      m.gente.push(n, b);
    }
    m.partita = false;
    m.ondata = 0;
    m.goal = S;
  },

  aggiorna(m, dt, g) {
    const p = g.player;
    if (m.cammellieri.some(n => n.dead)) return TX('missioni.fallito.cammelliere');
    if (m.cammelli.some(n => n.dead)) return TX('missioni.fallito.cammello');
    if (!m.partita) {
      if (Math.hypot(p.x - m.partenza.x, p.z - m.partenza.z) > CAROVANA.partenza) return null;
      m.partita = true;
      m.cammellieri.forEach((n, i) => { n.fisso = false; n.segue = i ? m.cammelli[i - 1] : p; });
      g.say(TX('missioni.carovana.si_parte'), 3);
    }
    m.goal = m.meta;
    // quanto cammino ha fatto il primo della fila
    const testa = m.cammellieri[0];
    m.fatto = 1 - Math.hypot(m.meta.x - testa.x, m.meta.z - testa.z) / m.lunga;
    const ondate = m.ondate ?? CAROVANA.ondate;
    if (m.ondata < ondate && m.fatto > (m.ondata + 1) / (ondate + 1))
      assaltoCarovana(m, g, testa);
    const tutti = [...m.cammellieri, ...m.cammelli];
    const entro = r => tutti.every(n => Math.hypot(n.x - m.meta.x, n.z - m.meta.z) < r);
    if (Math.hypot(p.x - m.meta.x, p.z - m.meta.z) > CAROVANA.sosta) { m.sostaT = 0; return null; }
    m.sostaT = (m.sostaT || 0) + dt;
    if (entro(CAROVANA.arrivo)) return 'fatto';
    return m.sostaT > CAROVANA.attesa && entro(CAROVANA.largo) ? 'fatto' : null;
  },

  disegna(m, g) {
    g.drawMarker(m.goal);
    if (!m.partita) for (const n of m.cammellieri) Missioni.segna(n, 'segno_sacchetto');
  },

  plancia(m) {
    const vivi = m.cammellieri.filter(n => !n.dead).length;
    return `<p><b>${TX('missioni.carovana.carovana')}</b> ${TX('missioni.carovana.cammellieri', { vivi, tutti: m.cammellieri.length })}` +
           (m.partita ? TX('missioni.carovana.oasi', { p: Math.round(Math.max(0, m.fatto || 0) * 100) }) : '') +
           TX('missioni.carovana.vivi') + '</p>';
  },

  // finita (o fallita) la carovana resta dov'e': all'oasi, o per strada
  chiudi(m) {
    for (const n of [...m.cammellieri, ...m.cammelli]) n.fisso = true;
  },
};

// I predoni: sbucano di lato alla strada, davanti alla testa della fila, e
// puntano la carovana (Nemico.meta: la marcia dell'assalto, game.js)
function assaltoCarovana(m, g, testa) {
  m.ondata++;
  const a = Math.atan2(m.meta.z - testa.z, m.meta.x - testa.x);
  const s = Math.random() < 0.5 ? 1 : -1;
  const cx = testa.x + Math.cos(a) * CAROVANA.avanti - Math.sin(a) * CAROVANA.lato * s;
  const cz = testa.z + Math.sin(a) * CAROVANA.avanti + Math.cos(a) * CAROVANA.lato * s;
  for (let i = 0; i < (m.perOndata || CAROVANA.perOndata); i++) {
    const q = Missioni.libero(cx + (i - 1) * 2.5, cz + (i % 2) * 2);
    const e = new Nemico(g.pick(g.cast('brigante')), q.x, q.z,
                         { meta: testa, hp: 46, speed: 3.6 });
    e.missione = true;
    g.nemici.push(e);
    m.gente.push(e);
  }
  g.say(m.ondata === 1 ? TX('missioni.carovana.predoni') : TX('missioni.carovana.ancora'), 3);
}
