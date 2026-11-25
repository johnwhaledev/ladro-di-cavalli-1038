// campagna.js — la storia fuori dal mondo: gli atti, le citta', cosa si
// possiede e cosa si perde passando da un atto all'altro (voce F2, 27/09).
//
// Prima la storia era una lista sola (CAPITOLI, story.js) che valeva in ogni
// citta'. Ora la campagna e' un giro in cinque atti, e ogni atto ha la sua
// citta', i suoi capitoli e i suoi committenti (CAMPAGNE). Lo stato della
// storia (atto, capitolo, passo, cosa si e' lasciato indietro) vive qui, non
// nel mondo: cambiando citta' il mondo si rifa' da capo, la storia resta.
//
// game.js tiene lo stesso oggetto (`campagna`), con in piu' l'incarico in
// corso (attiva, t) che invece e' del mondo e riparte dal committente.
//
// Segnaposto da confermare (PLAN.md, "Proposte" e "Decisioni aperte"): le
// citta' degli atti II-IV e i loro nomi, cosa si perde e cosa si ritrova.
// Ognuno e' scritto in un posto solo, qui sotto. I capitoli dell'atto II
// stanno in storia_fiordo.js, quelli dell'atto IV in storia_costa.js, quelli
// dell'atto V in storia_ritorno.js.
//
// corteDal: da quale capitolo (contato da 0) nella corte del castello (o nel
// recinto del jarl) si entra senza taglia. Se manca, mai.

// la cassa sotto il molo (premio del capitolo 3): la si ritrova al ritorno
const CASSA_DEL_MOLO = 320;

const CAMPAGNE = {
  // atto I: i cinque capitoli di sempre
  valdarno: {
    atto: 1, titolo: TX('campagna.valdarno.titolo'), citta: 'valdarno',
    capitoli: CAPITOLI, committenti: GIVER_CAP, corteDal: 4,
    fine: TX('campagna.valdarno.fine'),
  },
  // atto II: si arriva senza niente, straniero e sospetto; dall'holmgang
  // (capitolo 3) il jarl ti vuole nella sua sala
  fiordo: {
    atto: 2, titolo: TX('campagna.fiordo.titolo'), citta: 'fiordo-3',
    capitoli: CAPITOLI_FIORDO, committenti: GIVER_FIORDO, corteDal: 2,
    arrivo: { perdi: ['taglia'], segna: [TX('campagna.fiordo.arrivo.segna.1')],
              messaggio: TX('campagna.fiordo.arrivo.messaggio') },
    fine: TX('campagna.fiordo.fine'),
  },
  // atto III: in catene sulla nave pirata; si perde tutto tranne il fiato.
  // Niente citta': ci si sveglia nella stiva (nave.js, game.js inNave), col
  // mondo di prima fermo dietro. I capitoli e i testi (bozze) stanno in
  // storia_mare.js: i quattro passi; il quarto finisce con la Costa
  mare: {
    atto: 3, titolo: TX('campagna.mare.titolo'), citta: null,
    capitoli: CAPITOLI_MARE, committenti: GIVER_MARE,
    // il messaggio: la bozza del risveglio (STORIA_BOZZE.md), poi cosa fare
    arrivo: { perdi: ['soldi', 'armi', 'tenda', 'cavalcatura'],
              messaggio: TX('campagna.mare.arrivo.messaggio') },
    fine: TX('campagna.mare.fine'),
  },
  // atto IV: la Costa saracena, si riparte da zero. La citta' c'e' dal 29/09
  // (pianta_costa.js): costa-5, "Qasr Zarqa", segnaposto finche' non confermi
  // il nome (la tua proposta e' Qasr Tamar)
  // Dal 09/10 (tua scelta): venduto al mercato, si arriva a piedi nel suk
  // davanti al mercante che ti ha comprato (aPiedi: game.js, viaggia). I
  // capitoli (13/10, bozze) stanno in storia_costa.js; dal capitolo 4 l'emiro
  // ti vuole nel suo palazzo, nella casba
  costa: {
    atto: 4, titolo: TX('campagna.costa.titolo'), citta: 'costa-5',
    capitoli: CAPITOLI_COSTA, committenti: GIVER_COSTA, corteDal: 3,
    arrivo: { perdi: [], aPiedi: 'mercante' },
    fine: TX('campagna.costa.fine'),
  },
  // atto V: il ritorno a Valdarno, cambiata; sotto il molo c'e' ancora la
  // cassa. I capitoli (13/10, bozze mie) stanno in storia_ritorno.js; il ladro
  // resta vestito di beige come alla Costa (tuo appunto del 13/10: `veste`,
  // entities.js). Chiuso il capitolo 5 la campagna e' finita. Il Ciambellano
  // comanda: dentro le mura 10 guardie di ronda invece di 7 (`ronde`, 14/10)
  ritorno: {
    atto: 5, titolo: TX('campagna.ritorno.titolo'), citta: 'valdarno', ronde: 10,
    capitoli: CAPITOLI_RITORNO, committenti: GIVER_RITORNO, veste: '@beige',
    arrivo: { perdi: [], ritrova: ['cassa'],
              messaggio: TX('campagna.ritorno.arrivo.messaggio') },
    fine: TX('campagna.ritorno.fine'),
  },
};

