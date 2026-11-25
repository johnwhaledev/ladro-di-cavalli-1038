// traffico.js — carri in transito, come in GTA: due o tre attorno al ladro.
//
// Un carro in transito ha un carrettiere a cassetta e va per le strade da una
// tappa all'altra: dentro le mura le vie lastricate (VIE) e i punti di ronda
// (world.patrol), fuori le strade di campagna (STRADE_CAMPAGNA, compresa
// quella del bosco fino all'accampamento dei briganti), le vie campionate
// ogni quattro tile. Le tappe
// formano un grafo; un arco e' un tratto dritto e sgombro oppure, dove una
// cosa sta in mezzo, un percorso di nav.js calcolato una volta sola. Il
// tragitto lungo non si calcola mai tutto: Nav.percorso ha un limite di nodi
// e un margine, e un capo all'altro della mappa non lo regge. Si va a tappe,
// scegliendo a ogni incrocio, di preferenza dritto.
//
// Qui stanno anche gli incidenti fra mezzi (in fondo): urti, carri che si
// sfasciano, relitti.
//
// Nascono e spariscono fuori inquadratura, come i passanti. Rubarne uno e'
// un furto vero (in game.js, con la regola dei testimoni): il carrettiere
// finisce a terra e diventa un passante come gli altri, il carico e' tuo.

