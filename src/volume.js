// volume.js — il volume nella plancia (14/10, tua scelta: "ok volume in
// plancia", oltre al tasto N della musica).
//
// Una riga sotto la testata della plancia (Tab), dopo quella dei viaggi
// (viaggi.js): un cursore solo per tutto il suono (musica e ambienti di
// colonna.js, effetti di audio.js) e il bottone della musica, lo stesso del
// tasto N. Il volume resta nel browser, come la scelta della musica.

const Volume = (() => {
  const CHIAVE = 'ladro1038_volume';
  let valore = 1;
  try {
    const s = localStorage.getItem(CHIAVE);
    if (s !== null && Number.isFinite(+s)) valore = Math.max(0, Math.min(1, +s));
  } catch (e) { /* niente */ }

  function imposta(v) {
    valore = Math.max(0, Math.min(1, v));
    Colonna.volume = valore;
    Sfx.volume = valore;
    try { localStorage.setItem(CHIAVE, String(valore)); } catch (e) { /* niente */ }
  }

  let musica = null;
  function scritta() {
    if (musica) musica.textContent = TX('volume.musica', { stato: Colonna.senzaMusica ? TX('comune.no') : TX('comune.si') });
  }

  function init() {
    imposta(valore);
    const top = document.getElementById('planciaTop');
    if (!top) return;
    const riga = document.createElement('div');
    riga.id = 'planciaVolume';
    // il margine di #planciaBody (index.html), cosi' la riga sta in colonna
    Object.assign(riga.style, { display: 'flex', gap: '8px', alignItems: 'center',
                                margin: '10px 20px 0', fontSize: '9px' });
    riga.append(TX('volume.volume'));
    const cursore = document.createElement('input');
    Object.assign(cursore, { type: 'range', min: 0, max: 100, step: 5,
                             value: Math.round(valore * 100) });
    cursore.style.accentColor = 'var(--gold)';
    cursore.addEventListener('input', () => imposta(cursore.value / 100));
    // lasciato il cursore, i tasti tornano al gioco (Tab chiude la plancia)
    cursore.addEventListener('change', () => cursore.blur());
    musica = document.createElement('button');
    musica.className = 'tab';
    musica.addEventListener('click', e => {
      e.stopPropagation();
      Colonna.alternaMusica();
      scritta();
      musica.blur();
    });
    riga.append(cursore, musica);
    (document.getElementById('planciaCitta') || top).after(riga);
    scritta();
    // il tasto N (e il ♪ del telefono) cambiano la musica anche da qui
    addEventListener('keydown', e => { if (e.code === 'KeyN') setTimeout(scritta, 0); });
  }

  // gli script si caricano dopo la pagina (index.html)
  if (document.readyState === 'complete') init();
  else addEventListener('load', init);
  return { imposta, get valore() { return valore; } };
})();
