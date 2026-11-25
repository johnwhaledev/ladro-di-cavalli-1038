// story.js — armi, fucina e campagna a capitoli.
//
// Le armi non sono oggetti da agganciare a un corpo: il pool non ha un corpo
// base con armi intercambiabili, ha personaggi interi. Quindi ogni arma E' un
// personaggio, con il suo vestito. Il vantaggio e' che si legge da lontano —
// chi ti vede capisce subito se porti la balestra o l'alabarda — e non serve
// nessun sistema di equipaggiamento grafico.

// Il protagonista e' UNO: cappuccio e mantello del ladro. Ogni arma e' una
// variante composta da build_ladro.py — corpo sempre lo stesso, cambiano solo
// le mani che impugnano e il lampo del colpo. Piu' 'ladro_cavallo' per quando
// e' in sella.
const SPRITE_CAVALLO = 'ladro_cavallo';

// chi vende le armi, per le frasi della bottega (game.js): a Valdarno
// Ferrante; il Fiordo e la Costa hanno il loro (pianta.FABBRO, 14/10: "almeno
// i nomi diversi")
const FABBRO_VALDARNO = { Chi: TX('nomi.ferrante'), dove: TX('fabbro_valdarno.dove') };

const ARMI = {
  spada: {
    sprite: 'ladro_spada', nome: TX('armi.spada.nome'),
    desc: TX('armi.spada.desc'),
    danno: [16, 26], portata: 1.9, cadenza: 0.42, prezzo: 0,
  },
  pugnale: {
    sprite: 'ladro_pugnale', nome: TX('armi.pugnale.nome'),
    desc: TX('armi.pugnale.desc'),
    danno: [11, 17], portata: 1.5, cadenza: 0.22, prezzo: 90,
    furtivo: 0.55,          // moltiplicatore sui punti di taglia
  },
  lancia: {
    sprite: 'ladro_lancia', nome: TX('armi.lancia.nome'),
    desc: TX('armi.lancia.desc'),
    danno: [20, 30], portata: 2.9, cadenza: 0.60, prezzo: 160,
  },
  scudo: {
    sprite: 'ladro_scudo', nome: TX('armi.scudo.nome'),
    desc: TX('armi.scudo.desc'),
    danno: [15, 23], portata: 1.9, cadenza: 0.48, prezzo: 280,
    difesa: 0.55,           // moltiplicatore sui danni subiti
  },
  arco: {
    sprite: 'ladro_arco', nome: TX('armi.arco.nome'),
    desc: TX('armi.arco.desc'),
    danno: [14, 20], portata: 26, cadenza: 0.55, prezzo: 420,
    distanza: true, proiettile: 'freccia', velocita: 34,
  },
  balestra: {
    sprite: 'ladro_balestra', nome: TX('armi.balestra.nome'),
    desc: TX('armi.balestra.desc'),
    danno: [34, 48], portata: 30, cadenza: 1.25, prezzo: null,
    distanza: true, proiettile: 'quadrello', velocita: 46,
  },
  alabarda: {
    sprite: 'ladro_alabarda', nome: TX('armi.alabarda.nome'),
    desc: TX('armi.alabarda.desc'),
    danno: [30, 44], portata: 3.2, cadenza: 0.72, prezzo: null,
  },
  // la rastrelliera del capitano (atto III, passo 4, missioni_nave.js): si
  // perde quando ti disarmano. Il vestito e' quello della spada (manca uno
  // sprite suo)
  sciabola: {
    sprite: 'ladro_spada', nome: TX('armi.sciabola.nome'),
    desc: TX('armi.sciabola.desc'),
    danno: [20, 30], portata: 2.0, cadenza: 0.5, prezzo: null,
  },
  // il dono dell'emiro (atto IV, capitolo 4; 14/10, tua idea): la sciabola
  // del capitano, ma d'oro e col suo sprite (build_ladro.py, ORO). La frase e'
  // mia, provvisoria
  sciabola_emiro: {
    sprite: 'ladro_sciabola_emiro', nome: TX('armi.sciabola_emiro.nome'),
    desc: TX('armi.sciabola_emiro.desc'),
    danno: [20, 30], portata: 2.0, cadenza: 0.5, prezzo: null,
  },
};

// quello che il fabbro tiene in bottega: il resto lo consegna la storia
const IN_VENDITA = ['pugnale', 'lancia', 'scudo', 'arco'];

// ---------------------------------------------------------------- capitoli
//
// Cinque capitoli, ognuno ancorato a un quartiere e a un committente. Le
// missioni usano tipi riusabili (consegna, furto, caccia, fuga, riscossione,
// colpo); a cambiare sono i luoghi, i testi e la posta.

