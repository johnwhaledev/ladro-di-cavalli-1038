// nav.js — navigazione sulle vie: A* sulla griglia delle collisioni.
//
// Prima chi doveva andare da qualche parte puntava dritto alla meta e, se
// sbatteva, strisciava lungo il muro: il messaggero della ronda non arrivava
// dal collega dietro l'isolato e il passante restava a rimbalzare contro una
// facciata. Qui si cerca la strada sulla stessa griglia a mezzo tile che usa
// world.blocked(), con le vie che costano meno del resto: il percorso passa
// per le strade quando puo', e taglia per un cortile solo se conviene.

const Nav = (() => {
  const COSTO_FUORI_STRADA = 2.2;     // una cella fuori via vale piu' di due sulla via
  const MAX_NODI = 7000;              // oltre, meglio nessuna strada che un fotogramma perso
  const MARGINE = 24;                 // celle attorno al rettangolo partenza-meta

  // heap binario minimo su (f, cella)
  function Heap() {
    const f = [], c = [];
    return {
      get n() { return f.length; },
      push(ff, cc) {
        let i = f.length;
        f.push(ff); c.push(cc);
        while (i > 0) {
          const p = (i - 1) >> 1;
          if (f[p] <= f[i]) break;
          [f[p], f[i]] = [f[i], f[p]]; [c[p], c[i]] = [c[i], c[p]];
          i = p;
        }
      },
      pop() {
        const top = c[0];
        const lf = f.pop(), lc = c.pop();
        if (f.length) {
          f[0] = lf; c[0] = lc;
          let i = 0;
          for (;;) {
            const l = 2 * i + 1, r = l + 1;
            let m = i;
            if (l < f.length && f[l] < f[m]) m = l;
            if (r < f.length && f[r] < f[m]) m = r;
            if (m === i) break;
            [f[m], f[i]] = [f[i], f[m]]; [c[m], c[i]] = [c[i], c[m]];
            i = m;
          }
        }
        return top;
      },
    };
  }

  // la cella libera piu' vicina (entro 3): chi parte o arriva a ridosso di un
  // muro sta su una cella che la griglia da' per piena
  function libera(w, cx, cy) {
    const N = w.solidN;
    for (let r = 0; r <= 3; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx + dx, y = cy + dy;
          if (x >= 0 && y >= 0 && x < N && y < N && !w.solid[y * N + x]) return [x, y];
        }
    return null;
  }

  // il segmento e' percorribile da chi ha raggio r? (campionato ogni mezza
  // unita'; con partenza e arrivo uguali controlla il punto: prima 0/0 dava
  // NaN e il punto risultava sempre sgombro)
  function sgombro(w, x0, z0, x1, z1, r) {
    const d = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(d / 0.5));
    for (let i = 0; i <= n; i++) {
      const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n;
      if (w.blocked(x + r, z) || w.blocked(x - r, z) ||
          w.blocked(x, z + r) || w.blocked(x, z - r)) return false;
    }
    return true;
  }

  // [{x, z}, ...] dalla partenza (esclusa) alla meta, o null se non c'e' strada
  function percorso(w, x0, z0, x1, z1) {
    const N = w.solidN, S = w.solidS;
    const a = libera(w, Math.floor(x0 / S), Math.floor(z0 / S));
    const b = libera(w, Math.floor(x1 / S), Math.floor(z1 / S));
    if (!a || !b) return null;
    const bx0 = Math.max(0, Math.min(a[0], b[0]) - MARGINE);
    const by0 = Math.max(0, Math.min(a[1], b[1]) - MARGINE);
    const bx1 = Math.min(N - 1, Math.max(a[0], b[0]) + MARGINE);
    const by1 = Math.min(N - 1, Math.max(a[1], b[1]) + MARGINE);
    const W = bx1 - bx0 + 1, H = by1 - by0 + 1;
    const g = new Float32Array(W * H).fill(Infinity);
    const da = new Int32Array(W * H).fill(-1);
    const chiusa = new Uint8Array(W * H);
    const loc = (x, y) => (y - by0) * W + (x - bx0);
    const h = (x, y) => Math.hypot(x - b[0], y - b[1]);
    const costo = (x, y) => {
      const t = w.road[w.idx(Math.floor(x * S / TILE), Math.floor(y * S / TILE))];
      return t ? 1 : COSTO_FUORI_STRADA;
    };
    const aperti = Heap();
    const s = loc(a[0], a[1]), e = loc(b[0], b[1]);
    g[s] = 0;
    aperti.push(h(a[0], a[1]), s);
    let visti = 0, trovata = false;
    while (aperti.n) {
      const k = aperti.pop();
      if (chiusa[k]) continue;
      chiusa[k] = 1;
      if (k === e) { trovata = true; break; }
      if (++visti > MAX_NODI) break;
      const x = k % W + bx0, y = Math.floor(k / W) + by0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < bx0 || ny < by0 || nx > bx1 || ny > by1) continue;
          if (w.solid[ny * N + nx]) continue;
          // in diagonale solo se i due lati sono liberi: niente spigoli tagliati
          if (dx && dy && (w.solid[y * N + nx] || w.solid[ny * N + x])) continue;
          const j = loc(nx, ny);
          if (chiusa[j]) continue;
          const ng = g[k] + (dx && dy ? 1.414 : 1) * costo(nx, ny);
          if (ng < g[j]) {
            g[j] = ng; da[j] = k;
            aperti.push(ng + h(nx, ny), j);
          }
        }
    }
    if (!trovata) return null;

    const celle = [];
    for (let k = e; k !== -1; k = da[k])
      celle.push({ x: (k % W + bx0 + 0.5) * S, z: (Math.floor(k / W) + by0 + 0.5) * S });
    celle.reverse();
    celle[celle.length - 1] = { x: x1, z: z1 };

    // tira il filo: dei punti della griglia restano solo gli angoli
    const punti = [];
    let px = x0, pz = z0, i = 0;
    while (i < celle.length) {
      let j = i;
      while (j + 1 < celle.length && sgombro(w, px, pz, celle[j + 1].x, celle[j + 1].z, 0.45))
        j++;
      punti.push(celle[j]);
      px = celle[j].x; pz = celle[j].z;
      i = j + 1;
    }
    return punti;
  }

  // Direzione per `a` verso `meta` lungo la strada. La rotta si ricalcola se
  // la meta si sposta di molto o se `a` resta fermo contro qualcosa (a.fermoT,
  // tenuto da chi muove), ma non piu' di due volte al secondo. Ritorna
  // l'angolo, o null se la strada non c'e' (e allora si punta dritto).
  function direzione(w, a, meta, adesso) {
    const r = a.rotta;
    const scaduta = !r || Math.hypot(r.meta.x - meta.x, r.meta.z - meta.z) > 6 ||
                    (a.fermoT || 0) > 0.6;
    if (scaduta && !(adesso < (a.rottaT || 0))) {
      a.rottaT = adesso + 0.5;
      a.fermoT = 0;
      const punti = percorso(w, a.x, a.z, meta.x, meta.z);
      a.rotta = punti ? { meta: { x: meta.x, z: meta.z }, punti, i: 0 } : null;
    }
    const q = a.rotta;
    if (!q) return null;
    while (q.i < q.punti.length - 1 &&
           Math.hypot(q.punti[q.i].x - a.x, q.punti[q.i].z - a.z) < 1.2) q.i++;
    const p = q.punti[q.i];
    return Math.atan2(p.z - a.z, p.x - a.x);
  }

  return { percorso, direzione, sgombro };
})();
