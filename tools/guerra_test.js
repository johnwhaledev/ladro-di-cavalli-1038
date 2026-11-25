// guerra_test.js — collauda camera, accampamenti nemici e assalto al borgo.
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
  const R = {};

  // --- camera: scarto fra camera e giocatore da fermo, di corsa, in sella
  const misura = async (etichetta, prep) => {
    await p.evaluate(prep);
    await p.waitForTimeout(2600);
    R[etichetta] = await p.evaluate(() => {
      const g = window.__game;
      return { scarto: +Math.hypot(g.cam.x - g.player.x, g.cam.z - g.player.z).toFixed(1),
               dist: +g.cam.dist.toFixed(1) };
    });
  };
  await p.evaluate(() => { __game.debug.tp(344, 410); });
  await p.waitForTimeout(3000);
  await misura('fermo', () => {});
  await misura('cammina', () => { __game.debug.premi('right', true); });
  await misura('corre', () => { __game.debug.premi('run', true); });
  await p.screenshot({ path: '/home/claude/med/out/shots/c_corsa.png' });
  await misura('con 4 stelle', () => { __game.player.wanted = 34; });
  await p.evaluate(() => { __game.debug.premi('right', false);
                           __game.debug.premi('run', false);
                           __game.player.wanted = 0; });

  // --- accampamento nemico
  const acc = await p.evaluate(() => {
    const a = __game.world.accampamenti[0];
    __game.debug.tp(a.x + 6, a.z + 10);
    return { accampamenti: __game.world.accampamenti.length,
             nemiciNelMondo: __game.world.nemici.length };
  });
  R.accampamenti = acc;
  await p.waitForTimeout(7000);
  await p.screenshot({ path: '/home/claude/med/out/shots/c_accampamento.png' });
  R.nemiciVicini = await p.evaluate(() => __game.nemici.filter(e => !e.dead).length);

  // --- assalto al borgo, forzato
  await p.evaluate(() => { __game.debug.tp(344, 410); });
  await p.waitForTimeout(3500);
  await p.evaluate(() => { __game.assalto.prossimo = 0.1; });
  await p.waitForTimeout(3000);
  R.assalto = await p.evaluate(() => ({
    attivo: __game.assalto.attivo,
    assalitori: __game.nemici.filter(e => !e.dead && e.residente === undefined).length,
    civiliInFuga: __game.npcs.filter(n => n.state === 'flee').length }));
  await p.waitForTimeout(9000);
  await p.screenshot({ path: '/home/claude/med/out/shots/c_assalto.png' });
  R.dopo9s = await p.evaluate(() => ({
    assalitoriVivi: __game.nemici.filter(e => !e.dead && e.residente === undefined).length,
    guardieInGuerra: __game.guards.filter(g => g.state === 'guerra').length,
    denari: __game.player.money, taglia: __game.player.stars }));

  console.log(JSON.stringify({ R, errs: errs.slice(0, 8) }, null, 1));
  await b.close();
})();
