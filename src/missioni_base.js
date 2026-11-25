// missioni_base.js — la consegna e il colpo, i due tipi piu' usati della
// campagna (15/10: fuori da game.js, dove stavano dal primo giorno).
//
// Tua segnalazione del 14/10: troppe missioni erano solo "raggiungi la
// stella". Le consegne e i colpi restano quel che erano, con tre aggiunte
// facoltative, dai dati dell'incarico (story.js, storia_*.js):
// - `destinatario` { chi, nome, dice }: alla meta c'e' qualcuno, col segno
//   sopra, che quando arrivi dice la sua riga (finisce nei Discorsi). Senza
//   `chi`, all'arrivo c'e' solo la riga;
// - `tempo: true`: per i "prima che..." del testo. Il tempo si misura sulla
//   strada da fare (circa 4,5 unita' al secondo piu' 15 s); finito, fallisce;
// - nel colpo, `arrivano` { chi, quanti, grido }: a un terzo del colpo arriva
//   un'ondata vera ("Tieni la posizione: arriveranno"); `arriva` { chi, nome,
//   poi, dice }: qualcuno viene al punto mentre ci sei, e a colpo finito se ne
//   va verso `poi` (l'uomo dei pirati che riceve il carico).
// Il colpo e' quello di sempre: fermo entro 3,5 dal punto il tempo sale (e
// ogni tanto e' un reato coi testimoni), lontano cala piano.

const BASE = { consegna: 4, colpo: 3.5, ondata: 0.35, lontano: 28, passo: 4.5, margine: 15 };

// un segno sopra la testa e fermo al suo posto: chi aspetta il ladro
function chiAspetta(m, g, ruolo, x, z) {
  const q = Missioni.libero(x, z);
  const a = new Npc(g.pick(g.cast(ruolo)), q.x, q.z, ruolo);
  a.missione = true; a.fisso = true; a.spettatore = true;
  a.setAnim('idle');
  g.npcs.push(a);
  m.gente.push(a);
  return a;
}

// il tempo dei "prima che": la strada da fare, con margine
function conTempo(m, g) {
  if (!m.tempo || !m.goal) return;
  const d = Math.hypot(m.goal.x - g.player.x, m.goal.z - g.player.z);
  m.timer = m.durataTempo = Math.round(d / BASE.passo + BASE.margine);
}

function scaduto(m, dt) {
  if (m.timer === undefined) return false;
  m.timer -= dt;
  return m.timer <= 0;
}

TIPI_MISSIONE.consegna = {
  avvia(m, g) {
    m.goal = m.luogo ? Missioni.luogo(m.luogo) : g.puntoInZona(m.zona, 45);
    const a = m.destinatario;
    if (a && a.chi) m.chi_ = chiAspetta(m, g, a.chi, m.goal.x + 1.5, m.goal.z - 1);
    conTempo(m, g);
  },

  // arrivati, la riga del destinatario resta il tempo di leggerla (lettere/18
  // s, almeno 3) prima del "Fatto" che la coprirebbe
  aggiorna(m, dt, g) {
    if (m.detto !== undefined) return (m.detto -= dt) <= 0 ? 'fatto' : null;
    if (scaduto(m, dt)) return TX('missioni.fallito.tardi');
    const p = g.player;
    if (Math.hypot(p.x - m.goal.x, p.z - m.goal.z) >= BASE.consegna) return null;
    const a = m.destinatario;
    if (!a || !a.dice) return 'fatto';
    const riga = a.nome ? `${a.nome}: "${a.dice}"` : a.dice;
    m.detto = Math.max(3, riga.length / 18);
    g.say(riga, m.detto + 1);
    return null;
  },

  disegna(m, g) {
    g.drawMarker(m.goal);
    if (m.chi_) Missioni.segna(m.chi_, 'segno_sacchetto');
  },

  plancia(m) {
    const a = m.destinatario;
    return (a && a.nome ? `<p><b>${TX('missioni.consegna.aspetta')}</b> ${a.nome}</p>` : '') +
           (m.timer !== undefined ? `<p><b>${TX('hud.diario.tempo')}</b> ${Math.max(0, m.timer).toFixed(0)} s</p>` : '');
  },
};

