// ambiente.js — la luce del giorno: sette fasi interpolate (ambiente, nebbia,
// viraggio, bloom, ombre). Funzioni pure, senza stato: l'ora la tiene game.js.

function lerp(a, b, t) { return a + (b - a) * t; }
function lerp3(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t),
                                  lerp(a[2], b[2], t)]; }

const PHASES = [
  // t,   ambient,             fog,                 near, far, grade,            bloom, shadow, lunghezza ombra, vignetta
  [0.00, [0.30, 0.34, 0.50], [0.10, 0.13, 0.22], 55, 150, [0.92, 0.97, 1.08], 0.55, 0.40, 1.0, 0.78],
  [0.10, [0.92, 0.72, 0.62], [0.62, 0.50, 0.44], 80, 220, [1.08, 0.99, 0.92], 0.50, 0.70, 2.4, 0.66],
  [0.25, [1.08, 1.05, 0.98], [0.70, 0.77, 0.82], 110, 280, [1.00, 1.00, 1.00], 0.30, 1.00, 1.0, 0.52],
  [0.55, [1.06, 1.00, 0.90], [0.72, 0.74, 0.74], 105, 270, [1.02, 1.00, 0.97], 0.32, 1.00, 1.0, 0.52],
  [0.70, [0.95, 0.63, 0.46], [0.60, 0.36, 0.30], 70, 190, [1.11, 0.98, 0.88], 0.58, 0.60, 2.6, 0.66],
  [0.80, [0.38, 0.36, 0.52], [0.16, 0.16, 0.26], 55, 150, [0.94, 0.97, 1.06], 0.55, 0.40, 1.3, 0.78],
  [1.00, [0.30, 0.34, 0.50], [0.10, 0.13, 0.22], 55, 150, [0.92, 0.97, 1.08], 0.55, 0.40, 1.0, 0.78],
];

function envAt(t) {
  let a = PHASES[0], b = PHASES[PHASES.length - 1];
  for (let i = 0; i < PHASES.length - 1; i++) {
    if (t >= PHASES[i][0] && t <= PHASES[i + 1][0]) { a = PHASES[i]; b = PHASES[i + 1]; }
  }
  const k = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
  return {
    ambient: lerp3(a[1], b[1], k), fog: lerp3(a[2], b[2], k),
    fogNear: lerp(a[3], b[3], k), fogFar: lerp(a[4], b[4], k),
    grade: lerp3(a[5], b[5], k), bloom: lerp(a[6], b[6], k),
    shadowStrength: lerp(a[7], b[7], k), shadowLen: lerp(a[8], b[8], k),
    vignette: lerp(a[9], b[9], k),      // piu' stretta di notte (01/10; prima fissa 0,62)
  };
}
