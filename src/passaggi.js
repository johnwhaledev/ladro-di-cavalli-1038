// passaggi.js — le scene di passaggio: arresti, tradimenti, arrivi (27/09).
//
// Una scena e' un velo nero che scende, un titolo, poche righe di dialogo che
// arrivano una alla volta (E, Spazio o un clic per la seguente) e il velo che
// risale. Mentre c'e' il gioco sta fermo (game.js salta il ciclo) e i tasti
// sono della scena: nessun E arriva a doAction.
//
// mostra(scena, lavoro): `lavoro` e' una promessa che corre dietro il velo
// (il viaggio: si carica la citta' seguente mentre si legge); il velo risale
// solo quando e' finita anche quella.
//
// Una scena: { titolo, sotto, righe: [[chi, testo], ...] }; chi null e' la voce
// del racconto. I testi sono bozze (STORIA_BOZZE.md) finche' non li approvi.

const SCENE_PASSAGGIO = {
  // la prova del collaudo: non e' storia
  prova: {
    titolo: TX('scena.prova.titolo'),
    sotto: TX('scena.prova.sotto'),
    righe: [[null, TX('scena.prova.righe.r1.testo')],
            [TX('scena.prova.righe.r2.chi'), TX('scena.prova.righe.r2.testo')]],
  },
  // il finale dell'atto I (bozze in STORIA_BOZZE.md): l'arresto davanti alla
  // ronda, e la fuga sulla barca del Nocchiero verso il Fiordo
  arresto: {
    titolo: TX('scena.arresto.titolo'),
    sotto: TX('scena.arresto.sotto'),
    righe: [[null, TX('scena.arresto.righe.r1.testo')],
            [TX('scena.arresto.righe.r2.chi'), TX('scena.arresto.righe.r2.testo')],
            [null, TX('scena.arresto.righe.r3.testo')],
            [TX('scena.arresto.righe.r4.chi'), TX('scena.arresto.righe.r4.testo')]],
  },
  fuga: {
    titolo: TX('scena.fuga.titolo'),
    sotto: TX('scena.fuga.sotto'),
    righe: [[TX('scena.fuga.righe.r1.chi'), TX('scena.fuga.righe.r1.testo')],
            [null, TX('scena.fuga.righe.r2.testo')],
            [TX('scena.fuga.righe.r3.chi'), TX('scena.fuga.righe.r3.testo')],
            [null, TX('scena.fuga.righe.r4.testo')]],
  },
  // il finale dell'atto II (bozza in STORIA_BOZZE.md): l'uomo del jarl ti
  // vende per la taglia del Ciambellano, e ti svegli in catene (atto III)
  prezzo: {
    titolo: TX('scena.prezzo.titolo'),
    sotto: TX('scena.prezzo.sotto'),
    righe: [[null, TX('scena.prezzo.righe.r1.testo')],
            [TX('scena.prezzo.righe.r2.chi'), TX('scena.prezzo.righe.r2.testo')],
            [null, TX('scena.prezzo.righe.r3.testo')],
            [TX('scena.prezzo.righe.r4.chi'), TX('scena.prezzo.righe.r4.testo')],
            [null, TX('scena.prezzo.righe.r5.testo')],
            [null, TX('scena.prezzo.righe.r6.testo')]],
  },
  // l'atto III, passo 3 (09/10): prima dei ferri ai rematori. La bozza di
  // STORIA_BOZZE.md ("Passo 3", apertura), provvisoria
  vela: {
    titolo: TX('scena.vela.titolo'),
    sotto: TX('scena.vela.sotto'),
    righe: [[null, TX('scena.vela.righe.r1.testo')],
            [null, TX('scena.vela.righe.r2.testo')]],
  },
  // il finale dell'atto III (09/10): venduto al mercato, poi l'atto IV. La
  // bozza di STORIA_BOZZE.md ("Passo 4", chiusura), provvisoria
  costa: {
    titolo: TX('scena.costa.titolo'),
    sotto: TX('scena.costa.sotto'),
    righe: [[null, TX('scena.costa.righe.r1.testo')],
            [null, TX('scena.costa.righe.r2.testo')]],
  },
  // il finale dell'atto IV (13/10): la nave dell'emiro, poi l'atto V. La
  // bozza di STORIA_BOZZE.md ("Capitolo 5", finale), provvisoria
  rotta: {
    titolo: TX('scena.rotta.titolo'),
    sotto: TX('scena.rotta.sotto'),
    righe: [[null, TX('scena.rotta.righe.r1.testo')],
            [TX('scena.rotta.righe.r2.chi'), TX('scena.rotta.righe.r2.testo')],
            [null, TX('scena.rotta.righe.r3.testo')]],
  },
  // la fine della campagna (13/10, atto V): il Ciambellano alla forca, prima
  // dell'ultimo passo. La bozza di STORIA_BOZZE.md ("Atto V", capitolo 5)
  forca: {
    titolo: TX('scena.forca.titolo'),
    sotto: TX('scena.forca.sotto'),
    righe: [[null, TX('scena.forca.righe.r1.testo')],
            // i suoi due complici (13/10, tua scelta: alla forca con lui)
            [null, TX('scena.forca.righe.r2.testo')],
            [TX('scena.forca.righe.r3.chi'), TX('scena.forca.righe.r3.testo')],
            [null, TX('scena.forca.righe.r4.testo')],
            [null, TX('scena.forca.righe.r5.testo')]],
  },
  // il viaggio in barca verso la citta' dell'atto (bozza, STORIA_BOZZE.md)
  viaggio: {
    titolo: TX('scena.viaggio.titolo'),
    sotto: TX('scena.viaggio.sotto'),
    righe: [[null, TX('scena.viaggio.righe.r1.testo')],
            [null, TX('scena.viaggio.righe.r2.testo')]],
  },
};

