// taglia_test.js — la taglia nasce da un testimone o dal nulla?
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.goto('http://127.0.0.1:8123/index.html',{waitUntil:'load',timeout:45000});
  await p.waitForTimeout(5000);
  await p.evaluate(()=>{document.getElementById('title').style.display='none';});
  const R={};

  // --- 1. animale ucciso: niente stelle
  R.animale = await p.evaluate(async ()=>{
    const g=window.__game; g.player.wanted=0;
    g.debug.tp(608,176); await new Promise(r=>setTimeout(r,3500));
    const b=g.beasts.find(x=>!x.dead);
    if(!b) return {nota:'nessuna bestia vicina'};
    const prima=g.player.wanted;
    for(let i=0;i<20 && !b.dead;i++) g.debug.colpisci(b);
    await new Promise(r=>setTimeout(r,600));
    return {bestia:b.sprite, morta:b.dead, tagliaPrima:prima, tagliaDopo:g.player.wanted};
  });

  // --- 2. omicidio senza testimoni
  R.senzaTestimoni = await p.evaluate(async ()=>{
    const g=window.__game; g.player.wanted=0;
    g.debug.tp(400,640); await new Promise(r=>setTimeout(r,4000));
    for(const gd of g.guards) gd.dead=true;       // nessuna guardia in vista
    const v=g.npcs.find(n=>!n.dead && Math.hypot(n.x-g.player.x,n.z-g.player.z)<20);
    if(!v) return {nota:'nessun civile vicino'};
    v.x=g.player.x+1.2; v.z=g.player.z;
    const t0 = g.debug.testimone();
    for(let i=0;i<30 && !v.dead;i++) g.debug.colpisci(v);
    await new Promise(r=>setTimeout(r,800));
    return {vittimaMorta:v.dead, taglia:g.player.wanted, testimone: !!t0};
  });

  // --- 3. omicidio davanti a una guardia
  R.conTestimone = await p.evaluate(async ()=>{
    const g=window.__game; g.player.wanted=0;
    g.debug.tp(344,410); await new Promise(r=>setTimeout(r,4000));
    for(const gd of g.guards){ gd.dead=false; gd.hp=gd.maxHp=60; gd.informato=0; gd.daAvvisare=null; }
    const gd=g.guards[0]; gd.x=g.player.x+4; gd.z=g.player.z; gd.fisso=true;
    const v=g.npcs.find(n=>!n.dead);
    v.x=g.player.x+1.2; v.z=g.player.z;
    await new Promise(r=>setTimeout(r,200));
    const t0 = g.debug.testimone();
    for(let i=0;i<30 && !v.dead;i++) g.debug.colpisci(v);
    await new Promise(r=>setTimeout(r,800));
    return {testimone: !!t0, taglia:g.player.wanted, stelle:g.player.stars,
            informate:g.guards.filter(x=>x.informato>0).length,
            guardieVive:g.guards.filter(x=>!x.dead).length};
  });

  // --- 4. la notizia si propaga?
  R.propagazione = await p.evaluate(async ()=>{
    const g=window.__game;
    const serie=[];
    for(let i=0;i<10;i++){
      const msg = g.guards.filter(x=>x.daAvvisare);
      serie.push({t:+(i*1.5).toFixed(1),
                  informate:g.guards.filter(x=>x.informato>0).length,
                  messaggeri:msg.length,
                  distanzaAlCollega: msg.length ? +Math.hypot(
                    msg[0].daAvvisare.x-msg[0].x, msg[0].daAvvisare.z-msg[0].z).toFixed(1) : null});
      await new Promise(r=>setTimeout(r,1500));
    }
    return {serie, totaleGuardie:g.guards.filter(x=>!x.dead).length,
            stelle:g.player.stars};
  });

  console.log(JSON.stringify({R,errs:errs.slice(0,6)},null,1));
  await b.close();
})();
