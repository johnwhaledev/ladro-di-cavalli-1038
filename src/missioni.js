// missioni.js — i tipi di missione nuovi della campagna (27/09).
//
// I tipi di Valdarno (consegna, caccia, fuga, riscossione, colpo) stanno in
// game.js da sempre (il carro dal 14/10 in missioni_carro.js); i nuovi qui e in
// missioni_luoghi.js, uno per voce di TIPI_MISSIONE:
//   avvia(m, g)          prepara l'incarico: chi c'e', dove, cosa si segna
//   aggiorna(m, dt, g)   null finche' dura; 'fatto', o il perche' del fallimento
//   disegna(m, g)        segni, cerchi, orme (il mondo lo disegna game.js)
//   plancia(m)           una riga per il diario della plancia
//   dentro: true         il tipo va avanti anche dentro le stanze
// `g` sono gli accessi a game.js (Missioni.init): il giocatore, la gente, il
// mondo, e le poche funzioni che servono (say, puntoInZona, cast...).
//
// Chi nasce per un incarico porta `missione` (game.js non lo toglie per la
// distanza); a incarico chiuso, riuscito o no, torna gente come le altre.
//
// Qui: la scorta (ostaggi da riportare vivi), il duello nel cerchio, la
// bestia da cacciare seguendo le orme.

const TIPI_MISSIONE = {};

