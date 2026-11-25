// world_porto.js — il porto: i moli che si percorrono, le barche ormeggiate
// alla testa, gli edifici e l'arredo della riva. Tolto da world_borgo.js il
// 06/10. I conti si fanno sempre come per la riva a ponente (l'acqua a
// sinistra, lungo la riva da nord a sud): `daRiva` li porta poi dove l'acqua
// sta davvero. Con l'acqua a levante (il Fiordo, pianta.LATO_ACQUA = 1) si
// specchia attorno alla mezzeria del molo; col fiume a sud (Valdarno dal
// 06/10, LATO_ACQUA = 'S': riverCenter(x) e' la mezzeria del fiume in y) si
// gira di un quarto: lungo la riva diventa da ponente a levante, verso terra
// diventa verso nord. I disegni stesi si specchiano o si girano con loro.

Object.assign(World.prototype, {
  // la mezzeria del fiume nel riferimento della riva a ponente: col fiume a
  // sud e' girata (daRiva la rigira)
  rivaDelPorto(u) {
    const { riverCenter, LATO_ACQUA } = this.pianta;
    if (LATO_ACQUA === 'S') return -riverCenter(u);
    return riverCenter(u) + (LATO_ACQUA === 1 ? 0.8 : 0);
  },

  // Un punto (X, Z) contato con la riva a ponente, alla riga u della riva,
  // dove sta davvero. Col fiume a sud: X' = Z, Z' = TILE - X (un quarto di
  // giro: verso terra, +X, diventa verso nord)
  daRiva(u, X, Z) {
    const L = this.pianta.LATO_ACQUA;
    if (L === 1) return [2 * (this.rivaDelPorto(u) + 4.2) * TILE + TILE - X, Z];
    if (L === 'S') return [Z, TILE - X];
    return [X, Z];
  },

  // un rettangolo { x0, x1, z0, z1 } contato con la riva a ponente
  rettDaRiva(u, q) {
    const [ax, az] = this.daRiva(u, q.x0, q.z0), [bx, bz] = this.daRiva(u, q.x1, q.z1);
    return { x0: Math.min(ax, bx), x1: Math.max(ax, bx), z0: Math.min(az, bz), z1: Math.max(az, bz) };
  },

  buildPort() {
    const { QUARTIERI, LUOGHI, LATO_ACQUA } = this.pianta;
    const M = LUOGHI.moli, Q = QUARTIERI.porto;
    const c = n => n * TILE + TILE / 2;
    const rcP = u => this.rivaDelPorto(u);
    // il disegno steso: specchiato con l'acqua a levante, girato col fiume a sud
    const giro = LATO_ACQUA === 'S' ? -Math.PI / 2 : 0;
    // i moli si percorrono (buildSolid li scava nell'acqua) e alla testa sta
    // ormeggiata una barca vera, un mezzo che naviga solo sull'acqua: prima
    // erano barche di cartone, e sul molo non si camminava
    this.moli = [];
    const vele = ['vela_crema', 'vela_crema', 'vela_righe', 'vela_blu'];
    for (let i = 0; i < M.n; i++) {
      const ty = M.y0 + i * M.passo;
      const rc = rcP(ty);
      // il pontile disegnato (disegna_pezzi.molo) e' lungo due tile: centrato
      // a rc + 4,2 parte dalla riva e con la testa arriva alle barche
      // steso a terra (piano), non in piedi: da billboard stava davanti a chi
      // ci camminava sopra e ne nascondeva il corpo. Col fondo dell'immagine
      // sulla riga c(ty), come prima
      const nome = i % 2 ? 'molo_a' : 'molo_b';
      const r = Assets.world(nome);
      const mx = c(rc + 4.2), mz = c(ty) - (r ? r.hu / 2 : 1);
      const [wx, wz] = this.daRiva(ty, mx, mz);
      const m = this.addProp(nome, wx, wz,
                             { solid: false, shadow: false,
                               piano: { alto: 0.3, ang: -Math.PI / 2 + giro,
                                        specchio: LATO_ACQUA === 1 } });
      const testa = m ? mx - m.wu / 2 : c(rc + 3.2);
      // la passerella e la testa, dove il disegno le mostra: la passerella e'
      // la striscia bassa dell'immagine, la testa la piattaforma verso l'acqua
      // misurati sul disegno steso a terra (disegna_pezzi.molo): la passerella
      // e' la fascia da 0,3 a 1,45 sopra il fondo, la testa 1,75 di larghezza;
      // il ladro ha un raggio di 0,45, quindi ci si sta con tutto il corpo
      // due voci per molo (chi legge this.moli le prende a coppie: passerella,
      // testa). La testa e' la piattaforma di molo_a; senza, e' il tratto in
      // punta alla passerella, dove si sale in barca
      const passerella = { x0: testa + 0.5, x1: c(rc + 5.6), z0: c(ty) - 1.7, z1: c(ty) - 0.2 };
      this.moli.push(this.rettDaRiva(ty, passerella), this.rettDaRiva(ty, nome === 'molo_a'
        ? { x0: testa + 0.5, x1: testa + 1.7, z0: c(ty) - 2.8, z1: c(ty) - 0.4 }
        : { ...passerella, x1: testa + 1.7 }));
      // la barca del Nocchiero c'e' sempre: all'ultimo molo, se nessuno dei
      // primi ne ha avuta una (il fiordo 2 restava senza). Il numero si tira
      // comunque, come prima. La prua lungo la riva: verso nord, girata col
      // fiume a sud (verso ponente)
      const senza = i === M.n - 1 && !this.spawns.vehicles.some(v => v.type === 'barca');
      if (this.rnd() < 0.7 || senza) {
        this.pick(['nave_grande', 'barca_a', 'barca_b', 'chiatta']);  // come prima
        const nocchiero = !this.spawns.vehicles.some(v => v.type === 'barca');
        // il fiordo ha i suoi scafi (drakkar, la vela e' nel disegno)
        const B = this.pianta.BARCHE;
        const [bx, bz] = this.daRiva(ty, testa - 1.9 * (B ? B.scala : 1), c(ty) - 1.6);
        this.spawns.vehicles.push(B ? {
          type: 'barca', x: bx, z: bz, scala: B.scala,
          name: nocchiero ? B.nocchiero : B.altre[(i * 3) % B.altre.length],
          rot: -Math.PI / 2 + giro, vela: B.vela,
          // la bandiera del borgo al drakkar del Nocchiero, le altre araldiche
          bandiera: nocchiero ? 'bandiera_valdarno' : `bandiera_${(i * 5 + 3) % 12}`,
        } : {
          type: 'barca', x: bx, z: bz,
          // gli scafi meta senza remi (30/09), la costiera in piu'
          name: nocchiero ? 'scafo_cocca'
                          : ['scafo_lancia', 'scafo_barchetta', 'scafo_costiera'][i % 3],
          rot: -Math.PI / 2 + giro, vela: nocchiero ? 'vela_blu' : vele[i % vele.length],
          bandiera: nocchiero ? 'bandiera_valdarno' : `bandiera_${(i * 5 + 3) % 12}`,
        });
      }
    }
    // Gli edifici del porto (30/09, i meta di "Mare e porti"): a terra, fra
    // un molo e l'altro, di fronte alla riva. Senza numeri a caso, per non
    // spostare il resto. La pianta puo' non volerli (la Costa: PORTO_CASE []).
    // Restano billboard di fronte alla camera: l'ingombro sta dietro la
    // facciata, a nord, comunque giri la riva
    const case_ = this.pianta.PORTO_CASE || ['porto_magazzino', 'porto_dogana'];
    for (let i = 0; i < M.n - 1 && case_.length; i++) {
      const ty = M.y0 + i * M.passo + M.passo / 2;
      const nome = case_[i % case_.length];
      const r = Assets.world(nome);
      if (!r) continue;
      // col fiume a sud la facciata sta a 7,5 dalla mezzeria (non a meta' casa)
      const k = LATO_ACQUA === 'S' ? c(rcP(ty) + 7.5) : c(rcP(ty) + 7.5) + r.wu / 2;
      const [x, z] = this.daRiva(ty, k, c(ty) + 1.5);
      if (!this.freeAt(x, z - 2, r.wu * 0.4)) continue;
      this.addProp(nome, x, z, { solid: false });
      for (const s of [-1, 1]) this.addMuro(x + s * r.wu / 4, z - 1.8, r.wu / 4 + 0.4);
    }
    for (let i = 0; i < 70; i++) {
      const ty = M.y0 + this.rnd() * (M.n * M.passo);
      const [x, z] = this.daRiva(ty, c(rcP(ty) + 5.5 + this.rnd() * 6),
                                 c(Q.y0 + 2 + this.rnd() * (Q.y1 - Q.y0 - 2)));
      if (!this.freeAt(x, z, 1)) continue;
      this.addProp(this.pick(['botte', 'cassa', 'cassa_b', 'barile', 'tino',
                              'catasta', 'anfora', 'gabbia']), x, z,
                   { flip: this.rnd() < 0.5 });
    }
  },
});
