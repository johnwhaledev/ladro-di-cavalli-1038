// confronto_atlante.js — stessa scena con l'atlante vecchio e con quello nuovo.
// La normalizzazione di risoluzione riduce i pezzi del 26% in mediana: se si
// vede, si vede qui, non nel ragionamento.
const { chromium } = require('playwright');
(async () => {
  const etichetta = process.argv[2] || 'x';
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader',
           '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load', timeout: 45000 });
  await p.waitForTimeout(5000);
  await p.evaluate(() => { document.getElementById('title').style.display = 'none'; });
  const R = {};
  for (const [n, x, z] of [['piazza', 344, 410], ['castello', 438, 350],
                           ['porto', 176, 432]]) {
    await p.evaluate(([x, z]) => { __game.debug.tp(x, z); __game.debug.setDay(0.30); }, [x, z]);
    await p.waitForTimeout(6500);
    await p.screenshot({ path: `/home/claude/med/out/shots/cmp_${etichetta}_${n}.png` });
    R[n] = await p.evaluate(() => ({
      props: __game.world.props.length,
      npc: __game.npcs.length,
      fps: Math.round(__game.fps || 0),
    }));
  }
  console.log(JSON.stringify({ etichetta, R, errs: errs.slice(0, 6) }));
  await b.close();
})();
