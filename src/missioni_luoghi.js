// missioni_luoghi.js — i tipi di missione nuovi legati a un luogo (27/09):
// la gara (in barca o a cavallo), la difesa di una porta, il furto dentro una
// stanza. Stesso formato di missioni.js (TIPI_MISSIONE).

// --------------------------------------------------------------- percorsi
//
// Un percorso sulla griglia delle collisioni (celle da 2 unita'): in largo da
// una cella, per le celle che `passa` accetta, fino alla piu' lontana entro
// `massimo` passi. Torna i punti del mondo della strada fatta.
function percorsoLungo(w, x, z, passa, massimo) {
  const N = w.solidN, S = w.solidS;
  // si parte dalla cella buona piu' vicina: il mezzo parcheggiato sta a lato
  // della via, non sopra (30/09), e dalla sua cella il percorso restava zero
  let da = Math.floor(z / S) * N + Math.floor(x / S);
  const cx0 = da % N, cy0 = (da / N) | 0;
  if (!passa(da, cx0, cy0))
    cerca: for (let r = 1; r <= 5; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const nx = cx0 + dx, ny = cy0 + dy;
          if (nx < 1 || ny < 1 || nx >= N - 1 || ny >= N - 1) continue;
          if (passa(ny * N + nx, nx, ny)) { da = ny * N + nx; break cerca; }
        }
  const dist = new Int32Array(N * N).fill(-1), padre = new Int32Array(N * N).fill(-1);
  dist[da] = 0;
  const coda = [da];
  let lontana = da;
  for (let h = 0; h < coda.length; h++) {
    const c = coda[h];
    if (dist[c] > dist[lontana]) lontana = c;
    if (dist[c] >= massimo) continue;
    const cx = c % N, cy = (c / N) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 1 || ny < 1 || nx >= N - 1 || ny >= N - 1) continue;
      const j = ny * N + nx;
      if (dist[j] >= 0 || !passa(j, nx, ny)) continue;
      dist[j] = dist[c] + 1;
      padre[j] = c;
      coda.push(j);
    }
  }
  const punti = [];
  for (let c = lontana; c >= 0; c = padre[c])
    punti.push({ x: (c % N) * S + S / 2, z: ((c / N) | 0) * S + S / 2 });
  return punti.reverse();
}

// un punto lungo una spezzata, a distanza s dall'inizio
function lungoSpezzata(pp, s) {
  for (let i = 1; i < pp.length; i++) {
    const a = pp[i - 1], b = pp[i], l = Math.hypot(b.x - a.x, b.z - a.z);
    if (s <= l) {
      const t = l ? s / l : 0;
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t,
               rot: Math.atan2(b.z - a.z, b.x - a.x) };
    }
    s -= l;
  }
  const u = pp[pp.length - 1];
  return { x: u.x, z: u.z, rot: 0, fine: true };
}

// ---------------------------------------------------------------- gara
//
// { tipo: 'gara', mezzo: 'barca' | 'cavallo' | 'cammello', tappe }: si sale
// sul mezzo e si va alla partenza; dopo il tre-due-uno si passano le tappe in
// fila (a cavallo o in cammello per le strade, in barca per l'acqua) e si
// vince se si arriva all'ultima prima del rivale. Il rivale non guida:
// scorre la stessa strada a una velocita' fissa, un poco sotto quella piena
// del mezzo.

const GARA = { tappe: 6, passo: 26, rivale: 0.78, via: 3, aTerra: 6,
               velocita: { cavallo: 14, cammello: 14, barca: 10 } };

