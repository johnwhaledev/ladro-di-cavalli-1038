// pianta_fiordo.js — un borgo vichingo da un seme: PIANTE.generaFiordo(seme),
// che PIANTE.genera(seme, 'fiordo') chiama (genera_pianta.js).
//
// Non e' Valdarno sotto la neve (tua richiesta del 25/09 notte). Dal 06/10
// (schizzo out/urbanistica_fiordo_2.png, approvato) il modello e' Hedeby: il
// borgo sta sulla riva di ponente di un'insenatura chiusa (lo Haddebyer Noor)
// che a levante si apre in un braccio di mare fino al bordo della carta: di
// li' si salpa. La palizzata a mezzaluna e' aperta verso l'acqua e le sue
// punte scendono a riva. Dentro: la via di riva coi pontili verso levante, le
// vie di assi a lisca di pesce (da ponente a levante, verso l'acqua), il
// ruscello che dallo stagno a ponente attraversa il borgo e sbocca
// nell'insenatura (due ponti), il mercato sull'arteria all'approdo, la sala
// del jarl a nord. Fuori: il thing a nord-ovest, lo hof col bosco sacro a
// sud-ovest, la nave di pietre oltre la porta sud, un tratto di vallo di terra
// a ponente. Prima (fino al 06/10) il mare stava a ponente come il fiume di
// Valdarno, e dentro c'era la croce di Valdarno col thing in mezzo.
//
// La pianta ha la stessa forma dati di Valdarno (piante.js), perche' storia,
// ronde, traffico e stanze la sanno leggere: WALL e' il riquadro che contiene
// la palizzata, GATES le sue porte (l'approdo e' sulla riva), CASTLE e CORTE
// la sala del jarl e il suo recinto, PLAZA il thing. In piu': `dentro(tx, ty)`
// (la mezzaluna), `quartiere(tx, ty)` (i quartieri dentro), `acqua(tx, ty)`
// (insenatura, braccio, ruscello, stagno), LATO_ACQUA = 1 (l'acqua a levante
// della riva: world_porto.js), MARE_LIBERO (gli scogli attorno all'acqua),
// PONTI e VALLO (world_fiordo.js), e i dati dello stile. riverCenter(y) e' la
// riva dell'insenatura meno 4,6, come per il fiume (fuori dalle sue righe -10).

