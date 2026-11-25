// rendi_castello.js — i pezzi del Castle Kit di Kenney (CC0, modelli 3D)
// renderizzati ALL'ANGOLO ESATTO del motore, per ottenere gli sprite di
// cinta muraria che al gioco mancano.
//
// Perche' non si prende un pacchetto isometrico gia' pronto: quello e' cotto
// al SUO angolo (di solito 2:1 dimetrico, ~30°) mentre qui si lavora a 58°,
// e per giunta con una proiezione ibrida — il terreno visto a piombo e solo
// l'altezza schiacciata di sin(58°). Due prospettive nella stessa inquadratura
// litigano sempre. Un modello 3D invece si renderizza all'angolo che serve.
//
// La trasformazione applicata qui e' la stessa riga di pushQuad in gfx.js:
//     y' = y * cos(T)      (profondita')
//     z' = z - y * sin(T)  (alto dello schermo)
// piu' una camera ortografica a piombo. Non e' un'approssimazione.
//
// L'illuminazione va calcolata PRIMA dello shear (dopo, le normali non
// significano piu' niente) e cotta nei colori dei vertici.
const { chromium } = require('playwright');
const fs = require('fs');

// inclinazione della camera: il motore oggi sta a 58°, ma il senso di questo
// strumento e' proprio poterla cambiare — un modello 3D si rigenera a
// qualunque angolo, un disegno no.
const GRADI = Number(process.argv[2] || 58);
const DEST = process.argv[3] || 'out/castello';
const SOLO = process.argv[4] ? process.argv[4].split(',') : null;