TIPI_MISSIONE.gara = {
  avvia(m, g) {
    const p = g.player, w = g.world, tipo = m.mezzo || 'cavallo';
    // la gara a cavallo si corre a cavallo: l'asino (bestie.js) e' piu' lento;
    // la corsa dell'atto IV in cammello o in dromedario (storia_costa.js)
    const cammello = tipo === 'cammello';
    const adatto = v => (cammello ? Bestie.cammello(v) : v.type === tipo && !v.sella);
    const vicino = g.vehicles.filter(v => adatto(v) && !v.rotto &&
                                          (!v.rider || v.rider === p))
      .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    let v = p.vehicle && adatto(p.vehicle) ? p.vehicle : vicino[0];
    // il cammello del mercante: accanto a te, se non ce n'e' uno a due passi
    if (cammello && v && v !== p.vehicle && Math.hypot(v.x - p.x, v.z - p.z) > 30) v = null;
    if (!v && tipo !== 'barca') {
      const q = Missioni.libero(p.x + 2.5, p.z + 1.5);
      const sella = cammello && Assets.charDef(Bestie.CAMMELLO.sella) ? Bestie.CAMMELLO : {};
      v = new Vehicle({ type: 'cavallo', name: 'cavallo_baio', x: q.x, z: q.z, rot: 0, ...sella });
      g.vehicles.push(v);
    }
    m.mezzoGara = v;
    m.partenza = { x: v.x, z: v.z };
    const acqua = j => w.solid[j] === 2;
    const strada = (j, cx, cy) => !w.solid[j] &&
      w.road[w.idx(Math.floor(cx * w.solidS / TILE), Math.floor(cy * w.solidS / TILE))];
    const n = m.tappe || GARA.tappe;
    const via = percorsoLungo(w, v.x, v.z, tipo === 'barca' ? acqua : strada,
                              Math.round(n * GARA.passo / w.solidS));
    m.strada = [m.partenza, ...via];
    // le tappe ogni `passo` unita' lungo la strada; l'ultima e' l'arrivo
    m.lunga = 0;
    for (let i = 1; i < m.strada.length; i++)
      m.lunga += Math.hypot(m.strada[i].x - m.strada[i - 1].x, m.strada[i].z - m.strada[i - 1].z);
    m.tappe_ = [];
    for (let s = GARA.passo; s < m.lunga - 4; s += GARA.passo) m.tappe_.push(lungoSpezzata(m.strada, s));
    m.tappe_.push(lungoSpezzata(m.strada, m.lunga));
    m.prossima = 0;
    m.stato = 'attesa';
    m.rivale = { s: 0, v: GARA.velocita[tipo] * (m.rivaleK || GARA.rivale) };
    const base = g.vehicles.find(b => b.type === 'barca');
    m.barcaRivale = tipo === 'barca' && base
      ? new Vehicle({ type: 'barca', name: base.name, scala: base.scala, vela: base.vela,
                      bandiera: 'bandiera_3', x: v.x, z: v.z, rot: 0 })
      : null;
    m.aTerraT = 0;
    m.goal = m.partenza;
  },

  aggiorna(m, dt, g) {
    const p = g.player, sopra = p.vehicle === m.mezzoGara;
    if (m.stato === 'attesa') {
      m.goal = sopra ? m.partenza : m.mezzoGara;
      if (sopra && Math.hypot(p.x - m.partenza.x, p.z - m.partenza.z) < 8) {
        m.stato = 'via'; m.t = GARA.via;
        g.say(TX('missioni.gara.tre_due_uno'), GARA.via);
      }
      return null;
    }
    if (m.stato === 'via') {
      m.t -= dt;
      if (m.t <= 0) { m.stato = 'corsa'; g.say(TX('missioni.gara.via'), 1.5); }
      return null;
    }
    const r = m.rivale;
    r.s = Math.min(m.lunga, r.s + r.v * dt);
    m.aTerraT = sopra ? 0 : m.aTerraT + dt;
    if (m.aTerraT > GARA.aTerra) return TX('missioni.fallito.mezzo');
    const t = m.tappe_[m.prossima];
    if (sopra && Math.hypot(p.x - t.x, p.z - t.z) < 7) {
      m.prossima++;
      if (m.prossima >= m.tappe_.length) return 'fatto';
    }
    if (r.s >= m.lunga) return TX('missioni.fallito.rivale');
    m.goal = m.tappe_[m.prossima];
    return null;
  },

  disegna(m, g) {
    if (m.stato === 'attesa' || m.stato === 'via') g.drawMarker(m.goal);
    else {
      g.drawMarker(m.tappe_[m.prossima]);
      const dopo = m.tappe_[m.prossima + 1];
      if (dopo) Gfx.drawWorldSprite('icona_stella_vuota', dopo.x, dopo.z,
                                    { hu: 1.2, wu: 1.2, y: 2.2, shadow: false });
    }
    // il rivale: un cavaliere, o una barca con uno a poppa; corre la stessa
    // strada, disegnato di fianco (tre unita') per non stare sotto di te
    const q = lungoSpezzata(m.strada, Math.max(1, m.rivale.s));
    const flip = Math.cos(q.rot) < 0;
    const fps = Assets.manifest.chars.frame_rates.run || 10;
    const fermo = m.stato !== 'corsa';
    q.x -= Math.sin(q.rot) * 3; q.z += Math.cos(q.rot) * 3;
    if (m.barcaRivale) {
      Object.assign(m.barcaRivale, { x: q.x, z: q.z, rot: q.rot,
                                     speed: fermo ? 0 : m.rivale.v,
                                     rider: { sprite: g.pick(g.cast('portuale')), frame: 0 } });
      g.drawVehicle(m.barcaRivale);
    } else if (m.mezzo === 'cammello') {
      // in cammello: il dromedario, e sopra la gobba il cammelliere (alto
      // quanto il ladro in sella, build_ladro.py: 9 pixel), un filo davanti
      const k = Math.floor(g.time * fps);
      Gfx.drawChar('SarDromedario', fermo ? 'idle' : 'run', k, q.x, q.z, { flip });
      Gfx.drawChar(g.cast('carrettiere')[0], 'idle', k, q.x, q.z + 0.05,
                   { flip, shadow: false, y: 9 / 6.829 });
    } else {
      Gfx.drawChar(g.cast('guardia_a_cavallo')[0], fermo ? 'idle' : 'run',
                   Math.floor(g.time * fps), q.x, q.z, { flip });
    }
  },

  plancia(m) {
    if (m.stato !== 'corsa') return `<p><i>${TX('missioni.gara.partenza')}</i></p>`;
    return `<p><b>${TX('missioni.gara.tappe')}</b> ${m.prossima} / ${m.tappe_.length}` +
           TX('missioni.gara.rivale', { p: Math.round(m.rivale.s / m.lunga * 100) }) + '</p>';
  },
};

