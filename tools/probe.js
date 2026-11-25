const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const p = await b.newPage({ viewport:{width:1280,height:720} });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://127.0.0.1:8123/index.html', { waitUntil:'load', timeout:45000 });
  await p.waitForTimeout(4000);
  const out = await p.evaluate(() => {
    const n='MiniVillagerMan';
    const d=Assets.charDef(n), r=Assets.charFrame(n,'idle',0);
    const uv=Assets.charUV(r);
    const m=Assets.manifest;
    return {
      atlasSizeManifest: m.chars.size,
      atlasImgReale: [m.chars.image.naturalWidth, m.chars.image.naturalHeight],
      def:d, rect:r, uv,
      ppuGlobale: m.ppu,
      hu: r.h/d.ppu, wu: r.w/d.ppu,
      baseY: (d.ground-(r.oy+r.h))/d.ppu,
    };
  });
  console.log(JSON.stringify(out,null,1).slice(0,1600));
  await b.close();
})();
