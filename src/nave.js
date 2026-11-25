// nave.js — la nave pirata dell'atto III: la stiva e il ponte, e il ladro in
// catene.
//
// La nave non e' una citta': sono due stanze di interni.js (src/stanze/nave/),
// caricate in ogni citta'. Il mondo intorno resta quello da cui si e' saliti a
// bordo, fermo come sempre mentre si e' dentro. Si sale a bordo da
// __game.debug.nave() o da ?pianta=nave (menu "Citta' (prova)" del titolo, il
// Fiordo dietro).
//
// La stiva e' una stanza coi muri: se ne esce dalla botola, il vano in fondo.
// Il ponte (07/10, tua scelta: "ponte vero visto dall'alto") e' una stanza con
// "mare": niente pavimento ne' pareti, il ponte della galea (nave_ponte) steso
// sul mare, che scorre da prua a poppa; la scia, i remi che vogano, l'albero
// con la vela in piedi, la luce dell'ora del giorno. Disegno e luce li chiede
// interni.js; dove si cammina lo dice la stanza ("calpestabile"). Dal ponte
// si scende con E sulla grata.
//
// In catene: niente colpi (i ferri ai polsi). Per la prova la passerella a
// poppa rimette a terra, nel punto da cui si e' saliti, senza catene.
//
// I testi qui sono di servizio (segnaposto): quelli della storia stanno in
// bozza in STORIA_BOZZE.md, "Atto III".

