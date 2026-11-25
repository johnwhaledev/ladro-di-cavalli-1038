// pianta_borgo.js — il borgo di fiume da un seme: PIANTE.generaBorgo(seme).
// Valdarno e i borghi generati (PIANTE.genera(seme), genera_pianta.js) dal
// 06/10 (schizzo out/urbanistica_valdarno_2.png, variante C, approvata).
//
// Il modello e' un borgo toscano del 1038 ai piedi del castello: il fiume
// corre da levante a ponente a sud; il borgo sale dalla riva al poggio, dove
// sta il castrum di pietra (la corte del signore, con la torre, dentro, e le
// case dei nobili); il borgo sotto e' chiuso da una palizzata su terrapieno,
// con tre porte (del fiume, di ponente, di levante) e la porta del castello
// fra borgo e castrum. La via maestra viene dal ponte, passa la porta del
// fiume, si allarga nel mercatale davanti alla pieve e sale al castello; una
// via da ponente a levante la incrocia al mercatale. I bassifondi stanno a
// ponente, verso il porto; a levante, dentro la palizzata, orti e vigne. Il
// porto e' sulla riva nord, a ponente del ponte; di la' dal fiume i campi e
// il Campo del Guado; a nord e a levante il bosco dei briganti.
//
// La pianta ha la stessa forma dati delle altre (piante.js): WALL e' il
// riquadro di borgo e castrum, GATES le porte della palizzata (la prima
// quella di ponente), PLAZA il mercatale, CASTLE e CORTE la torre e la sua
// corte. In piu': CASTRUM (il rettangolo di pietra e la sua porta),
// PALIZZATA (la spezzata), PONTE, `dentro(tx, ty)`, `quartiere(tx, ty)`,
// `acqua(tx, ty)` (il fiume), LATO_ACQUA = 'S' (world_porto.js: i moli
// scendono nel fiume; LUOGHI.moli.y0 e QUARTIERI.porto contano lungo la
// riva, cioe' in x), ORTI. riverCenter(x) e' la mezzeria del fiume in y.

