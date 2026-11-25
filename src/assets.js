// assets.js — caricamento atlas e manifest, lookup degli sprite.
//
// Il manifest e' prodotto da tools/build_assets.py: contiene i rettangoli di
// ogni pezzo nell'atlas, l'altezza in unita' di mondo (hu) e, per i
// personaggi, l'offset del ritaglio dentro la cella originale 64x64 — serve a
// tenere l'ancora ai piedi ferma mentre l'animazione cambia frame.

const Assets = (() => {
  let manifest = null;
  const tex = {};

  function loadImage(src) {
    return new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('immagine non caricata: ' + src));
      i.src = src;
    });
  }

  function makeTexture(img) {
    const t = new THREE.Texture(img);
    t.magFilter = THREE.NearestFilter;      // pixel art: niente sfocatura
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  }

  async function load(base = 'assets/') {
    // Il manifest e gli atlanti sono UNA COSA SOLA: i rettangoli valgono per
    // quella precisa impaginazione. Se il browser tiene in cache il PNG
    // vecchio e rilegge il manifest nuovo, ogni sprite pesca dal punto
    // sbagliato e il mondo si riempie di ritagli a caso — sembra che il gioco
    // sia rotto, e invece sono due file di due versioni diverse.
    // Quindi: manifest mai dalla cache, e agli atlanti si appende la versione
    // del build, cosi' un PNG vecchio non puo' essere accoppiato a un
    // manifest nuovo nemmeno per sbaglio.
    manifest = await fetch(base + 'manifest.json', { cache: 'no-store' })
      .then(r => r.json());
    const v = '?v=' + (manifest.build || '0');
    const [c, w, t] = await Promise.all([
      loadImage(base + manifest.chars.atlas + v),
      loadImage(base + manifest.world.atlas + v),
      loadImage(base + manifest.terrain.atlas + v),
    ]);
    tex.chars = makeTexture(c);
    tex.world = makeTexture(w);
    tex.terrainImg = t;                      // usata su canvas 2D, non in GL
    manifest.chars.image = c;
    manifest.world.image = w;
    return manifest;
  }

  // --- sprite del mondo -----------------------------------------------------

  function world(name) {
    const r = manifest.world.rects[name];
    if (!r) return null;
    return r;
  }

  function worldNames(prefix) {
    return Object.keys(manifest.world.rects).filter(n => n.startsWith(prefix));
  }

  // uv normalizzate (u0, v0, u1, v1) con v ribaltata: in GL l'origine e' in basso
  function uvOf(r, atlasSize) {
    const [W, H] = atlasSize;
    return [r.x / W, 1 - (r.y + r.h) / H, (r.x + r.w) / W, 1 - r.y / H];
  }

  function worldUV(r) { return uvOf(r, manifest.world.size); }
  function charUV(r) { return uvOf(r, manifest.chars.size); }

  // --- personaggi -----------------------------------------------------------

  // I personaggi sono di solo profilo: niente dimensione "direzione", la
  // direzione e' lo specchio orizzontale. charDef porta le misure prese in
  // fase di build (ppu efficace, piano d'appoggio, centro del corpo).

  function charDef(name) {
    return manifest.chars.defs[name] || null;
  }

  function charFrame(name, anim, i) {
    const d = manifest.chars.defs[name];
    if (!d) return null;
    const keys = d.anims[anim] || d.anims.idle;
    if (!keys || !keys.length) return null;
    const key = keys[((i % keys.length) + keys.length) % keys.length];
    return manifest.chars.rects[key];
  }

  function charFrameCount(name, anim) {
    const d = manifest.chars.defs[name];
    if (!d) return 0;
    const keys = d.anims[anim] || d.anims.idle;
    return keys ? keys.length : 0;
  }

  function charNames(filter) {
    const all = Object.keys(manifest.chars.defs);
    return filter ? all.filter(n => manifest.chars.defs[n].cat === filter) : all;
  }

  return {
    load,
    get manifest() { return manifest; },
    get tex() { return tex; },
    world, worldNames, worldUV, charUV,
    charDef, charFrame, charFrameCount, charNames,
    get ppu() { return manifest.ppu; },
  };
})();
