// audio.js — effetti sintetizzati con WebAudio, senza file audio. La musica e
// gli ambienti registrati stanno in colonna.js (08/10: prima qui c'era una
// melodia dorica a onde quadre).
// Si accende al primo tasto (i browser non suonano prima di un gesto).

const Sfx = (() => {
  // volume: quello della plancia (volume.js), sopra il mezzo volume degli effetti
  let AC = null, master = null, step = 0, volume = 1;
  function init() {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain();
      master.gain.value = 0.5 * volume;
      master.connect(AC.destination);
    } catch (e) { AC = null; }
  }
  function tone(f, dur, type, vol, slide) {
    if (!AC) return;
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, AC.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(
      Math.max(20, slide), AC.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.1, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(AC.currentTime + dur);
  }
  function noise(dur, vol, fc) {
    if (!AC) return;
    const n = AC.createBufferSource();
    const b = AC.createBuffer(1, Math.max(1, AC.sampleRate * dur), AC.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    n.buffer = b;
    const f = AC.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = fc || 900;
    const g = AC.createGain();
    g.gain.setValueAtTime(vol || 0.1, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
    n.connect(f); f.connect(g); g.connect(master);
    n.start(); n.stop(AC.currentTime + dur);
  }
  return {
    init,
    get volume() { return volume; },
    set volume(v) { volume = v; if (master) master.gain.value = 0.5 * v; },
    footstep(run) {
      step++;
      noise(0.055, run ? 0.075 : 0.045, 260 + (step % 2) * 140);
    },
    swing() { noise(0.10, 0.10, 2400); tone(420, 0.07, 'square', 0.04, 180); },
    hit() { noise(0.13, 0.17, 380); tone(150, 0.12, 'square', 0.10, 60); },
    die() { tone(200, 0.4, 'sawtooth', 0.10, 55); noise(0.3, 0.09, 200); },
    coin() { tone(880, 0.07, 'square', 0.07); tone(1320, 0.10, 'square', 0.06); },
    horn() { tone(240, 0.5, 'sawtooth', 0.11, 180); tone(180, 0.6, 'sawtooth', 0.09); },
    mount() { tone(320, 0.12, 'triangle', 0.08, 520); },
    hoof() { noise(0.05, 0.08, 160); },
    wheel() { noise(0.09, 0.035, 520); },
    quest() { [523, 659, 784, 1046].forEach((f, i) =>
      setTimeout(() => tone(f, 0.16, 'triangle', 0.08), i * 90)); },
    hurt() { tone(300, 0.16, 'sawtooth', 0.12, 120); },
    // il tuono dopo il lampo (meteo.js): un brontolio basso che si spegne
    tuono() { noise(2.2, 0.22, 70); noise(0.5, 0.12, 140); tone(48, 1.6, 'sine', 0.08, 30); },
  };
})();