const Nave = (() => {
  // dove ti svegli: al banco dei remi rimasto libero, fra i rematori
  const RISVEGLIO = { tipo: 'stiva', cella: [5, 4] };
  // le mani del ladro: ai ferri, libere ma senza un'arma (dal passo 3 al
  // passo 4: la sciabola sta nella cabina, missioni_nave.js) o armate
  let catene = false, maniNude = false;

  // la "porta" da dare a Interni.entra: il punto del mondo e' dove si torna
  function imbarco(x, z) { return { x, z, ...RISVEGLIO }; }

  // ---- il ponte sul mare
  const TILE_MARE = 4;            // una tile del mare e' una tile di terreno
  const CADENZA = 2.4;            // secondi per una palata
  const COLPO = 0.42;             // radianti: quanto va avanti e indietro un remo
  const REMO = 6.0, DENTRO = 1.0; // lunghezza del remo, quanto sta dentro la murata
  const OGNI = 0.09;              // secondi fra uno sbuffo di schiuma e l'altro
  // la scia a poppa: sbuffi larghi che vivono 2,6 s e si allungano; l'onda di
  // prua (08/10, tua foto: "cosa sono quei segni?", erano due comete staccate
  // dallo scafo): sbuffi piccoli nati sulla punta, che si aprono a V lungo i
  // fianchi della prua (a 40-50 gradi, come lo scafo) e svaniscono in 1,3 s
  const SCIA = { vita: 2.6, allunga: 1.2 }, ONDA = { vita: 1.3, allunga: 0.4 };
  let schiume = [], ultimo = null, acc = 0;

  // M: la voce "mare" della stanza, in celle; O: l'angolo della stanza
  function disegnaPonte(s, time, O) {
    const M = s.mare, C = s.C;
    const X = c => O.x + c * C, Z = k => O.z + k * C;
    const cx = X(M.centro[0]), cz = Z(M.centro[1]);
    const v = M.velocita;

    // il mare scorre verso poppa (ponente): ogni tile tiene la sua variante
    // mentre passa, cosi' l'acqua si muove e non lampeggia
    const corsa = time * v, passo = Math.floor(corsa / TILE_MARE);
    const resto = corsa - passo * TILE_MARE;
    const giu = { y: -0.3 };
    for (let k = -10; k <= 10; k++)
      for (let i = -15; i <= 15; i++) {
        const n = i + passo;
        const variante = (((n * 7 + k * 13) % 4) + 4) % 4;
        Gfx.drawWorldSpriteGround('mare_' + variante, cx + i * TILE_MARE - resto,
                                  cz + k * TILE_MARE, -Math.PI / 2, giu);
      }

    // la schiuma: la scia a poppa e l'onda che la prua apre sui fianchi;
    // ogni sbuffo va col mare, si allunga e si stringe fino a sparire
    const dt = ultimo === null ? 0 : Math.min(0.1, Math.max(0, time - ultimo));
    ultimo = time;
    for (const q of schiume) { q.t += dt; q.x -= v * dt; q.z += q.vz * dt; }
    schiume = schiume.filter(q => q.t < q.tipo.vita);
    acc += dt;
    while (acc > OGNI) {
      acc -= OGNI;
      schiume.push({ tipo: SCIA, x: X(M.poppa), z: cz + (Math.random() - 0.5) * M.largo / 2,
                     vz: 0, ang: 0, t: 0, w: 2.5 + Math.random() * 2 });
      // l'apertura cambia un poco a ogni sbuffo: dritta sembrava due fili
      for (const lato of [-1, 1]) {
        const vz = lato * v * (0.8 + Math.random() * 0.35);
        schiume.push({ tipo: ONDA, x: X(M.prua) - 0.4, z: cz + lato * 0.3, vz,
                       ang: Math.atan2(vz, -v), t: 0, w: 1.6 + Math.random() * 1.0 });
      }
    }
    for (const q of schiume) {
      const k = 1 - q.t / q.tipo.vita;
      Gfx.drawWorldSpriteGround('schiuma', q.x, q.z, q.ang, {
        y: -0.2, wu: q.w * 0.6 * k, hu: q.w * (0.8 + q.tipo.allunga * (1 - k)) });
    }

    // i remi: escono dalle murate fra "da" e "a", vogano insieme; il manico
    // sta dentro (sotto il ponte), la pala fuori sull'acqua
    const R = M.remi, th = Math.sin(time * 2 * Math.PI / CADENZA) * COLPO;
    for (let j = 0; j < R.n; j++) {
      const x = X(R.da + (R.a - R.da) * (j + 0.5) / R.n);
      for (const [k, lato] of [[R.nord, -1], [R.sud, 1]]) {
        const dx = -Math.sin(th), dz = lato * Math.cos(th);     // verso la pala
        const off = REMO / 2 - DENTRO;
        Gfx.drawWorldSpriteGround('remo', x + dx * off, Z(k) + dz * off,
                                  Math.atan2(-dz, -dx), { y: -0.1 });
      }
    }

    // il ponte, a quota zero come i pavimenti delle stanze: la gente ci sta sopra
    Gfx.drawWorldSpriteGround(M.ponte, cx, cz, 0, { y: 0 });
  }

  // l'albero con la vela, in piedi sul suo piede (dopo l'arredo: e' il piu' alto)
  function disegnaAlbero(s, O) {
    const M = s.mare;
    Gfx.drawWorldSprite(M.albero, O.x + M.piede[0] * s.C, O.z + M.piede[1] * s.C,
                        { shadowAlpha: 0.5 });
  }

  // all'aperto: la luce dell'ora del giorno (ambiente.js), piu' le lanterne
  function ambiente(ora, luci) {
    return { ...envAt(ora), lights: luci };
  }

  return {
    imbarco, disegnaPonte, disegnaAlbero, ambiente,
    banco: RISVEGLIO.cella,      // il tuo posto al remo (la chiave, missioni_nave.js)
    incatena() { catene = true; maniNude = false; },
    sciogli() { catene = false; maniNude = true; },      // passo 3: i ferri aperti
    arma() { maniNude = false; },                        // passo 4: la sciabola
    libera() { catene = false; maniNude = false; },
    // al risveglio nella stiva (game.js, inNave): dal passo 4 (capitolo 3,
    // contato da 0) i ferri sono gia' aperti
    alRisveglio(cap) { if (cap >= 3) this.sciogli(); else this.incatena(); },
    get inCatene() { return catene; },
    // perche' non si colpisce (game.js, playerAttack), o null
    get senzaArmi() { return catene ? this.testi.ceppi : (maniNude ? this.testi.maniNude : null); },
    // la prova dal menu del titolo: ?pianta=nave
    get daIndirizzo() { return new URLSearchParams(location.search).get('pianta') === 'nave'; },
    testi: {
      ceppi: TX('nave.ceppi'),
      maniNude: TX('nave.mani_nude'),
      obiettivo: 'Atto III (prova): in catene sulla nave',
      aTerra: 'Prova finita: sei a terra, senza catene.',
      prova: 'Prova della nave: la botola in fondo alla stiva porta sul ponte; '
             + 'sul ponte, E sulla grata per tornare giù, E alla passerella per scendere a terra.',
    },
  };
})();