TIPI_MISSIONE.colpo = {
  avvia(m, g) {
    m.goal = m.luogo ? Missioni.luogo(m.luogo) : g.puntoInZona(m.zona, 40);
    m.prog = 0;
    const a = m.arriva;
    if (a) {
      // chi viene a prendere il carico: parte lontano, da terra, da un punto
      // con una strada fino al carico (collaudo 55: dal lato del mare la
      // strada non c'era e il colpo finiva prima che arrivasse)
      const q = partenza(m, g);
      m.ricevente = chiAspetta(m, g, a.chi, q.x, q.z);
      m.ricevente.fisso = false;
      m.ricevente.segue = { x: m.goal.x, z: m.goal.z };   // si ferma a 2,4 (game.js)
    }
  },

  aggiorna(m, dt, g) {
    const p = g.player;
    const r = m.ricevente;
    if (r && !m.visto) {
      // incastrato da qualche parte: dopo 12 s eccolo accanto al carico
      m.attesa = (m.attesa || 0) + dt;
      if (m.attesa > 12) { const q = Missioni.libero(m.goal.x + 2.5, m.goal.z); r.x = q.x; r.z = q.z; }
      if (Math.hypot(r.x - m.goal.x, r.z - m.goal.z) < 5) {
        m.visto = true;                     // e' arrivato al carico: la sua riga
        if (m.arriva.dice) g.say(m.arriva.dice, 6);
      }
    }
    if (Math.hypot(p.x - m.goal.x, p.z - m.goal.z) < BASE.colpo) {
      m.prog += dt;
      if (m.arrivano && !m.ondata && m.prog > m.durata * BASE.ondata) ondata(m, g);
      // "guarda chi riceve il carico": il colpo non finisce prima che arrivi
      if (m.prog > m.durata && (!r || m.visto)) { lasciaAndare(m, g); return 'fatto'; }
      m.prog = Math.min(m.prog, m.durata + 0.01);
      if (Math.random() < dt * 2.2) g.crime(2, null);
    } else {
      m.prog = Math.max(0, m.prog - dt * 0.6);
    }
    return null;
  },

  disegna(m, g) {
    g.drawMarker(m.goal);
  },

  plancia(m) {
    return m.ricevente && m.arriva.nome ? `<p><b>${TX('missioni.colpo.guarda')}</b> ${m.arriva.nome}</p>` : '';
  },
};

// da dove parte chi riceve il carico: a 20-28 dal punto, libero, con una
// strada fino al punto (Nav.percorso); se non c'e', a dieci passi
function partenza(m, g) {
  const w = g.world;
  for (const r of [BASE.lontano, 20])
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2;
      const x = m.goal.x + Math.cos(a) * r, z = m.goal.z + Math.sin(a) * r;
      if (!w.blocked(x, z) && Nav.percorso(w, x, z, m.goal.x, m.goal.z)) return { x, z };
    }
  return Missioni.libero(m.goal.x + 10, m.goal.z);
}

// l'ondata del colpo: da un lato, a BASE.lontano, verso il ladro
function ondata(m, g) {
  m.ondata = true;
  const a = m.arrivano, p = g.player;
  const ang = Math.random() * Math.PI * 2;
  const cx = m.goal.x + Math.cos(ang) * BASE.lontano, cz = m.goal.z + Math.sin(ang) * BASE.lontano;
  for (let i = 0; i < (a.quanti || 4); i++) {
    const q = Missioni.libero(cx + (i - 1.5) * 2.4, cz + (i % 2) * 2);
    const e = new Nemico(g.pick(g.cast(a.chi)), q.x, q.z, { meta: p, hp: 46, speed: 3.6 });
    e.missione = true;
    g.nemici.push(e);
    m.gente.push(e);
  }
  if (a.grido) g.say(a.grido, 3);
}

// a colpo finito chi ha ricevuto il carico se ne va verso `poi`; non e' piu'
// gente dell'incarico (la chiusura gli toglierebbe la strada)
function lasciaAndare(m, g) {
  const r = m.ricevente;
  if (!r) return;
  m.gente = m.gente.filter(x => x !== r);
  r.missione = false;
  r.segue = m.arriva.poi ? Missioni.luogo(m.arriva.poi) : null;
}