// il giro, in fila
const ATTI = ['valdarno', 'fiordo', 'mare', 'costa', 'ritorno'];

// La missione di prova: un incarico per tipo nuovo (missioni.js), fuori dalla
// storia (__game.debug.prova(n), il collaudo). Non e' storia: testi di servizio
CAMPAGNE.prova = {
  atto: 0, titolo: TX('campagna.prova.titolo'), citta: null, committenti: {}, fine: '',
  capitoli: [{
    id: 0, titolo: TX('campagna.prova.capitoli.cap0.titolo'), giver: 'prova', premio: 0, arma: null,
    apertura: '', chiusura: '',
    missioni: [
      { tipo: 'scorta', zona: 'bosco', quanti: 2,
        testo: TX('campagna.prova.capitoli.cap0.p1.testo') },
      { tipo: 'duello', zona: 'mercato',
        testo: TX('campagna.prova.capitoli.cap0.p2.testo') },
      { tipo: 'bestia', zona: 'bosco',
        testo: TX('campagna.prova.capitoli.cap0.p3.testo') },
      { tipo: 'gara', mezzo: 'cavallo',
        testo: TX('campagna.prova.capitoli.cap0.p4.testo') },
      { tipo: 'gara', mezzo: 'barca',
        testo: TX('campagna.prova.capitoli.cap0.p5.testo') },
      { tipo: 'difesa',
        testo: TX('campagna.prova.capitoli.cap0.p6.testo') },
      { tipo: 'furto', stanza: 'taverna',
        testo: TX('campagna.prova.capitoli.cap0.p7.testo') },
      // l'atto III, passo 1 (storia_mare.js): va provata nella stiva
      { ...CAPITOLI_MARE[0].missioni[0],
        testo: TX('campagna.prova.capitoli.cap0.p8.testo') },
      // passo 2 (missioni_nave.js): la chiave del nostromo, nella stiva
      { ...CAPITOLI_MARE[1].missioni[0],
        testo: TX('campagna.prova.capitoli.cap0.p9.testo') },
      // passo 3: i ferri ai rematori, senza la scena della vela
      { ...CAPITOLI_MARE[2].missioni[0], scena: null,
        testo: TX('campagna.prova.capitoli.cap0.p10.testo') },
      // passo 4: la sciabola sul ponte, i pirati (senza il finale)
      { ...CAPITOLI_MARE[3].missioni[0],
        testo: TX('campagna.prova.capitoli.cap0.p11.testo') },
      // l'atto IV (storia_costa.js), alla Costa: la carovana e la corsa
      { ...CAPITOLI_COSTA[1].missioni[0],
        testo: TX('campagna.prova.capitoli.cap0.p12.testo') },
      { ...CAPITOLI_COSTA[2].missioni[2],
        testo: TX('campagna.prova.capitoli.cap0.p13.testo') },
    ],
  }],
};