// ---------------------------------------------------------------- difesa
//
// { tipo: 'difesa', ondate, perOndata, porta, chi }: una porta della cinta
// (la piu' vicina, o `porta`: l'indice fra le porte di terra, approdo
// escluso), con qualche guardia al tuo fianco. Assalta il clan rosso, o chi
// dice `chi` (un ruolo di cast.js, senza divisa: i banditi).
// Arrivati alla porta suona il corno e dal fuori arrivano le ondate; se i
// nemici restano sulla porta troppo a lungo la sfondano. Si vince quando
// l'ultima ondata e' a terra. Intanto gli assalti di tutti i giorni tacciono.

const DIFESA = { ondate: 3, perOndata: 4, intervallo: 22, breccia: 12, alleati: 3,
                 lontano: 44, suPorta: 5 };
const FUORI = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] };

TIPI_MISSIONE.difesa = {
  avvia(m, g) {
    const p = g.player;
    const porte = g.world.pianta.GATES.filter(q => !q.approdo);
    const c = q => ({ x: q.x * TILE + TILE / 2, z: q.y * TILE + TILE / 2 });
    const q = m.porta !== undefined ? porte[m.porta]
      : porte.slice().sort((a, b) => Math.hypot(c(a).x - p.x, c(a).z - p.z) -
                                     Math.hypot(c(b).x - p.x, c(b).z - p.z))[0];
    const [fx, fz] = FUORI[q.dir];
    const varco = c(q);
    m.fuori = [fx, fz];
    m.porta_ = Missioni.libero(varco.x - fx * 4, varco.z - fz * 4);
    m.stato = 'attesa';
    m.ondata = 0;
    m.breccia = 0;
    m.nemiciOndate = [];
    for (let i = 0; i < DIFESA.alleati; i++) {
      const a = Missioni.libero(m.porta_.x - fz * (i - 1) * 3 - fx * 2,
                                m.porta_.z + fx * (i - 1) * 3 - fz * 2);
      const gu = new Guard(a.x, a.z, g.pick(g.cast('guardia')), { x: a.x, z: a.z, raggio: 6 });
      gu.missione = true;
      g.guards.push(gu);
      m.gente.push(gu);
    }
    m.goal = m.porta_;
  },

  aggiorna(m, dt, g) {
    const p = g.player;
    if (m.stato === 'attesa') {
      if (Math.hypot(p.x - m.porta_.x, p.z - m.porta_.z) > 14) return null;
      m.stato = 'assedio';
      m.prossimaT = 4;
      Sfx.horn();
      g.say(TX('missioni.difesa.corno'), 4);
    }
    g.assalto.prossimo = Math.max(g.assalto.prossimo, 40);
    m.prossimaT -= dt;
    const ondate = m.ondate || DIFESA.ondate;
    if (m.ondata < ondate && m.prossimaT <= 0) {
      const [fx, fz] = m.fuori;
      const guerrieri = m.chi ? g.cast(m.chi) : g.cast('nemico_assalto').map(n => n + '@rosso');
      for (let i = 0; i < (m.perOndata || DIFESA.perOndata); i++) {
        const lato = (Math.random() - 0.5) * 16;
        const q = Missioni.libero(m.porta_.x + fx * DIFESA.lontano - fz * lato,
                                  m.porta_.z + fz * DIFESA.lontano + fx * lato);
        const e = new Nemico(g.pick(guerrieri), q.x, q.z,
                             { meta: { ...m.porta_ }, hp: 50, speed: 3.8 });
        e.missione = true;
        g.nemici.push(e);
        m.gente.push(e);
        m.nemiciOndate.push(e);
      }
      m.ondata++;
      m.prossimaT = DIFESA.intervallo;
      if (m.ondata > 1) g.say(TX('missioni.difesa.ondata', { n: m.ondata, di: ondate }), 2.5);
    }
    // chi sta sulla porta la sfonda, a poco a poco
    const sopra = m.nemiciOndate.some(e => !e.dead &&
      Math.hypot(e.x - m.porta_.x, e.z - m.porta_.z) < DIFESA.suPorta);
    if (sopra) m.breccia += dt;
    if (m.breccia > DIFESA.breccia) return TX('missioni.fallito.porta');
    if (m.ondata >= ondate && m.nemiciOndate.every(e => e.dead)) return 'fatto';
    return null;
  },

  disegna(m, g) { g.drawMarker(m.porta_); },

  plancia(m) {
    if (m.stato === 'attesa') return `<p><i>${TX('missioni.difesa.raggiungi')}</i></p>`;
    const vivi = m.nemiciOndate.filter(e => !e.dead).length;
    return `<p><b>${TX('missioni.difesa.ondata_t')}</b> ${m.ondata} / ${m.ondate || DIFESA.ondate}` +
           TX('missioni.difesa.stato', { vivi, s: Math.max(0, DIFESA.breccia - m.breccia).toFixed(0) }) + '</p>';
  },
};

