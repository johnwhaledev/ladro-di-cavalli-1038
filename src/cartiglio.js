// cartiglio.js — il nome del luogo (01/10): arrivando in una citta' o
// entrando in una stanza, il nome compare grande al centro, in oro su una
// fascia indaco fra due fili d'oro, e svanisce da solo. Stile della
// frontpage (variabili --gold, --edge, --paper, --pix di index.html).

const Cartiglio = (() => {
  const RESTA = 2.2;          // secondi pieno, dopo la comparsa
  let el = null, testo = null, timer = 0;

  function prepara() {
    if (el) return;
    el = document.createElement('div');
    el.id = 'cartiglio';
    el.style.cssText = 'position:absolute;left:0;right:0;top:20%;z-index:19;pointer-events:none;' +
      'display:flex;justify-content:center;opacity:0;transition:opacity .6s ease';
    testo = document.createElement('div');
    testo.style.cssText = 'font-family:var(--pix);color:var(--gold);text-align:center;' +
      'font-size:clamp(14px,2.6vw,26px);letter-spacing:2px;padding:14px 42px;' +
      'background:linear-gradient(90deg,transparent,rgba(43,40,72,.86) 18%,rgba(43,40,72,.86) 82%,transparent);' +
      'border-top:2px solid var(--edge);border-bottom:2px solid var(--edge);' +
      'text-shadow:3px 3px 0 #14122a;text-transform:uppercase';
    el.appendChild(testo);
    document.body.appendChild(el);
  }

  function mostra(nome) {
    if (!nome) return;
    prepara();
    testo.textContent = nome;
    el.style.opacity = 1;
    clearTimeout(timer);
    timer = setTimeout(() => { el.style.opacity = 0; }, (RESTA + 0.6) * 1000);
  }

  return { mostra, get visibile() { return !!el && el.style.opacity === '1'; },
           get nome() { return testo ? testo.textContent : ''; } };
})();