const Missioni = (() => {
  let g = null;
  function init(accessi) { g = accessi; }

  const tipo = m => m && TIPI_MISSIONE[m.tipo];
  const conosce = t => !!TIPI_MISSIONE[t];

  function avvia(m) {
    m.gente = [];
    tipo(m).avvia(m, g);
  }
  function aggiorna(m, dt) { return tipo(m).aggiorna(m, dt, g); }
  function disegna(m) { const t = tipo(m); if (t && t.disegna) t.disegna(m, g); }
  function plancia(m) { const t = tipo(m); return t && t.plancia ? t.plancia(m) : ''; }
  const valeDentro = m => !!(tipo(m) && tipo(m).dentro);
  // E su qualcuno nella stanza: l'incarico in corso se lo prende (ascolta)?
  function parla(m, r) { const t = tipo(m); return !!(t && t.parla && t.parla(m, r, g)); }
  // il suggerimento in basso e la barra di chi tiene premuto E (la chiave
  // del nostromo, missioni_nave.js), se il tipo li ha
  function suggerisci(m) { const t = tipo(m); return (t && t.suggerisci && t.suggerisci(m, g)) || ''; }
  function barra(m) { const t = tipo(m); return (t && t.barra && t.barra(m, g)) || null; }
  // E nella stanza: l'incarico in corso se lo prende (i ferri dei rematori)?
  function azione(m) { const t = tipo(m); return !!(t && t.azione && t.azione(m, g)); }

  // a incarico chiuso chi era nato per lui torna gente qualunque
  function chiudi(m) {
    if (!m || !m.gente) return;
    for (const a of m.gente) {
      a.missione = false; a.segue = null; a.prigioniero = false; a.ostaggio = false;
      a.rancore = 0;
      if (a.spettatore) { a.fisso = false; a.spettatore = false; }
    }
    const t = tipo(m);
    if (t && t.chiudi) t.chiudi(m, g);
  }

  // un punto libero a distanza d da (x, z), nella direzione a (o vicino)
  function libero(x, z) {
    for (let r = 0; r < 8; r += 0.7)
      for (let k = 0; k < 12; k++) {
        const a = k / 12 * Math.PI * 2;
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (!g.world.blocked(px, pz)) return { x: px, z: pz };
      }
    return { x, z };
  }

  // un segno sopra la testa (spada, sacchetto, corona), come in game.js
  function segna(a, segno) {
    if (a.dead) return;
    Gfx.drawWorldSprite(segno, a.x, a.z, {
      y: 2.7 + Math.sin(g.time * 2.6 + a.x) * 0.15, shadow: false, tint: [1.2, 1.2, 1.2],
    });
  }

  // Un posto preciso della citta' (`luogo` di una missione, storia_fiordo.js),
  // sempre un punto libero: la sala del castello o del jarl (l'uscio), il
  // recinto (fuori, davanti al varco della corte: dentro, senza permesso, si
  // prende la taglia), il thing (la piazza), lo hof (l'uscio della pieve), il
  // campo nemico piu' vicino
  function luogo(nome) {
    // da dentro una stanza (il palazzo dell'emiro, la sala del jarl) il "piu'
    // vicino" si misura dall'uscio: il ladro ha le coordinate della stanza
    const w = g.world, P = w.pianta, p = (Interni.dentro && Interni.porta) || g.player;
    const c = n => n * TILE + TILE / 2;
    let q = { x: c(P.PLAZA.x), z: c(P.PLAZA.y) };                  // il thing
    if (nome === 'recinto') q = { x: c(P.CASTLE.x), z: P.CORTE.y1 * TILE + 2.5 };
    if (nome === 'sala') q = w.castello ? { ...w.castello.porta }
                                        : { x: c(P.CASTLE.x), z: P.CORTE.y1 * TILE + 2.5 };
    if (nome === 'hof') q = w.chiesa ? { ...w.chiesa.porta }
                                     : { x: c(P.LUOGHI.pieve.x), z: c(P.LUOGHI.pieve.y) };
    const d = a => Math.hypot(a.x - p.x, a.z - p.z);
    if (nome === 'campo') q = w.accampamenti.slice().sort((a, b) => d(a) - d(b))[0] || q;
    // la Costa (storia_costa.js, 13/10): l'uscio del caravanserraglio piu'
    // vicino (fa da osteria), e l'oasi dove finisce la sua strada
    if (nome === 'caravanserraglio')
      q = Interni.porte.filter(u => u.tipo === 'taverna').sort((a, b) => d(a) - d(b))[0] || q;
    if (nome === 'oasi' && P.OASI) q = { x: c(P.OASI.x - P.OASI.r - 3), z: c(P.OASI.y) };
    // il molo del porto piu' vicino al suo centro: la meta' della passerella
    // (this.moli a coppie: passerella, testa; world_porto.js). Il colpo
    // dell'atto IV (14/10: a caso nella zona del porto finiva dietro le case)
    if (nome === 'molo' && w.moli && w.moli.length) {
      const cp = { x: c(P.PORT.x), z: c(P.PORT.y) };
      const mezzo = r => ({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 });
      q = w.moli.filter((r, i) => i % 2 === 0).map(mezzo)
        .sort((a, b) => Math.hypot(a.x - cp.x, a.z - cp.z) - Math.hypot(b.x - cp.x, b.z - cp.z))[0];
    }
    // un committente del mondo (l'atto V: il Nocchiero), davanti a lui
    const cm = w.spawns.givers.find(u => u.name === Storia.committente(nome));
    if (cm && !cm.stanza) q = { x: cm.x, z: cm.z + 2.5 };
    // l'atto V (storia_ritorno.js): dentro la corte del castello, a meta'
    if (nome === 'corte') q = { x: (P.CORTE.x0 + P.CORTE.x1) / 2 * TILE,
                                z: (P.CORTE.y0 + P.CORTE.y1) / 2 * TILE };
    return libero(q.x, q.z);
  }

  // chi c'e' in un incarico: il ruolo della missione (`chi`, cast.js) o quello
  // del tipo; `rosso`: la divisa del clan rivale (prepara_varianti.py)
  function chi(m, ruolo) {
    const nomi = g.cast(m.chi || ruolo);
    return g.pick(m.rosso ? nomi.map(n => n + '@rosso') : nomi);
  }

  return { init, conosce, avvia, aggiorna, disegna, plancia, chiudi, valeDentro, parla,
           suggerisci, barra, azione, libero, segna, luogo, chi };
})();

// ---------------------------------------------------------------- scorta
//
// { tipo: 'scorta', zona, quanti, verso, guardiani }: dei prigionieri legati
// in un posto della zona, coi loro carcerieri (banditi, o il ruolo
// `guardiani`: i soldati del Ciambellano nell'atto V; ucciderli non e'
// reato). Ci si avvicina a uno e lo si libera; chi e' libero ti segue per
// la strada. Si riportano tutti vivi alla meta (verso: una zona; se manca,
// la piazza). Se ne muore uno l'incarico e' fallito.

