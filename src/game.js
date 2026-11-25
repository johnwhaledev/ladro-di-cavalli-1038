// game.js — ciclo di gioco, IA, missioni, ricercato, ciclo giorno/notte.

const Game = (() => {
  let world, player, canvas;
  let npcs = [], guards = [], beasts = [], nemici = [], vehicles = [], givers = [];
  let particles = [];
  const input = { up: 0, down: 0, left: 0, right: 0, run: 0, atk: 0, act: 0, tenda: 0 };
  let time = 0, dayT = 0.30, flash = 0;

  // ---------------------------------------------------------------- camera
  //
  // In GTA la camera non e' un treppiede incollato al personaggio: anticipa
  // dove stai andando, si allarga quando corri e quando hai la ronda alle
  // calcagna, e torna a centrarsi quando ti fermi. Qui e' uno smorzatore
  // esponenziale su tre grandezze (posizione, distanza, anticipo), piu' due
  // effetti a tempo: lo sguardo verso l'obiettivo quando parte una missione,
  // e lo scossone sugli impatti.
  const cam = {
    x: 0, z: 0,            // posizione smorzata
    dist: 58,              // distanza smorzata
    leadX: 0, leadZ: 0,    // anticipo smorzato
    shake: 0,              // intensita' residua dello scossone
    peek: null,            // {x, z, t} sguardo temporaneo verso un punto
    fermo: 0,              // da quanto il giocatore e' fermo
  };
  const CAM = {
    baseAPiedi: 52, baseCorsa: 58, baseVeicolo: 62,
    anticipoAPiedi: 8.0, anticipoVeicolo: 18.0,
    perStella: 2.6, maxDist: 92,
    inseguimento: 2.7,     // quanto in fretta la camera raggiunge il bersaglio
    inseguimentoZoom: 1.9,
  };

  function scuoti(n) { cam.shake = Math.min(1.6, cam.shake + n); }

  function guarda(punto, durata = 1.6) {
    if (!punto) return;
    cam.peek = { x: punto.x, z: punto.z, t: durata, max: durata };
  }

  function updateCamera(dt) {
    const p = player;
    const v = p.vehicle;
    const vel = v ? Math.abs(v.speed) : Math.hypot(p.vx, p.vz);
    const correndo = !v && vel > p.speed + 0.5;

    // anticipo: la direzione in cui ti muovi, scalata sulla velocita'
    const maxLead = v ? CAM.anticipoVeicolo : CAM.anticipoAPiedi;
    let dx = 0, dz = 0;
    if (vel > 0.4) {
      const dirX = v ? Math.cos(v.rot) : p.vx / (vel || 1);
      const dirZ = v ? Math.sin(v.rot) : p.vz / (vel || 1);
      const k = Math.min(1, vel / (v ? v.maxSpeed : p.runSpeed));
      dx = dirX * maxLead * k;
      dz = dirZ * maxLead * k;
      cam.fermo = 0;
    } else {
      cam.fermo += dt;
    }
    // da fermo l'anticipo rientra: la camera torna a centrarti addosso
    const rientro = cam.fermo > 0.5 ? 2.6 : 1.0;
    const kl = 1 - Math.exp(-dt * 2.2 * rientro);
    cam.leadX += (dx - cam.leadX) * kl;
    cam.leadZ += (dz - cam.leadZ) * kl;

    // distanza: a piedi stretta, di corsa e in sella larga, e piu' larga
    // ancora con la taglia addosso — devi vedere le guardie arrivare
    let dist = v ? CAM.baseVeicolo + Math.abs(v.speed) * 1.7
                 : (correndo ? CAM.baseCorsa : CAM.baseAPiedi);
    dist += p.stars * CAM.perStella;
    if (campagna.attiva && campagna.attiva.tipo === 'fuga') dist += 6;
    dist = Math.min(CAM.maxDist, dist);
    cam.dist += (dist - cam.dist) * (1 - Math.exp(-dt * CAM.inseguimentoZoom));

    // bersaglio: giocatore + anticipo, con eventuale sguardo verso un punto
    let tx = p.x + cam.leadX, tz = p.z + cam.leadZ;
    if (cam.peek) {
      cam.peek.t -= dt;
      if (cam.peek.t <= 0) cam.peek = null;
      else {
        // campana: va e torna, senza stacchi
        const u = cam.peek.t / cam.peek.max;
        const w = Math.sin(Math.PI * u) * 0.55;
        const lx = cam.peek.x - p.x, lz = cam.peek.z - p.z;
        const d = Math.hypot(lx, lz) || 1;
        const portata = Math.min(d, 26);
        tx += lx / d * portata * w;
        tz += lz / d * portata * w;
      }
    }

    const kp = 1 - Math.exp(-dt * CAM.inseguimento);
    cam.x += (tx - cam.x) * kp;
    cam.z += (tz - cam.z) * kp;

    cam.shake = Math.max(0, cam.shake - dt * 2.6);
  }
  let hint = '', hintT = 0;
  let proiettili = [];
  let carcasse = [];   // cavalli caduti, restano a terra un po'
  let lastCrime = -99, paused = false, gameOver = 0;
  let fps = 60, frames = 0, fpsT = 0;
  let stats = { spesi: 0, guadagnati: 0, missioni: 0 };

  const DAY_LEN = 260;              // secondi per un giorno intero
  // bordi della cinta muraria in unita' di mondo, dalla pianta (start)
  let WALL_X0, WALL_X1, WALL_Y0, WALL_Y1;

  // ------------------------------------------------------------ ambiente
  // (le fasi del giorno e envAt stanno in ambiente.js)

  function isNight() { return dayT < 0.16 || dayT > 0.74; }

  // (gli effetti sonori, Sfx, stanno in audio.js)

  // ------------------------------------------------------------ messaggi

  function say(text, dur = 3) { hint = text; hintT = Math.max(dur, String(text).length / 18); }  // ~18 lettere al s (14/10)

  // ------------------------------------------------------------ spawn

  // Chi abita quale quartiere. Il pool ha i ruoli veri, quindi la citta' si
  // popola per mestiere invece che per colore della tunica.
  // Il cast dei passanti e' solo gente comune. Chi e' unico ha un posto e un
  // mestiere fisso ed e' fra i residenti (world.buildResidents) o fra i
  // committenti: il re e la corte nel cortile del castello, l'arcimago e le
  // suore alla chiesa, il becchino al cimitero, il fabbro alla fucina. Prima
  // regina, principi, fabbro, becchino e arcimago nascevano anche per strada,
  // e i cacciatori del bosco avevano le divise degli arcieri della ronda.
  // chi fa cosa: i ruoli e i loro personaggi, per citta' (cast.js)
  const cast = ruolo => castDi(world.pianta, ruolo);

  const pick = a => a[Math.floor(Math.random() * a.length)];

  // Alla prima chiamata la gente va sparsa su tutto il disco visibile, non su
  // un anello lontano: altrimenti si parte in una piazza deserta.
  let seeded = false;

  // Quanta gente ci sta in ogni quartiere. Il mercato e' pieno, il quartiere
  // nobile e' vuoto ma pattugliato, i campi e il bosco sono radi. La densita'
  // e' la probabilita' di accettare un punto di spawn in quella zona.
  const DENSITA = { 0: 0.30, 1: 0.22, 2: 0.85, 3: 1.00, 4: 0.40,
                    5: 0.60, 6: 0.00, 7: 0.10 };

  function districtProfs(d) {
    switch (d) {
      case 2: return ['cittadino', 'cittadino', 'operaio', 'ladro', 'artigiano'];
      case 3: return ['cittadino', 'cittadino', 'mercante', 'mercante',
                      'monaco', 'nobile', 'artigiano', 'operaio'];
      case 4: return ['nobile', 'nobile', 'guardia', 'monaco', 'cittadino'];
      case 5: return ['portuale', 'portuale', 'cittadino', 'mercante'];
      case 1: return ['contadino', 'contadino', 'boscaiolo', 'cittadino'];
      case 0: return ['ladro', 'cacciatore', 'cacciatore', 'boscaiolo',
                      'boscaiolo', 'assassino'];
      default: return ['cittadino', 'contadino', 'mercante'];
    }
  }

  // ---- residenti: gente con un posto fisso ---------------------------------
  // Esistono nel mondo, non nella simulazione: entrano e escono dalla scena in
  // base alla distanza, ma restano sempre gli stessi e tornano al loro posto.
  const attivi = new Map();      // indice del residente → entita' viva

  // il punto sgombro piu' vicino, a cerchi di mezza unita' fino a 5
  function puntoLibero(x, z) {
    for (let r = 0.5; r <= 5; r += 0.5)
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2;
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (Nav.sgombro(world, px, pz, px, pz, 0.45)) return { x: px, z: pz };
      }
    return null;
  }

  function aggiornaResidenti(px, pz) {
    const R = world.residents;
    for (let i = 0; i < R.length; i++) {
      const r = R[i];
      const d = Math.hypot(r.x - px, r.z - pz);
      const vivo = attivi.get(i);
      if (d < 95 && !vivo) {
        const e = r.prof === 'guardia'
          ? new Guard(r.x, r.z, r.sprite, r)
          : new Npc(r.sprite, r.x, r.z, r.prof, r);
        e.residente = i;
        // chi si muove e nasce dentro un ostacolo (il Re sta sopra un prop
        // della corte) non ne esce piu': parte dal punto libero piu' vicino
        if (!r.fisso && r.raggio > 0 && r.prof !== 'guardia' &&
            !Nav.sgombro(world, e.x, e.z, e.x, e.z, 0.45)) {
          const q = puntoLibero(e.x, e.z);
          if (q) { e.x = q.x; e.z = q.z; }
        }
        attivi.set(i, e);
        (r.prof === 'guardia' ? guards : npcs).push(e);
      } else if (d > 125 && vivo) {
        attivi.delete(i);
        let k = npcs.indexOf(vivo); if (k >= 0) npcs.splice(k, 1);
        k = guards.indexOf(vivo); if (k >= 0) guards.splice(k, 1);
      } else if (vivo && vivo.dead && vivo.deadT > 40) {
        // dopo un po' il posto viene ripreso da qualcun altro
        attivi.delete(i);
      }
    }
  }

  // Quanti passanti "di passaggio" devono esistere attorno al giocatore, in
  // base al quartiere in cui si trova LUI. Prima il numero era fisso e la
  // densita' filtrava solo il punto di spawn: con abbastanza tentativi il
  // ciclo riusciva comunque a piazzarne 42, e in un bosco disabitato ti
  // ritrovavi trenta persone fra gli alberi.
  const VAGANTI_PER_ZONA = { 0: 6, 1: 8, 2: 30, 3: 34, 4: 14,
                             5: 20, 6: 4, 7: 5 };

  // Di notte il borgo si svuota: gira un passante su quattro. Il fattore
  // scende lungo il tramonto e risale all'alba invece di scattare, cosi' la
  // folla si dirada e non sparisce di colpo. I residenti restano: hanno un
  // posto, e la ronda non smonta.
  function affollamento() {
    const NOTTE = 0.25, RAMPA = 0.06;
    if (dayT >= 0.20 && dayT <= 0.70) return 1;
    if (dayT > 0.70 && dayT < 0.70 + RAMPA)
      return lerp(1, NOTTE, (dayT - 0.70) / RAMPA);
    if (dayT > 0.20 - RAMPA && dayT < 0.20)
      return lerp(NOTTE, 1, (dayT - (0.20 - RAMPA)) / RAMPA);
    return NOTTE;
  }

  function zonaDi(x, z) {
    const tx = Math.floor(x / TILE), ty = Math.floor(z / TILE);
    if (!world.inside(tx, ty)) return 7;
    return world.district[world.idx(tx, ty)];
  }

  // quanti passanti girano attorno a (px, pz): la zona, l'ora e il tempo
  // (con la pioggia la gente sta in casa)
  function vagantiVoluti(px, pz) {
    return Math.round((VAGANTI_PER_ZONA[zonaDi(px, pz)] ?? 10) * affollamento() *
                      Meteo.fattore('gente'));
  }

  function populate(px, pz) {
    aggiornaResidenti(px, pz);

    const VAGANTI = vagantiVoluti(px, pz);
    const vaganti = () => npcs.filter(n => n.residente === undefined).length;

    // chi e' di troppo (al tramonto) se ne va, ma solo fuori inquadratura
    // (oltre 38 unita': lo schermo ne mostra ~32 di lato e ~20 in profondita') e
    // solo se sta passeggiando: mai un bersaglio, mai chi fugge o attacca
    let esubero = vaganti() - VAGANTI;
    for (let i = npcs.length - 1; i >= 0; i--) {
      const n = npcs[i];
      if (n.residente !== undefined) continue;
      const d = Math.hypot(n.x - px, n.z - pz);
      // il bersaglio di una caccia non si toglie mai per la distanza: prima
      // spariva e restava la spada sospesa dove era stato visto l'ultima volta
      if ((d > 105 && !n.bersaglio && !n.missione) || (n.dead && n.deadT > 14) ||
          (esubero > 0 && d > 38 && !n.dead && !n.bersaglio && !n.missione &&
           n.state === 'wander')) {
        npcs.splice(i, 1);
        esubero--;
      }
    }
    // gli altri di troppo, quelli a vista, rincasano: si allontanano a piedi
    // e il giro qui sopra li toglie appena escono dall'inquadratura
    for (const n of npcs) {
      if (n.residente !== undefined) continue;
      n.rincasa = esubero > 0 && !n.dead && !n.bersaglio && !n.missione &&
                  n.state === 'wander';
      if (n.rincasa) esubero--;
    }
    for (let i = beasts.length - 1; i >= 0; i--) {
      const b = beasts[i];
      if (Math.hypot(b.x - px, b.z - pz) > 120 && !b.missione) beasts.splice(i, 1);
      else if (b.dead && b.deadT > 12) beasts.splice(i, 1);
    }

    let tentativi = 0;
    while (vaganti() < VAGANTI && tentativi++ < 140) {
      const a = Math.random() * Math.PI * 2;
      const r = seeded ? 38 + Math.random() * 48 : 6 + Math.random() * 78;
      const x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
      const tx = Math.floor(x / TILE), ty = Math.floor(z / TILE);
      if (!world.inside(tx, ty) || world.blocked(x, z)) continue;
      const d = world.district[world.idx(tx, ty)];
      if (Math.random() > (DENSITA[d] ?? 0.2)) continue;

      // in citta' un passante sta su una via o a ridosso: se nasce in mezzo a
      // un cortile chiuso sembra teletrasportato
      const vicinoStrada = world.nearRoad(x, z, 2);
      if ((d === 2 || d === 3 || d === 4 || d === 5) && !vicinoStrada) continue;
      // fuori citta' la gente e' rara e sta comunque sui sentieri, salvo
      // contadini nei campi e briganti nel bosco
      if ((d === 7) && !vicinoStrada) continue;
      if ((d === 0 || d === 1) && !vicinoStrada && Math.random() < 0.55) continue;

      // fauna: nel bosco e nei campi, e qualche uccello ovunque all'aperto
      if ((d === 0 || d === 1) && Math.random() < (d === 0 ? 0.42 : 0.30)) {
        if (beasts.length < 20)
          beasts.push(new Beast(pick(cast(d === 0 ? 'fauna_bosco' : 'fauna_campi')), x, z));
        continue;
      }
      if (d !== 6 && Math.random() < 0.06 && beasts.length < 24) {
        beasts.push(new Beast(pick(cast('uccello')), x, z));
        continue;
      }

      const prof = pick(districtProfs(d));
      if (prof === 'guardia') { guards.push(new Guard(x, z, pick(cast('guardia')))); continue; }
      npcs.push(new Npc(pick(cast(prof) || cast('cittadino')), x, z, prof));
    }

    // ---- guardie di ronda ---------------------------------------------------
    // Fuori dalle mura non c'e' ronda: e' il motivo per cui il bosco e' dei
    // briganti. Dentro, il numero cresce con le stelle.
    const dentro = px > WALL_X0 && px < WALL_X1 && pz > WALL_Y0 && pz < WALL_Y1;
    const wantG = (dentro ? Storia.ronde() : 2) + player.stars * 3;   // 10 nell'atto V
    for (let i = guards.length - 1; i >= 0; i--) {
      const g = guards[i];
      if (g.residente !== undefined) continue;
      if (Math.hypot(g.x - px, g.z - pz) > 135 && !g.missione) guards.splice(i, 1);
      else if (g.dead && g.deadT > 14) guards.splice(i, 1);
    }
    let gg = 0;
    const liberi = () => guards.filter(g => !g.dead && g.residente === undefined).length;
    while (liberi() < wantG && gg++ < 60) {
      // le guardie nascono su un punto di ronda, non a caso in mezzo ai campi
      let p = null;
      if (world.patrol.length) {
        for (let k = 0; k < 24; k++) {
          const q = world.patrol[Math.floor(Math.random() * world.patrol.length)];
          const dq = Math.hypot(q.x - px, q.z - pz);
          if (dq > (player.stars ? 26 : 38) && dq < 120) { p = q; break; }
        }
      }
      // senza punti di ronda a portata (nel bosco, nei campi) una guardia a
      // caso nasce solo per inseguirti: prima ce n'erano due anche senza
      // taglia, a 60-85 unita', e facevano da testimoni nel bosco
      if (!p && !dentro && !player.stars) break;
      if (!p) {
        const a = Math.random() * Math.PI * 2;
        const r = 40 + Math.random() * 45;
        p = { x: px + Math.cos(a) * r, z: pz + Math.sin(a) * r };
      }
      if (!world.inside(Math.floor(p.x / TILE), Math.floor(p.z / TILE))) continue;
      if (world.blocked(p.x, p.z)) continue;
      const cavallo = player.stars >= 3 && Math.random() < 0.45;
      guards.push(new Guard(p.x, p.z,
        pick(cast(cavallo ? 'guardia_a_cavallo' : 'guardia'))));
    }
    seeded = true;
  }

  // ------------------------------------------------------------ crimini

  // Nessuno ti ha visto, nessun reato.
  //
  // Prima la taglia saliva da sola e tutte le guardie del borgo lo sapevano
  // all'istante, ovunque fossero. Per un gioco in cui fai il ladro e' la cosa
  // sbagliata: la taglia deve nascere da un TESTIMONE, e la notizia deve
  // viaggiare da una guardia all'altra invece di apparire.
  const VISTA = { giorno: 30, notte: 15, urlo: 18, memoria: 26, campana: 3 };

  // quanto lontano vede una guardia: meno di notte, meno con pioggia e nebbia
  function raggioVista() {
    return (isNight() ? VISTA.notte : VISTA.giorno) * Meteo.fattore('vista');
  }

  function testimone(x, z) {
    const r = raggioVista();
    let best = null, bd = r;
    for (const g of guards) {
      if (g.dead) continue;
      const d = Math.hypot(g.x - x, g.z - z);
      if (d >= bd) continue;
      if (!varco(g, { x, z })) continue;     // non vede attraverso i muri
      bd = d; best = g;
    }
    return best;
  }

  function informa(g, quanto) {
    if (!g || g.dead) return;
    g.informato = Math.max(g.informato || 0, quanto);
    g.daAvvisare = null;
  }

  function crime(pts, why, x, z) {
    const cx = x === undefined ? player.x : x;
    const cz = z === undefined ? player.z : z;
    const t = testimone(cx, cz);
    if (!t) {
      // il colpo c'e' stato ma non lo sa nessuno: e' il mestiere
      if (why) say(why + TX('gioco.nessuno_visto'), 2.0);
      return false;
    }
    player.wanted = Math.min(60, player.wanted + pts);
    lastCrime = time;
    informa(t, VISTA.memoria);
    if (why) say(why, 2.2);
    if (pts >= 6) Sfx.horn();
    return true;
  }

  // taglia senza testimone: il colpo lo sanno gia' tutti (la fuga di una
  // missione). Da tre stelle in su suona la campana e le guardie vicine si
  // informano da sole (updateGuard)
  function taglia(pts, why) {
    player.wanted = Math.min(60, player.wanted + pts);
    lastCrime = time;
    if (why) say(why, 2.2);
    if (pts >= 6) Sfx.horn();
  }

  function alarm(x, z, r) {
    for (const n of npcs) {
      if (n.dead) continue;
      if (Math.hypot(n.x - x, n.z - z) < r) { n.state = 'flee'; n.fleeT = 4 + Math.random() * 3; }
    }
  }

  // ------------------------------------------------------------ missioni

  const ZONA_ID = { bosco: 0, campi: 1, slums: 2, mercato: 3, nobile: 4,
                    porto: 5 };

  // stato della campagna: atto, capitolo corrente e missione dentro il
  // capitolo. Vive fuori dal mondo (campagna.js); qui in piu' l'incarico in corso
  const campagna = Storia.stato;

  function capitolo() { return Storia.capitolo(); }
  const chi = k => Storia.committente(k);          // il nome in gioco di un committente

  function puntoInZona(nome, minD = 0) {
    const id = ZONA_ID[nome];
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * WS, z = Math.random() * WS;
      const tx = Math.floor(x / TILE), ty = Math.floor(z / TILE);
      if (!world.inside(tx, ty)) continue;
      if (id !== undefined && world.district[world.idx(tx, ty)] !== id) continue;
      if (world.blocked(x, z)) continue;
      if (!world.road[world.idx(tx, ty)] && Math.random() < 0.7) continue;
      if (Math.hypot(x - player.x, z - player.z) < minD * (1 - i / 900)) continue;  // poi piu' vicino
      return { x, z };
    }
    return { x: player.x + 40, z: player.z + 40 };
  }

  // il bersaglio di una caccia: in un luogo preciso (storia_fiordo.js) o in
  // un punto della zona; chi e' lo dice la missione (Missioni.chi)
  function bersaglioVicino(m) {
    const p = m.luogo ? Missioni.luogo(m.luogo) : puntoInZona(m.zona, 30);
    const a = new Npc(Missioni.chi(m, 'bersaglio'), p.x, p.z, 'assassino');
    // 3,2: in caccia 5,1, in fuga 6,7, meno del ladro di corsa (7,4; a 3,7 non lo si prendeva)
    if (m.luogo) { a.anchor = { x: p.x, z: p.z }; a.raggio = 8; }  // aspetta al campo (14/10)
    a.hp = a.maxHp = 70; a.speed = 3.2; a.bersaglio = true; a.state = m.luogo ? 'wander' : 'hunt';
    npcs.push(a);
    return a;
  }

  let scenaVista = null;           // la scena prima di un incarico, gia' vista

  function avviaMissione() {
    const cap = capitolo();
    if (!cap) return;
    const m = cap.missioni[campagna.miss];
    if (!m) return;
    if (m.scena && scenaVista !== m) {
      // prima dell'incarico, la sua scena (passaggi.js: l'arresto)
      scenaVista = m;
      Passaggi.mostra(Passaggi.componi(m.scena)).then(avviaMissione);
      return;
    }
    scenaVista = null;
    const att = { ...m, t: 0 };
    campagna.attiva = att;
    campagna.t = 0;

    switch (m.tipo) {
      case 'caccia':
        att.target = bersaglioVicino(m);
        att.goal = { x: att.target.x, z: att.target.z };
        break;
      case 'fuga':
        taglia(20, null);
        att.timer = m.durata;
        break;
      case 'riscossione':
        // segna N passanti: bastano da riscuotere, colpirli e' facoltativo
        att.debitori = [];
        att.fatti = 0;
        break;
      default:
        Missioni.avvia(att);             // i tipi nuovi (missioni.js)
    }
    Sfx.quest();
    guarda(att.goal || (att.target || null), 2.0);
    say(m.testo, 7);
    Hud.setObjective(`${cap.titolo} — ${campagna.miss + 1}/${cap.missioni.length}`);
  }

  function avanzaMissione() {
    const cap = capitolo();
    Missioni.chiudi(campagna.attiva);
    if (Storia.inProva()) { chiudiProva('riuscita'); return; }
    campagna.attiva = null;
    campagna.miss++;
    stats.missioni++;
    if (campagna.miss >= cap.missioni.length) {
      // capitolo chiuso: paga, consegna l'arma, apre il successivo
      player.money += cap.premio;
      stats.guadagnati += cap.premio;
      let extra = '';
      if (cap.arma && !player.arsenale.includes(cap.arma)) {
        player.arsenale.push(cap.arma);
        player.equipaggia(cap.arma);
        extra = TX('gioco.arma_ottenuta', { arma: ARMI[cap.arma].nome });
      }
      if (cap.dono === 'tenda' && Tenda.dai())
        extra += TX('gioco.dono_tenda');
      if (cap.dono === 'cunicolo')
        extra += TX('gioco.dono_cunicolo');
      campagna.cap++;
      campagna.miss = 0;
      if (cap.finale && campagna.cap >= Storia.campagna().capitoli.length) {
        fineAtto(cap.finale);            // la scena, l'atto dopo, il viaggio
        return;
      }
      Salvataggio.salva();
      extra += TX('gioco.partita_salvata');
      flash = 0.6;
      Sfx.quest();
      const capitoli = Storia.campagna().capitoli;
      if (campagna.cap >= capitoli.length) {
        campagna.finita = true;
        say(TX('gioco.fine_scalata', { chiusura: cap.chiusura, premio: cap.premio, extra }), 12);
        Hud.setObjective(Storia.campagna().fine);
      } else {
        say(TX('gioco.fine_capitolo', { chiusura: cap.chiusura, premio: cap.premio, extra }), 9);
        Hud.setObjective(TX('gioco.obiettivo_cerca', { n: campagna.cap + 1, chi: chi(capitoli[campagna.cap].giver) }));
      }
    } else {
      player.money += 40;
      stats.guadagnati += 40;
      Sfx.coin(); Salvataggio.salva();               // a ogni passo (14/10, tuo ok)
      // un passo `subito` parte da se', senza tornare dal committente
      // (storia_fiordo.js: dopo il duello lo scudo al jarl)
      if (cap.missioni[campagna.miss].subito) { avviaMissione(); return; }
      say(TX('gioco.passo_fatto'), 5);
      Hud.setObjective(TX('gioco.obiettivo_torna', { titolo: cap.titolo, da_chi: Lingua.daChi(chi(cap.giver)) }));
    }
  }

  // l'obiettivo del passo in cui sei, senza incarico aperto (dopo un caricamento)
  function aggiornaObiettivo() {
    const cap = capitolo();
    if (campagna.finita || !cap)
      Hud.setObjective(Storia.campagna().fine);
    else if (campagna.miss === 0)
      Hud.setObjective(TX('gioco.obiettivo_cerca', { n: campagna.cap + 1, chi: chi(cap.giver) }));
    else
      Hud.setObjective(TX('gioco.obiettivo_torna', { titolo: cap.titolo, da_chi: Lingua.daChi(chi(cap.giver)) }));
  }

  // la missione di prova (collaudo, campagna.js): fuori dalla storia, non
  // paga e non fa avanzare; la storia torna al passo in cui era
  function chiudiProva(esito) {
    Storia.fineProva(esito);
    say(TX('gioco.prova_esito', { esito }), 4);
    aggiornaObiettivo();
  }

  function fallisciMissione(perche) {
    say(TX('gioco.incarico_fallito', { perche }), 5);
    if (campagna.attiva && campagna.attiva.target)
      campagna.attiva.target.bersaglio = false;
    Missioni.chiudi(campagna.attiva);
    if (Storia.inProva()) { Storia.fineProva('fallita: ' + perche); aggiornaObiettivo(); return; }
    campagna.attiva = null;
    const cap = capitolo();
    Hud.setObjective(cap ? TX('gioco.obiettivo_torna', { titolo: cap.titolo, da_chi: Lingua.daChi(chi(cap.giver)) })
                         : TX('gioco.cerca_incarico'));
  }

  function updateMission(dt) {
    const m = campagna.attiva;
    if (!m) return;
    campagna.t += dt;
    const d = m.goal ? Math.hypot(player.x - m.goal.x, player.z - m.goal.z) : 999;

    switch (m.tipo) {
      case 'caccia':
        if (m.target && m.target.dead) avanzaMissione();
        else if (m.target) {
          // tolto da un debug.tp o da un'uscita da una stanza: rimesso in scena
          if (!npcs.includes(m.target)) npcs.push(m.target);
          m.goal = { x: m.target.x, z: m.target.z };
        }
        break;
      case 'fuga':
        m.timer -= dt;
        if (player.stars === 0) avanzaMissione();
        else if (m.timer <= 0) fallisciMissione(TX('gioco.fallito.seminati'));
        break;
      case 'riscossione': {
        // i debitori sono i passanti piu' vicini: si "riscuote" restando
        // addosso, o piu' in fretta stendendoli
        if (m.debitori.length < m.quanti) {
          for (const n of npcs) {
            if (n.dead || n.debitore || n.residente !== undefined) continue;
            if (Math.hypot(n.x - player.x, n.z - player.z) > 55) continue;
            n.debitore = true;
            m.debitori.push(n);
            if (m.debitori.length >= m.quanti) break;
          }
        }
        let fatti = 0;
        for (const n of m.debitori) {
          if (n.riscosso) { fatti++; continue; }
          const dd = Math.hypot(n.x - player.x, n.z - player.z);
          if (n.dead || dd < 2.2) {
            n.riscosso = true;
            n.debitore = false;
            player.money += 12;
            stats.guadagnati += 12;
            Sfx.coin();
            fatti++;
          }
        }
        m.fatti = fatti;
        m.goal = m.debitori.find(n => !n.riscosso) || null;
        if (fatti >= m.quanti) avanzaMissione();
        break;
      }
      default: {
        const esito = Missioni.aggiorna(m, dt);       // 'fatto', o il perche'
        if (esito === 'fatto') avanzaMissione();
        else if (esito) fallisciMissione(esito);
      }
    }
  }

  // ---------------------------------------------------------------- bottega
  //
  // Ferrante vende il comune; alabarda e balestra le consegna la storia.

  function compra(chiave) {
    const a = ARMI[chiave];
    if (!a || a.prezzo === null) return;
    if (player.arsenale.includes(chiave)) { player.equipaggia(chiave); return; }
    if (player.money < a.prezzo) { say(TX('gioco.pochi_denari'), 2.5); return; }
    player.money -= a.prezzo;
    stats.spesi += a.prezzo;
    player.arsenale.push(chiave);
    player.equipaggia(chiave);
    Sfx.coin();
    say(TX('gioco.arma_comprata', { arma: a.nome, fabbro: (world.pianta.FABBRO || FABBRO_VALDARNO).Chi }), 4);
  }

  // ------------------------------------------------------------ update

  function nearestVehicle(maxD) {
    let best = null, bd = maxD * maxD;
    for (const v of vehicles) {
      if (v.rider || v.rotto) continue;
      // su una barca si sale da un bordo del molo: un poco piu' di margine
      const d = (v.x - player.x) ** 2 + (v.z - player.z) ** 2 -
                (v.type === 'barca' ? 4.4 ** 2 - maxD * maxD : 0);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  // La bottega delle armi e' un posto: la bottega di Ferrante, e ci si entra
  // (src/stanze/fucina.json). Prima B la apriva ovunque e non lo diceva
  // nessuno; poi Ferrante stava all'aperto davanti alla fucina.
  function allaFucina() {
    return Interni.dentro && Interni.stanza.tipologia === 'fucina';
  }

  function bottega() {
    if (Hud.bottegaAperta()) { Hud.chiudiBottega(); return; }
    if (allaFucina()) Hud.apriBottega();
    else say(TX('gioco.armi_dove', { dove: (world.pianta.FABBRO || FABBRO_VALDARNO).dove }), 4);
  }

  // La Lanterna Rossa, nei bassifondi: si paga la tenutaria e si esce rimessi
  // in sesto. E' la ricarica della salute di GTA, e come in GTA non si dice
  // altro (decisione del 20/09). Un denaro per punto.
  const LANTERNA_PREZZO = 1;

  function allaLanternaRossa() {
    const manca = Math.ceil(player.maxHp - player.hp);
    if (manca <= 0) { say(TX('gioco.lanterna.sano'), 3); return; }
    const punti = Math.min(manca, Math.floor(player.money / LANTERNA_PREZZO));
    if (punti <= 0) { say(TX('gioco.lanterna.paga_prima'), 3); return; }
    const spesa = punti * LANTERNA_PREZZO;
    player.money -= spesa;
    stats.spesi += spesa;
    player.hp = Math.min(player.maxHp, player.hp + punti);
    flash = 0.3;
    Sfx.coin();
    say(TX('gioco.lanterna.fatto', { spesa }), 4);
  }

  // Il pievano cura per un'offerta: dieci denari e sei in sesto. Chi non li
  // ha viene curato lo stesso, ma solo fino a meta': e' carita', non bottega
  // (la tenutaria invece vende un denaro a punto).
  const OFFERTA = 10;

  // le frasi le puo' dare la stanza (frasi_cura: il goði dello hof del fiordo)
  function allaPieve() {
    const F = Interni.stanza.frasi_cura || {};
    if (player.hp >= player.maxHp) {
      say(F.sano || TX('gioco.pieve.sano'), 3);
      return;
    }
    if (player.money >= OFFERTA) {
      player.money -= OFFERTA;
      stats.spesi += OFFERTA;
      player.hp = player.maxHp;
      say((F.paga || TX('gioco.pieve.paga'))
        .replace('{n}', OFFERTA), 4);
    } else {
      player.hp = Math.max(player.hp, player.maxHp / 2);
      say(F.carita || TX('gioco.pieve.carita'), 4);
    }
    flash = 0.3;
    Sfx.coin();
  }

  // ---------------------------------------------------------------- interni
  //
  // E sull'uscio: dissolvenza, e sei dentro (interni.js). Con la ronda alle
  // calcagna la porta resta chiusa, se no la casa sarebbe un rifugio. Si esce
  // dalla stessa porta, camminando oltre la soglia.
  //
  // Nelle stanze con "combattimento" (la Lanterna Rossa) chi ci sta e' gente
  // vera, come in GTA: si colpisce, fugge, muore. Dentro non ci sono guardie,
  // quindi sul momento nessuna stella; ma se hai ucciso qualcuno, uscendo le
  // urla si sentono dalla strada (un reato alla porta, coi testimoni di fuori)
  // e la casa sbarra la porta per due minuti.

  const SBARRATA = 120;                // secondi di porta chiusa dopo una strage
  const sbarrate = {};                 // tipologia -> fino a quando (time)
  let transito = false;

  function passaggio(fatto) {
    if (transito) return;
    transito = true;
    const velo = document.getElementById('dissolvenza');
    velo.classList.add('chiusa');
    setTimeout(() => {
      fatto();
      velo.classList.remove('chiusa');
      setTimeout(() => { transito = false; }, 350);
    }, 350);
  }

  const inStanza = () => npcs.filter(n => n.inStanza);
  // il boccale sulla carta e' solo per le osterie: prima lo prendevano anche
  // la bottega di Ferrante e la Lanterna Rossa
  let soloTaverne = null;
  const taverne = () => soloTaverne ||
    (soloTaverne = Interni.porte.filter(p => p.tipo === 'taverna'));

  // chi ti vede qui: una guardia (testimone) o un nemico a dodici passi
  function occhiSu(x, z) {
    return !!testimone(x, z) || nemici.some(e => !e.dead &&
      Math.hypot(e.x - x, e.z - z) < 12);
  }

  // il cunicolo (B) c'e' da sempre, ma lo conosci dalla fine del capitolo 4
  const cunicoloNoto = () => campagna.cap >= 4 || campagna.finita;

  function entraInStanza(porta) {
    if (porta.tipo === 'cunicolo') {
      // la via di fuga: si entra anche con la taglia, ma solo se nessuno ti
      // vede sparire (decisione del 24/09)
      if (!cunicoloNoto()) {
        say(porta.verso === 'corte' ? TX('gioco.cunicolo.botola')
                                    : TX('gioco.cunicolo.pozzo'), 3);
        return;
      }
      if (occhiSu(player.x, player.z)) {
        say(TX('gioco.cunicolo.visto'), 3);
        return;
      }
    } else if (player.stars > 0) {
      say(TX('gioco.porta.ronda'), 3);
      return;
    }
    if ((sbarrate[porta.tipo] || 0) > time) {
      say(TX('gioco.porta.sbarrata'), 3);
      return;
    }
    passaggio(() => dentroLa(porta));
  }

  // dentro la stanza di una porta (anche una "porta" senza uscio nel mondo:
  // la botola della nave, il risveglio nella stiva, nave.js)
  function dentroLa(porta) {
    const p = Interni.entra(porta);
    const s = Interni.stanza;
    player.x = p.x; player.z = p.z; player.vx = player.vz = 0;
    const c = Interni.centro();
    cam.x = c.x; cam.z = c.z; cam.leadX = cam.leadZ = 0; cam.peek = null;
    if (s.combattimento)
      for (const r of s.residenti) {
        const n = new Npc(r.sprite, r.x, r.z, 'cittadino',
                          { x: r.x, z: r.z, raggio: 0, fisso: true,
                            flip: !!r.flip, nome: r.nome });
        n.inStanza = true;
        n.info = r;
        npcs.push(n);
      }
    Cartiglio.mostra(s.nome);                      // cartiglio.js
  }

  function esciDallaStanza() {
    // un vano che porta in un'altra stanza (la botola della stiva)
    const altra = Interni.oltre(player.x);
    if (altra) { inAltraStanza(altra); return; }
    passaggio(() => {
      const s = Interni.stanza;
      const gente = inStanza();
      const morti = gente.filter(n => n.dead).length;
      for (const n of gente) npcs.splice(npcs.indexOf(n), 1);
      if (Nave.inCatene) { Nave.libera(); say(Nave.testi.aTerra, 4); aggiornaObiettivo(); }
      let p = Interni.esci(player.x);
      // mai sopra un ostacolo: da li' non ci si muove (26/09, dal fabbro)
      if (world.blocked(p.x, p.z)) p = puntoLibero(p.x, p.z) || p;
      player.x = p.x; player.z = p.z; player.vx = player.vz = 0;
      cam.x = p.x; cam.z = p.z;
      if (morti) {
        sbarrate[s.tipologia] = time + SBARRATA;
        crime(6 + morti * 4, TX('gioco.reato.urla', { stanza: s.nome }), p.x, p.z);
      }
    });
  }

  // da una stanza all'altra senza passare dal mondo (stiva e ponte della nave)
  function inAltraStanza(porta) {
    passaggio(() => {
      for (const n of inStanza()) npcs.splice(npcs.indexOf(n), 1);
      dentroLa(porta);
    });
  }

  // dentro il mondo e' fermo: si muovono il ladro e chi sta nella stanza, la
  // camera sta sulla stanza
  function aggiornaDentro(dt) {
    if (!input.down) Interni.apriVani();          // v. interni.js, vaniChiusi
    updatePlayer(dt);
    for (const n of inStanza()) updateNpc(n, dt);
    for (const e of nemici) if (e.inStanza) updateNemico(e, dt);   // l'ammutinamento
    updateParticles(dt);
    if (Missioni.valeDentro(campagna.attiva)) updateMission(dt);   // il furto in stanza
    if (!transito && Interni.fuoriDallaPorta(player.z)) esciDallaStanza();
    const c = Interni.centro();
    const k = 1 - Math.exp(-dt * 4);
    cam.x += (c.x - cam.x) * k;
    cam.z += (c.z - cam.z) * k;
    cam.dist += ((Interni.stanza.camera || 40) - cam.dist) * k;   // il ponte della nave: piu' largo
    cam.shake = Math.max(0, cam.shake - dt * 2.6);
  }

  // la tenda (tenda.js): il giaciglio fa dormire fino al mattino con la
  // salute piena, la cassa salva la partita
  const MATTINO = 0.22;
  function nellaTenda(azione) {
    if (azione === 'riposa') {
      player.hp = player.maxHp;
      dayT = MATTINO;
      flash = 0.3;
      say(TX('gioco.tenda.dormi'), 4);
    } else if (azione === 'salva') {
      const s = Salvataggio.salva();
      say(s.nelBrowser ? TX('gioco.salva.fatto')
                       : TX('gioco.salva.niente'), 5);
    }
  }

  // chi ti sta davanti nella stanza e ha qualcosa da dire (oste, Ferrante,
  // tenutaria): nelle stanze di gente vera solo se e' vivo
  function interlocutore() {
    const s = Interni.stanza;
    if (!s.combattimento) return Interni.vicinoA(player.x, player.z, 5);
    const n = inStanza().find(a => a.info.parla && !a.dead &&
      Math.hypot(a.x - player.x, a.z - player.z) < 3.5);
    return n ? n.info : null;
  }

  function suggerimento() {
    const v = player.vehicle;
    if (v && v.type === 'barca' && Viaggio.alLargo(world, v.x, v.z))
      return Storia.meta(world.pianta.chiave) ? TX('gioco.tasto.salpa', { verso: Storia.verso(world.pianta.chiave) })
                                              : TX('gioco.al_largo');
    if (Interni.dentro) {
      const sm = Missioni.suggerisci(campagna.attiva);      // la chiave del nostromo
      if (sm) return sm;
      const r = interlocutore();
      if (r && r.committente === 'fabbro')
        return TX('gioco.tasto.parla_bottega', { nome: r.nome });
      if (r && r.salute)
        return player.hp < player.maxHp ? TX('gioco.tasto.lanterna') : '';
      if (r && r.cure)
        return player.hp < player.maxHp ? TX('gioco.tasto.offerta', { n: OFFERTA }) : '';
      if (r) return TX('gioco.tasto.parla', { nome: r.nome });
      const az = Interni.azioneVicina(player.x, player.z);
      if (az) return az.dice || (az.azione === 'riposa' ? TX('gioco.tasto.dormi')
                                                        : TX('gioco.tasto.salva'));
      if (player.z > Interni.stanza.soglia - Interni.stanza.C)
        return Interni.cartello(player.x) || TX('gioco.tasto.esci');
      return '';
    }
    const porta = !player.vehicle && Interni.portaVicina(player.x, player.z);
    if (porta) return TX('gioco.tasto.entra', { dove: Interni.ingresso(porta.tipo) });
    return !player.vehicle && Traffico.vicino(player, 3.6)
      ? TX('gioco.tasto.carrettiere') : '';
  }

  function nearestGiver(maxD) {
    let best = null, bd = maxD * maxD;
    for (const g of givers) {
      if (g.stanza) continue;            // sta dentro la sua bottega
      const d = (g.x - player.x) ** 2 + (g.z - player.z) ** 2;
      if (d < bd) { bd = d; best = g; }
    }
    return best;
  }

  function puff(x, z, col, n = 8, spread = 2.2) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x, z, y: 0.6 + Math.random() * 0.8,
        vx: (Math.random() - 0.5) * spread, vz: (Math.random() - 0.5) * spread,
        vy: 1 + Math.random() * 2, life: 0.4 + Math.random() * 0.5,
        max: 0.9, col,
      });
    }
  }

  function tuttiVivi() {
    return [...npcs, ...guards, ...beasts, ...nemici].filter(e => !e.dead);
  }

  // mira automatica: con personaggi di solo profilo non si puo' puntare in
  // otto direzioni, quindi l'arco cerca da solo il bersaglio piu' vicino
  function bersaglioMira(portata) {
    let best = null, bd = portata * portata;
    for (const e of tuttiVivi()) {
      const d = (e.x - player.x) ** 2 + (e.z - player.z) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function tira(arma) {
    const b = bersaglioMira(arma.portata);
    let dx, dz;
    if (b) { dx = b.x - player.x; dz = b.z - player.z; }
    else { dx = player.flip ? -1 : 1; dz = 0; }
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    player.flip = dx < 0;
    proiettili.push({
      x: player.x + dx * 0.9, z: player.z + dz * 0.9,
      vx: dx * arma.velocita, vz: dz * arma.velocita,
      ang: Gfx.angoloSchermo(dx, dz),
      sprite: arma.proiettile,
      danno: arma.danno, vita: arma.portata / arma.velocita + 0.15,
    });
    Sfx.swing();
  }

  // ---------------------------------------------------------------- armi NPC
  //
  // Prima ogni NPC, qualunque cosa avesse in mano, colpiva a 1.9 unita' e
  // basta: l'arciere si avvicinava e dava un pugno. Le portate stanno qui,
  // legate allo sprite, come ARMI in story.js lo e' per il giocatore.
  const ARMI_NPC = {
    MiniArcher:       { portata: 19, cadenza: 2.1, danno: [7, 12],
                        proiettile: 'freccia', velocita: 30, minima: 3.2 },
    MiniCrossBowMan:  { portata: 24, cadenza: 3.4, danno: [15, 24],
                        proiettile: 'quadrello', velocita: 42, minima: 4.0 },
    MiniSpearMan:     { portata: 2.9, cadenza: 1.30, danno: [9, 15] },
    MiniHalberdMan:   { portata: 3.2, cadenza: 1.55, danno: [12, 19] },
    MiniShieldMan:    { portata: 1.9, cadenza: 1.05, danno: [7, 12] },
    MiniSwordMan:     { portata: 1.9, cadenza: 0.90, danno: [8, 14] },
    MiniOldManWarrior:{ portata: 1.9, cadenza: 1.15, danno: [7, 12] },
    MiniHorseMan:     { portata: 2.6, cadenza: 1.10, danno: [10, 16] },
    MiniThief:        { portata: 1.6, cadenza: 0.70, danno: [5, 9] },
    MiniVillagerWarrior: { portata: 2.0, cadenza: 1.0, danno: [7, 12] },
  };
  const ARMA_BASE = { portata: 1.9, cadenza: 1.0, danno: [7, 12] };

  function armaDi(a) {
    if (a.arma_) return a.arma_;
    const base = String(a.sprite || '').split('@')[0];
    a.arma_ = ARMI_NPC[base] || ARMA_BASE;
    return a.arma_;
  }

  // danno inferto da un NPC: non passa da colpisci(), che attribuisce la
  // vittima al giocatore e gli mette la taglia addosso
  function danneggia(att, vic, w) {
    const dmg = w.danno[0] + Math.random() * (w.danno[1] - w.danno[0]);
    if (vic === player) {
      player.hurt(dmg);
      Sfx.hurt(); scuoti(0.55);
      if (player.hp <= 0 && !player.dead) {
        if (player.vehicle) { player.vehicle.rider = null; player.scendi(); }
        player.dead = true; player.setAnim('death'); Sfx.die();
      }
      return;
    }
    vic.hurt(dmg);
    puff(vic.x, vic.z, [0.7, 0.12, 0.12], 5);
    if (vic.dead) Sfx.die();
  }

  function tiraNpc(a, b, w) {
    let dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    a.flip = dx < 0;
    proiettili.push({
      x: a.x + dx * 0.9, z: a.z + dz * 0.9,
      vx: dx * w.velocita, vz: dz * w.velocita,
      ang: Gfx.angoloSchermo(dx, dz),
      sprite: w.proiettile, danno: w.danno,
      vita: w.portata / w.velocita + 0.15,
      tiratore: a, fazione: a.fazione,
    });
  }

  // Attacco di un NPC con la SUA arma. Torna true se ha tirato o colpito.
  // Un tiratore tiene la distanza: sotto la portata minima indietreggia
  // invece di continuare ad avvicinarsi, che e' quello che rendeva l'arco
  // inutile addosso e l'arciere un fante scarso.
  function attaccaNpc(a, b) {
    const w = armaDi(a);
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    if (d > w.portata || a.atkCd > 0) return false;
    if (w.proiettile && !varco(a, b)) return false;
    a.atkCd = w.cadenza;
    a.setAnim('attack');
    if (w.proiettile) tiraNpc(a, b, w);
    else danneggia(a, b, w);
    return true;
  }

  // linea di tiro: niente frecce attraverso i muri
  function varco(a, b) {
    const n = 6;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (world.blocked(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t))
        return false;
    }
    return true;
  }

  function passoDiTiro(a, b, w) {
    // avvicinati se sei fuori portata, arretra se te lo sei fatto addosso
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const verso = Math.atan2(b.z - a.z, b.x - a.x);
    if (!w.proiettile) return { heading: verso, avanza: d > w.portata * 0.8 };
    if (d < (w.minima || 0)) return { heading: verso + Math.PI, avanza: true };
    return { heading: verso, avanza: d > w.portata * 0.75 };
  }

  function playerAttack() {
    if (player.attackCd > 0 || player.dead) return;
    if (player.vehicle && player.vehicle.type !== 'cavallo') return;
    if (Nave.senzaArmi) { say(Nave.senzaArmi, 1.6); return; }      // nave.js
    const arma = player.w;
    player.attackCd = arma.cadenza;
    player.setAnim('attack');

    if (arma.distanza) { tira(arma); return; }

    Sfx.swing();
    const reach = arma.portata;
    // Mira automatica anche in mischia. Col solo profilo il colpo andava a
    // destra o a sinistra e basta, mentre gli NPC colpiscono in cerchio: chi
    // ti arrivava da sopra o da sotto ti feriva senza poter essere colpito.
    // Ti giri verso l'ostile piu' vicino a portata e colpisci chi ti sta
    // addosso da quel lato. I civili non attirano la mira: in una rissa non
    // si ammazza un passante per sbaglio, lo si colpisce solo di proposito.
    const ostili = tuttiVivi().filter(e => eOstile(e) &&
      Math.hypot(e.x - player.x, e.z - player.z) <= reach + 0.6);
    ostili.sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) -
                          Math.hypot(b.x - player.x, b.z - player.z));
    let colpito = false;
    if (ostili.length) {
      const m = ostili[0];
      const vx = m.x - player.x, vz = m.z - player.z;
      const len = Math.hypot(vx, vz) || 1;
      if (Math.abs(vx) > 0.05) player.flip = vx < 0;
      for (const e of ostili) {
        // stesso lato del primo: un fendente non prende chi hai alle spalle
        if (((e.x - player.x) * vx + (e.z - player.z) * vz) / len < -0.3) continue;
        colpisci(e, arma);
        colpito = true;
      }
    } else {
      const dx = player.flip ? -1 : 1;
      const tx = player.x + dx * reach * 0.75, tz = player.z;
      for (const e of tuttiVivi()) {
        // cono davanti a te: larghezza proporzionale alla portata dell'arma
        if (Math.abs(e.z - player.z) > 1.3) continue;
        if ((e.x - player.x) * dx < -0.4) continue;
        if (Math.hypot(e.x - tx, e.z - tz) > reach * 0.8) continue;
        colpisci(e, arma);
        colpito = true;
      }
    }
    if (colpito) { Sfx.hit(); scuoti(0.5); }
  }

  // chi ce l'ha con te in questo momento: e' chi la mira in mischia cerca
  function eOstile(e) {
    if (e.fazione === 'nemico' || e.bersaglio) return true;
    if (e instanceof Beast) return e.aggressive && e.state === 'hunt';
    if (e instanceof Guard) return e.state === 'chase';
    return e.state === 'hunt';
  }

  // un mezzo lanciato addosso: 40 di danno, come una spada che non sbaglia
  const TRAVOLGERE = { danno: [40, 40] };

  function colpisci(e, arma) {
    const dmg = arma.danno[0] + Math.random() * (arma.danno[1] - arma.danno[0]);
    e.hurt(dmg);
    puff(e.x, e.z, [0.7, 0.12, 0.12], 7);
    const furt = arma.furtivo || 1;
    // chi le prende da te smette di occuparsi delle guardie
    if (e.fazione === 'nemico') e.rancore = 12;
    if (e.fazione === 'nemico') {
      // l'altro villaggio non e' affare del balivo: nessuna stella, solo il
      // bottino che quello portava addosso
      if (e.dead) {
        Sfx.die(); Sfx.coin();
        player.kills++;
        player.money += e.taglia;
        stats.guadagnati += e.taglia;
        say(e.taglia ? TX('gioco.nemico_taglia', { taglia: e.taglia }) : TX('gioco.abbattuto'), 1.8);
      }
      return;
    }
    // Un lupo non e' un omicidio. Prima lo era: uccidere una bestia dava
    // nove punti di taglia e il gioco diceva "Omicidio!" per un cinghiale.
    if (e instanceof Beast) {
      if (e.dead) { Sfx.die(); player.kills++; }
      return;
    }
    if (e.dead) {
      Sfx.die();
      player.kills++;
      const g = e instanceof Guard;
      crime(Math.round((g ? 14 : 9) * furt),
            g ? TX('gioco.reato.guardia') : TX('gioco.reato.omicidio'), e.x, e.z);
    } else {
      crime(Math.round((e instanceof Guard ? 6 : 3) * furt), null, e.x, e.z);
    }
    alarm(e.x, e.z, 22);
  }

  // La bestia cade e tu voli. Il cavallo composto sotto di te non puo' morire
  // insieme a te — sarebbero due animazioni incollate — quindi diventa
  // un'entita' a parte che si accascia, e tu un corpo che rotola e si rialza.
  window.onCavalloAbbattuto = v => disarciona(v);

  function disarciona(v) {
    const sp = Math.abs(v.speed);
    carcasse.push({ x: v.x, z: v.z, flip: v.flip, t: 0, frame: 0, at: 0, bestia: v.bestia });
    v.rider = null;
    v.morto = true;
    const i = vehicles.indexOf(v);
    if (i >= 0) vehicles.splice(i, 1);
    player.cadi();
    player.hurt(4 + sp * 0.8);
    scuoti(0.9);
    Sfx.hit(); Sfx.die();
    say(TX('gioco.bestia_caduta', { bestia: Bestie.nome(v.bestia) }), 3);
  }

  // Il carro si sfascia sotto di te: resta li' rotto, il cavallo se ne va, tu
  // scendi. Come per il cavallo che muore, ma senza volare.
  function sfasciaSotto(v) {
    Traffico.sfascia(v);
    v.rider = null;
    player.scendi();
    [player.x, player.z] = world.move(v.x, v.z, 1.4, 1.2, 0.45);
    puff(v.x, v.z, [0.42, 0.3, 0.2], 14, 3.5);
    scuoti(1.0);
    Sfx.die();
    say(TX('gioco.carro_sfasciato', { bestia: Bestie.nome(v.bestia) }), 3);
  }

  // un cavallo senza sella ammazzato da un urto: resta a terra come gli altri
  function cavalloAbbattuto(o) {
    carcasse.push({ x: o.x, z: o.z, flip: o.flip, t: 0, frame: 0, at: 0, bestia: o.bestia });
    const i = vehicles.indexOf(o);
    if (i >= 0) vehicles.splice(i, 1);
    Sfx.die();
  }

  // i carri malridotti fumano, di piu' quando stanno per cedere
  function fumoDeiCarri(dt) {
    for (const v of vehicles) {
      if (v.rotto || v.type !== 'carro' || v.hp > v.maxHp * 0.5) continue;
      if (Math.abs(v.x - player.x) > 60 || Math.abs(v.z - player.z) > 60) continue;
      if (Math.random() < dt * (v.hp < v.maxHp * 0.25 ? 9 : 3))
        puff(v.x, v.z, [0.34, 0.32, 0.31], 1, 0.7);
    }
  }

  function updateCarcasse(dt) {
    const rates = Assets.manifest.chars.frame_rates;
    const n = Assets.charFrameCount('cavallo_mini', 'death');
    for (let i = carcasse.length - 1; i >= 0; i--) {
      const c = carcasse[i];
      c.t += dt;
      if (c.t > 26) { carcasse.splice(i, 1); continue; }
      if (c.frame < n - 1) {
        c.at += dt * (rates.death || 8);
        while (c.at >= 1) { c.at -= 1; c.frame = Math.min(n - 1, c.frame + 1); }
      }
    }
  }

  function updateProiettili(dt) {
    for (let i = proiettili.length - 1; i >= 0; i--) {
      const q = proiettili[i];
      q.vita -= dt;
      const nx = q.x + q.vx * dt, nz = q.z + q.vz * dt;
      if (q.vita <= 0 || world.blocked(nx, nz)) {
        puff(q.x, q.z, [0.55, 0.5, 0.45], 3, 1.0);
        proiettili.splice(i, 1);
        continue;
      }
      q.x = nx; q.z = nz;
      // Il giocatore non e' in tuttiVivi(): finche' a tirare era solo lui non
      // importava, ora che tirano anche gli arcieri va messo in lista.
      const candidati = q.tiratore ? [player, ...tuttiVivi()] : tuttiVivi();
      for (const e of candidati) {
        if (e === q.tiratore || e.dead) continue;
        // niente fuoco amico fra NPC: le frecce del borgo non colpiscono il
        // borgo. Le tue invece colpiscono chiunque, come dev'essere.
        if (q.tiratore && e !== player && e.fazione === q.fazione) continue;
        if (Math.hypot(e.x - q.x, e.z - q.z) > 0.85) continue;
        if (q.tiratore) danneggia(q.tiratore, e, { danno: q.danno });
        else colpisci(e, { danno: q.danno, furtivo: 1 });
        Sfx.hit();
        proiettili.splice(i, 1);
        break;
      }
    }
  }

  // a piedi ci si muove nel mondo o, se sei entrato in una casa, nella stanza
  function muovi(x, z, dx, dz, r) {
    return Interni.dentro ? Interni.move(x, z, dx, dz, r)
                          : world.move(x, z, dx, dz, r);
  }

  function updatePlayer(dt) {
    const p = player;
    p.attackCd = Math.max(0, p.attackCd - dt);
    p.hitT = Math.max(0, p.hitT - dt);

    if (p.dead) {
      p.deadT += dt;
      p.animate(dt, Assets.manifest.chars.frame_rates);
      if (p.deadT > 2.6) respawn();
      return;
    }

    if (p.vehicle) {
      const v = p.vehicle;
      // in sella o sul carro non si corre a piedi: il fiato si riprende come
      // da fermo (prima restava fermo dov'era, e scendendo si era ancora
      // sfinito)
      p.stamina = Math.min(1, p.stamina + dt * 0.25);
      if (p.stamina > 0.33) p.sfinito = false;
      v.update(dt, world, input);
      p.x = v.x; p.z = v.z;
      if (v.type === 'cavallo') {
        // in sella il corpo composto segue il cavallo: verso, andatura e il
        // colpo quando lo dai (prima restava sul fotogramma della salita)
        p.flip = v.flip;
        const sp = Math.abs(v.speed);
        if (p.anim !== 'attack')
          p.setAnim(sp > 7 ? 'run' : (sp > 0.5 ? 'walk' : 'idle'));
        p.animate(dt, Assets.manifest.chars.frame_rates);
      }
      // contro un altro mezzo e' un urto come contro un muro (traffico.js)
      const u = Traffico.urta(v);
      if (u) {
        v.crash = Math.max(v.crash || 0, u.k);
        if (u.morto) cavalloAbbattuto(u.altro);
      }
      if (v.crash) {
        scuoti(v.crash * 1.4); Sfx.hit();
        const k = v.crash;
        v.crash = 0;
        if (v.type === 'cavallo') { if (v.ferisci(k * 34)) disarciona(v); }
        else if (v.type === 'carro' && v.ferisci(k * Traffico.DANNO_URTO)) {
          sfasciaSotto(v); return;
        }
      }
      // investimenti: travolgere e' un colpo e segue le regole dei colpi, cioe'
      // colpisci(). Prima la lista non conteneva i nemici e ai rossi si
      // passava attraverso; ora si travolgono senza taglia e lasciano il
      // bottino, mentre un passante travolto resta un omicidio
      for (const e of [...npcs, ...guards, ...beasts, ...nemici]) {
        if (e.dead) continue;
        if (Math.hypot(e.x - v.x, e.z - v.z) < 1.5 && Math.abs(v.speed) > 4) {
          colpisci(e, TRAVOLGERE);
          scuoti(0.7); Sfx.hit();
        }
      }
      // in sella si combatte (dal carro no: le mani stanno sulle redini)
      if (input.atk) { if (v.type === 'cavallo') playerAttack(); input.atk = 0; }
      if (Math.abs(v.speed) > 2 && Math.random() < dt * 9)
        v.type === 'cavallo' ? Sfx.hoof() : Sfx.wheel();
      return;
    }

    if (p.disarcionato > 0) {
      // a terra: nessun controllo, si scivola per l'abbrivio e ci si rialza
      p.disarcionato -= dt;
      const [nx, nz] = muovi(p.x, p.z, p.vx * dt, p.vz * dt, 0.45);
      p.x = nx; p.z = nz;
      p.vx *= (1 - 6 * dt); p.vz *= (1 - 6 * dt);
      if (p.disarcionato <= 0) { p.setAnim('idle'); p.vx = p.vz = 0; }
      p.animate(dt, Assets.manifest.chars.frame_rates);
      return;
    }

    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let dz = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(dx, dz);
    // Sfinito: a fiato finito non si corre finche' non torna a un terzo,
    // anche tenendo Maiusc. Prima la corsa si spegneva, il fiato risaliva
    // sopra la soglia in un attimo e la corsa si riaccendeva: alternava ogni
    // pochi fotogrammi e l'animazione restava ferma al primo (26/09)
    if (p.stamina <= 0.02) p.sfinito = true;
    else if (p.stamina > 0.33) p.sfinito = false;
    const running = input.run && !p.sfinito && len > 0;
    if (len > 0) { dx /= len; dz /= len; }
    const sp = running ? p.runSpeed : p.speed;
    p.stamina = Math.max(0, Math.min(1, p.stamina +
      (running ? -dt * 0.17 : dt * 0.25)));      // ~6 s di corsa, 4 per riprendersi
    p.vx = dx * sp; p.vz = dz * sp;
    if (len > 0) {
      const [nx, nz] = muovi(p.x, p.z, p.vx * dt, p.vz * dt, 0.45);
      p.x = nx; p.z = nz;
      p.faceMove();
      if (p.anim !== 'attack' && p.anim !== 'hit')
        p.setAnim(running ? 'run' : 'walk');
      if (Math.random() < dt * (running ? 9 : 6)) Sfx.footstep(running);
    } else if (p.anim !== 'attack' && p.anim !== 'hit') {
      p.setAnim('idle');
    }
    if (input.atk) { playerAttack(); input.atk = 0; }
    p.animate(dt, Assets.manifest.chars.frame_rates);
  }

  function respawn() {
    const p = player;
    p.dead = false; p.deadT = 0; p.hp = p.maxHp * 0.6;
    p.wanted = 0;
    const cost = Math.min(p.money, 40);
    p.money -= cost; stats.spesi += cost;
    p.setAnim('idle');
    p.x = world.spawns.player.x; p.z = world.spawns.player.z;
    if (p.vehicle) { p.vehicle.rider = null; p.scendi(); }
    say(TX('gioco.risveglio_pieve', { cost }), 4);
    if (campagna.attiva) fallisciMissione(TX('gioco.fallito.a_terra'));
  }

  // bassifondi, mercato, quartiere nobile, porto: dove ci sono vie da seguire
  const ZONE_CON_VIE = new Set([D.SLUMS, D.MERCATO, D.NOBILE, D.PORTO]);

  // un punto di ronda (le vie lastricate, world.patrol) a 15-60 unita'
  function metaSulleVie(n) {
    const P = world.patrol;
    for (let k = 0; k < 8 && P.length; k++) {
      const q = P[Math.floor(Math.random() * P.length)];
      const d = Math.hypot(q.x - n.x, q.z - n.z);
      if (d > 15 && d < 60) return { x: q.x, z: q.z };
    }
    return null;
  }

  // un punto libero dentro il recinto di un residente (ancora e raggio)
  function metaNelRecinto(n) {
    for (let k = 0; k < 10; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * n.raggio;
      const x = n.anchor.x + Math.cos(a) * r, z = n.anchor.z + Math.sin(a) * r;
      if (Nav.sgombro(world, x, z, x, z, 0.5)) return { x, z };
    }
    return null;
  }

  function updateNpc(n, dt) {
    const rates = Assets.manifest.chars.frame_rates;
    if (n.dead) { n.deadT += dt; n.animate(dt, rates); return; }
    n.hitT = Math.max(0, n.hitT - dt);
    n.t -= dt;
    n.atkT = Math.max(0, n.atkT - dt);

    const dp = Math.hypot(n.x - player.x, n.z - player.z);
    if (n.bersaglio && dp < 30) n.state = 'hunt';
    if (n.fleeT > 0 && !n.ostaggio) { n.fleeT -= dt; n.state = 'flee'; }
    else if (n.state === 'flee') n.state = 'wander';

    let sp = n.speed;
    if (n.state === 'flee') {
      n.heading = Math.atan2(n.z - player.z, n.x - player.x);
      sp = n.speed * 2.1;
      n.workT = 0;
    } else if (n.state === 'hunt') {
      n.heading = Math.atan2(player.z - n.z, player.x - n.x);
      sp = n.speed * 1.6;
      if (dp < 1.7 && n.atkT <= 0) {
        n.atkT = 1.1;
        n.setAnim('attack');
        player.hurt(9 + Math.random() * 6);
        Sfx.hurt(); scuoti(0.6);
      }
    } else if (n.segue) {
      // l'ostaggio liberato (missioni.js) ti viene dietro per la strada, di
      // corsa se resta indietro
      const d = Math.hypot(n.segue.x - n.x, n.segue.z - n.z);
      const h = Nav.direzione(world, n, n.segue, time);
      n.heading = h === null ? Math.atan2(n.segue.z - n.z, n.segue.x - n.x) : h;
      sp = d < 2.4 ? 0 : (d > 7 ? 7.2 : 4.6);
    } else if (n.workT > 0) {
      // fermo al lavoro: fabbro all'incudine, minatore, becchino, raccoglitrice
      n.workT -= dt;
      sp = 0;
      if (n.anim !== 'hit') n.setAnim('work');
      n.vx = n.vz = 0;
      n.animate(dt, rates);
      return;
    } else if (n.fisso) {
      // sta al suo posto e lavora: il fabbro non lascia la fucina
      n.workT = 3;
      if (n.anim !== 'hit') n.setAnim(n.worker ? 'work' : 'idle');
      n.vx = n.vz = 0;
      n.animate(dt, rates);
      return;
    } else if (n.rincasa) {
      // e' sera e questo e' di troppo: va verso casa, cioe' via dal
      // giocatore, senza soste
      if (n.t <= 0) {
        n.t = 1 + Math.random();
        n.heading = Math.atan2(n.z - player.z, n.x - player.x) +
                    (Math.random() - 0.5) * 0.9;
      }
    } else if (n.residente === undefined && ZONE_CON_VIE.has(zonaDi(n.x, n.z))) {
      // Il passante in citta' va da un punto all'altro delle vie, per la
      // strada (nav.js), e all'arrivo si ferma un poco. Prima girava a caso
      // ogni due secondi e strisciava lungo le facciate.
      if (n.sostaT > 0) {
        n.sostaT -= dt;
        sp = 0;
      } else {
        if (n.meta && Math.hypot(n.meta.x - n.x, n.meta.z - n.z) < 2.5) {
          n.meta = null;
          n.sostaT = 0.8 + Math.random() * 3.5;
        } else if (!n.meta) {
          n.meta = metaSulleVie(n);
        }
        if (n.meta) {
          const h = Nav.direzione(world, n, n.meta, time);
          n.heading = h === null ? Math.atan2(n.meta.z - n.z, n.meta.x - n.x) : h;
        }
      }
    } else if (n.anchor && n.raggio > 0 && !n.inStanza) {
      // Il residente va da un punto all'altro del suo recinto per la strada
      // (nav.js), come i passanti sulle vie, e all'arrivo sosta o lavora.
      // Prima girava a caso ogni due secondi e restava contro i muri del
      // recinto: 9 incastrati su 74 in 20 s.
      if (n.sostaT > 0) {
        n.sostaT -= dt;
        sp = 0;
      } else {
        n.metaT = (n.metaT || 0) + dt;
        if (n.meta && (Math.hypot(n.meta.x - n.x, n.meta.z - n.z) < 1.2 || n.metaT > 12)) {
          n.meta = null;
          if (n.worker && Math.random() < 0.45) n.workT = 3 + Math.random() * 6;
          else n.sostaT = 1 + Math.random() * 4;
          sp = 0;
        } else if (!n.meta) {
          // la rotta vecchia va buttata: Nav.direzione la tiene buona se la
          // meta nuova sta entro 6 dalla vecchia, e in un recinto di pochi
          // passi e' sempre cosi' (si tornava sulla meta gia' raggiunta)
          n.meta = metaNelRecinto(n);
          n.metaT = 0;
          n.rotta = null;
        }
        if (n.meta) {
          const h = Nav.direzione(world, n, n.meta, time);
          n.heading = h === null ? Math.atan2(n.meta.z - n.z, n.meta.x - n.x) : h;
        } else sp = 0;
      }
    } else if (n.t <= 0) {
      n.t = 1.2 + Math.random() * 3.2;
      const fuori = n.anchor &&
        Math.hypot(n.x - n.anchor.x, n.z - n.anchor.z) > n.raggio;
      if (fuori) {
        // rientra: e' cio' che tiene il contadino nei campi e il nobile
        // nel suo quartiere invece di farli sciamare per tutta la mappa
        n.heading = Math.atan2(n.anchor.z - n.z, n.anchor.x - n.x) +
                    (Math.random() - 0.5) * 0.8;
        n.t = 1.5 + Math.random() * 2;
      } else {
        n.heading += (Math.random() - 0.5) * 2.4;
        if (n.worker && Math.random() < 0.45) n.workT = 3 + Math.random() * 6;
        else if (Math.random() < 0.3) { n.t = 0.6 + Math.random() * 2; sp = 0; }
      }
    }

    const bx = n.x, bz = n.z;
    [n.x, n.z] = muovi(n.x, n.z, Math.cos(n.heading) * sp * dt,
                       Math.sin(n.heading) * sp * dt, 0.42);
    // contro qualcosa (fa meno di meta' del passo: fermo o striscia lungo un
    // muro): fermoT lo legge la navigazione, urti e rimbalzi i collaudi
    const fermo = sp > 0 && Math.hypot(n.x - bx, n.z - bz) < sp * dt * 0.5;
    if (fermo && !n.fermoT) n.rimbalzi = (n.rimbalzi || 0) + 1;
    n.fermoT = fermo ? (n.fermoT || 0) + dt : 0;
    if (fermo) n.urti = (n.urti || 0) + dt;
    if (n.x === bx && n.z === bz) n.heading += 1.8 + Math.random();
    n.vx = (n.x - bx) / dt; n.vz = (n.z - bz) / dt;
    n.faceMove();
    if (n.anim !== 'attack' && n.anim !== 'hit') {
      const moving = Math.hypot(n.vx, n.vz) > 0.25;
      n.setAnim(moving ? (n.state === 'flee' ? 'run' : 'walk') : 'idle');
    }
    n.animate(dt, rates);
  }

  function updateBeast(b, dt) {
    const rates = Assets.manifest.chars.frame_rates;
    if (b.dead) { b.deadT += dt; b.animate(dt, rates); return; }

    if (b.vola) {
      // gli uccelli ignorano le collisioni e girano in tondo sopra i tetti;
      // se ti avvicini troppo si alzano
      b.t -= dt;
      if (b.t <= 0) { b.t = 2 + Math.random() * 4; b.heading += (Math.random() - 0.5) * 2; }
      const dpv = Math.hypot(b.x - player.x, b.z - player.z);
      if (dpv < 8) { b.heading = Math.atan2(b.z - player.z, b.x - player.x);
                     b.quota = Math.min(7, b.quota + dt * 2.5); }
      else b.quota += (3.2 - b.quota) * dt * 0.5;
      const sv = 4.5;
      b.x += Math.cos(b.heading) * sv * dt;
      b.z += Math.sin(b.heading) * sv * dt;
      b.vx = Math.cos(b.heading) * sv;
      b.faceMove();
      b.setAnim('walk');            // nel manifest 'fly' e' mappata su walk
      b.animate(dt, rates);
      return;
    }

    b.hitT = Math.max(0, b.hitT - dt);
    b.atkCd = Math.max(0, b.atkCd - dt);
    b.t -= dt;
    const dp = Math.hypot(b.x - player.x, b.z - player.z);

    let sp = b.speed;
    if (b.aggressive && dp < 22 && !player.dead) {
      // lupi, orsi e cinghiali cacciano: il bosco non e' una passeggiata
      b.state = 'hunt';
      b.heading = Math.atan2(player.z - b.z, player.x - b.x);
      if (dp < 1.6 && b.atkCd <= 0) {
        b.atkCd = 1.3;
        b.setAnim('attack');
        player.hurt((8 + Math.random() * 7) * (b.forza || 1));
        Sfx.hurt(); scuoti(0.5);
        if (player.hp <= 0 && !player.dead) {
          if (player.vehicle) { player.vehicle.rider = null; player.scendi(); }
          player.dead = true; player.setAnim('death'); Sfx.die();
        }
      }
    } else if (!b.aggressive && dp < 14) {
      b.state = 'flee';
      b.heading = Math.atan2(b.z - player.z, b.x - player.x);
      sp = b.speed * 1.9;
    } else {
      b.state = 'wander';
      sp = b.speed * 0.45;
      if (b.t <= 0) {
        b.t = 1.5 + Math.random() * 4;
        b.heading += (Math.random() - 0.5) * 2.6;
      }
    }

    const bx = b.x, bz = b.z;
    [b.x, b.z] = world.move(b.x, b.z, Math.cos(b.heading) * sp * dt,
                            Math.sin(b.heading) * sp * dt, 0.4);
    if (b.x === bx && b.z === bz) b.heading += 1.9;
    b.vx = (b.x - bx) / dt; b.vz = (b.z - bz) / dt;
    b.faceMove();
    if (b.anim !== 'attack' && b.anim !== 'hit') {
      const moving = Math.hypot(b.vx, b.vz) > 0.25;
      b.setAnim(moving ? (b.state === 'wander' ? 'walk' : 'run') : 'idle');
    }
    b.animate(dt, rates);
  }

  function updateGuard(g, dt) {
    const rates = Assets.manifest.chars.frame_rates;
    if (g.dead) { g.deadT += dt; g.animate(dt, rates); return; }
    g.hitT = Math.max(0, g.hitT - dt);
    g.atkCd = Math.max(0, g.atkCd - dt);
    const dp = Math.hypot(g.x - player.x, g.z - player.z);

    // --- la notizia viaggia, non appare
    if (player.stars === 0) { g.informato = 0; g.daAvvisare = null; }
    if (g.informato > 0) {
      g.informato -= dt;
      // chi sa urla: le guardie a portata di voce lo sanno subito
      for (const a of guards) {
        if (a === g || a.dead || a.informato > 0) continue;
        if (Math.hypot(a.x - g.x, a.z - g.z) < VISTA.urlo && varco(g, a))
          informa(a, g.informato * 0.9);
      }
      // e una la va a cercare di persona, per la strada (nav.js) — non
      // troppo lontano: a cinquanta unita' non ci arriva prima che gli passi
      // la memoria. Meglio una staffetta corta che un viaggio fallito.
      if (!g.daAvvisare && g.informato > 6) {
        let best = null, bd = 38;
        for (const a of guards) {
          if (a === g || a.dead || a.informato > 0) continue;
          const d = Math.hypot(a.x - g.x, a.z - g.z);
          if (d < bd) { bd = d; best = a; }
        }
        if (best && bd > VISTA.urlo) { g.daAvvisare = best; g.informato += 4; }
      }
    }
    // La campana: da tre stelle in su non e' piu' un passaparola, e' il
    // borgo intero che si sveglia. E' anche il momento in cui suona il corno.
    if (player.stars >= VISTA.campana && !g.informato &&
        dp < 90 && !player.dead) informa(g, VISTA.memoria);

    // una guardia che vede il ladro con la taglia addosso si informa da sola
    if (player.stars > 0 && !g.informato && !player.dead &&
        dp < raggioVista() && varco(g, player))
      informa(g, VISTA.memoria);

    // il messaggero: molla tutto e corre dal collega
    if (g.daAvvisare && !g.daAvvisare.dead && player.stars > 0 &&
        g.daAvvisare.informato <= 0) {
      const m = g.daAvvisare;
      const d = Math.hypot(m.x - g.x, m.z - g.z);
      if (d < 3.2) { informa(m, g.informato); g.daAvvisare = null; }
      else {
        g.state = 'avvisa';
        // la strada verso il collega, non la linea d'aria: prima strisciava
        // lungo i muri (collaudo: 30 arrivi su 40 contro 38 con la rotta)
        const h = Nav.direzione(world, g, m, time);
        g.heading = h === null ? Math.atan2(m.z - g.z, m.x - g.x) : h;
        const bx0 = g.x, bz0 = g.z, passo = g.speed * 1.25 * dt;
        [g.x, g.z] = world.move(g.x, g.z, Math.cos(g.heading) * passo,
                                Math.sin(g.heading) * passo, 0.45);
        const fermo = Math.hypot(g.x - bx0, g.z - bz0) < passo * 0.5;
        g.fermoT = fermo ? (g.fermoT || 0) + dt : 0;
        if (g.x === bx0 && g.z === bz0) g.heading += 1.7;
        g.vx = (g.x - bx0) / dt; g.vz = (g.z - bz0) / dt;
        g.faceMove();
        if (g.anim !== 'attack' && g.anim !== 'hit') g.setAnim('run');
        g.animate(dt, rates);
        return;
      }
    } else if (g.daAvvisare) {
      g.daAvvisare = null;
    }

    const hunting = g.informato > 0 && player.stars > 0 &&
                    dp < 55 + player.stars * 14;

    // un assalto ha la precedenza su qualunque taglia: la ronda molla il
    // ladro e corre al nemico, ed e' la finestra migliore per sparire
    let nem = null, nd = 26 * 26;
    for (const e of nemici) {
      if (e.dead || e.duellante) continue;
      const d = (e.x - g.x) ** 2 + (e.z - g.z) ** 2;
      if (d < nd) { nd = d; nem = e; }
    }

    let sp = g.speed;
    if (nem) {
      g.state = 'guerra';
      const w = armaDi(g);
      const passo = passoDiTiro(g, nem, w);
      g.heading = passo.heading;
      sp = passo.avanza ? g.speed * 1.1 : 0;
      attaccaNpc(g, nem);
    } else if (hunting && !player.dead) {
      g.state = 'chase';
      const w = armaDi(g);
      const passo = passoDiTiro(g, player, w);
      g.heading = passo.heading;
      sp = passo.avanza ? g.speed * (1 + player.stars * 0.14) : 0;
      attaccaNpc(g, player);
    } else if (g.fisso && g.anchor &&
               Math.hypot(g.x - g.anchor.x, g.z - g.anchor.z) > 1.2) {
      // sentinella che ha inseguito qualcuno: torna al suo posto, per la strada
      g.state = 'ritorno';
      const h = Nav.direzione(world, g, g.anchor, time);
      g.heading = h !== null ? h : Math.atan2(g.anchor.z - g.z, g.anchor.x - g.x);
      sp = g.speed * 0.62;
    } else if (g.fisso) {
      // sentinella: piantata al suo posto, guarda avanti
      g.state = 'sentinella';
      g.vx = g.vz = 0;
      if (g.anim !== 'attack' && g.anim !== 'hit') g.setAnim('idle');
      g.animate(dt, rates);
      return;
    } else {
      // Ronda vera: la guardia sceglie un punto sulle vie lastricate e ci
      // cammina sopra. Prima vagava a caso e sembrava un passante armato.
      g.state = 'patrol';
      if (!g.meta || Math.hypot(g.x - g.meta.x, g.z - g.meta.z) < 3.5 || g.t <= 0) {
        g.t = 14 + Math.random() * 10;
        let best = null, bd = 1e9;
        for (let k = 0; k < 10 && world.patrol.length; k++) {
          const q = world.patrol[Math.floor(Math.random() * world.patrol.length)];
          const dq = Math.hypot(q.x - g.x, q.z - g.z);
          if (dq > 12 && dq < bd) { bd = dq; best = q; }
        }
        g.meta = best || { x: g.post.x, z: g.post.z };
      }
      g.t -= dt;
      g.heading = Math.atan2(g.meta.z - g.z, g.meta.x - g.x);
      sp = g.speed * 0.62;
    }
    if (g.mounted) sp *= Meteo.fattore('fango');      // i cavalli nel fango
    const bx = g.x, bz = g.z;
    [g.x, g.z] = world.move(g.x, g.z, Math.cos(g.heading) * sp * dt,
                            Math.sin(g.heading) * sp * dt, 0.45);
    if (g.x === bx && g.z === bz) { g.heading += 1.7 + Math.random(); g.meta = null; }
    g.vx = (g.x - bx) / dt; g.vz = (g.z - bz) / dt;
    g.faceMove();
    if (g.anim !== 'attack' && g.anim !== 'hit')
      g.setAnim(Math.hypot(g.vx, g.vz) > 0.25 ? (hunting ? 'run' : 'walk') : 'idle');
    g.animate(dt, rates);
    if (g.mounted && hunting && Math.random() < dt * 5) Sfx.hoof();
  }

  // ------------------------------------------------- l'altro villaggio
  //
  // I nemici non fanno parte del borgo: ucciderli non alza la taglia, e la
  // ronda combatte dalla tua parte. In compenso non c'e' nessuna stella a
  // proteggerti da loro.

  // I nemici non sono tinti a runtime: hanno sprite propri con la divisa
  // rossa, prodotti rimappando i pixel blu delle vesti in fase di build.
  // Incarnato, cuoio ed elmo restano quelli, e lo sprite non si spappola.
  const rosso = n => n + '@rosso';

  const assalto = { attivo: false, t: 0, prossimo: 70 + Math.random() * 90,
                    porta: null, quanti: 0 };
  const nemiciAttivi = new Map();      // indice del nemico residente → entita'

  // Quanto "pesa" un bersaglio: distanza moltiplicata per questi fattori, e
  // vince la piu' piccola. Prima si sceglieva il piu' vicino e basta, con il
  // risultato che in un borgo pieno di ronde una guardia era sempre piu'
  // vicina del ladro: gli assalitori si scannavano con la guardia e del
  // giocatore non si accorgevano. Il ladro ora pesa meno della meta': una
  // guardia deve essere piu' che doppiamente vicina per avere la precedenza.
  const PESO_BERSAGLIO = { ladro: 0.42, guardia: 1.0, civile: 2.4 };
  // Gli assalitori dell'altro villaggio (e.assaltatore, messo alla nascita)
  // non danno la caccia al ladro: sei un ladro, non il re (tua
  // richiesta del 30/09). Mirano a guardie e popolo, e ti colpiscono solo se
  // gli passi accanto, o se sei tu ad averli attaccati (rancore) o a essere
  // stato visto rubare (allarmato, sopra). Pesi: il ladro conta quasi tre
  // volte la distanza, cioe' entra nel loro raggio (34) solo a meno di ~11
  const PESO_ASSALTO = { ladro: 3.0, guardia: 0.8, civile: 1.0 };

  function bersaglioPerNemico(e) {
    if (e.allarmato > 0 && !player.dead) return player;   // ti ha visto rubare
    if (e.rancore > 0 && !player.dead) return player;     // gliel'hai data tu
    const PESO = e.assaltatore ? PESO_ASSALTO : PESO_BERSAGLIO;
    let best = null, bd = 34;
    if (!player.dead) {
      const d = Math.hypot(player.x - e.x, player.z - e.z) * PESO.ladro;
      if (d < bd) { bd = d; best = player; }
    }
    for (const g of guards) {
      if (g.dead) continue;
      const d = Math.hypot(g.x - e.x, g.z - e.z) * PESO.guardia;
      if (d < bd) { bd = d; best = g; }
    }
    // i civili sono l'ultima scelta, ma una scorreria che li ignora del tutto
    // non sembra una scorreria
    for (const n of npcs) {
      if (n.dead || n.prigioniero || n.protetto) continue;   // protetto: dai suoi
      const d = Math.hypot(n.x - e.x, n.z - e.z) * PESO.civile;
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  function updateNemico(e, dt) {
    const rates = Assets.manifest.chars.frame_rates;
    if (e.dead) { e.deadT += dt; e.animate(dt, rates); return; }
    e.hitT = Math.max(0, e.hitT - dt);
    e.atkCd = Math.max(0, e.atkCd - dt);
    e.t -= dt;
    if (e.allarmato > 0) e.allarmato -= dt;

    if (e.rancore > 0) e.rancore -= dt;

    const b = e.punta ? e.punta() : bersaglioPerNemico(e);   // punta: l'incarico sceglie
    e.bersaglioCorrente = b;          // serve ai collaudi: chi sta puntando
    let sp = e.speed;
    if (b) {
      e.state = 'attacca';
      const w = armaDi(e);
      const passo = passoDiTiro(e, b, w);
      e.heading = passo.heading;
      sp = passo.avanza ? e.speed * 1.15 : 0;
      attaccaNpc(e, b);
    } else if (e.meta) {
      // marcia dell'assalto: punta la piazza finche' non trova qualcuno
      e.state = 'marcia';
      e.heading = Math.atan2(e.meta.z - e.z, e.meta.x - e.x);
      if (Math.hypot(e.meta.x - e.x, e.meta.z - e.z) < 6) e.meta = null;
    } else {
      e.state = 'wander';
      sp = e.speed * 0.45;
      if (e.t <= 0) {
        e.t = 1.6 + Math.random() * 3.5;
        const fuori = e.anchor &&
          Math.hypot(e.x - e.anchor.x, e.z - e.anchor.z) > e.raggio;
        e.heading = fuori
          ? Math.atan2(e.anchor.z - e.z, e.anchor.x - e.x)
          : e.heading + (Math.random() - 0.5) * 2.4;
      }
    }

    const bx = e.x, bz = e.z;
    [e.x, e.z] = muovi(e.x, e.z, Math.cos(e.heading) * sp * dt,     // anche nelle stanze
                       Math.sin(e.heading) * sp * dt, 0.45);
    if (e.x === bx && e.z === bz) e.heading += 1.8 + Math.random();
    e.vx = (e.x - bx) / dt; e.vz = (e.z - bz) / dt;
    e.faceMove();
    if (e.anim !== 'attack' && e.anim !== 'hit')
      e.setAnim(Math.hypot(e.vx, e.vz) > 0.25
                ? (e.state === 'wander' ? 'walk' : 'run') : 'idle');
    e.animate(dt, rates);
  }

  function aggiornaNemiciDiCampo(px, pz) {
    const L = world.nemici;
    for (let i = 0; i < L.length; i++) {
      const r = L[i];
      const d = Math.hypot(r.x - px, r.z - pz);
      const vivo = nemiciAttivi.get(i);
      // un campo passato al borgo non rimanda nessuno
      if (d < 95 && !vivo && !world.accampamenti[r.campo].preso) {
        // la divisa rossa anche a chi sta al campo: senza, i guerrieri degli
        // accampamenti erano identici alle guardie del borgo
        const e = new Nemico(rosso(r.sprite), r.x, r.z,
                             { anchor: r.anchor, raggio: r.raggio });
        e.residente = i;
        nemiciAttivi.set(i, e);
        nemici.push(e);
      } else if (d > 125 && vivo) {
        nemiciAttivi.delete(i);
        const k = nemici.indexOf(vivo);
        if (k >= 0) nemici.splice(k, 1);
      } else if (vivo && vivo.dead && vivo.deadT > 60) {
        // L'accampamento rimanda gente, ma solo quando gli hai voltato le
        // spalle: altrimenti ripulirlo sarebbe impossibile e la conquista
        // un obiettivo finto.
        const lontano = !r.anchor ||
          Math.hypot(r.anchor.x - px, r.anchor.z - pz) > 95;
        if (lontano) nemiciAttivi.delete(i);
      }
    }
    // i nemici dell'assalto, che non hanno un accampamento, si puliscono soli;
    // finche' l'assalto dura i vivi restano anche lontani: dalla piazza tutte
    // le porte stanno oltre 130, e gli assalitori sparivano appena nati
    for (let i = nemici.length - 1; i >= 0; i--) {
      const e = nemici[i];
      if (e.residente !== undefined) continue;
      const lontano = Math.hypot(e.x - px, e.z - pz) > 145;
      if ((lontano && !(assalto.attivo && !e.dead) && !e.missione) ||
          (e.dead && e.deadT > 18)) nemici.splice(i, 1);
    }
  }

  // ------------------------------------------------- il colpo agli accampamenti
  //
  // Due vie. Quella del ladro: al centro di ogni campo c'e' la cassa del
  // bottino, ci si accosta, si sta fermi il tempo di forzarla e si sparisce —
  // se un nemico si avvicina a dodici passi, le mani si fermano. Quella della
  // spada: ripulire il campo, che allora passa al borgo (updateConquista).

  const colpo = { acc: null, prog: 0, richiesto: 6, visto: false };
  let tributoT = 0;

  function campiSvaligiati() {
    return world.accampamenti.filter(a => a.svaligiato > 0).length;
  }

  function updateColpoCampo(dt) {
    for (const a of world.accampamenti)
      if (a.svaligiato > 0) a.svaligiato -= dt;

    let acc = null;
    for (const a of world.accampamenti) {
      if (a.svaligiato > 0) continue;
      if (Math.hypot(player.x - a.vessillo.x, player.z - a.vessillo.z) < 6) {
        acc = a; break;
      }
    }
    if (!acc || player.dead || player.vehicle) {
      if (colpo.acc) { colpo.acc = null; colpo.prog = 0; }
      return;
    }
    if (colpo.acc !== acc) { colpo.acc = acc; colpo.prog = 0; }

    const occhi = nemici.filter(e => !e.dead &&
      Math.hypot(e.x - acc.vessillo.x, e.z - acc.vessillo.z) < 12).length;
    colpo.visto = occhi > 0;
    if (occhi > 0) {
      colpo.prog = Math.max(0, colpo.prog - dt * 1.2);
      return;
    }
    colpo.prog += dt;
    if (colpo.prog >= colpo.richiesto) svaligia(acc);
  }

  function svaligia(acc) {
    colpo.acc = null; colpo.prog = 0;
    acc.svaligiato = 200;            // la cassa torna a riempirsi col tempo
    const bottino = 180 + Math.floor(Math.random() * 170);
    player.money += bottino;
    stats.guadagnati += bottino;
    flash = 0.5;
    Sfx.coin(); Sfx.quest();
    // adesso ti hanno visto: tutti quelli del campo ti vogliono
    for (const e of nemici) {
      if (e.dead) continue;
      if (Math.hypot(e.x - acc.x, e.z - acc.z) < acc.r) e.allarmato = 12;
    }
    say(TX('gioco.campo.cassa', { campo: acc.nome, bottino }), 6);
  }

  // L'altra via, quella con la spada: un campo ripulito a forza passa al
  // borgo. Si ammaina il rosso, si issa il blu e da li' non parte piu'
  // nessuno. Vale solo se sei li': i morti di un campo lontano non contano.
  function updateConquista() {
    for (const acc of world.accampamenti) {
      if (acc.preso) continue;
      if (Math.hypot(player.x - acc.x, player.z - acc.z) > acc.r) continue;
      let suoi = 0, morti = 0;
      world.nemici.forEach((r, i) => {
        if (r.campo !== acc.indice) return;
        suoi++;
        const e = nemiciAttivi.get(i);
        if (e && e.dead) morti++;
      });
      if (!suoi || morti < suoi) continue;
      world.issaColoriDelBorgo(acc);
      Gfx.invalidaIntorno(acc.x, acc.z, acc.r);
      flash = 0.4;
      Sfx.quest();
      say(TX('gioco.campo.preso', { campo: acc.nome }), 6);
    }
  }

  // ------------------------------------------------------------ la corte
  //
  // La corte del castello non e' una piazza: una guardia che vede un ladro
  // li' dentro lo avverte, e se dopo qualche secondo e' ancora li' (e c'e'
  // chi lo vede) e' un reato, una stella. La ragione di starci arriva col
  // capitolo 5: il Ciambellano ti aspetta proprio nella corte.
  const CORTE_TOLLERANZA = 6;          // secondi fra l'avvertimento e il reato
  const corte = { avvisoT: 0, avvisato: false, denunciato: false };

  // dentro le mura della corte, che stanno su CORTE.x0..x1 e y0..y1 (in
  // tile, world_borgo.js e world_fiordo.js). Prima arrivava a x1 + 1 e y1 + 1:
  // una tile oltre il muro di levante e oltre la porta si era gia' "dentro",
  // e le guardie attaccavano chi stava fuori (26/09, nel fiordo)
  function nellaCorte(x, z) {
    const { CORTE } = world.pianta;
    return x > CORTE.x0 * TILE && x < CORTE.x1 * TILE &&
           z > CORTE.y0 * TILE && z < CORTE.y1 * TILE;
  }

  function updateCorte(dt) {
    if (player.dead || Storia.corteLibera() || !nellaCorte(player.x, player.z)) {
      corte.avvisoT = 0; corte.avvisato = corte.denunciato = false;
      return;
    }
    const visto = testimone(player.x, player.z);
    if (!corte.avvisato) {
      if (!visto) return;
      corte.avvisato = true;
      say(TX('gioco.corte.avviso'), 4);
      return;
    }
    corte.avvisoT += dt;
    if (!corte.denunciato && corte.avvisoT > CORTE_TOLLERANZA && visto)
      corte.denunciato = crime(8, TX('gioco.reato.corte'));
  }

  function updateTributo(dt) {
    tributoT += dt;      // resta solo come contatore, nessun reddito passivo
  }

  function updateAssalto(dt) {
    const dentro = player.x > WALL_X0 - 40 && player.x < WALL_X1 + 40 &&
                   player.z > WALL_Y0 - 40 && player.z < WALL_Y1 + 40;
    if (assalto.attivo) {
      assalto.t -= dt;
      const vivi = nemici.filter(e => !e.dead && e.residente === undefined).length;
      if (assalto.t <= 0 || vivi === 0) {
        assalto.attivo = false;
        assalto.prossimo = 150 + Math.random() * 170;
        if (vivi === 0) say(TX('gioco.assalto.respinto'), 5);
      }
      return;
    }
    if (!dentro) return;             // non si assalta un borgo vuoto
    assalto.prossimo -= dt;
    if (assalto.prossimo > 0) return;

    // ogni campo passato al borgo e' una scorreria in meno: con tutti presi
    // l'altro villaggio non ha piu' da dove partire
    const liberi = world.accampamenti.filter(a => !a.preso).length;
    if (!liberi) { assalto.prossimo = 150 + Math.random() * 170; return; }

    // porta piu' lontana da te: l'allarme deve arrivare prima dei nemici
    const DOVE = { W: 'ponente', N: 'settentrione', E: 'levante', S: 'mezzogiorno' };
    const porte = world.pianta.GATES.map(q =>
      ({ x: q.x * TILE, z: q.y * TILE, dove: DOVE[q.dir] }));
    // se nessuna porta e' a portata (dalla piazza distano tutte oltre 130),
    // la piu' vicina: prima era sempre ponente, anche dall'altra parte
    let sc = null, sd = -1, vicina = porte[0], vd = Infinity;
    for (const q of porte) {
      const d = Math.hypot(q.x - player.x, q.z - player.z);
      if (d > sd && d < 115) { sd = d; sc = q; }
      if (d < vd) { vd = d; vicina = q; }
    }
    sc = sc || vicina;
    const { PLAZA } = world.pianta;
    const meta = { x: PLAZA.x * TILE, z: PLAZA.y * TILE };
    // soldati, non vecchi: il vecchio guerriero usciva in quasi ogni assalto
    const guerrieri = cast('nemico_assalto').map(rosso);
    const tutti = world.accampamenti.length || 1;
    const quanti = Math.max(3, Math.round(
      (6 + Math.floor(Math.random() * 6)) * liberi / tutti));
    for (let i = 0; i < quanti; i++) {
      const a = Math.random() * Math.PI * 2, rr = 2 + Math.random() * 12;
      const x = sc.x + Math.cos(a) * rr, z = sc.z + Math.sin(a) * rr;
      if (world.blocked(x, z)) continue;
      const n = new Nemico(pick(guerrieri), x, z, { meta, hp: 52, speed: 4.1 });
      n.assaltatore = true;
      nemici.push(n);
    }
    assalto.attivo = true;
    assalto.t = 150;
    assalto.porta = sc;
    Sfx.horn();
    scuoti(0.5);
    flash = 0.25;
    say(TX('gioco.assalto.corno', { dove: sc.dove }), 8);
    // il popolo scappa
    for (const n of npcs) {
      if (n.prof === 'guardia' || n.dead) continue;
      n.state = 'flee'; n.fleeT = 12 + Math.random() * 10;
    }
  }

  function updateWanted(dt) {
    if (player.wanted > 0 && time - lastCrime > 12) {
      player.wanted = Math.max(0, player.wanted - dt * 2.2);
    }
    if (player.hp < player.maxHp && time - lastCrime > 8) {
      player.hp = Math.min(player.maxHp, player.hp + dt * 1.6);
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
      p.vy -= 5 * dt;
    }
  }

  // ------------------------------------------------------------ disegno

  function activeLights() {
    const out = [];
    const px = player.x, pz = player.z;
    const night = isNight();
    const mul = night ? 1 : 0.16;
    const cand = world.lights;
    // solo le piu' vicine: le uniform sono 24
    const near = [];
    for (const L of cand) {
      const d = (L.x - px) ** 2 + (L.z - pz) ** 2;
      if (d < 80 * 80) near.push([d, L]);
    }
    near.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < Math.min(21, near.length); i++) {
      const L = near[i][1];
      const fl = L.flicker
        ? 0.82 + 0.18 * Math.sin(time * (6 + L.x % 3) + L.z) +
          0.08 * Math.sin(time * 19.3 + L.x)
        : 1;
      out.push({ ...L, mul: mul * fl });
    }
    // torcia del giocatore di notte: senza, i vicoli sono illeggibili
    if (night) {
      out.push({ x: px, y: 1.6, z: pz, color: [1.0, 0.72, 0.42],
                 radius: 16, mul: 0.95 });
    }
    for (const p of particles) {
      if (p.col[0] > 0.8 && out.length < 24)
        out.push({ x: p.x, y: p.y, z: p.z, color: p.col, radius: 4,
                   mul: p.life / p.max });
    }
    return out;
  }

  function drawActor(a) {
    const tint = a.hitT > 0 ? [1.9, 0.75, 0.7] : [1, 1, 1];
    // fermo, respira: un saltello di meno di un pixel, sfasato per ciascuno
    const respiro = a.anim === 'idle' && !a.dead && !a.vola
      ? 0.02 + Math.abs(Math.sin(time * 1.7 + a.x * 0.83 + a.z * 0.41)) * 0.07 : undefined;
    Gfx.drawChar(a.sprite, a.anim, a.frame, a.x, a.z,
                 { flip: a.flip, tint, y: a.vola ? a.quota : respiro,
                   shadowAlpha: a.dead ? 0.5 : (a.vola ? 0.35 : 1) });
  }

  function drawVehicle(v) {
    // il cavallo montato dal giocatore e' gia' dentro lo sprite composto
    if (v.rider === player && v.type === 'cavallo') return;
    if (v.type === 'cavallo') {
      // il cavallo e' un personaggio, non un ritaglio: lo stesso cavallo_mini
      // che si accascia quando ti muore sotto, animato come la gente
      const sp = Math.abs(v.speed);
      const anim = sp > 6 ? 'run' : (sp > 0.5 ? 'walk' : 'idle');
      const fps = Assets.manifest.chars.frame_rates[anim] || 8;
      Gfx.drawChar(v.bestia || 'cavallo_mini', anim, Math.floor(time * fps + v.wobble),
                   v.x, v.z, { flip: v.flip });
      return;
    }
    if (v.type === 'barca') { drawBarca(v); return; }
    const r = Assets.world(v.name);
    if (!r) return;
    // i carri sono disegnati a piombo: stesi sul terreno e ruotati con la
    // direzione di marcia, come le barche
    Gfx.drawWorldSpriteGround(v.name, v.x, v.z, v.rot);
    if (v.rotto) return;                  // il relitto: il cavallo se n'e' andato
    // e li tira una bestia (bestie.js): un carro che va da solo, visto dall'alto,
    // sembra un furgone. Di profilo come tutta la gente del gioco, davanti al muso.
    const sp = Math.abs(v.speed);
    const anim = sp > 7 ? 'run' : (sp > 0.5 ? 'walk' : 'idle');
    const fps = Assets.manifest.chars.frame_rates[anim] || 8;
    const avanti = r.hu / 2 + 1.2;
    Gfx.drawChar(v.bestia || 'cavallo_mini', anim, Math.floor(time * fps + v.wobble),
                 v.x + Math.cos(v.rot) * avanti, v.z + Math.sin(v.rot) * avanti,
                 { flip: v.flip });
    if (v.rider) {
      // il conducente sta a cassetta, verso il muso
      const k = r.hu * 0.22;
      Gfx.drawChar(v.rider.sprite, Math.abs(v.speed) > 1 ? 'walk' : 'idle',
                   v.rider.frame, v.x + Math.cos(v.rot) * k,
                   v.z + Math.sin(v.rot) * k,
                   { flip: v.flip, shadow: false, y: 0.35 });
    }
  }

  // La barca: lo scafo steso sull'acqua ruota con la rotta come i carri; la
  // vela sta in piedi come la gente, e in cima all'albero sventola la
  // bandiera (disegna_pezzi: araldica da un seme). Chi la guida sta a poppa.
  function drawBarca(v) {
    const r = Assets.world(v.name), s = v.scala || 1;
    const scafo = r && { wu: r.wu * s, hu: r.hu * s };      // i drakkar sono piu' grandi
    // l'acqua smossa attorno allo scafo: senza, lo scafo scuro sull'acqua
    // cupa sembrava affondare. Dal 14/10 un bordino (la pozza era "stagnante")
    // Le quote: la schiuma a 0,2 e lo scafo a 0,45, ben sopra l'acqua e fra
    // loro. Prima 0,06 e 0,1: sotto il passo del depth buffer (~0,07, v.
    // gfx.js) acqua e schiuma coprivano lo scafo, che sembrava affondato (tua
    // foto del 30/09, "le barche sono troppo in basso")
    const rot = Scia.dondolo(v, time);                       // scia.js
    // sotto il ponte (06/10): lo scafo sotto l'impalcato (0,16), che lo copre;
    // niente scia, e vela, bandiera e chi guida non si vedono
    const sotto = world.sottoPonte(v.x, v.z, scafo ? scafo.hu / 2 : 3);
    if (scafo && !sotto) {
      Scia.disegna(v, time, scafo);
      const k = 1.05 + Math.min(0.2, Math.abs(v.speed) * 0.03);   // 14/10: un bordino, non la pozza
      Gfx.drawWorldSpriteGround('schiuma', v.x, v.z, rot,
                                { y: 0.2, wu: scafo.wu * k, hu: scafo.hu * 1.04 * k });
    }
    Gfx.drawWorldSpriteGround(v.name, v.x, v.z, rot, { y: sotto ? 0.1 : 0.45,
                                                         wu: scafo && scafo.wu,
                                                         hu: scafo && scafo.hu });
    if (world.sottoPonte(v.x, v.z)) return;
    const poppa = scafo ? -scafo.hu * 0.32 : -2.2;
    const vela = Assets.world(v.vela);
    const piede = 0.55;
    Gfx.drawWorldSprite(v.vela, v.x, v.z, { flip: v.flip, shadow: false, y: piede });
    if (vela) {
      // la cima di un billboard alto hu sta hu*sin piu' a nord e hu*cos piu' su
      const T = Gfx.TILT;
      Gfx.drawWorldSprite(v.bandiera, v.x + (v.flip ? -0.5 : 0.5),
                          v.z - vela.hu * Math.sin(T),
                          { flip: v.flip, shadow: false, sway: 0.6,
                            y: piede + vela.hu * Math.cos(T) - 0.1 });
    } else if (v.bandiera) {
      // il drakkar ha la vela dipinta nello scafo visto dall'alto: la
      // bandiera sta in cima all'albero, a meta' scafo, alta come una vela
      Gfx.drawWorldSprite(v.bandiera, v.x, v.z - 3.2 * Math.sin(Gfx.TILT),
                          { flip: v.flip, shadow: false, sway: 0.6,
                            y: piede + 3.2 * Math.cos(Gfx.TILT) });
    }
    if (v.rider) {
      Gfx.drawChar(v.rider.sprite, 'idle', v.rider.frame, v.x + Math.cos(v.rot) * poppa,
                   v.z + Math.sin(v.rot) * poppa, { flip: v.flip, shadow: false, y: 0.55 });
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const k = Math.max(0.05, p.life / p.max);
      Gfx.drawWorldSprite('icona_gemma', p.x, p.z, {
        hu: 0.32 * k, wu: 0.32 * k, y: p.y, shadow: false,
        tint: [p.col[0] * 2.2, p.col[1] * 2.2, p.col[2] * 2.2],
      });
    }
  }

  function drawMarker(goal) {
    if (!goal) return;
    const bob = 0.35 + Math.sin(time * 3) * 0.18;
    // l'anello a terra, che pulsa: si vede da lontano anche se la stella no
    const s = 3.0 + Math.sin(time * 3) * 0.45;
    Gfx.drawWorldSpriteGround('anello_marker', goal.x, goal.z, 0,
                              { wu: s, hu: s, y: 0.06, tint: [1.6, 1.4, 0.7] });
    Gfx.drawWorldSprite('icona_stella_piena', goal.x, goal.z, {
      hu: 1.5, wu: 1.5, y: 2.4 + bob, shadow: false, tint: [1.7, 1.5, 0.7],
    });
  }

  // I bersagli di un incarico si riconoscono come il committente, da un segno
  // sopra la testa: una spada su chi va eliminato, un sacchetto su chi deve
  // pagare. Prima la stella segnava solo il prossimo debitore, e il bersaglio
  // di una caccia in mezzo alla folla era uno qualunque. I segni sono
  // disegnati da codice (disegna_pezzi.py) e si usano alla loro misura.
  function drawBersagli(m) {
    const segna = (a, segno) => {
      if (a.dead) return;
      Gfx.drawWorldSprite(segno, a.x, a.z, {
        y: 2.7 + Math.sin(time * 2.6 + a.x) * 0.15,
        shadow: false, tint: [1.2, 1.2, 1.2],
      });
    };
    if (m.tipo === 'caccia' && m.target) segna(m.target, 'segno_spada');
    if (m.tipo === 'riscossione')
      for (const n of m.debitori) if (!n.riscosso) segna(n, 'segno_sacchetto');
  }

  function drawDentro() {
    Interni.disegna(time);
    for (const n of inStanza()) drawActor(n);
    for (const e of nemici) if (e.inStanza) drawActor(e);
    // la corona sul committente che sta qui dentro, come per strada
    const cap = capitolo();
    for (const r of Interni.stanza.residenti)
      if (r.committente && cap && cap.giver === r.committente && !campagna.attiva)
        Gfx.drawWorldSprite('segno_corona', r.x, r.z, {
          y: 2.7 + Math.sin(time * 2.6) * 0.15, shadow: false, tint: [1.2, 1.2, 1.2],
        });
    if (campagna.attiva && Missioni.conosce(campagna.attiva.tipo)) Missioni.disegna(campagna.attiva);
    GuidaNave.guida(cap, campagna.attiva, drawMarker);   // la stella sulla nave (missioni_nave.js)
    drawActor(player);
    drawParticles();
    const e = Interni.ambiente(time, dayT);          // sul ponte della nave, l'ora
    e.time = time;
    e.flash = flash;
    Gfx.setEnvironment(e);
    Gfx.setCamera(cam.x, cam.z, cam.dist, cam.shake);
    Gfx.render();                  // niente chunk: la stanza sta fuori dal mondo
  }

  function draw() {
    Gfx.beginFrame();
    if (Interni.dentro) { drawDentro(); return; }
    const px = player.x, pz = player.z;

    for (const v of vehicles) {
      if (Math.abs(v.x - px) < 90 && Math.abs(v.z - pz) < 90) drawVehicle(v);
    }
    Tenda.disegna();
    Fuochi.disegna(dtDisegno, cam.x, cam.z, time);        // fiamme e fumo (fuochi.js)
    for (const g of givers) {
      if (!g.stanza)
        Gfx.drawChar(g.sprite, 'idle', Math.floor(time * 5), g.x, g.z,
                     { flip: !!g.flip });
      const cap = capitolo();
      const suo = cap && chi(cap.giver) === g.name;
      if (suo && !campagna.attiva) {
        Gfx.drawWorldSprite('segno_corona', g.x, g.z, {
          y: 2.7 + Math.sin(time * 2.6 + g.x) * 0.15,
          shadow: false, tint: [1.2, 1.2, 1.2],
        });
      }
    }
    for (const n of npcs) drawActor(n);
    for (const c of carcasse)
      Gfx.drawChar(c.bestia || 'cavallo_mini', 'death', c.frame, c.x, c.z,
                   { flip: c.flip, shadowAlpha: 0.7 });
    for (const b of beasts) drawActor(b);
    for (const e of nemici) drawActor(e);
    for (const g of guards) drawActor(g);
    if (!player.vehicle || player.vehicle.type === 'cavallo') drawActor(player);
    drawParticles();
    if (campagna.attiva) {
      // la stella resta per i luoghi; chi e' un bersaglio ha il suo segno
      const m = campagna.attiva;
      drawBersagli(m);
      if (Missioni.conosce(m.tipo)) Missioni.disegna(m);   // i segni li mette il tipo
      else if (m.tipo !== 'caccia' && m.tipo !== 'riscossione') drawMarker(m.goal);
    }
    for (const q of proiettili)
      Gfx.drawWorldSpriteRot(q.sprite, q.x, q.z, q.ang,
                             { y: 1.05, tint: [1.25, 1.2, 1.1] });

    const e = Meteo.applica(envAt(dayT));
    e.time = time;
    e.lights = activeLights();
    e.flash = flash;
    Gfx.setEnvironment(e);
    Gfx.setCamera(cam.x, cam.z, cam.dist, cam.shake);
    Gfx.updateChunks(px, pz, 2);
    Gfx.render();
  }

  // ------------------------------------------------------------ input

  function bindInput() {
    const map = {
      KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
      KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
      ShiftLeft: 'run', ShiftRight: 'run', KeyT: 'tenda',
    };
    addEventListener('keydown', ev => {
      Sfx.init();
      if (map[ev.code]) { input[map[ev.code]] = 1; ev.preventDefault(); }
      if (ev.code === 'Space') { input.atk = 1; ev.preventDefault(); }
      // E tenuto (input.act) conta per la chiave del nostromo (missioni_nave.js);
      // la ripetizione del tasto tenuto non rifa' l'azione
      if (ev.code === 'KeyE') { input.act = 1; if (!ev.repeat) doAction(); }
      if (/^Digit[1-9]$/.test(ev.code)) {
        const i = Number(ev.code.slice(5)) - 1;
        const k = player.arsenale[i];
        if (k && player.equipaggia(k)) say(ARMI[k].nome, 1.8);
      }
      if (ev.code === 'Tab') { ev.preventDefault(); Hud.togglePlancia(); }
      if (ev.code === 'KeyM') Hud.toggleMap();
      if (ev.code === 'Escape') Hud.closeAll();
      if (ev.code === 'KeyB') bottega();
    });
    addEventListener('keyup', ev => {
      if (map[ev.code]) input[map[ev.code]] = 0;
      if (ev.code === 'KeyE') input.act = 0;
    });

    // touch: joystick a sinistra, tasti a destra
    const joy = document.getElementById('joy');
    const knob = document.getElementById('joyKnob');
    let jid = null, jcx = 0, jcy = 0;
    joy.addEventListener('touchstart', e => {
      Sfx.init();
      const t = e.changedTouches[0];
      jid = t.identifier;
      const r = joy.getBoundingClientRect();
      jcx = r.left + r.width / 2; jcy = r.top + r.height / 2;
      e.preventDefault();
    }, { passive: false });
    const jmove = e => {
      for (const t of e.changedTouches) {
        if (t.identifier !== jid) continue;
        const dx = t.clientX - jcx, dy = t.clientY - jcy;
        const m = Math.min(1, Math.hypot(dx, dy) / 54);
        const a = Math.atan2(dy, dx);
        knob.style.transform =
          `translate(${Math.cos(a) * m * 40}px, ${Math.sin(a) * m * 40}px)`;
        input.right = Math.cos(a) * m > 0.34 ? 1 : 0;
        input.left = Math.cos(a) * m < -0.34 ? 1 : 0;
        input.down = Math.sin(a) * m > 0.34 ? 1 : 0;
        input.up = Math.sin(a) * m < -0.34 ? 1 : 0;
        input.run = m > 0.85 ? 1 : 0;
      }
      e.preventDefault();
    };
    joy.addEventListener('touchmove', jmove, { passive: false });
    const jend = e => {
      for (const t of e.changedTouches) {
        if (t.identifier !== jid) continue;
        jid = null; knob.style.transform = '';
        input.up = input.down = input.left = input.right = input.run = 0;
      }
    };
    joy.addEventListener('touchend', jend);
    joy.addEventListener('touchcancel', jend);
    const btn = (id, fn) => {
      const el = document.getElementById(id);
      el.addEventListener('touchstart', e => { Sfx.init(); fn(); e.preventDefault(); },
                          { passive: false });
      el.addEventListener('click', e => { Sfx.init(); fn(); e.preventDefault(); });
    };
    btn('btnAtk', () => { input.atk = 1; });
    btn('btnE', () => { input.act = 1; doAction(); });     // tenuto, come la tastiera
    for (const fine of ['touchend', 'touchcancel'])
      document.getElementById('btnE').addEventListener(fine, () => { input.act = 0; });
    if ('ontouchstart' in window) {
      for (const id of ['joy', 'btnE', 'btnAtk'])
        document.getElementById(id).style.display = 'block';
    }
  }

  // un committente: il suo capitolo, la bottega se e' Ferrante, o un rifiuto
  function parlaCon(g) {
    const cap = capitolo();
    const suo = cap && chi(cap.giver) === g.name;
    if (campagna.attiva) {
      say(TX('gioco.incarico_aperto'), 3);
    } else if (suo) {
      if (campagna.miss === 0) say(cap.apertura, 8);
      avviaMissione();
    } else if (g.name === GIVER_CAP.fabbro) {
      Hud.apriBottega();
    } else if (campagna.finita) {
      say(TX('gioco.niente_per_te', { nome: g.name }), 4);
    } else {
      say(TX('gioco.non_mia', { nome: g.name, chi: cap ? chi(cap.giver) : TX('gioco.qualcun_altro') }), 5);
    }
  }

  // Un carro in transito si ruba buttando giu' chi lo guida: e' un furto vero,
  // con la regola dei testimoni sul posto del carro (in citta' la ronda di
  // solito vede, nel bosco no). Il carico e' tuo una volta sola.
  function rubaCarro(v) {
    const { carrettiere, bottino } = Traffico.ruba(v);
    v.rider = player; player.sali(v);
    Sfx.mount(); Sfx.hurt();
    alarm(v.x, v.z, 14);
    const visto = crime(5, TX('gioco.reato.carro'), v.x, v.z);
    carrettiere.fleeT = Math.max(carrettiere.fleeT, 6);
    if (bottino) {
      player.money += bottino;
      stats.guadagnati += bottino;
      Sfx.coin();
      say(TX('gioco.carro_rubato', { bottino }) +
          (visto ? TX('gioco.ti_hanno_visto') : TX('gioco.nessuno_visto')), 4);
    }
  }

  function rivaVicina(x, z) {
    for (let r = 1.5; r <= 5; r += 0.5)
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2;
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (Nav.sgombro(world, px, pz, px, pz, 0.45)) return { x: px, z: pz };
      }
    return null;
  }

  function doAction() {
    Sfx.init();
    if (player.dead) return;
    if (Hud.bottegaAperta()) { Hud.chiudiBottega(); return; }

    if (Interni.dentro) {
      if (Missioni.azione(campagna.attiva)) return;       // i passi della nave
      const az = Interni.azioneVicina(player.x, player.z);
      if (az) {
        // la grata del ponte (giu' nella stiva) e la passerella della prova
        if (az.verso) inAltraStanza(Interni.versoLa(az.verso));
        else if (az.azione === 'passerella') esciDallaStanza();
        else nellaTenda(az.azione);
        return;
      }
      const r = interlocutore();
      if (!r) say(TX('gioco.stanza.uscita'), 2);
      // l'incarico in corso puo' volere proprio lui (ascolta: i rematori)
      else if (Missioni.parla(campagna.attiva, r)) return;
      // un committente che sta solo nella stanza (il vecchio al remo della
      // stiva) non ha un posto nel mondo: basta il nome
      else if (r.committente)
        parlaCon(givers.find(q => q.name === chi(r.committente)) || { name: chi(r.committente) });
      else if (r.salute) allaLanternaRossa();
      else if (r.cure) allaPieve();
      else say(Interni.voce(), 7);
      return;
    }

    if (player.vehicle) {
      const v = player.vehicle;
      // dalla barca si scende solo a riva (o su un molo): il punto asciutto
      // piu' vicino entro 5
      let giu = { x: v.x + 1.4, z: v.z + 1.2 };
      if (v.type === 'barca' && Viaggio.alLargo(world, v.x, v.z)) { salpa(); return; }
      if (v.type === 'barca') {
        giu = rivaVicina(v.x, v.z);
        if (!giu) { say(TX('gioco.barca.accosta'), 2); return; }
      }
      v.rider = null; player.scendi(); v.speed *= 0.3;
      player.x = giu.x; player.z = giu.z;
      Sfx.mount();
      say(TX('gioco.sceso'));
      return;
    }

    const g = nearestGiver(3.8);
    if (g) { parlaCon(g); return; }

    const porta = Interni.portaVicina(player.x, player.z);
    if (porta) { entraInStanza(porta); return; }

    const inTransito = Traffico.vicino(player, 3.6);
    if (inTransito) { rubaCarro(inTransito); return; }

    // Un mezzo fermo senza nessuno a cassetta si prende e basta: e' il gioco,
    // non un furto (prima ogni sella era un reato). Il furto vero e' togliere
    // il carro a chi lo guida (traffico.js).
    const v = nearestVehicle(3.4);
    if (v) {
      v.rider = player; player.sali(v);
      Sfx.mount();
      say(v.type === 'cavallo' ? TX('gioco.in_sella') : TX('gioco.a_cassetta'));
      return;
    }
    say(TX('gioco.niente_qui'), 1.6);
  }

  // ------------------------------------------------------------ loop

  let lastT = 0, dtDisegno = 0.016;
  function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (ts - lastT) / 1000 || 0.016);
    lastT = ts;
    dtDisegno = dt;
    if (paused || inViaggio || Passaggi.attiva) return;   // la scena ferma il gioco

    time += dt;
    dayT = (dayT + dt / DAY_LEN) % 1;
    
    flash = Math.max(0, flash - dt * 2.4);
    flash = Math.max(flash, Meteo.aggiorna(dt, dayT, isNight()));
    hintT = Math.max(0, hintT - dt);

    if (Interni.dentro) aggiornaDentro(dt);
    else aggiornaMondo(dt);
    // la colonna sonora: la miscela del posto, dell'ora e del tempo (colonna.js)
    Colonna.aggiorna(dt, {
      stanza: Interni.dentro && Interni.stanza.tipologia, citta: world.pianta.chiave,
      quartiere: world.district[world.idx(Math.floor(player.x / TILE), Math.floor(player.z / TILE))],
      notte: isNight(), meteo: Meteo.tipo, allarme: player.stars > 0 });

    frames++; fpsT += dt;
    if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }

    draw();
    Meteo.disegna(dt, Interni.dentro);
    Particelle.disegna(dt, { dentro: Interni.dentro, notte: isNight(), stile: world.pianta.stile,
                             px: player.x, pz: player.z, t: time });   // particelle.js
    if (!Interni.dentro) Nebbia.aggiorna(player.x, player.z, raggioVista());   // nebbia.js
    Hud.update({ player, campagna, capitolo: capitolo(),
                 hint: hintT > 0 ? hint : '', dayT, fps, allaFucina: allaFucina(),
                 suggerimento: suggerimento(),
                 dentro: Interni.dentro, taverne: taverne(),
                 npcs, guards, beasts, nemici, assalto, colpo, tenda: Tenda.piantata,
                 lavoro: Tenda.barra() || Missioni.barra(campagna.attiva),
                 vehicles, givers, world, time, stats });
  }

  function aggiornaMondo(dt) {
    updatePlayer(dt);
    for (const n of npcs) updateNpc(n, dt);
    for (const b of beasts) updateBeast(b, dt);
    for (const e of nemici) updateNemico(e, dt);
    for (const g of guards) updateGuard(g, dt);
    for (const v of vehicles) if (!v.rider) v.update(dt, world, input);
    Traffico.aggiorna(dt, time);
    fumoDeiCarri(dt);
    updateAssalto(dt);
    updateColpoCampo(dt);
    Tenda.update(dt, input.tenda);
    updateConquista();
    updateCorte(dt);
    updateWanted(dt);
    updateParticles(dt);
    updateProiettili(dt);
    updateCarcasse(dt);
    updateMission(dt);
    updateCamera(dt);
    populate(player.x, player.z);
    aggiornaNemiciDiCampo(player.x, player.z);
  }

  // ------------------------------------------------------------ salvataggio
  // (il JSON e dove tenerlo stanno in salvataggio.js: qui gli accessi)

  // il ladro rimesso in un punto: la gente intorno si rigenera li'
  function posiziona(x, z) {
    player.x = x; player.z = z; player.vx = player.vz = 0;
    npcs.length = 0; guards.length = 0; beasts.length = 0;
    nemici.length = 0; nemiciAttivi.clear(); attivi.clear();
    Traffico.svuota();
    cam.x = x; cam.z = z; seeded = false;
  }

  // a piedi e fuori dalle stanze, prima di rimettere uno stato salvato
  function rimettiInPiedi() {
    if (player.vehicle) { player.vehicle.rider = null; player.scendi(); }
    if (Interni.dentro) {
      for (const n of inStanza()) npcs.splice(npcs.indexOf(n), 1);
      Interni.esci();
    }
    Nave.libera();                      // fuori dalla nave, niente ferri
  }

  function agganciaSalvataggio() {
    Salvataggio.init({
      player, campagna, world, stats,
      get ora() { return dayT; }, set ora(v) { dayT = v; },
      posizione: () => (Interni.dentro ? Interni.uscita() : { x: player.x, z: player.z }),
      rimettiInPiedi, posiziona, obiettivo: aggiornaObiettivo,
      tenda: Tenda.perSalvare, rimettiTenda: Tenda.rimetti,
      issaColori(a) { world.issaColoriDelBorgo(a); Gfx.invalidaIntorno(a.x, a.z, a.r); },
    });
  }

  // dalla schermata titolo: "Continua" o "Importa partita". Un salvataggio
  // d'un'altra citta' o d'un altro atto prima rifa' li' il mondo, con l'atto suo
  async function carica(stato) {
    if (stato.chiave && (stato.chiave !== world.pianta.chiave || Salvataggio.attoDi(stato) !== Storia.stato.atto)) { Storia.rimetti(stato.storia); await cambiaCitta(stato.chiave); }
    Salvataggio.applica(stato);
    Salvataggio.scriviLocale(stato);
    say(TX('gioco.partita_ripresa', { n: campagna.cap + 1, denari: player.money }), 5);
    if (inAttoIII()) await inNave();    // l'atto III si gioca sulla nave
  }

  // la copia sicura e' dell'ultimo salvataggio, non dello stato di adesso:
  // si salva nella tenda e a fine capitolo, non dove capita
  function esportaUltimo() {
    const s = Salvataggio.leggiLocale();
    if (!s) {
      say(TX('gioco.esporta.niente'), 4);
      return null;
    }
    const f = Salvataggio.esporta(s);
    say(TX('gioco.esporta.fatto', { f }), 4);
    return f;
  }

  // ------------------------------------------------------------ viaggio
  // Il cambio di citta' a partita avviata sta in viaggio.js (atlante, mondo,
  // stanze, renderer, carta, cielo). Qui lo stato di game.js legato al mondo:
  // la gente, i carri, gli assalti, il colpo ai campi, la corte, le porte
  // sbarrate, l'incarico in corso (riparte dal committente, come dopo un
  // caricamento). Soldi, arsenale, capitolo e taglia restano.

  let inViaggio = false;               // il ciclo si ferma finche' si parte

  function nuovoMondo(w) {
    world = w;
    Fuochi.init(w);
    const { WALL } = w.pianta;
    WALL_X0 = WALL.x0 * TILE; WALL_X1 = WALL.x1 * TILE;
    WALL_Y0 = WALL.y0 * TILE; WALL_Y1 = WALL.y1 * TILE;
    givers.length = 0;
    for (const g of w.spawns.givers) givers.push(g);
    vehicles.length = 0;
    for (const s of w.spawns.vehicles) vehicles.push(new Vehicle(s));
    particles.length = 0; proiettili.length = 0; carcasse.length = 0;
    Object.assign(assalto, { attivo: false, t: 0, porta: null, quanti: 0 });
    Object.assign(colpo, { acc: null, prog: 0, visto: false });
    Object.assign(corte, { avvisoT: 0, avvisato: false, denunciato: false });
    for (const k in sbarrate) delete sbarrate[k];
    soloTaverne = null;
    Missioni.chiudi(campagna.attiva);
    if (Storia.inProva()) Storia.fineProva('interrotta');
    campagna.attiva = null;
    Traffico.init({ world, player, vehicles, npcs, guards });
    Tenda.init({ world, player, say, occhi: occhiSu });
    Tenda.rimetti({ posseduta: Tenda.posseduta });     // piantata: torna nello zaino
    player.vesti(w.pianta.VESTE_LADRO);                // il beige della Costa
    agganciaSalvataggio();
    posiziona(w.spawns.player.x, w.spawns.player.z);
    aggiornaObiettivo();
  }

  // chiave: 'valdarno', 'fiordo', 'gen-<seme>', 'fiordo-<seme>' (viaggio.js)
  async function cambiaCitta(chiave) {
    if (inViaggio) return false;
    inViaggio = true;
    const velo = document.getElementById('dissolvenza');
    velo.classList.add('chiusa');
    try {
      rimettiInPiedi();
      Traffico.svuota();
      nuovoMondo(await Viaggio.parti(chiave));
      Cartiglio.mostra(world.pianta.nome);
      say(`${world.pianta.nome}.` + (capitolo() && !campagna.finita
        ? TX('gioco.arrivo_capitolo', { n: campagna.cap + 1 }) : ''), 6);
    } finally {
      velo.classList.remove('chiusa');
      inViaggio = false;
    }
    return true;
  }

  // Il viaggio vero (viaggio.js): dalla barca al largo si salpa verso la
  // citta' in cui la storia ti vuole (campagna.js). Dietro la scena di
  // passaggio si carica la seguente, e si arriva sulla barca del Nocchiero
  // ormeggiata al molo
  async function salpa() {
    const meta = Storia.meta(world.pianta.chiave);
    if (!meta) { say(TX('gioco.mare_lungo'), 3); return false; }
    await viaggia(Passaggi.componi('viaggio', { da: world.pianta.nome, a: Storia.verso(world.pianta.chiave) }));
    return true;
  }

  // il viaggio dietro una scena: la citta' dell'atto, l'arrivo sulla barca al
  // molo, e un salvataggio (anche nel posto dell'atto, salvataggio.js). Un
  // atto senza citta' (il mare, finche' non c'e') non fa partire: si resta
  // qui, in piazza (non sull'uscio della sala del jarl, dentro il recinto)
  // aPiedi: il committente davanti a cui si arriva a piedi, senza barca (la
  // Costa, venduto al mercato: campagna.js, arrivo)
  async function viaggia(scena, aPiedi) {
    const meta = Storia.meta(world.pianta.chiave);
    const arrivo = (async () => {
      if (!meta) { posiziona(world.spawns.player.x, world.spawns.player.z); return; }
      await cambiaCitta(meta);
      const g = aPiedi && givers.find(q => q.name === chi(aPiedi));
      const b = Viaggio.approdo(vehicles);
      if (g) { const q = puntoLibero(g.x, g.z + 2.5) || g; posiziona(q.x, q.z); }
      else if (b) { posiziona(b.x, b.z); b.rider = player; player.sali(b); }
    })();
    await Passaggi.mostra(scena, arrivo);
    Salvataggio.salva();
    Salvataggio.salvaAtto();
  }

  // La fine di un atto (campagna.js): il passaggio all'atto seguente (cosa si
  // perde e cosa si ritrova), la scena del finale e il viaggio verso la sua
  // citta'. Nel Fiordo si arriva al molo, sulla barca del Nocchiero
  async function fineAtto(scena) {
    const c = Storia.passa({ player, tenda: Tenda });
    await viaggia(Passaggi.componi(scena), c && c.arrivo && c.arrivo.aPiedi);
    if (inAttoIII()) await inNave();    // "Il prezzo": ti svegli nella stiva
    const a = (c && c.arrivo) || {};
    if (a.messaggio) say(a.messaggio, 6);
    aggiornaObiettivo();
  }

  // L'atto III (nave.js): in catene nella stiva della nave pirata, al remo.
  // Il mondo resta quello di adesso, fermo; l'atlante deve avere i pirati (il
  // Fiordo, dove svernano, o la Costa): da Valdarno si passa dal Fiordo
  // prova: dal menu del titolo o da __game.debug.nave(), la storia salta
  // all'inizio dell'atto III senza perdere niente; senza, e' l'atto III vero
  // (dopo "Il prezzo", o un salvataggio di quest'atto)
  async function inNave(prova) {
    if (!Assets.charDef('PirNostromo')) await cambiaCitta('fiordo-3');
    rimettiInPiedi();
    if (prova) Storia.salta('mare');
    passaggio(() => {
      dentroLa(Nave.imbarco(player.x, player.z));
      Nave.alRisveglio(campagna.cap);       // dal passo 4 senza ferri
      aggiornaObiettivo();
      if (prova) say(Nave.testi.prova, 10);
    });
    return true;
  }
  const inAttoIII = () => ATTI[Storia.stato.atto] === 'mare';

  // ------------------------------------------------------------ avvio

  // ?pianta=...: la citta' (viaggio.js). La sceglie il menu della schermata
  // titolo; la storia e' la stessa, i committenti stanno nei luoghi della pianta
  async function start() {
    canvas = document.getElementById('game');
    const pianta = Viaggio.daIndirizzo();
    await Assets.load(pianta.ATLANTE || 'assets/');   // un atlante per citta' (F3)
    world = new World(pianta.seme || 20260917, pianta);
    Meteo.init(pianta);
    Fuochi.init(world);
    const { WALL } = world.pianta;
    WALL_X0 = WALL.x0 * TILE; WALL_X1 = WALL.x1 * TILE;
    WALL_Y0 = WALL.y0 * TILE; WALL_Y1 = WALL.y1 * TILE;
    await Interni.carica(world);
    player = new Player(world.spawns.player.x, world.spawns.player.z);
    player.vesti(pianta.VESTE_LADRO);                  // il beige della Costa
    for (const g of world.spawns.givers) givers.push(g);
    for (const s of world.spawns.vehicles) vehicles.push(new Vehicle(s));
    Traffico.init({ world, player, vehicles, npcs, guards });
    Gfx.init(canvas, world);
    cam.x = player.x; cam.z = player.z;
    Hud.init(world);
    agganciaSalvataggio();
    Tenda.init({ world, player, say, occhi: occhiSu });
    Missioni.init({
      get player() { return player; }, get world() { return world; },
      get time() { return time; }, get proiettili() { return proiettili; },
      npcs, beasts, nemici, guards, vehicles, assalto, input,
      say, puntoInZona, cast, pick, drawMarker, drawVehicle, inStanza, taglia, crime,
    });
    bindInput();
    const onResize = () => Gfx.resize(innerWidth, innerHeight);
    addEventListener('resize', onResize);
    onResize();
    Hud.setObjective(TX('gioco.inizio.obiettivo', { chi: GIVER_CAP[CAPITOLI[0].giver] }));
    const borgo = pianta === PIANTE.valdarno ? TX('gioco.inizio.borgo') : pianta.nome;
    say(TX('gioco.inizio.comandi', { borgo }), 10);
    requestAnimationFrame(loop);
    window.__game = {
      get world() { return world; }, player, campagna, cambiaCitta,
      get npcs() { return npcs; }, get fps() { return fps; },
      get guards() { return guards; }, get proiettili() { return proiettili; },
      get nemici() { return nemici; }, assalto, cam, colpo,
      get carcasse() { return carcasse; }, disarciona,
      get beasts() { return beasts; },
      get vehicles() { return vehicles; }, Interni,
      // gancio di collaudo: serve a fotografare notte e bosco senza aspettare
      // il ciclo giorno/notte reale
      debug: {
        setDay(t) { dayT = t; },
        tp(x, z) { posiziona(x, z); },
        premi(tasto, giu) { input[tasto] = giu ? 1 : 0; },
        // collaudo: colpisce davvero, passando per la stessa strada del
        // giocatore — misurare la taglia chiamando hurt() a mano non prova
        // niente, perche' hurt() non registra nessun reato
        colpisci(e, arma) { colpisci(e, arma || player.w); },
        // collaudo: avvia l'incarico n del capitolo c senza passare dal committente
        missione(c, n) { campagna.cap = c; campagna.miss = n;
                         campagna.attiva = null; avviaMissione(); },
        // collaudo: un'altra citta' a partita avviata (viaggio.js)
        citta(chiave) { return cambiaCitta(chiave); },
        // collaudo: la missione di prova n (campagna.js), fuori dalla storia
        prova(n) { if (campagna.attiva) fallisciMissione('prova');
                   Storia.iniziaProva(n); avviaMissione(); return !!campagna.attiva; },
        // collaudo: una scena di passaggio (passaggi.js) e il viaggio in barca
        scena(chiave) { return Passaggi.mostra(Passaggi.componi(chiave)); },
        salpa() { return salpa(); },
        nave() { return inNave(true); },          // l'atto III in prova (nave.js)
        svela() { Nebbia.svela(); },              // la carta tutta scoperta (foto)
        // collaudo: chiude l'incarico in corso come se fosse riuscito
        avanza() { avanzaMissione(); },
        // collaudo del meteo: raggio delle guardie, passanti voluti qui, lampo
        vista() { return +raggioVista().toFixed(2); },
        gente() { return vagantiVoluti(player.x, player.z); },
        flash() { return flash; },
        testimone(x, z) { return testimone(x === undefined ? player.x : x,
                                           z === undefined ? player.z : z); },
      },
    };
    if (Nave.daIndirizzo) inNave(true);  // "La nave (prova)" dal menu del titolo
  }

  return { start, compra, carica, esportaUltimo, cambiaCitta,
           get player() { return player; },
           get world() { return world; },
           get campagna() { return campagna; } };
})();
