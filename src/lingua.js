// lingua.js — la lingua del gioco (15/10, l'inglese, parte 1).
//
// I testi stanno in un file per lingua, per chiave: lingue/it.js (TESTI_IT) e
// lingue/en.js (TESTI_EN, che si riempie con la traduzione, dopo il libro).
// Nel codice resta TX('chiave'): la lingua scelta, e dove manca una chiave
// l'italiano. La scelta sta nella schermata iniziale, accanto alla citta', e
// resta nel browser; cambiarla ricarica la pagina (i testi della storia si
// leggono quando gli script si caricano). Finche' en.js e' vuoto l'inglese
// non si sceglie.

const Lingua = (() => {
  const CHIAVE = 'ladro1038_lingua';
  const TESTI = {
    it: typeof TESTI_IT !== 'undefined' ? TESTI_IT : {},
    en: typeof TESTI_EN !== 'undefined' ? TESTI_EN : {},
  };
  const NOMI = { it: 'Italiano', en: 'English' };
  const pronta = c => Object.keys(TESTI[c] || {}).length > 0;

  let codice = 'it';
  try {
    const s = localStorage.getItem(CHIAVE);
    if (s && pronta(s)) codice = s;
  } catch (e) { /* niente */ }

  // il testo della chiave; senza traduzione l'italiano; senza nemmeno quello
  // la chiave stessa, che si vede (e il collaudo la trova). Coi valori
  // (parte 2, 18/10): {nome} nel testo diventa valori.nome
  function t(chiave, valori) {
    const v = TESTI[codice][chiave] ?? TESTI.it[chiave];
    if (v === undefined) return chiave;
    return valori ? v.replace(/\{(\w+)\}/g, (m, n) => (n in valori ? String(valori[n]) : m)) : v;
  }

  // "da" + chi, con l'articolo della lingua: "dal Capo", "dall'emiro"
  const DA_CHI = {
    it: n => ('da ' + n).replace(/^da il /, 'dal ').replace(/^da la /, 'dalla ').replace(/^da l'/, "dall'"),
  };
  const daChi = n => (DA_CHI[codice] || DA_CHI.it)(n);

  // il testo fisso della pagina (index.html): data-tx="chiave"; l'italiano
  // resta scritto anche nell'HTML, per prima che gli script arrivino
  function pagina() {
    for (const el of document.querySelectorAll('[data-tx]')) el.textContent = t(el.dataset.tx);
    for (const el of document.querySelectorAll('[data-tx-title]')) el.title = t(el.dataset.txTitle);
  }

  // la scelta nella schermata iniziale, dopo quella della citta'
  function scelta() {
    const citta = document.getElementById('sceltaCitta');
    if (!citta) return;
    const riga = document.createElement('label');
    riga.id = 'sceltaLingua';
    // lo stile e' quello della citta' (index.html), display:block compreso
    riga.style.marginTop = '8px';
    riga.append(t('lingua.lingua'));
    const sel = document.createElement('select');
    sel.id = 'linguaSel';
    for (const [c, nome] of Object.entries(NOMI)) {
      const o = document.createElement('option');
      o.value = c;
      o.textContent = nome + (pronta(c) ? '' : t('lingua.dopo_libro'));
      o.disabled = !pronta(c);
      sel.appendChild(o);
    }
    sel.value = codice;
    sel.addEventListener('change', () => {
      try { localStorage.setItem(CHIAVE, sel.value); } catch (e) { /* niente */ }
      location.reload();
    });
    riga.appendChild(sel);
    riga.addEventListener('click', e => e.stopPropagation());   // non avvia il gioco
    citta.after(riga);
  }
  const avvia = () => { pagina(); scelta(); };
  if (document.readyState !== 'loading') avvia();
  else addEventListener('DOMContentLoaded', avvia);

  return { t, daChi, TESTI, get codice() { return codice; } };
})();

const TX = Lingua.t;
