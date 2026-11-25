// missioni_nave.js — i tipi di missione dell'atto III, sulla galea pirata
// (09/10). Stessa forma di missioni.js (il registro TIPI_MISSIONE); qui
// perche' missioni.js e' gia' vicino alla misura. I capitoli e i testi
// (bozze, STORIA_BOZZE.md) stanno in storia_mare.js.
//
//   chiave   passo 2: la chiave dei ferri sfilata al nostromo alle spalle
//   liberi   passo 3: i ferri aperti ai rematori prima che torni il nostromo
//   ammutinamento  passo 4: la sciabola, i pirati sul ponte, il disarmo
//   GuidaNave      la stella sulla prossima meta e l'obiettivo in parole semplici

// ---------------------------------------------------------------- la guida
//
// (09/10, tua prova: "senza testi vago a caso"): sulla nave la stella a terra
// sulla prossima meta e in alto l'obiettivo del momento. Se l'incarico (o il
// committente, fra un capitolo e l'altro) sta nell'altra stanza, la stella va
// sul passaggio: il vano della botola in fondo alla stiva, la grata del
// ponte. game.js la chiama mentre disegna la stanza.

const GuidaNave = {
  PASSAGGIO: { ponte: TX('nave.passaggio.ponte'),
               stiva: TX('nave.passaggio.stiva') },

  // il punto da cui si passa nella stanza `tipo`, da quella in cui sei
  passaggio(tipo) {
    const s = Interni.stanza;
    if (s.entrate && s.entrate[tipo]) return s.entrate[tipo];      // il vano della stiva
    const a = s.arredo.find(q => q.verso === tipo);                 // la grata del ponte
    return a ? { x: a.x, z: a.z - s.C * 0.45 } : null;
  },

  // cap: il capitolo in corso; m: l'incarico in corso (o null)
  guida(cap, m, drawMarker) {
    const s = Interni.stanza;
    if (!s || s.luogo !== 'nave') return;
    const t = m && TIPI_MISSIONE[m.tipo];
    if (m && m.stanza && m.stanza !== s.tipologia) {
      drawMarker(this.passaggio(m.stanza));
      Hud.setObjective(this.PASSAGGIO[m.stanza] || '');
      return;
    }
    if (t && t.meta) drawMarker(t.meta(m));
    // senza un obiettivo suo (ascolta), il titolo del capitolo: tornati nella
    // stanza giusta non deve restare "Scendi nella stiva"
    if (m) Hud.setObjective(t && t.obiettivo ? t.obiettivo(m) : (cap ? cap.titolo : ''));
    // fra un capitolo e l'altro: il committente della nave sta nella stiva
    if (!m && cap && GIVER_MARE[cap.giver] &&
        !s.residenti.some(r => r.committente === cap.giver))
      drawMarker(this.passaggio('stiva'));
  },
};

// ---------------------------------------------------------------- chiave
//
// { tipo: 'chiave', stanza, chi, scoperto }: nella stanza `chi` (il nostromo
// della stiva) si volta ogni pochi secondi, ora verso i banchi ora verso
// poppa. Gli si arriva alle spalle e si tiene premuto E per TIENI secondi
// (input.act: tastiera e tasto E del touch). Se ti ha davanti entro VISTA
// (mentre sfili la chiave o mentre gli giri intorno) ti rimanda al tuo banco
// e si ricomincia. Presa la chiave si resta in catene: si finge (nave.js).

const CHIAVE = { tieni: 3, vista: 7, accanto: 2.1, stella: 1.9,
                 banchi: [2.5, 4], poppa: [5, 7] };     // quanto resta voltato, s

