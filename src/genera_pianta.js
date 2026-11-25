// genera_pianta.js — una citta' nuova da un seme: PIANTE.genera(seme).
//
// Senza stile e' il borgo di fiume come Valdarno (pianta_borgo.js, dal
// 06/10): il fiume a sud, il castrum sul poggio, il borgo a palizzata; col
// seme cambiano il corso del fiume, il castrum, la palizzata, le porte.
// Prima era il borgo murato a rettangolo (_archive/20261006_genera_pianta_borgo.js).
//
// Si prova giocando con ?pianta=gen-<seme> nell'indirizzo (game.js), e il
// collaudo ne costruisce alcune e ne fotografa la carta (scena "generatore").
//
// Gli stili: PIANTE.genera(seme, 'fiordo') e' un borgo vichingo, con una
// pianta tutta sua (pianta_fiordo.js). Il 25/09 notte era questo stesso borgo
// col mare al posto del fiume e la neve: "Valdarno sotto la neve", da rifare.
// PIANTE.genera(seme, 'costa') e' la Costa saracena (pianta_costa.js, 29/09).

PIANTE.genera = function (seme, stile) {
  if (stile === 'fiordo') return PIANTE.generaFiordo(seme);
  if (stile === 'costa') return PIANTE.generaCosta(seme);
  // dal 06/10 il borgo di fiume (pianta_borgo.js), col cielo e la gente di
  // Valdarno
  return { ...PIANTE.generaBorgo(seme), ...PIANTE.DATI_VALDARNO };
};