TIPI_MISSIONE.scorta = {
  avvia(m, g) {
    const P = g.puntoInZona(m.zona, 60);
    m.prigione = P;
    m.meta = m.verso ? g.puntoInZona(m.verso, 0) : { ...g.world.spawns.player };
    m.ostaggi = [];
    for (let i = 0; i < (m.quanti || 2); i++) {
      const q = Missioni.libero(P.x + (i - 0.5) * 1.6, P.z);
      const n = new Npc(g.pick(g.cast(m.chi || 'cittadino')), q.x, q.z, 'cittadino');
      Object.assign(n, { hp: 40, maxHp: 40, speed: 2.4, fisso: true, prigioniero: true,
                         ostaggio: true, missione: true });
      g.npcs.push(n);
      m.ostaggi.push(n);
      m.gente.push(n);
    }
    // i carcerieri: stanno attorno ai prigionieri, e ti vengono addosso
    for (let i = 0; i < (m.carcerieri ?? 3); i++) {
      const a = i / 3 * Math.PI * 2;
      const q = Missioni.libero(P.x + Math.cos(a) * 5, P.z + Math.sin(a) * 5);
      const e = new Nemico(g.pick(g.cast(m.guardiani || 'brigante')), q.x, q.z,
                           { anchor: P, raggio: 9, hp: 40 });
      e.missione = true;
      g.nemici.push(e);
      m.gente.push(e);
    }
    m.goal = P;
  },

  aggiorna(m, dt, g) {
    const p = g.player;
    if (m.ostaggi.some(n => n.dead)) return TX('missioni.fallito.ostaggio');
    for (const n of m.ostaggi)
      if (n.prigioniero && Math.hypot(n.x - p.x, n.z - p.z) < 2.6) {
        n.prigioniero = false; n.fisso = false; n.segue = p;
        g.say(TX('missioni.scorta.corde'), 3);
      }
    m.liberi = m.ostaggi.filter(n => !n.prigioniero).length;
    if (m.liberi < m.ostaggi.length) { m.goal = m.prigione; return null; }
    m.goal = m.meta;
    const arrivati = m.ostaggi.every(n =>
      Math.hypot(n.x - m.meta.x, n.z - m.meta.z) < 9);
    return arrivati && Math.hypot(p.x - m.meta.x, p.z - m.meta.z) < 9 ? 'fatto' : null;
  },

  disegna(m, g) {
    g.drawMarker(m.goal);
    for (const n of m.ostaggi) if (n.prigioniero) Missioni.segna(n, 'segno_sacchetto');
  },

  plancia(m) {
    return `<p><b>${TX('missioni.scorta.liberati')}</b> ${m.liberi || 0} / ${m.ostaggi.length}` +
           TX('missioni.scorta.vivi') + '</p>';
  },
};

// ---------------------------------------------------------------- duello
//
// { tipo: 'duello', zona | luogo, raggio }: un cerchio di pietre in una zona
// sgombra (o nel luogo, dove e' piu' sgombro: il thing del fiordo), lo
// sfidante al centro. Entrando nel cerchio comincia: niente armi da tiro
// (una freccia e hai perso), fuori dal cerchio piu' di tre secondi e hai
// perso. Vince chi resta in piedi: lo sfidante si arrende a un quarto della
// vita (o muore, se il colpo e' grosso). Non e' un reato: e' un duello.

const DUELLO = { raggio: 8, vita: 150, resa: 0.25, fuori: 3 };

