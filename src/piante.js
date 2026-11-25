// piante.js — la pianta di ogni citta' come dato: cinta, porte, piazza,
// castello, vie, strade di campagna, fiume. World(seed, pianta) la legge da
// this.pianta; il resto del gioco da world.pianta. Tutte le misure sono in
// tile (TILE unita' di mondo l'una, v. world.js).
//
// Dal 06/10 Valdarno e i borghi generati sono il borgo di fiume
// (pianta_borgo.js); la pianta di prima e' in _archive/20261006_piante_valdarno.js.

const PIANTE = {};

// Il cielo e la gente di Valdarno (e dei borghi generati, che li prendono
// da qui): la pianta e' il borgo di fiume del 06/10, pianta_borgo.js
PIANTE.DATI_VALDARNO = (() => {
  // il tempo che fa (meteo.js): probabilita' di ogni tempo a ogni cambio.
  // Il Fiordo avra' la neve, la Costa saracena i temporali rari
  // (06/10: la nebbia dal 18% al 5%, "c'e' sempre troppa nebbia")
  const METEO = { sereno: 0.63, pioggia: 0.22, nebbia: 0.05, temporale: 0.1 };

  // chi fa cosa (cast.js): i banditi di Valdarno (Ban*, 26/09) mischiati ai
  // ladri generici, il loro capo a cavallo; cinghiali e mastini nel bosco,
  // asini e muli nei campi. Il resto sono i ruoli di sempre
  const BANDITI = ['BanTagliagole', 'BanTagliagole', 'BanPredone', 'BanArciere',
                   'BanBalestriere', 'BanLanciere', 'MiniThief@bruno', 'MiniOldManWarrior'];
  const CAST = {
    brigante: BANDITI,
    capo_briganti: ['BanCapo'],
    assassino: ['BanTagliagole', 'BanPredone', 'MiniThief@bruno', 'MiniOldManWarrior'],
    fauna_bosco: ['MiniWolf', 'MiniBoar', 'BanCinghiale', 'MiniFox', 'MiniDeer1', 'MiniDeer2',
                  'MiniBunny', 'BanMastino'],
    fauna_campi: ['MiniBunny', 'MiniFox', 'MiniDeer1', 'BanAsino', 'BanMulo'],
  };
  return { METEO, CAST };
})();

// Il Fiordo (PIANTE.fiordo) e' un borgo vichingo generato: sta in
// pianta_fiordo.js. Dal 25/09 sera al 25/09 notte era questa pianta con
// l'atlante del Fiordo, "Valdarno sotto la neve"
