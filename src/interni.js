// interni.js — le stanze dentro le case: formato, ingresso, uscita, disegno.
//
// Tipologie, non case: ogni edificio di un tipo (edificio_taverna) apre sulla
// stessa stanza; una stanza con "luogo" sta dietro una porta sola (la bottega
// di Ferrante, la Lanterna Rossa). Tutte in src/stanze/<tipologia>.json.
// Una stanza con "uscite" (il cunicolo) ha piu' vani nel muro in fondo, ognuno
// "verso" un punto del mondo (world[luogo].porte[verso]): si entra da un
// capo e si esce dall'altro. Un vano "verso" un'altra stanza porta in quella
// (la botola fra la stiva e il ponte della nave, src/stanze/nave/). La
// stanza sta FUORI dal mondo, a coordinate negative dove non c'e' terreno ne'
// chunk: la disegna lo stesso motore (pavimento come quad a terra, parete e
// arredo come billboard, le luci del motore), alla grana dei personaggi — una
// cella di stanza e' una tile Kenney da 16 px, 2,34 unita'.
//
// Mentre sei dentro il mondo fuori si ferma (game.js non lo aggiorna): e' la
// scelta piu' semplice per la fase 1, e si puo' cambiare. Nelle stanze con
// "combattimento" chi ci sta e' gente vera (game.js ne fa degli Npc: si
// colpisce, fugge, muore); nelle altre e' disegnata e non si combatte.