PIANTE.generaFiordo = function (seme) {
  const rnd = mulberry32((seme >>> 0) ^ 0x6a09e667);
  const tra = (a, b) => a + rnd() * (b - a);
  const intero = (a, b) => Math.round(tra(a, b));
  const dentroMappa = v => Math.max(10, Math.min(WT - 10, v));

  // il nome, norreno (tirato per primo: i fiordi di prima tengono il nome)
  const PRIMA = ['Skar', 'Hald', 'Hrafn', 'Ulf', 'Sig', 'Kol', 'Tor', 'Ask', 'Brenn', 'Fjal',
                 'Hvit', 'Stein'];
  const DOPO = ['vik', 'by', 'heim', 'nes', 'stad', 'havn', 'fjord'];
  const tirato = PRIMA[intero(0, PRIMA.length - 1)] + DOPO[intero(0, DOPO.length - 1)];
  const nome = seme === 3 ? TX('nomi.fiordo') : tirato;      // il Fiordo della storia (10/11)

  // il borgo: centro della mezzaluna (cx, yc), raggio R
  const yc = intero(90, 100), R = intero(34, 40), cx = intero(92, 100);
  // l'insenatura: un'ellisse a levante, la riva di ponente 2 tile prima di cx;
  // piu' lunga della mezzaluna, cosi' le punte della palizzata arrivano a riva
  const a = intero(22, 27), b = R + intero(5, 9);
  const nx = cx + a - 2, ny = yc;
  const rivaIns = y => nx - a * Math.sqrt(Math.max(0, 1 - ((y - ny) / b) ** 2));
  // il braccio di mare, dall'insenatura al bordo di levante
  const fa = tra(5, 8), f1 = tra(0.04, 0.07), p1 = tra(0, 6.28), largo = tra(6.5, 8.5);
  const bracX = nx + a * 0.55;
  const bracY = x => ny + fa * (Math.sin((x - bracX) * f1 + p1) - Math.sin(p1));
  // il ruscello: dallo stagno a ponente fino a sboccare qualche tile a sud
  // del centro, serpeggiando (zero agli estremi)
  const ys = yc + intero(2, 5);
  const stagno = { x: cx - R - intero(18, 26), y: ys + intero(-4, 4), r: intero(4, 6) };
  const rf = tra(1.2, 2.2), rp = tra(0, 6.28);
  const xSbocco = rivaIns(ys) + 1;
  const rusY = x => {
    const t = Math.max(0, Math.min(1, (x - stagno.x) / (xSbocco - stagno.x)));
    return stagno.y + (ys - stagno.y) * t + rf * Math.sin(x * 0.17 + rp) * Math.sin(Math.PI * t);
  };
  // quanto si e' lontani dall'acqua (world.js, distAcqua): 0 nell'acqua cupa,
  // 4,6 sulla riva. Il ruscello e' basso e stretto (da 3,4 in su: mai cupo)
  const acqua = (tx, ty) => {
    let d = 4.6 + (Math.hypot((tx - nx) / a, (ty - ny) / b) - 1) * a;
    if (tx > bracX) d = Math.min(d, 4.6 + Math.abs(ty - bracY(tx)) - largo);
    if (tx >= stagno.x && tx <= xSbocco) d = Math.min(d, 3.4 + Math.abs(ty - rusY(tx)) * 1.5);
    d = Math.min(d, 4.6 + Math.hypot(tx - stagno.x, ty - stagno.y) - stagno.r);
    return Math.max(0, d);
  };
  const riverCenter = y => Math.abs(y - ny) < b ? rivaIns(y) - 4.6 : -10;

  const arcoX = y => cx - Math.sqrt(Math.max(0, R * R - (y - yc) ** 2));
  const dentro = (tx, ty) => Math.abs(ty - yc) < R && tx < rivaIns(ty) &&
    (tx >= cx || (tx - cx) ** 2 + (ty - yc) ** 2 < R * R);
  let x1 = cx;
  for (let y = yc - R; y <= yc + R; y++) x1 = Math.max(x1, Math.ceil(rivaIns(y)));
  const WALL = { x0: cx - R, x1, y0: yc - R, y1: yc + R };

  // le porte di terra sulla mezzaluna (nord, ponente, sud) e l'approdo sulla
  // riva, in fondo all'arteria che parte dalla porta di ponente
  const sulArco = gradi => {
    const g = gradi * Math.PI / 180;
    return { x: Math.round(cx + R * Math.cos(g)), y: Math.round(yc + R * Math.sin(g)) };
  };
  const pN = sulArco(262), pW = sulArco(196), pS = sulArco(98);
  const GATES = [
    { x: Math.round(rivaIns(pW.y)) - 4, y: pW.y, dir: 'E', approdo: true },
    { ...pN, dir: 'N' },
    { ...pW, dir: 'W' },
    { ...pS, dir: 'S' },
  ];

  // la sala del jarl a nord, dentro; il thing fuori, a nord-ovest
  const CORTE = { x0: cx - Math.round(R * 0.5) - 7, y0: yc - Math.round(R * 0.68) };
  CORTE.x1 = CORTE.x0 + 15; CORTE.y1 = CORTE.y0 + 14;
  const CASTLE = { x: Math.round((CORTE.x0 + CORTE.x1) / 2), y: CORTE.y0 + 6 };
  const PLAZA = { x: cx - R - 9, y: yc - Math.round(R * 0.6), r: 5 };
  // lo hof fuori a sud-ovest, la nave di pietre oltre la porta sud, la fucina
  // a sud del ruscello
  const pieve = { x: cx - R - 4, y: yc + Math.round(R * 0.72) };
  const cimitero = { x: pS.x + 4, y: pS.y + 6, w: 11, h: 5,
                     becchino: { x: pS.x + 9, y: pS.y + 13 } };
  const fucina = { x: Math.round(cx - R * 0.45), y: ys + 11 };

  // le vie di assi a lisca di pesce: una ogni 8 righe a partire dall'arteria,
  // non a ridosso del ruscello, piu' le due che lo costeggiano; da ponente
  // (la palizzata, o il recinto del jarl) fino alla via di riva
  const righe = [];
  for (let y = pW.y - 8 * 6; y <= yc + R - 6; y += 8)
    if (y >= yc - R + 6 && Math.abs(y - ys) > 6) righe.push(y);
  for (const y of [ys - 5, ys + 5])
    if (righe.every(q => Math.abs(q - y) >= 4)) righe.push(y);
  righe.sort((p, q) => p - q);
  const viaRiva = y => rivaIns(y) - 3;
  const VIE = [];
  for (const y of righe) {
    let xa = arcoX(y) + 2.5;
    if (y === pW.y) xa = pW.x - 2;                          // l'arteria passa la porta
    if (y >= CORTE.y0 - 1 && y <= CORTE.y1 + 1) xa = Math.max(xa, CORTE.x1 + 2);
    const xb = viaRiva(y);
    if (xb - xa > 6) VIE.push([Math.round(xa), y, Math.round(xb), y, y === pW.y ? 1.3 : 0.8]);
  }
  // la via di riva, a spezzoni che seguono la riva
  for (let y = yc - R + 5; y < yc + R - 5; y += 4) {
    const y2 = Math.min(y + 4, yc + R - 5);
    VIE.push([viaRiva(y), y, viaRiva(y2), y2, 1.1]);
  }
  // dalle porte di nord e di sud alla prima via, e il vicolo che passa il
  // ruscello in mezzo al borgo
  VIE.push([pN.x, pN.y, pN.x, righe[0], 1.0]);
  VIE.push([pS.x, pS.y, pS.x, righe[righe.length - 1], 1.0]);
  const xVicolo = Math.round(cx - R * 0.3);
  const rN = Math.max(...righe.filter(y => y < ys)), rS = Math.min(...righe.filter(y => y > ys));
  VIE.push([xVicolo, rN, xVicolo, rS, 0.8]);
  // i ponti sul ruscello: il vicolo e la via di riva (world_fiordo.js)
  const PONTI = [xVicolo, Math.round(viaRiva(ys))].map(x => ({ x, y: rusY(x) }));
  // un tratto di vallo di terra a ponente, a sud del ruscello: come il
  // Danevirke, ma corto (non deve tagliare in due la campagna)
  const v0 = sulArco(160);
  const VALLO = [[v0.x, v0.y], [v0.x - 12, v0.y + 4], [v0.x - 24, v0.y + 9]];
  // la prima via a sud della sala: il varco del recinto ci scende (buildRoads)
  const arteria = righe.find(y => y > CORTE.y1 + 1) || pW.y;

  const RISERVATI = [
    { x0: CORTE.x0 - 1, x1: CORTE.x1 + 1, y0: CORTE.y0 - 1, y1: CORTE.y1 + 1 },
    { x0: pieve.x - 6, x1: pieve.x + 7, y0: pieve.y - 7, y1: pieve.y + 4 },
    { x0: cimitero.x - 1, x1: cimitero.x + cimitero.w + 1,
      y0: cimitero.y - 1, y1: cimitero.y + cimitero.h + 1 },
    { x0: fucina.x - 4, x1: fucina.x + 3, y0: fucina.y - 4, y1: fucina.y + 4 },
    // il mercato sull'arteria, all'approdo: niente case, ci stanno i banchi
    { x0: GATES[0].x - 17, x1: GATES[0].x + 1, y0: pW.y - 5, y1: pW.y + 5 },
  ];

  const PORT = { x: Math.round(rivaIns(pW.y)) - 2, y: pW.y + 1 };
  const CAMP = { x: Math.max(24, cx - R - intero(30, 42)), y: dentroMappa(yc - intero(55, 70)) };
  const STRADE_CAMPAGNA = [
    [pN.x, pN.y, pN.x - 6, dentroMappa(pN.y - 20), 1.8],
    [pN.x - 6, dentroMappa(pN.y - 20), CAMP.x, CAMP.y, 1.6],
    [pW.x, pW.y, 8, pW.y - 6, 1.8],                              // la via di terra
    [pW.x - 2, pW.y, PLAZA.x + 3, PLAZA.y + 4, 1.2],             // al thing
    [pS.x, pS.y, pS.x + 6, dentroMappa(pS.y + 30), 1.8],
    [pS.x + 6, dentroMappa(pS.y + 30), dentroMappa(pS.x + 50), dentroMappa(pS.y + 24), 1.4],
    [pS.x, pS.y, pieve.x + 4, pieve.y + 3, 1.2],                 // allo hof
  ];

  // i quartieri dentro la palizzata: la riva e' il porto, le fasce a nord e a
  // sud le capanne, attorno alla sala i ricchi, il resto le case lunghe e le
  // botteghe. Fuori: campi a sud, bosco a nord e oltre l'insenatura
  const quartiere = (tx, ty) => {
    if (!dentro(tx, ty)) return null;
    if (tx > rivaIns(ty) - 8) return D.PORTO;
    if (Math.abs(ty - yc) > R * 0.62) return D.SLUMS;
    if (tx < cx - R * 0.3 + 6 && ty < ys - 6) return D.NOBILE;
    return D.MERCATO;
  };
  const QUARTIERI = { bassifondi: WALL.x0, mercato: WALL.x0, porto: { y0: yc - R + 4, y1: yc + R - 4 },
                      campi: WALL.y1 + 8, bosco: { nord: 6, est: 8 } };
  // i moli ogni 8 righe, lontani 4 dallo sbocco del ruscello
  const primoMolo = ys + 4 - 8 * Math.floor((ys + 4 - (yc - R + 8)) / 8);
  const LUOGHI = {
    pieve,
    sagrato: [pieve.x - 3, pieve.y + 2.5, pieve.x + 3, pieve.y + 2.5, 1.3],
    cimitero, fucina, arteria,
    vicoli: { x: [], y0: 0, y1: 0 },
    moli: { y0: primoMolo, passo: 8, n: Math.floor((yc + R - 8 - primoMolo) / 8) + 1 },
    croce: { x: pS.x + 10, y: dentroMappa(pS.y + 18) },
    nobili: { x0: CORTE.x0 - 2, w: 18 },
    campiNemici: [
      { tx: dentroMappa(cx - 10), ty: dentroMappa(yc - R - 40), nome: TX('nomi.campo_nord') },
      { tx: dentroMappa(nx + a + 20), ty: dentroMappa(ny - 38), nome: TX('nomi.campo_levante') },
      { tx: dentroMappa(pS.x + 52), ty: dentroMappa(pS.y + 30), nome: TX('nomi.campo_guado') },
    ],
    etichette: { bassifondi: { x: cx - Math.round(R * 0.3), y: yc - R + 5 },
                 campi: { x: pS.x + 20, y: dentroMappa(pS.y + 26) } },
  };
  const ZONE = {
    campi: [cx - 40, WALL.y1 + 10, 80, 34],
    boscaioli: [20, 8, 150, Math.max(10, yc - R - 16)],
    cacciatori: [nx + a, 8, WT - 8 - (nx + a), 170],
  };

  return {
    nome, seme, stile: 'fiordo', WALL, GATES, PLAZA, CASTLE, CORTE, VIE, RISERVATI,
    PORT, CAMP, STRADE_CAMPAGNA, riverCenter, QUARTIERI, LUOGHI, ZONE,
    dentro, quartiere, centro: { x: cx, y: yc, R }, acqua,
    LATO_ACQUA: 1, MARE_LIBERO: true, PONTI, VALLO,
    ...PIANTE.STILE_FIORDO,
  };
};

