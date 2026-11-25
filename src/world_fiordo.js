// world_fiordo.js — il borgo vichingo (stile "fiordo", pianta_fiordo.js).
//
// Metodi di World come world_borgo.js, ma un'altra urbanistica: la
// palizzata a mezzaluna al posto delle mura (dal 06/10 aperta a levante,
// sull'insenatura: il modello e' Hedeby), le torrette di legno alle porte,
// le case lunghe sulle strade di assi, il thing al posto della piazza, la
// sala del jarl al posto del castello, lo hof col bosco sacro al posto della
// pieve, la nave di pietre al posto del cimitero. Porto, osterie, Lanterna
// Rossa e cunicolo sono quelli di sempre (buildPort, buildOsterie...), sulla
// pianta del fiordo. World.build() chiama buildTownVichinga al posto di
// buildTown quando la pianta ha stile 'fiordo'.

Object.assign(World.prototype, {
  buildTownVichinga() {
    this.palizzata();
    this.vallo();
    this.porteVichinghe();
    this.pontiDelRuscello();
    this.salaDelJarl();
    this.hof();
    this.fucinaVichinga();
    this.naveDiPietre();
    this.caseVichinghe();
    this.thing();
    this.arredoVichingo();
  },

  // La palizzata: un tronco ogni 0,6 unita' lungo la mezzaluna (la meta' di
  // ponente del cerchio: l'acqua e' a levante, 06/10), e le due punte che
  // dalla mezzaluna vanno a levante fino in acqua. Il varco delle porte di
  // terra resta aperto (le torrette le mette porteVichinghe)
  palizzata() {
    const { centro: { x: cx, y: yc, R }, GATES } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    const pali = ['palo_palizzata_a', 'palo_palizzata_b', 'palo_palizzata_c'];
    const porte = GATES.filter(g => !g.approdo).map(g => ({ x: c(g.x), z: c(g.y), r: varcoDi(g) }));
    const passo = 0.6;
    let k = 0;
    const metti = (x, z) => {
      if (porte.some(p => Math.hypot(p.x - x, p.z - z) < p.r)) return;
      this.addProp(pali[(k * 7 + (k >> 2)) % 3], x, z,
                   { solid: false, shadow: false, flip: k % 2 === 0 });
      if (k++ % 2 === 0) this.addMuro(x, z, 0.8);
    };
    const X = c(cx), Z = c(yc), Ru = R * TILE;
    const n = Math.ceil(Math.PI * Ru / passo);
    for (let i = 0; i <= n; i++) {
      const a = Math.PI / 2 + Math.PI * i / n;
      metti(X + Ru * Math.cos(a), Z + Ru * Math.sin(a));
    }
    // le punte: finiscono dove il mare si fa profondo
    for (const s of [-1, 1]) {
      const ty = yc + s * R;
      for (let x = X + passo; x < WS; x += passo) {
        if (this.distAcqua(Math.floor(x / TILE), ty) < 3.4) break;
        metti(x, Z + s * Ru);
      }
    }
  },

  // Le porte di terra: due torrette di legno dove la palizzata si
  // interrompe e, a nord e a sud, l'architrave coi draghi (di fronte alla
  // camera); a ponente la via passa di taglio e restano le torrette.
  // All'approdo, sulla riva, due pietre runiche e i bracieri, dal lato di
  // terra (a ponente: l'acqua e' a levante)
  porteVichinghe() {
    const { centro: { x: cx, y: yc }, GATES } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    const luce = (x, z) => {
      this.addProp('braciere', x, z, { solid: false });
      this.lights.push({ x, y: 1.8, z, color: [1.0, 0.56, 0.22], radius: 13, flicker: 1.4 });
    };
    for (const g of GATES) {
      const x = c(g.x), z = c(g.y);
      if (g.approdo) {
        for (const s of [-1, 1]) {
          this.addProp('pietra_runica', x - 2, z + s * 3.4 * TILE, { radius: 1.0 });
          luce(x - 5, z + s * 2.8 * TILE);
        }
        continue;
      }
      // la tangente della mezzaluna alla porta: di li' riprendono i tronchi
      const a = Math.atan2(g.y - yc, g.x - cx);
      const tx = -Math.sin(a), tz = Math.cos(a);
      // a nord e a sud le torrette ai lati dell'architrave, a ponente (la via
      // di taglio) ai lati del varco
      const dt = g.dir === 'N' || g.dir === 'S' ? TORRETTA_FRONTE : VARCO_PORTA;
      for (const s of [-1, 1]) {
        const px = x + s * tx * dt, pz = z + s * tz * dt;
        this.addProp('torretta_legno', px, pz + 0.4, { solid: false, flip: s > 0 });
        this.addMuro(px, pz, 1.8);
      }
      if (g.dir === 'N' || g.dir === 'S') {
        this.addProp('porta_palizzata', x, z + 0.4, { solid: false, shadow: false });
        for (const s of [-1, 1]) this.addMuro(x + s * 2.6, z, 0.7);
      }
      luce(x + (g.dir === 'E' ? 6 : 5), z + (g.dir === 'E' ? 6 : 3));
    }
  },

  // La sala del jarl nel suo recinto di pali, con l'ingresso a sud verso
  // l'arteria. Ci si entra come nel castello (src/stanze/castello.json)
  salaDelJarl() {
    const { CASTLE, CORTE, CASE } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    const sala = this.addProp(CASE.sala, c(CASTLE.x), c(CASTLE.y), { scale: 1.7, solid: false });
    const mezzo = sala ? sala.wu / 2 - 1.5 : 8, fondo = sala ? sala.hu * 0.45 : 8;
    for (let dz = 0; dz <= fondo; dz += 2)
      for (let dx = -mezzo; dx <= mezzo; dx += 2)
        this.addMuro(c(CASTLE.x) + dx, c(CASTLE.y) - dz, 1.5);
    this.castello = { porta: { x: c(CASTLE.x), z: c(CASTLE.y) + 2.2 } };
    // il recinto: pali piu' bassi, il varco a sud davanti alla sala
    const x0 = CORTE.x0 * TILE, x1 = CORTE.x1 * TILE, z0 = CORTE.y0 * TILE, z1 = CORTE.y1 * TILE;
    // un ostacolo ogni due pali, contati lato per lato (prima un contatore
    // solo per tutti: a nord e a ponente toccavano tutti i pari, a sud e a
    // levante i dispari, e quei due lati non avevano ostacoli)
    const palo = (x, z, k) => {
      this.addProp(k % 2 ? 'palo_palizzata_b' : 'palo_palizzata_a', x, z,
                   { solid: false, shadow: false, scale: 0.7 });
      if (k % 2 === 0) this.addMuro(x, z, 0.8);
    };
    let k = 0;
    for (let x = x0; x <= x1; x += 0.55, k++) {
      palo(x, z0, k);
      if (Math.abs(x - c(CASTLE.x)) > 2.6) palo(x, z1, k);
    }
    k = 0;
    for (let z = z0 + 0.55; z < z1; z += 0.55, k++) { palo(x0, z, k); palo(x1, z, k); }
    // dentro: bracieri all'ingresso, la pietra runica del casato, gli scudi
    for (const s of [-1, 1]) {
      const bx = c(CASTLE.x) + s * 4.5, bz = c(CASTLE.y) + 3.5;
      this.addProp('braciere', bx, bz, { solid: false });
      this.lights.push({ x: bx, y: 1.8, z: bz, color: [1.0, 0.58, 0.24], radius: 14, flicker: 1.3 });
      this.addProp('props_neve_17', c(CASTLE.x) + s * 8, z1 - 3, { solid: false, sway: 0.5 });
    }
    this.addProp('pietra_runica', c(CASTLE.x) + 10, c(CASTLE.y) + 9, { radius: 1.0 });
    this.addProp('props_neve_24', c(CASTLE.x) - 10, c(CASTLE.y) + 8);        // le armi appese
  },

  // Lo hof, il tempio, col bosco sacro di frassini dietro e la pietra runica
  // davanti. Fa la parte della pieve (src/stanze/chiesa.json: si cura)
  hof() {
    const { LUOGHI: { pieve: P }, CASE } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    const hof = this.addProp(CASE.hof, c(P.x), c(P.y), { scale: 1.25 });
    this.chiesa = { porta: { x: c(P.x), z: c(P.y) + (hof ? hof.radius : 2) + 0.6 } };
    // (non sulle vie: la via del thing alla porta sud passa accanto, 30/09)
    for (const [dx, dz] of [[-8, -9], [8, -10], [0, -15], [-13, -3]])
      if (!this.nearRoad(c(P.x) + dx, c(P.y) + dz, 1))
        this.addProp('frassino', c(P.x) + dx, c(P.y) + dz, { sway: 1, scale: 1.3 });
    this.addProp('pietra_runica', c(P.x) + 7, c(P.y) + 3, { radius: 1.0 });
  },

  // la bottega di Ferrante: come a Valdarno, sulla sua corte (fucina.json)
  fucinaVichinga() {
    const { LUOGHI } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    const r = Assets.world('edificio_bottega');
    const x = c(LUOGHI.fucina.x) - 1, z = c(LUOGHI.fucina.y) - 3.5;
    this.addProp('edificio_bottega', x, z, { solid: false });
    if (r) for (const s of [-1, 1]) this.addMuro(x + s * r.wu / 4, z - 1.8, r.wu / 4 + 0.4);
    this.fucina = { x, z, porta: { x, z: z + 1.6 } };
  },

  // La nave di pietre: pietre ritte sul profilo di uno scafo, piu' alte a
  // prua e a poppa, e due tumuli a sud. Fa la parte del cimitero (il
  // becchino e' fra i residenti)
  naveDiPietre() {
    const K = this.pianta.LUOGHI.cimitero;
    const x0 = K.x * TILE, x1 = (K.x + K.w) * TILE, z0 = K.y * TILE, z1 = (K.y + K.h) * TILE;
    this.recinti.push({ x0, x1, z0, z1 });
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, a = (x1 - x0) / 2 - 1, b = (z1 - z0) / 2 - 1;
    const strada = (x, z) => this.road[this.idx(Math.floor(x / TILE), Math.floor(z / TILE))];
    const N = 22;
    for (let i = 0; i < N; i++) {
      const t = i / N * Math.PI * 2, ct = Math.cos(t);
      const x = mx + a * ct, z = mz + b * Math.sin(t) * (1 - 0.55 * ct * ct);
      if (strada(x, z)) continue;
      const punta = Math.abs(ct) > 0.97;
      this.addProp(punta ? 'pietra_runica' : ['pietra_ritta_a', 'pietra_ritta_b'][i % 2], x, z,
                   { radius: 0.6, flip: i % 3 === 0, scale: punta ? 0.9 : 1.3 });
    }
    for (const dx of [-a * 0.6, a * 0.5])
      if (!strada(mx + dx, z1 + 2.4))
        this.addProp('tumulo', mx + dx, z1 + 2.4, { radius: 2.2 });
  },

  // Le case: lunghe, sulle strade di assi come a Valdarno (una fila sul lato
  // nord delle vie est-ovest, facciate sulla via; sui due lati delle vie
  // nord-sud), ma con i cortili fra l'una e l'altra, e sempre dentro la
  // palizzata, mai sull'acqua o sulla riva (il ruscello). Quale casa dipende
  // dal quartiere: sul porto le basse e lunghe, ai margini le capanne, verso
  // la sala le grandi
  caseVichinghe() {
    const { PLAZA, RISERVATI, GATES, VIE, CASE, centro: { x: cx, y: yc, R } } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    const lista = (tx, ty) => {
      const d = this.districtAt(Math.floor(tx), Math.floor(ty));
      return d === D.PORTO ? CASE.porto : d === D.SLUMS ? CASE.capanne
           : d === D.NOBILE ? CASE.ricche : CASE.lunghe;
    };
    const dentro = (tx, ty) => this.pianta.dentro(tx, ty) && Math.abs(ty - yc) < R - 3 &&
      (tx >= cx || (tx - cx) ** 2 + (ty - yc) ** 2 < (R - 3) ** 2) &&
      this.distAcqua(Math.floor(tx), Math.floor(ty)) >= 5.2;
    const riservato = (tx, ty) =>
      RISERVATI.some(q => tx >= q.x0 && tx <= q.x1 && ty >= q.y0 && ty <= q.y1) ||
      Math.hypot(tx - PLAZA.x, ty - PLAZA.y) < PLAZA.r + 2.5 ||
      GATES.some(g => Math.hypot(g.x - tx, g.y - ty) < 5);
    const casa = (name, x, z) => {
      const r = Assets.world(name);
      if (!r) return false;
      const tx = x / TILE, tz = z / TILE, mezzo = r.wu / 2 / TILE;
      if (riservato(tx, tz) || !dentro(tx - mezzo, tz - 1) || !dentro(tx + mezzo, tz - 1)) return false;
      if (!this.freeAt(x, z - 2, r.wu * 0.4)) return false;
      this.addProp(name, x, z, { flip: this.rnd() < 0.5, solid: false });
      for (const s of [-1, 1]) this.addMuro(x + s * r.wu / 4, z - 1.8, r.wu / 4 + 0.4);
      return true;
    };
    const cortile = (tx, ty) => this.districtAt(Math.floor(tx), Math.floor(ty)) === D.PORTO
      ? 1.2 + this.rnd() * 1.6 : 1.6 + this.rnd() * 2.4;
    for (const [xa, ya, xb, yb, w] of VIE) {
      if (Math.abs(xb - xa) > Math.abs(yb - ya)) {
        for (let x = xa * TILE + 3; x < xb * TILE - 3;) {
          const tx = x / TILE;
          const yl = ya + (yb - ya) * (tx - xa) / (xb - xa);
          const z = Math.round(yl - w) * TILE - 0.4;
          const name = this.pickVario(lista(tx, yl), x, z, 30);
          const wu = (Assets.world(name) || { wu: 6 }).wu;
          x += casa(name, x + wu / 2, z) ? wu + cortile(tx, yl) : 2;
        }
      } else {
        const n = Math.max(1, Math.round(Math.hypot(xb - xa, yb - ya) / 3.2));
        for (let i = 0; i <= n; i++) {
          const ty = ya + (yb - ya) * i / n, xl = xa + (xb - xa) * i / n;
          for (const s of [-1, 1]) {
            const name = this.pickVario(lista(xl, ty), xl * TILE, ty * TILE, 30);
            const wu = (Assets.world(name) || { wu: 6 }).wu;
            const bordo = s < 0 ? Math.round(xl - w) : Math.round(xl + w) + 1;
            casa(name, bordo * TILE + s * (wu / 2 + 0.4), c(ty));
          }
        }
      }
    }
  },

  // Il thing: pietre ritte in cerchio su neve battuta, la pietra runica in
  // mezzo, due bracieri; dal 06/10 fuori dalla palizzata. I mercanti non
  // stanno qui ma sull'arteria, a ponente dell'approdo (il mercato sulla
  // riva), ai loro banchi
  thing() {
    const { PLAZA, GATES } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    const X = c(PLAZA.x), Z = c(PLAZA.y), rr = (PLAZA.r - 0.6) * TILE;
    // fuori dalla palizzata (06/10): il bosco sparso non ci cresce dentro
    const Rp = (PLAZA.r + 2) * TILE;
    this.recinti.push({ x0: X - Rp, x1: X + Rp, z0: Z - Rp, z1: Z + Rp });
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2;
      const x = X + Math.cos(a) * rr, z = Z + Math.sin(a) * rr;
      if (this.road[this.idx(Math.floor(x / TILE), Math.floor(z / TILE))]) continue;
      this.addProp(['pietra_ritta_a', 'pietra_ritta_b', 'pietra_ritta_c'][i % 3], x, z,
                   { radius: 0.7, flip: i % 2 === 0, scale: 1.7 });
    }
    this.addProp('pietra_runica', X, Z - 2, { radius: 1.0, scale: 1.2 });
    // su neve battuta, non nel fango
    for (let dy = -PLAZA.r; dy <= PLAZA.r; dy++)
      for (let dx = -PLAZA.r; dx <= PLAZA.r; dx++)
        if (dx * dx + dy * dy <= PLAZA.r * PLAZA.r && !this.road[this.idx(PLAZA.x + dx, PLAZA.y + dy)])
          this.terrain[this.idx(PLAZA.x + dx, PLAZA.y + dy)] = T.NEVE;
    for (const s of [-1, 1]) {
      this.addProp('braciere', X + s * 6, Z + 3, { solid: false });
      this.lights.push({ x: X + s * 6, y: 1.8, z: Z + 3, color: [1.0, 0.56, 0.22],
                         radius: 14, flicker: 1.5 });
    }
    // le bancarelle dei mercanti lungo l'arteria, ai due lati (30/09: erano
    // tende da accampamento, "le tende in citta'?"; ora banchi meta)
    const tende = ['vik_banco_a', 'vik_banco_b', 'vik_banco_c', 'vik_banco_d'];
    const approdo = GATES.find(g => g.approdo);
    for (let k = 0; k < 8; k++) {
      const s = k % 2 ? 1 : -1;
      const x = c(approdo.x - 5 - (k >> 1) * 3.4), z = c(approdo.y) + s * 3.4 * TILE;
      if (!this.freeAt(x, z, 1.4)) continue;
      this.addProp(tende[k % tende.length], x, z, { radius: 1.3, flip: s > 0 });
      // il mercante sta fra la tenda e la via
      this.stalls.push({ x, z: z - s * 2.2, flip: s > 0 });
    }
  },

  // I ponti sul ruscello (06/10): la passerella di assi dei moli stesa di
  // traverso all'acqua dove il vicolo e la via di riva lo passano; buildSolid
  // ne fa terra (this.ponti), come per i moli
  pontiDelRuscello() {
    const c = n => n * TILE + TILE / 2;
    this.ponti = [];
    for (const p of this.pianta.PONTI || []) {
      const x = c(p.x), z = c(p.y);
      this.addProp('molo_b', x, z, { solid: false, shadow: false, scale: 1.4,
                                     piano: { alto: 0.3, ang: 0 } });
      this.ponti.push({ x0: x - 1.4, x1: x + 1.4, z0: z - 6, z1: z + 6 });
    }
  },

  // Un tratto di vallo a ponente (06/10, come il Danevirke di Hedeby, ma
  // corto): pali come la palizzata, un ostacolo ogni due
  vallo() {
    const V = this.pianta.VALLO || [];
    const c = n => n * TILE + TILE / 2;
    const pali = ['palo_palizzata_a', 'palo_palizzata_b', 'palo_palizzata_c'];
    let k = 0;
    for (let i = 0; i + 1 < V.length; i++) {
      const [xa, ya] = V[i], [xb, yb] = V[i + 1];
      const n = Math.ceil(Math.hypot(xb - xa, yb - ya) * TILE / 0.6);
      for (let j = 0; j < n; j++, k++) {
        const x = c(xa + (xb - xa) * j / n), z = c(ya + (yb - ya) * j / n);
        this.addProp(pali[(k * 7 + (k >> 2)) % 3], x, z,
                     { solid: false, shadow: false, flip: k % 2 === 0 });
        if (k % 2 === 0) this.addMuro(x, z, 0.8);
      }
    }
  },

  // L'arredo per quartiere, come a Valdarno ma del nord: sul porto il pesce a
  // seccare e le botti, ai margini legna e ceppi, fra le case lunghe botti e
  // carriole, verso la sala gli stendardi e le pietre runiche. Dietro le case
  // i cortili; le torce lungo le vie
  arredoVichingo() {
    const { RISERVATI } = this.pianta;
    const ARREDO = [
      [D.PORTO, 150, ['rastrelliera_pesce', 'rastrelliera_pesce', 'botte', 'barile', 'cassa',
                      'catasta', 'tino', 'gabbia', 'props_neve_21', 'props_neve_23']],
      [D.SLUMS, 150, ['catasta', 'tronchi', 'mucchio_neve', 'botte', 'rastrelliera_pesce',
                      'palo_palizzata_b', 'props_neve_12', 'props_neve_19']],
      [D.MERCATO, 160, ['botte', 'cassa', 'props_neve_25', 'catasta', 'carriola', 'panca',
                        'props_neve_21', 'rastrelliera_pesce', 'props_neve_19']],
      [D.NOBILE, 60, ['pietra_runica', 'braciere', 'props_neve_24', 'totem', 'catasta']],
    ];
    for (const [dd, quanti, lista] of ARREDO)
      this.scatter(lista, quanti, (tx, ty, x, z) =>
        this.districtAt(tx, ty) === dd && this.nearRoad(x, z, 2));
    this.scatter(['props_neve_13', 'props_neve_17', 'props_neve_22'], 40,
      (tx, ty, x, z) => this.districtAt(tx, ty) === D.NOBILE && this.nearRoad(x, z, 2),
      { solid: false, sway: 0.5 });
    const riservato = (tx, ty) =>
      RISERVATI.some(q => tx >= q.x0 && tx <= q.x1 && ty >= q.y0 && ty <= q.y1);
    this.scatter(['catasta', 'palo_palizzata_a', 'pozzo', 'botte', 'cespuglio_neve', 'tronchi'], 140,
      (tx, ty, x, z) => this.pianta.dentro(tx, ty) && !this.nearRoad(x, z, 3) &&
                        !riservato(tx, ty));
    for (let i = 0; i < 130; i++) {
      const x = this.rnd() * WS, z = this.rnd() * WS;
      const tx = Math.floor(x / TILE), ty = Math.floor(z / TILE);
      if (!this.inside(tx, ty) || !this.pianta.dentro(tx, ty)) continue;
      if (!this.nearRoad(x, z, 1) || !this.freeAt(x, z, 1)) continue;
      const torcia = this.rnd() < 0.6;
      this.addProp(torcia ? 'torcia' : 'braciere', x, z, { solid: false });
      this.lights.push({ x, y: torcia ? 2.4 : 1.8, z, color: [1.0, 0.56, 0.22],
                         radius: 12, flicker: 1.2 });
    }
  },
});

// mezza apertura delle porte di terra, in unita': li' la palizzata si ferma.
// A nord e a sud (07/10, tua foto: "palizzate del fiordo non chiuse") arriva
// ai montanti dell'architrave (porta_palizzata, larga 6), e le torrette
// stanno subito accanto; prima si fermava a 8 e fra architrave e torrette
// restavano due varchi
const VARCO_PORTA = 8;
const VARCO_FRONTE = 3.0, TORRETTA_FRONTE = 4.8;
const varcoDi = g => (g.dir === 'N' || g.dir === 'S' ? VARCO_FRONTE : VARCO_PORTA);
