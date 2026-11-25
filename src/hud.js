// hud.js — HUD, minimappa e plancia di bordo.
//
// La plancia riprende il linguaggio visivo di plancia_di_bordo.html (carta
// invecchiata, inchiostro, bordi netti con ombra piena) adattato al medioevo:
// zaino, cartografo, diario, regno.

const Hud = (() => {
  let world, overview, el = {}, planciaOpen = false, mapOpen = false;
  let bottegaOpen = false;
  let firmaBottega = '';      // stato con cui la bottega e' stata disegnata
  let objective = '';

  const COL = {
    0: '#3f5a33', 1: '#6b5335', 2: '#4e3d28', 3: '#c3ab74', 4: '#8d8577',
    5: '#9aa0a3', 6: '#2b5f86', 7: '#1d4463', 8: '#e6ecef', 9: '#6f6f6f',
  };

  function buildOverview() {
    const c = document.createElement('canvas');
    c.width = c.height = WT;
    const g = c.getContext('2d');
    const img = g.createImageData(WT, WT);
    for (let ty = 0; ty < WT; ty++) {
      for (let tx = 0; tx < WT; tx++) {
        const i = world.idx(tx, ty);
        let hex = COL[world.terrain[i]];
        const r = world.road[i];
        if (r === 2) hex = '#b9ae95';
        else if (r === 1) hex = '#8d7a58';
        const d = world.district[i];
        let rr = parseInt(hex.slice(1, 3), 16);
        let gg = parseInt(hex.slice(3, 5), 16);
        let bb = parseInt(hex.slice(5, 7), 16);
        if (d === 4) { rr = rr * 0.9 + 26; bb = bb * 0.9 + 18; }
        if (d === 2) { rr = rr * 0.92 + 8; gg *= 0.88; bb *= 0.82; }
        const o = (ty * WT + tx) * 4;
        img.data[o] = rr; img.data[o + 1] = gg; img.data[o + 2] = bb;
        img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // edifici come macchie scure: danno la trama urbana
    g.fillStyle = 'rgba(38,28,18,.55)';
    for (const p of world.props) {
      if (p.hu < 4.5) continue;
      const s = Math.max(1, p.wu / TILE);
      g.fillRect(p.x / TILE - s / 2, p.z / TILE - s / 2, s, s);
    }
    return c;
  }

  // il segno delle taverne, sulla carta e sulla minimappa: un boccale
  // (schiuma, corpo, manico) di 5x7 punti per k
  function boccale(ctx, a, b, k) {
    ctx.fillStyle = '#d9912e';
    ctx.fillRect(a - 3 * k, b - 1 * k, 5 * k, 5 * k);
    ctx.fillStyle = '#f4ecd8';
    ctx.fillRect(a - 3 * k, b - 3 * k, 5 * k, 2 * k);
    ctx.strokeStyle = '#3a2412'; ctx.lineWidth = 1;
    ctx.strokeRect(a - 3 * k, b - 3 * k, 5 * k, 7 * k);
    ctx.strokeRect(a + 2 * k, b - 1 * k, 2 * k, 3 * k);
  }

  // la tenda del ladro sulla carta e sulla minimappa: una tenda di tela
  // color crema (come lo sprite), k = scala
  function segnoTenda(ctx, a, b, k) {
    ctx.beginPath();
    ctx.moveTo(a, b - 5 * k); ctx.lineTo(a + 5 * k, b + 4 * k); ctx.lineTo(a - 5 * k, b + 4 * k);
    ctx.closePath();
    ctx.fillStyle = '#e8d9a8'; ctx.fill();
    ctx.strokeStyle = '#3a2412'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#3a2412';
    ctx.fillRect(a - 1 * k, b + 0.5 * k, 2 * k, 3.5 * k);
  }

  function drawMini(ctx, size, px, pz, zoom, data) {
    const S = size, half = S / 2;
    const scale = zoom;                      // px minimappa per tile
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(half, half, half - 1, 0, 7);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    const tx = px / TILE, tz = pz / TILE;
    ctx.drawImage(overview, half - tx * scale, half - tz * scale,
                  WT * scale, WT * scale);
    Nebbia.velo(ctx, half - tx * scale, half - tz * scale, scale);   // la carta da scoprire
    const P = (x, z) => [half + (x / TILE - tx) * scale,
                         half + (z / TILE - tz) * scale];
    const { scoperti, visibili: inVista } = Nebbia;
    for (const g of scoperti(data.givers)) {
      const [a, b] = P(g.x, g.z);
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(a - 2, b - 2, 4, 4);
    }
    // solo la taverna piu' vicina, per la direzione: a questa scala tutte e
    // diciotto coprivano il borgo intero (le altre stanno sulla carta)
    let vicina = null, vd = Infinity;
    for (const t of scoperti(data.taverne)) {
      const d = Math.hypot(t.x - px, t.z - pz);
      if (d < vd) { vd = d; vicina = t; }
    }
    if (vicina) boccale(ctx, ...P(vicina.x, vicina.z), 1);
    for (const v of inVista(data.vehicles)) {
      const [a, b] = P(v.x, v.z);
      ctx.fillStyle = '#9ec38f';
      ctx.fillRect(a - 1, b - 1, 2, 2);
    }
    for (const g of inVista(data.guards)) {
      if (g.dead) continue;
      const [a, b] = P(g.x, g.z);
      ctx.fillStyle = data.player.stars ? '#ff5a4a' : '#e8d9b0';
      ctx.fillRect(a - 1.5, b - 1.5, 3, 3);
    }
    for (const e of inVista(data.nemici)) {
      if (e.dead) continue;
      const [a, b] = P(e.x, e.z);
      ctx.fillStyle = '#d8423a';           // l'altro villaggio e' rosso
      ctx.fillRect(a - 2, b - 2, 4, 4);
    }
    for (const k of scoperti(world.accampamenti)) {
      const [a, b] = P(k.x, k.z);
      ctx.strokeStyle = k.preso ? '#2f6fb0' : (k.svaligiato > 0 ? '#8a8a8a' : '#c0392b');
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(a, b, 5, 0, 7); ctx.stroke();
    }
    if (data.tenda) segnoTenda(ctx, ...P(data.tenda.x, data.tenda.z), 1.3);
    // l'obiettivo, anche nella nebbia e sul bordo se e' lontano (obiettivo.js)
    Obiettivo.mini(ctx, P, half, data.campagna.attiva && data.campagna.attiva.goal, data.time);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(half, half, 3, 0, 7); ctx.fill();
    ctx.strokeStyle = '#1b1a16'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#6b5228'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(half, half, half - 1.5, 0, 7); ctx.stroke();
  }

  function drawCarta(ctx, W, H, data) {
    ctx.fillStyle = '#2b2848';
    ctx.fillRect(0, 0, W, H);
    const s = Math.min(W, H) / WT;
    const ox = (W - WT * s) / 2, oy = (H - WT * s) / 2;
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 0.92;
    ctx.drawImage(overview, ox, oy, WT * s, WT * s);
    ctx.globalAlpha = 1;
    Nebbia.velo(ctx, ox, oy, s);       // la carta da scoprire: i luoghi solo se visti
    const { scoperti, scoperto } = Nebbia;
    const P = (x, z) => [ox + x / TILE * s, oy + z / TILE * s];
    const label = (x, z, t) => {
      const [a, b] = P(x, z);
      ctx.fillStyle = 'rgba(244,239,225,.85)';
      const w = ctx.measureText(t).width + 8;
      ctx.fillRect(a - w / 2, b - 16, w, 14);
      ctx.strokeStyle = '#4a463c'; ctx.lineWidth = 1;
      ctx.strokeRect(a - w / 2, b - 16, w, 14);
      ctx.fillStyle = '#332e26';
      ctx.textAlign = 'center';
      ctx.fillText(t, a, b - 5);
    };
    ctx.font = '8px "Press Start 2P", monospace';
    // i luoghi dalla pianta (piante.js), in tile
    const { PLAZA, CASTLE, PORT, CAMP, LUOGHI: L } = world.pianta;
    const tl = (x, y, t) => scoperto(x * TILE, y * TILE) && label(x * TILE, y * TILE, t);
    tl(PLAZA.x, PLAZA.y, TX('hud.carta.piazza'));
    tl(CASTLE.x, CASTLE.y, TX('hud.carta.castello'));
    tl(L.etichette.bassifondi.x, L.etichette.bassifondi.y, TX('hud.carta.bassifondi'));
    tl(L.fucina.x, L.fucina.y + 2, TX('hud.carta.fucina'));
    tl(L.pieve.x, L.pieve.y - 4, TX('hud.carta.pieve'));
    tl(PORT.x, PORT.y, TX('hud.carta.porto'));
    // alzata di 5 tile: all'altezza della casa copriva la piazza
    if (world.casaDiPiacere && scoperti([world.casaDiPiacere]).length)
      label(world.casaDiPiacere.x, world.casaDiPiacere.z - 5 * TILE,
            TX('hud.carta.lanterna'));
    tl(CAMP.x, CAMP.y, TX('hud.carta.bosco'));
    for (const k of scoperti(world.accampamenti)) {
      const [a, b] = P(k.x, k.z);
      ctx.fillStyle = k.preso ? '#2f6fb0' : (k.svaligiato > 0 ? '#8a8a8a' : '#c0392b');
      ctx.beginPath();
      ctx.moveTo(a, b - 7); ctx.lineTo(a + 6, b + 5); ctx.lineTo(a - 6, b + 5);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#332e26'; ctx.lineWidth = 1; ctx.stroke();
      label(k.x, k.z + 22, k.nome.toUpperCase() +
            (k.svaligiato > 0 ? TX('hud.carta.svuotato') : ''));
    }
    tl(L.etichette.campi.x, L.etichette.campi.y, TX('hud.carta.campi'));
    for (const t of scoperti(data.taverne)) {
      const [a, b] = P(t.x, t.z);
      boccale(ctx, a, b, 1.3);
    }
    // legenda, in basso a sinistra della carta
    const [la, lb] = [ox + 18, oy + WT * s - 18];
    boccale(ctx, la, lb, 1.6);
    ctx.fillStyle = '#f4e9d0'; ctx.textAlign = 'left';
    ctx.fillText(TX('hud.carta.taverna'), la + 10, lb + 4);
    if (data.tenda) {
      const [ta, tb] = P(data.tenda.x, data.tenda.z);
      segnoTenda(ctx, ta, tb, 1.8);
      label(data.tenda.x, data.tenda.z + 14, TX('hud.carta.tenda'));
      ctx.textAlign = 'left';
    }
    for (const g of scoperti(data.givers)) {
      const [a, b] = P(g.x, g.z);
      ctx.fillStyle = '#c8901c';
      ctx.beginPath(); ctx.arc(a, b, 4, 0, 7); ctx.fill();
      ctx.strokeStyle = '#332e26'; ctx.lineWidth = 1; ctx.stroke();
    }
    Obiettivo.carta(ctx, P, data.campagna.attiva && data.campagna.attiva.goal);  // obiettivo.js
    const [a, b] = P(data.player.x, data.player.z);
    ctx.fillStyle = '#2f6b4f';
    ctx.beginPath(); ctx.arc(a, b, 5, 0, 7); ctx.fill();
    ctx.strokeStyle = '#efe7d2'; ctx.lineWidth = 2; ctx.stroke();
  }

  // ------------------------------------------------------------ plancia

  function renderPlancia(tab, data) {
    const p = data.player;
    const box = el.planciaBody;
    if (tab === 'zaino') {
      const items = [
        [TX('hud.zaino.denari'), p.money], [TX('hud.zaino.salute'), `${Math.round(p.hp)} / ${p.maxHp}`],
        [TX('hud.zaino.fiato'), `${Math.round(p.stamina * 100)}%`],
        [TX('hud.zaino.taglia'), p.stars ? '★'.repeat(p.stars) : TX('hud.zaino.nessuna')],
        [TX('hud.zaino.caduti'), p.kills],
        [TX('hud.zaino.incarichi'), data.stats.missioni],
        [TX('hud.zaino.guadagnato'), data.stats.guadagnati],
        [TX('hud.zaino.speso'), data.stats.spesi],
        [TX('hud.zaino.mezzo'), p.vehicle ? mezzo(p.vehicle.name) : TX('hud.zaino.a_piedi')],
        [TX('hud.zaino.arma'), ARMI[p.arma].nome],
        Tenda.piantata ? [TX('hud.zaino.tenda_piantata'), TX('hud.zaino.piantata')]
          : (Tenda.posseduta ? [TX('hud.zaino.tenda_zaino'), TX('hud.zaino.nello_zaino')] : [TX('hud.zaino.tenda'), TX('hud.zaino.non_ancora')]),
      ];
      box.innerHTML = `<h3 class="sec">${TX('hud.zaino.titolo')}</h3><div class="grid bag">` +
        items.map(([k, v]) =>
          `<div class="card item"><b>${v}</b><span>${k}</span></div>`).join('') +
        '</div>' +
        `<h3 class="sec" style="margin-top:18px">${TX('hud.zaino.armi')}</h3>` +
        '<div class="grid bag">' +
        p.arsenale.map((k, i) => {
          const a = ARMI[k];
          return `<div class="card item" style="outline:${k === p.arma ?
            '3px solid #e2622f' : 'none'};outline-offset:-2px">` +
            `<b>${i + 1}</b><span>${a.nome}</span></div>`;
        }).join('') + '</div>' +
        '<p style="font-size:8px;line-height:1.9;color:var(--soft);margin-top:10px">' +
        TX('hud.zaino.nota_armi') + '</p>';
    } else if (tab === 'diario') {
      const m = data.campagna.attiva;
      const cap = data.capitolo;
      let h = `<h3 class="sec">${TX('hud.diario.titolo')}</h3>`;
      if (cap) {
        h += `<div class="card pad"><b>${TX('hud.diario.capitolo', { n: cap.id, titolo: cap.titolo })}</b>`;
        h += '<ol style="margin:8px 0 0 18px;padding:0;font-size:9px;line-height:2">';
        cap.missioni.forEach((x, i) => {
          const fatta = i < data.campagna.miss;
          const ora = i === data.campagna.miss && m;
          h += `<li style="opacity:${fatta ? 0.45 : 1}">` +
               (fatta ? '<s>' : (ora ? '<b>' : '')) + x.testo +
               (fatta ? '</s>' : (ora ? '</b>' : '')) + '</li>';
        });
        h += '</ol>';
        if (m && m.tipo === 'colpo')
          h += `<p><b>${TX('hud.diario.sul_posto')}</b> ${m.prog.toFixed(1)} / ${m.durata} s</p>`;
        if (m && m.tipo === 'fuga')
          h += `<p><b>${TX('hud.diario.tempo')}</b> ${Math.max(0, m.timer).toFixed(0)} s</p>`;
        if (m && m.tipo === 'riscossione')
          h += `<p><b>${TX('hud.diario.riscossi')}</b> ${m.fatti} / ${m.quanti}</p>`;
        if (m) h += Missioni.plancia(m);              // i tipi nuovi (missioni.js)
        if (!m) h += `<p><i>${TX('hud.diario.vai', { da_chi: Lingua.daChi(Storia.committente(cap.giver)) })}</i></p>`;
        h += `<p style="color:var(--soft)">${TX('hud.diario.ricompensa', { premio: cap.premio })}` +
             (cap.arma ? TX('hud.diario.ricompensa_arma', { arma: ARMI[cap.arma].nome }) : '') + '.</p></div>';
      } else if (Storia.stato.atto === 0) {
        h += `<div class="card pad"><b>${TX('hud.diario.finita')}</b><p>` +
             TX('hud.diario.finita_testo') + '</p></div>';
      } else {
        h += `<div class="card pad"><b>${Storia.titolo}</b><p>${Storia.campagna().fine}</p></div>`;
      }
      // i committenti dell'atto in corso (campagna.js), non piu' quelli di Valdarno
      const chi = Object.values(Storia.campagna().committenti);
      if (Storia.stato.atto === 0)
        h += `<div class="card pad" style="margin-top:12px">
               <b>${TX('hud.diario.committenti')}</b>
               <p>${TX('hud.diario.committenti_valdarno')} ${TX('hud.diario.solo_quello')}</p>
             </div>`;
      else if (chi.length)
        h += `<div class="card pad" style="margin-top:12px"><b>${TX('hud.diario.committenti')}</b>
               <p>${chi.join(' · ')}. ${TX('hud.diario.solo_quello')}</p></div>`;
      box.innerHTML = h;
    } else if (tab === 'regno') {
      const h24 = (data.dayT * 24 + 6) % 24;
      const ore = Math.floor(h24);
      const min = Math.floor((h24 - ore) * 60);
      box.innerHTML = `<h3 class="sec">${TX('hud.regno.titolo')}</h3>
        <div class="twocol">
          <div class="card pad">
            <p><b>${TX('hud.regno.ora')}</b> ${String(ore).padStart(2, '0')}:${String(min).padStart(2, '0')}</p>
            <p><b>${TX('hud.regno.fase')}</b> ${data.dayT < 0.16 || data.dayT > 0.74 ? TX('hud.regno.notte') :
              (data.dayT < 0.25 ? TX('hud.regno.alba') : (data.dayT > 0.62 ? TX('hud.regno.tramonto') : TX('hud.regno.giorno')))}</p>
            <p><b>${TX('hud.regno.anime')}</b> ${data.npcs.filter(n => !n.dead).length}</p>
            <p><b>${TX('hud.regno.guardie')}</b> ${data.guards.filter(g => !g.dead).length}</p>
            <p><b>${TX('hud.regno.nemici')}</b> ${data.nemici.filter(e => !e.dead).length}</p>
            <p><b>${TX('hud.regno.assalto')}</b> ${data.assalto.attivo ? TX('hud.regno.in_corso') :
              TX('hud.regno.nessuno_fra', { s: Math.max(0, data.assalto.prossimo | 0) })}</p>
            <p><b>${TX('hud.regno.mezzi')}</b> ${data.vehicles.length}</p>
            <p><b>${TX('hud.regno.fotogrammi')}</b> ${data.fps}/s</p>
          </div>
          <div class="card pad">
            <b>${TX('hud.regno.comandi')}</b>
            <p>${TX('hud.regno.c_cammina')}<br>
               ${TX('hud.regno.c_corri')}<br>
               ${TX('hud.regno.c_colpisci')}<br>
               ${TX('hud.regno.c_sella')}<br>
               ${TX('hud.regno.c_carta')}<br>
               ${TX('hud.regno.c_plancia')}</p>
          </div>
        </div>`;
    }
  }

  // un'altra citta' (viaggio.js): la carta si ridisegna, il resto resta
  function mondo(w) {
    world = w;
    overview = buildOverview();
    Nebbia.mondo(w);
  }

  const mezzo = n => (Lingua.TESTI.it['mezzi.' + n] === undefined ? n.replace(/_/g, ' ') : TX('mezzi.' + n));   // il nome a vista
  function init(w) {
    mondo(w);
    el.hp = document.getElementById('hpFill');
    el.sta = document.getElementById('staFill');
    el.money = document.getElementById('money');
    el.stars = document.getElementById('stars');
    el.obj = document.getElementById('objective');
    el.msg = document.getElementById('msg');
    el.mini = document.getElementById('minimap').getContext('2d');
    el.prompt = document.getElementById('prompt');
    el.clock = document.getElementById('clock');
    el.conq = document.getElementById('conquista');
    el.conqFill = document.getElementById('conqFill');
    el.conqLabel = document.getElementById('conqLabel');
    el.conqNota = document.getElementById('conqNota');
    el.plancia = document.getElementById('plancia');
    el.planciaBody = document.getElementById('planciaBody');
    el.mapWrap = document.getElementById('mapWrap');
    el.mapCanvas = document.getElementById('mapCanvas');
    el.bottega = document.getElementById('bottega');
    el.bottegaBody = document.getElementById('bottegaBody');
    document.getElementById('bottegaClose')
      .addEventListener('click', () => { bottegaOpen = false;
                                         el.bottega.style.display = 'none'; });

    let tab = 'zaino';
    for (const b of document.querySelectorAll('#planciaTabs .tab')) {
      b.addEventListener('click', () => {
        tab = b.dataset.tab;
        for (const o of document.querySelectorAll('#planciaTabs .tab'))
          o.classList.toggle('on', o === b);
        el.currentTab = tab;
      });
    }
    el.currentTab = tab;
    document.getElementById('planciaClose')
      .addEventListener('click', () => { planciaOpen = false; el.plancia.style.display = 'none'; });
    el.mapWrap.addEventListener('click', () => {
      mapOpen = false; el.mapWrap.style.display = 'none';
    });
  }

  // ---- bottega ----------------------------------------------------------
  function renderBottega(p) {
    const riga = (k) => {
      const a = ARMI[k];
      const posseduta = p.arsenale.includes(k);
      const equipaggiata = p.arma === k;
      const puo = p.money >= a.prezzo;
      const bottone = equipaggiata
        ? `<button class="tab on" disabled>${TX('hud.bottega.in_pugno')}</button>`
        : posseduta
          ? `<button class="tab" data-arma="${k}">${TX('hud.bottega.impugna')}</button>`
          : `<button class="tab" data-arma="${k}" ${puo ? '' : 'disabled'}` +
            ` style="opacity:${puo ? 1 : 0.45}">${TX('hud.bottega.prezzo', { n: a.prezzo })}</button>`;
      const st = a.distanza
        ? TX('hud.bottega.st_distanza', { min: a.danno[0], max: a.danno[1], gittata: Math.round(a.portata), cadenza: a.cadenza.toFixed(2) })
        : TX('hud.bottega.st_vicino', { min: a.danno[0], max: a.danno[1], portata: a.portata.toFixed(1), cadenza: a.cadenza.toFixed(2) }) +
          (a.difesa ? TX('hud.bottega.st_difesa', { p: Math.round(a.difesa * 100) }) : '') +
          (a.furtivo ? TX('hud.bottega.st_furtivo', { p: Math.round(a.furtivo * 100) }) : '');
      return `<div class="card arma ${equipaggiata ? 'ok' : ''}">
                <div class="txt"><b>${a.nome}</b><small>${a.desc}</small>
                <div class="st">${st}</div></div>${bottone}</div>`;
    };
    el.bottegaBody.innerHTML =
      `<p style="font-size:10px;line-height:2;margin:0 0 14px">
         ${TX('hud.bottega.frase')}<br>
         <span style="color:var(--soft)">${TX('hud.bottega.hai', { n: p.money })}</span></p>` +
      IN_VENDITA.map(riga).join('') +
      '<p style="font-size:8px;line-height:1.9;color:var(--soft);margin-top:12px">' +
      TX('hud.bottega.nota') + '</p>';
    for (const b of el.bottegaBody.querySelectorAll('button[data-arma]')) {
      b.addEventListener('click', () => {
        Game.compra(b.dataset.arma);
        renderBottega(p);
      });
    }
  }

  function update(data) {
    const p = data.player;
    el.hp.style.width = Math.max(0, p.hp / p.maxHp * 100) + '%';
    el.sta.style.width = (p.stamina * 100) + '%';
    el.money.textContent = p.money;
    el.stars.innerHTML = [0, 1, 2, 3, 4].map(i =>
      `<span class="${i < p.stars ? 'on' : ''}">★</span>`).join('');
    el.obj.textContent = objective;
    el.msg.textContent = data.hint;
    el.msg.style.opacity = data.hint ? 1 : 0;
    const h24 = (data.dayT * 24 + 6) % 24;
    const ore = Math.floor(h24);
    const min = Math.floor((h24 - ore) * 60 / 15) * 15;
    el.clock.textContent =
      `${String(ore).padStart(2, '0')}:${String(min).padStart(2, '0')}` +
      (Meteo.tipo !== 'sereno' ? ` · ${Meteo.nome}` : '');

    // suggerimento contestuale
    let pr = '';
    for (const g of data.givers)
      if (!g.stanza && Math.hypot(g.x - p.x, g.z - p.z) < 3.6)
        pr = TX('gioco.tasto.parla', { nome: g.name });
    // la bottega delle armi e' un posto: la fucina, e lo si dice
    if (data.allaFucina && !p.vehicle)
      pr = (pr ? pr + ' · ' : '') + TX('hud.tasto.bottega');
    if (!pr && !p.vehicle)
      for (const v of data.vehicles)
        if (!v.rider && !v.rotto && Math.hypot(v.x - p.x, v.z - p.z) < 3.4) {
          pr = TX('hud.tasto.prendi', { cosa: v.type === 'barca' ? TX('hud.tasto.la_barca') : mezzo(v.name) });
          break;
        }
    if (p.vehicle) pr = TX('hud.tasto.scendi');
    if (data.suggerimento) pr = data.suggerimento;   // al largo: salpa (viaggio.js)
    el.prompt.textContent = pr;
    el.prompt.style.display = pr ? 'block' : 'none';

    // barra di conquista: la cassa di un campo, o la tenda (tenda.js)
    const cq = data.lavoro || data.colpo;
    if (cq.acc || cq.etichetta) {
      el.conq.style.display = 'block';
      el.conqLabel.textContent = cq.etichetta || TX('hud.cassa', { campo: cq.acc.nome });
      el.conqFill.style.width = (cq.prog / cq.richiesto * 100) + '%';
      el.conqNota.textContent = cq.visto
        ? TX('hud.guardato')
        : `${cq.verbo || TX('hud.stai_forzando')} — ${(cq.richiesto - cq.prog).toFixed(1)} s`;
    } else {
      el.conq.style.display = 'none';
    }

    // dentro una casa la minimappa non ha niente da mostrare
    el.mini.canvas.style.visibility = data.dentro ? 'hidden' : '';
    if (!data.dentro) drawMini(el.mini, 150, p.x, p.z, 0.62, data);
    // solo se cambia qualcosa: rifatta a ogni fotogramma, i bottoni venivano
    // sostituiti fra la pressione e il rilascio e il clic non arrivava mai
    const firma = `${p.money}|${p.arma}|${p.arsenale.join()}`;
    if (bottegaOpen && firma !== firmaBottega) {
      firmaBottega = firma;
      renderBottega(p);
    }
    if (planciaOpen) renderPlancia(el.currentTab, data);
    if (mapOpen) {
      const c = el.mapCanvas;
      const w = Math.min(innerWidth * 0.86, 860), h = Math.min(innerHeight * 0.86, 860);
      if (c.width !== Math.floor(w) || c.height !== Math.floor(h)) {
        c.width = Math.floor(w); c.height = Math.floor(h);
      }
      drawCarta(c.getContext('2d'), c.width, c.height, data);
    }
  }

  return {
    init, mondo, update,
    setObjective(t) { objective = t; },
    apriBottega() {
      firmaBottega = ''; bottegaOpen = true;
      el.bottega.style.display = 'flex';      // il titolo: la stanza del fabbro della citta' (14/10)
      document.getElementById('bottegaTitolo').textContent = Interni.dentro ? Interni.stanza.nome : TX('hud.bottega.titolo');
      planciaOpen = mapOpen = false;
      el.plancia.style.display = 'none';
      el.mapWrap.style.display = 'none';
    },
    chiudiBottega() { bottegaOpen = false; el.bottega.style.display = 'none'; },
    bottegaAperta() { return bottegaOpen; },
    togglePlancia() {
      planciaOpen = !planciaOpen;
      el.plancia.style.display = planciaOpen ? 'flex' : 'none';
      if (planciaOpen) mapOpen = false, el.mapWrap.style.display = 'none';
    },
    toggleMap() {
      mapOpen = !mapOpen;
      el.mapWrap.style.display = mapOpen ? 'flex' : 'none';
      if (mapOpen) planciaOpen = false, el.plancia.style.display = 'none';
    },
    closeAll() {
      planciaOpen = mapOpen = bottegaOpen = false;
      el.plancia.style.display = 'none';
      el.mapWrap.style.display = 'none';
      el.bottega.style.display = 'none';
    },
  };
})();
