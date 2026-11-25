// world_campagna.js — fuori dalle mura: bosco a macchie, campi, accampamenti nemici.
//
// Metodi di World (world.js) tenuti in un file a parte perche' world.js
// stava oltre la misura: stesso codice, stessa sequenza di costruzione
// (World.build() li chiama per nome).

Object.assign(World.prototype, {
  buildForest() {
    const { CAMP } = this.pianta;
    // Il bosco si fa a macchie: pinete e abetaie da una parte, querce,
    // frassini e latifoglie dall'altra, e una fascia stretta dove si
    // mescolano. Prima ogni albero era estratto a caso dall'intera lista, e
    // pino e quercia stavano fianco a fianco ovunque. Niente quercia,
    // quercia_b, quercia_c (chiome senza tronco, sembravano sospese) e niente
    // melo, che e' un albero da frutteto e sta nei campi.
    // Una pianta puo' dare la sua flora (FLORA, il fiordo: pini innevati e
    // alberi spogli); senza, quella di Valdarno. Le liste cambiano, i numeri
    // tirati no: pick ne tira uno qualunque sia la lista
    const F = this.pianta.FLORA || {};
    const conifere = F.conifere || ['pino', 'pino_b', 'abete', 'faggio_pc', 'faggio_pc_b',
                                    'pioppo_pc', 'pioppo_pc_b'];
    const latifoglie = F.latifoglie || ['frassino', 'albero_a', 'albero_b', 'albero_c',
                                        'albero_d', 'albero_e', 'albero_f', 'albero_g',
                                        'quercia_pc', 'quercia_pc_b'];
    const specie = (x, z) => {
      const n = this.n1(x / TILE * 0.035 + 97.3, z / TILE * 0.035 + 41.7);
      const conifera = Math.min(1, Math.max(0, (n - 0.44) / 0.12));
      return this.pick(this.rnd() < conifera ? conifere : latifoglie);
    };
    const small = F.piccoli || ['cespuglio_a', 'cespuglio_b', 'cespuglio_c', 'cespuglio_d',
                                'cespuglio_e', 'cespuglio_f', 'cespuglio_g', 'arbusto',
                                'rovi', 'siepe_alta', 'boschetto', 'ceppaia', 'tronchi',
                                'massi', 'arbusto_pc'];
    const floor = F.suolo || ['fiori_a', 'fiori_b', 'fiori_c', 'erba_a', 'erba_b'];

    // radure: macchie dove la densita' crolla, cosi' il bosco ha respiro
    const clearings = [];
    for (let i = 0; i < 14; i++) {
      clearings.push({ x: this.rnd() * WS, z: this.rnd() * WS,
                       r: (7 + this.rnd() * 9) * TILE });
    }
    // gli accampamenti nemici sono radure per costruzione: gli alberi non
    // devono richiudersi sopra le tende
    for (const a of this.accampamenti)
      clearings.push({ x: a.x, z: a.z, r: 13 * TILE });
    // e anche l'accampamento dei fuorilegge (26/09: una quercia gli era
    // cresciuta sopra il fuoco e lo copriva)
    const campo = { x: CAMP.x * TILE + TILE / 2, z: CAMP.y * TILE + TILE / 2 };
    clearings.push({ ...campo, r: 12 * TILE });
    const inClearing = (x, z) =>
      clearings.some(k => (k.x - x) ** 2 + (k.z - z) ** 2 < k.r * k.r);
    // attorno al fuoco di un campo nemico niente alberi, nemmeno per caso: la
    // cassa del bottino deve vedersi (un albero a sud di lei la copriva)
    const nucleo = (x, z) => this.accampamenti.some(a =>
      (a.x - x) ** 2 + (a.z - z) ** 2 < (7 * TILE) ** 2) ||
      (campo.x - x) ** 2 + (campo.z - z) ** 2 < (8 * TILE) ** 2;

    // FLORA.densita: la macchia di palme della Costa e' rada (29/09); senza,
    // 1 e i numeri tirati restano quelli
    const k = F.densita ?? 1;
    // gli alberi non a ridosso delle strade (30/09, tua foto: alberi in mezzo
    // alla via): prima guardavano solo la tile del tronco, e la strada
    // disegnata sborda di una tile
    const lontano = (x, z) => !this.nearRoad(x, z, 1);
    const isWood = (tx, ty, x, z) => {
      if (this.districtAt(tx, ty) !== D.BOSCO || nucleo(x, z)) return false;
      if (!lontano(x, z)) return false;
      const dens = this.n1(tx * 0.05, ty * 0.05);
      if (inClearing(x, z)) return this.rnd() < 0.08 * k;
      return this.rnd() < (0.35 + dens * 0.5) * k;
    };

    this.scatter(specie, 2600, isWood, { sway: 1, scale: 1.35 });
    this.scatter(small, 1300, (tx, ty, x, z) =>
      this.districtAt(tx, ty) === D.BOSCO && !this.road[this.idx(tx, ty)] &&
      !nucleo(x, z),
      { sway: 0.6, scale: 1.15 });
    this.scatter(floor, 1400, (tx, ty) => {
      const d = this.districtAt(tx, ty);
      return (d === D.BOSCO || d === D.FUORI || d === D.CAMPI) &&
             !this.road[this.idx(tx, ty)];
    }, { solid: false, shadow: false, sway: 0.4 });

    this.scatter(specie, 700, (tx, ty, x, z) => {
      const d = this.districtAt(tx, ty);
      return (d === D.FUORI) && lontano(x, z) &&
             this.rnd() < 0.55 * k;
    }, { sway: 1, scale: 1.2 });

    // accampamento dei fuorilegge in una radura
    const c = n => n * TILE + TILE / 2;
    this.addProp('falo', c(CAMP.x), c(CAMP.y), { solid: false });
    this.lights.push({ x: c(CAMP.x), y: 1.4, z: c(CAMP.y),
                       color: [1.0, 0.52, 0.18], radius: 20, flicker: 1.6 });
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      const rr = 5 * TILE + this.rnd() * 10;
      // i fuorilegge non stanno col borgo (blu) ne' con l'altro villaggio
      // (rosso): tende grezze. Via anche il carro di tre quarti delle tavole
      this.addProp(this.pick(['tenda_crema', 'tenda_crema', 'botte', 'cassa',
                              'catasta', 'rastrelliera']),
                   c(CAMP.x) + Math.cos(a) * rr, c(CAMP.y) + Math.sin(a) * rr,
                   { flip: this.rnd() < 0.5 });
    }
    this.spawns.givers.push({ x: c(CAMP.x) + 6, z: c(CAMP.y) + 6,
                              sprite: this.cast('capo_briganti')[0], flip: true,
                              name: TX('committenti.atto1.briganti') });
  },

  buildFields() {
    const c = n => n * TILE + TILE / 2;
    // il Campo del Guado sta nei campi: niente case ne' alberi attorno al suo
    // fuoco (una casa colonica gli nasceva in mezzo), come nel bosco
    const nucleo = (x, z) => this.accampamenti.some(a =>
      (a.x - x) ** 2 + (a.z - z) ** 2 < (7 * TILE) ** 2);
    // una pianta puo' dare le sue case e i suoi recinti di campagna (CAMPAGNA,
    // la Costa: case di terra e muretti, 29/09); senza, quelli di Valdarno.
    // I numeri tirati restano quelli
    const CA = this.pianta.CAMPAGNA || {};
    this.scatter(CA.recinti || ['staccionata', 'staccionata_lunga', 'recinto', 'siepe_alta'],
                 260, (tx, ty) => this.districtAt(tx, ty) === D.CAMPI &&
                 !this.road[this.idx(tx, ty)], { radius: 1.2 });
    this.scatter(CA.case || ['fienile', 'edificio_stalla', 'edificio_casa'], 22,
                 (tx, ty, x, z) => this.districtAt(tx, ty) === D.CAMPI &&
                 this.nearRoad(x, z, 3) &&
                 !this.accampamenti.some(a => (a.x - x) ** 2 + (a.z - z) ** 2 < a.r * a.r));
    this.scatter(this.pianta.FLORA?.campi || ['albero_a', 'melo', 'albero_g', 'cespuglio_d'], 220,
                 (tx, ty, x, z) => this.districtAt(tx, ty) === D.CAMPI && !nucleo(x, z) &&
                   !this.nearRoad(x, z, 1),
                 { sway: 1 });
    const { croce } = this.pianta.LUOGHI;
    this.addProp(this.pianta.FLORA?.croce || 'croce_legno', c(croce.x), c(croce.y), { solid: false });
  },

  // Gli scogli del fiordo (stile "fiordo" di genera_pianta.js): in mare lungo
  // la costa e qualcuno sulla riva, sparsi. Davanti ai moli il mare resta
  // libero, perche' in barca si esce di li'. Solidi: in mare la barca li
  // scansa come fa con la terra. Solo se la pianta li chiede (FLORA.scogli):
  // Valdarno non tira un numero in piu'
  buildScogli() {
    if (this.pianta.MARE_LIBERO) return this.scogliAttornoAllAcqua();
    const { riverCenter, LUOGHI, FLORA } = this.pianta;
    const M = LUOGHI.moli;
    const c = n => n * TILE + TILE / 2;
    const porto = ty => ty > M.y0 - 12 && ty < M.y0 + M.n * M.passo + 8;
    for (let i = 0; i < 170; i++) {
      const ty = 2 + this.rnd() * (WT - 4);
      const riva = this.rnd() < 0.25;
      const tx = riverCenter(ty) + (riva ? 5.2 + this.rnd() * 1.5 : -1 - this.rnd() * 16);
      const scala = 0.8 + this.rnd() * 0.7;
      if (porto(ty) || !this.inside(Math.floor(tx), Math.floor(ty))) continue;
      if (riva && !this.freeAt(c(tx), c(ty), 1.5)) continue;
      this.addProp(this.pick(FLORA.scogli), c(tx), c(ty),
                   { flip: this.rnd() < 0.5, scale: scala });
    }
  },

  // Gli scogli quando l'acqua non e' una costa a ponente (il fiordo del 06/10:
  // l'insenatura a levante e il braccio di mare, pianta.MARE_LIBERO): sulle
  // tile a ridosso dell'acqua, nel basso fondale o sulla riva, ma non davanti
  // al borgo, dove stanno i moli e passano le barche. Nel mezzo del braccio
  // l'acqua e' cupa (distAcqua 0) e resta libera per uscire al largo
  scogliAttornoAllAcqua() {
    const { WALL, FLORA } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    let messi = 0;
    for (let i = 0; i < 8000 && messi < 150; i++) {
      const tx = this.rnd() * WT, ty = this.rnd() * WT;
      const d = this.distAcqua(Math.floor(tx), Math.floor(ty));
      const riva = d >= 4.6 && d < 6.2;
      if (!riva && !(d > 0.4 && d < 3.4)) continue;
      if (tx > WALL.x0 - 4 && tx < WALL.x1 + 6 && ty > WALL.y0 - 4 && ty < WALL.y1 + 4) continue;
      if (riva && !this.freeAt(c(tx), c(ty), 1.5)) continue;
      this.addProp(this.pick(FLORA.scogli), c(tx), c(ty),
                   { flip: this.rnd() < 0.5, scale: 0.8 + this.rnd() * 0.7 });
      messi++;
    }
  },

  // ------------------------------------------------- accampamenti nemici
  //
  // Tre teste di ponte dell'altro villaggio, piantate nel bosco lontano dalle
  // mura. Da qui partono le scorrerie sul borgo. Si riconoscono a colpo
  // d'occhio: tende, insegne e divise rosse, contro il blu del borgo.

  buildAccampamentiNemici() {
    const c = n => n * TILE + TILE / 2;
    this.accampamenti = [];
    this.nemici = [];
    const posti = this.pianta.LUOGHI.campiNemici;

    for (const pos of posti) {
      const x = c(pos.tx), z = c(pos.ty);
      const t = this.terrain[this.idx(pos.tx, pos.ty)];
      if (t === T.ACQUA || t === T.ACQUA_CUPA) continue;

      // il vessillo e' il punto da prendere: sta accanto al fuoco, isolato,
      // cosi' la conquista ha un luogo e non una zona vaga
      const acc = { nome: pos.nome, x, z, r: 16 * TILE, svaligiato: 0,
                    vessillo: { x: x + 3.2, z: z - 2.4 },
                    insegne: [], luce: null, indice: this.accampamenti.length };

      // l'altro villaggio veste di rosso, e rosso e' tutto il campo: tende,
      // insegne, perfino la luce del fuoco. Il borgo e' blu.
      this.addProp('falo', x, z, { solid: false });
      acc.luce = { x, y: 1.4, z, color: [1.0, 0.36, 0.26],
                   radius: 22, flicker: 1.5 };
      this.lights.push(acc.luce);

      // la cassa del bottino: e' il punto del colpo, e si vede da lontano
      this.addProp('cassa', acc.vessillo.x, acc.vessillo.z, { scale: 1.5 });
      const p = this.addProp('stendardo_rosso', acc.vessillo.x - 2.2,
                             acc.vessillo.z - 1.5,
                             { scale: 1.6, solid: false, sway: 0.7 });
      if (p) acc.insegne.push(p);

      // il recinto del campo: una pianta puo' dare il suo (CAMPO_NEMICO, la
      // Costa: muretti a secco al posto della staccionata di legno, 29/09)
      const recinto = this.pianta.CAMPO_NEMICO?.recinto || 'staccionata_lunga';
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2 + this.rnd() * 0.3;
        const rr = 6 * TILE + this.rnd() * 12;
        const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
        if (!this.freeAt(px, pz, 1.4)) continue;
        const nome = this.pick(['tenda_rossa', 'tenda_rossa', 'tenda_rossa',
                                'stendardo_rosso', 'gonfalone_rosso',
                                'rastrelliera', 'catasta', 'botte',
                                recinto]);
        const q = this.addProp(nome, px, pz, { flip: this.rnd() < 0.5 });
        if (q && /stendardo|gonfalone|tenda/.test(nome)) acc.insegne.push(q);
      }
      for (let i = -5; i <= 5; i++) {
        const px = x - 9 * TILE, pz = z + i * 3.4;
        if (this.freeAt(px, pz, 1.2))
          this.addProp(recinto, px, pz, { radius: 1.6 });
      }

      // soldati: il vecchio guerriero stava qui e usciva in quasi ogni campo
      const guerrieri = this.cast('nemico');
      const quanti = 7 + Math.floor(this.rnd() * 4);
      for (let i = 0; i < quanti; i++) {
        const a = this.rnd() * Math.PI * 2, rr = 3 * TILE + this.rnd() * 9 * TILE;
        this.nemici.push({ sprite: this.pick(guerrieri),
                           x: x + Math.cos(a) * rr, z: z + Math.sin(a) * rr,
                           anchor: { x, z }, raggio: 16, campo: acc.indice });
      }
      this.accampamenti.push(acc);
    }
  },

  // Ammaina il rosso e issa il blu del borgo, pezzo per pezzo: la tenda resta
  // tenda e lo stendardo stendardo (prima si ciclava su una lista e una tenda
  // poteva diventare un gonfalone). I props statici sono cotti nella
  // geometria dei chunk: il chiamante deve far ricostruire i chunk toccati.
  // Il cunicolo (B): una botola nella corte del castello e un pozzo secco nel
  // bosco, vicino all'accampamento dei briganti. Lo rivela il Capo alla fine
  // del capitolo 4. I due usci sono le porte della stanza "cunicolo"
  // (interni.js): world.cunicolo.porte.corte e .bosco. Alla fine della
  // generazione e senza numeri a caso.
  buildCunicolo() {
    const { CORTE, CAMP } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    // il primo punto libero a spirale attorno a uno di partenza, con l'uscio
    // (1,2 piu' a sud) anch'esso libero e niente di alto appena a sud: la
    // camera guarda da sud, e un pino davanti copriva il pozzo e chi ci entra
    // (un albero alto copre tanto piu' lontano quanto e' alto: la camera e'
    // inclinata)
    const coperto = (x, z) => this.props.some(p => p.hu > 3 && p.z > z &&
      p.z - z < p.hu * 1.5 + 1 && Math.abs(p.x - x) < p.wu / 2 + 1.5);
    const libero = (x0, z0) => {
      for (let r = 0; r < 40; r += 1)
        for (let a = 0; a < 6.28; a += 0.5) {
          const x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
          if (this.blocked(x, z) || this.blocked(x, z + 1.2)) continue;
          if (this.freeAt(x, z, 1.4) && !coperto(x, z)) return { x, z };
        }
      return { x: x0, z: z0 };
    };
    const botola = libero(c(CORTE.x0 + 3), c(CORTE.y1 - 3));
    const pozzo = libero(c(CAMP.x - 10), c(CAMP.y + 8));
    this.addProp('botola', botola.x, botola.z, { solid: false, shadow: false });
    this.addProp('pozzo', pozzo.x, pozzo.z, { solid: false });
    this.cunicolo = { porte: {
      corte: { x: botola.x, z: botola.z + 1.2 },
      bosco: { x: pozzo.x, z: pozzo.z + 1.2 },
    } };
  },

  issaColoriDelBorgo(acc) {
    const blu = { tenda_rossa: 'tenda_blu', stendardo_rosso: 'stendardo_azzurro',
                  gonfalone_rosso: 'gonfalone_blu' };
    for (const p of acc.insegne) {
      const r = Assets.world(blu[p.name]);
      if (!r) continue;
      const scala = p.hu / (Assets.world(p.name) || r).hu;
      p.name = blu[p.name];
      p.hu = r.hu * scala;
      p.wu = r.wu * scala;
    }
    if (acc.luce) { acc.luce.color = [1.0, 0.56, 0.22]; acc.luce.radius = 20; }
    acc.preso = true;
  },
});
