// colonna.js — la colonna sonora: musiche e ambienti registrati (08/10).
//
// Tua scelta del 08/10 sul provino (out/provino_suoni.html, "BELLISSIMI I
// SUONI"): per ogni luogo una miscela, la musica sotto e gli ambienti sopra,
// coi volumi del provino. I file stanno in assets/audio/ (tools/
// prepara_suoni.py; tutto CC0, crediti in CREDITS.md). Quando cambia il luogo
// la miscela vecchia sfuma nella nuova (DISSOLVI).
//
// La musica va in streaming: un <audio> per brano, collegato a WebAudio per
// il volume. Gli ambienti, loop di 45 s, si decodificano in memoria e si
// ripetono senza stacco (AudioBufferSource col loop): un <audio> in loop
// lascia un buco a ogni giro. Si accende al primo tasto o tocco, come gli
// effetti (audio.js), che restano sintetizzati.
//
// Le miscele "interno" (fucina, tenda: il fuoco, piano) e "silenzio" (pieve,
// cunicolo) non erano nel provino: sono mie, da sentire.

const Colonna = (() => {
  const DISSOLVI = 2.0;          // secondi per portare un volume da 0 a 1
  const MISCELE = {
    piazza: { musica: ['esplorazione', 0.35], ambienti: [['mercato', 0.45], ['alba', 0.25]] },
    campi: { musica: ['raccolto', 0.35], ambienti: [['campagna', 0.5], ['ruscello', 0.2]] },
    notte: { ambienti: [['usignolo', 0.5], ['allocco', 0.35], ['vento_alberi', 0.2]] },
    osteria: { musica: ['osteria', 0.35], ambienti: [['voci', 0.35], ['camino', 0.4]] },
    corte: { musica: ['banchetto', 0.3], ambienti: [['vento_alberi', 0.35]] },
    fiordo: { musica: ['vichinghi', 0.35], ambienti: [['vento_fischio', 0.35], ['gabbiani', 0.2]] },
    costa: { musica: ['deserto', 0.35], ambienti: [['cicale', 0.3], ['mercato', 0.25]] },
    ponte: { musica: ['marinai', 0.3],
             ambienti: [['onde', 0.45], ['remi', 0.35], ['cime', 0.2]] },
    stiva: { ambienti: [['sottocoperta', 0.55], ['remi', 0.45]] },
    inseguimento: { musica: ['battaglia', 0.4], ambienti: [['vento_alberi', 0.2]] },
    temporale: { ambienti: [['pioggia', 0.6]] },
    interno: { ambienti: [['camino', 0.3]] },
    silenzio: {},
  };
  // le stanze (interni.js, tipologia) -> la miscela
  const STANZE = { taverna: 'osteria', casa_piacere: 'osteria', castello: 'corte',
                   ponte: 'ponte', stiva: 'stiva', cabina: 'stiva', fucina: 'interno',
                   tenda: 'interno', chiesa: 'silenzio', cunicolo: 'silenzio' };

  // c: { stanza, citta (la chiave), quartiere (D di world.js), notte, meteo, allarme }
  function scegli(c) {
    if (c.stanza) return STANZE[c.stanza] || 'interno';
    if (c.allarme) return 'inseguimento';
    if (c.meteo === 'pioggia' || c.meteo === 'temporale') return 'temporale';
    if (/^fiordo/.test(c.citta)) return 'fiordo';
    if (/^costa/.test(c.citta)) return 'costa';
    if (c.notte) return 'notte';
    if (c.quartiere === D.NOBILE) return 'corte';
    if (c.quartiere === D.CAMPI || c.quartiere === D.BOSCO || c.quartiere === D.FUORI) return 'campi';
    return 'piazza';
  }

  // volume: quello della plancia (volume.js), su musica e ambienti insieme
  let AC = null, uscita = null, miscela = null, volume = 1;
  const voci = {};               // 'm:nome' (musica) o 'a:nome' (ambiente) -> voce

  function accendi() {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      uscita = AC.createGain();
      uscita.gain.value = volume;
      uscita.connect(AC.destination);
    } catch (e) { AC = null; }
  }
  for (const ev of ['keydown', 'pointerdown', 'touchstart'])
    addEventListener(ev, accendi, { passive: true });

  // la musica si spegne e si riaccende col tasto N (13/10; sul telefono il
  // tasto ♪, tocco.js; nella plancia il bottone di volume.js): gli ambienti
  // restano. La scelta resta nel browser
  let senzaMusica = false;
  try { senzaMusica = localStorage.getItem('ladro1038_musica') === 'no'; } catch (e) { /* niente */ }
  function alternaMusica() {
    senzaMusica = !senzaMusica;
    try { localStorage.setItem('ladro1038_musica', senzaMusica ? 'no' : 'si'); } catch (e) { /* niente */ }
  }
  addEventListener('keydown', ev => {
    if (ev.code === 'KeyN' && !ev.repeat) alternaMusica();
  });

  function voce(k) {
    if (voci[k]) return voci[k];
    const nome = k.slice(2), v = { g: AC.createGain(), vol: 0 };
    v.g.gain.value = 0;
    v.g.connect(uscita);
    if (k[0] === 'm') {
      v.el = new Audio(`assets/audio/musica/${nome}.mp3`);
      v.el.loop = true;
      AC.createMediaElementSource(v.el).connect(v.g);
    } else {
      fetch(`assets/audio/ambiente/${nome}.mp3`).then(r => r.arrayBuffer())
        .then(b => AC.decodeAudioData(b)).then(buf => { v.buffer = buf; })
        .catch(() => {});          // senza il file quell'ambiente tace
    }
    return (voci[k] = v);
  }

  function suona(v) {
    if (v.el) { if (v.el.paused) v.el.play().catch(() => {}); return; }
    if (v.src || !v.buffer) return;
    v.src = AC.createBufferSource();
    v.src.buffer = v.buffer;
    v.src.loop = true;
    v.src.connect(v.g);
    v.src.start(0, Math.random() * v.buffer.duration);   // ogni volta da un altro punto
  }

  function ferma(v) {
    if (v.el) { if (!v.el.paused) v.el.pause(); return; }
    if (v.src) { v.src.stop(); v.src.disconnect(); v.src = null; }
  }

  // ogni fotogramma (game.js): la miscela del posto, i volumi verso i suoi
  function aggiorna(dt, c) {
    miscela = scegli(c);
    if (!AC || AC.state !== 'running') return;
    const M = MISCELE[miscela], voglio = {};
    // di notte all'aperto solo l'ambiente (09/10, tua scelta): come gia' a
    // Valdarno, anche nel Fiordo, alla Costa e sul ponte; la musica resta
    // nelle stanze e nell'inseguimento
    const zitta = c.notte && (!c.stanza || c.stanza === 'ponte') && miscela !== 'inseguimento';
    if (M.musica && !zitta && !senzaMusica) voglio['m:' + M.musica[0]] = M.musica[1];
    for (const [nome, vol] of M.ambienti || []) voglio['a:' + nome] = vol;
    for (const k of Object.keys(voglio)) voce(k);
    const passo = dt / DISSOLVI;
    for (const [k, v] of Object.entries(voci)) {
      v.vol += Math.max(-passo, Math.min(passo, (voglio[k] || 0) - v.vol));
      v.g.gain.value = v.vol;
      if (v.vol > 0.001) suona(v); else ferma(v);
    }
  }

  return { aggiorna, alternaMusica, get miscela() { return miscela; },
           get volume() { return volume; },
           set volume(v) { volume = v; if (uscita) uscita.gain.value = v; },
           // per il collaudo: l'audio acceso, e le voci che suonano ora
           get stato() { return AC ? AC.state : null; },
           get senzaMusica() { return senzaMusica; },
           get suonano() { return Object.keys(voci).filter(k => voci[k].vol > 0.001); } };
})();
