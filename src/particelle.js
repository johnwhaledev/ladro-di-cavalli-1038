// particelle.js — l'aria che si muove (01/10): foglie al vento di giorno a
// Valdarno, lucciole di notte (Valdarno e la Costa), polvere nel deserto
// della Costa di giorno, neve soffiata a terra nel Fiordo.
//
// Vivono nel mondo (x, altezza, z) attorno al ladro e si proiettano con la
// camera su una tela 2D sopra il gioco, come la pioggia di meteo.js: restano
// ferme nel mondo mentre la camera si muove. Niente sprite e niente atlanti:
// sono punti di pochi pixel. Con pioggia, neve vera o nebbia le foglie, la
// polvere e le lucciole si fermano; in una stanza niente.

const Particelle = (() => {
  const RAGGIO = { x: 38, z: 26 };          // la scatola attorno al ladro (lo schermo e' ~±31 x ±21)
  // per tipo: quante, altezza, caduta, colori, lato in px. Un pixel del
  // disegno vale ~3 px di schermo: a 2 px su un suolo dello stesso colore
  // non si vedevano (prima prova del 01/10)
  const TIPI = {
    foglia:  { n: 30, y: [2, 7], cade: 0.55, col: ['#e0b040', '#d9772e', '#a8c03a', '#c9542a'], px: 3 },
    lucciola: { n: 34, y: [0.4, 2.2], cade: 0, col: ['#eef68a', '#c8f06a'], px: 3 },
    polvere: { n: 60, y: [0.1, 1.4], cade: 0.05, col: ['#f2dcae', '#e8c88a', '#fbe9c4'], px: 3 },
    neve:    { n: 70, y: [0.05, 0.9], cade: 0.08, col: ['#ffffff', '#eef3fa'], px: 3 },
  };
  const VENTO = 1 / 20;                     // da px/s di Meteo.vento() a unita'/s

  let tela = null, g = null, tipo = null, lista = [];
  const v3 = new THREE.Vector3();

  function preparaTela() {
    if (tela) return;
    tela = document.createElement('canvas');
    tela.id = 'particelle';
    tela.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;' +
                         'pointer-events:none;z-index:3';
    const game = document.getElementById('game');
    game.parentNode.insertBefore(tela, game.nextSibling);
    g = tela.getContext('2d');
  }

  // quale aria in questa citta', a quest'ora, con questo tempo
  function scegli(stile, notte) {
    const asciutto = Meteo.fattore('pioggia') + Meteo.fattore('nebbia') + Meteo.fattore('neve') < 0.3;
    if (stile === 'fiordo') return 'neve';
    if (!asciutto) return null;
    if (notte) return 'lucciola';
    return stile === 'costa' ? 'polvere' : 'foglia';
  }

  const caso = (a, b) => a + Math.random() * (b - a);

  function nasce(q, px, pz, ovunque) {
    const T = TIPI[tipo];
    q.x = px + caso(-RAGGIO.x, RAGGIO.x);
    q.z = pz + caso(-RAGGIO.z, RAGGIO.z);
    q.y = ovunque ? caso(T.y[0], T.y[1]) : T.y[1];
    q.col = T.col[Math.floor(Math.random() * T.col.length)];
    q.fase = Math.random() * 7;
    q.v = caso(0.6, 1.4);
    return q;
  }

  function muovi(q, dt, t, w) {
    if (tipo === 'lucciola') {
      // vaga piano e si accende e spegne
      q.x += Math.sin(t * 0.7 * q.v + q.fase) * 0.6 * dt;
      q.z += Math.cos(t * 0.5 * q.v + q.fase * 1.3) * 0.5 * dt;
      q.y += Math.sin(t * 1.1 + q.fase) * 0.25 * dt;
      return;
    }
    const T = TIPI[tipo];
    const svolazzo = tipo === 'foglia' ? Math.sin(t * 2.3 * q.v + q.fase) * 0.9 : 0;
    const spinta = tipo === 'foglia' ? 1 : 2.2;      // la polvere e la neve corrono basse
    q.x += (w * spinta * q.v + svolazzo) * dt;
    q.z += Math.sin(t * 0.4 + q.fase) * 0.3 * dt;
    q.y -= T.cade * q.v * dt;
  }

  function alfa(q, t) {
    if (tipo === 'lucciola') return Math.max(0, Math.sin(t * 1.7 * q.v + q.fase)) ** 2;
    if (tipo === 'foglia') return 1;
    return tipo === 'neve' ? 0.9 : 0.6;
  }

  // a ogni fotogramma; s: {dentro, notte, stile, px, pz, t}
  function disegna(dt, s) {
    preparaTela();
    const W = tela.clientWidth, H = tela.clientHeight;
    if (tela.width !== W || tela.height !== H) { tela.width = W; tela.height = H; }
    g.clearRect(0, 0, W, H);
    const nuovo = s.dentro ? null : scegli(s.stile, s.notte);
    if (nuovo !== tipo) { tipo = nuovo; lista = []; }
    if (!tipo) return;
    const T = TIPI[tipo], w = (Meteo.vento() + 60) * VENTO;
    while (lista.length < T.n) lista.push(nasce({}, s.px, s.pz, true));
    const cam = Gfx.camera;
    if (tipo === 'lucciola') g.globalCompositeOperation = 'lighter';
    for (const q of lista) {
      muovi(q, dt, s.t, w);
      const fuori = Math.abs(q.x - s.px) > RAGGIO.x || Math.abs(q.z - s.pz) > RAGGIO.z;
      if (q.y < 0 || fuori) nasce(q, s.px, s.pz, fuori);
      v3.set(q.x, q.y, q.z).project(cam);
      const a = alfa(q, s.t);
      if (v3.z > 1 || a < 0.03) continue;
      const sx = Math.round((v3.x + 1) / 2 * W), sy = Math.round((1 - v3.y) / 2 * H);
      g.globalAlpha = a;
      g.fillStyle = q.col;
      const p = T.px;
      if (tipo === 'lucciola') {
        g.globalAlpha = a * 0.3;
        g.fillRect(sx - p * 2, sy - p * 2, p * 5, p * 5);    // l'alone
        g.globalAlpha = a;
        g.fillRect(sx - p, sy - p, p * 2, p * 2);
        continue;
      }
      // la foglia e' larga due pixel e gira (uno solo quando e' di taglio),
      // col bordo scuro sotto per staccarsi dal selciato
      const largo = tipo === 'foglia' ? (Math.sin(s.t * 5 * q.v + q.fase) > 0 ? p * 2 : p) : p;
      if (tipo === 'foglia') {
        g.fillStyle = '#2a1c10';
        g.fillRect(sx - p, sy + 1, largo, p);
        g.fillStyle = q.col;
      }
      g.fillRect(sx - p, sy, largo, p);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  return { disegna, get tipo() { return tipo; }, get quante() { return lista.length; }, TIPI };
})();
