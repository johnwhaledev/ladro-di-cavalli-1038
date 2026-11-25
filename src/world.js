// world.js — generazione del mondo: terreno, strade, fiume, quartieri, bosco.
//
// La macro-pianta e' scritta a mano (mura, porte, piazza, castello, porto,
// radure del bosco): un mondo interamente procedurale legge come rumore, e in
// un gioco alla GTA il giocatore deve potersi orientare a memoria. Il
// procedurale riempie: alberi, props, variazioni del terreno, vicoli.

const TILE = 4;            // unita' di mondo per tile di terreno
const WT = 192;            // tile per lato  → 768 unita' di mondo
const WS = WT * TILE;
const CH_T = 16;           // tile per chunk → 64 unita'
const CH_N = WT / CH_T;    // 12x12 chunk

const T = { ERBA: 0, TERRA: 1, FANGO: 2, SABBIA: 3, GHIAIA: 4, PIETRA: 5,
            ACQUA: 6, ACQUA_CUPA: 7, NEVE: 8, ROCCIA: 9 };

// quartieri
const D = { BOSCO: 0, CAMPI: 1, SLUMS: 2, MERCATO: 3, NOBILE: 4, PORTO: 5,
            FIUME: 6, FUORI: 7 };

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// rumore a valore, bilineare — basta per macchiare il terreno
function makeNoise(seed) {
  const r = mulberry32(seed);
  const N = 256;
  const g = new Float32Array(N * N);
  for (let i = 0; i < g.length; i++) g[i] = r();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const at = (a, b) => g[((b & (N - 1)) * N + (a & (N - 1)))];
    const s = t => t * t * (3 - 2 * t);
    const u = s(fx), v = s(fy);
    return (at(xi, yi) * (1 - u) + at(xi + 1, yi) * u) * (1 - v) +
           (at(xi, yi + 1) * (1 - u) + at(xi + 1, yi + 1) * u) * v;
  };
}

// La pianta (cinta, porte, piazza, vie, fiume...) sta in piante.js: World la
// riceve e i metodi la leggono da this.pianta.

class World {
  constructor(seed = 20260917, pianta = PIANTE.valdarno) {
    this.seed = seed;
    this.pianta = pianta;
    this.rnd = mulberry32(seed);
    this.n1 = makeNoise(seed);
    this.n2 = makeNoise(seed ^ 0x9e37);
    this.terrain = new Uint8Array(WT * WT);
    this.district = new Uint8Array(WT * WT);
    this.road = new Uint8Array(WT * WT);      // 0 no · 1 sterrato · 2 ciottoli
    this.solid = null;                        // griglia collisioni a mezzo tile
    this.props = [];                          // {name,x,z,rot,scale,shadow,solid}
    this.lights = [];                         // {x,z,y,color,radius,flicker}
    this.spawns = { player: null, givers: [], vehicles: [], npcs: [] };
    this.stalls = [];      // posizione dei banchisti in piazza
    this.residents = [];   // gente con un posto fisso e un mestiere
    this.patrol = [];      // punti di ronda sulle strade
    this.nemici = [];      // guerrieri dell'altro villaggio, negli accampamenti
    this.accampamenti = [];
    this.recinti = [];     // aree chiuse (il cimitero): l'arredo sparso ne sta fuori
    this.build();
  }

  idx(tx, ty) { return ty * WT + tx; }
  inside(tx, ty) { return tx >= 0 && ty >= 0 && tx < WT && ty < WT; }

  // ---------------------------------------------------------------- terreno

  // quanto si e' lontani dall'acqua, in tile: per un fiume la distanza dalla
  // mezzeria; una pianta con la sua funzione acqua(tx, ty) (il mare del
  // fiordo, genera_pianta.js) dice lei dov'e' l'acqua, con la stessa misura
  distAcqua(tx, ty) {
    const { acqua, riverCenter } = this.pianta;
    return acqua ? acqua(tx, ty) : Math.abs(tx - riverCenter(ty));
  }