const Traffico = (() => {
  const VELOCITA = 4.5;           // a piedi di corsa 7,4, un carro guidato da te 11
  const STERZO = 1.8;             // radianti al secondo: un carro non gira sul posto
  const ACCEL = 3.0;
  const RAGGIO = 0.9;             // quello di Vehicle.update
  const PASSO = 4;                // tile fra due tappe lungo una via
  const ARCO_CITTA = 22;          // i punti di ronda stanno a 20 l'uno dall'altro
  const ARCO_CAMPAGNA = 30;
  const QUANTI = { dentro: 3, fuori: 2 };
  // con la pioggia i carri vanno piu' piano (meteo.js)
  const velocita = () => VELOCITA * Meteo.fattore('fango');
  const NASCITA = [48, 100];      // lo schermo ne mostra ~32 di lato
  const SPARIZIONE = 125;
  // i carri in transito: quelli della pianta (CARRI), se no quelli di
  // Valdarno. La carrozza non gira: nell'856 non c'e', e la poche che restano
  // sono ferme nel quartiere nobile (world_abitanti.js)
  const CARRI = ['carro_coperto', 'carro_merci', 'carro_fieno'];
  const carriQui = () => ctx.world.pianta.CARRI || CARRI;
  // chi guida i carri: castDi(pianta, 'carrettiere'), cast.js

  let ctx = null;                 // world, player, vehicles, npcs, guards
  let grafo = null;
  const carri = [];
  const conti = { nati: 0, spariti: 0, incastrati: 0, rubati: 0, sfasciati: 0 };

  const pick = a => a[Math.floor(Math.random() * a.length)];

  // di nuovo a ogni citta' (viaggio.js): il grafo delle strade si rifa' sul
  // mondo nuovo alla prima occasione
  function init(c) { ctx = c; grafo = null; carri.length = 0; }

  function lunghezza(x, z, punti) {
    let l = 0;
    for (const p of punti) { l += Math.hypot(p.x - x, p.z - z); x = p.x; z = p.z; }
    return l;
  }

  // Il tratto da a a b: dritto se e' sgombro per un carro, altrimenti la
  // strada di nav.js, purche' non sia un giro dell'isolato.
  function tratto(w, a, b) {
    if (Nav.sgombro(w, a.x, a.z, b.x, b.z, RAGGIO + 0.1)) return [{ x: b.x, z: b.z }];
    const p = Nav.percorso(w, a.x, a.z, b.x, b.z);
    if (!p || lunghezza(a.x, a.z, p) > Math.hypot(b.x - a.x, b.z - a.z) * 1.6) return null;
    return p;
  }

  function costruisci(w) {
    const t0 = performance.now();
    const nodi = [];
    const aggiungi = (x, z, campagna) => {
      if (!Nav.sgombro(w, x, z, x, z, RAGGIO + 0.1)) return;
      if (nodi.some(n => Math.hypot(n.x - x, n.z - z) < 6)) return;
      nodi.push({ x, z, campagna, archi: [] });
    };
    const lungo = ([x0, y0, x1, y1], campagna) => {
      const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / PASSO));
      for (let i = 0; i <= n; i++)
        aggiungi((x0 + (x1 - x0) * i / n) * TILE + TILE / 2,
                 (y0 + (y1 - y0) * i / n) * TILE + TILE / 2, campagna);
    };
    // world.patrol da solo non basta: e' una griglia a passo 5 tile che manca
    // vie intere (quella a y=76 cade fra due righe) e lascia le porte isolate
    const { VIE, STRADE_CAMPAGNA } = w.pianta;
    for (const v of VIE) lungo(v, false);
    for (const p of w.patrol) aggiungi(p.x, p.z, false);
    for (const s of STRADE_CAMPAGNA) lungo(s, true);
    let archi = 0;
    for (let i = 0; i < nodi.length; i++)
      for (let j = i + 1; j < nodi.length; j++) {
        const a = nodi[i], b = nodi[j];
        const max = (a.campagna || b.campagna) ? ARCO_CAMPAGNA : ARCO_CITTA;
        if (Math.hypot(a.x - b.x, a.z - b.z) > max) continue;
        const andata = tratto(w, a, b);
        const ritorno = andata && tratto(w, b, a);
        if (!ritorno) continue;
        a.archi.push({ verso: j, punti: andata });
        b.archi.push({ verso: i, punti: ritorno });
        archi++;
      }
    // componenti: un carro che nasce su un'isola ci resta chiuso
    const comp = new Int32Array(nodi.length).fill(-1);
    let ncomp = 0, grande = 0, grandeN = 0;
    for (let s = 0; s < nodi.length; s++) {
      if (comp[s] >= 0) continue;
      const pila = [s]; comp[s] = ncomp; let k = 0;
      while (pila.length) {
        const u = pila.pop(); k++;
        for (const e of nodi[u].archi)
          if (comp[e.verso] < 0) { comp[e.verso] = ncomp; pila.push(e.verso); }
      }
      if (k > grandeN) { grandeN = k; grande = ncomp; }
      ncomp++;
    }
    for (let i = 0; i < nodi.length; i++) nodi[i].buono = comp[i] === grande;
    return { nodi, archi, componenti: ncomp, nella_rete: grandeN,
             ms: Math.round(performance.now() - t0) };
  }

  function dentroMura(x, z) {
    const tx = x / TILE, ty = z / TILE, { WALL } = ctx.world.pianta;
    return tx > WALL.x0 && tx < WALL.x1 && ty > WALL.y0 && ty < WALL.y1;
  }

  // la prossima tappa: di preferenza dritto, a volte si svolta, indietro solo
  // se la strada finisce
  function scegliArco(nodo, verso) {
    const pesi = nodo.archi.map(e => {
      const b = grafo.nodi[e.verso];
      const d = Math.hypot(b.x - nodo.x, b.z - nodo.z) || 1;
      const dot = verso ? ((b.x - nodo.x) * verso.x + (b.z - nodo.z) * verso.z) / d : 0;
      return dot > 0.8 ? 4 : (dot > -0.3 ? 1 : 0.02);
    });
    let tot = pesi.reduce((s, p) => s + p, 0), r = Math.random() * tot;
    for (let i = 0; i < pesi.length; i++) { r -= pesi[i]; if (r <= 0) return nodo.archi[i]; }
    return nodo.archi[nodo.archi.length - 1];
  }

  // scegli(nodo, distanza dal ladro): il carro di un incarico nasce dove
  // vuole lui (missioni_carro.js, nasciPer); gli altri fuori inquadratura
  function nasci(scegli) {
    const p = ctx.player;
    for (let k = 0; k < (scegli ? 600 : 30); k++) {
      const i = Math.floor(Math.random() * grafo.nodi.length);
      const n = grafo.nodi[i];
      if (!n.buono || !n.archi.length) continue;
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (scegli ? !scegli(n, d) : (d < NASCITA[0] || d > NASCITA[1])) continue;
      if (carri.some(c => Math.hypot(c.x - n.x, c.z - n.z) < 25)) continue;
      const arco = pick(n.archi);
      const v = new Vehicle({ type: 'carro', name: pick(carriQui()), x: n.x, z: n.z,
                              rot: Math.atan2(arco.punti[0].z - n.z, arco.punti[0].x - n.x) });
      v.bestia = Bestie.tiro(ctx.world.pianta, Math.random());   // bestie.js
      v.rider = new Npc(pick(castDi(ctx.world.pianta, 'carrettiere')), n.x, n.z, 'carrettiere');
      v.rider.setAnim('idle');
      v.carico = 30 + Math.floor(Math.random() * 51);       // 30-80 denari
      v.transito = { arco, i: 0, fermoT: 0, attesa: 0, ricalcoloT: 0 };
      v.misure = { strada: 0, tempo: 0, fermo: 0, attesa: 0, bloccato: 0 };
      carri.push(v);
      ctx.vehicles.push(v);
      conti.nati++;
      return v;
    }
    return null;
  }

  // il carro di un incarico (14/10): nasce dove dice `scegli` e non sparisce
  // finche' l'incarico non lo lascia (v.missione, missioni_carro.js)
  function nasciPer(scegli) {
    if (!grafo) grafo = costruisci(ctx.world);
    const v = nasci(scegli);
    if (v) v.missione = true;
    return v;
  }

  function togli(v) {
    let k = carri.indexOf(v); if (k >= 0) carri.splice(k, 1);
    k = ctx.vehicles.indexOf(v); if (k >= 0) ctx.vehicles.splice(k, 1);
  }

  // qualcuno davanti al muso (il ladro, un passante, una guardia, un altro
  // carro): ci si ferma, e dopo un poco si passa lo stesso, al passo
  function ostacolo(v) {
    const fx = Math.cos(v.rot), fz = Math.sin(v.rot);
    const davanti = (a, lungo, largo) => {
      const rx = a.x - v.x, rz = a.z - v.z;
      const av = rx * fx + rz * fz;
      return av > 0.5 && av < lungo && Math.abs(rx * fz - rz * fx) < largo;
    };
    if (!ctx.player.dead && davanti(ctx.player, 3.4, 1.4)) return true;
    for (const c of carri) if (c !== v && davanti(c, 6, 1.8)) return true;
    for (const L of [ctx.npcs, ctx.guards])
      for (const a of L) if (!a.dead && davanti(a, 3.0, 1.2)) return true;
    return false;
  }

  function guida(v, dt, adesso) {
    const w = ctx.world, tr = v.transito, m = v.misure;
    let q = tr.arco.punti[tr.i];
    while (Math.hypot(q.x - v.x, q.z - v.z) < 2.2) {
      if (++tr.i >= tr.arco.punti.length) {
        const nodo = grafo.nodi[tr.arco.verso];
        const verso = { x: Math.cos(v.rot), z: Math.sin(v.rot) };
        tr.arco = scegliArco(nodo, verso);
        tr.i = 0;
      }
      q = tr.arco.punti[tr.i];
    }
    const h = Math.atan2(q.z - v.z, q.x - v.x);
    const scarto = Math.atan2(Math.sin(h - v.rot), Math.cos(h - v.rot));
    v.rot += Math.max(-STERZO * dt, Math.min(STERZO * dt, scarto));

    let voluta = velocita() * Math.max(0.25, Math.cos(scarto));
    if (ostacolo(v)) {
      tr.attesa += dt;
      m.attesa += dt;
      voluta = tr.attesa > 2.5 ? 1.2 : 0;
    } else tr.attesa = 0;
    const k = ACCEL * dt * (v.speed > voluta ? 2 : 1);
    v.speed += Math.max(-k, Math.min(k, voluta - v.speed));

    const bx = v.x, bz = v.z;
    [v.x, v.z] = w.move(v.x, v.z, Math.cos(v.rot) * v.speed * dt,
                        Math.sin(v.rot) * v.speed * dt, RAGGIO);
    const fatto = Math.hypot(v.x - bx, v.z - bz);
    m.strada += fatto; m.tempo += dt;
    // contro qualcosa: dopo un secondo si rifa' la strada fino alla tappa
    // con nav.js, non piu' di una volta al secondo
    if (voluta > 1 && fatto < v.speed * dt * 0.3) {
      tr.fermoT += dt; m.fermo += dt;
      if (tr.fermoT > 1 && adesso > tr.ricalcoloT) {
        tr.ricalcoloT = adesso + 1;
        const meta = grafo.nodi[tr.arco.verso];
        const p = Nav.percorso(w, v.x, v.z, meta.x, meta.z);
        if (p) tr.arco = { verso: tr.arco.verso, punti: p };
        tr.i = 0;
      }
    } else tr.fermoT = 0;
    m.bloccato = Math.max(m.bloccato, tr.fermoT);

    const c = v.rider;
    c.x = v.x; c.z = v.z;
    c.animate(dt, Assets.manifest.chars.frame_rates);
  }

  function aggiorna(dt, adesso) {
    if (!grafo) grafo = costruisci(ctx.world);
    const p = ctx.player;
    for (let i = carri.length - 1; i >= 0; i--) {
      const v = carri[i];
      const d = Math.hypot(v.x - p.x, v.z - p.z);
      // incastrato per davvero: sparisce appena non lo si vede
      if (v.transito.fermoT > 8 && !v.contato) { v.contato = true; conti.incastrati++; }
      if (!v.missione && (d > SPARIZIONE || (v.transito.fermoT > 8 && d > 45))) {
        togli(v); conti.spariti++;
      }
    }
    const voluti = dentroMura(p.x, p.z) ? QUANTI.dentro : QUANTI.fuori;
    if (carri.length < voluti) nasci();
    for (const v of carri) guida(v, dt, adesso);
    relitti(dt);
  }

  // il carro in transito piu' vicino al ladro, entro r
  function vicino(a, r) {
    let best = null, bd = r;
    for (const v of carri) {
      const d = Math.hypot(v.x - a.x, v.z - a.z);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  // Il carrettiere finisce giu' dal lato libero e scappa: da qui e' un
  // passante (si colpisce e muore come gli altri). Il carro esce dal traffico.
  function buttaGiu(v) {
    const c = v.rider, w = ctx.world;
    const lato = v.rot + Math.PI / 2;
    for (const s of [1, -1, 0]) {
      c.x = v.x + Math.cos(lato) * 1.8 * s;
      c.z = v.z + Math.sin(lato) * 1.8 * s;
      if (!w.blocked(c.x, c.z)) break;
    }
    c.setAnim('hit');
    c.state = 'flee';
    c.fleeT = 5 + Math.random() * 3;
    c.heading = lato;
    ctx.npcs.push(c);
    v.rider = null;
    v.transito = null;
    carri.splice(carri.indexOf(v), 1);
    return c;
  }

  // Rubarlo: il carro resta un mezzo come gli altri, il carico si prende una
  // volta sola.
  function ruba(v) {
    const carrettiere = buttaGiu(v);
    const bottino = v.carico || 0;
    v.carico = 0;
    conti.rubati++;
    return { carrettiere, bottino };
  }

  // ------------------------------------------------------------ incidenti
  //
  // Un carro ha la sua salute (Vehicle.hp, 90): gli urti la consumano, a meta'
  // fuma (game.js), a zero si sfascia e resta li' come carro_rotto, senza
  // cavallo, finche' non lo si perde di vista. I cavalli restano come prima:
  // l'urto li ferisce e possono morire (game.js, disarciona).
  const DANNO_URTO = 30;          // a tutta velocita': tre urti e il carro e' rotto
  const RAGGIO_URTO = { carro: 1.5, cavallo: 1.0 };
  const DURATA_RELITTO = 90;

  function sfascia(v) {
    if (v.transito) { buttaGiu(v); conti.sfasciati++; }
    v.rotto = true;
    v.rottoT = 0;
    v.name = 'carro_rotto';
    v.speed = 0;
    v.carico = 0;
  }

  // Il mezzo del ladro contro gli altri mezzi: li separa e, se l'urto e'
  // vero (non uno sfioro), frena il suo e passa la botta all'altro. Ritorna
  // { k, altro, morto } (k = intensita' 0..1, come Vehicle.crash; morto =
  // l'altro era un cavallo ed e' morto) o null.
  function urta(v) {
    const w = ctx.world;
    for (const o of ctx.vehicles) {
      if (o === v || !RAGGIO_URTO[v.type] || !RAGGIO_URTO[o.type]) continue;  // le barche no
      const r = RAGGIO_URTO[v.type] + RAGGIO_URTO[o.type];
      const dx = o.x - v.x, dz = o.z - v.z, d = Math.hypot(dx, dz);
      if (d >= r || d < 1e-3) continue;
      const nx = dx / d, nz = dz / d;
      const verso = Math.cos(v.rot) * v.speed * nx + Math.sin(v.rot) * v.speed * nz;
      [v.x, v.z] = w.move(v.x, v.z, -nx * (r - d), -nz * (r - d), 0.9);
      if (verso < 2) continue;
      const k = Math.min(1, verso / v.maxSpeed);
      v.speed *= -0.25;
      let morto = false;
      if (!o.rotto) {
        // quello fermo viene spinto, quello in transito si ferma di botto
        if (o.transito) o.speed = 0;
        else { o.rot = Math.atan2(nz, nx); o.speed = verso * 0.6; }
        const finito = o.ferisci(k * (o.type === 'cavallo' ? 34 : DANNO_URTO));
        if (finito && o.type !== 'cavallo') sfascia(o);
        morto = finito && o.type === 'cavallo';
      }
      return { k, altro: o, morto };
    }
    return null;
  }

  // i relitti restano un poco, poi spariscono appena non si vedono
  function relitti(dt) {
    const p = ctx.player, V = ctx.vehicles;
    for (let i = V.length - 1; i >= 0; i--) {
      const v = V[i];
      if (!v.rotto) continue;
      v.rottoT += dt;
      if (v.rottoT > DURATA_RELITTO && Math.hypot(v.x - p.x, v.z - p.z) > 60) V.splice(i, 1);
    }
  }

  // debug.tp: chi era attorno al punto di prima non serve piu'
  // il carro di un incarico resta (un teletrasporto non lo deve portare via);
  // cambiando citta' lo toglie init
  function svuota() { for (const v of carri.slice()) if (!v.missione) togli(v); }

  return {
    init, aggiorna, vicino, ruba, svuota, urta, sfascia, nasciPer, carri, conti, DANNO_URTO, velocita,
    get grafo() { return grafo; },
  };
})();
