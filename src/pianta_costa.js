// pianta_costa.js — una citta' della Costa saracena da un seme:
// PIANTE.generaCosta(seme), che PIANTE.genera(seme, 'costa') chiama (29/09).
//
// Non e' Valdarno sotto la sabbia. Dal 06/10 (schizzo
// out/urbanistica_costa_2.png, approvato) il modello e' Mahdia, girata verso
// nord: la citta' sta su un promontorio col mare su tre lati, e la chiude una
// cinta sola, il muro di terra sul collo, che si vede di fronte con la sua
// porta. Il porto e' scavato nel fianco di ponente, un bacino con
// l'imboccatura sul mare aperto; la casba del palazzo dell'emiro sta in
// punta; la moschea grande dove si incrociano le due vie, con lo slargo del
// pozzo davanti e il suk attorno; nei quartieri i vicoli finiscono contro un
// muro. Fuori, sulla terraferma: il cimitero oltre la porta, i giardini a
// sud, il palmeto, l'oasi, i pirati sulla costa a ponente. Prima (fino al
// 06/10) era una medina rettangolare col mare a ponente, come il fiume di
// Valdarno.
//
// La pianta ha la stessa forma dati di Valdarno (piante.js): WALL e' il
// riquadro del promontorio, GATES le porte (la prima e' quella del porto, un
// approdo; l'altra la porta di terra), CASTLE e CORTE il palazzo e la casba,
// PLAZA lo slargo del pozzo, LUOGHI.pieve il hammam, LUOGHI.cimitero il
// cimitero. In piu' `dentro(tx, ty)` (la citta' sul promontorio),
// `quartiere(tx, ty)` (medina, suk, casba, porto), `acqua(tx, ty)` (mare,
// bacino, oasi), MOSCHEA, MURO (il muro di terra), OASI, MARE_LIBERO (gli
// scogli attorno all'acqua), e i dati dello stile. riverCenter(y) e' la riva
// del bacino meno 4,6, come per il fiume (i moli, world_porto.js), fuori
// dalle sue righe -10.

