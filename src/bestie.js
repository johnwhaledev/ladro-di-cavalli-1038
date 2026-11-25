// bestie.js — chi tira i carri e chi si cavalca, citta' per citta' (13/10).
//
// Fino al 09/10 ogni carro lo tirava lo stesso cavallo_mini. Ora a Valdarno
// (e nei borghi generati come lei) un carro su tre lo tira il cavallo, uno
// l'asino (BanAsino), uno il mulo col basto (BanMulo); nel Fiordo asini e
// muli; alla Costa cammelli e dromedari. Sono personaggi del pool, alla scala
// del cavallo, con le stesse animazioni (anche `death`, per la carcassa).
//
// Da cavalcare c'e' anche l'asino, a Valdarno e nel Fiordo (alla Costa
// l'atlante non lo ha): resta un mezzo di tipo 'cavallo' (si monta, si cade,
// muore come il cavallo), ma piu' lento, e in sella il ladro e' `ladro_asino`
// (build_ladro.py). Il mulo va solo ai carri (tua scelta del 13/10). Alla
// Costa si cavalcano cammelli e dromedari (13/10, tua scelta per l'atto IV):
// veloci come il cavallo, col ladro sopra la gobba (`ladro_cammello`).
//
// La bestia di un mezzo parcheggiato si sceglie dalla sua posizione, non dal
// seme del mondo: i numeri a caso del mondo restano quelli di prima, e con
// loro la firma (collaudo.py). Quella dei carri in transito e' a caso.

const Bestie = (() => {
  // [bestia, peso] dei carri, per stile di pianta (undefined = borgo di fiume)
  const TIRO = {
    borgo: [['cavallo_mini', 1], ['BanAsino', 1], ['BanMulo', 1]],
    fiordo: [['BanAsino', 1], ['BanMulo', 1]],
    costa: [['SarCammello', 1], ['SarDromedario', 1]],
  };
  // l'asino: piu' lento del cavallo (14) e del carro (11), ma meglio che a
  // piedi di corsa (8,6); la salute e' quella del cavallo (55, tua scelta).
  // Cammello e dromedario corrono come il cavallo (tua scelta)
  const ASINO = { bestia: 'BanAsino', sella: 'ladro_asino',
                  andatura: { maxSpeed: 10.5, accel: 7 } };
  const CAMMELLO = { bestia: 'SarCammello', sella: 'ladro_cammello' };
  const DROMEDARIO = { bestia: 'SarDromedario', sella: 'ladro_dromedario' };
  // [cavalcatura, parte dei cavalli parcheggiati], per stile di pianta
  const CAVALCATURE = {
    borgo: [[ASINO, 1 / 3]],
    fiordo: [[ASINO, 1 / 2]],
    costa: [[CAMMELLO, 1 / 4], [DROMEDARIO, 1 / 4]],
  };

  // per i messaggi (game.js): "L'asino e' caduto sotto di te."
  const NOMI = { BanAsino: TX('bestie.asino'), BanMulo: TX('bestie.mulo'), SarCammello: TX('bestie.cammello'),
                 SarDromedario: TX('bestie.dromedario') };
  const nome = bestia => NOMI[bestia] || TX('bestie.cavallo');

  const stile = pianta => (pianta && pianta.stile) || 'borgo';
  // una bestia che l'atlante della citta' non ha diventa il cavallo
  const presente = n => !!Assets.charDef(n);

  // 0..1 dalla posizione: sempre lo stesso per lo stesso posto
  function caso(x, z) {
    const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }

  // la bestia che tira un carro, con r fra 0 e 1
  function tiro(pianta, r) {
    const L = TIRO[stile(pianta)] || TIRO.borgo;
    let k = r * L.reduce((s, [, p]) => s + p, 0);
    for (const [b, p] of L) { k -= p; if (k < 0) return presente(b) ? b : 'cavallo_mini'; }
    return 'cavallo_mini';
  }

  // la cavalcatura di un cavallo parcheggiato, con r fra 0 e 1 (null: resta
  // il cavallo)
  function cavalcatura(pianta, r) {
    for (const [c, quota] of CAVALCATURE[stile(pianta)] || []) {
      if (r < quota) return presente(c.sella) ? c : null;
      r -= quota;
    }
    return null;
  }

  // i mezzi parcheggiati del mondo (world_abitanti.js, buildSpawns): ai carri
  // la bestia, a una parte dei cavalli l'asino o il cammello. Le barche no.
  function assegna(spawns, pianta) {
    for (const s of spawns) {
      if (s.type === 'carro') s.bestia = tiro(pianta, caso(s.x, s.z));
      else if (s.type === 'cavallo') Object.assign(s, cavalcatura(pianta, caso(s.z, s.x)));
    }
  }

  // un cammello o un dromedario da cavalcare (la corsa dell'atto IV)
  const cammello = v => v.type === 'cavallo' && (v.sella === CAMMELLO.sella ||
                                                  v.sella === DROMEDARIO.sella);

  return { tiro, assegna, caso, nome, cammello, TIRO, CAVALCATURE, ASINO, CAMMELLO,
           DROMEDARIO };
})();
