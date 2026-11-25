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
  await p.evaluate(()=>__game.debug.tp(344,410));
  await p.waitForTimeout(3500);
  // mi metto accanto a un cavallo vero e lo monto
  const pos = await p.evaluate(()=>{
    const g=window.__game;
    const v = g.vehicles.find(v=>v.type==='cavallo' && !v.rider);
    if(!v) return null;
    g.debug.tp(v.x-1.2, v.z+1.2);
    return {x:v.x,z:v.z,name:v.name};
  });
  console.log('cavallo:', JSON.stringify(pos));
  await p.waitForTimeout(3000);
  await p.keyboard.press('KeyE');   // prova a montare qualcosa li' vicino
  await p.waitForTimeout(800);
  const st1 = await p.evaluate(()=>({sprite:__game.player.sprite,
    inSella: !!__game.player.vehicle,
    tipo: __game.player.vehicle && __game.player.vehicle.type}));
  console.log('dopo E:', JSON.stringify(st1));
  if (st1.inSella && st1.tipo==='cavallo') {
    await p.screenshot({path:'/home/claude/med/out/shots/d_insella.png'});
    await p.evaluate(()=>{ const v=__game.player.vehicle; v.hp=1; __game.player.hurt(20); });
    await p.waitForTimeout(400);
    await p.screenshot({path:'/home/claude/med/out/shots/d_caduta.png'});
    const st2 = await p.evaluate(()=>({sprite:__game.player.sprite,
      disarcionato:+__game.player.disarcionato.toFixed(2), anim:__game.player.anim,
      carcasse:__game.carcasse.length, inSella:!!__game.player.vehicle}));
    console.log('subito dopo:', JSON.stringify(st2));
    await p.waitForTimeout(3500);
    await p.screenshot({path:'/home/claude/med/out/shots/d_rialzato.png'});
    const st3 = await p.evaluate(()=>({anim:__game.player.anim,
      disarcionato:+__game.player.disarcionato.toFixed(2),
      carcasse:__game.carcasse.length, hp:Math.round(__game.player.hp)}));
    console.log('dopo 3.5s:', JSON.stringify(st3));
  }
  console.log('errori:', JSON.stringify(errs.slice(0,5)));
  await b.close();
})();
