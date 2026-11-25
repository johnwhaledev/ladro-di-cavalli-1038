const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load', timeout: 45000 });
  await p.waitForTimeout(4000);
  await p.evaluate(() => document.getElementById('title').style.display='none');
  const scenes = [
    ['bosco',   () => { __game.debug.tp(608, 176); __game.debug.setDay(0.35); }],
    ['porto',   () => { __game.debug.tp(168, 432); __game.debug.setDay(0.66); }],
    ['notte',   () => { __game.debug.tp(346, 410); __game.debug.setDay(0.86); }],
    ['castello',() => { __game.debug.tp(438, 352); __game.debug.setDay(0.30); }],
  ];
  for (const [name, fn] of scenes) {
    await p.evaluate(fn);
    await p.waitForTimeout(6000);
    await p.screenshot({ path: `/home/claude/med/out/shots/${name}.png` });
  }
  await p.keyboard.press('Tab');
  await p.waitForTimeout(700);
  await p.screenshot({ path: '/home/claude/med/out/shots/plancia.png' });
  await p.keyboard.press('Escape');
  await p.keyboard.press('KeyM');
  await p.waitForTimeout(700);
  await p.screenshot({ path: '/home/claude/med/out/shots/carta.png' });
  console.log(JSON.stringify({ fps: await p.evaluate(()=>__game.fps), errs: errs.slice(0,10) }));
  await b.close();
})();
