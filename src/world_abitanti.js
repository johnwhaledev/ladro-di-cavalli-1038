// world_abitanti.js — chi abita il mondo: punti di partenza, committenti, residenti.
//
// Metodi di World (world.js) tenuti in un file a parte perche' world.js
// stava oltre la misura: stesso codice, stessa sequenza di costruzione
// (World.build() li chiama per nome).

Object.assign(World.prototype, {
  // i personaggi di un ruolo in questa citta' (cast.js)
  cast(ruolo) { return castDi(this.pianta, ruolo); },

  buildSpawns() {
    const { PLAZA, CASTLE, PORT, LUOGHI } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    this.spawns.player = { x: c(PLAZA.x) + 10, z: c(PLAZA.y) + 16 };
    // i committenti: quelli che la pianta dice (il fiordo), se no Valdarno
    if (this.pianta.COMMITTENTI) this.committentiDellaPianta();
    else this.spawns.givers.push(
      { x: c(PLAZA.x) - 14, z: c(PLAZA.y) + 4, sprite: 'MiniMerchant',
        name: TX('committenti.atto1.mercante') },
      { x: c(LUOGHI.pieve.x) + 6, z: c(LUOGHI.pieve.y) + 6, sprite: 'MiniNun',
        name: TX('nomi.timotea') },
      // il Ciambellano non e' il Re: con MiniKingMan in corte i re erano due
      { x: c(CASTLE.x) - 8, z: c(CASTLE.y) + 10, sprite: 'MiniNobleMan',
        flip: true, name: TX('committenti.atto1.ciambellano') },
      { x: c(PORT.x) + 8, z: c(PORT.y), sprite: 'MiniOldMan',
        name: TX('committenti.atto1.nocchiero') },
      // Ferrante sta dentro la bottega (interni.js): qui c'e' l'uscio, dove
      // stanno il suo segno sulla carta e la corona del capitolo
      { x: this.fucina.porta.x, z: this.fucina.porta.z, sprite: 'MiniBlacksmith',
        name: TX('committenti.atto1.fabbro'), stanza: 'fucina' },
    );
    // veicoli parcheggiati lungo le strade
    // i carri vengono dal lotto nano, a piombo (kind 'terra'), e li tira una
    // bestia della citta' (bestie.js). Il cavallo e' uno solo, lo stesso su cui
    // sali e che ti muore sotto, quindi il mantello non puo' cambiare da fermo. Una pianta puo'
    // dare i suoi (CARRI); a Valdarno dal 30/09 anche il carro del fieno. La
    // carrozza rossa (tua scelta del 30/09) solo a Valdarno e solo per i
    // nobili: al massimo tre, ferme nel quartiere nobile
    const carts = this.pianta.CARRI
      ? [...this.pianta.CARRI, 'carro_rotto']
      : ['carro_coperto', 'carro_merci', 'carro_rotto', 'carro_fieno'];
    let carrozze = 0;
    const horses = ['cavallo_baio'];
    // I mezzi stanno dove qualcuno li lascerebbe: in citta', al porto, lungo le
    // vie maestre. Un carro parcheggiato in mezzo al bosco non ha senso, e
    // rendeva banale la fuga dopo un colpo.
    let n = 0, tries = 0;
    const quanti = this.pianta.MEZZI || 44;
    while (n < quanti && tries < 9000) {
      tries++;
      const x = this.rnd() * WS, z = this.rnd() * WS;
      const tx = Math.floor(x / TILE), ty = Math.floor(z / TILE);
      if (!this.inside(tx, ty) || !this.road[this.idx(tx, ty)]) continue;
      const d = this.districtAt(tx, ty);
      const ammesso = (d === D.SLUMS || d === D.MERCATO || d === D.NOBILE ||
                       d === D.PORTO) ? 1
                    : (d === D.CAMPI ? 0.35 : 0.08);
      if (this.rnd() > ammesso) continue;
      if (!this.props.every(p => !p.solid ||
          (p.x - x) ** 2 + (p.z - z) ** 2 > 9)) continue;
      const kind = this.rnd();
      const type = kind < 0.5 ? 'cavallo' : 'carro';
      let name = type === 'cavallo' ? this.pick(horses) : this.pick(carts);
      if (type === 'carro' && d === D.NOBILE && !this.pianta.CARRI && carrozze < 3) {
        name = 'carrozza';
        carrozze++;
      }
      const rot = this.rnd() * Math.PI * 2;
      n++;
      // a lato della via, allineato (30/09, tua foto: carri in mezzo alla
      // strada): spostato sulla prima tile libera accanto, verso il bordo
      // piu' vicino, e girato lungo la via. Se non c'e' posto, non si parcheggia
      const lato = this.aLatoDellaVia(tx, ty);
      if (!lato) continue;
      this.spawns.vehicles.push({ type, name, x: lato.x, z: lato.z,
                                  rot: lato.lungo + (rot < Math.PI ? 0 : Math.PI) });
    }
    // chi tira i carri e quali cavalli sono asini (bestie.js, 13/10): anche
    // i carri della corte, gia' messi
    Bestie.assegna(this.spawns.vehicles, this.pianta);
    // l'atto V (storia_ritorno.js, 13/10): Valdarno cambiata. Il Ciambellano
    // non sta piu' nella corte a dare incarichi (e' il bersaglio), e in piazza
    // c'e' la forca che ha fatto alzare per i ribelli
    if (ATTI[Storia.stato.atto] === 'ritorno' && !this.pianta.COMMITTENTI) {
      this.spawns.givers = this.spawns.givers.filter(g => g.name !== TX('committenti.atto1.ciambellano'));
      this.forcaInPiazza(c(PLAZA.x), c(PLAZA.y));
    }
  },

  // la forca (tre corde, larga 4,5) nel primo posto sgombro attorno al
  // centro della piazza, senza numeri a caso (il mondo dell'atto I resta
  // quello)
  forcaInPiazza(x0, z0) {
    for (let r = 6; r <= 16; r += 2)
      for (let k = 0; k < 12; k++) {
        const a = k / 12 * Math.PI * 2, x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
        if (this.props.every(p => (p.x - x) ** 2 + (p.z - z) ** 2 > 25)) {
          this.addProp('forca', x, z, { solid: true });
          return;
        }
      }
  },

  // Il posto accanto a una via per un mezzo parcheggiato: dalla tile di strada
  // (tx, ty) la prima tile non di strada e libera nelle quattro direzioni, a
  // 1-3 tile; il mezzo sta a ridosso del bordo, girato lungo la via
  aLatoDellaVia(tx, ty) {
    const c = n => n * TILE + TILE / 2;
    for (let d = 1; d <= 3; d++)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = tx + dx * d, y = ty + dy * d;
        if (!this.inside(x, y) || this.road[this.idx(x, y)]) continue;
        const px = c(x) - dx * 1.2, pz = c(y) - dy * 1.2;
        if (!this.freeAt(c(x), c(y), 1.6)) break;
        // la via corre di traverso alla direzione in cui si e' usciti
        return { x: px, z: pz, lungo: dx ? Math.PI / 2 : 0 };
      }
    return null;
  },

  // I committenti di una pianta che ha i suoi (COMMITTENTI, pianta_fiordo.js,
  // 29/09): { chiave, dove, sprite, stanza, flip }. `dove`: il porto (dove sta
  // il Nocchiero), il molo (in capo al primo molo a nord del porto, lato terra:
  // li' sbocca una via), o l'uscio di una stanza (castello, chiesa, fucina); chi
  // ha `stanza` sta dentro, e sulla carta c'e' il suo uscio. Il nome in gioco lo
  // dice la storia (Storia.committente): scritto in un posto solo
  committentiDellaPianta() {
    const { PORT } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    const nord = c(PORT.y) - (this.pianta.LUOGHI.moli.passo || 8) * TILE;
    const passerelle = this.moli.filter((m, i) => i % 2 === 0);
    const molo = passerelle.slice().sort((a, b) =>
      Math.abs(a.z1 - nord) - Math.abs(b.z1 - nord))[0];
    // dal lato di terra: a levante della riva se l'acqua e' a ponente, a
    // ponente se e' a levante (il fiordo del 06/10)
    const terra = this.pianta.LATO_ACQUA === 1 ? -1 : 1;
    const { PLAZA } = this.pianta;
    const posto = {
      porto: { x: c(PORT.x) + terra * 8, z: c(PORT.y) },
      // nello slargo, a ponente del pozzo (come Aldo a Valdarno): il mercante
      // della Costa, nel suk (09/10)
      piazza: { x: c(PLAZA.x) - 10, z: c(PLAZA.y) + 4 },
      molo: molo && { x: terra > 0 ? molo.x1 + 3 : molo.x0 - 3, z: (molo.z0 + molo.z1) / 2 },
      castello: this.castello && this.castello.porta,
      chiesa: this.chiesa && this.chiesa.porta,
      fucina: this.fucina && this.fucina.porta,
    };
    for (const k of this.pianta.COMMITTENTI) {
      const q = posto[k.dove];
      if (!q) continue;
      this.spawns.givers.push({ x: q.x, z: q.z, sprite: k.sprite, flip: !!k.flip,
                                stanza: k.stanza, name: k.nome || Storia.committente(k.chiave) });
    }
  },

  // ---------------------------------------------------------- residenti
  //
  // Gente con un posto e un mestiere. Non e' popolazione di passaggio: esiste
  // alla generazione del mondo, resta dov'e' e ci gira attorno entro un
  // raggio. E' cio' che distingue una citta' da una folla che cammina a caso:
  // il fabbro e' sempre alla sua fucina, il re sempre nel cortile del castello,
  // il banchista sempre dietro il suo banco.

  addResident(sprite, x, z, opt = {}) {
    this.residents.push({
      sprite, x, z,
      prof: opt.prof || 'cittadino',
      raggio: opt.raggio === undefined ? 6 : opt.raggio,
      fisso: !!opt.fisso,          // sta fermo e lavora
      flip: !!opt.flip,
      nome: opt.nome || null,
    });
  },

  buildResidents() {
    const { WALL, PLAZA, CASTLE, CAMP, QUARTIERI, LUOGHI, ZONE } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    const R = this.rnd;

    // --- piazza del mercato: un banchista dietro ogni bancarella
    const banchisti = this.cast('banchista');
    for (const st of this.stalls) {
      this.addResident(this.pick(banchisti), st.x, st.z,
                       { prof: 'mercante', raggio: 1.4, fisso: R() < 0.55,
                         flip: st.flip });
    }
    // avventori che girano fra i banchi
    for (let i = 0; i < 14; i++) {
      const a = R() * Math.PI * 2, rr = (PLAZA.r - 2) * TILE * Math.sqrt(R());
      this.addResident(this.pick(this.cast('avventore')),
                       c(PLAZA.x) + Math.cos(a) * rr, c(PLAZA.y) + Math.sin(a) * rr,
                       { prof: 'cittadino', raggio: 12 });
    }

    // --- castello: la corte, e non esce di li'. Il Re e la Regina stanno
    // dentro, nella sala del trono (src/stanze/castello.json)
    this.addResident(this.cast('principessa')[0], c(CASTLE.x) + 7, c(CASTLE.y) + 12,
                     { prof: 'nobile', raggio: 7 });
    this.addResident(this.cast('principe')[0], c(CASTLE.x) - 8, c(CASTLE.y) + 12,
                     { prof: 'nobile', raggio: 7 });
    // a semicerchio davanti alla facciata: il castello e' largo 54 (25/09
    // sera) e un cerchio attorno al centro ne metteva meta' dentro i muri
    for (let i = 0; i < 6; i++) {
      const a = (i + 0.5) / 6 * Math.PI;
      this.addResident(this.pick(this.cast('guardia_corte')),
                       c(CASTLE.x) + Math.cos(a) * 21, c(CASTLE.y) + 3 + Math.sin(a) * 14,
                       { prof: 'guardia', raggio: 4, fisso: i % 2 === 0 });
    }
    // nobili a passeggio nel loro quartiere
    for (let i = 0; i < 12; i++) {
      const tx = LUOGHI.nobili.x0 + R() * LUOGHI.nobili.w,
            ty = WALL.y0 + 6 + R() * (WALL.y1 - WALL.y0 - 12);
      if (this.blockedTile(tx, ty)) continue;
      this.addResident(this.pick(this.cast('nobile_corte')),
                       c(tx), c(ty), { prof: 'nobile', raggio: 22 });
    }

    // --- chiesa e cimitero
    const P = LUOGHI.pieve, K = LUOGHI.cimitero;
    const monaco = this.cast('monaco');
    this.addResident(monaco[0], c(P.x) + 7, c(P.y) + 7, { prof: 'monaco', raggio: 8 });
    this.addResident(monaco[1 % monaco.length], c(P.x) - 6, c(P.y) + 5,
                     { prof: 'monaco', raggio: 8 });
    // il pievano sta dentro la pieve (src/stanze/chiesa.json)
    // croci e muretto: buildCimitero in world_borgo.js
    this.addResident(this.cast('becchino')[0], c(K.becchino.x), c(K.becchino.y),
                     { prof: 'artigiano', raggio: 5, fisso: true });

    // --- la fucina, nei bassifondi
    const fx = c(LUOGHI.fucina.x), fz = c(LUOGHI.fucina.y);
    this.addProp('braciere', fx + 2.5, fz, { solid: false });
    this.lights.push({ x: fx + 2.5, y: 1.8, z: fz, color: [1.0, 0.5, 0.18],
                       radius: 14, flicker: 1.8 });
    this.addProp('rastrelliera', fx - 3, fz + 1);
    this.addProp('catasta', fx - 1, fz + 3);
    // il fabbro non e' un residente: e' un committente, sta in spawns.givers
    // (dentro la sua bottega); il banco sta di lato, la porta resta libera
    this.addProp('tavolaccio', fx + 4.5, fz + 2.2, { solid: false });
    // vita dei bassifondi: gente povera, operai, qualche ladro
    for (let i = 0; i < 26; i++) {
      const tx = WALL.x0 + 2 + R() * (QUARTIERI.bassifondi - WALL.x0 - 2),
            ty = WALL.y0 + 4 + R() * (WALL.y1 - WALL.y0 - 8);
      if (this.blockedTile(tx, ty)) continue;
      this.addResident(this.pick(this.cast('bassifondi')),
                       c(tx), c(ty), { prof: 'cittadino', raggio: 16 });
    }

    // --- porto: nocchieri e facchini sui moli
    for (let i = 0; i < 10; i++) {
      const ty = LUOGHI.moli.y0 + R() * (LUOGHI.moli.n * LUOGHI.moli.passo);
      const [x, z] = this.daRiva(ty, c(this.rivaDelPorto(ty) + 5.8 + R() * 5), c(ty));
      if (this.blocked(x, z)) continue;
      this.addResident(this.pick(this.cast('gente_porto')),
                       x, z, { prof: 'cittadino', raggio: 9,
                               fisso: R() < 0.35 });
    }

    // --- campi: contadini al lavoro, e ci stanno
    for (let i = 0; i < 22; i++) {
      const [x0, y0, w, h] = ZONE.campi;
      const tx = x0 + R() * w, ty = y0 + R() * h;
      if (!this.inside(Math.floor(tx), Math.floor(ty))) continue;
      if (this.districtAt(Math.floor(tx), Math.floor(ty)) !== D.CAMPI) continue;
      if (this.blockedTile(tx, ty)) continue;
      this.addResident(this.pick(this.cast('gente_campi')),
                       c(tx), c(ty), { prof: 'contadino', raggio: 10,
                                       fisso: R() < 0.5 });
    }

    // --- bosco: boscaioli dove ci sono tronchi tagliati, cacciatori, briganti
    for (let i = 0; i < 12; i++) {
      const [x0, y0, w, h] = ZONE.boscaioli;
      const tx = x0 + R() * w, ty = y0 + R() * h;
      if (!this.inside(Math.floor(tx), Math.floor(ty))) continue;
      if (this.districtAt(Math.floor(tx), Math.floor(ty)) !== D.BOSCO) continue;
      if (this.blockedTile(tx, ty)) continue;
      const x = c(tx), z = c(ty);
      this.addProp('tronchi', x + 2.2, z + 1.4, { solid: false });
      this.addProp('ceppaia', x - 2.4, z + 0.8, { solid: false });
      this.addResident(this.cast('boscaiolo_fisso')[0], x, z,
                       { prof: 'boscaiolo', raggio: 4, fisso: R() < 0.7 });
    }
    for (let i = 0; i < 10; i++) {
      const [x0, y0, w, h] = ZONE.cacciatori;
      const tx = x0 + R() * w, ty = y0 + R() * h;
      if (!this.inside(Math.floor(tx), Math.floor(ty))) continue;
      if (this.districtAt(Math.floor(tx), Math.floor(ty)) !== D.BOSCO) continue;
      if (this.blockedTile(tx, ty)) continue;
      this.addResident(this.pick(this.cast('cacciatore_bosco')),
                       c(tx), c(ty), { prof: 'cacciatore', raggio: 26 });
    }
    // accampamento dei fuorilegge
    for (let i = 0; i < 9; i++) {
      const a = R() * Math.PI * 2, rr = 4 + R() * 9;
      this.addResident(this.pick(this.cast('brigante')),
                       c(CAMP.x) + Math.cos(a) * rr, c(CAMP.y) + Math.sin(a) * rr,
                       { prof: 'ladro', raggio: 7 });
    }

    // guardie di piantone alle porte (richiesta del 25/09): quattro per porta,
    // ferme ai lati della via, due appena dentro l'arco e due appena fuori. Chi passa sotto i loro
    // occhi con la taglia o con un carro rubato e' visto. In fondo e senza
    // numeri a caso: gli altri residenti restano dove sono
    this.addPiantoni();
  },

  addPiantoni() {
    const { GATES } = this.pianta;
    const c = n => n * TILE + TILE / 2;
    const tipi = this.cast('piantone');
    // alle porte laterali stanno ai due lati dell'arco COME SI VEDE: il
    // camminamento copre sullo schermo B sopra e sotto la via (portaLaterale
    // in world_borgo.js), e una guardia alta 2 con i piedi in z vi sta dentro
    // se va da -dz*sin a -dz*sin + 2. Prima stavano a 5,5 dalla via, davanti
    // alle torri. Di lato stanno fuori dalla torre (larga 7): da dentro
    // sarebbero coperte dalla sua faccia
    const m = this.misurePortaLato();
    const B = m ? m.Lp * m.S / 2 : 5.4, S = m ? m.S : 0.85;
    // alle porte di legno del borgo di fiume (06/10) non c'e' il torrione:
    // stanno fra le torrette, ai lati della via
    const laterale = this.pianta.PALIZZATA ? [-5, 5] : [-(B - 2.3) / S, (B - 0.3) / S];
    for (const g of GATES) {
      const x = c(g.x), z = c(g.y);
      // dentro: a sud della porta nord, a nord della sud, a levante di
      // quella di ponente, a ponente di quella di levante; fuori il contrario
      const dentro = { N: [0, 3], S: [0, -3], W: [4.5, 0], E: [-4.5, 0] }[g.dir];
      const fronte = g.dir === 'N' || g.dir === 'S';
      for (const verso of [1, -1.6])            // fuori un po' piu' in la': c'e' l'arco
        [-1, 1].forEach((s, k) =>
          this.addResident(tipi[k % tipi.length],
                           x + verso * dentro[0] + (fronte ? s * 5.5 : 0),
                           z + verso * dentro[1] + (fronte ? 0 : laterale[k]),
                           { prof: 'guardia', raggio: 0, fisso: true, flip: s > 0 }));
    }
  },
});
