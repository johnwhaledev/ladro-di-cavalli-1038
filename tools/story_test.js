// story_test.js — collaudo della campagna: parla col fabbro, avvia il capitolo,
// compra un'arma, tira una freccia. Verifica che non esploda nulla.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const p = await b.newPage({ viewport:{width:1280,height:720} });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8123/index.html',{waitUntil:'load',timeout:45000});
  await p.waitForTimeout(4500);
  await p.evaluate(()=>document.getElementById('title').style.display='none');

  const R = [];
  // 1. andiamo dal fabbro
  const fab = await p.evaluate(()=>{
    const g=__game.world.spawns.givers.find(x=>x.name==='Ferrante il fabbro');
    __game.debug.tp(g.x-1.2, g.z+1.2); return g;
  });
  await p.waitForTimeout(3500);
  await p.screenshot({path:'/home/claude/med/out/shots/s_fabbro.png'});

  // 2. E → avvia il capitolo 1
  await p.keyboard.press('KeyE');
  await p.waitForTimeout(1200);
  R.push(await p.evaluate(()=>({passo:'dopo E', cap:__game.campagna.cap,
    miss:__game.campagna.miss, attiva:__game.campagna.attiva &&
    __game.campagna.attiva.tipo})));

  // 3. soldi e bottega
  await p.evaluate(()=>{ __game.player.money = 2000; });
  await p.keyboard.press('KeyB');
  await p.waitForTimeout(900);
  await p.screenshot({path:'/home/claude/med/out/shots/s_bottega.png'});
  await p.evaluate(()=>{ Game.compra('arco'); Game.compra('lancia');
                         Game.compra('scudo'); Game.compra('pugnale'); });
  await p.waitForTimeout(400);
  R.push(await p.evaluate(()=>({passo:'dopo acquisti',
    arsenale:__game.player.arsenale, arma:__game.player.arma,
    sprite:__game.player.sprite, denari:__game.player.money})));
  await p.keyboard.press('Escape');

  // 4. arco: tira qualche freccia verso la folla
  await p.evaluate(()=>{ __game.player.equipaggia('arco'); });
  for (let i=0;i<6;i++){ await p.keyboard.press('Space'); await p.waitForTimeout(420); }
  await p.waitForTimeout(300);
  await p.screenshot({path:'/home/claude/med/out/shots/s_arco.png'});
  R.push(await p.evaluate(()=>({passo:'dopo 6 frecce',
    arma:__game.player.arma, sprite:__game.player.sprite,
    taglia:__game.player.stars})));

  // 5. giro tutte le armi e fotografo
  await p.evaluate(()=>{ __game.player.arsenale.push('balestra','alabarda'); });
  const armi = await p.evaluate(()=>__game.player.arsenale.slice());
  const sprites = [];
  for (const k of armi) {
    await p.evaluate(k=>__game.player.equipaggia(k), k);
    await p.waitForTimeout(250);
    sprites.push(await p.evaluate(()=>__game.player.sprite));
  }
  R.push({passo:'armi → sprite', mappa: Object.fromEntries(armi.map((a,i)=>[a,sprites[i]]))});

  // 6. plancia, tab diario
  await p.keyboard.press('Tab'); await p.waitForTimeout(500);
  await p.evaluate(()=>document.querySelector('[data-tab="diario"]').click());
  await p.waitForTimeout(700);
  await p.screenshot({path:'/home/claude/med/out/shots/s_diario.png'});

  console.log(JSON.stringify({R, errs:errs.slice(0,8)}, null, 1));
  await b.close();
})();
