// shot4.js — fotografa i sei quartieri per verificare ruoli e densita'.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader',
           '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load', timeout: 45000 });
  await p.waitForTimeout(4500);
  await p.evaluate(() => document.getElementById('title').style.display = 'none');

  const scenes = [['piazza', 344, 410], ['castello', 438, 350],
                  ['bassif', 250, 470], ['campi', 400, 640],
                  ['bosco', 608, 176], ['porto', 176, 432]];
  const conteggi = {};
  for (const [n, x, z] of scenes) {
    await p.evaluate(([x, z]) => { __game.debug.tp(x, z); __game.debug.setDay(0.30); }, [x, z]);
    await p.waitForTimeout(7000);
    await p.screenshot({ path: `/home/claude/med/out/shots/z_${n}.png` });
    conteggi[n] = await p.evaluate(() => {
      const g = window.__game;
      const vicini = g.npcs.filter(a => Math.hypot(a.x - g.player.x, a.z - g.player.z) < 40);
      const perSprite = {};
      for (const a of vicini) perSprite[a.sprite] = (perSprite[a.sprite] || 0) + 1;
      return { entro40: vicini.length, sprite: perSprite };
    });
  }
  const d = await p.evaluate(() => ({ fps: __game.fps,
    residenti: __game.world.residents.length, ronda: __game.world.patrol.length }));
  console.log(JSON.stringify({ d, conteggi, errs: errs.slice(0, 6) }, null, 1));
  await b.close();
})();
