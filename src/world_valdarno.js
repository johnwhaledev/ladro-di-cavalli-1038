// world_valdarno.js — le cinte del borgo di fiume del 1038 (pianta_borgo.js,
// 06/10): Valdarno e i borghi generati. buildTown (world_borgo.js) chiama
// cinteDelBorgo al posto della cinta rettangolare quando la pianta ha la
// PALIZZATA: il castrum di pietra sul poggio (buildCinta col suo rettangolo e
// la porta del castello), la palizzata del borgo su terrapieno coi pali del
// recinto del 05/10 (tools/pezzi_corte.py), le porte di legno, il ponte di
// pietra sul fiume, gli orti e le vigne.

const VARCO_LEGNO = { S: 3.5, N: 3.5, W: 8, E: 8 };   // mezza apertura delle porte, in unita'

Object.assign(World.prototype, {
  cinteDelBorgo() {
    const { CASTRUM } = this.pianta;
    this.buildCinta(CASTRUM, [{ x: CASTRUM.porta.x, y: CASTRUM.porta.y, dir: 'S' }]);
    this.palizzataDelBorgo();
    this.porteDiLegno();
    this.ponteSulFiume();
    this.ortiEVigne();
  },

  // Un tronco ogni 0,55 unita' lungo la spezzata e un ostacolo ogni due, come
  // il recinto del jarl; i terrapieni dei pali vicini si toccano e fanno
  // l'argine. Si ferma ai varchi delle porte
  palizzataDelBorgo() {
    const { PALIZZATA, GATES } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    const pali = ['palo_corte_a', 'palo_corte_b', 'palo_corte_c'];
    const varchi = GATES.map(g => ({ x: c(g.x), z: c(g.y), r: VARCO_LEGNO[g.dir] }));
    let k = 0;
    for (let i = 0; i + 1 < PALIZZATA.length; i++) {
      const [xa, ya] = PALIZZATA[i], [xb, yb] = PALIZZATA[i + 1];
      const L = Math.hypot(xb - xa, yb - ya) * TILE, n = Math.ceil(L / 0.55);
      for (let s = 0; s < n; s++, k++) {
        const x = c(xa) + (xb - xa) * TILE * s / n, z = c(ya) + (yb - ya) * TILE * s / n;
        if (varchi.some(v => Math.hypot(v.x - x, v.z - z) < v.r)) continue;
        this.addProp(pali[(k * 7 + (k >> 2)) % 3], x, z,
                     { solid: false, shadow: false, flip: k % 2 === 0 });
        if (k % 2 === 0) this.addMuro(x, z, 0.8);
      }
    }
  },

  // Le porte della palizzata: due torrette di guardia di legno ai lati del
  // varco, lungo la palizzata; a sud (di fronte alla camera) la porta di
  // legno col tettuccio; a ponente e a levante la via passa di taglio e
  // restano le torrette. Un braciere acceso dentro, a lato della via
  porteDiLegno() {
    const { GATES, PALIZZATA } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    for (const g of GATES) {
      const x = c(g.x), z = c(g.y), r = VARCO_LEGNO[g.dir];
      // il tratto di palizzata piu' vicino: la sua direzione
      let best = null, bd = Infinity;
      for (let i = 0; i + 1 < PALIZZATA.length; i++) {
        const [xa, ya] = PALIZZATA[i], [xb, yb] = PALIZZATA[i + 1];
        const L = Math.hypot(xb - xa, yb - ya) || 1;
        const t = Math.max(0, Math.min(1, ((g.x - xa) * (xb - xa) + (g.y - ya) * (yb - ya)) / (L * L)));
        const d = Math.hypot(xa + (xb - xa) * t - g.x, ya + (yb - ya) * t - g.y);
        if (d < bd) { bd = d; best = [(xb - xa) / L, (yb - ya) / L]; }
      }
      const [tx, tz] = best;
      for (const s of [-1, 1]) {
        const px = x + s * tx * (r + 1), pz = z + s * tz * (r + 1);
        this.addProp('torretta_corte', px, pz + 0.4, { solid: false, flip: s > 0 });
        this.addMuro(px, pz, 1.8);
      }
      if (g.dir === 'S' || g.dir === 'N') {
        this.addProp('porta_corte', x, z + 0.4, { solid: false, shadow: false });
        for (const s of [-1, 1]) this.addMuro(x + s * (r - 0.4), z, 0.7);
      }
      const bx = x + (g.dir === 'W' ? 6 : g.dir === 'E' ? -6 : 5);
      const bz = z + (g.dir === 'S' ? -5 : 6);
      this.addProp('braciere', bx, bz, { solid: false });
      this.lights.push({ x: bx, y: 1.8, z: bz, color: [1.0, 0.58, 0.24], radius: 13, flicker: 1.3 });
    }
  },

  // Il ponte di pietra (lotto meta del 06/10, steso a terra) sulla via
  // maestra, da riva a riva. Il piano calpestabile, fra i parapetti, diventa
  // terra in buildSolid (this.ponti): ci passano la gente e i carri; le
  // barche no, e il fiume resta diviso in due
  // Lungo da riva a riva sull'acqua vera (06/10, tua foto: "il ponte e'
  // staccato dalla riva?"): le tile d'acqua sotto il ponte, nelle sue colonne,
  // e le testate posate 4 unita' sulla terra di qua e di la'
  ponteSulFiume() {
    const { PONTE } = this.pianta;
    const r = Assets.world('ponte_fiume');
    const X = PONTE.x * TILE + TILE / 2;
    let y0 = Infinity, y1 = -Infinity;
    for (let tx = PONTE.x - 1; tx <= PONTE.x + 1; tx++)
      for (let ty = Math.floor(PONTE.y) - 12; ty <= Math.floor(PONTE.y) + 12; ty++) {
        const t = this.terrain[this.idx(tx, ty)];
        if (t === T.ACQUA || t === T.ACQUA_CUPA) { y0 = Math.min(y0, ty); y1 = Math.max(y1, ty); }
      }
    const z0 = y0 * TILE - 4, z1 = (y1 + 1) * TILE + 4, Z = (z0 + z1) / 2;
    const scale = r ? (z1 - z0) / r.hu : 1;
    const p = this.addProp('ponte_fiume', X, Z, { solid: false, shadow: false, scale,
                                                  piano: { alto: 0.3, ang: -Math.PI / 2 } });
    const mezzo = p ? p.wu / 2 - 2 : 5;
    this.ponti = [{ x0: X - mezzo, x1: X + mezzo, z0: z0 + 1, z1: z1 - 1 }];
  },

  // Gli orti e le vigne dentro la palizzata, a levante del mercatale (tua
  // scelta del 06/10): terra smossa, filari di vite a pergola nella meta' a
  // nord, meli a sud, una staccionata sul lato della via. Senza case (la
  // pianta li tiene fuori: RISERVATI, quartiere FUORI)
  ortiEVigne() {
    const { ORTI } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    // il bosco sparso (buildForest, dopo) non ci cresce dentro
    this.recinti.push({ x0: ORTI.x0 * TILE, x1: (ORTI.x1 + 1) * TILE,
                        z0: ORTI.y0 * TILE, z1: (ORTI.y1 + 1) * TILE });
    for (let ty = ORTI.y0; ty <= ORTI.y1; ty++)
      for (let tx = ORTI.x0; tx <= ORTI.x1; tx++)
        if (this.pianta.dentro(tx, ty) && !this.road[this.idx(tx, ty)])
          this.terrain[this.idx(tx, ty)] = T.TERRA;
    const meta = (ORTI.y0 + ORTI.y1) / 2;
    for (let ty = ORTI.y0 + 1; ty < ORTI.y1; ty += 2.5)
      for (let tx = ORTI.x0 + 1.5; tx < ORTI.x1 - 1; tx += ty < meta ? 2.2 : 4) {
        if (!this.pianta.dentro(tx, ty + 1) || this.nearRoad(c(tx), c(ty), 1.5)) continue;
        this.addProp(ty < meta ? 'pergolato' : 'melo', c(tx) + (this.rnd() - 0.5),
                     c(ty), { sway: ty < meta ? 0 : 1 });
      }
    for (let tx = ORTI.x0 + 1; tx < ORTI.x1; tx += 3)
      if (this.pianta.dentro(tx, ORTI.y0) && !this.nearRoad(c(tx), c(ORTI.y0), 1))
        this.addProp('staccionata', c(tx), ORTI.y0 * TILE, { radius: 1.0 });
  },
});
