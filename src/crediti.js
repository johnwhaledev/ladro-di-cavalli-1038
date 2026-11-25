// crediti.js — la pagina dei crediti nella schermata iniziale (13/10).
//
// Nella barra in fondo al titolo (GITHUB, WWW, KO-FI) si aggiunge CREDITI:
// apre una pagina sopra il titolo con chi ha fatto cosa. Il dettaglio delle
// licenze resta in CREDITS.md, che fa fede; qui i nomi da ringraziare. Il
// titolo parte al clic (index.html): i clic dei crediti non gli arrivano.

const Crediti = (() => {
  // [sezione, [righe]]
  const VOCI = [
    [TX('crediti.musiche'), [
      'RandomMind — Medieval: Exploration, Harvest Season, The Old Tower Inn, '
        + 'King\'s Feast, Battle',
      'nightm4re — Viking March',
      'iamoneabe — Desert Loop',
      'Thimras — A Sailor\'s Chant']],
    [TX('crediti.ambienti'), ['Joseph Sardin — bigsoundbank.com']],
    [TX('crediti.grafica'), [
      'Mana Seed — Seliel the Shaper',
      'Pixel Crawler — Anokolisa',
      'Roguelike/RPG pack — Kenney (CC0)',
      TX('crediti.minifolks')]],
    [TX('crediti.codice'), [
      TX('crediti.threejs'),
      'Press Start 2P — CodeMan38 (SIL Open Font License)']],
  ];

  let pagina = null;

  function apri() {
    if (!pagina) {
      pagina = document.createElement('div');
      pagina.id = 'crediti';
      Object.assign(pagina.style, {
        position: 'absolute', inset: '0', zIndex: '50', display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: 'rgba(7,9,20,.94)',
        fontFamily: 'var(--pix)', color: '#efe2c0', cursor: 'pointer' });
      const box = document.createElement('div');
      Object.assign(box.style, { maxWidth: '760px', maxHeight: '86vh', overflowY: 'auto',
                                 padding: '24px', lineHeight: '1.9', fontSize: '10px',
                                 textAlign: 'center' });
      const h = document.createElement('div');
      Object.assign(h.style, { fontSize: '18px', color: '#ffcf5c', marginBottom: '18px' });
      h.textContent = TX('crediti.titolo');
      box.appendChild(h);
      for (const [sezione, righe] of VOCI) {
        const s = document.createElement('div');
        Object.assign(s.style, { color: '#e2622f', marginTop: '14px' });
        s.textContent = sezione;
        box.appendChild(s);
        for (const r of righe) {
          const d = document.createElement('div');
          d.textContent = r;
          box.appendChild(d);
        }
      }
      const fine = document.createElement('div');
      Object.assign(fine.style, { color: '#8f86a8', marginTop: '22px', fontSize: '8px' });
      fine.textContent = TX('crediti.fine');
      box.appendChild(fine);
      pagina.appendChild(box);
      pagina.addEventListener('click', e => { e.stopPropagation(); chiudi(); });
      document.body.appendChild(pagina);
    }
    pagina.style.display = 'flex';
  }

  function chiudi() { if (pagina) pagina.style.display = 'none'; }
  const aperta = () => !!pagina && pagina.style.display !== 'none';

  function init() {
    const barra = document.getElementById('links');
    if (!barra || document.getElementById('linkCrediti')) return;
    const sep = document.createElement('span');
    sep.className = 'sep';
    sep.textContent = '·';
    const a = document.createElement('a');
    a.href = '#';
    a.id = 'linkCrediti';
    a.textContent = TX('crediti.titolo');
    a.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); apri(); });
    barra.append(sep, a);
    // Esc chiude i crediti prima di arrivare al gioco
    addEventListener('keydown', e => {
      if (e.code === 'Escape' && aperta()) { e.stopImmediatePropagation(); chiudi(); }
    }, true);
  }

  // gli script si caricano dopo la pagina (index.html)
  if (document.readyState === 'complete') init();
  else addEventListener('load', init);
  return { apri, chiudi, get aperta() { return aperta(); }, VOCI };
})();
