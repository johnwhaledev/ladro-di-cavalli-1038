// obiettivo.js — dove andare per l'incarico in corso, su minimappa e carta.
//
// 08/10 (tua prova al Fiordo: "missione orso, come vedo le orme? 0/8"):
// l'obiettivo si vede sempre, anche dove la carta e' ancora nella nebbia. Prima
// compariva solo nelle zone scoperte (Nebbia.scoperto), e il primo segno della
// caccia, in un bosco mai visto, non si trovava. La nebbia resta per
// esplorare; non nasconde dove devi andare. Sulla minimappa, se l'obiettivo e'
// piu' lontano di quanto si vede, il segno sta sul bordo, verso di lui.
// hud.js gli passa il contesto e la funzione P (mondo -> pixel).

const Obiettivo = (() => {
  // la minimappa: un cerchio che pulsa; sul bordo, un punto pieno
  function mini(ctx, P, half, goal, time) {
    if (!goal) return;
    let [a, b] = P(goal.x, goal.z);
    const dx = a - half, dz = b - half, d = Math.hypot(dx, dz), max = half - 8;
    ctx.strokeStyle = '#ffd24a';
    ctx.lineWidth = 2;
    if (d > max) {
      a = half + dx / d * max; b = half + dz / d * max;
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath(); ctx.arc(a, b, 4.5, 0, 7); ctx.fill();
      ctx.strokeStyle = '#1b1a16'; ctx.lineWidth = 1.5; ctx.stroke();
      return;
    }
    ctx.beginPath(); ctx.arc(a, b, 6 + Math.sin(time * 4) * 2, 0, 7);
    ctx.stroke();
  }

  // la carta (M): una croce rossa
  function carta(ctx, P, goal) {
    if (!goal) return;
    const [a, b] = P(goal.x, goal.z);
    ctx.strokeStyle = '#b4472c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(a - 7, b - 7); ctx.lineTo(a + 7, b + 7);
    ctx.moveTo(a + 7, b - 7); ctx.lineTo(a - 7, b + 7); ctx.stroke();
  }

  return { mini, carta };
})();