  districtAt(tx, ty) {
    const { WALL, riverCenter, QUARTIERI: Q } = this.pianta;
    const rc = riverCenter(ty);
    if (this.distAcqua(tx, ty) < 5.2) return D.FIUME;
    // una pianta che non e' un rettangolo (la mezzaluna del fiordo) dice lei
    // i suoi quartieri dentro la cinta; fuori vale il resto
    if (this.pianta.quartiere) {
      const q = this.pianta.quartiere(tx, ty);
      if (q !== null) return q;
      if (tx >= WALL.x0 && tx <= WALL.x1 && ty >= WALL.y0 && ty <= WALL.y1) return D.FUORI;
    }
    if (tx > rc && tx < WALL.x0 && ty > Q.porto.y0 && ty < Q.porto.y1) return D.PORTO;
    if (tx >= WALL.x0 && tx <= WALL.x1 && ty >= WALL.y0 && ty <= WALL.y1) {
      if (tx < Q.bassifondi) return D.SLUMS;
      if (tx < Q.mercato) return D.MERCATO;
      return D.NOBILE;
    }
    if (ty > Q.campi && tx > rc + 6) return D.CAMPI;
    if (ty < WALL.y0 - Q.bosco.nord || tx > WALL.x1 + Q.bosco.est) return D.BOSCO;
    return D.FUORI;
  }

  baseTerrain(tx, ty, d) {
    // il fiordo ha la neve dove Valdarno ha l'erba
    const ERBA = this.pianta.SUOLO ?? T.ERBA;
    const n = this.n1(tx * 0.09, ty * 0.09);
    const m = this.n2(tx * 0.31, ty * 0.31);
    switch (d) {
      case D.FIUME: {
        const k = this.distAcqua(tx, ty);
        if (k < 3.4) return T.ACQUA_CUPA;
        if (k < 4.6) return T.ACQUA;
        return this.pianta.RIVA ?? T.SABBIA;          // il fiordo: ghiaia
      }
      case D.PORTO:
        if (this.pianta.CITTA_NEVE) return m > 0.6 ? T.GHIAIA : (n > 0.55 ? T.FANGO : T.NEVE);
        if (this.pianta.CITTA_SABBIA) return m > 0.66 ? T.GHIAIA : T.SABBIA;
        return m > 0.62 ? T.PIETRA : T.GHIAIA;
      // il fiordo: dentro la palizzata neve battuta e fango, non lastricato;
      // la Costa: terra battuta e sabbia (lastricate sono solo le vie)
      case D.SLUMS: case D.MERCATO: case D.NOBILE:
        if (this.pianta.CITTA_NEVE) return n > 0.7 ? T.FANGO : (m > 0.8 ? T.TERRA : T.NEVE);
        if (this.pianta.CITTA_SABBIA) return n > 0.6 ? T.TERRA : (m > 0.72 ? T.GHIAIA : T.SABBIA);
        if (this.inCorte(tx, ty)) return m > 0.8 ? T.GHIAIA : T.TERRA;  // terra battuta
        if (d !== D.SLUMS) return this.terrenoCitta(d, n, m);
        return n > 0.55 ? T.FANGO : (m > 0.7 ? T.TERRA : T.FANGO);
      case D.CAMPI: return n > 0.5 ? T.TERRA : (m > 0.78 ? ERBA : T.TERRA);
      case D.BOSCO: return n > 0.72 ? T.TERRA : ERBA;
      default: return n > 0.78 ? T.TERRA : ERBA;
    }
  }

  // dentro la cinta della corte del castello (06/10: il cortile del 1038)
  inCorte(tx, ty) {
    const K = this.pianta.CORTE;
    return !!K && tx >= K.x0 && tx < K.x1 && ty >= K.y0 && ty < K.y1;
  }