const CAPITOLI = [
  {
    id: 1, titolo: TX('atto1.cap1.titolo'), luogo: 'bassifondi', giver: 'fabbro',
    apertura: TX('atto1.cap1.apertura'),
    chiusura: TX('atto1.cap1.chiusura'),
    premio: 120, arma: 'pugnale', dono: 'tenda',     // tenda.js
    missioni: [
      { tipo: 'consegna', zona: 'slums',              // missioni_base.js
        destinatario: { chi: 'bassifondi', nome: TX('atto1.cap1.p1.destinatario.nome'),
                        dice: TX('atto1.cap1.p1.destinatario.dice') },
        testo: TX('atto1.cap1.p1.testo') },
      { tipo: 'riscossione', quanti: 3, zona: 'slums',
        testo: TX('atto1.cap1.p2.testo') },
      { tipo: 'furto_mezzo', zona: 'slums', fermo: true,      // missioni_carro.js
        testo: TX('atto1.cap1.p3.testo') },
    ],
  },
  {
    id: 2, titolo: TX('atto1.cap2.titolo'), luogo: 'mercato', giver: 'mercante',
    apertura: TX('atto1.cap2.apertura'),
    chiusura: TX('atto1.cap2.chiusura'),
    premio: 220, arma: null,
    missioni: [
      { tipo: 'colpo', durata: 8, zona: 'mercato',
        testo: TX('atto1.cap2.p1.testo') },
      { tipo: 'caccia', zona: 'mercato',
        testo: TX('atto1.cap2.p2.testo') },
      { tipo: 'fuga', durata: 60,
        testo: TX('atto1.cap2.p3.testo') },
      { tipo: 'riscossione', quanti: 4, zona: 'mercato',
        testo: TX('atto1.cap2.p4.testo') },
    ],
  },
  {
    id: 3, titolo: TX('atto1.cap3.titolo'), luogo: 'porto', giver: 'nocchiero',
    apertura: TX('atto1.cap3.apertura'),
    chiusura: TX('atto1.cap3.chiusura'),
    premio: 320, arma: 'balestra',
    missioni: [
      { tipo: 'consegna', zona: 'porto', luogo: 'molo', tempo: true,   // la chiatta
        testo: TX('atto1.cap3.p1.testo') },
      { tipo: 'colpo', durata: 10, zona: 'porto', luogo: 'molo',   // sul molo (15/10)
        testo: TX('atto1.cap3.p2.testo') },
      { tipo: 'fuga', durata: 70,
        testo: TX('atto1.cap3.p3.testo') },
    ],
  },
  {
    id: 4, titolo: TX('atto1.cap4.titolo'), luogo: 'bosco', giver: 'briganti',
    apertura: TX('atto1.cap4.apertura'),
    chiusura: TX('atto1.cap4.chiusura'),
    premio: 450, arma: 'alabarda', dono: 'cunicolo',   // B
    missioni: [
      { tipo: 'caccia', zona: 'bosco',
        testo: TX('atto1.cap4.p1.testo') },
      { tipo: 'furto_mezzo', zona: 'campi', luogo: 'briganti',   // al campo, dal Capo
        testo: TX('atto1.cap4.p2.testo') },
      { tipo: 'colpo', durata: 12, zona: 'bosco',
        arrivano: { chi: 'guardia', quanti: 4, grido: TX('atto1.cap4.p3.arrivano.grido') },
        testo: TX('atto1.cap4.p3.testo') },
    ],
  },
  // Il finale dell'atto I (27/09, bozza in STORIA_BOZZE.md): la corona la
  // porti al Ciambellano, lui ti fa arrestare e si prende il merito; fuga al
  // porto e il Nocchiero ti porta al nord (finale: la scena, e l'atto II)
  {
    id: 5, titolo: TX('atto1.cap5.titolo'), luogo: 'castello', giver: 'ciambellano',
    apertura: TX('atto1.cap5.apertura'),
    chiusura: '',
    premio: 0, arma: null, finale: 'fuga',
    missioni: [
      { tipo: 'consegna', zona: 'nobile',
        testo: TX('atto1.cap5.p1.testo') },
      { tipo: 'colpo', durata: 14, zona: 'nobile',
        testo: TX('atto1.cap5.p2.testo') },
      { tipo: 'imbarco', scena: 'arresto',
        testo: TX('atto1.cap5.p3.testo') },
    ],
  },
];

// committenti: nome interno → come si chiama in gioco
const GIVER_CAP = {
  fabbro: TX('committenti.atto1.fabbro'),
  mercante: TX('committenti.atto1.mercante'),
  nocchiero: TX('committenti.atto1.nocchiero'),
  briganti: TX('committenti.atto1.briganti'),
  ciambellano: TX('committenti.atto1.ciambellano'),
};
