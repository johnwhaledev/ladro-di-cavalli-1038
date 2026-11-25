const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load', timeout: 45000 });
  await p.waitForTimeout(4500);
  await p.evaluate(() => document.getElementById('title').style.display='none');
  const scenes = [
    ['piazza',  () => { __game.debug.tp(344, 440); __game.debug.setDay(0.30); }],
    ['bosco',   () => { __game.debug.tp(608, 176); __game.debug.setDay(0.32); }],
    ['bassif',  () => { __game.debug.tp(248, 440); __game.debug.setDay(0.30); }],
    ['notte',   () => { __game.debug.tp(346, 410); __game.debug.setDay(0.86); }],
  ];
  for (const [name, fn] of scenes) {
    await p.evaluate(fn);
    await p.waitForTimeout(7000);
    await p.screenshot({ path: `/home/claude/med/out/shots/n_${name}.png` });
  }
  const d = await p.evaluate(()=>({fps:__game.fps, npcs:__game.npcs.length}));
  console.log(JSON.stringify({d, errs: errs.slice(0,8)}));
  await b.close();
})();
