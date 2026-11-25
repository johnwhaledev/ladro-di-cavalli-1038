// storia_ritorno.js — l'atto V, il ritorno a Valdarno: i cinque capitoli e i
// committenti (13/10, dalla bozza di STORIA_BOZZE.md, scritta in autonomia).
//
// La stessa Valdarno, cambiata: comanda il Ciambellano, c'e' una forca nuova
// in piazza (world_abitanti.js) e lui non sta piu' nella corte a dare
// incarichi. Riunisci gli alleati, uno per capitolo (il Nocchiero, Aldo, il
// Capo dei fuorilegge, Ferrante), poi il castello: il Ciambellano preso vivo
// (`cattura`, missioni_ritorno.js), portato in piazza, e la scena "forca"
// (passaggi.js) prima dell'ultimo passo. Chiuso il capitolo 5 la campagna e'
// finita: restano i contratti liberi.
//
// Stessa forma degli altri atti (story.js, storia_fiordo.js). I committenti
// sono quelli di Valdarno, coi nomi scritti in world_abitanti.js. Il ladro va
// vestito di beige come alla Costa (campagna.js, `veste`; tuo appunto del
// 13/10). Segnaposto: tutti i testi (bozze mie), i premi.

const CAPITOLI_RITORNO = [
  {
    id: 1, titolo: TX('atto5.cap1.titolo'), luogo: 'porto', giver: 'nocchiero',
    apertura: TX('atto5.cap1.apertura'),
    chiusura: TX('atto5.cap1.chiusura'),
    premio: 150, arma: null,
    missioni: [
      { tipo: 'consegna', luogo: 'piazza',
        testo: TX('atto5.cap1.p1.testo') },
      { tipo: 'fuga', durata: 45,
        testo: TX('atto5.cap1.p2.testo') },
      // parte da se' dopo la fuga: la meta e' il Nocchiero (Missioni.luogo)
      { tipo: 'consegna', luogo: 'nocchiero', subito: true,
        testo: TX('atto5.cap1.p3.testo') },
    ],
  },
  {
    id: 2, titolo: TX('atto5.cap2.titolo'), luogo: 'mercato', giver: 'mercante',
    apertura: TX('atto5.cap2.apertura'),
    chiusura: TX('atto5.cap2.chiusura'),
    premio: 200, arma: null,
    missioni: [
      { tipo: 'furto', stanza: 'taverna',
        testo: TX('atto5.cap2.p1.testo') },
      { tipo: 'consegna', zona: 'mercato',             // missioni_base.js
        destinatario: { chi: 'mercante', nome: TX('atto5.cap2.p2.destinatario.nome'),
                        dice: TX('atto5.cap2.p2.destinatario.dice') },
        testo: TX('atto5.cap2.p2.testo') },
      { tipo: 'caccia', zona: 'mercato',
        testo: TX('atto5.cap2.p3.testo') },
    ],
  },
  {
    id: 3, titolo: TX('atto5.cap3.titolo'), luogo: 'bosco', giver: 'briganti',
    apertura: TX('atto5.cap3.apertura'),
    chiusura: TX('atto5.cap3.chiusura'),
    premio: 250, arma: 'scudo',
    missioni: [
      // i prigionieri sono fuorilegge, i carcerieri i soldati del Ciambellano
      // (missioni.js, scorta: `guardiani`)
      { tipo: 'scorta', zona: 'mercato', quanti: 2, chi: 'brigante', guardiani: 'guardia',
        verso: 'bosco',
        testo: TX('atto5.cap3.p1.testo') },
      { tipo: 'furto_mezzo', zona: 'campi', luogo: 'briganti',   // al campo, dal Capo
        testo: TX('atto5.cap3.p2.testo') },
      { tipo: 'colpo', durata: 12, zona: 'bosco',
        arrivano: { chi: 'guardia', quanti: 4, grido: TX('atto5.cap3.p3.arrivano.grido') },
        testo: TX('atto5.cap3.p3.testo') },
    ],
  },
  {
    id: 4, titolo: TX('atto5.cap4.titolo'), luogo: 'bassifondi', giver: 'fabbro',
    apertura: TX('atto5.cap4.apertura'),
    chiusura: TX('atto5.cap4.chiusura'),
    premio: 300, arma: null,
    missioni: [
      { tipo: 'consegna', zona: 'slums',
        destinatario: { chi: 'bassifondi', nome: TX('atto5.cap4.p1.destinatario.nome'),
                        dice: TX('atto5.cap4.p1.destinatario.dice') },
        testo: TX('atto5.cap4.p1.testo') },
      { tipo: 'caccia', zona: 'bosco', chi: 'guardia',
        testo: TX('atto5.cap4.p2.testo') },
      { tipo: 'consegna', luogo: 'nocchiero',
        testo: TX('atto5.cap4.p3.testo') },
    ],
  },
  // la fine della campagna: il Ciambellano preso vivo, la scena "forca"
  // (passaggi.js) prima dell'ultimo passo, e Valdarno libera
  {
    id: 5, titolo: TX('atto5.cap5.titolo'), luogo: 'castello', giver: 'briganti',
    apertura: TX('atto5.cap5.apertura'),
    chiusura: TX('atto5.cap5.chiusura'),
    premio: 500, arma: null,
    missioni: [
      { tipo: 'consegna', zona: 'nobile',
        testo: TX('atto5.cap5.p1.testo') },
      { tipo: 'cattura', luogo: 'corte', verso: 'piazza', sprite: 'MiniNobleMan',
        nome: TX('atto5.cap5.p2.nome'),
        testo: TX('atto5.cap5.p2.testo') },
      { tipo: 'consegna', luogo: 'piazza', subito: true, scena: 'forca',
        testo: TX('atto5.cap5.p3.testo') },
    ],
  },
];

// committenti dell'atto V: gli stessi nomi di Valdarno (world_abitanti.js),
// senza il Ciambellano
const GIVER_RITORNO = {
  fabbro: TX('committenti.atto5.fabbro'),
  mercante: TX('committenti.atto5.mercante'),
  nocchiero: TX('committenti.atto5.nocchiero'),
  briganti: TX('committenti.atto5.briganti'),
};