PIANTE.generaCosta = function (seme) {
  const rnd = mulberry32((seme >>> 0) ^ 0x3c6ef372);
  const tra = (a, b) => a + rnd() * (b - a);
  const intero = (a, b) => Math.round(tra(a, b));
  const dentroMappa = v => Math.max(10, Math.min(WT - 10, v));

  // il nome, arabo di fantasia (tirato per primo: le coste di prima tengono il
  // nome; Qasr Tamar e' la tua proposta, da confermare)
  const PRIMA = ['Qasr', 'Bab', 'Dar', 'Ras', 'Suq', 'Marsa'];
  const DOPO = ['Tamar', 'al-Bahr', 'Zarqa', 'al-Nakhl', 'Hamra', 'al-Rimal'];
  const tirato = PRIMA[intero(0, PRIMA.length - 1)] + ' ' + DOPO[intero(0, DOPO.length - 1)];
  const nome = seme === 5 ? TX('nomi.costa') : tirato;       // la Costa della storia (10/11)

  // la terraferma a sud della costa; il promontorio verso nord, dalla punta
  // (yT) al collo (yN, dove sta il muro di terra), largo 2*Wb nel mezzo
  const xc = intero(78, 90), cy0 = intero(118, 126);
  const fb = tra(2, 4), fc = tra(1, 2), f1 = tra(0.03, 0.06), f2 = tra(0.09, 0.14);
  const p1 = tra(0, 6.28), p2 = tra(0, 6.28), p3 = tra(0, 6.28);
  const costa = x => cy0 + fb * Math.sin(x * f1 + p1) + fc * Math.sin(x * f2 + p2);
  const yT = intero(40, 48), yN = cy0 - intero(4, 7);
  const Wb = intero(24, 29), Wn = intero(15, 18);
  const largo = y => {
    if (y < yT) return 0;
    if (y < yT + 14) return Wb * Math.sqrt((y - yT) / 14);
    if (y < yN - 12) return Wb + 1.2 * Math.sin(y * 0.3 + p3);
    if (y < yN) return Wb - (Wb - Wn) * (y - (yN - 12)) / 12;
    return Wn + (y - yN) * 2.5;
  };
  // il porto scavato: un bacino nel fianco di ponente, nel tratto largo, con
  // un molo di 3 tile verso il mare e l'imboccatura in mezzo
  const by1 = yN - 14, by0 = by1 - intero(17, 20);
  const bx0 = xc - Wb + 3, bx1 = bx0 + intero(9, 11);
  const yBocca = Math.round((by0 + by1) / 2);
  const bacino = (tx, ty) => tx >= bx0 && tx <= bx1 && ty >= by0 && ty <= by1;
  const bocca = (tx, ty) => tx >= xc - Wb - 3 && tx < bx0 && Math.abs(ty - yBocca) <= 1.5;
  const OASI = { x: dentroMappa(xc + intero(44, 56)), y: dentroMappa(cy0 + intero(18, 28)),
                 r: intero(5, 7) };
  // quanto si e' lontani dall'acqua (world.js, distAcqua): 0 nell'acqua cupa,
  // 4,6 sulla riva. Il bacino e l'imboccatura hanno il bordo basso
  const acqua = (tx, ty) => {
    const oasi = Math.hypot(tx - OASI.x, ty - OASI.y) - OASI.r + 3.4;
    if (bacino(tx, ty) || bocca(tx, ty)) {
      const d = bacino(tx, ty) ? Math.min(tx - bx0, bx1 - tx, ty - by0, by1 - ty)
                               : 1.5 - Math.abs(ty - yBocca);
      return Math.max(0, 3.6 - d);
    }
    const dx = Math.abs(tx - xc) - largo(ty);             // > 0: fuori dal promontorio
    const dy = costa(tx) - ty;                            // > 0: a nord della costa
    if ((dx > 0 || ty < yT) && dy > 0) {                  // in mare (oltre la punta tutto)
      const dP = ty < yT ? Math.hypot(tx - xc, yT - ty) : dx;
      return Math.max(0, Math.min(4.6 - Math.min(dP, dy), oasi));
    }
    // a terra: dal mare, e dal bacino
    let d = dy > 0 ? -dx : (dx < 0 ? Math.hypot(dx, dy) : -dy);
    const bdx = Math.max(bx0 - tx, 0, tx - bx1), bdy = Math.max(by0 - ty, 0, ty - by1);
    d = Math.min(d, Math.hypot(bdx, bdy) - 1);
    return Math.max(0, Math.min(4.6 + d, oasi));
  };
  const riverCenter = y => y >= by0 && y <= by1 ? bx1 + 1 - 4.6 : -10;

  const WALL = { x0: xc - Wb - 2, x1: xc + Wb + 2, y0: yT, y1: yN };
  const dentro = (tx, ty) => ty >= yT && ty < yN && Math.abs(tx - xc) < largo(ty) - 0.5 &&
    acqua(tx, ty) >= 5.2;

  // la casba in punta; la moschea dove si incrociano le vie, a meta' fra la
  // casba e il muro, dentro il suo anello di vie; lo slargo del pozzo davanti
  const CORTE = { x0: xc - 8, x1: xc + 9, y0: yT + 6 };
  CORTE.y1 = CORTE.y0 + 19;
  const CASTLE = { x: Math.round((CORTE.x0 + CORTE.x1) / 2), y: CORTE.y0 + 7 };
  const yM = Math.round((CORTE.y1 + yN) / 2) - 2;
  const MOSCHEA = { x: xc, y: yM + 2 };
  const anello = { x0: xc - 6, x1: xc + 6, y0: yM - 7, y1: yM + 3 };
  const yE = yM - 2;                                      // la via da ponente a levante
  const yPorto = Math.max(by0 + 2, Math.min(by1 - 2, yE)); // dove la via tocca il bacino
  const PLAZA = { x: xc, y: anello.y1 + 5, r: 4 };

  // le porte: quella del porto (un approdo, sulla riva del bacino: la prima,
  // come la porta del mare di prima) e la porta di terra nel muro, di fronte
  const GATES = [
    { x: bx1 + 3, y: yPorto, dir: 'W', approdo: true },
    { x: xc, y: yN, dir: 'S' },
  ];

  // Le vie: le due grandi, un po' storte, che si fermano all'anello attorno
  // alla moschea; l'anello; poi i vicoli ciechi ("derb"): partono dalle vie
  // grandi, piegano, mettono un ramo e finiscono contro un muro
  const VIE = [];
  const storto = (xa, ya, xb, yb, w, tratti) => {
    let x = xa, y = ya;
    for (let k = 1; k <= tratti; k++) {
      const u = k / tratti;
      const nx = xa + (xb - xa) * u + (k < tratti ? intero(-1, 1) : 0);
      const ny = ya + (yb - ya) * u + (k < tratti ? intero(-1, 1) : 0);
      VIE.push([x, y, nx, ny, w]);
      x = nx; y = ny;
    }
  };
  storto(xc, yN, xc, anello.y1, 2.0, 3);                  // dalla porta di terra
  storto(xc, anello.y0, xc, CORTE.y1 + 1, 1.8, 2);        // alla casba
  storto(bx1 + 2, yPorto, anello.x0, yE, 1.8, 3);         // dal porto
  storto(anello.x1, yE, Math.round(xc + largo(yE) - 3), yE, 1.6, 3);   // alla marina
  VIE.push([anello.x0, anello.y0, anello.x1, anello.y0, 1.0],
           [anello.x0, anello.y1, anello.x1, anello.y1, 1.0],
           [anello.x0, anello.y0, anello.x0, anello.y1, 1.0],
           [anello.x1, anello.y0, anello.x1, anello.y1, 1.0]);
  const vietato = (x, y) => (x >= CORTE.x0 - 2 && x <= CORTE.x1 + 2 && y <= CORTE.y1 + 2) ||
    (x >= anello.x0 - 2 && x <= anello.x1 + 2 && y >= anello.y0 - 2 && y <= anello.y1 + 2) ||
    (x >= bx0 - 2 && x <= bx1 + 3 && y >= by0 - 2 && y <= by1 + 2) || y >= yN - 3 ||
    Math.abs(x - xc) > largo(y) - 3;
  const derb = (x, y, dx, dy, lungo) => {
    let n = 0;
    while (n < lungo && !vietato(x + dx * (n + 1), y + dy * (n + 1))) n++;
    if (n < 4) return;
    const fine = [x + dx * n, y + dy * n];
    storto(x, y, fine[0], fine[1], 0.7, 2);
    const m = Math.round(n * 0.6), r = intero(3, 5) * (rnd() < 0.5 ? -1 : 1);
    const mx = x + dx * m, my = y + dy * m;
    let k = 0;
    while (k < Math.abs(r) && !vietato(mx + dy * Math.sign(r) * (k + 1), my + dx * Math.sign(r) * (k + 1))) k++;
    if (k >= 2) VIE.push([mx, my, mx + dy * Math.sign(r) * k, my + dx * Math.sign(r) * k, 0.6]);
  };
  // dalla via di terra e da quella della casba, a ponente e a levante
  for (let y = CORTE.y1 + 4; y < yN - 3; y += 6) {
    if (y >= anello.y0 - 2 && y <= anello.y1 + 2) continue;
    derb(xc - 2, y, -1, 0, intero(9, 15));
    derb(xc + 2, y + 2, 1, 0, intero(9, 15));
  }
  // dalla via del porto e da quella della marina, a nord e a sud
  for (let x = xc - Wb + 4; x <= xc + Wb - 4; x += 7) {
    if (x >= anello.x0 - 2 && x <= anello.x1 + 2) continue;
    derb(x, yE - 2, 0, -1, intero(8, 12));
    derb(x + 2, yE + 2, 0, 1, intero(8, 12));
  }

  // il hammam vicino alla moschea, la forgia (i fabbri) vicino alla porta di
  // terra, il cimitero fuori dalla porta, sulla terraferma a levante della via
  const pieve = { x: xc + 9, y: PLAZA.y + 3 };
  const fucina = { x: xc - 9, y: yN - 6 };
  const cimitero = { x: xc + 5, y: Math.round(costa(xc + 10)) + 4, w: 10, h: 6,
                     becchino: { x: xc + 11, y: Math.round(costa(xc + 10)) + 11 } };
  const RISERVATI = [
    { x0: CORTE.x0 - 1, x1: CORTE.x1 + 1, y0: CORTE.y0 - 1, y1: CORTE.y1 + 1 },
    { x0: anello.x0 + 1, x1: anello.x1 - 1, y0: anello.y0 + 1, y1: anello.y1 - 1 },
    { x0: pieve.x - 4, x1: pieve.x + 5, y0: pieve.y - 5, y1: pieve.y + 3 },
    { x0: fucina.x - 4, x1: fucina.x + 3, y0: fucina.y - 4, y1: fucina.y + 4 },
    { x0: PLAZA.x - PLAZA.r - 1, x1: PLAZA.x + PLAZA.r + 1,
      y0: PLAZA.y - PLAZA.r - 1, y1: PLAZA.y + PLAZA.r + 1 },
  ];
  // il muro di terra: da mare a mare sul collo (world_costa.js)
  const MURO = { y: yN, x0: Math.floor(xc - largo(yN)) - 2, x1: Math.ceil(xc + largo(yN)) + 2 };

  // il porto: sulla riva del bacino; i pirati sulla costa a ponente
  const PORT = { x: bx1 + 3, y: yBocca };
  const campoX = dentroMappa(xc - intero(46, 56));
  const CAMP = { x: campoX, y: Math.round(costa(campoX)) + 7 };
  const terra = { x: xc, y: Math.round(costa(xc)) + 3 };
  const STRADE_CAMPAGNA = [
    [xc, yN, terra.x, terra.y, 2.0],
    [terra.x, terra.y, xc + 2, dentroMappa(cy0 + 32), 1.8],
    [terra.x, terra.y, OASI.x - OASI.r - 3, OASI.y, 1.6],
    [terra.x, terra.y, CAMP.x, CAMP.y, 1.5],
    [xc + 2, dentroMappa(cy0 + 32), dentroMappa(xc + 50), dentroMappa(cy0 + 46), 1.4],
  ];

  // i quartieri sul promontorio: la casba in punta (NOBILE), il porto
  // attorno al bacino, il suk lungo le vie grandi vicino alla moschea, il
  // resto medina (SLUMS). Fuori decide world.js: i giardini a sud, il palmeto
  // a levante
  const quartiere = (tx, ty) => {
    if (!dentro(tx, ty)) return null;
    if (tx >= CORTE.x0 - 3 && tx <= CORTE.x1 + 3 && ty <= CORTE.y1 + 3) return D.NOBILE;
    if (tx <= bx1 + 6 && ty >= by0 - 4 && ty <= by1 + 4) return D.PORTO;
    if (Math.hypot(tx - xc, ty - yM) < 18 && (Math.abs(tx - xc) <= 4 || Math.abs(ty - yE) <= 4))
      return D.MERCATO;
    return D.SLUMS;
  };
  // sulla terraferma i giardini cominciano piu' a sud: fra la costa e i
  // giardini il palmeto a levante (con l'oasi) e le dune a ponente (i pirati)
  const QUARTIERI = { bassifondi: WALL.x0, mercato: CORTE.x0, porto: { y0: by0, y1: by1 },
                      campi: cy0 + 34, bosco: { nord: 6, est: 8 } };
  const LUOGHI = {
    pieve,
    sagrato: [pieve.x - 2, pieve.y + 2.5, pieve.x + 2, pieve.y + 2.5, 1.2],
    cimitero, fucina,
    arteria: anello.y0,             // dal varco della casba la via scende all'anello
    vicoli: { x: [], y0: 0, y1: 0 },               // i vicoli sono in VIE, ciechi
    moli: { y0: by0 + 3, passo: 5, n: Math.floor((by1 - by0 - 6) / 5) + 1 },
    croce: { x: xc + 18, y: dentroMappa(cy0 + 20) },
    nobili: { x0: CORTE.x0 - 2, w: CORTE.x1 - CORTE.x0 + 2 },
    campiNemici: [
      { tx: dentroMappa(xc + 70), ty: dentroMappa(cy0 + 8), nome: TX('nomi.campo_predoni') },
      { tx: dentroMappa(xc + 60), ty: dentroMappa(cy0 + 50), nome: TX('nomi.campo_pozzo') },
      { tx: dentroMappa(xc - 30), ty: dentroMappa(cy0 + 50), nome: TX('nomi.campo_dune') },
    ],
    etichette: { bassifondi: { x: xc - 14, y: PLAZA.y + 4 },
                 campi: { x: xc + 10, y: dentroMappa(cy0 + 44) } },
  };
  const ZONE = {
    campi: [xc - 40, cy0 + 36, 80, 30],
    boscaioli: [xc + 30, cy0 + 4, 60, 50],
    cacciatori: [xc + 20, cy0 + 4, 80, 60],
  };

  return {
    nome, seme, stile: 'costa', WALL, GATES, PLAZA, CASTLE, CORTE, VIE, RISERVATI,
    PORT, CAMP, OASI, STRADE_CAMPAGNA, riverCenter, QUARTIERI, LUOGHI, ZONE,
    dentro, quartiere, acqua, MOSCHEA, MURO, MARE_LIBERO: true,
    ...PIANTE.STILE_COSTA,
  };
};

