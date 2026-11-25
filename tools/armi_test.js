// armi_test.js — due domande precise, su una mischia costruita apposta:
//   1. con guardie intorno, gli assalitori puntano il ladro o si dimenticano di lui?
//   2. l'arciere tira da lontano o arriva addosso a dare pugni?
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e=>errs.push(e.message));
  p.on('console', m=>{ if(m.type()==='error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8123/index.html', {waitUntil:'load', timeout:45000});
  await p.waitForTimeout(5000);
  await p.evaluate(()=>{document.getElementById('title').style.display='none';});
  const R = {};

  // mischia costruita: 8 assalitori a 12 unita' dal ladro, guardie intorno
  await p.evaluate(()=>{
    const g = window.__game, P = g.player;
    g.debug.tp(344, 410);
    P.hp = P.maxHp = 3000;
    const tipi = ['MiniSwordMan@rosso','MiniSpearMan@rosso','MiniArcher@rosso',
                  'MiniCrossBowMan@rosso','MiniHalberdMan@rosso','MiniShieldMan@rosso',
                  'MiniArcher@rosso','MiniSwordMan@rosso'];
    tipi.forEach((s,i)=>{
      const a = i / tipi.length * Math.PI * 2;
      const e = new Nemico(s, P.x + Math.cos(a)*12, P.z + Math.sin(a)*12, {});
      e.hp = e.maxHp = 3000;
      g.nemici.push(e);
    });
    // guardie messe apposta PIU' VICINE al nemico di quanto lo sia il ladro:
    // e' il caso che prima faceva dimenticare il giocatore
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + 0.4;
      const gd = new Guard(P.x + Math.cos(a)*15, P.z + Math.sin(a)*15, 'MiniSwordMan');
      gd.hp = gd.maxHp = 3000; gd.fisso = true;
      g.guards.push(gd);
    }
    for (const gd of g.guards) { gd.hp = gd.maxHp = 3000; }
  });
  await p.waitForTimeout(500);
  R.partenza = await p.evaluate(()=>({
    assalitori: __game.nemici.filter(e=>!e.dead).length,
    guardieEntro20: __game.guards.filter(g=>!g.dead &&
      Math.hypot(g.x-__game.player.x, g.z-__game.player.z) < 20).length }));

  // campiona per 10 s chi puntano e da che distanza partono le frecce
  R.campione = await p.evaluate(()=>new Promise(res=>{
    const g = window.__game;
    const conteggi = {ladro:0, guardia:0, civile:0, nessuno:0}, tiri = [];
    let visti = new Set();
    const t = setInterval(()=>{
      for (const e of g.nemici) {
        if (e.dead) continue;
        const b = e.bersaglioCorrente;
        if (!b) conteggi.nessuno++;
        else if (b === g.player) conteggi.ladro++;
        else if (g.guards.includes(b)) conteggi.guardia++;
        else conteggi.civile++;
      }
      for (const q of g.proiettili) {
        if (!q.tiratore || visti.has(q)) continue;
        visti.add(q);
        tiri.push({ da: q.tiratore.sprite.split('@')[0],
                    d: +Math.hypot(q.x - (q.bersaglio ? 0 : g.player.x),
                                   q.z - g.player.z).toFixed(1) });
      }
    }, 250);
    setTimeout(()=>{ clearInterval(t); res({ conteggi, tiri: tiri.length,
      tiratori: [...new Set(tiri.map(t=>t.da))] }); }, 10000);
  }));

  // distanza a cui gli arcieri si tengono, contro quella dei fanti
  R.distanze = await p.evaluate(()=>{
    const g = window.__game, P = g.player;
    const per = {};
    for (const e of g.nemici) {
      if (e.dead) continue;
      const k = e.sprite.split('@')[0];
      (per[k] = per[k] || []).push(+Math.hypot(e.x-P.x, e.z-P.z).toFixed(1));
    }
    return per;
  });
  R.salute = await p.evaluate(()=>({
    dannoPresoDalLadro: 3000 - Math.round(__game.player.hp),
    stelle: __game.player.stars }));

  console.log(JSON.stringify({R, errs: errs.slice(0,8)}, null, 1));
  await b.close();
})();