TIPI_MISSIONE.chiave = {
  dentro: true,

  avvia(m) { m.prog = 0; m.presi = 0; },

  // il nostromo della stanza, se ci sei; la prima volta si gira verso i banchi
  guardiano(m) {
    if (!Interni.dentro || Interni.stanza.tipologia !== m.stanza) return null;
    const r = Interni.stanza.residenti.find(q => q.nome === m.chi);
    if (r && r.flipPrima === undefined) {
      r.flipPrima = !!r.flip;
      r.flip = true;
      r.giraT = this.durata(r);
      m.r = r;
    }
    return r;
  },

  durata(r) {
    const [a, b] = r.flip ? CHIAVE.banchi : CHIAVE.poppa;
    return a + Math.random() * (b - a);
  },

  // dove sta il ladro rispetto a lui: davanti (lo vede) o alle spalle e accanto
  posto(r, p) {
    const dx = p.x - r.x, d = Math.hypot(dx, p.z - r.z);
    const verso = dx * (r.flip ? -1 : 1);                 // flip: guarda a ponente
    return { davanti: d < CHIAVE.vista && verso > -0.3,
             spalle: d < CHIAVE.accanto && verso <= -0.3 };
  },

  aggiorna(m, dt, g) {
    const r = this.guardiano(m);
    if (!r) { m.prog = 0; return null; }
    r.giraT -= dt;
    if (r.giraT <= 0) { r.flip = !r.flip; r.giraT = this.durata(r); }
    const p = g.player, qui = this.posto(r, p);
    if (qui.davanti) {
      // al banco: il posto del risveglio (nave.js)
      const s = Interni.stanza, c = Interni.centro(), [i, k] = Nave.banco;
      p.x = c.x - s.W * s.C / 2 + (i + 0.5) * s.C;
      p.z = c.z - s.H * s.C / 2 + (k + 0.5) * s.C;
      p.vx = p.vz = 0;
      m.prog = 0;
      m.presi++;
      g.say(m.scoperto, 4);
      return null;
    }
    m.prog = qui.spalle && g.input.act ? m.prog + dt : 0;
    return m.prog >= CHIAVE.tieni ? 'fatto' : null;
  },

  // E sul nostromo non lo fa parlare: e' il furto (aggiorna)
  parla(m, r) { return r.nome === m.chi; },

  suggerisci(m, g) {
    const r = this.guardiano(m);
    return r && this.posto(r, g.player).spalle ? TX('nave.chiave.tasto') : '';
  },

  // la stella alle sue spalle: si sposta quando si volta
  meta(m) {
    const r = this.guardiano(m);
    return r && { x: r.x + (r.flip ? 1 : -1) * CHIAVE.stella, z: r.z };
  },

  obiettivo() { return TX('nave.chiave.obiettivo'); },

  barra(m) {
    if (!m.prog) return null;
    return { etichetta: TX('nave.chiave.etichetta'), prog: m.prog, richiesto: CHIAVE.tieni,
             visto: false, verbo: TX('nave.chiave.verbo') };
  },

  disegna(m) {
    const r = this.guardiano(m);
    if (r) Missioni.segna(r, 'segno_sacchetto');
  },

  // il nostromo torna com'era (la stiva e' la stessa per tutto il gioco)
  chiudi(m) {
    const r = m.r;
    if (r) { r.flip = r.flipPrima; delete r.flipPrima; delete r.giraT; }
  },

  plancia(m) {
    return `<p><b>${TX('nave.chiave.titolo')}</b> ${TX('nave.chiave.plancia', { s: CHIAVE.tieni })}` +
           `${m.presi ? TX('nave.chiave.visto', { n: m.presi }) : ''}</p>`;
  },
};

// ---------------------------------------------------------------- liberi
//
// { tipo: 'liberi', stanza, chi, tempo, scena }: dopo la scena (la vela
// all'orizzonte, passaggi.js) i pirati sono all'abbordaggio e `chi` (il
// nostromo) sale con loro: sparisce dalla stanza. Si hanno `tempo` secondi
// per aprire i ferri ai rematori, E accanto a ognuno (chi non e' un pirato:
// i sette ai banchi). Liberi tutti, ti liberi anche tu: niente piu' ferri,
// ma a mani nude (nave.js). Se il tempo finisce il nostromo torna giu' e si
// ricomincia dal vecchio al remo.

const LIBERI = { accanto: 2.6 };

TIPI_MISSIONE.liberi = {
  dentro: true,

  avvia(m) {
    m.restano = m.tempo;
    m.liberati = [];
    m.quanti = this.rematori(m).length || 7;
    this.via(m);
  },

  qui: m => Interni.dentro && Interni.stanza.tipologia === m.stanza,

  // i rematori della stanza: tutti tranne i pirati
  rematori(m) {
    return this.qui(m) ? Interni.stanza.residenti.filter(r => !r.sprite.startsWith('Pir')) : [];
  },

  // il nostromo sale sul ponte: fuori dalla stanza e la sua cella sgombra
  // (la stiva e' la stessa per tutto il gioco: chiudi lo rimette)
  via(m) {
    if (m.assente || !this.qui(m)) return;
    const s = Interni.stanza, i = s.residenti.findIndex(r => r.nome === m.chi);
    if (i < 0) return;
    const [r] = s.residenti.splice(i, 1);
    m.assente = { r, i, s, cella: r.cella[1] * s.W + r.cella[0] };
    s.solido[m.assente.cella] = 0;
  },

  vicino(m, p) {
    let best = null, bd = LIBERI.accanto;
    for (const r of this.rematori(m)) {
      const d = Math.hypot(r.x - p.x, r.z - p.z);
      if (!r.libero && d < bd) { bd = d; best = r; }
    }
    return best;
  },

  // E accanto a un rematore ancora ai ferri: li apri
  azione(m, g) {
    const r = this.vicino(m, g.player);
    if (!r) return false;
    r.libero = true;
    m.liberati.push(r);
    Sfx.mount();
    return true;
  },

  aggiorna(m, dt) {
    this.via(m);
    m.restano -= dt;
    if (m.liberati.length >= m.quanti) { Nave.sciogli(); return 'fatto'; }
    return m.restano <= 0 ? m.tornato : null;
  },

  suggerisci(m, g) { return this.vicino(m, g.player) ? TX('nave.ferri.tasto') : ''; },

  obiettivo() { return TX('nave.ferri.obiettivo'); },

  // il tempo che resta, nella barra dell'HUD
  barra(m) {
    return { etichetta: TX('nave.ferri.etichetta'), prog: m.tempo - m.restano,
             richiesto: m.tempo, visto: false,
             verbo: TX('nave.ferri.verbo', { n: m.liberati.length, di: m.quanti }) };
  },

  disegna(m) {
    for (const r of this.rematori(m)) if (!r.libero) Missioni.segna(r, 'segno_sacchetto');
  },

  chiudi(m) {
    for (const r of m.liberati) delete r.libero;
    const a = m.assente;
    if (a) { a.s.residenti.splice(a.i, 0, a.r); a.s.solido[a.cella] = 1; }
  },

  plancia(m) {
    return `<p><b>${TX('missioni.scorta.liberati')}</b> ${m.liberati.length} / ${m.quanti}` +
           TX('nave.ferri.torna', { s: Math.max(0, Math.ceil(m.restano)) }) + '</p>';
  },
};

