// cast.js — chi fa cosa in ogni citta': i personaggi per ruolo (26/09).
//
// Prima i nomi stavano sparsi in game.js, world_abitanti.js,
// world_campagna.js e traffico.js, tutti di Valdarno. Ora ci sono i
// personaggi delle altre aree (character studio: Vik vichinghi, Ban banditi,
// Sar saraceni, Pir pirati), e ogni citta' li mischia ai generici che vanno
// bene dappertutto, senza quelli fuori posto (tua indicazione del 26/09).
//
// Qui i ruoli coi personaggi di Valdarno, che valgono dove una pianta non
// dice altro; una pianta sovrascrive i ruoli che vuole in `CAST` (piante.js,
// pianta_fiordo.js). Un ruolo e' una lista da cui si pesca: un nome ripetuto
// esce piu' spesso. I banditi ci sono in tutte le citta' tranne il mare e la
// Costa saracena, dove fanno la loro parte i pirati; le altre fazioni sono
// gli stessi sprite con un'altra divisa (<nome>@rosso, prepara_varianti.py).

const CAST_VALDARNO = {
  // la gente che gira (game.js, i passanti)
  cittadino: ['MiniVillagerMan', 'MiniVillagerWoman', 'MiniOldMan', 'MiniOldWoman'],
  mercante: ['MiniMerchant', 'MiniSuspiciousMerchant'],
  guardia: ['MiniSpearMan', 'MiniHalberdMan', 'MiniShieldMan', 'MiniCrossBowMan', 'MiniArcher'],
  guardia_a_cavallo: ['MiniHorseMan', 'MiniCavalierMan'],
  nobile: ['MiniNobleMan', 'MiniNobleWoman'],
  ladro: ['MiniThief@bruno'],
  contadino: ['MiniPeasant', 'MiniPeasant', 'MiniGatherer', 'MiniBerry'],
  operaio: ['MiniWorker', 'MiniWorker', 'MiniGatherer'],
  portuale: ['MiniWorker', 'MiniVillagerMan', 'MiniOldMan', 'MiniMerchant'],
  monaco: ['MiniNun'],
  artigiano: ['MiniWorker'],
  assassino: ['MiniThief@bruno', 'MiniOldManWarrior'],
  cacciatore: ['MiniHunter'],
  boscaiolo: ['MiniLumberjack', 'MiniLumberjack', 'MiniGatherer'],
  fauna_bosco: ['MiniWolf', 'MiniBoar', 'MiniFox', 'MiniDeer1', 'MiniDeer2', 'MiniBunny'],
  fauna_campi: ['MiniBunny', 'MiniFox', 'MiniDeer1'],
  uccello: ['MiniBird'],
  // chi abita un posto (world_abitanti.js)
  banchista: ['MiniMerchant', 'MiniSuspiciousMerchant', 'MiniWorker', 'MiniVillagerWoman',
              'MiniOldWoman', 'MiniGatherer'],
  avventore: ['MiniVillagerMan', 'MiniVillagerWoman', 'MiniOldMan', 'MiniOldWoman', 'MiniNun',
              'MiniNobleWoman', 'MiniWorker'],
  guardia_corte: ['MiniHalberdMan', 'MiniShieldMan', 'MiniSpearMan'],
  nobile_corte: ['MiniNobleMan', 'MiniNobleWoman', 'MiniPrinceMan', 'MiniPrincess'],
  principessa: ['MiniPrincess'],
  principe: ['MiniPrinceMan'],
  becchino: ['MiniGraveDigger'],
  bassifondi: ['MiniVillagerMan', 'MiniVillagerWoman', 'MiniOldMan', 'MiniOldWoman',
               'MiniWorker', 'MiniWorker', 'MiniThief@bruno', 'MiniMiner'],
  gente_porto: ['MiniOldMan', 'MiniWorker', 'MiniMerchant', 'MiniVillagerMan', 'MiniHunter'],
  gente_campi: ['MiniPeasant', 'MiniPeasant', 'MiniGatherer', 'MiniWorker', 'MiniBerry',
                'MiniOldMan'],
  boscaiolo_fisso: ['MiniLumberjack'],
  cacciatore_bosco: ['MiniHunter', 'MiniArcher', 'MiniCrossBowMan'],
  brigante: ['MiniThief@bruno', 'MiniThief@bruno', 'MiniOldManWarrior', 'MiniSwordMan', 'MiniArcher'],
  capo_briganti: ['MiniThief@bruno'],
  piantone: ['MiniSpearMan'],                // solo lancieri (26/09)
  // i guerrieri dei campi nemici, a cui va la divisa rossa (world_campagna.js,
  // game.js): i tipi, senza @rosso
  nemico: ['MiniSwordMan', 'MiniSpearMan', 'MiniShieldMan', 'MiniHalberdMan', 'MiniArcher',
           'MiniCrossBowMan', 'MiniThief'],
  // chi assalta il borgo: soldati, non vecchi ne' ladri (game.js)
  nemico_assalto: ['MiniSwordMan', 'MiniSpearMan', 'MiniShieldMan', 'MiniHalberdMan', 'MiniArcher',
                   'MiniCrossBowMan'],
  bersaglio: ['MiniOldManWarrior'],         // la caccia del capitolo 2
  bestia: ['MiniBear'],                     // la bestia da cacciare (missioni.js)
  // lo sfidante di un duello nel cerchio: solo armi da mischia (missioni.js)
  duellante: ['MiniSwordMan', 'MiniShieldMan', 'MiniHalberdMan', 'MiniOldManWarrior'],
  carrettiere: ['MiniVillagerMan', 'MiniWorker', 'MiniOldMan', 'MiniPeasant', 'MiniMerchant'],
};

// i personaggi di un ruolo nella citta' di una pianta
function castDi(pianta, ruolo) {
  return (pianta && pianta.CAST && pianta.CAST[ruolo]) || CAST_VALDARNO[ruolo];
}
