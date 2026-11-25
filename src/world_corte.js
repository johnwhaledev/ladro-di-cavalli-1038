// world_corte.js — il castello di Valdarno com'era nel 1038: una torre di
// pietra col piano alto di legno (lotto meta, `castello_mastio`) dentro la
// cinta di pietra bassa della corte (cintaDellaCorte, world_borgo.js, la
// stessa della casba della Costa). Prima c'era il mastio composto con la
// cortina merlata; dal 05 al 06/10 la torre stava in un recinto di tronchi su
// terrapieno (_archive/20261006_recinto_corte.js).

Object.assign(World.prototype, {
  // La torre si vede di fronte e ci si entra dalla porta (interni.js,
  // src/stanze/castello.json): come ostacolo e' la sua pianta quadrata, fatta
  // di ostacoli senza sprite. E' piazzata senza scala: la sua grana e' quella
  // dei personaggi, e la porta e' piu' alta di un uomo
  castelloDiLegno() {
    const { CASTLE } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    const X = c(CASTLE.x), Z = c(CASTLE.y);
    const torre = this.addProp('castello_mastio', X, Z, { solid: false });
    const mezzo = torre ? torre.wu / 2 - 1 : 5;
    for (let dz = 0; dz <= mezzo * 2; dz += 2)
      for (let dx = -mezzo; dx <= mezzo; dx += 2)
        this.addMuro(X + dx, Z - dz, 1.5);
    this.castello = { porta: { x: X, z: Z + 2.2 } };
    this.cintaDellaCorte();
    this.arredoDellaCorte();
  },

  // La corte del 1038 (06/10, decisa con te): la sala del signore a ponente
  // della torre e la cappella a levante, due stalle lungo la cinta di ponente
  // col fieno davanti, le cataste lungo quella di levante, le botti accanto
  // alla sala, il pozzo di lato (dalla porta alla torre si va dritti), il
  // viale di vessilli e due carri fermi. Le misure partono dalla torre: i
  // borghi generati hanno la stessa corte. Il cortile e' di terra battuta
  // (baseTerrain, world.js)
  arredoDellaCorte() {
    const { CASTLE, CORTE } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    const X = c(CASTLE.x), Z = c(CASTLE.y);
    const x0 = CORTE.x0 * TILE, x1 = CORTE.x1 * TILE;
    // l'arredo sparso del quartiere nobile (lampioni, statue) ne sta fuori
    this.recinti.push({ x0, x1, z0: CORTE.y0 * TILE, z1: CORTE.y1 * TILE });
    this.edificioDellaCorte('sala_signore', { x: X - 16, z: Z + 1, fondo: 8 });
    this.edificioDellaCorte('cappella_corte', { x: X + 14, z: Z - 2, fondo: 10 });
    for (const dz of [24, 38]) {
      this.edificioDellaCorte('stalla_corte', { x: x0 + 5.5, z: Z + dz, fondo: 6 });
      this.addProp('mangiatoia', x0 + 10.5, Z + dz + 1.5);
    }
    for (const dz of [18, 27, 36]) this.addProp('catasta', x1 - 5, Z + dz);
    for (const [nome, dx, dz] of [['botte', -26, 1], ['botte_b', -27.4, 2.2],
                                  ['barile', -25.2, 3]])
      this.addProp(nome, X + dx, Z + dz);
    this.addProp('pozzo', X + 12, Z + 20);
    // un braciere accanto alla porta della torre (06/10, tua richiesta: di
    // notte la corte era buia), come all'ingresso della sala del jarl
    this.addProp('braciere', X + 4.5, Z + 3.5, { solid: false });
    this.lights.push({ x: X + 4.5, y: 1.8, z: Z + 3.5, color: [1.0, 0.58, 0.24],
                       radius: 14, flicker: 1.3 });
    for (const s of [-1, 1])
      for (let k = 0; k < 3; k++)
        this.addProp(k % 2 ? 'gonfalone_blu' : 'stendardo_azzurro',
                     X + s * 6, Z + 25 + k * 6, { solid: false, sway: 0.5 });
    // rot come i mezzi parcheggiati (aLatoDellaVia): PI/2 da nord a sud
    this.spawns.vehicles.push(
      { type: 'carro', name: 'carro_fieno', x: x0 + 17, z: Z + 30, rot: Math.PI / 2 },
      { type: 'carro', name: 'carro_merci', x: x1 - 11, z: Z + 40, rot: 0 });
  },

  // Un edificio della corte, di fronte, con l'ingombro dietro la facciata come
  // la torre: ostacoli senza sprite su `fondo` unita' verso nord
  edificioDellaCorte(nome, { x, z, fondo }) {
    const p = this.addProp(nome, x, z, { solid: false });
    if (!p) return;
    const mezzo = p.wu / 2 - 1;
    for (let dz = 0; dz <= fondo; dz += 2)
      for (let dx = -mezzo; dx <= mezzo; dx += 2)
        this.addMuro(x + dx, z - dz, 1.5);
  },
});