// ---------------------------------------------------------------- ammutinamento
//
// { tipo: 'ammutinamento', stanza, durata, stremo, armato, disarmo }: sul
// ponte E sulla rastrelliera a poppa, una sciabola (ARMI, story.js; 09/10 la
// rastrelliera sta sul ponte: la porta della cabina sul disegno non c'era);
// subito i pirati ti attaccano davvero: la gente della stanza diventa Nemici
// che puntano solo te (game.js li muove e li disegna anche nelle stanze).
// I sette rematori liberati al passo 3 salgono dalla grata e combattono con
// te (13/10, tua richiesta): a mani nude, ognuno il pirata piu' vicino; i
// pirati puntano il piu' vicino fra te e loro (game.js: Nemico.punta). Sono
// Nemici della fazione 'alleato': la tua mira non li prende.
// L'ammutinamento fallisce comunque: dopo `durata` secondi, allo stremo
// (sotto `stremo` della vita; non si muore: Player.minimo, entities.js) o con
// tutti i pirati a terra, ti disarmano e ti rimettono i ferri. Mentre si
// combatte dal ponte non si scende. Il capitolo ha il finale (la Costa).

const AMMUTINAMENTO = { vita: 60, velocita: 3.4, lettura: 4, accanto: 2.6,
                        chiuso: TX('nave.ammutinamento.chiuso'),
                        rematori: { vita: 50, velocita: 3.2,
                                    arma: { portata: 1.7, cadenza: 1.2, danno: [5, 9] } } };
// i sette rematori della stiva (stanze/nave/stiva.json, senza i due pirati)
const REMATORI = ['MiniPeasant', 'MiniOldMan', 'MiniVillagerMan', 'MiniWorker',
                  'MiniPeasant', 'MiniVillagerMan', 'MiniOldMan'];
// il vivo piu' vicino ad a, fra quelli di L
const vicinoFra = (a, L) => L.filter(q => !q.dead)
  .sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z))[0] || null;
// toglie dai nemici quelli di L (i rematori, i pirati a terra)
function viaDaiNemici(g, L) {
  for (const e of L || []) { const k = g.nemici.indexOf(e); if (k >= 0) g.nemici.splice(k, 1); }
}

