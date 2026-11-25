// storia_costa.js — l'atto IV, la Costa saracena: i cinque capitoli e i
// committenti (13/10, dalla bozza di STORIA_BOZZE.md).
//
// Venduto al mercato, arrivi senza niente davanti al mercante che ti ha
// comprato; lavori per lui, scorti la sua carovana, vinci la corsa dei
// cammelli e con lei la liberta' (capitolo 3); da libero rubi per l'emiro le
// lettere che provano che il Ciambellano tratta coi pirati, e l'emiro ti da'
// una nave e degli uomini (la scena "rotta", passaggi.js, e l'atto V).
//
// Stessa forma dei capitoli del Fiordo (storia_fiordo.js: luogo, chi,
// subito). I tipi nuovi: `carovana` (missioni_costa.js) e la `gara` in
// cammello (missioni_luoghi.js). I luoghi: il caravanserraglio, l'oasi, la
// sala (il palazzo dell'emiro), il campo; un luogo che Missioni.luogo non
// conosce e' la piazza, lo slargo del pozzo dove sta il mercante.
//
// Segnaposto (STORIA_BOZZE.md, "Atto IV"): i testi sono le bozze, da
// riscrivere; i nomi sono di ruolo (tua scelta del 13/10); premi come
// l'atto II, la sciabola dall'emiro alla fine del capitolo 4.

const CAPITOLI_COSTA = [
  {
    id: 1, titolo: TX('atto4.cap1.titolo'), luogo: 'suk', giver: 'mercante',
    apertura: TX('atto4.cap1.apertura'),
    chiusura: TX('atto4.cap1.chiusura'),
    premio: 100, arma: null,
    missioni: [
      { tipo: 'consegna', zona: 'mercato',             // missioni_base.js
        destinatario: { chi: 'mercante', nome: TX('atto4.cap1.p1.destinatario.nome'),
                        dice: TX('atto4.cap1.p1.destinatario.dice') },
        testo: TX('atto4.cap1.p1.testo') },
      { tipo: 'riscossione', quanti: 3, zona: 'mercato',
        testo: TX('atto4.cap1.p2.testo') },
      { tipo: 'consegna', luogo: 'caravanserraglio',
        destinatario: { chi: 'carrettiere', nome: TX('atto4.cap1.p3.destinatario.nome'),
                        dice: TX('atto4.cap1.p3.destinatario.dice') },
        testo: TX('atto4.cap1.p3.testo') },
    ],
  },
  {
    id: 2, titolo: TX('atto4.cap2.titolo'), luogo: 'caravanserraglio', giver: 'mercante',
    apertura: TX('atto4.cap2.apertura'),
    chiusura: TX('atto4.cap2.chiusura'),
    // la tenda persa in catene (atto III) torna qui: attrezzatura da carovana
    // (14/10, tuo ok)
    premio: 150, arma: null, dono: 'tenda',
    missioni: [
      { tipo: 'carovana', quanti: 3, ondate: 2, chi: 'carrettiere',
        testo: TX('atto4.cap2.p1.testo') },
      { tipo: 'caccia', luogo: 'campo', chi: 'brigante',
        testo: TX('atto4.cap2.p2.testo') },
      { tipo: 'consegna', luogo: 'piazza', subito: true,
        testo: TX('atto4.cap2.p3.testo') },
    ],
  },
  {
    id: 3, titolo: TX('atto4.cap3.titolo'), luogo: 'oasi', giver: 'mercante',
    apertura: TX('atto4.cap3.apertura'),
    chiusura: TX('atto4.cap3.chiusura'),
    premio: 200, arma: null,
    missioni: [
      { tipo: 'consegna', luogo: 'oasi',
        destinatario: { chi: 'carrettiere', nome: TX('atto4.cap3.p1.destinatario.nome'),
                        dice: TX('atto4.cap3.p1.destinatario.dice') },
        testo: TX('atto4.cap3.p1.testo') },
      { tipo: 'caccia', zona: 'mercato', chi: 'brigante',
        testo: TX('atto4.cap3.p2.testo') },
      { tipo: 'gara', mezzo: 'cammello',
        testo: TX('atto4.cap3.p3.testo') },
    ],
  },
  {
    id: 4, titolo: TX('atto4.cap4.titolo'), luogo: 'palazzo', giver: 'emiro',
    apertura: TX('atto4.cap4.apertura'),
    chiusura: TX('atto4.cap4.chiusura'),
    premio: 250, arma: 'sciabola_emiro',
    missioni: [
      { tipo: 'colpo', durata: 10, luogo: 'molo', zona: 'porto',
        arriva: { chi: 'brigante', nome: TX('atto4.cap4.p1.arriva.nome'), poi: 'caravanserraglio',
                  dice: TX('atto4.cap4.p1.arriva.dice') },
        testo: TX('atto4.cap4.p1.testo') },
      { tipo: 'furto', stanza: 'taverna',
        testo: TX('atto4.cap4.p2.testo') },
      { tipo: 'consegna', luogo: 'sala', subito: true, tempo: true,   // prima che...
        testo: TX('atto4.cap4.p3.testo') },
    ],
  },
  // il finale dell'atto IV: la nave dell'emiro (la scena "rotta",
  // passaggi.js) e l'atto V, il ritorno a Valdarno
  {
    id: 5, titolo: TX('atto4.cap5.titolo'), luogo: 'palazzo', giver: 'emiro',
    apertura: TX('atto4.cap5.apertura'),
    chiusura: '',
    premio: 0, arma: null, finale: 'rotta',
    missioni: [
      // la difesa si fa a una porta di terra (missioni_luoghi.js): quella del
      // porto e' un approdo
      { tipo: 'difesa', porta: 0, ondate: 3, chi: 'brigante',
        testo: TX('atto4.cap5.p1.testo') },
      { tipo: 'caccia', luogo: 'campo', chi: 'brigante',
        testo: TX('atto4.cap5.p2.testo') },
      { tipo: 'consegna', zona: 'porto', subito: true,
        testo: TX('atto4.cap5.p3.testo') },
    ],
  },
];

// committenti dell'atto IV: nome interno → come si chiama in gioco
const GIVER_COSTA = {
  mercante: TX('committenti.atto4.mercante'),
  emiro: TX('committenti.atto4.emiro'),
};