// Quello che la Costa ha di suo oltre la forma: l'atlante, il cielo, la
// terra, la flora, le barche, le case, la gente. Nomi che l'atlante della
// costa (assets/costa/, mappe.json) conosce. Prima passata mia, da curare:
// la scelta dei pezzi e' tua
PIANTE.STILE_COSTA = {
  ATLANTE: 'assets/costa/',
  SUOLO: T.SABBIA,
  RIVA: T.SABBIA,
  CITTA_SABBIA: true,            // dentro: terra battuta e sabbia, lastricate le vie
  VESTE_LADRO: '@beige',         // il protagonista si veste di beige (29/09, entities.js)
  // fuori dalle mura (world_campagna.js, buildFields): case di terra come
  // quelle della medina, e muretti a secco e giare al posto di staccionate e
  // siepi (29/09: "anche le case fuori le mura restano stile saraceno")
  // al porto niente edifici meta di "Mare e porti" (legno del nord): la Costa
  // tiene i legacy (world_porto.js, buildPort)
  PORTO_CASE: [],
  CARRI: ['carro_coperto', 'carro_merci'],   // niente carrozze di Valdarno
  // i campi dei predoni (world_campagna.js): muretti a secco, non staccionate
  CAMPO_NEMICO: { recinto: 'muretto' },
  CAMPAGNA: {
    case: ['edifici_deserto_23', 'edifici_deserto_24', 'edifici_deserto_27',
           'edifici_deserto_31'],
    recinti: ['muretto', 'muretto', 'props_deserto_12', 'props_deserto_19', 'rocce_palme_17'],
  },
  MEZZI: 20,
  INSEGNA_OSTERIA: 'botteghe_11',     // sul caravanserraglio lo stendardo, non il boccale
  // i committenti (world_abitanti.js): dell'atto IV il mercante che ti compra
  // al mercato (09/10: si arriva a piedi davanti a lui) e l'emiro nel suo
  // palazzo (13/10, storia_costa.js: sta nella stanza, castello.json);
  // Ferrante con la bottega. Il capo dei pirati sta al suo campo
  // (world_campagna.js)
  COMMITTENTI: [
    // l'armaiolo saraceno (14/10, tuo ok: "almeno i nomi diversi"): la sua
    // bottega e' stanze/costa/fucina.json; il nome e' suo, non di Ferrante
    { chiave: 'fabbro', dove: 'fucina', sprite: 'SarScimitarra', stanza: 'fucina',
      nome: TX('nomi.armaiolo') },
    { chiave: 'mercante', dove: 'piazza', sprite: 'SarMercante' },
    { chiave: 'emiro', dove: 'castello', sprite: 'SarEmiro', stanza: 'castello' },
  ],
  // gli interni saraceni in src/stanze/costa/ (il palazzo dell'emiro, il
  // hammam, il caravanserraglio); fucina e Lanterna Rossa quelle di Valdarno
  STANZE: { cartella: 'costa', tipi: ['castello', 'chiesa', 'taverna', 'fucina'] },
  // chi vende le armi, per le frasi della bottega (game.js, story.js)
  FABBRO: { Chi: TX('nomi.armaiolo.chi'), dove: TX('nomi.armaiolo.dove') },
  // sole quasi sempre, la pioggia rarissima (tua indicazione del 29/09; il
  // 25/09 sera "temporali rari"); niente neve, niente nebbia
  METEO: { sereno: 0.95, pioggia: 0.03, temporale: 0.02 },
  FLORA: {
    densita: 0.35,               // la macchia di palme e' rada, non un bosco
    conifere: ['rocce_palme_07', 'rocce_palme_08', 'rocce_palme_10'],        // palme
    latifoglie: ['rocce_palme_11', 'rocce_palme_12', 'rocce_palme_16', 'rocce_palme_09'],
    // (30/09, "in superiorita' quelli dedicati"): niente sassi ed erba di
    // Valdarno; il suolo del deserto resta nudo
    piccoli: ['rocce_palme_17', 'rocce_palme_18', 'rocce_palme_19', 'rocce_palme_16'],
    suolo: [],
    campi: ['rocce_palme_07', 'rocce_palme_12', 'rocce_palme_16', 'rocce_palme_08'],
    scogli: ['rocce_palme_03', 'rocce_palme_05', 'rocce_palme_06', 'rocce_palme_15'],
    croce: 'rocce_palme_10',     // nei campi, al posto della croce: una palma sola
  },
  // le barche: quelle di Valdarno (scafi con la vela), senza BARCHE
  // le case (world_costa.js): basse di calce e terra nella medina, piu'
  // grandi e con la cupola verso la piazza, le botteghe del suk, la casba.
  // 'edificio_taverna', 'casa_rossa' ed 'edificio_bottega' sono il
  // caravanserraglio, la Lanterna Rossa e la forgia (le stanze e le osterie
  // li cercano per nome): rinominati in mappe.json, voce "nomi"
  CASE: {
    medina: ['edifici_deserto_23', 'edifici_deserto_24', 'edifici_deserto_27',
             'edifici_deserto_31', 'casa_rossa', 'edificio_taverna'],
    suk: ['edifici_deserto_30', 'edifici_deserto_32', 'edifici_deserto_34',
          'edifici_deserto_31', 'edificio_taverna'],
    casba: ['edifici_deserto_05', 'edifici_deserto_30', 'edifici_deserto_26'],
    porto: ['edifici_deserto_24', 'edifici_deserto_23', 'edifici_deserto_31'],
    // quanti ce ne possono essere: a Valdarno le osterie sono 18 su un borgo
    // grande; qui, senza tetto, i caravanserragli venivano 25
    massimi: { edificio_taverna: 5, casa_rossa: 3 },
    palazzo: 'edifici_deserto_02', hammam: 'edifici_deserto_05',
    moschea: 'edifici_deserto_04',     // la cupola col minareto (06/10, tua scelta)
    bancarelle: ['botteghe_04', 'botteghe_05', 'botteghe_06', 'botteghe_07', 'botteghe_08',
                 'botteghe_15', 'botteghe_16', 'botteghe_17'],
    mura: ['strutture_difese_02', 'strutture_difese_03'], torre: 'strutture_difese_04',
    muretto: 'strutture_difese_05',
  },
  // Chi fa cosa (cast.js): i saraceni (Sar*) di guardia, i pirati (Pir*)
  // fanno i banditi (deciso il 25/09 sera), i predoni del deserto sono il
  // "clan rivale" in rosso. I civili saraceni (character studio, 01/10:
  // SarMercante, SarDonna, SarVelata, SarAnziana, SarNobildonna, SarAnziano,
  // SarContadino) mischiati
  // ai generici, come deciso il 26/09
  CAST: {
    monaco: ['MiniOldMan', 'MiniMage'],             // il hammam
    cittadino: ['SarDonna', 'SarVelata', 'SarAnziana', 'SarMercante', 'SarAnziano',
                'MiniVillagerMan'],
    contadino: ['SarContadino', 'SarContadino', 'MiniGatherer'],
    gente_campi: ['SarContadino', 'SarContadino', 'MiniGatherer', 'SarAnziano'],
    operaio: ['SarContadino', 'MiniWorker'],
    mercante: ['SarMercante', 'SarMercante', 'MiniSuspiciousMerchant'],
    nobile: ['SarNobildonna', 'MiniNobleMan'],
    nobile_corte: ['SarNobildonna', 'SarNobildonna', 'MiniNobleMan'],
    portuale: ['SarMercante', 'MiniWorker', 'MiniOldMan', 'MiniVillagerMan'],
    gente_porto: ['SarMercante', 'MiniWorker', 'MiniOldMan', 'MiniVillagerMan'],
    carrettiere: ['SarMercante', 'MiniWorker', 'MiniVillagerMan', 'MiniPeasant'],
    banchista: ['SarMercante', 'SarMercante', 'SarDonna', 'SarVelata', 'SarAnziana', 'MiniWorker'],
    bassifondi: ['SarDonna', 'SarVelata', 'SarAnziana', 'SarAnziano', 'SarContadino',
                 'MiniWorker', 'MiniThief@bruno'],
    avventore: ['SarMercante', 'SarDonna', 'SarAnziana', 'SarVelata', 'SarAnziano',
                'SarContadino', 'MiniWorker'],
    guardia: ['SarLanciere', 'SarScimitarra', 'SarScudo', 'SarLanciere'],
    guardia_a_cavallo: ['SarCavaliere'],
    guardia_corte: ['SarScimitarra', 'SarScudo', 'SarLanciere'],
    piantone: ['SarLanciere'],
    becchino: ['MiniOldMan'],
    brigante: ['PirSciabola', 'PirSciabola', 'PirArpioniere', 'PirCannoniere', 'PirNostromo',
               'PirMozzo'],
    capo_briganti: ['PirCapitano'],
    assassino: ['PirSciabola', 'SarPredone', 'MiniThief@bruno'],
    bersaglio: ['SarPredone'],
    nemico: ['SarPredone', 'SarScimitarra', 'SarLanciere', 'SarScudo'],
    nemico_assalto: ['SarPredone', 'SarScimitarra', 'SarLanciere', 'SarScudo'],
    fauna_bosco: ['SarFennec', 'SarIena', 'SarOrice', 'SarOrice', 'MiniBunny'],
    fauna_campi: ['SarDromedario', 'SarCammello', 'MiniBunny'],
    uccello: ['SarFalco', 'MiniBird'],
    bestia: ['SarLeone'],                              // la bestia da cacciare
    duellante: ['SarScimitarra', 'SarScudo', 'SarLanciere'],
    cacciatore_bosco: ['MiniHunter', 'MiniArcher', 'MiniHunter'],
  },
};
