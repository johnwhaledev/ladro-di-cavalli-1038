// fuochi.js — il fuoco e il fumo che si muovono (25/09 notte).
//
// "Fumo fermo finto da sprite non va bene e nemmeno fuochi": il fumo dei
// camini e i fuochi di falo', bracieri, torce e focolari erano dipinti negli
// sprite, fermi (la torcia di Valdarno la fiamma non l'aveva proprio). Qui:
// sopra ogni fuoco una fiamma che cambia fotogramma e guizza; da ogni camino
// sbuffi di fumo che salgono, si allargano, piegano col vento del meteo e
// svaniscono (quattro fotogrammi retinati, dal pieno al rado: il renderer non
// ha la trasparenza graduale). Il fumo dipinto e' stato cancellato dagli
// sprite (tools/innesta_nano.py, i "ritocchi" di mappe.json), i fuochi
// dipinti restano sotto la fiamma, che li copre.
//
// Dove stanno fuochi e camini lo dicono i metadati dei pezzi dell'atlante
// (fiamme, camini: frazioni dello sprite). init() li porta nel mondo, una
// volta per citta'; disegna() li anima attorno alla camera.

const Fuochi = (() => {
  const RAGGIO = 75;          // oltre, niente fiamme ne' fumo: non si vedono
  const VITA = 3.6;           // secondi di uno sbuffo
  const OGNI = 0.42;          // secondi fra due sbuffi dello stesso camino
  let fiamme = [], camini = [];
  const sbuffi = [];

  // un punto dello sprite (frazioni) nel mondo: come per la bandiera della
  // barca, un punto alto h nel billboard sta h*sin piu' a nord e h*cos piu' su
  // Poi lo si porta mezza unita' verso la camera, lungo la vista: sullo
  // schermo resta dov'e', ma sta davanti allo sprite. Con 0,12 in z e basta la
  // fiamma finiva dietro il focolare (il depth buffer a 16 bit ha passi di ~0,07)
  const AVANTI = 0.5;
  function punto(p, fx, fy) {
    const T = Gfx.TILT, hh = (1 - fy) * p.hu;
    return { x: p.x + (fx - 0.5) * p.wu * (p.flip ? -1 : 1),
             z: p.z - hh * Math.sin(T) + AVANTI * Math.cos(T),
             y: hh * Math.cos(T) + AVANTI * Math.sin(T) };
  }

  function init(world) {
    fiamme = []; camini = []; sbuffi.length = 0;
    for (const p of world.props) {
      const r = p.name && Assets.world(p.name);
      if (!r || p.piano || p.parete || p.sopra) continue;
      for (const [fx, fy, fh] of r.fiamme || []) {
        const q = punto(p, fx, fy);
        fiamme.push({ ...q, alto: Math.max(0.45, fh * p.hu * 1.5), seme: Math.random() * 10 });
      }
      for (const [fx, fy] of r.camini || [])
        camini.push({ ...punto(p, fx, fy), t: Math.random() * OGNI, scala: p.hu / r.hu });
    }
  }

  // la fiamma di un pezzo disegnato fuori dal mondo (l'arredo delle stanze)
  function sulPezzo(nome, x, z, flip, tempo) {
    const r = Assets.world(nome);
    if (!r || !r.fiamme) return;
    const p = { x, z, hu: r.hu, wu: r.wu, flip };
    for (const [fx, fy, fh] of r.fiamme) {
      const q = punto(p, fx, fy);
      // le stanze stanno a coordinate negative: il seme resta positivo
      fiamma({ ...q, alto: Math.max(0.45, fh * r.hu * 1.5), seme: Math.abs(x * 0.37) % 10 }, tempo);
    }
  }

  function fiamma(f, tempo) {
    const k = ((Math.floor(tempo * 9 + f.seme * 3) % 4) + 4) % 4;
    const guizzo = 1 + 0.12 * Math.sin(tempo * 13 + f.seme * 5);
    Gfx.drawWorldSprite('fiamma_' + k, f.x, f.z, {
      y: f.y - 0.05, hu: f.alto * guizzo, wu: f.alto * 0.62, shadow: false,
      flip: (Math.floor(tempo * 4 + f.seme) % 2) === 0, tint: [1.5, 1.45, 1.3],
    });
  }

  function disegna(dt, cx, cz, tempo) {
    const vicino = q => Math.abs(q.x - cx) < RAGGIO && Math.abs(q.z - cz) < RAGGIO;
    for (const f of fiamme) if (vicino(f)) fiamma(f, tempo);
    // il vento del meteo (px al secondo sullo schermo) piega il fumo
    const vento = (Meteo.vento ? Meteo.vento() : -40) / 60;
    for (const c of camini) {
      if (!vicino(c)) continue;
      c.t -= dt;
      if (c.t > 0) continue;
      c.t = OGNI * (0.7 + Math.random() * 0.6);
      if (sbuffi.length < 400)
        sbuffi.push({ x: c.x + (Math.random() - 0.5) * 0.3, z: c.z, y: c.y, eta: 0,
                      scala: c.scala, deriva: 0.6 + Math.random() * 0.5 });
    }
    for (let i = sbuffi.length - 1; i >= 0; i--) {
      const s = sbuffi[i];
      s.eta += dt;
      if (s.eta > VITA || !vicino(s)) { sbuffi.splice(i, 1); continue; }
      const t = s.eta / VITA;
      s.y += dt * (1.3 - t * 0.6) * s.scala;
      s.x += dt * vento * s.deriva * t;
      const grande = (0.9 + t * 2.1) * s.scala;
      Gfx.drawWorldSprite('fumo_' + Math.min(3, Math.floor(t * 4)), s.x, s.z, {
        y: s.y, hu: grande, wu: grande, shadow: false,
      });
    }
  }

  return { init, disegna, sulPezzo, get quante() { return { fiamme: fiamme.length, camini: camini.length,
                                                   sbuffi: sbuffi.length }; } };
})();