TIPI_MISSIONE.ammutinamento = {
  dentro: true,

  avvia(m) {
    m.fase = 'armi';
    m.t = 0;
    if (Nave.inCatene) Nave.sciogli();          // la prova: i ferri sono gia' aperti
  },

  dove: () => Interni.dentro && Interni.stanza.tipologia,

  // la rastrelliera della stanza dell'incarico, se ci sei
  rastrelliera(m) {
    if (this.dove() !== m.stanza) return null;
    return Interni.stanza.arredo.find(q => q.nome === 'rastrelliera') || null;
  },

  accanto(m, p) {
    const a = this.rastrelliera(m);
    return !!a && Math.hypot(a.x - p.x, a.z - p.z) < AMMUTINAMENTO.accanto;
  },

  azione(m, g) {
    const p = g.player;
    if (m.fase === 'armi' && this.accanto(m, p)) {
      if (!p.arsenale.includes('sciabola')) p.arsenale.push('sciabola');
      p.equipaggia('sciabola');
      Nave.arma();
      m.fase = 'ponte';
      g.say(m.armato, 5);
      return true;
    }
    // la grata: mentre si combatte non si passa
    if (m.fase === 'lotta' && Interni.azioneVicina(p.x, p.z)) {
      g.say(AMMUTINAMENTO.chiuso, 2.5);
      return true;
    }
    return false;
  },

  aggiorna(m, dt, g) {
    const p = g.player;
    if (m.fase === 'ponte' && this.dove() === m.stanza) this.attaccano(m, g);
    if (m.fase === 'lotta') {
      m.t += dt;
      if (m.t >= m.durata || p.hp <= p.maxHp * m.stremo || m.pirati.every(e => e.dead))
        this.disarma(m, g);
    }
    if (m.fase !== 'disarmato') return null;
    m.attesa -= dt;                       // la riga del disarmo, prima del finale
    return m.attesa <= 0 ? 'fatto' : null;
  },

  // la gente del ponte (game.js, dentroLa) diventa Nemici; la si tiene da
  // parte per rimetterla dopo
  attaccano(m, g) {
    m.gente0 = g.inStanza().filter(n => !n.dead);
    m.pirati = m.gente0.map(n => {
      const e = new Nemico(n.sprite, n.x, n.z, { hp: AMMUTINAMENTO.vita,
                                                 speed: AMMUTINAMENTO.velocita });
      Object.assign(e, { inStanza: true, missione: true, rancore: 1e9, taglia: 0 });
      g.npcs.splice(g.npcs.indexOf(n), 1);
      g.nemici.push(e);
      return e;
    });
    const grata = Interni.stanza.arredo.find(a => a.verso) || g.player;
    m.rematori = REMATORI.map((s, i) => {
      const R = AMMUTINAMENTO.rematori;
      const e = new Nemico(s, grata.x + (i % 4 - 1.5) * 1.4,
                           grata.z + (Math.floor(i / 4) - 0.5) * 1.4, { hp: R.vita, speed: R.velocita });
      Object.assign(e, { inStanza: true, missione: true, fazione: 'alleato', taglia: 0,
                         arma_: R.arma, punta: () => vicinoFra(e, m.pirati) });
      g.nemici.push(e);
      return e;
    });
    for (const e of m.pirati) e.punta = () => vicinoFra(e, [g.player, ...m.rematori]);
    g.player.minimo = 1;
    m.fase = 'lotta';
  },

  // la sciabola via e i ferri di nuovo; chi e' in piedi torna gente della
  // stanza, fermo dov'e'; i rematori, ripresi, tornano ai banchi
  disarma(m, g) {
    viaDaiNemici(g, m.rematori);
    const p = g.player;
    p.arsenale = p.arsenale.filter(k => k !== 'sciabola');
    p.equipaggia(p.arsenale[0]);
    Nave.incatena();
    m.pirati.forEach((e, i) => {
      if (e.dead) return;
      const n = m.gente0[i];
      Object.assign(n, { x: e.x, z: e.z, flip: e.flip });
      g.npcs.push(n);
      g.nemici.splice(g.nemici.indexOf(e), 1);
    });
    m.fase = 'disarmato';
    m.attesa = AMMUTINAMENTO.lettura;
    g.say(m.disarmo, 6);
  },

  suggerisci(m, g) {
    const p = g.player;
    if (m.fase === 'armi' && this.accanto(m, p)) return TX('nave.ammutinamento.tasto');
    if (m.fase === 'lotta' && Interni.azioneVicina(p.x, p.z)) return AMMUTINAMENTO.chiuso;
    return '';
  },

  // la stella davanti alla rastrelliera, a levante (da li' ci si arriva)
  meta(m) {
    const a = m.fase === 'armi' && this.rastrelliera(m);
    return a ? { x: a.x + Interni.stanza.C, z: a.z - Interni.stanza.C * 0.45 } : null;
  },

  obiettivo(m) {
    if (m.fase === 'armi') return TX('nave.ammutinamento.obiettivo');
    return m.fase === 'lotta' ? TX('nave.ammutinamento.combatti') : TX('nave.ammutinamento.titolo');
  },

  disegna(m) {
    const a = m.fase === 'armi' && this.rastrelliera(m);
    if (a) Missioni.segna(a, 'segno_spada');
  },

  // i pirati morti (i vivi sono gia' tornati gente), i rematori e la vita
  // minima
  chiudi(m, g) {
    delete g.player.minimo;
    viaDaiNemici(g, m.pirati);
    viaDaiNemici(g, m.rematori);
  },

  plancia(m) {
    if (m.fase === 'armi')
      return `<p><b>${TX('nave.ammutinamento.armi')}</b> ${TX('nave.ammutinamento.rastrelliera')}</p>`;
    return `<p><b>${TX('nave.ammutinamento.titolo')}.</b></p>`;
  },
};
