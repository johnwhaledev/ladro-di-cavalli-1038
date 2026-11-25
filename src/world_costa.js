// world_costa.js — la citta' della Costa saracena (stile "costa",
// pianta_costa.js, 29/09; dal 06/10 sul promontorio, come Mahdia).
//
// Metodi di World come world_fiordo.js, un'altra urbanistica: una cinta
// sola, il muro di terra sul collo del promontorio, coi pezzi delle mura di
// Valdarno color sabbia (mappe.json, "tinte"); dentro la medina fitta coi
// vicoli ciechi, la moschea grande all'incrocio delle vie, il suk attorno
// allo slargo del pozzo e lungo le vie grandi, la casba col palazzo
// dell'emiro in punta, il hammam al posto della pieve, la forgia vicino alla
// porta di terra; fuori il cimitero oltre la porta e l'oasi. Porto (il
// bacino scavato), osterie (il caravanserraglio), Lanterna Rossa e cunicolo
// sono quelli di sempre. World.build() chiama buildTownSaracena al posto di
// buildTown quando la pianta ha stile 'costa'.

Object.assign(World.prototype, {
  buildTownSaracena() {
    this.muroDiTerra();
    this.casba();
    this.moschea();
    this.hammam();
    this.fucinaSaracena();
    this.cimiteroSaraceno();
    this.caseSaracene();
    this.suk();
    this.oasi();
    this.arredoSaraceno();
  },

  // La casba: il palazzo dell'emiro nel recinto della corte (lo stesso di
  // Valdarno, cintaDellaCorte), una fontana, le palme negli angoli e le
  // lanterne sul viale. Ci si entra dall'arco del palazzo (interni.js)
  casba() {
    const { CASTLE, CASE } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    const p = this.addProp(CASE.palazzo, c(CASTLE.x), c(CASTLE.y), { scale: 1.7, solid: false });
    const mezzo = p ? p.wu / 2 - 1.5 : 10, fondo = p ? p.hu * 0.45 : 8;
    for (let dz = 0; dz <= fondo; dz += 2)
      for (let dx = -mezzo; dx <= mezzo; dx += 2)
        this.addMuro(c(CASTLE.x) + dx, c(CASTLE.y) - dz, 1.5);
    this.castello = { porta: { x: c(CASTLE.x), z: c(CASTLE.y) + 2.2 } };
    this.cintaDellaCorte();
    this.addProp('fontana_grande', c(CASTLE.x), c(CASTLE.y) + 16, { scale: 1.1 });
    for (const s of [-1, 1]) {
      this.addProp('lanterna_palo', c(CASTLE.x) + s * 5, c(CASTLE.y) + 24, { solid: false });
      this.lights.push({ x: c(CASTLE.x) + s * 5, y: 2.6, z: c(CASTLE.y) + 24.3,
                         color: [1.0, 0.76, 0.42], radius: 13, flicker: 0.8 });
      for (const dz of [8, 26])
        this.addProp(this.pick(this.pianta.FLORA.conifere), c(CASTLE.x) + s * 26,
                     c(CASTLE.y) + dz, { sway: 1 });
    }
  },

  // Il muro di terra (06/10): la sola cinta, sul collo del promontorio da
  // mare a mare (MURO), coi pezzi delle mura di Valdarno. Si vede di fronte:
  // campate da 3 tile allineate sulla porta, l'arco in mezzo, una torre a
  // ogni capo, dove il muro entra in acqua
  muroDiTerra() {
    const { MURO, GATES } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    const g = GATES.find(q => !q.approdo);
    const X = c(g.x), Z = c(MURO.y), passo = 3 * TILE;
    const kMin = Math.ceil((MURO.x0 * TILE - X) / passo);
    const kMax = Math.floor((MURO.x1 * TILE - X) / passo);
    for (let k = kMin; k <= kMax; k++) {
      if (k === 0) continue;
      const x = X + k * passo;
      this.addProp('cinta_campata', x, Z, { solid: false, shadow: false });
      for (let dx = -5; dx <= 5; dx += 2) this.addMuro(x + dx, Z, 1.4);
    }
    for (const k of [kMin, kMax]) this.torreCinta(X + k * passo, Z + 0.5, 1, 1.8, false);
    this.addProp('porta_citta', X, Z + 0.4, { scale: 1.1, solid: false });
    for (const s of [-1, 1]) this.addMuro(X + s * 3.6, Z, 1.3);
    this.addProp('torcia', X - 5, Z + 2, { solid: false });
    this.lights.push({ x: X - 5, y: 2.6, z: Z + 2, color: [1.0, 0.62, 0.28],
                       radius: 13, flicker: 1 });
  },

  // La moschea grande (06/10, tua scelta del pezzo: la cupola col minareto)
  // dentro l'anello di vie, la facciata a sud verso lo slargo del pozzo; come
  // ostacolo la sua pianta, fatta di ostacoli senza sprite
  moschea() {
    const { MOSCHEA, CASE } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    const X = c(MOSCHEA.x), Z = c(MOSCHEA.y);
    const m = this.addProp(CASE.moschea, X, Z, { scale: 1.9, solid: false });
    const mezzo = m ? m.wu / 2 - 1.5 : 6, fondo = m ? m.hu * 0.45 : 6;
    for (let dz = 0; dz <= fondo; dz += 2)
      for (let dx = -mezzo; dx <= mezzo; dx += 2) this.addMuro(X + dx, Z - dz, 1.5);
  },

  // Il hammam: fa la parte della pieve (src/stanze/costa/chiesa.json)
  hammam() {
    const { LUOGHI: { pieve: P }, CASE } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    const h = this.addProp(CASE.hammam, c(P.x), c(P.y), { scale: 1.15 });
    this.chiesa = { porta: { x: c(P.x), z: c(P.y) + (h ? h.radius : 2) + 0.6 } };
  },

  // la forgia di Ferrante (fucina.json): come a Valdarno, sulla sua corte
  fucinaSaracena() {
    const { LUOGHI } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    const r = Assets.world('edificio_bottega');
    const x = c(LUOGHI.fucina.x) - 1, z = c(LUOGHI.fucina.y) - 3.5;
    this.addProp('edificio_bottega', x, z, { solid: false });
    if (r) for (const s of [-1, 1]) this.addMuro(x + s * r.wu / 4, z - 1.8, r.wu / 4 + 0.4);
    this.fucina = { x, z, porta: { x, z: z + 1.6 } };
  },

  // Il cimitero fuori dalla porta sud: un muretto, le pietre basse in file
  // verso levante, una palma. Niente croci. Il becchino e' fra i residenti
  cimiteroSaraceno() {
    const K = this.pianta.LUOGHI.cimitero, M = this.pianta.CASE.muretto;
    const x0 = K.x * TILE, x1 = (K.x + K.w) * TILE, z0 = K.y * TILE, z1 = (K.y + K.h) * TILE;
    const strada = (x, z) => this.road[this.idx(Math.floor(x / TILE), Math.floor(z / TILE))];
    const metti = (nome, x, z, opt = {}) => { if (!strada(x, z)) this.addProp(nome, x, z, opt); };
    this.recinti.push({ x0, x1, z0, z1 });
    const lungo = (Assets.world(M) || { wu: 4 }).wu;
    for (let x = x0 + lungo / 2; x < x1; x += lungo) {
      metti(M, x, z1, { radius: 1.0 });
      if (Math.abs(x - (x0 + x1) / 2) > lungo) metti(M, x, z0, { radius: 1.0 });
    }
    for (let z = z0 + 1.8; z < z1; z += 1.8)
      for (const x of [x0, x1]) metti('muretto', x, z, { radius: 0.8 });
    for (let z = z0 + 3.5; z < z1 - 2; z += 3)
      for (let x = x0 + 2.4; x < x1 - 1.6; x += 2.6)
        metti('cippo', x + (this.rnd() - 0.5) * 0.4, z, { solid: false, scale: 0.8 });
    metti(this.pianta.FLORA.conifere[0], x1 - 2, z0 + 2, { sway: 1 });
  },

  // Le case sulle vie, come a Valdarno (una fila sul lato nord delle vie
  // est-ovest, facciate sulla via; i due lati delle vie nord-sud), ma fitte:
  // nella medina quasi senza stacco, e i vicoli sono storti (tratti corti,
  // pianta_costa.js). Quale casa dipende dal quartiere; sempre sulla terra
  // del promontorio, e i caravanserragli (i funduq) solo vicino alle porte
  caseSaracene() {
    const { WALL, PLAZA, RISERVATI, GATES, VIE, CASE } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    // chi ha un tetto (CASE.massimi: caravanserragli, Lanterne) esce dalle
    // liste quando l'ha raggiunto
    const contati = {};
    const allePorte = (tx, ty) => GATES.some(g => Math.hypot(tx - g.x, ty - g.y) < 14);
    const lista = (tx, ty) => {
      const d = this.districtAt(Math.floor(tx), Math.floor(ty));
      const l = d === D.MERCATO ? CASE.suk : d === D.NOBILE ? CASE.casba : CASE.medina;
      return l.filter(n => !((contati[n] || 0) >= (CASE.massimi[n] ?? Infinity)) &&
                           (n !== 'edificio_taverna' || allePorte(tx, ty)));
    };
    const dentro = (tx, ty) => this.pianta.dentro(tx, ty) && ty < WALL.y1 - 1;
    const riservato = (tx, ty) =>
      RISERVATI.some(q => tx >= q.x0 && tx <= q.x1 && ty >= q.y0 && ty <= q.y1) ||
      Math.hypot(tx - PLAZA.x, ty - PLAZA.y) < PLAZA.r + 2 ||
      GATES.some(g => Math.hypot(g.x - tx, g.y - ty) < 5);
    const casa = (name, x, z) => {
      const r = Assets.world(name);
      if (!r) return false;
      const tx = x / TILE, tz = z / TILE, mezzo = r.wu / 2 / TILE;
      if (riservato(tx, tz) || !dentro(tx - mezzo, tz - 1) || !dentro(tx + mezzo, tz - 1)) return false;
      if (!this.freeAt(x, z - 2, r.wu * 0.4)) return false;
      this.addProp(name, x, z, { flip: this.rnd() < 0.5, solid: false });
      for (const s of [-1, 1]) this.addMuro(x + s * r.wu / 4, z - 1.8, r.wu / 4 + 0.4);
      contati[name] = (contati[name] || 0) + 1;
      return true;
    };
    const stacco = (tx, ty) => this.districtAt(Math.floor(tx), Math.floor(ty)) === D.SLUMS
      ? 0.2 + this.rnd() * 0.6 : 0.8 + this.rnd() * 1.6;
    for (const [xa, ya, xb, yb, w] of VIE) {
      if (Math.abs(xb - xa) >= Math.abs(yb - ya)) {
        const [xs, ys, xe, ye] = xa < xb ? [xa, ya, xb, yb] : [xb, yb, xa, ya];
        for (let x = xs * TILE + 3; x < xe * TILE - 3;) {
          const tx = x / TILE;
          const yl = ys + (ye - ys) * (tx - xs) / ((xe - xs) || 1);
          const z = Math.round(yl - w) * TILE - 0.4;
          const name = this.pickVario(lista(tx, yl), x, z, 24);
          const wu = (Assets.world(name) || { wu: 6 }).wu;
          x += casa(name, x + wu / 2, z) ? wu + stacco(tx, yl) : 2;
        }
      } else {
        const n = Math.max(1, Math.round(Math.hypot(xb - xa, yb - ya) / 2.8));
        for (let i = 0; i <= n; i++) {
          const ty = ya + (yb - ya) * i / n, xl = xa + (xb - xa) * i / n;
          for (const s of [-1, 1]) {
            const name = this.pickVario(lista(xl, ty), xl * TILE, ty * TILE, 24);
            const wu = (Assets.world(name) || { wu: 6 }).wu;
            const bordo = s < 0 ? Math.round(xl - w) : Math.round(xl + w) + 1;
            casa(name, bordo * TILE + s * (wu / 2 + 0.4), c(ty));
          }
        }
      }
    }
  },

  // Il suk: le botteghe sotto le tende in cerchio attorno allo slargo col
  // pozzo, davanti alla moschea, e ai due lati delle vie grandi vicino
  // all'anello (06/10: prima lungo la via grande dalla porta del mare). Il
  // banchista sta dietro il banco (world_abitanti.js, stalls)
  suk() {
    const { PLAZA, CASE, VIE, MOSCHEA } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    const X = c(PLAZA.x), Z = c(PLAZA.y);
    this.addProp('pozzo_grande', X, Z, { scale: 1.2 });
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2 + 0.26;
      const rr = (PLAZA.r - 1.4) * TILE;
      const sx = X + Math.cos(a) * rr, sz = Z + Math.sin(a) * rr;
      this.addProp(this.pick(CASE.bancarelle), sx, sz, { flip: Math.cos(a) < 0, radius: 1.3 });
      this.stalls.push({ x: sx - Math.cos(a) * 2.0, z: sz - Math.sin(a) * 2.0,
                         flip: Math.cos(a) > 0 });
    }
    // lungo le vie grandi (le piu' larghe), entro 16 tile dalla moschea: una
    // bottega ogni 4 unita', ai due lati, fuori dalla via
    let k = 0;
    for (const [xa, ya, xb, yb, w] of VIE) {
      if (w < 1.6) continue;
      const L = Math.hypot(xb - xa, yb - ya) * TILE, est = Math.abs(xb - xa) > Math.abs(yb - ya);
      for (let u = 0; u < L; u += 4, k++) {
        const tx = xa + (xb - xa) * u / L, ty = ya + (yb - ya) * u / L;
        if (Math.hypot(tx - MOSCHEA.x, ty - MOSCHEA.y) > 16) continue;
        for (const s of [-1, 1]) {
          const x = c(tx) + (est ? 0 : s * 2.9 * TILE), z = c(ty) + (est ? s * 2.9 * TILE : 0);
          if (!this.freeAt(x, z, 1.4)) continue;
          this.addProp(this.pick(CASE.bancarelle), x, z, { radius: 1.3, flip: (k + s) % 2 === 0 });
          this.stalls.push(est ? { x, z: z - s * 2.2, flip: s > 0 } : { x: x - s * 2.2, z, flip: s < 0 });
        }
      }
    }
  },

  // L'oasi a levante: il laghetto (l'acqua la mette la pianta), l'erba
  // attorno, le palme in cerchio e qualche tenda di chi ci si ferma
  oasi() {
    const { OASI, FLORA } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    for (let dy = -OASI.r - 6; dy <= OASI.r + 6; dy++)
      for (let dx = -OASI.r - 6; dx <= OASI.r + 6; dx++) {
        const tx = OASI.x + dx, ty = OASI.y + dy;
        if (!this.inside(tx, ty)) continue;
        const d = Math.hypot(dx, dy);
        const i = this.idx(tx, ty);
        if (d > OASI.r + 1.4 && d < OASI.r + 6 - this.n2(tx * 0.4, ty * 0.4) * 2 &&
            this.terrain[i] !== T.ACQUA && this.terrain[i] !== T.ACQUA_CUPA && !this.road[i])
          this.terrain[i] = T.ERBA;
      }
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2 + this.rnd() * 0.2;
      const r = (OASI.r + 2.2 + this.rnd() * 3) * TILE;
      const x = c(OASI.x) + Math.cos(a) * r, z = c(OASI.y) + Math.sin(a) * r;
      if (this.freeAt(x, z, 1)) this.addProp(this.pick(FLORA.conifere), x, z, { sway: 1, scale: 1.2 });
    }
    for (const [dx, dz] of [[-1, 1], [1, 1.2]]) {
      const x = c(OASI.x) + dx * (OASI.r + 7) * TILE, z = c(OASI.y) + dz * (OASI.r + 4) * TILE;
      if (this.freeAt(x, z, 1.5)) this.addProp(this.pick(['accampamenti_05', 'accampamenti_06']),
                                               x, z, { radius: 1.4 });
    }
  },

  // L'arredo per quartiere: anfore, giare e botti nella medina, tappeti e
  // ceste di datteri al suk, vasi e lanterne nella casba; le torce lungo le vie
  arredoSaraceno() {
    const { RISERVATI } = this.pianta;
    const ARREDO = [
      [D.SLUMS, 190, ['props_deserto_10', 'props_deserto_12', 'props_deserto_13',
                      'props_deserto_21', 'props_deserto_09', 'props_deserto_19', 'cassa',
                      'botte', 'secchio', 'scala']],
      [D.MERCATO, 130, ['props_deserto_16', 'props_deserto_06', 'props_deserto_10',
                        'props_deserto_13', 'cassa', 'tendoni_01', 'tendoni_02']],
      [D.NOBILE, 60, ['props_deserto_07', 'fontana', 'vaso_fiori', 'lanterna_palo',
                      'props_deserto_17']],
    ];
    for (const [dd, quanti, lista] of ARREDO)
      this.scatter(lista, quanti, (tx, ty, x, z) =>
        this.districtAt(tx, ty) === dd && this.nearRoad(x, z, 2));
    // i tappeti in mostra al suk: ci si passa sopra, non sono ostacoli (29/09:
    // "il tappeto e' un oggetto invalicabile")
    this.scatter(['botteghe_14', 'props_deserto_15'], 30,
      (tx, ty, x, z) => this.districtAt(tx, ty) === D.MERCATO && this.nearRoad(x, z, 2),
      { solid: false });
    const riservato = (tx, ty) =>
      RISERVATI.some(q => tx >= q.x0 && tx <= q.x1 && ty >= q.y0 && ty <= q.y1);
    // i cortili dietro le case: un pozzo, una palma, le giare
    this.scatter(['pozzo', 'props_deserto_12', 'props_deserto_21', 'rocce_palme_08',
                  'rocce_palme_12'], 120,
      (tx, ty, x, z) => this.pianta.dentro(tx, ty) && !this.nearRoad(x, z, 3) &&
                        !riservato(tx, ty));
    for (let i = 0; i < 120; i++) {
      const x = this.rnd() * WS, z = this.rnd() * WS;
      const tx = Math.floor(x / TILE), ty = Math.floor(z / TILE);
      if (!this.inside(tx, ty) || !this.pianta.dentro(tx, ty)) continue;
      if (!this.nearRoad(x, z, 1) || !this.freeAt(x, z, 1)) continue;
      const torcia = this.rnd() < 0.6;
      this.addProp(torcia ? 'torcia' : 'braciere', x, z, { solid: false });
      this.lights.push({ x, y: torcia ? 2.4 : 1.8, z, color: [1.0, 0.6, 0.26],
                         radius: 12, flicker: 1.2 });
    }
  },
});
