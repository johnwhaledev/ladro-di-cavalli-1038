// diag.js — dove sta davvero la gente? Conta per quartiere e per vicinanza
// alle strade, invece di giudicare a occhio da uno screenshot.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader',
           '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load', timeout: 45000 });
  await p.waitForTimeout(4500);
  await p.evaluate(() => document.getElementById('title').style.display = 'none');

  const punti = [['piazza', 344, 410], ['bassif', 250, 470], ['campi', 400, 640],
                 ['bosco', 608, 176], ['fuori', 470, 250]];
  const out = {};
  for (const [n, x, z] of punti) {
    await p.evaluate(([x, z]) => { __game.debug.tp(x, z); }, [x, z]);
    await p.waitForTimeout(6500);
    out[n] = await p.evaluate(() => {
      const g = window.__game, w = g.world, T = 4;
      const nomeD = ['bosco','campi','slums','mercato','nobile','porto','fiume','fuori'];
      const vicini = g.npcs.filter(a => Math.hypot(a.x-g.player.x, a.z-g.player.z) < 45);
      const vagabondi = vicini.filter(a => a.residente === undefined);
      const suStrada = a => {
        const tx = Math.floor(a.x/T), ty = Math.floor(a.z/T);
        for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++)
          if (w.inside(tx+dx,ty+dy) && w.road[w.idx(tx+dx,ty+dy)]) return true;
        return false;
      };
      const perD = {};
      for (const a of vicini) {
        const d = nomeD[w.district[w.idx(Math.floor(a.x/T), Math.floor(a.z/T))]];
        perD[d] = (perD[d]||0)+1;
      }
      const veicoliVicini = g.world.spawns.vehicles.filter(
        v => Math.hypot(v.x-g.player.x, v.z-g.player.z) < 60).length;
      return {
        tot: vicini.length,
        residenti: vicini.length - vagabondi.length,
        vagabondi: vagabondi.length,
        vagabondi_su_strada: vagabondi.filter(suStrada).length,
        vagabondi_fuori_strada: vagabondi.filter(a => !suStrada(a)).length,
        perQuartiere: perD,
        veicoli_entro_60u: veicoliVicini,
      };
    });
  }
  // distribuzione globale dei veicoli
  const veic = await p.evaluate(() => {
    const w = window.__game.world, T = 4;
    const nomeD = ['bosco','campi','slums','mercato','nobile','porto','fiume','fuori'];
    const per = {};
    for (const v of w.spawns.vehicles) {
      const d = nomeD[w.district[w.idx(Math.floor(v.x/T), Math.floor(v.z/T))]];
      per[d] = (per[d]||0)+1;
    }
    return { totale: w.spawns.vehicles.length, perQuartiere: per };
  });
  console.log(JSON.stringify({ zone: out, veicoli: veic }, null, 1));
  await b.close();
})();