TIPI_MISSIONE.duello = {
  avvia(m, g) {
    const R = m.raggio || DUELLO.raggio;
    // la zona piu' sgombra fra quelle provate: poche celle bloccate nel cerchio
    let best = null, bv = Infinity;
    const L = m.luogo && Missioni.luogo(m.luogo);
    for (let k = 0; k < 40; k++) {
      const c = !L ? g.puntoInZona(m.zona, 25)
        : k ? { x: L.x + (Math.random() - 0.5) * 16, z: L.z + (Math.random() - 0.5) * 16 } : L;
      let pieni = 0;
      for (let dz = -R; dz <= R; dz += 2)
        for (let dx = -R; dx <= R; dx += 2)
          if (dx * dx + dz * dz <= R * R && g.world.blocked(c.x + dx, c.z + dz)) pieni++;
      if (pieni < bv) { bv = pieni; best = c; }
      if (!pieni) break;
    }
    m.centro = best;
    m.R = R;
    m.pieni = bv;
    const s = new Npc(g.pick(g.cast(m.chi || 'duellante')), best.x, best.z, 'cittadino');
    Object.assign(s, { fisso: true, missione: true });
    g.npcs.push(s);
    m.gente.push(s);
    m.sfidante = s;
    // chi guarda: gente del posto, ferma fuori dal cerchio
    for (let i = 0; i < (m.pubblico ?? 6); i++) {
      const a = i / 6 * Math.PI * 2 + 0.3;
      const q = Missioni.libero(best.x + Math.cos(a) * (R + 2.5), best.z + Math.sin(a) * (R + 2.5));
      const n = new Npc(g.pick(g.cast('cittadino')), q.x, q.z, 'cittadino');
      Object.assign(n, { fisso: true, spettatore: true, missione: true, ostaggio: true,
                         flip: q.x > best.x });
      g.npcs.push(n);
      m.gente.push(n);
    }
    m.goal = best;
    m.fuoriT = 0;
  },

  aggiorna(m, dt, g) {
    const p = g.player;
    const d = Math.hypot(p.x - m.centro.x, p.z - m.centro.z);
    if (!m.iniziato) {
      if (d > m.R) return null;
      if (p.vehicle) { g.say(TX('missioni.duello.a_piedi'), 2); return null; }
      // lo sfidante diventa un avversario vero, che punta solo te
      const s = m.sfidante;
      const e = new Nemico(s.sprite, s.x, s.z, { anchor: m.centro, raggio: m.R - 1,
                                                 hp: m.vita || DUELLO.vita, speed: 3.6 });
      e.missione = true; e.rancore = 1e9; e.taglia = 0; e.duellante = true;
      g.npcs.splice(g.npcs.indexOf(s), 1);
      g.nemici.push(e);
      m.gente.push(e);
      m.sfidante = e;
      m.iniziato = true;
      m.tiri = g.proiettili.filter(q => !q.tiratore).length;
      g.say(p.w.distanza ? TX('missioni.duello.niente_tiro')
                         : TX('missioni.duello.comincia'), 4);
      return null;
    }
    const e = m.sfidante;
    if (g.proiettili.filter(q => !q.tiratore).length > m.tiri)
      return TX('missioni.fallito.tirato');
    m.fuoriT = d > m.R + 0.5 ? m.fuoriT + dt : 0;
    if (m.fuoriT > 0 && m.fuoriT - dt <= 0) g.say(TX('missioni.duello.torna'), 2);
    if (m.fuoriT > (m.fuori || DUELLO.fuori)) return TX('missioni.fallito.uscito');
    if (e.dead) return 'fatto';
    if (e.hp <= e.maxHp * DUELLO.resa) {
      // si arrende: resta in ginocchio, gente e non piu' nemico
      const n = new Npc(e.sprite, e.x, e.z, 'cittadino');
      Object.assign(n, { fisso: true, missione: true, flip: e.flip });
      g.nemici.splice(g.nemici.indexOf(e), 1);
      g.npcs.push(n);
      m.gente.push(n);
      g.say(TX('missioni.duello.arreso'), 4);
      return 'fatto';
    }
    return null;
  },

  disegna(m, g) {
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      Gfx.drawWorldSprite('cippo', m.centro.x + Math.cos(a) * m.R,
                          m.centro.z + Math.sin(a) * m.R, { shadowAlpha: 0.5 });
    }
    if (!m.iniziato) g.drawMarker({ x: m.centro.x, z: m.centro.z - 1.5 });
    Missioni.segna(m.sfidante, 'segno_spada');
  },

  plancia(m) {
    if (!m.iniziato) return `<p><i>${TX('missioni.duello.entra')}</i></p>`;
    const e = m.sfidante;
    return `<p><b>${TX('missioni.duello.sfidante')}</b> ${Math.max(0, Math.round(e.hp))} / ${e.maxHp}` +
           TX('missioni.duello.regole') + '</p>';
  },
};

