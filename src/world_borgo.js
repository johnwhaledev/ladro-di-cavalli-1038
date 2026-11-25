// world_borgo.js — il borgo: case sulle vie, piazza, corte, porto, Lanterna Rossa.
//
// Metodi di World (world.js) tenuti in un file a parte perche' world.js
// stava oltre la misura: stesso codice, stessa sequenza di costruzione
// (World.build() li chiama per nome).

Object.assign(World.prototype, {
  // Muro di taglio (lati est e ovest) da z0 a z1 in x: la cima vista
  // dall'alto, a pezzi di cinta_cima stesi all'altezza delle campate di
  // fronte (sc e' la loro scala). Solo da vedere: gli ostacoli li mette chi
  // chiama. Prima c'era un pezzo in piedi ogni 1,2 unita', e la fila di cime
  // faceva colonna.
  // `torri` = [[z, altezza]] delle torri sulla stessa linea: la cima rialzata
  // coprirebbe la loro parte bassa, quindi li' si interrompe. Sullo schermo
  // la torre sta fra la sua base e base + altezza, la cima di un punto z a
  // (zt - z) * sin + alto: si toglie z in [zt - (altezza - alto)/sin, zt + alto/sin]
  // `aperture` = [[z0, z1]] di terreno che deve restare a vista (la via che
  // passa sotto una porta laterale): la cima sopra di esso sta piu' a sud di
  // alto/sin, ed e' li' che si apre il varco. Il camminamento sopra la porta
  // non si disegna: la porta deve leggersi aperta.
  cimaDiTaglio(x, z0, z1, sc, torri = [], aperture = []) {
    const alto = 5.7 * sc, S = Math.sin(58 * Math.PI / 180);
    const buchi = torri.map(([zt, ht]) => [zt - (ht - alto) / S, zt])
                       .concat(aperture.map(([a, b]) => [a + alto / S, b]))
                       .sort((a, b) => a[0] - b[0]);
    const tratti = [];
    let da = z0;
    for (const [b0, b1] of buchi) {
      if (b0 > da) tratti.push([da, Math.min(b0, z1)]);
      da = Math.max(da, b1);
    }
    if (da < z1) tratti.push([da, z1]);
    const r = Assets.world('cinta_cima');
    for (const [a, b] of tratti) {
      if (b - a < 4 * sc) continue;          // un moncone sembrava un gradino
      const n = Math.max(1, Math.round((b - a) / (12 * sc)));
      const l = (b - a) / n;
      const largo = r ? r.wu * sc : 3 * sc;
      for (let i = 0; i < n; i++) {
        const z = a + (i + 0.5) * l;
        this.addProp('cinta_cima', x, z, { hu: l, wu: largo, solid: false, shadow: false,
                                           piano: { alto, ang: -Math.PI / 2 } });
        // e i due fianchi, in muratura come le campate di fronte: la
        // prospettiva mostra quello che guarda la camera
        for (const s of [-1, 1])
          this.addProp('cinta_campata', x + s * largo / 2, z,
                       { hu: l, solid: false, shadow: false, parete: { alto } });
      }
    }
  },

  // Le misure del torrione delle porte di levante e ponente (i pezzi di
  // disegna_pezzi.py, PORTA_LATO). Lunghezze lungo la via, altezze in unita';
  // `alto` e `basso` sono gli estremi sullo schermo, in unita' sopra la via
  // (verso nord): servono a cimaDiTaglio per aprire il varco nelle mura.
  misurePortaLato() {
    const ponte = Assets.world('porta_fianco'), torre = Assets.world('porta_torre');
    const fronte = Assets.world('porta_torre_fronte');
    if (!ponte || !torre || !fronte) return null;
    const Ap = 7, At = fronte.hu, Lp = ponte.hu, Lt = torre.hu;
    const S = Math.sin(58 * Math.PI / 180);
    // V: meta' del varco vero nel muro (buildTown salta i muri a meno di 1,6
    // tile dalla via: 6,4 unita')
    const V = 1.6 * TILE;
    return { Ap, At, Lp, Lt, S, V, ponte, torre,
             alto: (V + At / S + Lt) * S, basso: -(Lp / 2 + Lt) * S - At };
  },

  // Il torrione di una porta laterale, con la via che passa da sinistra a
  // destra in (x, zr). La camera guarda da sud e la via deve leggersi aperta,
  // quindi le due torri stanno dove sullo schermo cadono giusto: la torre
  // nord con la faccia sul bordo nord del varco vero, la torre sud abbassata
  // quanto basta perche' la sua cima cominci sotto il bordo sud del varco.
  // Fra le due si vede la via, e il ladro ci passa in vista. Un pezzo steso
  // ad altezza a con la base in z sta sullo schermo dove un billboard alto a
  // con la base in z avrebbe la cima: per questo le basi sono spostate a sud
  // di a/sin. Stendardi del borgo sulle torri; l'ombra netta della torre sud
  // a terra, verso sud-est (luce da nord-ovest).
  // Fino al 26/09 sopra il varco c'era il camminamento dell'arco, steso a 7:
  // visto dall'alto era un muro pieno, il ladro ci spariva sotto e la porta
  // sembrava murata (tua foto del 26/09). Il pezzo porta_fianco resta
  // nell'atlante solo per le misure.
  portaLaterale(x, zr, dentro) {
    const m = this.misurePortaLato();
    if (!m) return;
    const { At, Lp, Lt, S, V, torre } = m;
    const ang = -Math.PI / 2, muro = { solid: false, shadow: false };
    const zN = zr - V;                      // faccia sud della torre nord
    const zS = zr + At / S + Lp / 2;        // lato nord della torre sud
    const lt = torre.wu / 2;
    this.addProp('porta_torre', x, zN - Lt / 2, { ...muro, piano: { alto: At, ang } });
    this.addProp('porta_torre_fronte', x, zN, muro);
    this.addProp('porta_torre', x, zS + Lt / 2, { ...muro, piano: { alto: At, ang },
      ombraRett: { x0: x + lt, z0: zS + 0.6, x1: x + lt + 3, z1: zS + Lt + 0.6, alpha: 0.4 } });
    this.addProp('porta_torre_fronte', x, zS + Lt, muro);
    // la porta: una soglia stretta di pietra, di traverso alla via, con la
    // guida della saracinesca, e due cippi ai bordi del varco con una torcia
    // accanto ciascuno (sul ciglio, non in mezzo alla via). `dentro` = +1 verso
    // est, -1 verso ovest. Steso a terra o basso: una porta alta coprirebbe chi
    // passa (tua foto del 26/09)
    this.addProp('soglia_porta', x, zr, { ...muro, hu: 2 * V, wu: 2.6,
                                          piano: { alto: 0.25, ang } })
    for (const zb of [zN + 1.0, zr + V - 1.0]) {
      this.addProp('cippo', x, zb, { solid: false, scale: 1.7 })
      this.addProp('torcia', x + dentro * 1.8, zb, { solid: false })
      this.lights.push({ x: x + dentro * 1.8, y: 2.6, z: zb,
                         color: [1.0, 0.62, 0.28], radius: 11, flicker: 1 })
    }
    // i fianchi in muratura sotto le torri: la camera inclinata ne mostra uno
    for (const s of [-1, 1])
      for (const zc of [zN - Lt / 2, zS + Lt / 2])
        this.addProp('cinta_campata', x + s * lt, zc,
                     { ...muro, hu: Lt, parete: { alto: At } });
    // lo stendardo del borgo su ogni torre, verso l'angolo di nord-ovest
    for (const zc of [zN - Lt / 2, zS + Lt / 2])
      this.addProp('stendardo_azzurro', x - lt + 1.6, zc - 0.6,
                   { ...muro, sopra: At, sway: 0.5 });
  },

  // Una torre della cinta. Sui lati est e ovest (e negli angoli) il muro si
  // vede di taglio, coi fianchi (cimaDiTaglio): li' la torre ha anche i suoi
  // fianchi e la cima vista dall'alto, quadrata, dietro la faccia. Prima era
  // solo la faccia dipinta, e il fianco del muro che le arriva da nord le
  // spuntava accanto fino a terra, come un cuneo. La cima copre il muro che
  // le passa sotto (sta piu' vicina alla camera).
  torreCinta(x, z, sc, radius, diTaglio) {
    const t = this.addProp('cinta_torre', x, z, { scale: sc, radius });
    if (!t || !diTaglio) return;
    const muro = { solid: false, shadow: false }, lato = t.wu;
    for (const s of [-1, 1])
      this.addProp('cinta_campata', x + s * t.wu / 2, z - lato / 2,
                   { ...muro, hu: lato, parete: { alto: t.hu } });
    this.addProp('cinta_torre_cima', x, z - lato / 2,
                 { ...muro, wu: t.wu, hu: lato, piano: { alto: t.hu, ang: -Math.PI / 2 } });
  },

  // Il cimitero accanto alla pieve: un muretto di pietra con l'ingresso a nord,
  // verso la chiesa, croci e cippi in file, il crocifisso in fondo. Fino al
  // 25/09 erano nove croci sparse a caso in un rettangolo che la via di levante
  // attraversava: le croci stavano in strada, e un cimitero non si vedeva.
  // Si costruisce prima dell'arredo sparso, che ne resta fuori (recinti).
  // Muretto e croci saltano le tile di strada: in un borgo generato il
  // rettangolo puo' toccarne una, e un muro non deve chiudere una via.
  buildCimitero() {
    const K = this.pianta.LUOGHI.cimitero;
    const x0 = K.x * TILE, x1 = (K.x + K.w) * TILE, z0 = K.y * TILE, z1 = (K.y + K.h) * TILE;
    const strada = (x, z) => this.road[this.idx(Math.floor(x / TILE), Math.floor(z / TILE))];
    this.recinti.push({ x0, x1, z0, z1 });
    const metti = (nome, x, z, opt = {}) => { if (!strada(x, z)) this.addProp(nome, x, z, opt); };
    const mx = (x0 + x1) / 2, passo = 1.8;
    // davanti e dietro, di fronte alla camera: pezzi di muretto accostati,
    // e a nord il varco fra due cippi
    for (let x = x0 + 0.9; x < x1; x += passo) {
      metti('muretto', x, z1);
      if (Math.abs(x - mx) > 1.6) metti('muretto', x, z0);
    }
    for (const s of [-1, 1]) metti('cippo', mx + s * 2.2, z0 + 0.1, { radius: 0.5 });
    // i lati si vedono di taglio: muretti uno dietro l'altro, che fanno fila
    for (let z = z0 + passo; z < z1; z += passo)
      for (const x of [x0, x1]) metti('muretto', x, z, { radius: 0.8 });
    // le tombe in file, e il crocifisso grande in fondo al centro
    metti('crocifisso', mx, z1 - 1.6, { solid: false });
    for (let z = z0 + 3.5; z < z1 - 4; z += 3.4)
      for (let x = x0 + 2.4, k = 0; x < x1 - 1.6; x += 2.8, k++) {
        const nome = (k + Math.round(z)) % 3 ? 'croce_legno' : 'cippo';
        metti(nome, x + (this.rnd() - 0.5) * 0.4, z, { solid: false, flip: this.rnd() < 0.5 });
      }
  },

  buildTown() {
    const { WALL, GATES, PLAZA, CORTE, VIE, RISERVATI, LUOGHI } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    const houses = ['casa_alta', 'casa_alta_b', 'casa_tetto_rosso', 'casa_stretta',
                    'casa_blu', 'casa_rossa', 'edificio_casa', 'edificio_bottega',
                    'edificio_taverna', 'palazzo_lungo', 'municipio'];
    const poor = ['edificio_casa', 'edificio_bottega', 'edificio_stalla',
                  'fienile', 'casa_stretta', 'casa_rossa', 'edificio_taverna',
                  'casa_blu'];
    const rich = ['palazzo_gotico', 'palazzo_torre', 'palazzo_lungo', 'municipio',
                  'palazzo_blu', 'casa_alta', 'casa_alta_b', 'casa_tetto_rosso',
                  'torre_guardia'];

    // Urbanistica. Le case stanno sulle vie, non in mezzo agli isolati: in
    // fila continua sul lato NORD delle vie est-ovest, con la facciata sulla
    // strada (la camera guarda da sud: una casa sul lato sud coprirebbe la
    // via col tetto), e su entrambi i lati delle vie nord-sud. Dentro gli
    // isolati restano cortili e orti; piazza, castello, chiesa e fucina hanno
    // il loro spazio. Prima c'erano file orizzontali ogni 4 tile per tutta la
    // citta', senza rapporto con le strade.
    const lista = (tx, ty) => {
      const d = this.districtAt(tx, ty);
      return d === D.SLUMS ? poor : (d === D.NOBILE ? rich : houses);
    };
    // bassifondi fitti, mercato a schiera, quartiere nobile con giardini
    const stacco = (tx, ty) => {
      const d = this.districtAt(tx, ty);
      return d === D.SLUMS ? 0.3 + this.rnd() * 0.6
           : d === D.NOBILE ? 2.5 + this.rnd() * 3 : 0.5 + this.rnd() * 1.2;
    };
    const riservato = (tx, ty) =>
      RISERVATI.some(q => tx >= q.x0 && tx <= q.x1 && ty >= q.y0 && ty <= q.y1) ||
      Math.hypot(tx - PLAZA.x, ty - PLAZA.y) < PLAZA.r + 1 ||
      GATES.some(g => Math.hypot(g.x - tx, g.y - ty) < 5);
    // Una casa con la base in (x, z). L'ostacolo non e' un cerchio sulla base,
    // che sporgeva di 3 unita' in strada, ma l'impronta dietro la facciata.
    // il borgo di fiume (06/10): le case dentro la palizzata o il castrum
    const dentro = (tx, ty) => !this.pianta.dentro || this.pianta.dentro(tx, ty);
    const casa = (name, x, z) => {
      const r = Assets.world(name);
      if (!r || riservato(x / TILE, z / TILE)) return false;
      if (!dentro(x / TILE - r.wu / 2 / TILE, z / TILE - 1) ||
          !dentro(x / TILE + r.wu / 2 / TILE, z / TILE - 1)) return false;
      if (!this.freeAt(x, z - 2, r.wu * 0.4)) return false;
      this.addProp(name, x, z, { flip: this.rnd() < 0.5, solid: false });
      for (const s of [-1, 1]) this.addMuro(x + s * r.wu / 4, z - 1.8, r.wu / 4 + 0.4);
      return true;
    };
    for (const [xa, ya, xb, yb, w] of [...VIE, ...this.vicoli]) {
      if (Math.abs(xb - xa) > Math.abs(yb - ya)) {
        // est-ovest: una fila sul lato nord, facciate contigue
        for (let x = xa * TILE + 3; x < xb * TILE - 3;) {
          const tx = x / TILE;
          const yl = ya + (yb - ya) * (tx - xa) / (xb - xa);
          const z = Math.round(yl - w) * TILE - 0.4;
          const name = this.pickVario(lista(tx, yl), x, z, 30);
          const wu = (Assets.world(name) || { wu: 6 }).wu;
          x += casa(name, x + wu / 2, z) ? wu + stacco(tx, yl) : 2;
        }
      } else {
        // nord-sud: una casa per lato ogni tre tile, piu' fitte nei bassifondi
        let z = ya * TILE + 6;
        while (z < yb * TILE - 2) {
          const ty = z / TILE;
          const xl = xa + (xb - xa) * (ty - ya) / (yb - ya);
          for (const s of [-1, 1]) {
            const name = this.pickVario(lista(xl, ty), xl * TILE, z, 30);
            const wu = (Assets.world(name) || { wu: 6 }).wu;
            const bordo = s < 0 ? Math.round(xl - w) : Math.round(xl + w) + 1;
            casa(name, bordo * TILE + s * (wu / 2 + 0.4), z);
          }
          z += (this.districtAt(xl, ty) === D.SLUMS ? 2.6 : 3.0) * TILE;
        }
      }
    }
    // la piazza incorniciata: case sull'arco nord, rivolte al mercato; l'arco
    // sud resta aperto, se no le case coprirebbero le bancarelle
    const R = (PLAZA.r + 1.6) * TILE;
    for (let a = -Math.PI + 0.25; a < -0.25;) {
      const x = c(PLAZA.x) + Math.cos(a) * R, z = c(PLAZA.y) + Math.sin(a) * R;
      const name = this.pickVario(houses, x, z, 20);
      const wu = (Assets.world(name) || { wu: 6 }).wu;
      a += (casa(name, x, z) ? wu + 0.8 : 2) / R;
    }

    // il castello: la torre del 1038 nella cinta della corte, e la corte
    // arredata (world_corte.js)
    this.castelloDiLegno();
    const P = LUOGHI.pieve;
    const pieve = this.addProp('edificio_chiesa', c(P.x), c(P.y), { scale: 1.2 });
    // l'uscio della pieve: sotto la facciata, appena fuori dal suo ingombro
    this.chiesa = { porta: { x: c(P.x), z: c(P.y) + (pieve ? pieve.radius : 2) + 0.6 } };

    // il borgo di fiume: castrum e palizzata (world_valdarno.js)
    if (this.pianta.PALIZZATA) this.cinteDelBorgo();
    else this.buildCinta();

    // piazza del mercato: bancarelle in cerchio, fontana al centro
    this.addProp('fontana_grande', c(PLAZA.x), c(PLAZA.y), { scale: 1.3 });
    // solo le bancarelle del lotto nano: tende e bancarelle blu/rosse restano
    // agli accampamenti (buildForest, buildAccampamentiNemici), come tende
    const stalls = ['bancarella_verde', 'bancarella_righe', 'bancarella_grande',
                    'tenda_mercato', 'tenda_carne'];
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2 + 0.2;
      const rr = (PLAZA.r - 1.4) * TILE;
      const sx = c(PLAZA.x) + Math.cos(a) * rr;
      const sz = c(PLAZA.y) + Math.sin(a) * rr;
      this.addProp(this.pick(stalls), sx, sz,
                   { flip: Math.cos(a) < 0, radius: 1.3 });
      // il banchista sta dietro, verso il centro della piazza guarda il cliente
      this.stalls.push({ x: sx - Math.cos(a) * 2.0, z: sz - Math.sin(a) * 2.0,
                         flip: Math.cos(a) > 0 });
    }
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const rr = (PLAZA.r + 1.8) * TILE;
      const x = c(PLAZA.x) + Math.cos(a) * rr, z = c(PLAZA.y) + Math.sin(a) * rr;
      this.addProp('lampione_alto', x, z, { solid: false });
      this.lights.push({ x, y: 3.2, z, color: [1.0, 0.7, 0.34],
                         radius: 15, flicker: 0.6 });
    }

    // la bottega di Ferrante, con la facciata sul cortile della fucina (la
    // stanza dentro e' src/stanze/fucina.json): prima dell'arredo, che le
    // gira intorno, e prima delle collisioni
    {
      const r = Assets.world('edificio_bottega');
      const x = c(LUOGHI.fucina.x) - 1, z = c(LUOGHI.fucina.y) - 3.5;
      this.addProp('edificio_bottega', x, z, { solid: false });
      for (const s of [-1, 1]) this.addMuro(x + s * r.wu / 4, z - 1.8, r.wu / 4 + 0.4);
      this.fucina = { x, z, porta: { x, z: z + 1.6 } };
    }

    this.buildCimitero();

    // ---- arredo per quartiere -------------------------------------------
    // Una citta' vera non ha lo stesso mobilio ovunque: nei bassifondi ci sono
    // botti, cataste e steccati; al mercato banchi e ceste; nel quartiere
    // nobile statue, fontane e lampioni, e nessuna catasta di legna.
    const ARREDO = {
      [D.SLUMS]: ['botte', 'botte_b', 'barile', 'cassa', 'cassa_b', 'catasta',
                  'secchio', 'tino', 'staccionata', 'recinto', 'tavolaccio',
                  'banco_legno', 'scala', 'carretto_fermo', 'ceppi', 'gogna'],
      [D.MERCATO]: ['banco_mercato', 'banco_frutta', 'tavolo', 'tavolo_b',
                    'cassa', 'botte', 'anfora', 'tavolo_erbe', 'carriola',
                    'panca', 'panchina', 'transenna', 'mangiatoia', 'telaio'],
      [D.NOBILE]: ['statua', 'statua_grande', 'statua_santo', 'fontana',
                   'pozzo', 'panchina', 'vaso_fiori', 'fiori_cassa',
                   'siepe_fiorita', 'pergolato', 'portale', 'cippo', 'altare'],
      [D.PORTO]: ['botte', 'cassa', 'cassa_b', 'barile', 'tino', 'catasta',
                  'anfora', 'gabbia', 'rastrelliera', 'carriola', 'tino_grande'],
    };
    for (const [d, lista] of Object.entries(ARREDO)) {
      const dd = Number(d);
      const quanti = dd === D.MERCATO ? 190 : (dd === D.SLUMS ? 230 :
                     (dd === D.PORTO ? 150 : 110));
      this.scatter(lista, quanti, (tx, ty, x, z) =>
        this.districtAt(tx, ty) === dd && this.nearRoad(x, z, 2));
    }
    // dentro gli isolati, dietro le case: cortili e orti, non altre case
    this.scatter(['melo', 'melo', 'staccionata', 'pozzo', 'catasta',
                  'cespuglio_d', 'botte'], 170, (tx, ty, x, z) =>
      tx > WALL.x0 + 1 && tx < WALL.x1 - 1 && ty > WALL.y0 + 1 &&
      ty < WALL.y1 - 1 && dentro(tx, ty) && !this.nearRoad(x, z, 3) && !riservato(tx, ty));

    // insegne e stendardi: nel quartiere nobile sono araldici, al mercato
    // sono insegne di bottega
    // I colori del borgo sono il blu e il bianco, come le divise della ronda:
    // il rosso e' dell'altro villaggio, e una bandiera rossa in citta' faceva
    // sembrare gli accampamenti roba del borgo.
    this.scatter(['gonfalone_blu', 'stendardo_azzurro', 'stendardo_bianco',
                  'lampione_alto', 'lampione'], 130,
      (tx, ty, x, z) => this.districtAt(tx, ty) === D.NOBILE &&
                        this.nearRoad(x, z, 2), { solid: false, sway: 0.5 });
    this.scatter(['palo_insegna', 'palo_insegna', 'stendardo_bianco',
                  'stendardo_azzurro'], 120,
      (tx, ty, x, z) => this.districtAt(tx, ty) === D.MERCATO &&
                        this.nearRoad(x, z, 2), { solid: false, sway: 0.5 });
    // nei bassifondi i panni stesi e le croci storte fanno piu' dei blasoni
    this.scatter(['croce_legno', 'crocifisso', 'palo', 'staccionata_lunga',
                  'muretto'], 90,
      (tx, ty, x, z) => this.districtAt(tx, ty) === D.SLUMS &&
                        this.nearRoad(x, z, 2), { sway: 0.3 });

    // torce lungo le vie principali: di notte la citta' deve leggersi
    for (let i = 0; i < 140; i++) {
      const x = this.rnd() * WS, z = this.rnd() * WS;
      const tx = Math.floor(x / TILE), ty = Math.floor(z / TILE);
      if (!this.inside(tx, ty) || this.inCorte(tx, ty)) { continue; }
      const d = this.districtAt(tx, ty);
      if (d !== D.MERCATO && d !== D.NOBILE && d !== D.SLUMS && d !== D.PORTO)
        continue;
      if (!this.nearRoad(x, z, 1)) continue;
      if (!this.freeAt(x, z, 1)) continue;
      const nobile = d === D.NOBILE;
      this.addProp(nobile ? 'lanterna_palo' : (this.rnd() < 0.5 ? 'torcia' : 'braciere'),
                   x, z, { solid: false });
      this.lights.push({ x, y: nobile ? 3.0 : 2.4, z,
                         color: nobile ? [1.0, 0.78, 0.46] : [1.0, 0.58, 0.24],
                         radius: nobile ? 15 : 12, flicker: 1 });
    }
  },

  // La corte del castello ha una cinta sua, piu' bassa di quella del borgo
  // e fatta degli stessi pezzi: il re e la corte stanno qui dentro, e ci si
  // entra dalla porta a sud, che guarda l'arteria. (Tolta da buildTown il
  // 29/09 senza cambiare una riga. Dal 06/10 cinge di nuovo anche la torre
  // del 1038 a Valdarno e nei borghi generati, world_corte.js)
  cintaDellaCorte() {
    const { CASTLE, CORTE } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    const sc = 0.55, passo = 12 * sc;
    const zN = CORTE.y0 * TILE, zS = CORTE.y1 * TILE;
    const xW = CORTE.x0 * TILE, xE = CORTE.x1 * TILE;
    // campate allineate sulla porta: quella centrata sul castello, a sud,
    // e' la porta stessa
    const k0 = Math.ceil((xW - c(CASTLE.x)) / passo);
    const k1 = Math.floor((xE - c(CASTLE.x)) / passo);
    for (let k = k0; k <= k1; k++) {
      const x = c(CASTLE.x) + k * passo;
      for (const z of [zN, zS]) {
        if (z === zS && k === 0) continue;
        this.addProp('cinta_campata', x, z, { scale: sc, solid: false, shadow: false });
        for (const dx of [-2, 0, 2]) this.addMuro(x + dx, z, 1.2);
      }
    }
    for (let z = zN + 1.2; z < zS; z += 1.2)
      for (const x of [xW, xE]) this.addMuro(x, z, 1.0);
    for (const x of [xW, xE])
      this.cimaDiTaglio(x, zN, zS, sc, [[zN + 0.4, 8 * 0.75], [zS + 0.4, 8 * 0.75]]);
    for (const x of [xW, xE])
      for (const z of [zN, zS])
        this.torreCinta(x, z + 0.4, 0.75, 1.4, true);
    this.addProp('porta_citta', c(CASTLE.x), zS + 0.4, { scale: 0.6, solid: false });
    for (const s of [-1, 1]) this.addMuro(c(CASTLE.x) + s * 2.2, zS, 0.9);
  },

  // Cinta muraria a pezzi modulari (tools/disegna_pezzi.py). Sui lati nord
  // e sud il muro si vede di fronte: campate da 3 tile che combaciano. Su
  // est e ovest si vede di taglio: un fianco ogni 0.3 tile, di cui resta a
  // vista la cima, e la fila fa da muro che si allontana. Prima un pezzo
  // unico torre+porta+torre si ripeteva uguale anche sui lati verticali, e
  // un cerchio di raggio 6 per pezzo bloccava una fascia spessa 12 unita'.
  // (Tolta da buildTown il 29/09 senza cambiare una riga. Dal 06/10 il
  // rettangolo e le porte si possono passare: il castrum di Valdarno, che non
  // e' la cinta del borgo; di solito sono quelli della pianta)
  buildCinta(WALL = this.pianta.WALL, GATES = this.pianta.GATES) {
    const c = n => n * TILE + TILE / 2;
    for (let tx = WALL.x0; tx <= WALL.x1; tx += 3) {
      // la campata e' larga 3 tile: nei due angoli non deve sporgere oltre la
      // torre (mezza larga 0,9 tile), si riavvicina e si sovrappone alla vicina
      const cx = Math.min(Math.max(tx, WALL.x0 + 0.6), WALL.x1 - 0.6);
      for (const ty of [WALL.y0, WALL.y1]) {
        if (GATES.some(g => g.y === ty && Math.abs(g.x - tx) < 2.6)) continue;
        this.addProp('cinta_campata', c(cx), c(ty), { solid: false, shadow: false });
        for (let dx = -5; dx <= 5; dx += 2) this.addMuro(c(cx) + dx, c(ty), 1.4);
        if ((tx - WALL.x0) % 12 === 0)
          this.torreCinta(c(tx), c(ty) + 0.5, 1, 1.8, tx === WALL.x0);   // l'angolo e' di taglio
      }
    }
    for (let ty = WALL.y0 + 0.3; ty < WALL.y1; ty += 0.3) {
      for (const tx of [WALL.x0, WALL.x1]) {
        if (GATES.some(g => g.x === tx && Math.abs(g.y - ty) < 1.6)) continue;
        this.addMuro(c(tx), c(ty), 1.3);
      }
    }
    // la cima dei lati est e ovest, con il varco delle porte
    // (le torri sono quelle messe qui sotto: angoli, una ogni 12 tile, e la
    // torre di guardia a nord delle porte laterali)
    for (const tx of [WALL.x0, WALL.x1]) {
      const torri = [[c(WALL.y0) + 0.5, 8], [c(WALL.y1) + 0.5, 8]];
      for (let ty = WALL.y0 + 12; ty < WALL.y1 - 2; ty += 12)
        if (!GATES.some(g => g.x === tx && Math.abs(g.y - ty) < 3))
          torri.push([c(ty) + 0.6, 8]);
      // il varco e' quanto occupa sullo schermo il torrione (misurePortaLato)
      const m = this.misurePortaLato(), varchi = [];
      for (const g of GATES) if (g.x === tx)
        varchi.push(m ? [c(g.y) - m.alto / m.S, c(g.y) - m.basso / m.S]
                      : [c(g.y) - 6.4, c(g.y) + 6.4]);  // come gli ostacoli, 1,6 tile
      this.cimaDiTaglio(c(tx), c(WALL.y0), c(WALL.y1), 1, torri, varchi);
    }
    for (let ty = WALL.y0 + 12; ty < WALL.y1 - 2; ty += 12)
      for (const tx of [WALL.x0, WALL.x1])
        if (!GATES.some(g => g.x === tx && Math.abs(g.y - ty) < 3))
          this.torreCinta(c(tx), c(ty) + 0.6, 1, 1.8, true);
    for (const ty of [WALL.y0, WALL.y1])
      this.torreCinta(c(WALL.x1), c(ty) + 0.5, 1, 1.8, true);

    for (const g of GATES) {
      // sotto l'arco si passa: la porta non e' un ostacolo, lo sono le due
      // torrette ai fianchi (sui lati est e ovest la strada la attraversa
      // di taglio, e le torrette starebbero in mezzo alla via)
      // a nord e a sud l'arco si vede di fronte; a levante e a ponente la via
      // passa da sinistra a destra, e l'arco non si vedrebbe: il torrione
      // visto dall'alto, steso sopra la via piu' in alto delle mura, e la via
      // gli passa sotto. La base e' spostata a sud di alto/sin perche' sullo
      // schermo stia proprio sulla via. Prima l'arco frontale stava anche li',
      // di traverso alla via
      if (g.dir === 'N' || g.dir === 'S') {
        this.addProp('porta_citta', c(g.x), c(g.y) + 0.4, { scale: 1.1, solid: false });
        for (const s of [-1, 1]) this.addMuro(c(g.x) + s * 3.6, c(g.y), 1.3);
      } else {
        this.portaLaterale(c(g.x), c(g.y), g.dir === 'E' ? -1 : 1);
      }
      // a nord e a sud la torcia sta accanto all'arco; a levante e a ponente
      // stanno ai cippi della porta (portaLaterale), fuori dalla via
      if (g.dir === 'N' || g.dir === 'S') {
        this.addProp('torcia', c(g.x) - 5, c(g.y) + 2, { solid: false });
        this.lights.push({ x: c(g.x) - 5, y: 2.6, z: c(g.y) + 2,
                           color: [1.0, 0.62, 0.28], radius: 13, flicker: 1 });
      }
    }
  },

  // La casa della lanterna rossa: una delle case rosse dei bassifondi, la
  // piu' vicina alla porta di ponente, con lanterna e luce rossa sull'uscio.
  // Le osterie in cui si entra (J1): ogni edificio_taverna ha l'uscio in
  // interni.js, ma per strada non si distingueva dalle case. Ai due spigoli
  // della facciata (sopra la facciata chiara la tavola spariva) l'insegna col
  // boccale (disegna_pezzi) e una lanterna accesa. Alla fine della
  // generazione e senza numeri a caso, come la Lanterna Rossa: il resto del
  // mondo resta dov'e'.
  buildOsterie() {
    const osterie = this.props.filter(p => p.name === 'edificio_taverna');
    for (const casa of osterie) {
      const z = casa.z + 0.7, fianco = casa.wu / 2;
      this.addProp(this.pianta.INSEGNA_OSTERIA || 'insegna_osteria', casa.x - fianco - 0.1, z,
                   { solid: false, sway: 0.4 });
      this.addProp('lanterna_palo', casa.x + fianco + 0.3, z, { solid: false });
      this.lights.push({ x: casa.x + fianco + 0.3, y: 2.2, z: z + 0.3,
                         color: [1.0, 0.7, 0.36], radius: 9, flicker: 0.8 });
    }
  },

  // Si sceglie fra le case gia' piazzate e alla fine della generazione, senza
  // tirare numeri a caso: il resto del mondo non si sposta di un pixel.
  buildCasaDiPiacere() {
    const { WALL, GATES } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    const ponente = GATES.find(g => g.dir === 'W');
    const mira = { x: c(WALL.x0 + 8), z: c(ponente.y) };
    // nel borgo di fiume (06/10, tua scelta) la casa rossa dei bassifondi piu'
    // lontana da ogni porta: vicino a quella di ponente c'erano i piantoni, e
    // dopo una strage uscendo ti vedevano
    const lontano = p => -Math.min(...GATES.map(g => Math.hypot(p.x - c(g.x), p.z - c(g.y))));
    let casa = null, bd = Infinity;
    for (const p of this.props) {
      if (p.name !== 'casa_rossa') continue;
      const tx = Math.floor(p.x / TILE), ty = Math.floor(p.z / TILE);
      const bassifondi = this.districtAt(tx, ty) === D.SLUMS;
      const d = (this.pianta.PALIZZATA ? lontano(p) : Math.hypot(p.x - mira.x, p.z - mira.z)) +
                (bassifondi ? 0 : 1e4);
      if (d < bd) { bd = d; casa = p; }
    }
    if (!casa) return;
    const porta = { x: casa.x, z: casa.z + 1.6 };
    this.casaDiPiacere = { nome: TX('nomi.lanterna_rossa'), x: casa.x, z: casa.z, porta };
    const lx = casa.x + casa.wu / 2 + 0.3;
    this.addProp('lanterna_palo', lx, casa.z + 0.6, { solid: false });
    this.lights.push({ x: lx, y: 2.0, z: casa.z + 0.9, color: [1.0, 0.2, 0.22],
                       radius: 11, flicker: 0.6 });
    this.addResident('MiniVillagerWoman', porta.x + 1.4, porta.z + 0.4,
                     { prof: 'cittadino', raggio: 0, fisso: true });
  },
});