// nome finale : [modello, rotazione Y in gradi, altezza voluta in unita']
const PEZZI = {
  mura_ew:        ['wall',             0,   5.0],
  mura_ns:        ['wall',            90,   5.0],
  mura_ang_ne:    ['wall-corner',      0,   5.0],
  mura_ang_nw:    ['wall-corner',     90,   5.0],
  mura_ang_sw:    ['wall-corner',    180,   5.0],
  mura_ang_se:    ['wall-corner',    270,   5.0],
  mura_porta:     ['wall-doorway',     0,   5.0],
  mura_porta_ns:  ['wall-doorway',    90,   5.0],
  mura_pilastro:  ['wall-pillar',      0,   5.4],
  torre:          ['tower-square',     0,   9.0],
  torre_tetto:    ['tower-square-top-roof', 0, 10.5],
  torre_arco:     ['tower-square-arch', 0,  9.0],
  cancello:       ['gate',             0,   5.2],
  stendardo:      ['flag-banner-long', 0,   4.0],
  scala:          ['stairs-stone',     0,   3.0],
  mura_stretta:   ['wall-narrow',      0,   3.2],
  mura_stretta_ns:['wall-narrow',     90,   3.2],
};

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  const p = await b.newPage({ viewport: { width: 500, height: 500 } });
  const errs = []; p.on('pageerror', e=>errs.push(e.message));
  p.on('console', m=>{ if(m.type()==='error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8124/render.html', {waitUntil:'load', timeout:45000});

  const scelti = SOLO ? Object.fromEntries(Object.entries(PEZZI).filter(([k]) => SOLO.includes(k))) : PEZZI;
  const out = await p.evaluate(async ({ PEZZI, GRADI }) => {
    const T = GRADI * Math.PI / 180, COS = Math.cos(T), SIN = Math.sin(T);
    const PPU = 16;
    const LUCE = new THREE.Vector3(-0.45, 0.82, 0.36).normalize();
    const AMB = 0.52, DIR = 0.62;

    const loader = new THREE.GLTFLoader();
    const carica = (f) => new Promise((res, rej) =>
      loader.load('models/' + f + '.glb', g => res(g.scene), undefined, rej));

    // campiona la texture del modello per vertice, cosi' i colori sono quelli
    // veri del pacchetto e non un grigio inventato
    const cacheTex = new Map();
    function campionatore(map) {
      // I GLB del kit referenziano la texture di palette come file esterno:
      // se non si decodifica si ripiega sul colore del materiale, che nei
      // modelli Kenney e' gia' quello giusto.
      if (!map || !map.image || !map.image.width) return null;
      if (cacheTex.has(map.image)) return cacheTex.get(map.image);
      const c = document.createElement('canvas');
      c.width = map.image.width; c.height = map.image.height;
      try { c.getContext('2d').drawImage(map.image, 0, 0); }
      catch (e) { cacheTex.set(map.image, null); return null; }
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const f = (u, v) => {
        const x = Math.min(c.width - 1, Math.max(0, Math.floor(u * c.width)));
        // glTF ha l'origine UV in alto a sinistra e three compensa con
        // flipY: campionando a mano la v NON va invertita. Con (1-v) si
        // pescava dalla meta' nera della palette e usciva tutto nero.
        const y = Math.min(c.height - 1, Math.max(0, Math.floor(v * c.height)));
        const i = (y * c.width + x) * 4;
        return [d[i] / 255, d[i+1] / 255, d[i+2] / 255];
      };
      cacheTex.set(map.image, f);
      return f;
    }

    const risultati = [];
    for (const [nome, [file, rotY, altVoluta]] of Object.entries(PEZZI)) {
      const src = await carica(file);
      const g = new THREE.Group();
      g.add(src);
      src.rotation.y = rotY * Math.PI / 180;
      g.updateMatrixWorld(true);

      // scala: porta il pezzo all'altezza voluta in unita' di mondo
      let bb = new THREE.Box3().setFromObject(g);
      const k = altVoluta / Math.max(1e-6, bb.max.y - bb.min.y);
      g.scale.setScalar(k);
      g.position.y = -bb.min.y * k;
      g.updateMatrixWorld(true);

      const meshes = [];
      g.traverse(o => { if (o.isMesh) meshes.push(o); });

      const scene = new THREE.Scene();
      for (const o of meshes) {
        const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
        const pos = geo.attributes.position;
        const nor = geo.attributes.normal;
        const uv = geo.attributes.uv;
        const mat = Array.isArray(o.material) ? o.material[0] : o.material;
        const samp = campionatore(mat && mat.map);
        const base = (mat && mat.color) ? mat.color : new THREE.Color(0xb0a898);

        const col = new Float32Array(pos.count * 3);
        const nm = new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
        for (let i = 0; i < pos.count; i++) {
          let r = base.r, gg = base.g, bl = base.b;
          if (samp && uv) { const c = samp(uv.getX(i), uv.getY(i)); r *= c[0]; gg *= c[1]; bl *= c[2]; }
          const n = new THREE.Vector3(nor.getX(i), nor.getY(i), nor.getZ(i))
            .applyMatrix3(nm).normalize();
          // luce cotta ORA, che le normali valgono ancora qualcosa
          const l = AMB + DIR * Math.max(0, n.dot(LUCE));
          col[i*3] = Math.min(1, r * l);
          col[i*3+1] = Math.min(1, gg * l);
          col[i*3+2] = Math.min(1, bl * l);
        }
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

        // e adesso lo shear del motore
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i), z = pos.getZ(i);
          pos.setY(i, y * COS);
          pos.setZ(i, z - y * SIN);
        }
        pos.needsUpdate = true;
        geo.computeBoundingBox();
        scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
          vertexColors: true, side: THREE.DoubleSide })));
      }

      bb = new THREE.Box3().setFromObject(scene);
      const W = Math.max(2, Math.ceil((bb.max.x - bb.min.x) * PPU));
      const H = Math.max(2, Math.ceil((bb.max.z - bb.min.z) * PPU));
      // L'ALTO DELLO SCHERMO E' -Z, non +Z.
      // Lo shear manda l'altezza verso z negativo (z' = z - y*sin), e nel
      // motore z che diminuisce e' "verso nord", cioe' verso l'alto. Con
      // up=+Z i pezzi uscivano CAPOVOLTI: il camminamento in basso e la
      // facciata in cima, ed e' per questo che non si capiva niente e le
      // mura sembravano viste di fronte.
      const cam = new THREE.OrthographicCamera(bb.min.x, bb.max.x,
                                               -bb.min.z, -bb.max.z, -900, 900);
      cam.position.set(0, 400, 0);
      cam.up.set(0, 0, -1);
      cam.lookAt(0, 0, 0);

      const r = new THREE.WebGLRenderer({ alpha: true, antialias: false });
      r.setPixelRatio(1); r.setSize(W, H, false); r.setClearColor(0x000000, 0);
      r.render(scene, cam);
      risultati.push({ nome, file, w: W, h: H,
                       hu: +(bb.max.z - bb.min.z).toFixed(2),
                       png: r.domElement.toDataURL('image/png') });
      r.dispose();
    }
    return risultati;
  }, { PEZZI: scelti, GRADI });

  fs.mkdirSync('/home/claude/med/' + DEST, { recursive: true });
  for (const o of out)
    fs.writeFileSync(`/home/claude/med/${DEST}/${o.nome}.png`,
                     Buffer.from(o.png.split(',')[1], 'base64'));
  console.log(JSON.stringify(out.map(o => ({ nome: o.nome, da: o.file,
    px: `${o.w}x${o.h}`, hu: o.hu })), null, 1));
  if (errs.length) console.log('ERRORI', errs.slice(0, 5));
  await b.close();
})();