// Quello che il fiordo ha di suo oltre la forma: l'atlante, il cielo, la
// terra, la flora, le barche, le case. Nomi che l'atlante del fiordo
// (assets/fiordo/, mappe.json) conosce
PIANTE.STILE_FIORDO = {
  ATLANTE: 'assets/fiordo/',
  SUOLO: T.NEVE,
  RIVA: T.GHIAIA,
  CITTA_NEVE: true,              // dentro: neve battuta e fango, non lastricato
  PIAZZA_APERTA: true,           // il thing non si lastrica
  MEZZI: 16,                     // cavalli e carri lasciati per strada (Valdarno 44)
  INSEGNA_OSTERIA: 'insegna_corno',   // la sala dell'idromele: scudo e corno
  // gli interni vichinghi in src/stanze/fiordo/; tenda e cunicolo quelli di sempre
  STANZE: { cartella: 'fiordo', tipi: ['castello', 'chiesa', 'taverna', 'fucina', 'casa_piacere'] },
  // chi vende le armi, per le frasi della bottega (game.js, story.js)
  FABBRO: { Chi: TX('nomi.fabbro_fiordo.chi'), dove: TX('nomi.fabbro_fiordo.dove') },
  METEO: { sereno: 0.49, neve: 0.35, nebbia: 0.06, pioggia: 0.1 },   // nebbia dal 20% (06/10)
  FLORA: {
    conifere: ['pino', 'pino_b', 'abete', 'faggio_pc', 'faggio_pc_b', 'vik_abete_neve', 'vik_abetini'],
    latifoglie: ['frassino', 'frassino', 'pino', 'abete', 'vik_betulla', 'vik_albero_morto'],
    // (30/09, "in superiorita' quelli dedicati"): mucchi di neve e scogli
    // innevati al posto dei sassi e dei ceppi di Valdarno
    piccoli: ['cespuglio_neve', 'cespuglio_neve', 'mucchio_neve', 'scoglio_c', 'tronchi',
              'mucchio_neve', 'vik_ginepro'],
    suolo: ['mucchio_neve'],
    campi: ['frassino', 'pino_b', 'cespuglio_neve', 'massi'],
    scogli: ['scoglio_a', 'scoglio_b', 'scoglio_b', 'scoglio_c'],
    croce: 'pietra_runica',
  },
  // chi fa cosa (cast.js, 26/09): i tuoi vichinghi (Vik*) mischiati ai
  // generici; il clan rivale e' vichingo in rosso; i banditi sono quelli di
  // Valdarno (Ban*); la fauna del nord. Niente suore ne' pievano: allo hof la
  // veggente e il goði
  CAST: {
    monaco: ['MiniOldWoman', 'MiniOldMan'],
    // i civili vichinghi (character studio, 01/10) mischiati ai generici
    cittadino: ['VikDonna', 'VikAnziana', 'VikPescatore', 'VikContadino', 'MiniVillagerMan',
                'MiniOldMan'],
    contadino: ['VikContadino', 'VikContadino', 'MiniGatherer', 'MiniPeasant'],
    mercante: ['VikMercante', 'VikMercante', 'MiniMerchant'],
    artigiano: ['VikFabbro', 'MiniWorker'],
    gente_campi: ['VikContadino', 'VikContadino', 'MiniGatherer', 'MiniPeasant', 'MiniWorker'],
    portuale: ['VikPescatore', 'VikPescatore', 'MiniWorker', 'MiniOldMan'],
    banchista: ['VikMercante', 'VikMercante', 'VikDonna', 'VikAnziana', 'MiniWorker'],
    bassifondi: ['VikDonna', 'VikAnziana', 'MiniVillagerMan', 'MiniWorker', 'MiniThief@bruno'],
    avventore: ['VikDonna', 'VikAnziana', 'VikPescatore', 'MiniVillagerMan', 'MiniOldMan',
                'MiniWorker', 'VikCacciatore'],
    guardia: ['VikLanciere', 'VikScudiero', 'VikSpadaccino', 'VikLanciere', 'MiniSpearMan',
              'MiniShieldMan'],
    guardia_a_cavallo: ['MiniHorseMan'],
    guardia_corte: ['VikBerserker', 'VikScudiero', 'VikSpadaccino'],
    piantone: ['VikLanciere'],                 // solo lancieri (26/09)
    cacciatore: ['VikCacciatore', 'MiniHunter'],
    cacciatore_bosco: ['VikCacciatore', 'VikCacciatore', 'MiniHunter', 'MiniArcher'],
    gente_porto: ['VikPescatore', 'VikPescatore', 'VikMercante', 'MiniWorker', 'MiniVillagerMan',
                  'VikCacciatore'],
    brigante: ['BanTagliagole', 'BanTagliagole', 'BanPredone', 'BanArciere', 'BanBalestriere',
               'BanLanciere'],
    capo_briganti: ['BanCapo'],
    assassino: ['BanTagliagole', 'BanPredone', 'VikBerserker'],
    bersaglio: ['VikBerserker'],
    nemico: ['VikSpadaccino', 'VikLanciere', 'VikScudiero', 'VikBerserker', 'VikCacciatore'],
    nemico_assalto: ['VikSpadaccino', 'VikLanciere', 'VikScudiero', 'VikBerserker'],
    fauna_bosco: ['VikLupoBianco', 'VikLince', 'VikRenna', 'VikRenna', 'VikOrsoPolare',
                  'MiniWolf', 'MiniFox', 'BanCinghiale'],
    fauna_campi: ['VikCapra', 'VikCapra', 'VikRenna', 'MiniBunny'],
    uccello: ['VikCorvo', 'VikCorvo', 'MiniBird'],
    bestia: ['VikOrsoPolare'],                 // l'orso bianco dell'atto II
    duellante: ['VikBerserker', 'VikSpadaccino', 'VikScudiero'],   // l'holmgang
  },
  // i carri: quelli di sempre, niente carrozze di Valdarno (world_abitanti.js,
  // traffico.js)
  CARRI: ['carro_coperto', 'carro_merci'],
  // i campi fuori dalla palizzata (world_campagna.js, buildFields): case meta
  // del nord e pali, non fienili, staccionate e siepi di Valdarno (30/09)
  CAMPO_NEMICO: { recinto: 'palo_palizzata_c' },      // il clan rosso: pali, non staccionate
  CAMPAGNA: {
    case: ['vik_stalla', 'vik_granaio', 'vik_casa_torba', 'vik_capanna_tonda'],
    recinti: ['palo_palizzata_a', 'palo_palizzata_b', 'cespuglio_neve', 'mucchio_neve'],
  },
  // i committenti (world_abitanti.js, 29/09): quelli dell'atto II
  // (storia_fiordo.js), Ferrante con la sua bottega, e il Nocchiero che ti ha
  // portato qui. Il jarl e la veggente stanno dentro la sala e lo hof
  // (src/stanze/fiordo/, "committente"). Il pescatore e' VikPescatore (01/10,
  // tua scelta: prima il segnaposto MiniWorker)
  COMMITTENTI: [
    { chiave: 'pescatore', dove: 'molo', sprite: 'VikPescatore', flip: true },
    { chiave: 'jarl', dove: 'castello', sprite: 'VikJarl', stanza: 'castello' },
    { chiave: 'veggente', dove: 'chiesa', sprite: 'MiniOldWoman', stanza: 'chiesa' },
    // il fabbro del Fiordo (14/10, tuo ok: "almeno i nomi diversi"), non piu'
    // Ferrante: VikFabbro, nella sua forgia (stanze/fiordo/fucina.json)
    { chiave: 'fabbro', dove: 'fucina', sprite: 'VikFabbro', stanza: 'fucina',
      nome: TX('nomi.fabbro_fiordo') },
    { chiave: 'nocchiero', dove: 'porto', sprite: 'MiniOldMan' },
  ],
  // i drakkar visti dall'alto; la vela e' nel disegno, niente vela in piedi
  // dal 30/09 le navi meta senza remi (innesta_nano.py): il knarr del
  // Nocchiero, i drakkar e le barche da pesca
  BARCHE: {
    nocchiero: 'vik_knarr',
    altre: ['vik_drakkar', 'vik_pesca', 'vik_drakkar', 'vik_pesca', 'vik_knarr', 'vik_drakkar'],
    scala: 1.7, vela: null,
  },
  // Le case (30/09, tua indicazione "fiordi meglio meta"): le case meta
  // (vik_*, innesta_nano.py, LOTTI_CITTA) al posto di quelle del catalogo; al
  // porto il cantiere, il magazzino e la dogana di "Mare e porti".
  // 'edificio_taverna' e' la sala dell'idromele meta, 'casa_rossa' la
  // Lanterna Rossa del catalogo (le stanze le cercano per nome). Lo hof resta
  // del catalogo finche' non c'e' il tempio generato. Le varianti in piu' sono
  // nel lotto del 30/09 (da generare)
  CASE: {
    porto: ['vik_cantiere', 'porto_magazzino', 'porto_dogana', 'edificio_taverna', 'vik_casa_b',
            'vik_capanna_pesce', 'vik_granaio'],
    capanne: ['vik_casa_b', 'vik_stalla', 'vik_casa_lunga', 'casa_rossa', 'vik_casa_a',
              'vik_capanna_tonda', 'vik_capanna_pesce', 'vik_casa_torba'],
    lunghe: ['vik_casa_lunga', 'vik_casa_a', 'vik_casa_c', 'vik_casa_b', 'vik_stalla',
             'vik_casa_torba', 'vik_granaio'],
    ricche: ['vik_casa_c', 'vik_casa_a', 'vik_casa_lunga', 'vik_casa_ricca'],
    sala: 'vik_sala', hof: 'vik_hof',
  },
};

// il Fiordo del menu: un borgo vichingo col suo seme
PIANTE.fiordo = PIANTE.generaFiordo(1);