// ---------------------------------------------------------------- furto
//
// { tipo: 'furto', stanza, durata }: dentro una stanza di una tipologia
// (l'uscio segnato e' uno solo), un forziere nell'angolo piu' lontano da chi ci
// sta. Si forza restando accanto `durata` secondi, ma solo quando chi e' nella
// stanza guarda altrove: si voltano ogni pochi secondi. Se ti vede mentre
// forzi, l'incarico e' fallito. Col bottino si esce dalla porta.

// 14/10, la tua prova ("impossibile"): ci volevano 5 s di fila accanto al
// forziere, ma chi sorveglia si girava ogni 2,5-5 s; con la vista a 9, in
// un'osteria piccola, ti vedevano tutti, e il forziere poteva stare a 3
// dall'oste. Ora: 3 s, si girano ogni 3,5-6, vede chi e' entro 6, il
// forziere ad almeno 4 da tutti; mezzo secondo di grazia (`grazia`) per
// scostarsi quando uno si volta, e via dal forziere il lavoro cala piano
// (`cala`): si puo' fare in piu' riprese
const FURTO = { durata: 3, vista: 6, giro: [3.5, 6], accanto: 1.9, lontano: 4, grazia: 0.5,
                cala: 0.3 };
// chi, fra quelli che sorvegliano, vede il punto q: vicino e voltato verso di lui
const chiVede = (chi, q) => chi.find(r => Math.hypot(q.x - r.x, q.z - r.z) < FURTO.vista &&
                                          (q.x - r.x) * (r.flip ? -1 : 1) > -0.3);