PIANTE.generaBorgo = function (seme) {
  const rnd = mulberry32((seme >>> 0) ^ 0x510e527f);
  const tra = (a, b) => a + rnd() * (b - a);
  const intero = (a, b) => Math.round(tra(a, b));
  const dentroMappa = v => Math.max(10, Math.min(WT - 10, v));

  // il fiume, da levante a ponente; la riva nord e' a riverCenter(x) - 4,6
  const cyR = intero(150, 156), fa = tra(2.5, 4.5), fb = tra(1, 2);
  const f1 = tra(0.03, 0.05), f2 = tra(0.09, 0.13), p1 = tra(0, 6.28), p2 = tra(0, 6.28);
  const riverCenter = x => cyR + fa * Math.sin(x * f1 + p1) + fb * Math.sin(x * f2 + p2);
  const riva = x => riverCenter(x) - 4.6;
  const acqua = (tx, ty) => Math.abs(ty - riverCenter(tx));

  // il ponte e la via maestra; il castrum sul poggio, la corte dentro
  const xP = intero(86, 96);
  const xC = xP + intero(-2, 6);
  // mezza larghezza multipla di 3: la porta del castello cade sul passo delle
  // campate (buildCinta), se no ai suoi lati restavano due buchi (tua foto, 06/10)
  const CW = 3 * intero(6, 7), CH = intero(36, 40);
  const CASTRUM = { x0: xC - CW, x1: xC + CW, y0: intero(44, 50) };
  CASTRUM.y1 = CASTRUM.y0 + CH;
  const CORTE = { x0: xC - 8, x1: xC + 8, y0: CASTRUM.y0 + 5 };
  CORTE.y1 = CORTE.y0 + 20;
  const CASTLE = { x: xC, y: CORTE.y0 + 8 };
  CASTRUM.porta = { x: xC, y: CASTRUM.y1 };

  // la palizzata: dall'angolo sud-ovest del castrum giu' a ponente, lungo la
  // riva (a 9 tile: in mezzo il porto) e su a levante fino all'angolo sud-est
  const j = () => tra(-1.5, 1.5);
  const ovest = xP - intero(36, 40), est = xP + intero(34, 38);
  const sud = x => riva(x) - 9;
  const PALIZZATA = [
    [CASTRUM.x0, CASTRUM.y1],
    [CASTRUM.x0 - intero(10, 14), CASTRUM.y1 + 4 + j()],
    [ovest + 2, CASTRUM.y1 + intero(12, 16)],
    [ovest + j(), sud(ovest) - intero(8, 12)],
    [ovest + 8, sud(ovest + 8)],
    [xP - 12, sud(xP - 12)],
    [xP + 12, sud(xP + 12)],
    [est - 8, sud(est - 8) - 2],
    [est + j(), sud(est) - intero(10, 14)],
    [est - 2, CASTRUM.y1 + intero(12, 16)],
    [CASTRUM.x1 + intero(10, 14), CASTRUM.y1 + 4 + j()],
    [CASTRUM.x1, CASTRUM.y1],
  ].map(([x, y]) => [Math.round(x), Math.round(y)]);
  const nelBorgo = (tx, ty) => {
    let d = false;
    for (let i = 0, k = PALIZZATA.length - 1; i < PALIZZATA.length; k = i++) {
      const [xi, yi] = PALIZZATA[i], [xk, yk] = PALIZZATA[k];
      if ((yi > ty) !== (yk > ty) && tx < (xk - xi) * (ty - yi) / (yk - yi) + xi) d = !d;
    }
    return d;
  };
  const nelCastrum = (tx, ty) => tx >= CASTRUM.x0 && tx < CASTRUM.x1 &&
                                 ty >= CASTRUM.y0 && ty < CASTRUM.y1;
  const dentro = (tx, ty) => nelBorgo(tx, ty) || nelCastrum(tx, ty);
  // la y della palizzata a una x data, sul lato sud (la prima da sud in su)
  const bordoSud = x => {
    let y = riva(x);
    while (y > CASTRUM.y1 && !nelBorgo(x, y)) y -= 0.5;
    return Math.floor(y);
  };
  const bordoOvest = y => { let x = ovest - 4; while (x < xP && !nelBorgo(x, y)) x += 0.5; return Math.round(x); };
  const bordoEst = y => { let x = est + 4; while (x > xP && !nelBorgo(x, y)) x -= 0.5; return Math.round(x); };

  // il mercatale all'incrocio della via maestra con la via di ponente-levante
  const yT = CASTRUM.y1 + intero(17, 21);
  const PLAZA = { x: xP, y: yT, r: 5 };
  const GATES = [
    { x: bordoOvest(yT), y: yT, dir: 'W' },
    { x: xP, y: bordoSud(xP), dir: 'S' },
    { x: bordoEst(yT + 2), y: yT + 2, dir: 'E' },
  ];
  const [gW, gS, gE] = GATES;
  // il ponte: la mezzeria sul fiume, da riva a riva (lungo 40 unita')
  const PONTE = { x: xP, y: riverCenter(xP) };

  // la pieve guarda il mercatale da nord-est, il cimitero accanto; la fucina
  // nei bassifondi; gli orti e le vigne a levante, fra la via e la palizzata
  const pieve = { x: xP + 11, y: yT - 4 };
  const cimitero = { x: pieve.x + 6, y: pieve.y - 5, w: 6, h: 6,
                     becchino: { x: pieve.x + 9, y: pieve.y + 2 } };
  const ORTI = { x0: xP + 14, x1: est - 1, y0: yT + 7, y1: sud(est - 8) - 1 };
  const yBassi = yT + intero(10, 13);
  const fucina = { x: ovest + intero(12, 16), y: yBassi + 3 };

  // Le vie (lastricate dentro, VIE: [x0, y0, x1, y1, semilarghezza]). La via
  // maestra a spezzoni: dalla porta del fiume al mercatale, dal mercatale
  // alla porta del castello, dentro il castrum fino alla corte (buildRoads)
  const VIE = [
    [xP, gS.y, xP, yT, 2.2],
    [xP, yT, xP + Math.round((xC - xP) / 2), Math.round((yT + CASTRUM.y1) / 2), 2.0],
    [xP + Math.round((xC - xP) / 2), Math.round((yT + CASTRUM.y1) / 2), xC, CASTRUM.y1, 2.0],
    [gW.x, yT, gE.x, gE.y, 2.0],                                  // ponente-levante
    [bordoOvest(CASTRUM.y1 + 7) + 3, CASTRUM.y1 + 7, bordoEst(CASTRUM.y1 + 7) - 3,
     CASTRUM.y1 + 7, 1.4],                                        // sotto il castrum
    [bordoOvest(yBassi) + 3, yBassi, xP - 3, yBassi, 1.4],        // i bassifondi
    [xP + 3, yBassi, ORTI.x0 - 2, yBassi, 1.2],
    [CASTRUM.x0 + 3, CASTRUM.y1 - 5, CASTRUM.x1 - 3, CASTRUM.y1 - 5, 1.2],   // i nobili
    [xP + 10, CASTRUM.y1 + 9, xP + 10, yT - 2, 1.0],
  ];
  // i vicoli dei bassifondi, da nord a sud fino alla palizzata
  const xv = [ovest + 7, ovest + 13, xP - 14];
  const vicoli = { x: xv, y0: yT + 3, y1: Math.min(...xv.map(x => bordoSud(x))) - 3 };

  const RISERVATI = [
    { x0: CORTE.x0 - 1, x1: CORTE.x1 + 1, y0: CORTE.y0 - 1, y1: CORTE.y1 + 1 },
    { x0: pieve.x - 5, x1: cimitero.x + cimitero.w + 1, y0: cimitero.y - 1, y1: pieve.y + 4 },
    { x0: fucina.x - 4, x1: fucina.x + 3, y0: fucina.y - 4, y1: fucina.y + 4 },
    { x0: ORTI.x0, x1: ORTI.x1, y0: ORTI.y0, y1: ORTI.y1 },
  ];

  // il porto sulla riva nord, a ponente del ponte: cinque moli (contati
  // lungo la riva, in x), fra la palizzata e il fiume
  const moli = { y0: xP - 44, passo: 6, n: 5 };
  const PORT = { x: xP - 30, y: Math.round(riva(xP - 30)) - 2 };
  const CAMP = { x: dentroMappa(CASTRUM.x1 + intero(34, 46)), y: intero(18, 28) };
  const sottoPonte = Math.ceil(riverCenter(xP) + 5.6);
  const STRADE_CAMPAGNA = [
    [gS.x, gS.y, gS.x, Math.floor(riva(xP)) - 1, 2.0],             // al ponte
    // sul ponte: sull'acqua non si stampa, ma i carri (traffico.js) ci passano
    [xP, Math.floor(riva(xP)) - 1, xP, sottoPonte, 2.0],
    [gS.x, gS.y + 1, moli.y0, Math.round(riva(moli.y0)) - 3, 1.6],  // al porto
    [xP, sottoPonte, xP + 4, 172, 1.8],                             // di la' dal fiume
    [xP + 4, 172, dentroMappa(xP + 54), 166, 1.4],
    [gW.x, gW.y, 8, gW.y + 6, 1.8],                                 // la via di ponente
    [gE.x, gE.y, dentroMappa(gE.x + 40), gE.y + 6, 1.8],            // la via di levante
    [gE.x + 12, gE.y + 2, CAMP.x, CAMP.y, 1.6],                     // al bosco
    [gW.x - 4, gW.y, CASTRUM.x0 - 10, CASTRUM.y0 - 10, 1.4],        // a nord
  ];

  // i quartieri: dentro il castrum i nobili; nel borgo a ponente i
  // bassifondi, gli orti a levante (FUORI: non si costruisce), il resto
  // mercato e botteghe. Fuori: il porto fra la palizzata e il fiume, i campi
  // di la' dal fiume e a ponente, il bosco a nord e a levante
  const nellOrto = (tx, ty) => tx >= ORTI.x0 && tx <= ORTI.x1 && ty >= ORTI.y0 && ty <= ORTI.y1;
  const quartiere = (tx, ty) => {
    if (nelCastrum(tx, ty)) return D.NOBILE;
    if (nelBorgo(tx, ty)) {
      if (nellOrto(tx, ty)) return D.FUORI;
      return tx < xP - 12 ? D.SLUMS : D.MERCATO;
    }
    if (ty > riverCenter(tx)) return D.CAMPI;
    if (tx >= moli.y0 - 4 && tx <= xP - 6 && ty > sud(tx) && ty < riva(tx)) return D.PORTO;
    if (ty < CASTRUM.y0 - 4 || tx > est + 10) return D.BOSCO;
    if (tx < ovest - 10 && ty > CASTRUM.y1) return D.CAMPI;
    return D.FUORI;
  };

  let x0 = CASTRUM.x0, x1 = CASTRUM.x1, y1 = CASTRUM.y1;
  for (const [x, y] of PALIZZATA) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const WALL = { x0, x1, y0: CASTRUM.y0, y1 };
  const QUARTIERI = { bassifondi: xP - 12, mercato: CASTRUM.x0,
                      porto: { y0: moli.y0 - 2, y1: xP - 8 },          // lungo la riva, in x
                      campi: Math.ceil(riverCenter(xP)) + 6, bosco: { nord: 4, est: 10 } };
  const LUOGHI = {
    pieve,
    sagrato: [pieve.x - 3, pieve.y + 2.5, pieve.x + 3, pieve.y + 2.5, 1.6],
    cimitero, fucina,
    arteria: CASTRUM.y1,               // dalla corte la via scende alla porta del castello
    vicoli, moli,
    croce: { x: xP + 10, y: dentroMappa(sottoPonte + 10) },
    nobili: { x0: CASTRUM.x0 + 2, w: CASTRUM.x1 - CASTRUM.x0 - 4 },
    campiNemici: [
      { tx: dentroMappa(CASTRUM.x0 - 34), ty: dentroMappa(CASTRUM.y0 - 22), nome: TX('nomi.campo_nord') },
      { tx: dentroMappa(est + 44), ty: dentroMappa(gE.y + 4), nome: TX('nomi.campo_levante') },
      { tx: dentroMappa(xP + 50), ty: dentroMappa(sottoPonte + 18), nome: TX('nomi.campo_guado') },
    ],
    etichette: { bassifondi: { x: ovest + 10, y: yBassi + 5 },
                 campi: { x: xP - 30, y: dentroMappa(sottoPonte + 14) } },
  };
  const ZONE = {
    campi: [20, sottoPonte + 4, 150, 30],
    boscaioli: [est + 10, 8, 60, 110],
    cacciatori: [est + 4, 8, 70, 120],
  };

  return {
    nome: TX('nomi.borgo_generato', { seme }), seme, WALL, GATES, PLAZA, CASTLE, CORTE, VIE, RISERVATI,
    PORT, CAMP, STRADE_CAMPAGNA, riverCenter, QUARTIERI, LUOGHI, ZONE,
    CASTRUM, PALIZZATA, PONTE, ORTI, dentro, quartiere, acqua, LATO_ACQUA: 'S',
  };
};

// Valdarno: il borgo del seme 5 (tua scelta fra otto carte, 06/10), col suo
// nome, il cielo e la gente. Senza `seme`: il mondo resta quello del seme di
// sempre (World, 20260917)
PIANTE.valdarno = (() => {
  const { seme, ...p } = PIANTE.generaBorgo(5);
  return { ...p, nome: TX('nomi.valdarno'), ...PIANTE.DATI_VALDARNO };
})();