  terrenoCitta(d, n, m) {
    // fuori dalle vie lastricate il mercato e' terra battuta: senza questo
    // contrasto il quartiere diventa una distesa grigia uniforme
    if (d === D.MERCATO) return n > 0.58 ? T.GHIAIA : (m > 0.45 ? T.TERRA : T.GHIAIA);
    return n > 0.62 ? T.GHIAIA : T.PIETRA;
  }

  // ---------------------------------------------------------------- strade

  stampRoad(x0, y0, x1, y1, w, kind) {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t;
      const wob = kind === 1 ? this.n2(cx * 0.2, cy * 0.2) * 1.4 - 0.7 : 0;
      for (let dy = -w; dy <= w; dy++) {
        for (let dx = -w; dx <= w; dx++) {
          if (dx * dx + dy * dy > (w + wob) * (w + wob)) continue;
          const tx = Math.round(cx + dx), ty = Math.round(cy + dy);
          if (!this.inside(tx, ty)) continue;
          if (this.district[this.idx(tx, ty)] === D.FIUME) continue;
          this.road[this.idx(tx, ty)] = kind;
        }
      }
    }
  }

  buildRoads() {
    const { PLAZA, CASTLE, CORTE, VIE, STRADE_CAMPAGNA, LUOGHI } = this.pianta;
    // vie interne (ciottoli), v. VIE; e l'accesso al castello, dall'arteria
    // alla porta del cortile, e il sagrato davanti alla chiesa
    for (const [a, b, c2, d, w] of VIE) this.stampRoad(a, b, c2, d, w, 2);
    this.stampRoad(CASTLE.x, CORTE.y1, CASTLE.x, LUOGHI.arteria, 1.4, 2);
    this.stampRoad(...LUOGHI.sagrato, 2);
    // piazza lastricata (il thing del fiordo no: e' un prato di neve battuta)
    if (!this.pianta.PIAZZA_APERTA)
    for (let dy = -PLAZA.r; dy <= PLAZA.r; dy++)
      for (let dx = -PLAZA.r; dx <= PLAZA.r; dx++)
        if (dx * dx + dy * dy <= PLAZA.r * PLAZA.r)
          if (this.inside(PLAZA.x + dx, PLAZA.y + dy))
            this.road[this.idx(PLAZA.x + dx, PLAZA.y + dy)] = 2;
    // vicoli dei bassifondi: storti, ma a una distanza in cui le case ci
    // stanno (prima nove a 2,3 tile l'uno dall'altro, e fra due vicoli non
    // entrava niente)
    // (li ricorda: buildTown ci allinea le case come sulle vie)
    this.vicoli = [];
    const V = LUOGHI.vicoli;
    for (const x of V.x) {
      const xs = x + this.rnd() * 1.2;
      const v = [xs, V.y0, xs + this.rnd() * 3 - 1.5, V.y1, 0.9];
      this.stampRoad(...v, 1);
      this.vicoli.push(v);
    }
    // vie di campagna
    for (const s of STRADE_CAMPAGNA) this.stampRoad(...s, 1);
  }

  // ---------------------------------------------------------------- props

  addProp(name, x, z, opt = {}) {
    const r = Assets.world(name);
    if (!r) return null;
    const p = {
      name, x, z,
      hu: (opt.hu || r.hu) * (opt.scale || 1),
      wu: (opt.wu || r.wu) * (opt.scale || 1),
      flip: opt.flip || false,
      solid: opt.solid === undefined ? true : opt.solid,
      radius: opt.radius,
      shadow: opt.shadow === undefined ? true : opt.shadow,
      sway: opt.sway || 0,
    };
    if (opt.piano) p.piano = opt.piano;    // steso e rialzato, v. gfx.js
    if (opt.parete) p.parete = opt.parete; // fianco di un muro di taglio, v. gfx.js
    if (opt.sopra) p.sopra = opt.sopra;    // in piedi su un piano rialzato, v. gfx.js
    if (opt.ombraRett) p.ombraRett = opt.ombraRett;   // ombra netta a terra, v. gfx.js
    if (p.radius === undefined) p.radius = Math.max(0.5, p.wu * 0.33);
    this.props.push(p);
    return p;
  }

  // Ostacolo senza sprite: le campate delle mura sono lunghe 12 unita' ma
  // sottili, e un cerchio solo o le lasciava bucate o le ingrossava. Il
  // renderer e la minimappa lo saltano (nessun nome, altezza zero).
  addMuro(x, z, radius) {
    this.props.push({ name: null, x, z, hu: 0, wu: 0, flip: false,
                      solid: true, radius, shadow: false, sway: 0 });
  }

  pick(list) { return list[Math.floor(this.rnd() * list.length)]; }

  // Sceglie un modello evitando quelli gia' usati li' vicino. Senza questo
  // vengono fuori file di quattro case identiche e il borgo sembra
  // prefabbricato.
  pickVario(list, x, z, raggio = 26) {
    const vicini = new Set();
    for (const p of this.props) {
      if (p.hu < 3) continue;
      if ((p.x - x) ** 2 + (p.z - z) ** 2 < raggio * raggio) vicini.add(p.name);
    }
    const liberi = list.filter(n => !vicini.has(n));
    return this.pick(liberi.length ? liberi : list);
  }

  freeAt(x, z, r) {
    const tx = Math.floor(x / TILE), ty = Math.floor(z / TILE);
    if (!this.inside(tx, ty)) return false;
    const i = this.idx(tx, ty);
    if (this.road[i]) return false;
    const t = this.terrain[i];
    if (t === T.ACQUA || t === T.ACQUA_CUPA) return false;
    for (const p of this.props) {
      if (!p.solid) continue;
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < (p.radius + r) ** 2) return false;
    }
    return true;
  }

  // edifici affacciati sulla strada: cerco una cella libera che abbia strada
  // a meno di 3 tile, cosi' le case non nascono in mezzo ai campi
  nearRoad(x, z, maxTiles) {
    const tx = Math.floor(x / TILE), ty = Math.floor(z / TILE);
    for (let dy = -maxTiles; dy <= maxTiles; dy++)
      for (let dx = -maxTiles; dx <= maxTiles; dx++)
        if (this.inside(tx + dx, ty + dy) && this.road[this.idx(tx + dx, ty + dy)])
          return true;
    return false;
  }

  scatter(names, count, test, opt = {}) {
    let placed = 0, tries = 0;
    while (placed < count && tries < count * 60) {
      tries++;
      const x = this.rnd() * WS, z = this.rnd() * WS;
      const tx = Math.floor(x / TILE), ty = Math.floor(z / TILE);
      if (!this.inside(tx, ty)) continue;
      if (!test(tx, ty, x, z)) continue;
      if (this.recinti.some(q => x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1)) continue;
      // `names` puo' essere una funzione del punto: serve al bosco a macchie
      const name = typeof names === 'function' ? names(x, z) : this.pick(names);
      const r = Assets.world(name);
      if (!r) continue;
      const rad = Math.max(0.5, r.wu * (opt.scale || 1) * 0.33);
      if (!this.freeAt(x, z, rad)) continue;
      this.addProp(name, x, z, { ...opt, flip: this.rnd() < 0.5 });
      placed++;
    }
    return placed;
  }

  blockedTile(tx, ty) {
    const x = tx * TILE + TILE / 2, z = ty * TILE + TILE / 2;
    return !this.inside(Math.floor(tx), Math.floor(ty)) || this.blocked(x, z);
  }

  // ------------------------------------------------------------- ronde
  //
  // Le guardie non devono vagare a caso: devono battere le strade. Raccolgo i
  // punti di ronda campionando le vie lastricate dentro le mura e le porte.

  buildPatrol() {
    const { WALL, GATES } = this.pianta;
    const step = 5;
    for (let ty = WALL.y0; ty <= WALL.y1; ty += step) {
      for (let tx = WALL.x0; tx <= WALL.x1; tx += step) {
        if (!this.inside(tx, ty)) continue;
        if (this.road[this.idx(tx, ty)] !== 2) continue;
        const x = tx * TILE + TILE / 2, z = ty * TILE + TILE / 2;
        if (this.blocked(x, z)) continue;
        this.patrol.push({ x, z });
      }
    }
    for (const g of GATES) {
      this.patrol.push({ x: g.x * TILE + TILE / 2, z: g.y * TILE + TILE / 2 });
    }
  }

  // ------------------------------------------------------------- collisioni

  buildSolid() {
    const S = 2;                      // mezzo tile → 2 unita' per cella
    const N = WS / S;
    this.solidN = N; this.solidS = S;
    this.solid = new Uint8Array(N * N);
    for (let ty = 0; ty < WT; ty++) {
      for (let tx = 0; tx < WT; tx++) {
        const t = this.terrain[this.idx(tx, ty)];
        if (t !== T.ACQUA && t !== T.ACQUA_CUPA) continue;
        for (let a = 0; a < TILE / S; a++)
          for (let b = 0; b < TILE / S; b++) {
            const cx = Math.floor((tx * TILE) / S) + a;
            const cy = Math.floor((ty * TILE) / S) + b;
            if (cx >= 0 && cy >= 0 && cx < N && cy < N) this.solid[cy * N + cx] = 2;
          }
      }
    }
    for (const p of this.props) {
      if (!p.solid) continue;
      const r = p.radius;
      // la cella in cui sta, per gli ostacoli da 0,7 in su: con celle da 2
      // unita' un ostacolo di raggio sotto 1,42 caduto su un angolo non
      // copriva nessun centro di cella e non bloccava niente (26/09: il
      // recinto della sala del jarl si attraversava da ogni lato). Non per
      // l'arredo piccolo (banchi, barili): la cella intera lo ingrossava, e il
      // banco davanti alla bottega di Ferrante chiudeva il ladro all'uscita
      const pc = Math.floor(p.x / S), pd = Math.floor(p.z / S);
      if (r >= 0.7 && pc >= 0 && pd >= 0 && pc < N && pd < N) this.solid[pd * N + pc] = 1;
      const c0 = Math.floor((p.x - r) / S), c1 = Math.ceil((p.x + r) / S);
      const d0 = Math.floor((p.z - r) / S), d1 = Math.ceil((p.z + r) / S);
      for (let cy = d0; cy <= d1; cy++)
        for (let cx = c0; cx <= c1; cx++) {
          if (cx < 0 || cy < 0 || cx >= N || cy >= N) continue;
          const wx = cx * S + S / 2, wz = cy * S + S / 2;
          if ((wx - p.x) ** 2 + (wz - p.z) ** 2 <= r * r) this.solid[cy * N + cx] = 1;
        }
    }
    // i moli e i ponti (il ruscello del fiordo, 06/10) sono terra sull'acqua:
    // ci si cammina, le barche li scansano
    for (const m of [...(this.moli || []), ...(this.ponti || [])])
      for (let cy = Math.floor(m.z0 / S); cy <= Math.floor(m.z1 / S); cy++)
        for (let cx = Math.floor(m.x0 / S); cx <= Math.floor(m.x1 / S); cx++)
          if (cx >= 0 && cy >= 0 && cx < N && cy < N) this.solid[cy * N + cx] = 0;
  }

  // sotto un ponte (il piano calpestabile, this.ponti), con un margine
  sottoPonte(x, z, m = 0) {
    return (this.ponti || []).some(q => x > q.x0 - m && x < q.x1 + m &&
                                        z > q.z0 - m && z < q.z1 + m);
  }

  // sulle assi di un ponte o di un molo (07/10, tua foto: la gente sul ponte
  // senza gambe): il piano e' steso a 0,16, i piedi a 0,02; gfx.js alza chi
  // ci sta sopra
  sopraAssi(x, z) {
    return [...(this.moli || []), ...(this.ponti || [])].some(q =>
      x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1);
  }

  // come move, ma per chi sta sull'acqua (le barche): e' la terra a bloccare.
  // Sotto i ponti si passa (06/10: il ponte di Valdarno divideva il fiume)
  naviga(x, z, dx, dz, r = 1.0) {
    const secco = (a, b) => {
      const N = this.solidN, S = this.solidS;
      const cx = Math.floor(a / S), cy = Math.floor(b / S);
      return cx < 0 || cy < 0 || cx >= N || cy >= N ||
             (this.solid[cy * N + cx] !== 2 && !this.sottoPonte(a, b, S));   // buildSolid libera celle intere
    };
    let nx = x + dx, nz = z + dz;
    if (secco(nx + Math.sign(dx) * r, z)) nx = x;
    if (secco(x, nz + Math.sign(dz) * r)) nz = z;
    if (nx !== x && nz !== z && secco(nx + Math.sign(dx) * r, nz + Math.sign(dz) * r)) {
      if (Math.abs(dx) > Math.abs(dz)) nz = z; else nx = x;
    }
    return [nx, nz];
  }

  blocked(x, z) {
    const N = this.solidN, S = this.solidS;
    const cx = Math.floor(x / S), cy = Math.floor(z / S);
    if (cx < 0 || cy < 0 || cx >= N || cy >= N) return 1;
    return this.solid[cy * N + cx];
  }

  // scivolamento lungo gli ostacoli: senza questo ci si incastra in ogni angolo
  move(x, z, dx, dz, r = 0.45) {
    let nx = x + dx, nz = z + dz;
    if (this.blocked(nx + Math.sign(dx) * r, z)) nx = x;
    if (this.blocked(x, nz + Math.sign(dz) * r)) nz = z;
    if (nx !== x && nz !== z && this.blocked(nx + Math.sign(dx) * r,
                                             nz + Math.sign(dz) * r)) {
      if (Math.abs(dx) > Math.abs(dz)) nz = z; else nx = x;
    }
    return [Math.max(1, Math.min(WS - 1, nx)), Math.max(1, Math.min(WS - 1, nz))];
  }

  // ---------------------------------------------------------------- build

  build() {
    for (let ty = 0; ty < WT; ty++) {
      for (let tx = 0; tx < WT; tx++) {
        const d = this.districtAt(tx, ty);
        this.district[this.idx(tx, ty)] = d;
        this.terrain[this.idx(tx, ty)] = this.baseTerrain(tx, ty, d);
      }
    }
    this.buildRoads();
    // il fiordo e la Costa hanno la loro urbanistica (world_fiordo.js,
    // world_costa.js)
    if (this.pianta.stile === 'fiordo') this.buildTownVichinga();
    else if (this.pianta.stile === 'costa') this.buildTownSaracena();
    else this.buildTown();
    this.buildPort();
    this.buildAccampamentiNemici();
    this.buildForest();
    if (this.pianta.FLORA?.scogli) this.buildScogli();   // solo il fiordo
    this.buildFields();
    this.buildSpawns();
    this.buildSolid();
    this.buildResidents();
    this.buildPatrol();
    this.buildCasaDiPiacere();
    this.buildOsterie();
    this.buildCunicolo();

    // indice dei props per chunk: la geometria statica si costruisce per chunk
    this.propsByChunk = new Map();
    for (const p of this.props) {
      const k = (Math.floor(p.z / (CH_T * TILE)) * CH_N) +
                Math.floor(p.x / (CH_T * TILE));
      if (!this.propsByChunk.has(k)) this.propsByChunk.set(k, []);
      this.propsByChunk.get(k).push(p);
    }
  }
}
