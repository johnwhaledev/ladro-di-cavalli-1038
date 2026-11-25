// viaggi.js — il menu delle citta' dopo il finale (13/10, tua richiesta:
// "un menu solo finale per girare le citta' che si sblocca nella schermata
// principale o da tab").
//
// Finita la campagna (l'atto V chiuso: Storia.libere, campagna.js) le citta'
// sono libere, il mare escluso (tua risposta del 26/09). Due posti:
// - la schermata iniziale: se l'ultima partita salvata ha finito la
//   campagna, accanto a "Continua" i bottoni delle citta': caricano la
//   partita e ti portano li';
// - la plancia (Tab): una riga "Viaggia" sopra le schede, solo a campagna
//   finita; la citta' in cui sei non si sceglie.
// Si arriva in piazza, come cambiando citta' dal menu (game.js,
// cambiaCitta). Dal largo, in barca, resta anche il giro (campagna.js).

const Viaggi = (() => {
  const nomi = {};
  const nome = k => nomi[k] || (nomi[k] = Viaggio.pianta(k).nome);
  const qui = () => window.__game && window.__game.world.pianta.chiave;

  // un bottone per citta' in `dove`, con la classe data; `scegli(k)` al clic
  function bottoni(dove, classe, scegli) {
    const fatti = [];
    for (const k of Storia.GIRO) {
      const b = document.createElement('button');
      b.className = classe;
      b.textContent = nome(k);
      b.dataset.citta = k;
      b.addEventListener('click', e => { e.stopPropagation(); scegli(k); });
      dove.appendChild(b);
      fatti.push(b);
    }
    return fatti;
  }

  // --- la schermata iniziale: l'ultima partita ha finito la campagna?
  function nelTitolo() {
    const s = Salvataggio.leggiLocale();
    if (!s || !s.finita || Salvataggio.attoDi(s) !== ATTI.length - 1) return;
    const partite = document.getElementById('partite');
    const riga = document.createElement('div');
    riga.id = 'viaggiTitolo';
    Object.assign(riga.style, { display: 'flex', alignItems: 'center', gap: '6px',
                                fontSize: '9px' });
    riga.textContent = TX('viaggi.citta_libere');
    bottoni(riga, 'mini', async k => {
      await Game.carica(s);
      document.getElementById('title').style.display = 'none';
      if (qui() !== k) await Game.cambiaCitta(k);
    });
    partite.insertBefore(riga, document.getElementById('importaBtn'));
  }

  // --- la plancia: la riga sopra le schede, accesa solo a citta' libere
  let riga = null, bott = [];
  function nellaPlancia() {
    const top = document.getElementById('planciaTop');
    if (!top) return;
    riga = document.createElement('div');
    riga.id = 'planciaCitta';
    Object.assign(riga.style, { display: 'none', gap: '8px', alignItems: 'center',
                                margin: '10px 20px 0', fontSize: '9px' });   // come il volume
    riga.append(TX('viaggi.viaggia'));
    bott = bottoni(riga, 'tab', k => {
      Hud.closeAll();
      if (qui() !== k) Game.cambiaCitta(k);
    });
    top.after(riga);
    setInterval(aggiorna, 400);
  }

  function aggiorna() {
    const si = Storia.libere;
    riga.style.display = si ? 'flex' : 'none';
    if (si) for (const b of bott) {
      b.disabled = b.dataset.citta === qui();       // dove sei non si va
      b.style.opacity = b.disabled ? '0.4' : '1';
    }
  }

  function init() { nelTitolo(); nellaPlancia(); }

  // gli script si caricano dopo la pagina (index.html)
  if (document.readyState === 'complete') init();
  else addEventListener('load', init);
  return { init, nome };
})();
