// discorsi.js — i discorsi da rileggere (14/10, tua richiesta: "i testi dei
// discorsi vorrei poterli leggere da qualche parte, a volte spariscono troppo
// velocemente e mi perdo i pezzi").
//
// Nella plancia (Tab) una scheda "Discorsi" con le ultime righe sentite, la
// piu' recente in alto: quelle del riquadro in basso (aperture, chiusure,
// incarichi, battute: hud.js le scrive in #msg) e quelle delle scene col velo
// (passaggi.js, #scenaRighe). Le righe corte (un'arma presa, i denari) no.
// Il bottone si aggiunge prima che Hud.init leghi le schede: cosi' la
// accende e la spegne come le altre, e la plancia non ci scrive sopra
// (hud.js disegna solo le schede che conosce).

const Discorsi = (() => {
  const QUANTE = 40;
  const MINIMA = 24;             // sotto, e' un avviso e non un discorso
  const righe = [];              // { testo, da }, la piu' recente in fondo
  let disegnate = -1;

  function registra(testo, da) {
    testo = (testo || '').trim();
    if (testo.length < MINIMA) return;
    if (righe.slice(-4).some(r => r.testo === testo)) return;   // ripetuto
    righe.push({ testo, da });
    if (righe.length > QUANTE) righe.shift();
  }

  // da dove viene: la scena, se c'e' il velo; se no il capitolo in corso
  function fonte() {
    const velo = document.getElementById('scena');
    if (velo && velo.style.display === 'flex')
      return document.getElementById('scenaTitolo').textContent;
    const cap = window.Storia && Storia.capitolo && Storia.capitolo();
    return cap ? TX('hud.diario.capitolo', { n: cap.id, titolo: cap.titolo }) : '';
  }

  // ogni quarto di secondo: quel che c'e' in basso e l'ultima riga della scena
  function guarda() {
    const msg = document.getElementById('msg');
    if (msg && msg.textContent) registra(msg.textContent, fonte());
    const scena = document.querySelectorAll('#scenaRighe p');
    if (scena.length) registra(scena[scena.length - 1].textContent, fonte());
    const accesa = document.querySelector('#planciaTabs .tab.on');
    if (accesa && accesa.dataset.tab === 'discorsi' && disegnate !== righe.length) disegna();
  }

  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  function disegna() {
    disegnate = righe.length;
    let h = `<h3 class="sec">${TX('discorsi.titolo')}</h3>`;
    if (!righe.length) h += `<p><i>${TX('discorsi.niente')}</i></p>`;
    for (const r of righe.slice().reverse()) {
      h += '<div class="card pad" style="margin-bottom:8px">' +
           (r.da ? `<p style="color:var(--soft);font-size:8px;margin:0 0 6px">${esc(r.da)}</p>` : '') +
           `<p style="margin:0;line-height:1.9">${esc(r.testo)}</p></div>`;
    }
    document.getElementById('planciaBody').innerHTML = h;
  }

  // la scheda, prima di "Chiudi"
  const chiudi = document.getElementById('planciaClose');
  if (chiudi) {
    const b = document.createElement('button');
    b.className = 'tab';
    b.dataset.tab = 'discorsi';
    b.textContent = TX('discorsi.scheda');
    b.addEventListener('click', () => setTimeout(disegna, 0));
    chiudi.before(b);
  }
  setInterval(guarda, 250);

  return { registra, get righe() { return righe; } };
})();
