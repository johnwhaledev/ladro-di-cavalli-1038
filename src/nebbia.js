// nebbia.js — la carta da scoprire, alla Age of Empires (01/10).
//
// Ogni citta' ha una griglia di "visto" a bassa risoluzione: una cella e'
// CELLA x CELLA tile (48 x 48 celle per un mondo di 192 tile). A ogni
// fotogramma game.js passa la posizione del ladro e il raggio di vista, e le
// celle nel raggio diventano viste per sempre. Sulla minimappa e sulla carta
// (hud.js) il velo copre di nero le celle mai viste e scurisce quelle viste
// ma non piu' in vista; le altre restano a colori.
//
// Cosa si disegna (hud.js): guardie, nemici, bestie e mezzi solo nelle celle
// in vista; etichette dei luoghi, taverne, campi, committenti e il bersaglio
// dell'incarico solo nelle celle gia' scoperte (deciso il 30/09). La tenda e
// il ladro sempre.
//
// Nel salvataggio (salvataggio.js) va una stringa per citta': un bit per
// cella, in base64 (2304 bit, 384 caratteri).

const Nebbia = (() => {
  const CELLA = 4;                          // tile per lato di una cella
  const N = Math.ceil(WT / CELLA);          // celle per lato
  const LATO = CELLA * TILE;                // unita' di mondo per lato di cella
  const MEZZA_DIAG = LATO * Math.SQRT1_2;   // una cella e' in vista se la tocca il raggio
  // il velo: mai visto quasi nero (l'indaco della carta), visto e non in
  // vista scurito
  const BUIO = [27, 25, 46], ALFA_MAI = 255, ALFA_VISTO = 115;

  const griglie = {};        // chiave della citta' -> Uint8Array(N * N), 1 = vista
  let visto = new Uint8Array(N * N);
  let px = -1e9, pz = -1e9, raggio = 0;     // la vista di questo fotogramma
  let tela = null, sporca = true, cellaLadro = -1;

  const clamp = i => Math.max(0, Math.min(N - 1, i));
  const indice = (x, z) => clamp(Math.floor(z / LATO)) * N + clamp(Math.floor(x / LATO));
  const centro = i => [(i % N + 0.5) * LATO, (Math.floor(i / N) + 0.5) * LATO];
  const tocca = i => {
    const [x, z] = centro(i);
    return Math.hypot(x - px, z - pz) <= raggio + MEZZA_DIAG;
  };

  // la citta' caricata: ognuna ha la sua griglia (Hud.mondo)
  function mondo(w) {
    const k = w.pianta.chiave || w.pianta.nome;
    visto = griglie[k] || (griglie[k] = new Uint8Array(N * N));
    px = pz = -1e9;
    sporca = true;
  }

  // le celle nel raggio del ladro diventano viste
  function aggiorna(x, z, r) {
    px = x; pz = z; raggio = r;
    const c = indice(x, z);
    if (c !== cellaLadro) { cellaLadro = c; sporca = true; }
    const k = Math.ceil((r + MEZZA_DIAG) / LATO);
    const cx = c % N, cz = Math.floor(c / N);
    for (let j = Math.max(0, cz - k); j <= Math.min(N - 1, cz + k); j++)
      for (let i = Math.max(0, cx - k); i <= Math.min(N - 1, cx + k); i++) {
        const q = j * N + i;
        if (!visto[q] && tocca(q)) { visto[q] = 1; sporca = true; }
      }
  }

  const scoperto = (x, z) => visto[indice(x, z)] === 1;
  const inVista = (x, z) => tocca(indice(x, z));
  // le stesse sulle liste di cose con x e z (hud.js)
  const scoperti = a => a.filter(e => scoperto(e.x, e.z));
  const visibili = a => a.filter(e => inVista(e.x, e.z));

  // il velo come immagine di N x N punti, rifatta solo quando cambia
  function rifai() {
    if (!tela) { tela = document.createElement('canvas'); tela.width = tela.height = N; }
    const g = tela.getContext('2d'), img = g.createImageData(N, N);
    for (let q = 0; q < N * N; q++) {
      const o = q * 4;
      img.data[o] = BUIO[0]; img.data[o + 1] = BUIO[1]; img.data[o + 2] = BUIO[2];
      img.data[o + 3] = !visto[q] ? ALFA_MAI : (tocca(q) ? 0 : ALFA_VISTO);
    }
    g.putImageData(img, 0, 0);
    sporca = false;
  }

  // il velo sopra la carta: (ox, oy) dove cade il tile 0,0, s punti per tile.
  // Sfumato (smoothing acceso): i bordi delle celle non si vedono a gradini
  function velo(ctx, ox, oy, s) {
    if (sporca || !tela) rifai();
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tela, ox, oy, N * CELLA * s, N * CELLA * s);
    ctx.restore();
  }

  // salvataggio: un bit per cella, in base64, per ogni citta' vista
  function comprimi(a) {
    const b = new Uint8Array(Math.ceil(a.length / 8));
    for (let q = 0; q < a.length; q++) if (a[q]) b[q >> 3] |= 1 << (q & 7);
    return btoa(String.fromCharCode(...b));
  }

  function espandi(s) {
    const b = Uint8Array.from(atob(s), ch => ch.charCodeAt(0));
    const a = new Uint8Array(N * N);
    for (let q = 0; q < a.length; q++) a[q] = (b[q >> 3] >> (q & 7)) & 1;
    return a;
  }

  function perSalvare() {
    const out = {};
    for (const [k, a] of Object.entries(griglie)) if (a.some(v => v)) out[k] = comprimi(a);
    return out;
  }

  // i salvataggi di prima del 01/10 non l'hanno: la carta resta da scoprire
  function rimetti(s, w) {
    for (const k of Object.keys(griglie)) delete griglie[k];
    for (const [k, v] of Object.entries(s || {})) griglie[k] = espandi(v);
    mondo(w);
  }

  // per le foto e il collaudo: tutta la citta' scoperta
  function svela() { visto.fill(1); sporca = true; }

  return { CELLA, N, mondo, aggiorna, scoperto, inVista, scoperti, visibili, velo,
           perSalvare, rimetti, svela,
           get celleViste() { return visto.reduce((n, v) => n + v, 0); } };
})();