const Interni = (() => {
  const ORIGINE = { x: -320, z: -320 };     // angolo nord-ovest della stanza
  const TIPOLOGIE = ['taverna', 'fucina', 'casa_piacere', 'chiesa', 'castello', 'tenda',
                     'cunicolo', 'stiva', 'ponte', 'cabina'];
  // le stanze che non sono di una citta': la nave pirata dell'atto III (nave.js),
  // la stessa dappertutto
  const CARTELLA = { stiva: 'nave/', ponte: 'nave/', cabina: 'nave/' };
  const stanze = {};
  const porte = [];                         // gli usci nel mondo: {x, z, tipo}
  let stato = null;                         // {stanza, porta} mentre sei dentro
  // Appena entrati i vani restano chiusi finche' non si lascia la freccia in
  // giu' (game.js, apriVani): chi passava la botola tenendola premuta
  // arrivava davanti al vano dell'altra stanza, ci ricadeva dentro e faceva
  // avanti e indietro fra stiva e ponte senza fermarsi mai (07/10)
  let vaniChiusi = false;

  const atlante = rif => 'k_' + rif.replace(':', '_');   // come interni.py
  // i testi delle stanze stanno nel file della lingua: nel json "@chiave" (18/10)
  const traduci = o => (typeof o === 'string' ? (o[0] === '@' ? TX(o.slice(1)) : o)
    : Array.isArray(o) ? o.map(traduci)
      : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, traduci(v)])) : o);

  function prepara(j) {
    const [W, H] = j.celle;
    const C = Assets.world(atlante(j.pavimento[0])).wu;
    const cx = i => ORIGINE.x + (i + 0.5) * C;
    const cz = k => ORIGINE.z + (k + 0.5) * C;
    const solido = new Uint8Array(W * H);
    // "calpestabile": una riga per fila di celle, '#' dove si cammina (il
    // ponte della nave fra le murate, nave.js); il resto e' mare
    if (j.calpestabile)
      j.calpestabile.forEach((riga, k) => {
        for (let i = 0; i < W; i++) if (riga[i] !== '#') solido[k * W + i] = 1;
      });
    for (const a of j.arredo)
      if (a.solido) solido[a.cella[1] * W + a.cella[0]] = 1;
    // chi puo' fuggire non occupa una cella: e' un ostacolo che si muove
    if (!j.combattimento)
      for (const r of j.residenti) solido[r.cella[1] * W + r.cella[0]] = 1;
    const vani = j.uscite ? j.uscite.map(u => u.cella) : (j.porta === undefined ? [] : [j.porta]);
    return {
      ...j, W, H, C, solido,
      // gli oggetti poggiano sul fondo della loro cella, i personaggi al centro;
      // un arredo con "pezzo" e' uno sprite del mondo (crocifisso, gonfaloni);
      // senza tile ne' pezzo non si disegna: e' gia' nel disegno della stanza
      // (la grata del ponte, la rastrelliera) e ha solo la cella o l'azione
      arredo: j.arredo.map(a => ({ ...a, nome: a.pezzo || (a.tile ? atlante(a.tile) : null),
                                   x: cx(a.cella[0]), z: cz(a.cella[1]) + C * 0.45 })),
      residenti: j.residenti.map(r => ({ ...r, x: cx(r.cella[0]), z: cz(r.cella[1]) })),
      luci: j.luci.map(l => ({ x: cx(l.cella[0]), y: 1.8, z: cz(l.cella[1]) + C * 0.3,
                               color: l.colore, radius: l.raggio,
                               flicker: l.tremola ? 1.5 : 0 })),
      entrata: { x: cx(vani[0]), z: cz(H - 1) },
      // i vani nel muro in fondo: uno per le case, uno per capo nel cunicolo,
      // nessuno sul ponte della nave
      vani,
      entrate: Object.fromEntries((j.uscite || []).map(u =>
        [u.verso, { x: cx(u.cella), z: cz(H - 1) }])),
      soglia: ORIGINE.z + H * C,
    };
  }

  async function carica(world) {
    // di nuovo per ogni citta' (viaggio.js): gli usci della citta' di prima via
    porte.length = 0;
    stato = null;
    // una citta' puo' avere le sue stanze (il fiordo: src/stanze/fiordo/), e
    // dove non ne ha una tiene quella di Valdarno
    const S = world.pianta.STANZE;
    for (const t of TIPOLOGIE) {
      const sua = CARTELLA[t] || (S && S.tipi.includes(t) ? `${S.cartella}/` : '');
      const r = await fetch(`src/stanze/${sua}${t}.json`, { cache: 'no-store' });
      stanze[t] = prepara(traduci(await r.json()));
    }
    // una stanza "di luogo" ha la sua porta nel mondo (world.fucina, ...);
    // le altre l'uscio di ogni edificio del tipo, sotto la facciata, al centro
    for (const t of TIPOLOGIE) {
      const s = stanze[t];
      if (s.luogo) {
        const l = world[s.luogo];
        if (l && l.porte)
          for (const u of s.uscite) {
            const q = l.porte[u.verso];
            porte.push({ x: q.x, z: q.z, tipo: t, verso: u.verso });
          }
        else if (l) porte.push({ x: l.porta.x, z: l.porta.z, tipo: t });
        continue;
      }
      for (const p of world.props)
        if (s.edifici.includes(p.name)) porte.push({ x: p.x, z: p.z + 1.6, tipo: t });
    }
  }

  function portaVicina(x, z) {
    for (const p of porte) if (Math.hypot(p.x - x, p.z - z) < 3) return p;
    return null;
  }

  // porta.cella: si comincia in una cella della stanza invece che sulla soglia
  // (il ladro che si sveglia al remo, nave.js)
  function entra(porta) {
    stato = { stanza: stanze[porta.tipo], porta };
    vaniChiusi = true;
    const s = stato.stanza;
    if (porta.cella)
      return { x: ORIGINE.x + (porta.cella[0] + 0.5) * s.C,
               z: ORIGINE.z + (porta.cella[1] + 0.5) * s.C };
    return { ...(porta.verso ? s.entrate[porta.verso] : s.entrata) };
  }

  // il vano del muro in fondo piu' vicino a x
  function vanoVicino(s, x) {
    let best = s.uscite[0], bd = Infinity;
    for (const v of s.uscite) {
      const d = Math.abs(ORIGINE.x + (v.cella + 0.5) * s.C - x);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  // La "porta" per entra() nella stanza `tipo`, venendo da questa: lo stesso
  // punto del mondo di prima (dove si torna); si arriva nella cella che quella
  // stanza dice ("arrivi", il ponte della nave) o davanti al suo vano verso qui
  function versoLa(tipo) {
    const s = stato.stanza, a = stanze[tipo].arrivi;
    return { x: stato.porta.x, z: stato.porta.z, tipo, verso: s.tipologia,
             cella: a && a[s.tipologia] };
  }

  // Se il vano piu' vicino a x porta in un'altra stanza: la sua porta. Se no null
  function oltre(x) {
    const s = stato.stanza;
    if (!s.uscite || x === undefined) return null;
    const v = vanoVicino(s, x);
    return stanze[v.verso] ? versoLa(v.verso) : null;
  }

  // cosa dice il vano piu' vicino ("Sali sul ponte"), se lo dice
  function cartello(x) {
    const s = stato.stanza;
    return s.uscite ? vanoVicino(s, x).dice || null : null;
  }

  // dove ti rimette fuori l'uscio (anche senza uscire: il salvataggio)
  function uscita() {
    const p = stato.porta;
    return { x: p.x, z: p.z + 1.2 };
  }

  // x: dove passi la soglia. Da una stanza con piu' uscite esci dal vano
  // piu' vicino, cioe' nel punto del mondo a cui porta
  function esci(x) {
    let u = uscita();
    const s = stato.stanza;
    if (s.uscite && x !== undefined) {
      const best = vanoVicino(s, x);
      const p = porte.find(q => q.tipo === s.tipologia && q.verso === best.verso);
      if (p) u = { x: p.x, z: p.z + 1.2 };
    }
    stato = null;
    return u;
  }

  // ---- collisioni: le celle piene, i muri, e il vano della porta in fondo
  function blocked(x, z) {
    const s = stato.stanza;
    const i = Math.floor((x - ORIGINE.x) / s.C), k = Math.floor((z - ORIGINE.z) / s.C);
    if (k === s.H && s.vani.includes(i)) return vaniChiusi;
    if (i < 0 || k < 0 || i >= s.W || k >= s.H) return true;
    return !!s.solido[k * s.W + i];
  }

  function move(x, z, dx, dz, r = 0.45) {
    let nx = x + dx, nz = z + dz;
    if (blocked(nx + Math.sign(dx) * r, z)) nx = x;
    if (blocked(x, nz + Math.sign(dz) * r)) nz = z;
    return [nx, nz];
  }

  // chi esce dalla soglia, esce dalla casa
  function fuoriDallaPorta(z) { return z > stato.stanza.soglia + 0.6; }

  // chi parla, il piu' vicino entro il raggio (08/10: fra i rematori della
  // stiva, seduti a una cella l'uno dall'altro, rispondeva il primo in lista)
  function vicinoA(x, z, raggio) {
    let best = null, bd = raggio;
    for (const r of stato.stanza.residenti) {
      const d = Math.hypot(r.x - x, r.z - z);
      if (r.parla && d < bd) { bd = d; best = r; }
    }
    return best;
  }

  // un arredo che fa qualcosa (il giaciglio e la cassa della tenda)
  function azioneVicina(x, z, raggio = 2.6) {
    return stato.stanza.arredo.find(a => a.azione &&
      Math.hypot(a.x - x, a.z - z) < raggio) || null;
  }

  function voce() {
    const v = stato.stanza.voci;
    return v[Math.floor(Math.random() * v.length)];
  }

  // ---- disegno

  // Il tappeto: "tappeto": {"base": "rpg:RR_CC", "riquadri": [[i0, k0, i1, k1]]}.
  // La base e' l'angolo in alto a sinistra di un tappeto a nove pezzi del
  // foglio (angoli, bordi, centro): ogni cella prende il pezzo della sua
  // posizione nel riquadro.
  function tappeto(s, i, k) {
    const t = s.tappeto;
    if (!t) return null;
    const r = t.riquadri.find(([i0, k0, i1, k1]) => i >= i0 && i <= i1 && k >= k0 && k <= k1);
    if (!r) return null;
    const [foglio, cella] = t.base.split(':');
    const [R, C] = cella.split('_').map(Number);
    const passo = (v, a, b) => (v === a ? 0 : (v === b ? 2 : 1));
    const due = n => String(n).padStart(2, '0');
    return `${foglio}:${due(R + passo(k, r[1], r[3]))}_${due(C + passo(i, r[0], r[2]))}`;
  }

  // il ponte della nave e' una stanza col mare intorno (nave.js); le altre
  // hanno pavimento e muri
  function disegna(time) {
    const s = stato.stanza;
    if (s.mare) Nave.disegnaPonte(s, time, ORIGINE);
    else pavimentoEMuri(s);
    for (const a of s.arredo) {
      if (!a.nome) continue;                      // e' gia' nel disegno della stanza
      Gfx.drawWorldSprite(a.nome, a.x, a.z, { flip: !!a.flip, shadowAlpha: 0.6 });
      Fuochi.sulPezzo(a.nome, a.x, a.z, !!a.flip, time);      // i fuochi vivi, se ne ha
    }
    if (s.mare) Nave.disegnaAlbero(s, ORIGINE);
    if (s.combattimento) return;          // li disegna game.js, sono Npc
    const rate = Assets.manifest.chars.frame_rates.idle || 6;
    for (const r of s.residenti)
      Gfx.drawChar(r.sprite, 'idle', Math.floor(time * rate + r.x), r.x, r.z,
                   { flip: !!r.flip });
  }

  function pavimentoEMuri(s) {
    const C = s.C, g = -Math.PI / 2;                     // immagine col capo a nord
    const x0 = ORIGINE.x, z0 = ORIGINE.z;
    // il pavimento sta a quota zero come il terreno: alla quota di default dei
    // quad a terra (0,15, pensata per i carri) copriva i personaggi, che sono
    // billboard inclinati all'indietro e poggiano a 0,02
    const suolo = { y: 0 };
    for (let k = 0; k < s.H; k++)
      for (let i = 0; i < s.W; i++) {
        const t = tappeto(s, i, k) || s.pavimento[(i * 7 + k * 13) % s.pavimento.length];
        Gfx.drawWorldSpriteGround(atlante(t), x0 + (i + 0.5) * C, z0 + (k + 0.5) * C, g,
                                  suolo);
      }
    // il vano della porta, e i muri bassi visti dall'alto sui tre lati
    for (const v of s.vani)
      Gfx.drawWorldSpriteGround(atlante(s.pavimento[0]), x0 + (v + 0.5) * C,
                                z0 + (s.H + 0.5) * C, g, suolo);
    const bordo = atlante(s.bordo);
    for (let k = 0; k <= s.H; k++) {
      Gfx.drawWorldSpriteGround(bordo, x0 - 0.5 * C, z0 + (k + 0.5) * C, g, suolo);
      Gfx.drawWorldSpriteGround(bordo, x0 + (s.W + 0.5) * C, z0 + (k + 0.5) * C, g, suolo);
    }
    for (let i = -1; i <= s.W; i++)
      if (!s.vani.includes(i))
        Gfx.drawWorldSpriteGround(bordo, x0 + (i + 0.5) * C, z0 + (s.H + 0.5) * C, g, suolo);
    // la parete di fondo, a nord, in piedi come una facciata
    for (let i = 0; i < s.W; i++)
      Gfx.drawWorldSprite('k_parete_' + s.tipologia, x0 + (i + 0.5) * C, z0,
                          { shadow: false });
  }

  // luce calda e fondo buio: fuori dalla stanza non c'e' niente da vedere.
  // Sul ponte della nave invece la luce dell'ora (ora: dayT di game.js)
  function ambiente(time, ora) {
    const luci = stato.stanza.luci.map(L => ({
      ...L, mul: L.flicker ? 0.85 + 0.15 * Math.sin(time * 7 + L.x) : 1,
    }));
    if (stato.stanza.mare) return Nave.ambiente(ora, luci);
    return { ambient: [0.44, 0.37, 0.32], fog: [0.04, 0.03, 0.03],
             fogNear: 300, fogFar: 600, grade: [1.04, 0.98, 0.9], bloom: 0.5,
             shadowStrength: 0.5, lights: luci };
  }

  return {
    carica, portaVicina, entra, esci, oltre, versoLa, cartello, uscita, move, azioneVicina,
    fuoriDallaPorta, vicinoA, voce, disegna, ambiente,
    apriVani() { vaniChiusi = false; },
    get dentro() { return !!stato; },
    get stanza() { return stato && stato.stanza; },
    get porta() { return stato && stato.porta; },     // l'uscio da cui si e' entrati
    get porte() { return porte; },
    ingresso(tipo) { return stanze[tipo].ingresso; },
    centro() {
      const s = stato.stanza;
      return { x: ORIGINE.x + s.W * s.C / 2, z: ORIGINE.z + s.H * s.C / 2 };
    },
  };
})();
