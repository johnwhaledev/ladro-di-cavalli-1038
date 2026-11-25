// sagome.js — le ombre proiettate (07/10, tua scelta: "ombre da fare"):
// ogni pezzo in piedi getta a terra la sua sagoma scura, la stessa figura
// dell'atlante stesa sul terreno dalla sua base e stirata verso nord-est (la
// luce dei disegni viene da sinistra in alto): lunga al mattino e alla sera,
// corta a mezzogiorno, tenue di notte. La lunghezza la fa lo shader (uDir,
// da `ambiente`), quindi le sagome cotte nei chunk seguono il sole senza
// rifare i chunk. Lo stencil (gfx.js, post.rt) segna dove c'e' gia' ombra:
// due sagome che si sovrappongono non si scuriscono l'una con l'altra. Le
// macchie sotto i piedi (gfx.js, pushShadow) restano: sono il contatto col
// suolo.

const Sagome = (() => {
  const DIR = [0.55, -0.34];   // per unita' d'altezza, col sole a mezzogiorno
  const Y = 0.16;              // sopra il terreno (sotto 0,1 il depth buffer la perde)
  const SCURO = 0.4;           // quanto scurisce, col sole pieno

  function nuove() { return { pos: [], uv: [], h: [] }; }
  function svuota(s) { s.pos.length = 0; s.uv.length = 0; s.h.length = 0; }

  // La sagoma di un billboard (gfx.js, pushQuad): la base larga wu sulla riga
  // z, la cima alta hu; h0 e' quanto la figura sta sopra il suolo (i
  // personaggi a mezz'aria nei salti)
  function aggiungi(s, x, z, wu, hu, uv, flip, h0 = 0) {
    const hw = wu / 2, [u0, v0, u1, v1] = uv;
    const a = flip ? u1 : u0, b = flip ? u0 : u1;
    const vx = [x - hw, x + hw, x + hw, x - hw], vh = [h0, h0, h0 + hu, h0 + hu];
    const vu = [a, b, b, a], vv = [v0, v0, v1, v1];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      s.pos.push(vx[k], Y, z);
      s.uv.push(vu[k], vv[k]);
      s.h.push(vh[k]);
    }
  }

  // Mura e palizzate (07/10, tua scelta): i loro pezzi non hanno la macchia
  // sotto (shadow: false: una fila di pali faceva una fascia di macchie), ma
  // la sagoma si'. Per nome, in tutte le citta'
  const MURI = new Set(['cinta_campata', 'palo_corte_a', 'palo_corte_b', 'palo_corte_c',
                        'palo_palizzata_a', 'palo_palizzata_b', 'palo_palizzata_c']);
  function delMuro(nome) { return MURI.has(nome); }

  // La sagoma del fianco di un muro visto di taglio (gfx.js, pushQuadParete):
  // una fascia piena, dalla base lunga lu lungo z alla cima alta `alto`. Il
  // colore lo prende dal centro del disegno del muro, che e' pieno
  function fascia(s, x, z, lu, alto, uv) {
    const u = (uv[0] + uv[2]) / 2, v = (uv[1] + uv[3]) / 2;
    const vz = [z - lu / 2, z + lu / 2, z + lu / 2, z - lu / 2], vh = [0, 0, alto, alto];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      s.pos.push(x, Y, vz[k]);
      s.uv.push(u, v);
      s.h.push(vh[k]);
    }
  }

  function geometria(s) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(s.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(s.uv, 2));
    g.setAttribute('aH', new THREE.Float32BufferAttribute(s.h, 1));
    return g;
  }

  function materiale(atlante) {
    return new THREE.ShaderMaterial({
      uniforms: { uAtlas: { value: atlante }, uDir: { value: new THREE.Vector2(DIR[0], DIR[1]) },
                  uScuro: { value: SCURO } },
      vertexShader: `attribute float aH; uniform vec2 uDir; varying vec2 vUv;
        void main(){ vUv = uv; vec3 p = position; p.x += uDir.x * aH; p.z += uDir.y * aH;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `uniform sampler2D uAtlas; uniform float uScuro; varying vec2 vUv;
        void main(){ if (texture2D(uAtlas, vUv).a < 0.5) discard;
          gl_FragColor = vec4(0.03, 0.04, 0.08, uScuro); }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc,
      stencilZPass: THREE.ReplaceStencilOp,
    });
  }

  // L'ora (ambiente.js, Meteo.applica): shadowLen va da 1 a mezzogiorno a 2,6
  // al tramonto, shadowStrength da 1 col sole pieno a 0,4 di notte (e sotto
  // la pioggia meno)
  function ambiente(materiali, o) {
    const L = Math.min(2, o.shadowLen || 1), k = o.shadowStrength === undefined ? 1 : o.shadowStrength;
    for (const m of materiali) {
      m.uniforms.uDir.value.set(DIR[0] * L, DIR[1] * L);
      m.uniforms.uScuro.value = SCURO * k;
    }
  }

  return { nuove, svuota, aggiungi, fascia, delMuro, geometria, materiale, ambiente };
})();
