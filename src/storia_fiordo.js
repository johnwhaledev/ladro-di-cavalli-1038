// storia_fiordo.js — l'atto II, il Fiordo: i cinque capitoli e i committenti
// (29/09, dalla bozza di STORIA_BOZZE.md).
//
// Arrivi ladro e straniero, ti guadagni un posto col lavoro onesto e col
// coraggio, e proprio quando ti accettano l'uomo del jarl ti vende ai pirati.
// Stessa forma dei capitoli di Valdarno (story.js); i tipi nuovi stanno in
// missioni.js e missioni_luoghi.js. In piu' due campi:
//   luogo   un posto preciso della citta' (Missioni.luogo): la sala (l'uscio),
//           il recinto (fuori dal varco), il thing, lo hof, il campo nemico
//   chi     il ruolo (cast.js) di chi c'e' nell'incarico; rosso: in divisa rossa
//   subito  il passo parte appena chiuso il precedente, senza tornare dal
//           committente: e' il passo che porta da lui (lo scudo, la pelle)
//
// Segnaposto (STORIA_BOZZE.md, "Segnaposto dell'atto II"): i nomi sono di
// ruolo finche' non confermi i tuoi (Orm, Ketil Mezzamano), i premi, gli
// sprite dei committenti (world_abitanti.js, COMMITTENTI di pianta_fiordo.js).

const CAPITOLI_FIORDO = [
  {
    id: 1, titolo: TX('atto2.cap1.titolo'), luogo: 'porto', giver: 'pescatore',
    apertura: TX('atto2.cap1.apertura'),
    chiusura: TX('atto2.cap1.chiusura'),
    premio: 100, arma: null,
    missioni: [
      { tipo: 'consegna', luogo: 'recinto',
        tempo: true, destinatario: { chi: 'cittadino', nome: TX('atto2.cap1.p1.destinatario.nome'),
          dice: TX('atto2.cap1.p1.destinatario.dice') },
        testo: TX('atto2.cap1.p1.testo') },
      { tipo: 'gara', mezzo: 'barca',
        testo: TX('atto2.cap1.p2.testo') },
      { tipo: 'consegna', zona: 'porto',
        destinatario: { dice: TX('atto2.cap1.p3.destinatario.dice') },
        testo: TX('atto2.cap1.p3.testo') },
    ],
  },
  {
    id: 2, titolo: TX('atto2.cap2.titolo'), luogo: 'bosco', giver: 'pescatore',
    apertura: TX('atto2.cap2.apertura'),
    chiusura: TX('atto2.cap2.chiusura'),
    premio: 150, arma: null,
    missioni: [
      { tipo: 'caccia', zona: 'porto', chi: 'brigante',
        testo: TX('atto2.cap2.p1.testo') },
      { tipo: 'scorta', zona: 'bosco', quanti: 2, verso: 'porto',
        testo: TX('atto2.cap2.p2.testo') },
      { tipo: 'difesa', porta: 0, ondate: 2, chi: 'brigante',
        testo: TX('atto2.cap2.p3.testo') },
    ],
  },
  {
    id: 3, titolo: TX('atto2.cap3.titolo'), luogo: 'thing', giver: 'jarl',
    apertura: TX('atto2.cap3.apertura'),
    chiusura: TX('atto2.cap3.chiusura'),
    premio: 200, arma: null,
    missioni: [
      { tipo: 'consegna', luogo: 'thing',
        testo: TX('atto2.cap3.p1.testo') },
      { tipo: 'duello', luogo: 'thing',
        testo: TX('atto2.cap3.p2.testo') },
      { tipo: 'consegna', luogo: 'sala', subito: true,
        testo: TX('atto2.cap3.p3.testo') },
    ],
  },
  {
    id: 4, titolo: TX('atto2.cap4.titolo'), luogo: 'bosco', giver: 'veggente',
    apertura: TX('atto2.cap4.apertura'),
    chiusura: TX('atto2.cap4.chiusura'),
    premio: 250, arma: null,
    missioni: [
      { tipo: 'bestia', zona: 'bosco',
        testo: TX('atto2.cap4.p1.testo') },
      { tipo: 'consegna', luogo: 'hof', subito: true,
        testo: TX('atto2.cap4.p2.testo') },
      { tipo: 'gara', mezzo: 'barca',
        testo: TX('atto2.cap4.p3.testo') },
    ],
  },
  // il finale dell'atto II: il tradimento dell'uomo del jarl (la scena
  // "prezzo", passaggi.js) e l'atto III, in catene
  {
    id: 5, titolo: TX('atto2.cap5.titolo'), luogo: 'palizzata', giver: 'jarl',
    apertura: TX('atto2.cap5.apertura'),
    chiusura: '',
    premio: 0, arma: null, finale: 'prezzo',
    missioni: [
      { tipo: 'difesa', porta: 1, ondate: 3,
        testo: TX('atto2.cap5.p1.testo') },
      { tipo: 'caccia', luogo: 'campo', rosso: true,
        testo: TX('atto2.cap5.p2.testo') },
      { tipo: 'consegna', luogo: 'sala', subito: true,
        testo: TX('atto2.cap5.p3.testo') },
    ],
  },
];

// committenti dell'atto II: nome interno → come si chiama in gioco
const GIVER_FIORDO = {
  pescatore: TX('committenti.atto2.pescatore'),
  jarl: TX('committenti.atto2.jarl'),
  veggente: TX('committenti.atto2.veggente'),
};