const Passaggi = (() => {
  let corso = null;          // {scena, i, fine, pronto, attende, chiudendo}

  const $ = id => document.getElementById(id);

  // i segnaposto {da} e {a} di una scena con i nomi del viaggio
  function componi(chiave, nomi = {}) {
    const s = SCENE_PASSAGGIO[chiave];
    const r = t => (t || '').replace(/\{(\w+)\}/g, (m, k) => (nomi[k] ?? m));
    return { titolo: r(s.titolo), sotto: r(s.sotto),
             righe: s.righe.map(([chi, t]) => [chi, r(t)]) };
  }

  function disegnaRighe() {
    const { scena, i } = corso;
    $('scenaRighe').innerHTML = scena.righe.slice(0, i + 1).map(([chi, t], k) =>
      `<p class="${k < i ? 'vecchia' : ''}">` +
      (chi ? `<b>${chi}:</b> “${t}”` : `<i>${t}</i>`) + '</p>').join('');
    const ultima = i >= scena.righe.length - 1;
    $('scenaAvanti').textContent = ultima && !corso.pronto ? '…' :
      (ultima ? 'E — continua' : 'E — avanti');
  }

  function mostra(scena, lavoro) {
    return new Promise(fine => {
      corso = { scena, i: 0, fine, pronto: !lavoro, chiudendo: false };
      $('scenaTitolo').textContent = scena.titolo || '';
      $('scenaSotto').textContent = scena.sotto || '';
      const velo = $('scena');
      velo.style.display = 'flex';
      requestAnimationFrame(() => { velo.style.opacity = 1; });
      disegnaRighe();
      if (lavoro) Promise.resolve(lavoro).finally(() => {
        if (!corso) return;
        corso.pronto = true;
        disegnaRighe();
        if (corso.attende) chiudi();
      });
    });
  }

  function chiudi() {
    const c = corso;
    if (!c || c.chiudendo) return;
    c.chiudendo = true;
    const velo = $('scena');
    velo.style.opacity = 0;
    setTimeout(() => {
      velo.style.display = 'none';
      corso = null;
      c.fine();
    }, 600);
  }

  // la riga seguente; dopo l'ultima si chiude (quando il lavoro e' finito)
  function avanti() {
    if (!corso || corso.chiudendo) return;
    if (corso.i < corso.scena.righe.length - 1) { corso.i++; disegnaRighe(); return; }
    if (corso.pronto) chiudi(); else corso.attende = true;
  }

  // i tasti durante la scena sono suoi: presi prima di game.js (fase di cattura)
  addEventListener('keydown', ev => {
    if (!corso) return;
    ev.stopImmediatePropagation();
    ev.preventDefault();
    if (ev.code === 'KeyE' || ev.code === 'Space' || ev.code === 'Enter') avanti();
  }, true);
  document.addEventListener('click', ev => {
    if (!corso || !ev.target.closest('#scena')) return;
    avanti();
  });

  return { mostra, avanti, componi,
           get attiva() { return !!corso; },
           get riga() { return corso ? corso.i : -1; } };
})();