TIPI_MISSIONE.furto = {
  dentro: true,

  avvia(m, g) {
    const p = g.player;
    const porte = Interni.porte.filter(q => q.tipo === (m.stanza || 'taverna'));
    const d = q => Math.hypot(q.x - p.x, q.z - p.z);
    m.uscio = porte.filter(q => d(q) > 35 && d(q) < 170).sort((a, b) => d(a) - d(b))[0] ||
              porte.sort((a, b) => d(a) - d(b))[0];
    m.goal = { x: m.uscio.x, z: m.uscio.z };
    m.prog = 0;
  },

  // chi sorveglia: la gente vera nelle stanze dove si combatte, i disegnati
  // nelle altre
  sentinelle(g) {
    const s = Interni.stanza;
    return s.combattimento ? g.inStanza().filter(n => !n.dead) : s.residenti;
  },

  aggiorna(m, dt, g) {
    const p = g.player;
    if (!Interni.dentro) return m.preso ? 'fatto' : null;
    if (Interni.porta !== m.uscio) return null;
    const s = Interni.stanza;
    const chi = this.sentinelle(g);
    if (!m.forziere) this.scegliForziere(m, s, chi);
    // si voltano ogni pochi secondi
    for (const r of chi) {
      if (r.flipPrima === undefined) { r.flipPrima = !!r.flip; m.voltati = (m.voltati || []).concat([r]); }
      r.giraT = (r.giraT ?? FURTO.giro[0] + Math.random() * 2) - dt;
      if (r.giraT <= 0) {
        r.flip = !r.flip;
        r.giraT = FURTO.giro[0] + Math.random() * (FURTO.giro[1] - FURTO.giro[0]);
      }
    }
    if (m.preso) return null;
    const vicino = Math.hypot(p.x - m.forziere.x, p.z - m.forziere.z) < FURTO.accanto;
    if (!vicino) { m.prog = Math.max(0, m.prog - dt * FURTO.cala); m.vistoT = 0; return null; }
    if (chiVede(chi, p)) {
      m.vistoT = (m.vistoT || 0) + dt;
      if (m.vistoT > FURTO.grazia) return TX('missioni.fallito.forziere');
      return null;
    }
    m.vistoT = 0;
    m.prog += dt;
    if (m.prog >= (m.durata || FURTO.durata)) {
      m.preso = true;
      g.say(TX('missioni.furto.preso'), 3);
    }
    return null;
  },

  // nella stanza giusta, cosa fare e quanto manca (14/10, la tua prova: "come
  // faccio?"): il suggerimento in basso e la barra dell'HUD
  qui(m) { return Interni.dentro && Interni.porta === m.uscio && !!m.forziere; },

  suggerisci(m, g) {
    if (!this.qui(m)) return '';
    if (m.preso) return TX('missioni.furto.esci');
    const p = g.player, guardato = chiVede(this.sentinelle(g), m.forziere);
    if (Math.hypot(p.x - m.forziere.x, p.z - m.forziere.z) < FURTO.accanto)
      return TX('missioni.furto.resta');
    return guardato ? TX('missioni.furto.guardato')
                    : TX('missioni.furto.vai');
  },

  barra(m) {
    if (!this.qui(m) || m.preso || !m.prog) return null;
    return { etichetta: TX('missioni.furto.forziere'), prog: m.prog, richiesto: m.durata || FURTO.durata,
             visto: false, verbo: TX('missioni.furto.lo_forzi') };
  },

  // Il forziere sta sotto gli occhi di qualcuno: una cella libera fra 4 e 6
  // da chi sorveglia (piu' in fondo possibile, lontano dalla soglia), cosi'
  // aspettare che si volti conta. In una stanza vuota, la cella piu' in fondo
  scegliForziere(m, s, chi) {
    const c = Interni.centro();
    const x0 = c.x - s.W * s.C / 2, z0 = c.z - s.H * s.C / 2;
    let best = null, bv = -Infinity;
    for (let k = 0; k < s.H - 2; k++)
      for (let i = 0; i < s.W; i++) {
        if (s.solido[k * s.W + i]) continue;
        const x = x0 + (i + 0.5) * s.C, z = z0 + (k + 0.5) * s.C;
        const d = Math.min(99, ...chi.map(r => Math.hypot(r.x - x, r.z - z)));
        const v = (d >= FURTO.lontano && d <= FURTO.vista ? 100 : 0) - k - d * 0.1;
        if (v > bv) { bv = v; best = { x, z }; }
      }
    m.forziere = best;
  },

  // chi si e' voltato torna com'era (le stanze disegnate sono le stesse per
  // tutti gli usci della tipologia)
  chiudi(m) {
    for (const r of m.voltati || []) { r.flip = r.flipPrima; delete r.flipPrima; delete r.giraT; }
  },

  disegna(m, g) {
    if (!Interni.dentro) { if (!m.preso) g.drawMarker(m.goal); return; }
    if (Interni.porta !== m.uscio || !m.forziere || m.preso) return;
    Gfx.drawWorldSprite('cassa', m.forziere.x, m.forziere.z - 0.9, { shadowAlpha: 0.6 });
    g.drawMarker(m.forziere);
  },

  plancia(m) {
    if (m.preso) return `<p><b>${TX('missioni.furto.bottino')}</b> ${TX('missioni.furto.esci_porta')}</p>`;
    return `<p><b>${TX('missioni.furto.forziere_t')}</b> ${m.prog.toFixed(1)} / ${m.durata || FURTO.durata} s` +
           TX('missioni.furto.nessuno_guarda') + '</p>';
  },
};
