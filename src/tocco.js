// tocco.js — i comandi che mancavano al telefono (13/10, riorganizzati il
// 14/10 dopo la tua prova: "in orizzontale si perdono e sono davvero tanti").
//
// Sul touch ci sono la manopola e i due tasti d'azione, E e ⚔ (game.js,
// bindInput). Qui un tasto solo in piu', ☰, accanto ai due: apre un menu al
// centro dello schermo con le voci scritte per esteso (la plancia, la carta,
// l'arma dopo quella in mano, la tenda tenendo premuto, la musica). Ogni voce
// manda al gioco lo stesso tasto della tastiera: game.js li legge da `window`
// per codice, e non sa la differenza. Il menu si chiude toccando fuori o
// scegliendo una voce. Si vede solo dove si tocca, come la manopola.

const Tocco = (() => {
  const premi = (code, tipo = 'keydown') => dispatchEvent(new KeyboardEvent(tipo, { code }));
  const ladro = () => window.__game && window.__game.player;

  // l'arma dopo quella in mano, fra quelle che hai (il tasto 1-9 di quella)
  function armaDopo() {
    const p = ladro();
    if (!p || p.arsenale.length < 2) return;
    const i = (p.arsenale.indexOf(p.arma) + 1) % p.arsenale.length;
    premi('Digit' + (i + 1));
  }

  // [testo (o funzione che lo scrive), cosa fa al tocco, cosa fa al rilascio]
  // Chi ha il rilascio si tiene premuto e non chiude il menu (la tenda)
  const VOCI = [
    [TX('tocco.plancia'), () => premi('Tab')],
    [TX('tocco.carta'), () => premi('KeyM')],
    [() => { const p = ladro(); return TX('tocco.arma', { arma: p ? ARMI[p.arma].nome : '' }); }, armaDopo],
    [TX('tocco.tenda'), () => premi('KeyT'), () => premi('KeyT', 'keyup')],
    [() => TX('volume.musica', { stato: Colonna.senzaMusica ? TX('comune.no') : TX('comune.si') }), () => premi('KeyN')],
  ];

  let menu = null, voci = [];
  const testo = v => (typeof v[0] === 'function' ? v[0]() : v[0]);

  function apri() {
    for (const [b, v] of voci) b.textContent = testo(v);
    menu.style.display = 'flex';
  }
  function chiudi() { menu.style.display = 'none'; }
  const aperto = () => !!menu && menu.style.display !== 'none';

  function tasto(etichetta, stile) {
    const b = document.createElement('button');
    b.className = 'tbtn';
    b.textContent = etichetta;
    Object.assign(b.style, { display: 'block', ...stile });
    document.body.appendChild(b);
    return b;
  }

  function init() {
    if (!('ontouchstart' in window)) return;
    // ☰ a sinistra della E, sopra la ⚔: fuori dalla minimappa anche in orizzontale
    const apriTasto = tasto('☰', { width: '58px', height: '58px', right: '124px', bottom: '128px',
                                   fontSize: '18px' });
    apriTasto.addEventListener('touchstart', e => { aperto() ? chiudi() : apri(); e.preventDefault(); },
                               { passive: false });
    // il menu: un velo su tutto lo schermo (toccarlo chiude), le voci al centro
    menu = document.createElement('div');
    menu.id = 'menuTocco';
    Object.assign(menu.style, { position: 'absolute', inset: '0', zIndex: '30', display: 'none',
                                alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(7,9,20,.55)' });
    const box = document.createElement('div');
    Object.assign(box.style, { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                               gap: '10px', width: 'min(520px, 86vw)' });
    menu.appendChild(box);
    for (const v of VOCI) {
      const [, tocca, lascia] = v;
      const b = document.createElement('button');
      b.className = 'voceTocco';
      Object.assign(b.style, { minHeight: '52px', padding: '10px', fontFamily: 'var(--pix)',
                               fontSize: '10px', lineHeight: '1.6', color: 'var(--ink)',
                               background: 'rgba(36,33,66,.95)', border: '2px solid var(--edge)',
                               boxShadow: '3px 3px 0 #000', touchAction: 'none' });
      b.addEventListener('touchstart', e => {
        e.preventDefault(); e.stopPropagation();
        tocca();
        if (!lascia) chiudi();                       // la tenda si tiene premuta
        else b.textContent = testo(v);
      }, { passive: false });
      for (const fine of ['touchend', 'touchcancel'])
        b.addEventListener(fine, e => { e.stopPropagation(); if (lascia) { lascia(); chiudi(); } });
      box.appendChild(b);
      voci.push([b, v]);
    }
    menu.addEventListener('touchstart', e => { if (e.target === menu) { chiudi(); e.preventDefault(); } },
                          { passive: false });
    document.body.appendChild(menu);
    // il suggerimento in basso parla di tastiera: qui dei tasti a schermo
    const h = document.getElementById('hint');
    if (h) h.textContent = TX('tocco.aiuto');
  }

  // gli script si caricano dopo la pagina (index.html): il `load` puo' essere
  // gia' passato
  if (document.readyState === 'complete') init();
  else addEventListener('load', init);
  return { init, apri, chiudi, get aperto() { return aperto(); }, VOCI };
})();