// ---------------------------------------------------------------- imbarco
//
// { tipo: 'imbarco' }: la fuga al porto del finale dell'atto I. La taglia sale
// al massimo (lo sa tutta la ronda), e si vince arrivando alla barca del
// Nocchiero (viaggio.js, approdo). Poi il capitolo finisce e parte il finale.

TIPI_MISSIONE.imbarco = {
  avvia(m, g) {
    g.taglia(60, TX('missioni.fuga.taglia'));
    m.barca = Viaggio.approdo(g.vehicles);
    m.goal = m.barca ? { x: m.barca.x, z: m.barca.z } : null;
  },

  aggiorna(m, dt, g) {
    const p = g.player;
    if (!m.barca) return TX('missioni.fallito.barca');
    m.goal = { x: m.barca.x, z: m.barca.z };
    return Math.hypot(p.x - m.barca.x, p.z - m.barca.z) < 5 ? 'fatto' : null;
  },

  disegna(m, g) { g.drawMarker(m.goal); },

  plancia() { return `<p><b>${TX('missioni.fuga.al_porto')}</b> ${TX('missioni.fuga.barca')}</p>`; },
};

// ---------------------------------------------------------------- bestia
//
// { tipo: 'bestia', zona, orme }: una bestia forte (orso, orso bianco) sta in
// una tana lontana; dal primo segno si seguono le orme, una alla volta (la
// stella segna solo la prossima), e all'ultima la bestia esce. Vive tre volte
// un lupo e picchia piu' forte. Ucciderla e' l'incarico.

const BESTIA = { vita: 220, forza: 1.6, velocita: 4.3 };

TIPI_MISSIONE.bestia = {
  avvia(m, g) {
    const p = g.player;
    const S = g.puntoInZona(m.zona, 20);
    const n = m.orme || 7;
    // La tana: a 60-150 dal primo segno, e le orme fin li' tutte all'asciutto.
    // Una tana oltre il fiume metteva un'orma in acqua (29/09: il collaudo
    // l'ha trovata) e la strada fra due orme poteva passare il fiume a nuoto
    let L = null;
    for (let k = 0; k < 60 && !L; k++) {
      const q = g.puntoInZona(m.zona, 70);
      const d = Math.hypot(q.x - S.x, q.z - S.z);
      if (d <= 60 || d >= 150) continue;
      m.tracce = this.orme(S, q, n, g);
      if (this.asciutte(m.tracce.concat([q]), g.world)) L = q;
    }
    if (!L) { L = g.puntoInZona(m.zona, 70); m.tracce = this.orme(S, L, n, g); }
    m.tana = L;
    m.trovate = 0;
    m.goal = m.tracce[0];
    m.lontano = Math.round(Math.hypot(S.x - p.x, S.z - p.z));
  },

  // le orme: da S alla tana L, con una curva, ognuna su un punto libero
  orme(S, L, n, g) {
    const ux = L.x - S.x, uz = L.z - S.z, len = Math.hypot(ux, uz) || 1;
    const fase = Math.random() * 6.28;
    const tracce = [];
    for (let i = 0; i <= n; i++) {
      const t = i / (n + 1);
      const scarto = Math.sin(t * Math.PI * 2 + fase) * 10 * Math.sin(t * Math.PI);
      tracce.push(Missioni.libero(S.x + ux * t - uz / len * scarto,
                                  S.z + uz * t + ux / len * scarto));
    }
    return tracce;
  },

  // ogni orma libera, e fra l'una e la seguente niente acqua (cella 2)
  asciutte(pp, w) {
    const acqua = (x, z) => w.solid[Math.floor(z / w.solidS) * w.solidN + Math.floor(x / w.solidS)] === 2;
    for (let i = 0; i < pp.length; i++) {
      if (w.blocked(pp[i].x, pp[i].z)) return false;
      const b = pp[i + 1];
      if (!b) break;
      const passi = Math.ceil(Math.hypot(b.x - pp[i].x, b.z - pp[i].z) / 1.5);
      for (let k = 1; k < passi; k++)
        if (acqua(pp[i].x + (b.x - pp[i].x) * k / passi, pp[i].z + (b.z - pp[i].z) * k / passi))
          return false;
    }
    return true;
  },

  aggiorna(m, dt, g) {
    const p = g.player;
    if (m.bestia) return m.bestia.dead ? 'fatto' : null;
    const t = m.tracce[m.trovate];
    if (Math.hypot(p.x - t.x, p.z - t.z) > 4) return null;
    m.trovate++;
    if (m.trovate === 1) g.say(TX('missioni.tracce.orme'), 3);
    if (m.trovate < m.tracce.length) { m.goal = m.tracce[m.trovate]; return null; }
    // l'ultima: la bestia esce dalla tana
    const sprite = g.pick(g.cast(m.chi || 'bestia'));
    const b = new Beast(sprite, m.tana.x, m.tana.z);
    Object.assign(b, { hp: m.vita || BESTIA.vita, maxHp: m.vita || BESTIA.vita,
                       forza: BESTIA.forza, speed: BESTIA.velocita, aggressive: true,
                       missione: true });
    g.beasts.push(b);
    m.gente.push(b);
    m.bestia = b;
    m.goal = null;
    g.say(TX('missioni.tracce.ringhio'), 3);
    return null;
  },

  disegna(m, g) {
    // le orme trovate e la strada fra l'una e l'altra, piu' la prossima
    const vista = Math.min(m.trovate + 1, m.tracce.length);
    for (let i = 0; i < vista; i++) {
      const a = m.tracce[i], b = m.tracce[i + 1] || m.tana;
      const ang = Math.atan2(b.z - a.z, b.x - a.x);
      const passi = i < m.trovate ? Math.floor(Math.hypot(b.x - a.x, b.z - a.z) / 2.6) : 1;
      for (let k = 0; k < passi; k++) {
        const t = k / Math.max(1, passi);
        const lato = k % 2 ? 0.35 : -0.35;
        Gfx.drawWorldSpriteGround('icona_gemma',
          a.x + (b.x - a.x) * t - Math.sin(ang) * lato,
          a.z + (b.z - a.z) * t + Math.cos(ang) * lato,
          ang, { wu: 0.6, hu: 0.85, y: 0.05, tint: [0.26, 0.18, 0.12] });
      }
    }
    if (m.goal) g.drawMarker(m.goal);
    if (m.bestia) Missioni.segna(m.bestia, 'segno_spada');
  },

  plancia(m) {
    if (m.bestia) return `<p><b>${TX('missioni.tracce.uscita')}</b> ${TX('missioni.tracce.abbattila')}</p>`;
    return `<p><b>${TX('missioni.tracce.seguite')}</b> ${m.trovate} / ${m.tracce.length}</p>`;
  },
};

