// tenda.js — la tenda del ladro (G): premio del capitolo 1, con il pugnale.
//
// Una sola. Si pianta dove vuoi FUORI dalle mura e si riprende, tenendo
// premuto T come si forza la cassa di un campo: una barra, e se qualcuno ti
// vede (una guardia, o un nemico a dodici passi) le mani si fermano e si
// ricomincia. Piantata ha un uscio: dentro (src/stanze/tenda.json, una stanza
// di interni.js) si riposa fino al mattino e si salva la partita.
//
// La tenda si disegna a ogni fotogramma come i mezzi, non e' un prop del
// mondo: niente chunk da rifare e la firma del mondo non cambia. Non e'
// solida (ci si passa attraverso, come i carri fermi).

const Tenda = (() => {
  const RICHIESTO = 4;            // secondi di lavoro, per piantarla e per riprenderla
  const VICINO = 4;               // da quanto vicino si riprende
  const MARGINE = 3;              // tile oltre la cinta in cui ancora non si pianta
  const stato = { posseduta: false, piantata: null };   // piantata: {x, z}
  const lavoro = { cosa: null, prog: 0, richiesto: RICHIESTO, visto: false };
  let ctx = null;                 // {world, player, occhi(x, z), say}
  let porta = null;               // l'uscio in Interni.porte, finche' e' piantata
  let avvisoT = 0;                // non ripetere lo stesso rifiuto a ogni fotogramma

  function init(c) { ctx = c; }

  function dentroMura(x, z) {
    const { WALL } = ctx.world.pianta;
    const tx = x / TILE, tz = z / TILE;
    return tx > WALL.x0 - MARGINE && tx < WALL.x1 + MARGINE &&
           tz > WALL.y0 - MARGINE && tz < WALL.y1 + MARGINE;
  }

  // perche' li' no (o null se si puo')
  function divieto(x, z) {
    const w = ctx.world;
    if (dentroMura(x, z)) return TX('tenda.mura');
    if (w.blocked(x, z) || w.blocked(x, z + 1.6)) return TX('tenda.posto');
    const tx = Math.floor(x / TILE), tz = Math.floor(z / TILE);
    if (w.district[w.idx(tx, tz)] === D.FIUME) return TX('tenda.acqua');
    return null;
  }

  function mettiPorta() {
    porta = { x: stato.piantata.x, z: stato.piantata.z + 1.6, tipo: 'tenda' };
    Interni.porte.push(porta);
  }

  function togliPorta() {
    const i = Interni.porte.indexOf(porta);
    if (i >= 0) Interni.porte.splice(i, 1);
    porta = null;
  }

  function pianta(x, z) {
    stato.piantata = { x, z };
    mettiPorta();
    ctx.say(TX('tenda.piantata'), 5);
  }

  function riprendi() {
    togliPorta();
    stato.piantata = null;
    ctx.say(TX('tenda.smontata'), 3);
  }

  // cosa farebbe T adesso, qui
  function compito() {
    const p = ctx.player;
    if (!stato.posseduta || p.vehicle || p.dead || Interni.dentro) return null;
    if (stato.piantata) {
      const d = Math.hypot(stato.piantata.x - p.x, stato.piantata.z - p.z);
      return d < VICINO ? 'riprendi' : null;
    }
    return 'pianta';
  }

  // tenendo = T premuto in questo fotogramma
  function update(dt, tenendo) {
    avvisoT = Math.max(0, avvisoT - dt);
    const cosa = compito();
    if (!tenendo || !cosa) {
      if (tenendo && !cosa && stato.posseduta && stato.piantata && !avvisoT &&
          !Interni.dentro) {
        ctx.say(TX('tenda.altrove'), 3);
        avvisoT = 3;
      }
      lavoro.cosa = null; lavoro.prog = 0; lavoro.visto = false;
      return;
    }
    const p = ctx.player;
    const dove = cosa === 'pianta' ? { x: p.x, z: p.z - 1.2 } : stato.piantata;
    if (cosa === 'pianta') {
      const no = divieto(dove.x, dove.z);
      if (no) {
        if (!avvisoT) { ctx.say(no, 3); avvisoT = 3; }
        lavoro.cosa = null; lavoro.prog = 0;
        return;
      }
    }
    if (lavoro.cosa !== cosa) { lavoro.cosa = cosa; lavoro.prog = 0; }
    lavoro.visto = ctx.occhi(dove.x, dove.z);
    if (lavoro.visto) { lavoro.prog = 0; return; }     // chi ti vede interrompe
    lavoro.prog += dt;
    if (lavoro.prog < RICHIESTO) return;
    lavoro.cosa = null; lavoro.prog = 0;
    if (cosa === 'pianta') pianta(dove.x, dove.z);
    else riprendi();
  }

  // la barra dell'HUD, nello stesso formato del colpo ai campi
  function barra() {
    if (!lavoro.cosa) return null;
    return {
      etichetta: lavoro.cosa === 'pianta' ? TX('tenda.pianti') : TX('tenda.smonti'),
      prog: lavoro.prog, richiesto: lavoro.richiesto, visto: lavoro.visto,
      verbo: lavoro.cosa === 'pianta' ? TX('tenda.picchetti') : TX('tenda.teli_giu'),
    };
  }

  function disegna() {
    const t = stato.piantata;
    if (t) Gfx.drawWorldSprite('tenda_ladro', t.x, t.z, { shadowAlpha: 0.8 });
  }

  function dai() {
    if (stato.posseduta) return false;
    stato.posseduta = true;
    return true;
  }

  // --- salvataggio (salvataggio.js)
  function perSalvare() {
    return { posseduta: stato.posseduta,
             piantata: stato.piantata && { ...stato.piantata } };
  }

  function rimetti(s) {
    if (porta) togliPorta();
    stato.posseduta = !!(s && s.posseduta);
    stato.piantata = s && s.posseduta && s.piantata ? { x: s.piantata.x, z: s.piantata.z } : null;
    if (stato.piantata) mettiPorta();
    lavoro.cosa = null; lavoro.prog = 0;
  }

  return { init, update, barra, disegna, dai, perSalvare, rimetti, divieto,
           get posseduta() { return stato.posseduta; },
           get piantata() { return stato.piantata; } };
})();
