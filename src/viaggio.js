// viaggio.js — il cambio di citta' a partita avviata (voci F e O).
//
// Una citta' si chiama con una chiave: 'valdarno', 'fiordo' (la prova di
// piante.js), 'gen-<seme>' (un borgo generato), 'fiordo-<seme>' (un fiordo
// generato), 'costa-<seme>' (una citta' della Costa saracena, 29/09).
// La stessa chiave sta nell'indirizzo (?pianta=...) e nel
// salvataggio, cosi' "Continua" riporta nella citta' in cui si e' salvato.
//
// Partire: l'atlante dell'altra citta' (Assets.load), il suo mondo (World),
// le stanze (Interni.carica), il renderer sul mondo nuovo (Gfx.cambiaMondo),
// la carta (Hud.mondo), il cielo (Meteo.init). Lo stato di game.js legato al
// mondo (gente, carri, assalti, incarico in corso) lo rimette game.js
// (nuovoMondo). La storia non si tocca: soldi, arsenale, capitolo e taglia
// restano; l'incarico in corso riparte dal committente, come dopo un
// caricamento. La tenda piantata torna nello zaino.
//
// La storia (campagna.js) dice dove si va: dalla barca al largo si salpa
// verso la citta' dell'atto in corso, con una scena di passaggio (passaggi.js)
// mentre dietro il velo si carica il mondo nuovo.

const Viaggio = (() => {
  // la pianta di una chiave (quella ignota e' Valdarno), con la chiave addosso
  function pianta(chiave) {
    // la nave in prova (nave.js) parte dal Fiordo, dove i pirati svernano
    if (chiave === 'nave') return pianta('fiordo-3');
    const m = /^(gen|fiordo|costa)-(\d+)$/.exec(chiave || '');
    if (m) return { ...PIANTE.genera(Number(m[2]), m[1] === 'gen' ? undefined : m[1]), chiave };
    const nota = chiave && typeof PIANTE[chiave] === 'object';
    const p = nota ? PIANTE[chiave] : PIANTE.valdarno;
    p.chiave = nota ? chiave : 'valdarno';
    return p;
  }

  // la citta' dell'indirizzo della pagina
  function daIndirizzo() {
    return pianta(new URLSearchParams(location.search).get('pianta'));
  }

  // il mondo di un'altra citta', pronto: atlante, generazione, stanze, resa
  async function parti(chiave) {
    const p = pianta(chiave);
    await Assets.load(p.ATLANTE || 'assets/');
    const w = new World(p.seme || 20260917, p);
    await Interni.carica(w);
    Gfx.cambiaMondo(w);
    Hud.mondo(w);
    Meteo.init(p);
    return w;
  }

  // Il viaggio vero (27/09): si esce da una citta' in barca, arrivando per
  // acqua al bordo della carta (a Valdarno il fiume a nord o a sud, nel
  // fiordo il mare), e si arriva al porto della seguente. Al largo: sull'acqua
  // a meno di MARGINE dal bordo
  const MARGINE = 14;
  function alLargo(w, x, z) {
    const N = w.solidN, S = w.solidS;
    const cx = Math.floor(x / S), cy = Math.floor(z / S);
    if (cx < 0 || cy < 0 || cx >= N || cy >= N || w.solid[cy * N + cx] !== 2) return false;
    const L = N * S;
    return x < MARGINE || z < MARGINE || x > L - MARGINE || z > L - MARGINE;
  }

  // dove si arriva: la barca del Nocchiero, ormeggiata al primo molo che ne
  // ha una (world_porto.js, buildPort)
  function approdo(vehicles) {
    return vehicles.find(v => v.type === 'barca') || null;
  }

  return { pianta, daIndirizzo, parti, alLargo, approdo };
})();
