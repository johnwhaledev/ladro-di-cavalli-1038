// gfx.js — renderer 2.5D su three.js.
//
// Idea portante: la camera ha imbardata e inclinazione FISSE (come in GTA
// 1997), quindi tutti i billboard condividono lo stesso orientamento. Questo
// permette di cuocere l'inclinazione dentro la geometria e di disegnare
// centinaia di sprite statici con una draw call per chunk, invece di una per
// sprite. Il depth test fa da solo l'ordinamento: niente sorting per Y.
//
// L'illuminazione e' un ShaderMaterial con N luci puntiformi passate come
// uniform (torce, bracieri, falo'), piu' un colore ambiente che cambia con
// l'ora del giorno. Il fog e' lineare sulla distanza dalla camera.

const TILT = 58 * Math.PI / 180;     // inclinazione camera sull'orizzonte
const SIN_T = Math.sin(TILT), COS_T = Math.cos(TILT);
const MAX_LIGHTS = 24;

const Gfx = (() => {
  let renderer, scene, camera, clock;
  let env;                            // uniform condivise
  let terrainGroup, staticGroup, dynGroup, shadowGroup;
  let chunkCache = new Map();         // chunkKey → {mesh, tex, lastUsed}
  let world = null;
  let post = null;
  let size = { w: 1, h: 1, dpr: 1 };

  // ------------------------------------------------------------ shader

  const COMMON_UNIFORMS = () => ({
    uAtlas: { value: null },
    uAmbient: { value: new THREE.Color(1, 1, 1) },
    uLightPos: { value: Array.from({ length: MAX_LIGHTS },
                                   () => new THREE.Vector4()) },
    uLightCol: { value: Array.from({ length: MAX_LIGHTS },
                                   () => new THREE.Vector3()) },
    uLightCount: { value: 0 },
    uFogColor: { value: new THREE.Color(0.6, 0.66, 0.72) },
    uFogNear: { value: 90 },
    uFogFar: { value: 230 },
    uTime: { value: 0 },
    uCam: { value: new THREE.Vector3() },
    uBagnato: { value: 0 },          // la pioggia sul terreno (meteo.js)
    uCorrente: { value: new THREE.Vector2(0.12, 1) },   // dove vanno le onde (setEnvironment)
  });

  const LIGHT_GLSL = `
    uniform vec3 uAmbient;
    uniform vec4 uLightPos[${MAX_LIGHTS}];
    uniform vec3 uLightCol[${MAX_LIGHTS}];
    uniform int  uLightCount;
    uniform vec3 uFogColor;
    uniform float uFogNear, uFogFar;
    uniform vec3 uCam;
    varying vec3 vWorld;

    vec3 lighting(vec3 base) {
      vec3 l = uAmbient;
      for (int i = 0; i < ${MAX_LIGHTS}; i++) {
        if (i >= uLightCount) break;
        vec4 P = uLightPos[i];
        float d = distance(vWorld, P.xyz);
        float k = max(0.0, 1.0 - d / P.w);
        l += uLightCol[i] * k * k;
      }
      return base * l;
    }
    vec3 applyFog(vec3 c) {
      float d = distance(vWorld, uCam);
      float f = clamp((d - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
      return mix(c, uFogColor, f * 0.85);
    }`;

  // sprite: geometria gia' in coordinate mondo e gia' inclinata
  function spriteMaterial(atlas) {
    const u = COMMON_UNIFORMS();
    u.uAtlas.value = atlas;
    return new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: `
        attribute float aSway;
        attribute vec3 aTint;
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorld;
        varying vec3 vTint;
        void main() {
          vec3 p = position;
          // vento: solo i vertici alti oscillano (aSway vale 0 in basso)
          p.x += sin(uTime * 1.6 + p.z * 0.12 + p.x * 0.07) * aSway * 0.09;
          p.z += cos(uTime * 1.2 + p.x * 0.10) * aSway * 0.05;
          vWorld = p;
          vUv = uv;
          vTint = aTint;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D uAtlas;
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vTint;
        ${LIGHT_GLSL}
        void main() {
          vec4 t = texture2D(uAtlas, vUv);
          if (t.a < 0.5) discard;
          gl_FragColor = vec4(applyFog(lighting(t.rgb * vTint)), 1.0);
        }`,
      side: THREE.DoubleSide,
    });
  }

  function terrainMaterial() {
    const u = COMMON_UNIFORMS();
    u.uMask = { value: null };
    return new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorld;
        void main() {
          vUv = uv;
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D uAtlas;   // texture del chunk
        uniform sampler2D uMask;    // R = acqua
        uniform float uTime;
        uniform float uBagnato;
        uniform vec2 uCorrente;
        varying vec2 vUv;
        ${LIGHT_GLSL}
        float caso(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float rumore(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(caso(i), caso(i + vec2(1, 0)), f.x),
                     mix(caso(i + vec2(0, 1)), caso(i + vec2(1, 1)), f.x), f.y);
        }
        void main() {
          vec3 c = texture2D(uAtlas, vUv).rgb;
          float w = texture2D(uMask, vUv).r;
          if (uBagnato > 0.01 && w < 0.02) {
            // pioggia: la terra bagnata e' piu' scura, e nelle conche restano
            // pozzanghere ferme che riflettono il cielo, coi cerchi delle gocce.
            // Il rumore e' letto a 1/4 di unita': bordi a gradini, come i pixel
            vec2 q = floor(vWorld.xz * 4.0) / 4.0;
            float n = rumore(q * 0.3) * 0.6 + rumore(q * 0.9) * 0.4;
            float pozza = step(0.7, n) * min(1.0, uBagnato * 1.6);
            c *= 1.0 - 0.2 * uBagnato;
            c = mix(c, c * 0.35 + vec3(0.12, 0.14, 0.18), pozza * 0.85);
            vec2 cella = fract(q * 0.5) - 0.5;
            float onda = sin(length(cella) * 30.0 - uTime * 7.0 + caso(floor(q * 0.5)) * 6.3);
            c += vec3(0.07, 0.08, 0.1) * pozza * step(0.8, onda) * uBagnato;
          }
          if (w > 0.02) {
            // L'acqua si muove (25/09 notte: "le onde del mare ora ferme").
            // Prima c'era solo un luccichio sulla tile dipinta, ferma.
            // Tutto a gradini di 1/4 di unita', come i pixel
            vec2 q = floor(vWorld.xz * 4.0) / 4.0;
            float forza = 1.0 + uBagnato * 0.8;           // con la pioggia e' piu' mossa
            // 1. la tessitura ondeggia: la si rilegge spostata di qualche pixel
            vec2 sp = vec2(sin(q.y * 0.55 + uTime * 1.3) + sin(q.x * 0.31 - uTime * 0.9),
                           cos(q.x * 0.47 + uTime * 1.1) + sin(q.y * 0.23 + uTime * 0.7));
            c = mix(c, texture2D(uAtlas, vUv + sp * 0.0022 * w).rgb, w);
            // 2. le onde lunghe: fasce che scorrono con la corrente (verso la
            // riva nel mare, lungo il fiume nel fiume), piu' chiare in cresta
            vec2 dir = normalize(uCorrente);
            float fase = dot(q, dir) * 0.24 - uTime * 1.3 * forza
                       + rumore(q * 0.07 + uTime * 0.04) * 3.5;
            float onda = sin(fase);
            c *= 1.0 + 0.11 * onda * w * forza;
            float cresta = step(0.94, onda) * step(0.45, rumore(q * 0.6 + dir * uTime * 0.5));
            c = mix(c, vec3(0.76, 0.87, 0.92), cresta * 0.42 * w);
            // 3. la risacca: dove la maschera dell'acqua sfuma (la riva) la
            // schiuma arriva e si ritira
            float riva = clamp((1.0 - w) * 2.5, 0.0, 1.0);
            float va = sin(uTime * 1.6 * forza - riva * 5.0);
            float schiuma = step(0.55, va) * step(0.15, riva) * step(0.35, rumore(q * 1.3));
            c = mix(c, vec3(0.85, 0.92, 0.95), schiuma * 0.6);
            // 4. il cielo dell'ora nell'acqua (01/10): la tinta del colore
            // della nebbia (oro al tramonto, indaco di notte) a luminosita'
            // pari, cosi' non sbiadisce il mare cupo
            vec3 tinta = uFogColor / max(0.05, dot(uFogColor, vec3(0.3333)));
            c *= mix(vec3(1.0), tinta, 0.28 * w);
            // 5. i riflessi che scintillano, del colore del cielo
            float r = sin(vWorld.x * 0.9 + uTime * 1.7) * sin(vWorld.z * 0.7 - uTime * 1.1);
            c += mix(vec3(0.5, 0.6, 0.7), tinta * 0.6, 0.5) * pow(max(0.0, r), 6.0) * w * 0.3;
          }
          gl_FragColor = vec4(applyFog(lighting(c)), 1.0);
        }`,
    });
  }

  // ------------------------------------------------------------ chunk texture

  const TERRAIN_NAMES = () => Assets.manifest.terrain.order;
  const ORIENTATE = () => Assets.manifest.terrain.orientate || [];

  // l'atlas del terreno e' a righe: una riga per terreno, N varianti in colonna
  let tileCache = null;
  function tileOf(name, variant) {
    if (!tileCache) {
      tileCache = {};
      const img = Assets.tex.terrainImg;
      const V = Assets.manifest.terrain.variants || 1;
      TERRAIN_NAMES().forEach((n, row) => {
        tileCache[n] = [];
        for (let v = 0; v < V; v++) {
          const c = document.createElement('canvas');
          c.width = c.height = 64;
          c.getContext('2d').drawImage(img, v * 64, row * 64, 64, 64,
                                       0, 0, 64, 64);
          tileCache[n].push(c);
        }
      });
    }
    const list = tileCache[name];
    return list[((variant % list.length) + list.length) % list.length];
  }

  const TERRAIN_TO_NAME = ['erba', 'terra', 'fango', 'sabbia', 'ghiaia',
                           'pietra', 'acqua', 'acqua_cupa', 'neve', 'roccia'];

  function effTile(w, tx, ty) {
    if (!w.inside(tx, ty)) return 0;
    const r = w.road[w.idx(tx, ty)];
    if (r === 2) return 5;            // ciottoli
    if (r === 1) return 4;            // sterrato
    return w.terrain[w.idx(tx, ty)];
  }

  // maschera morbida riusata per sfumare il bordo fra due terreni diversi
  let edgeBrush = null;
  function makeEdgeBrush() {
    if (edgeBrush) return edgeBrush;
    edgeBrush = {};
    for (const side of ['t', 'b', 'l', 'r']) {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const pts = { t: [0, 0, 0, 34], b: [0, 64, 0, 30],
                    l: [0, 0, 34, 0], r: [64, 0, 30, 0] }[side];
      const gr = g.createLinearGradient(pts[0], pts[1], pts[2], pts[3]);
      gr.addColorStop(0, 'rgba(0,0,0,1)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      // bordo frastagliato: senza questo le transizioni sembrano stampate
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 90; i++) {
        const x = Math.random() * 64, y = Math.random() * 64;
        g.beginPath();
        g.arc(x, y, 2 + Math.random() * 5, 0, 7);
        g.fillStyle = 'rgba(0,0,0,' + (0.25 + Math.random() * 0.5) + ')';
        g.fill();
      }
      edgeBrush[side] = c;
    }
    return edgeBrush;
  }

  // Una cella di terreno copre 4 unita' di mondo. I tile dei fogli ChatGPT
  // disegnano pero' un ciottolo largo quasi un metro: stesi su 4 metri
  // sembrano massi. Li ripeto 2x2 dentro la cella, ognuno con una rotazione
  // diversa, cosi' la scala torna giusta e la griglia sparisce.
  function drawCell(g, name, px, py, PX, tx, ty) {
    const h = PX / 2;
    for (let b = 0; b < 2; b++) {
      for (let a = 0; a < 2; a++) {
        const sx = tx * 2 + a, sy = ty * 2 + b;
        const hsh = ((sx * 73856093) ^ (sy * 19349663)) >>> 0;
        g.save();
        g.translate(px + a * h + h / 2, py + b * h + h / 2);
        // una tile con un verso (le assi del fiordo: manifest terrain.orientate)
        // gira solo di mezzo giro, se no le assi fanno un parquet
        g.rotate(((ORIENTATE().includes(name) ? hsh & 2 : hsh & 3)) * Math.PI / 2);
        g.drawImage(tileOf(name, (hsh >> 2) & 7),
                    -h / 2 - 0.5, -h / 2 - 0.5, h + 1, h + 1);
        g.restore();
      }
    }
  }

  function buildChunkTexture(w, cx, cy) {
    const CT = 16, PX = 64;
    const c = document.createElement('canvas');
    c.width = c.height = CT * PX;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;

    const mc = document.createElement('canvas');
    mc.width = mc.height = CT * 4;
    const mg = mc.getContext('2d');
    mg.fillStyle = '#000';
    mg.fillRect(0, 0, mc.width, mc.height);

    const brush = makeEdgeBrush();
    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = PX;
    const tg = tmp.getContext('2d');

    for (let j = 0; j < CT; j++) {
      for (let i = 0; i < CT; i++) {
        const tx = cx * CT + i, ty = cy * CT + j;
        const t = effTile(w, tx, ty);
        const px = i * PX, py = j * PX;

        drawCell(g, TERRAIN_TO_NAME[t], px, py, PX, tx, ty);

        // sfuma i vicini diversi dentro questo tile
        const sides = [['t', 0, -1], ['b', 0, 1], ['l', -1, 0], ['r', 1, 0]];
        for (const [s, dx, dy] of sides) {
          const nt = effTile(w, tx + dx, ty + dy);
          if (nt === t) continue;
          tg.clearRect(0, 0, PX, PX);
          drawCell(tg, TERRAIN_TO_NAME[nt], 0, 0, PX, tx + dx, ty + dy);
          tg.globalCompositeOperation = 'destination-in';
          tg.drawImage(brush[s], 0, 0);
          tg.globalCompositeOperation = 'source-over';
          g.drawImage(tmp, px, py);
        }

        if (t === 6 || t === 7) {
          mg.fillStyle = '#fff';
          mg.fillRect(i * 4, j * 4, 4, 4);
        }
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const mask = new THREE.CanvasTexture(mc);
    mask.magFilter = THREE.LinearFilter;
    mask.minFilter = THREE.LinearFilter;
    return { tex, mask };
  }

  // ------------------------------------------------------------ geometria sprite

  // un billboard: base a terra in (x,z), inclinato all'indietro di TILT
  function pushQuad(arr, x, z, wu, hu, uv, flip, sway, tint, yBase = 0.02) {
    const hw = wu / 2;
    const ty = hu * COS_T, tz = -hu * SIN_T;
    const [u0, v0, u1, v1] = uv;
    const a = flip ? u1 : u0, b = flip ? u0 : u1;
    const P = arr.pos, U = arr.uv, S = arr.sway, C = arr.tint;
    // due triangoli: bl, br, tr / bl, tr, tl
    const vx = [x - hw, x + hw, x + hw, x - hw];
    const vy = [yBase, yBase, yBase + ty, yBase + ty];
    const vz = [z, z, z + tz, z + tz];
    const vu = [a, b, b, a], vv = [v0, v0, v1, v1];
    const vs = [0, 0, sway, sway];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      P.push(vx[k], vy[k], vz[k]);
      U.push(vu[k], vv[k]);
      S.push(vs[k]);
      C.push(tint[0], tint[1], tint[2]);
    }
  }

  // Variante ruotata: il quad giace nel piano della camera, quindi ruotarlo
  // sullo schermo vuol dire comporre l'asse orizzontale del mondo con l'asse
  // "su" della camera. Serve alle frecce, che devono puntare dove vanno.
  function pushQuadRot(arr, x, z, wu, hu, uv, ang, tint, yBase) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const hw = wu / 2, hh = hu / 2;
    const [u0, v0, u1, v1] = uv;
    const P = arr.pos, U = arr.uv, S = arr.sway, C = arr.tint;
    const loc = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    const vu = [u0, u1, u1, u0], vv = [v0, v0, v1, v1];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      const [lx, ly] = loc[k];
      const rx = lx * ca - ly * sa;        // asse X del mondo
      const ry = lx * sa + ly * ca;        // asse "su" della camera
      P.push(x + rx, yBase + ry * COS_T, z - ry * SIN_T);
      U.push(vu[k], vv[k]);
      S.push(0);
      C.push(tint[0], tint[1], tint[2]);
    }
  }

  // Quad steso sul terreno, ruotato di heading: per i mezzi disegnati a piombo
  // col muso in alto. Non e' un billboard, quindi ruota senza rivelare niente:
  // la camera ha imbardata fissa e il terreno lo vede come vede questo quad.
  function pushQuadGround(arr, x, z, wu, lu, uv, ang, tint, y) {
    const fx = Math.cos(ang), fz = Math.sin(ang);   // avanti = muso
    const rx = -fz, rz = fx;                        // destra dell'immagine
    const hw = wu / 2, hl = lu / 2;
    const [u0, v0, u1, v1] = uv;
    const P = arr.pos, U = arr.uv, S = arr.sway, C = arr.tint;
    // v0 e' il fondo dell'immagine (la coda), v1 la cima (il muso)
    const loc = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]];
    const vu = [u0, u1, u1, u0], vv = [v0, v0, v1, v1];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      const [lx, ly] = loc[k];
      P.push(x + lx * rx + ly * fx, y, z + lx * rz + ly * fz);
      U.push(vu[k], vv[k]);
      S.push(0);
      C.push(tint[0], tint[1], tint[2]);
    }
  }

  // Il fianco di un muro di taglio: un piano lungo z, in x fisso, dalla base
  // alla cima. Inclinato all'indietro come i billboard (la cima sta alto*sin
  // piu' a nord e alto*cos piu' su), cosi' combacia con la cima stesa. Di
  // fronte si vede di taglio; e' la prospettiva a mostrarlo quando il muro
  // sta di lato.
  // basso: da che altezza parte (l'architrave sopra un arco); di solito da terra
  function pushQuadParete(arr, x, z, lu, alto, uv, tint, basso = 0) {
    const [u0, v0, u1, v1] = uv;
    const yT = alto * COS_T, dz = alto * SIN_T, a = z - lu / 2, b = z + lu / 2;
    const y0 = Math.max(0.02, basso * COS_T), d0 = basso * SIN_T;
    const P = arr.pos, U = arr.uv, S = arr.sway, C = arr.tint;
    const vx = [[a - d0, y0, u0, v0], [b - d0, y0, u1, v0], [b - dz, yT, u1, v1], [a - dz, yT, u0, v1]];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      const [vz, vy, vu, vv] = vx[k];
      P.push(x, vy, vz);
      U.push(vu, vv);
      S.push(0);
      C.push(tint[0], tint[1], tint[2]);
    }
  }

  // da una direzione nel mondo all'angolo corrispondente sullo schermo
  function angoloSchermo(dx, dz) { return Math.atan2(-dz * SIN_T, dx); }

  function newBatch() { return { pos: [], uv: [], sway: [], tint: [] }; }

  function batchToGeometry(b) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(b.sway, 1));
    g.setAttribute('aTint', new THREE.Float32BufferAttribute(b.tint, 3));
    return g;
  }

  // ------------------------------------------------------------ ombre

  function shadowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)');
    gr.addColorStop(0.55, 'rgba(0,0,0,0.30)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.minFilter = t.magFilter = THREE.LinearFilter;
    return t;
  }

  function shadowMaterial(tex) {
    return new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false,
      blending: THREE.NormalBlending, opacity: 1,
    });
  }

  // Le ombre a macchia guardano in alto (prima i triangoli erano girati e il
  // materiale ha una faccia sola: erano invisibili da sempre). Si allungano
  // verso sud-est quando il sole e' basso: lo fa lo shader (uLunga, da
  // setEnvironment) con il centro e il raggio della macchia (aCentro), cosi'
  // anche quelle cotte nei chunk seguono il sole senza rifare i chunk (01/10;
  // prima solo i pezzi dinamici, stirati qui).
  function pushShadow(arr, x, z, r, alpha) {
    const P = arr.pos, U = arr.uv, A = arr.alpha;
    const vx = [x - r, x + r, x + r, x - r];
    const vz = [z - r * 0.62, z - r * 0.62, z + r * 0.62, z + r * 0.62];
    const vu = [0, 1, 1, 0], vv = [1, 1, 0, 0];
    for (const k of [0, 2, 1, 0, 3, 2]) {
      P.push(vx[k], 0.14, vz[k]);   // sotto 0,1 il depth buffer la perde
      U.push(vu[k], vv[k]);
      A.push(alpha);
      arr.centro.push(x, z, r);
    }
  }

  // Un'ombra netta a terra, rettangolare (l'arco di una porta sulla via):
  // tutti i vertici leggono lo stesso punto della texture, quindi niente
  // sfumatura. Non il centro esatto: dentro il cerchio interno del gradiente
  // il canvas non dipinge. Triangoli girati verso l'alto: il materiale delle
  // ombre ha una faccia sola, e quelli di pushShadow guardano in basso (per
  // questo le ombre a macchia non si vedono: trovato il 25/09 sera, non toccato).
  // o = { x0, z0, x1, z1, alpha }
  function pushShadowRett(arr, o) {
    const P = arr.pos, U = arr.uv, A = arr.alpha;
    const vx = [o.x0, o.x1, o.x1, o.x0], vz = [o.z0, o.z0, o.z1, o.z1];
    for (const k of [0, 2, 1, 0, 3, 2]) {
      P.push(vx[k], 0.012, vz[k]);
      U.push(0.5, 0.3);
      A.push(o.alpha);
      arr.centro.push(0, 0, 0);     // raggio 0: non si allunga
    }
  }

  // ------------------------------------------------------------ post

  function makePost() {
    const quad = new THREE.BufferGeometry();
    quad.setAttribute('position', new THREE.Float32BufferAttribute(
      [-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    quad.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const sc = new THREE.Scene();
    const mesh = new THREE.Mesh(quad, null);
    mesh.frustumCulled = false;
    sc.add(mesh);

    const vs = `varying vec2 vUv; void main(){ vUv = uv;
      gl_Position = vec4(position, 1.0); }`;

    const bright = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uThresh: { value: 0.72 } },
      vertexShader: vs,
      fragmentShader: `uniform sampler2D tDiffuse; uniform float uThresh;
        varying vec2 vUv;
        void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb;
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          gl_FragColor = vec4(c * smoothstep(uThresh, uThresh + 0.25, l), 1.0); }`,
    });

    const blur = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } },
      vertexShader: vs,
      fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uDir;
        varying vec2 vUv;
        void main(){ vec3 s = vec3(0.0);
          s += texture2D(tDiffuse, vUv - uDir * 3.0).rgb * 0.0702;
          s += texture2D(tDiffuse, vUv - uDir * 2.0).rgb * 0.1311;
          s += texture2D(tDiffuse, vUv - uDir).rgb       * 0.1907;
          s += texture2D(tDiffuse, vUv).rgb              * 0.2160;
          s += texture2D(tDiffuse, vUv + uDir).rgb       * 0.1907;
          s += texture2D(tDiffuse, vUv + uDir * 2.0).rgb * 0.1311;
          s += texture2D(tDiffuse, vUv + uDir * 3.0).rgb * 0.0702;
          gl_FragColor = vec4(s, 1.0); }`,
    });

    const comp = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, tBloom: { value: null },
        uBloom: { value: 0.42 }, uTime: { value: 0 },
        uVignette: { value: 0.62 }, uGrain: { value: 0.05 },
        uGrade: { value: new THREE.Vector3(1, 1, 1) },
        uFlash: { value: 0 },
      },
      vertexShader: vs,
      fragmentShader: `
        uniform sampler2D tDiffuse, tBloom;
        uniform float uBloom, uTime, uVignette, uGrain, uFlash;
        uniform vec3 uGrade;
        varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
        void main(){
          vec3 c = texture2D(tDiffuse, vUv).rgb;
          c += texture2D(tBloom, vUv).rgb * uBloom;
          c *= uGrade;
          c = mix(c, vec3(1.0, 0.86, 0.78), uFlash);
          // contrasto morbido, tiene i neri pieni senza spegnere i colori
          c = clamp((c - 0.5) * 1.09 + 0.5, 0.0, 1.0);
          float d = distance(vUv, vec2(0.5));
          c *= 1.0 - uVignette * smoothstep(0.34, 0.88, d);
          c += (hash(vUv * 900.0 + fract(uTime) * 100.0) - 0.5) * uGrain;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });

    return { sc, cam, mesh, bright, blur, comp, rt: null, rtA: null, rtB: null };
  }

  function resizeTargets() {
    const w = Math.max(2, Math.floor(size.w * size.dpr));
    const h = Math.max(2, Math.floor(size.h * size.dpr));
    const opt = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
                  format: THREE.RGBAFormat, depthBuffer: true };
    if (post.rt) { post.rt.dispose(); post.rtA.dispose(); post.rtB.dispose(); }
    // lo stencil: le sagome (sagome.js) non si sommano dove si sovrappongono
    post.rt = new THREE.WebGLRenderTarget(w, h, { ...opt, stencilBuffer: true });
    post.rtA = new THREE.WebGLRenderTarget(Math.max(2, w >> 2),
                                           Math.max(2, h >> 2), opt);
    post.rtB = new THREE.WebGLRenderTarget(Math.max(2, w >> 2),
                                           Math.max(2, h >> 2), opt);
  }

  // ------------------------------------------------------------ API

  function init(canvas, w) {
    world = w;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false,
                                         powerPreference: 'high-performance' });
    renderer.setClearColor(0x0a0d14, 1);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(34, 1, 1, 600);
    clock = new THREE.Clock();

    terrainGroup = new THREE.Group();
    shadowGroup = new THREE.Group();
    staticGroup = new THREE.Group();
    dynGroup = new THREE.Group();
    scene.add(terrainGroup, shadowGroup, staticGroup, dynGroup);

    env = { materials: [] };

    // materiali sprite: uno per gli statici, uno per i dinamici
    const mStatic = spriteMaterial(Assets.tex.world);
    const mDynW = spriteMaterial(Assets.tex.world);
    const mDynC = spriteMaterial(Assets.tex.chars);
    env.materials.push(mStatic, mDynW, mDynC);
    env.mStatic = mStatic; env.mDynW = mDynW; env.mDynC = mDynC;
    // le sagome proiettate (sagome.js): una per atlante
    env.sagomaW = Sagome.materiale(Assets.tex.world);
    env.sagomaC = Sagome.materiale(Assets.tex.chars);

    const shTex = shadowTexture();
    env.shadowMat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: shTex }, uStrength: { value: 1 }, uLunga: { value: 1 } },
      vertexShader: `attribute float aAlpha; attribute vec3 aCentro; uniform float uLunga;
        varying vec2 vUv; varying float vA;
        void main(){ vUv = uv; vA = aAlpha; vec3 p = position;
          if (aCentro.z > 0.0) {      // la macchia stirata verso sud-est
            float r = aCentro.z, L = uLunga;
            p.x = aCentro.x + (L - 1.0) * r * 0.6 + sign(p.x - aCentro.x) * r * L;
            p.z += (L - 1.0) * r * 0.22;
          }
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }`,
      fragmentShader: `uniform sampler2D uTex; uniform float uStrength;
        varying vec2 vUv; varying float vA;
        void main(){ float a = texture2D(uTex, vUv).a * vA * uStrength;
          if (a < 0.01) discard; gl_FragColor = vec4(0.04, 0.05, 0.08, a); }`,
      transparent: true, depthWrite: false,
    });

    env.staticMesh = null;
    env.dynMeshW = new THREE.Mesh(new THREE.BufferGeometry(), mDynW);
    env.dynMeshC = new THREE.Mesh(new THREE.BufferGeometry(), mDynC);
    env.shadowMesh = new THREE.Mesh(new THREE.BufferGeometry(), env.shadowMat);
    env.sagomeW = new THREE.Mesh(new THREE.BufferGeometry(), env.sagomaW);
    env.sagomeC = new THREE.Mesh(new THREE.BufferGeometry(), env.sagomaC);
    for (const m of [env.dynMeshW, env.dynMeshC, env.shadowMesh, env.sagomeW, env.sagomeC])
      m.frustumCulled = false;
    shadowGroup.add(env.sagomeW, env.sagomeC);
    dynGroup.add(env.dynMeshW, env.dynMeshC);
    shadowGroup.add(env.shadowMesh);
    env.shadowMesh.renderOrder = 1;

    post = makePost();
    resize(canvas.clientWidth || 960, canvas.clientHeight || 540);
    return { scene, camera, renderer };
  }

  // Un'altra citta' (viaggio.js), con l'altro atlante gia' caricato da
  // Assets.load: via i chunk e le tile del terreno della citta' di prima (si
  // rifanno dal mondo nuovo), e i materiali degli sprite sugli atlanti nuovi.
  // Il renderer, la camera e il post-processing restano quelli
  function cambiaMondo(w) {
    for (const k of [...chunkCache.keys()]) disposeChunk(k);
    tileCache = null;
    world = w;
    const vecchie = new Set();
    for (const [m, t] of [[env.mStatic, Assets.tex.world], [env.mDynW, Assets.tex.world],
                          [env.mDynC, Assets.tex.chars], [env.sagomaW, Assets.tex.world],
                          [env.sagomaC, Assets.tex.chars]]) {
      if (m.uniforms.uAtlas.value !== t) vecchie.add(m.uniforms.uAtlas.value);
      m.uniforms.uAtlas.value = t;
    }
    for (const t of vecchie) t.dispose();
  }

  function resize(w, h) {
    size.w = w; size.h = h;
    size.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(size.dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    resizeTargets();
  }

  // --- chunk statici --------------------------------------------------------

  function ensureChunk(cx, cy) {
    const key = cy * CH_N + cx;
    let e = chunkCache.get(key);
    if (e) { e.used = performance.now(); return e; }
    if (cx < 0 || cy < 0 || cx >= CH_N || cy >= CH_N) return null;

    const { tex, mask } = buildChunkTexture(world, cx, cy);
    const mat = terrainMaterial();
    mat.uniforms.uAtlas.value = tex;
    mat.uniforms.uMask.value = mask;
    env.materials.push(mat);
    const S = CH_T * TILE;
    const geo = new THREE.PlaneGeometry(S, S, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx * S + S / 2, 0, cy * S + S / 2);
    terrainGroup.add(mesh);

    // sprite statici del chunk, cotti in una sola geometria
    const b = newBatch();
    const sb = { pos: [], uv: [], alpha: [], centro: [] };
    const sg = Sagome.nuove();
    for (const p of (world.propsByChunk.get(key) || [])) {
      const r = Assets.world(p.name);
      if (!r) continue;
      if (p.ombraRett) pushShadowRett(sb, p.ombraRett);
      if (p.piano) {
        // steso e rialzato (la cima del muro di taglio): all'altezza `alto`
        // di un billboard, cioe' dove un pezzo in piedi con la base in p.z
        // avrebbe la cima
        // specchio: il disegno rovesciato da destra a sinistra (i moli con
        // l'acqua a levante, world_porto.js)
        const a = p.piano.alto, uv = Assets.worldUV(r);
        pushQuadGround(b, p.x, p.z - a * SIN_T, p.wu, p.hu,
                       p.piano.specchio ? [uv[2], uv[1], uv[0], uv[3]] : uv,
                       p.piano.ang, [1, 1, 1], a * COS_T);
        continue;
      }
      if (p.parete) {
        pushQuadParete(b, p.x, p.z, p.hu, p.parete.alto, Assets.worldUV(r), [0.82, 0.8, 0.8],
                       p.parete.basso || 0);
        if (Sagome.delMuro(p.name)) Sagome.fascia(sg, p.x, p.z, p.hu, p.parete.alto, Assets.worldUV(r));
        continue;
      }
      if (p.sopra) {
        // in piedi su un piano rialzato (lo stendardo sulla torre): la base
        // dove un billboard alto `sopra` con la base in p.z avrebbe la cima,
        // quindi davanti al piano e non dietro
        const a = p.sopra;
        pushQuad(b, p.x, p.z - a * SIN_T, p.wu, p.hu, Assets.worldUV(r), p.flip,
                 p.sway, [1, 1, 1], a * COS_T + 0.02);
        continue;
      }
      pushQuad(b, p.x, p.z, p.wu, p.hu, Assets.worldUV(r), p.flip,
               p.sway, [1, 1, 1]);
      if (p.shadow) {
        pushShadow(sb, p.x, p.z, Math.max(0.6, p.wu * 0.42), 0.85);
        Sagome.aggiungi(sg, p.x, p.z, p.wu, p.hu, Assets.worldUV(r), p.flip);
      } else if (Sagome.delMuro(p.name)) {
        Sagome.aggiungi(sg, p.x, p.z, p.wu, p.hu, Assets.worldUV(r), p.flip);
      }
    }
    let sMesh = null, shMesh = null, sgMesh = null;
    if (sg.pos.length) {
      sgMesh = new THREE.Mesh(Sagome.geometria(sg), env.sagomaW);
      sgMesh.frustumCulled = false;
      shadowGroup.add(sgMesh);
    }
    if (b.pos.length) {
      sMesh = new THREE.Mesh(batchToGeometry(b), env.mStatic);
      sMesh.frustumCulled = false;
      staticGroup.add(sMesh);
    }
    if (sb.pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(sb.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(sb.uv, 2));
      g.setAttribute('aAlpha', new THREE.Float32BufferAttribute(sb.alpha, 1));
      g.setAttribute('aCentro', new THREE.Float32BufferAttribute(sb.centro, 3));
      shMesh = new THREE.Mesh(g, env.shadowMat);
      shMesh.frustumCulled = false;
      shMesh.renderOrder = 1;
      shadowGroup.add(shMesh);
    }

    e = { mesh, mat, tex, mask, sMesh, shMesh, sgMesh, used: performance.now() };
    chunkCache.set(key, e);
    return e;
  }

  function disposeChunk(key) {
    const e = chunkCache.get(key);
    if (!e) return;
    terrainGroup.remove(e.mesh);
    e.mesh.geometry.dispose();
    e.tex.dispose(); e.mask.dispose();
    const i = env.materials.indexOf(e.mat);
    if (i >= 0) env.materials.splice(i, 1);
    e.mat.dispose();
    if (e.sMesh) { staticGroup.remove(e.sMesh); e.sMesh.geometry.dispose(); }
    if (e.shMesh) { shadowGroup.remove(e.shMesh); e.shMesh.geometry.dispose(); }
    if (e.sgMesh) { shadowGroup.remove(e.sgMesh); e.sgMesh.geometry.dispose(); }
    chunkCache.delete(key);
  }

  // Butta via i chunk attorno a un punto: alla prossima passata si
  // ricostruiscono dai dati aggiornati. Serve quando il mondo cambia — per
  // esempio quando un accampamento cambia bandiera.
  function invalidaIntorno(x, z, raggio) {
    const S = CH_T * TILE;
    const c0 = Math.floor((x - raggio) / S), c1 = Math.floor((x + raggio) / S);
    const d0 = Math.floor((z - raggio) / S), d1 = Math.floor((z + raggio) / S);
    for (let cy = d0; cy <= d1; cy++)
      for (let cx = c0; cx <= c1; cx++) {
        if (cx < 0 || cy < 0 || cx >= CH_N || cy >= CH_N) continue;
        disposeChunk(cy * CH_N + cx);
      }
  }

  function updateChunks(px, pz, radius = 2) {
    const S = CH_T * TILE;
    const cx = Math.floor(px / S), cy = Math.floor(pz / S);
    const want = new Set();
    for (let j = -radius; j <= radius; j++)
      for (let i = -radius; i <= radius; i++) {
        const a = cx + i, b = cy + j;
        if (a < 0 || b < 0 || a >= CH_N || b >= CH_N) continue;
        want.add(b * CH_N + a);
      }
    // un chunk per frame: costruire la texture costa ~15 ms, meglio spalmarlo
    for (const k of want) {
      if (!chunkCache.has(k)) {
        ensureChunk(k % CH_N, Math.floor(k / CH_N));
        break;
      }
    }
    for (const k of [...chunkCache.keys()]) {
      if (!want.has(k)) disposeChunk(k);
      else chunkCache.get(k).used = performance.now();
    }
    for (const k of want) {
      const e = chunkCache.get(k);
      if (e) { e.mesh.visible = true; if (e.sMesh) e.sMesh.visible = true; }
    }
  }

  // --- sprite dinamici ------------------------------------------------------

  const dynW = newBatch(), dynC = newBatch();
  const dynS = { pos: [], uv: [], alpha: [], centro: [] };
  const dynSgW = Sagome.nuove(), dynSgC = Sagome.nuove();

  function beginFrame() {
    for (const b of [dynW, dynC])
      { b.pos.length = 0; b.uv.length = 0; b.sway.length = 0; b.tint.length = 0; }
    dynS.pos.length = 0; dynS.uv.length = 0; dynS.alpha.length = 0; dynS.centro.length = 0;
    Sagome.svuota(dynSgW); Sagome.svuota(dynSgC);
  }

  // sulle assi di un ponte o di un molo (world.sopraAssi, 07/10): chi ci sta
  // sopra si alza sopra il piano, se no gli spariscono i piedi
  const sopraAssi = (x, z) => (world && world.sopraAssi && world.sopraAssi(x, z) ? 0.2 : 0);

  function drawWorldSprite(name, x, z, opt = {}) {
    const r = Assets.world(name);
    if (!r) return;
    const s = opt.scale || 1;
    pushQuad(dynW, x, z, (opt.wu || r.wu) * s, (opt.hu || r.hu) * s,
             Assets.worldUV(r), !!opt.flip, opt.sway || 0,
             opt.tint || [1, 1, 1], opt.y === undefined ? 0.03 + sopraAssi(x, z) : opt.y);
    if (opt.shadow !== false) {
      pushShadow(dynS, x, z, Math.max(0.6, (opt.wu || r.wu) * s * 0.42),
                 opt.shadowAlpha === undefined ? 0.9 : opt.shadowAlpha);
      Sagome.aggiungi(dynSgW, x, z, (opt.wu || r.wu) * s, (opt.hu || r.hu) * s,
                      Assets.worldUV(r), !!opt.flip, opt.y || 0);
    }
  }

  function drawWorldSpriteRot(name, x, z, ang, opt = {}) {
    const r = Assets.world(name);
    if (!r) return;
    const s = opt.scale || 1;
    pushQuadRot(dynW, x, z, (opt.wu || r.wu) * s, (opt.hu || r.hu) * s,
                Assets.worldUV(r), ang, opt.tint || [1, 1, 1],
                opt.y === undefined ? 1.0 : opt.y);
  }

  function drawWorldSpriteGround(name, x, z, ang, opt = {}) {
    const r = Assets.world(name);
    if (!r) return;
    // 0.15 e non 0.04: con la camera larga della guida veloce (~70 unita') un
    // depth buffer a 16 bit ha un passo di ~0.07 e il carro sfarfallava a righe
    pushQuadGround(dynW, x, z, opt.wu || r.wu, opt.hu || r.hu, Assets.worldUV(r), ang,
                   opt.tint || [1, 1, 1], opt.y === undefined ? 0.15 + sopraAssi(x, z) : opt.y);
  }

  function drawChar(name, anim, frame, x, z, opt = {}) {
    const d = Assets.charDef(name);
    const r = Assets.charFrame(name, anim, frame);
    if (!d || !r) return;
    const s = opt.scale || 1;
    const k = s / d.ppu;                       // px sorgente → unita' di mondo
    const wu = r.w * k, hu = r.h * k;
    // alzo il ritaglio di quanto sta sopra il piano d'appoggio del personaggio:
    // senza questo i frame di attacco o di morte fanno affondare i piedi
    const baseY = (d.ground - (r.oy + r.h)) * k;
    // e riporto il centro su quello del corpo, non su quello del ritaglio,
    // altrimenti un'arma che sporge fa scivolare di lato il personaggio
    const dx = ((r.ox + r.w / 2) - d.cx) * k * (opt.flip ? -1 : 1);
    pushQuad(dynC, x + dx, z, wu, hu, Assets.charUV(r), !!opt.flip, 0,
             opt.tint || [1, 1, 1], (opt.y === undefined ? 0.02 : opt.y) + baseY + sopraAssi(x, z));
    if (opt.shadow !== false) {
      pushShadow(dynS, x, z, Math.max(0.42, wu * 0.44),
                 opt.shadowAlpha === undefined ? 1 : opt.shadowAlpha);
      Sagome.aggiungi(dynSgC, x + dx, z, wu, hu, Assets.charUV(r), !!opt.flip,
                      (opt.y || 0) + baseY);
    }
  }

  function uploadBatch(mesh, b) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(b.sway, 1));
    g.setAttribute('aTint', new THREE.Float32BufferAttribute(b.tint, 3));
    mesh.geometry.dispose();
    mesh.geometry = g;
  }

  // --- ambiente -------------------------------------------------------------

  function setEnvironment(o) {
    for (const m of env.materials) {
      const u = m.uniforms;
      u.uAmbient.value.setRGB(o.ambient[0], o.ambient[1], o.ambient[2]);
      u.uFogColor.value.setRGB(o.fog[0], o.fog[1], o.fog[2]);
      u.uFogNear.value = o.fogNear;
      u.uFogFar.value = o.fogFar;
      u.uTime.value = o.time;
      u.uBagnato.value = o.bagnato || 0;
      // il mare (una pianta con acqua(), il fiordo) spinge le onde a riva,
      // verso levante (con l'acqua a levante verso ponente); il fiume scorre
      // verso sud, quello del borgo di fiume (06/10) verso ponente
      if (world.pianta.LATO_ACQUA === 'S') u.uCorrente.value.set(-1, 0.12);
      else if (world.pianta.acqua) u.uCorrente.value.set(world.pianta.LATO_ACQUA === 1 ? -1 : 1, 0.15);
      else u.uCorrente.value.set(0.12, 1);
      u.uCam.value.copy(camera.position);
      let n = 0;
      for (const L of o.lights) {
        if (n >= MAX_LIGHTS) break;
        u.uLightPos.value[n].set(L.x, L.y, L.z, L.radius);
        u.uLightCol.value[n].set(L.color[0] * L.mul, L.color[1] * L.mul,
                                 L.color[2] * L.mul);
        n++;
      }
      u.uLightCount.value = n;
    }
    env.shadowMat.uniforms.uStrength.value = o.shadowStrength;
    env.shadowMat.uniforms.uLunga.value = o.shadowLen || 1;
    Sagome.ambiente([env.sagomaW, env.sagomaC], o);
    post.comp.uniforms.uTime.value = o.time;
    post.comp.uniforms.uGrade.value.set(o.grade[0], o.grade[1], o.grade[2]);
    post.comp.uniforms.uBloom.value = o.bloom;
    post.comp.uniforms.uFlash.value = o.flash || 0;
    post.comp.uniforms.uVignette.value = o.vignette === undefined ? 0.62 : o.vignette;
    renderer.setClearColor(new THREE.Color(o.fog[0], o.fog[1], o.fog[2]), 1);
  }

  function setCamera(x, z, dist, shake = 0) {
    const sx = shake ? (Math.random() - 0.5) * shake : 0;
    const sz = shake ? (Math.random() - 0.5) * shake : 0;
    camera.position.set(x + sx, dist * SIN_T, z + dist * COS_T + sz);
    camera.lookAt(x, 0, z);
  }

  function render() {
    uploadBatch(env.dynMeshW, dynW);
    uploadBatch(env.dynMeshC, dynC);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(dynS.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(dynS.uv, 2));
    g.setAttribute('aAlpha', new THREE.Float32BufferAttribute(dynS.alpha, 1));
    g.setAttribute('aCentro', new THREE.Float32BufferAttribute(dynS.centro, 3));
    env.shadowMesh.geometry.dispose();
    env.shadowMesh.geometry = g;
    for (const [m, s] of [[env.sagomeW, dynSgW], [env.sagomeC, dynSgC]]) {
      m.geometry.dispose();
      m.geometry = Sagome.geometria(s);
    }

    renderer.setRenderTarget(post.rt);
    renderer.clear();
    renderer.render(scene, camera);

    post.mesh.material = post.bright;
    post.bright.uniforms.tDiffuse.value = post.rt.texture;
    renderer.setRenderTarget(post.rtA);
    renderer.render(post.sc, post.cam);

    post.mesh.material = post.blur;
    post.blur.uniforms.tDiffuse.value = post.rtA.texture;
    post.blur.uniforms.uDir.value.set(1 / post.rtA.width, 0);
    renderer.setRenderTarget(post.rtB);
    renderer.render(post.sc, post.cam);

    post.blur.uniforms.tDiffuse.value = post.rtB.texture;
    post.blur.uniforms.uDir.value.set(0, 1 / post.rtA.height);
    renderer.setRenderTarget(post.rtA);
    renderer.render(post.sc, post.cam);

    post.mesh.material = post.comp;
    post.comp.uniforms.tDiffuse.value = post.rt.texture;
    post.comp.uniforms.tBloom.value = post.rtA.texture;
    renderer.setRenderTarget(null);
    renderer.render(post.sc, post.cam);
  }

  return { init, cambiaMondo, resize, updateChunks, invalidaIntorno,
           beginFrame, drawWorldSprite,
           drawWorldSpriteRot, drawWorldSpriteGround, angoloSchermo, drawChar,
           groups: () => ({ terrainGroup, staticGroup, dynGroup, shadowGroup }),
           setEnvironment, setCamera, render, TILT,
           get info() { return renderer.info; },
           get camera() { return camera; } };
})();