const Storia = (() => {
  // lo stato della storia; game.js ci aggiunge l'incarico in corso
  const stato = { atto: 0, cap: 0, miss: 0, finita: false, attiva: null, t: 0,
                  prova: null, segni: [] };
  // la missione di prova sospende la storia e la rimette com'era (missioni.js)
  let sospesa = null;

  const campagna = () => (stato.prova ? CAMPAGNE.prova : CAMPAGNE[ATTI[stato.atto]]);

  function capitolo() {
    const c = campagna();
    return (c && c.capitoli[stato.prova ? 0 : stato.cap]) || null;
  }

  // come si chiama in gioco un committente: quello dell'atto in corso, se no
  // quello di un altro atto (i committenti del mondo, world_abitanti.js, ci
  // sono in ogni atto)
  function committente(k) {
    const c = campagna();
    if (c && c.committenti[k]) return c.committenti[k];
    for (const a of ATTI) if (CAMPAGNE[a].committenti[k]) return CAMPAGNE[a].committenti[k];
    return k;
  }

  // nella corte del castello (o nel recinto del jarl) senza taglia
  function corteLibera() {
    const c = CAMPAGNE[ATTI[stato.atto]];
    return stato.finita || stato.cap >= (c.corteDal ?? Infinity);
  }

  // la citta' dove la storia ti vuole: se non e' quella in cui sei, si salpa
  // (viaggio.js). Null: si resta qui. Finita la campagna (tua risposta del
  // 26/09: citta' libere, il mare escluso) dal largo si va alla citta' dopo
  // nel giro (13/10, scelta mia: senza un menu in piu')
  const GIRO = ['valdarno', 'fiordo-3', 'costa-5'];
  const libere = () => stato.finita && stato.atto === ATTI.length - 1;
  function meta(chiaveQui) {
    if (libere()) return GIRO[(GIRO.indexOf(chiaveQui) + 1) % GIRO.length];
    const c = CAMPAGNE[ATTI[stato.atto]];
    return c && c.citta && c.citta !== chiaveQui ? c.citta : null;
  }

  // il nome della meta (il suggerimento al largo, la scena del viaggio): il
  // titolo dell'atto, o la citta' quando sono libere (il nome si calcola una
  // volta: il suggerimento lo chiede a ogni fotogramma)
  const nomi = {};
  function verso(chiaveQui) {
    if (!libere()) return CAMPAGNE[ATTI[stato.atto]].titolo;
    const k = meta(chiaveQui);
    return nomi[k] || (nomi[k] = Viaggio.pianta(k).nome);
  }

  // Il passaggio all'atto seguente: la storia riparte dal primo capitolo e si
  // perde (o si ritrova) quello che l'arrivo dice. g: {player, tenda}
  function passa(g) {
    if (stato.atto >= ATTI.length - 1) return null;
    stato.atto++;
    stato.cap = 0; stato.miss = 0; stato.finita = false; stato.attiva = null;
    const c = CAMPAGNE[ATTI[stato.atto]];
    const a = c.arrivo || {};
    const p = g.player;
    for (const cosa of a.perdi || []) {
      if (cosa === 'soldi') p.money = 0;
      // senza un'arma "a mani nude" (manca lo sprite) resta la spada corta
      if (cosa === 'armi') { p.arsenale = ['spada']; p.equipaggia('spada'); }
      if (cosa === 'tenda') g.tenda.rimetti({ posseduta: false });
      if (cosa === 'cavalcatura' && p.vehicle) { p.vehicle.rider = null; p.scendi(); }
      if (cosa === 'taglia') p.wanted = 0;           // le stelle restano in citta'
    }
    // quel che la storia si ricorda (la taglia del Ciambellano: l'atto II)
    for (const s of a.segna || []) if (!stato.segni.includes(s)) stato.segni.push(s);
    for (const cosa of a.ritrova || [])
      if (cosa === 'cassa') p.money += CASSA_DEL_MOLO;
    return c;
  }

  // La nave in prova (game.js, inNave): la storia all'inizio di un atto senza
  // passare dal finale di quello prima e senza perdere niente
  function salta(chiave) {
    stato.atto = ATTI.indexOf(chiave);
    stato.cap = 0; stato.miss = 0; stato.finita = false; stato.attiva = null;
    stato.prova = null;
    sospesa = null;
  }

  // --- la missione di prova: fuori dalla storia, non tocca capitolo e passo
  function inProva() { return !!stato.prova; }

  function iniziaProva(n) {
    if (!sospesa) sospesa = { cap: stato.cap, miss: stato.miss, finita: stato.finita };
    stato.prova = true;
    stato.miss = n;
    stato.attiva = null;
  }

  let ultimaProva = null;               // l'esito dell'ultima, per il collaudo
  function fineProva(esito) {
    if (sospesa) Object.assign(stato, sospesa);
    sospesa = null;
    stato.prova = null;
    stato.attiva = null;
    ultimaProva = esito || null;
  }

  // la veste del ladro voluta dall'atto (il beige dell'atto V), se la citta'
  // non ne dice una (entities.js, Player.vesti)
  function veste() { return CAMPAGNE[ATTI[stato.atto]].veste || ''; }

  // le guardie di ronda dentro le mura (game.js): quante ne vuole l'atto (piu'
  // ronde nell'atto V, tua scelta del 14/10); a campagna finita le solite 7
  function ronde() { return (!libere() && CAMPAGNE[ATTI[stato.atto]].ronde) || 7; }

  // --- il salvataggio (salvataggio.js): la storia fuori dal mondo
  function perSalvare() { return { atto: stato.atto, segni: [...stato.segni] }; }

  function rimetti(s) {
    stato.atto = Math.max(0, Math.min(ATTI.length - 1, (s && s.atto) || 0));
    stato.segni = (s && s.segni) ? [...s.segni] : [];
    stato.prova = null;
    sospesa = null;
  }

  return { stato, campagna, capitolo, committente, corteLibera, meta, verso, passa, salta, veste, ronde,
           inProva, iniziaProva, fineProva, perSalvare, rimetti,
           GIRO, get libere() { return libere(); },                // viaggi.js
           get titolo() { return CAMPAGNE[ATTI[stato.atto]].titolo; },
           get ultimaProva() { return ultimaProva; } };
})();