// ---------------------------------------------------------------- ascolta
//
// { tipo: 'ascolta', stanza, battute: { nome: battuta } } (08/10, l'atto III,
// passo 1 "ai remi": dialoghi, niente combattimento): nella stanza si parla
// con E a ognuno dei nomi di `battute` (la gente della stanza col suo
// "nome"); ognuno dice la sua una volta, e sentiti tutti l'incarico e' fatto,
// ma solo dopo LETTURA secondi: la chiusura del capitolo copriva l'ultima
// battuta prima di poterla leggere. Sopra chi resta da sentire, il sacchetto.

const LETTURA = 4;

TIPI_MISSIONE.ascolta = {
  dentro: true,

  avvia(m) { m.sentiti = []; m.attesa = LETTURA; },

  parla(m, r, g) {
    const battuta = m.battute[r.nome];
    if (!battuta || m.sentiti.includes(r.nome)) return false;
    m.sentiti.push(r.nome);
    g.say(`${r.nome}: ${battuta}`, 8);
    return true;
  },

  aggiorna(m, dt) {
    if (m.sentiti.length < Object.keys(m.battute).length) return null;
    m.attesa -= dt;
    return m.attesa <= 0 ? 'fatto' : null;
  },

  disegna(m) {
    if (!Interni.dentro || Interni.stanza.tipologia !== m.stanza) return;
    for (const r of Interni.stanza.residenti)
      if (m.battute[r.nome] && !m.sentiti.includes(r.nome)) Missioni.segna(r, 'segno_sacchetto');
  },

  plancia(m) {
    return `<p><b>${TX('missioni.ascolta.ascoltati')}</b> ${m.sentiti.length} / ${Object.keys(m.battute).length}</p>`;
  },
};
