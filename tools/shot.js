// shot.js — apre il gioco in Chromium, raccoglie gli errori di console e
// salva una serie di screenshot. E' la verifica: senza guardarlo, "compila"
// non vuol dire "si vede".
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const args = process.argv.slice(2);
  const url = args[0] || 'http://127.0.0.1:8123/index.html';
  const outDir = args[1] || '/home/claude/med/out/shots';
  const waits = (args[2] || '3,8,14').split(',').map(Number);

  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader',
           '--enable-unsafe-swiftshader', '--no-sandbox',
           '--enable-webgl', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
  page.on('requestfailed', r =>
    logs.push(`[404?] ${r.url()} — ${r.failure()?.errorText}`));

  await page.goto(url, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const t = document.getElementById('title');
    if (t) t.style.display = 'none';
  });

  let prev = 0;
  for (const w of waits) {
    await page.waitForTimeout(Math.max(0, (w - prev)) * 1000);
    prev = w;
    await page.screenshot({ path: path.join(outDir, `t${w}.png`) });
  }

  const diag = await page.evaluate(() => {
    const g = window.__game;
    if (!g) return { error: 'window.__game assente' };
    return {
      fps: g.fps,
      player: { x: Math.round(g.player.x), z: Math.round(g.player.z),
                hp: Math.round(g.player.hp), money: g.player.money },
      npcs: g.npcs.length,
      props: g.world.props.length,
      lights: g.world.lights.length,
      veicoli: g.world.spawns.vehicles.length,
    };
  });

  console.log(JSON.stringify({ diag, logs: logs.slice(0, 40) }, null, 1));
  await browser.close();
})();
