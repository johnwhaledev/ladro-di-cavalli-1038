// rendi3d.js — genera gli sprite delle mura RENDERIZZANDOLI IN 3D
// all'angolo esatto del gioco.
//
// Il problema delle mura non e' l'asset, e' la geometria: il gioco piazza la
// stessa elevazione frontale su tutti e quattro i lati della cinta, e sui
// tratti nord-sud non c'e' nessuna facciata da mostrare. Serve un pezzo per
// ogni orientamento, e nessuna tavola disegnata a mano li ha tutti.
//
// Un pacchetto isometrico gia' renderizzato non risolve: e' cotto al SUO
// angolo (di solito 2:1 dimetrico, ~30°) e il nostro e' 58°, quindi in una
// stessa inquadratura litigherebbero due prospettive. Un modello 3D invece si
// puo' renderizzare al nostro.
//
// La proiezione del motore (vedi pushQuad in gfx.js) non e' una prospettiva:
// il terreno e' visto a piombo e SOLO l'altezza e' schiacciata di sin(58°).
// Quindi qui si applica alla geometria la stessa identica trasformazione e si
// guarda dall'alto con una camera ortografica. Non e' un'approssimazione: e'
// la stessa formula.
const { chromium } = require('playwright');
const fs = require('fs');

const PEZZI = [
  // nome            lung  dir   note
  ['mura_ew',        4.0, 'ew', {}],
  ['mura_ns',        4.0, 'ns', {}],
  ['mura_ang_ne',    4.0, 'ne', {}],
  ['mura_ang_nw',    4.0, 'nw', {}],
  ['mura_ang_se',    4.0, 'se', {}],
  ['mura_ang_sw',    4.0, 'sw', {}],
  ['mura_torre',     4.0, 'torre', {}],
  ['mura_porta',     4.0, 'porta', {}],
];

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  const p = await b.newPage({ viewport: { width: 400, height: 400 } });
  const errs = []; p.on('pageerror', e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8123/index.html', {waitUntil:'load', timeout:45000});
  await p.waitForTimeout(1500);

  const out = await p.evaluate(async (PEZZI) => {
    const T = 58 * Math.PI / 180, COS = Math.cos(T), SIN = Math.sin(T);
    const PPU = 16;            // pixel per unita' di mondo, come l'atlante

    // ---- palette pietra: faccia sud, faccia est/ovest, cima, ombra
    // Le facce vanno separate parecchio: al primo giro erano tutte sui
    // grigi vicini e il pezzo usciva come una macchia unica, senza merli.
    const COL = { sud: 0x9d9488, lato: 0x746c62, cima: 0xd0c9bb,
                  scuro: 0x4d463d, legno: 0x7a5636, legnoS: 0x5b3f27 };

    function box(w, h, d, colori) {
      const g = new THREE.BoxGeometry(w, h, d);
      // BoxGeometry: gruppi 0..5 = +X, -X, +Y, -Y, +Z, -Z
      const mats = [
        new THREE.MeshBasicMaterial({ color: colori.est  ?? COL.lato }),
        new THREE.MeshBasicMaterial({ color: colori.ovest?? COL.lato }),
        new THREE.MeshBasicMaterial({ color: colori.cima ?? COL.cima }),
        new THREE.MeshBasicMaterial({ color: colori.sotto?? COL.scuro }),
        new THREE.MeshBasicMaterial({ color: colori.sud  ?? COL.sud }),
        new THREE.MeshBasicMaterial({ color: colori.nord ?? COL.scuro }),
      ];
      return new THREE.Mesh(g, mats);
    }

    function merli(parent, lung, alt, spess, asse) {
      const n = Math.max(2, Math.round(lung / 0.9));
      for (let i = 0; i < n; i++) {
        if (i % 2) continue;
        const m = box(asse === 'x' ? 0.55 : spess * 1.02, 0.7,
                      asse === 'x' ? spess * 1.02 : 0.55, {});
        const t = -lung / 2 + (i + 0.5) * (lung / n);
        m.position.set(asse === 'x' ? t : 0, alt / 2 + 0.35, asse === 'x' ? 0 : t);
        parent.add(m);
      }
    }

    function costruisci(dir, lung) {
      const g = new THREE.Group();
      const H = 4.4, S = 1.1;
      const muroX = () => { const m = box(lung, H, S, {}); m.position.y = H/2; g.add(m);
                            merli(g, lung, H, S, 'x'); };
      const muroZ = () => { const m = box(S, H, lung, {}); m.position.y = H/2; g.add(m);
                            merli(g, lung, H, S, 'z'); };
      if (dir === 'ew') muroX();
      else if (dir === 'ns') muroZ();
      else if (dir === 'torre') {
        const t = box(1.9, H + 1.3, 1.9, {}); t.position.y = (H + 1.3)/2; g.add(t);
        merli(g, 1.9, H + 1.3, 1.9, 'x');
      } else if (dir === 'porta') {
        const a = box(lung/2 - 0.5, H, S, {}); a.position.set(-lung/4 - 0.25, H/2, 0); g.add(a);
        const c = box(lung/2 - 0.5, H, S, {}); c.position.set( lung/4 + 0.25, H/2, 0); g.add(c);
        const arco = box(1.2, 1.4, S, {}); arco.position.set(0, H - 0.7, 0); g.add(arco);
        const porta = box(1.0, H - 1.5, 0.3, { sud: COL.legno, est: COL.legnoS,
                                               ovest: COL.legnoS, cima: COL.legno });
        porta.position.set(0, (H - 1.5)/2, S/2); g.add(porta);
        merli(g, lung, H, S, 'x');
      } else {
        // angoli: due bracci a L
        const seg = lung / 2;
        const bx = box(seg + S/2, H, S, {}); bx.position.y = H/2;
        const bz = box(S, H, seg + S/2, {}); bz.position.y = H/2;
        const sx = dir.includes('w') ? -1 : 1, sz = dir.includes('n') ? -1 : 1;
        bx.position.x = sx * (seg + S/2) / 2 * -1;
        bz.position.z = sz * (seg + S/2) / 2 * -1;
        g.add(bx); g.add(bz);
        const t = box(1.5, H + 1.0, 1.5, {}); t.position.y = (H + 1.0)/2; g.add(t);
        merli(g, 1.5, H + 1.0, 1.5, 'x');
      }
      return g;
    }

    // la trasformazione del motore: y schiaccia, e spinge indietro in z
    function inclina(obj) {
      obj.updateMatrixWorld(true);
      obj.traverse(o => {
        if (!o.isMesh) return;
        const g = o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i), z = pos.getZ(i);
          pos.setY(i, y * COS);
          pos.setZ(i, z - y * SIN);
        }
        pos.needsUpdate = true;
        g.computeBoundingBox();
        o.geometry = g;
        o.position.set(0,0,0); o.rotation.set(0,0,0); o.scale.set(1,1,1);
      });
    }

    const risultati = [];
    for (const [nome, lung, dir] of PEZZI) {
      const scene = new THREE.Scene();
      const g = costruisci(dir, lung);
      scene.add(g);
      inclina(g);

      const bb = new THREE.Box3().setFromObject(g);
      const w = bb.max.x - bb.min.x, h = bb.max.z - bb.min.z;
      const W = Math.ceil(w * PPU), H2 = Math.ceil(h * PPU);
      const cam = new THREE.OrthographicCamera(bb.min.x, bb.max.x,
                                               bb.max.z, bb.min.z, -500, 500);
      // guarda a piombo: -Y e' la profondita', +Z e' l'alto dello schermo
      cam.position.set(0, 200, 0);
      cam.up.set(0, 0, 1);
      cam.lookAt(0, 0, 0);

      const r = new THREE.WebGLRenderer({ alpha: true, antialias: false });
      r.setPixelRatio(1);
      r.setSize(W, H2, false);
      r.setClearColor(0x000000, 0);
      r.render(scene, cam);
      risultati.push({ nome, w: W, h: H2,
                       hu: +( (bb.max.z - bb.min.z) ).toFixed(2),
                       png: r.domElement.toDataURL('image/png') });
      r.dispose();
    }
    return risultati;
  }, PEZZI);

  for (const p of out) {
    fs.writeFileSync(`/home/claude/med/out/mura3d_${p.nome}.png`,
                     Buffer.from(p.png.split(',')[1], 'base64'));
  }
  console.log(JSON.stringify(out.map(o=>({nome:o.nome, px:`${o.w}x${o.h}`, hu:o.hu})), null, 1));
  if (errs.length) console.log('ERRORI', errs.slice(0,5));
  await b.close();
})();
