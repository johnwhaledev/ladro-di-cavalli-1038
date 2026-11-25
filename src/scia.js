// scia.js — le barche sull'acqua (01/10): dondolano piano sul posto, ognuna
// col suo passo, e in corsa lasciano a poppa una scia di schiuma che si
// stringe e sparisce. drawBarca (game.js) chiama dondolo() per l'angolo dello
// scafo e disegna() prima dello scafo, cosi' la scia gli sta sotto.
//
// La scia e' fatta di sbuffi del pezzo 'schiuma' stesi a terra: il quad non
// ha trasparenza, quindi uno sbuffo sparisce stringendosi invece di svanire.

const Scia = (() => {
  const OGNI = 0.12;          // secondi fra uno sbuffo e l'altro
  const VITA = 1.6;           // secondi di vita di uno sbuffo
  const MINIMA = 1.5;         // velocita' sotto la quale non si lascia scia
  const ONDA = 0.035;         // radianti di dondolio

  // l'angolo dello scafo: la rotta piu' un'oscillazione lenta
  function dondolo(v, time) {
    if (v.ondaF === undefined) v.ondaF = Math.random() * 7;
    return v.rot + Math.sin(time * 1.1 + v.ondaF) * ONDA;
  }

  // L'onda di prua (14/10, tua nota: "nelle navi di citta' la coda si', la
  // punta no"): come sulla nave pirata (nave.js), sbuffi piccoli nati sulla
  // punta che si aprono a V lungo i fianchi e svaniscono presto. Restano
  // nell'acqua dove nascono, e scivolano un poco di lato: la barca va avanti
  // e la V si apre da se'
  const PRUA = { vita: 1.0, largo: 0.35 };

  // scafo: {wu, hu} della barca. Aggiorna gli sbuffi col tempo del gioco
  function disegna(v, time, scafo) {
    const dt = v.sciaT === undefined ? 0 : Math.min(0.1, Math.max(0, time - v.sciaT));
    v.sciaT = time;
    let s = v.scia || (v.scia = []);
    for (const q of s) { q.t += dt; q.x += (q.vx || 0) * dt; q.z += (q.vz || 0) * dt; }
    s = v.scia = s.filter(q => q.t < (q.vita || VITA));
    v.sciaC = (v.sciaC || 0) + dt;
    const sp = Math.abs(v.speed);
    if (sp > MINIMA && v.sciaC >= OGNI) {
      v.sciaC = 0;
      const verso = Math.sign(v.speed || 1);
      const fx = Math.cos(v.rot) * verso, fz = Math.sin(v.rot) * verso;   // avanti
      const poppa = -scafo.hu * 0.42, prua = scafo.hu * 0.46;
      s.push({ x: v.x + fx * poppa, z: v.z + fz * poppa, rot: v.rot, t: 0, w: scafo.wu * 0.9 });
      for (const lato of [-1, 1]) {
        const nx = -fz * lato, nz = fx * lato;                         // di fianco
        const apre = sp * (0.8 + Math.random() * 0.35);
        s.push({ x: v.x + fx * prua + nx * 0.2, z: v.z + fz * prua + nz * 0.2,
                 vx: nx * apre * PRUA.largo, vz: nz * apre * PRUA.largo,
                 rot: Math.atan2(nz * apre - fz * sp, nx * apre - fx * sp),
                 t: 0, vita: PRUA.vita, prua: true, w: scafo.wu * (0.35 + Math.random() * 0.2) });
      }
    }
    for (const q of s) {
      const k = 1 - q.t / (q.vita || VITA);
      const misura = q.prua ? { wu: q.w * 0.6 * k, hu: q.w * (0.8 + 0.4 * (1 - k)) }
                            : { wu: q.w * (0.5 + 0.6 * (1 - k)) * k, hu: q.w * 0.7 * k };
      Gfx.drawWorldSpriteGround('schiuma', q.x, q.z, q.rot, { y: 0.18, ...misura });
    }
  }

  return { dondolo, disegna };
})();
