// meteo.js — il tempo che fa: sereno, pioggia, nebbia, temporale, neve.
//
// Deciso il 25/09 (voce M di PLAN.md): il meteo tocca anche il gioco. Con la
// pioggia c'e' meno gente per strada, le guardie vedono meno e carri e
// cavalli vanno piu' piano; la nebbia accorcia la vista (il bosco diventa il
// posto per sparire); il temporale e' pioggia forte, coi lampi.
// Sta nel salvataggio.
//
// Quando cambia (25/09 notte, "il meteo non l'hai fatto? non succede mai
// niente"): prima partiva sereno e cambiava solo all'alba ogni uno o due
// giorni, cioe' ogni 4-9 minuti, e in una partita breve non si vedeva mai.
// Ora la partita parte col suo tempo, ogni tempo dura 1-3 minuti e cambia a
// qualunque ora, e lo stesso tempo torna di rado due volte di fila; pioggia
// e neve vanno a raffiche e col vento, e i lampi ci sono anche di giorno.
//
// Il meteo e' per citta': le probabilita' stanno nella pianta (METEO in
// piante.js), cosi' il Fiordo avra' la neve e la Costa saracena i temporali
// rari. Una pianta senza METEO usa quelle di Valdarno.
//
// Lo stato vive qui. game.js chiama aggiorna() a ogni fotogramma, legge i
// fattori (gente, vista, fango) dove servono e fa passare l'ambiente del
// giorno da applica(). Le gocce sono un canvas 2D sopra il gioco: costano
// poco e non toccano il renderer.

const Meteo = (() => {
  // gli effetti di ogni tempo a pieno regime. gente: quanti passanti restano
  // per strada; vista: il raggio delle guardie; fango: la velocita' di carri
  // e cavalli; pioggia, nebbia, neve: quanto se ne vede
  const TIPI = {
    sereno:    { gente: 1,    vista: 1,    fango: 1,    pioggia: 0,   nebbia: 0,    neve: 0 },
    // (06/10, tua scelta: "c'e' sempre troppa nebbia") pioggia e temporale non
    // portano piu' nebbia, solo il loro grigio; la nebbia e' piu' leggera
    // (NEBBIA_PIENA) e le guardie ci vedono un po' di piu' (era 0,55)
    pioggia:   { gente: 0.5,  vista: 0.75, fango: 0.75, pioggia: 0.6, nebbia: 0,    neve: 0 },
    temporale: { gente: 0.3,  vista: 0.65, fango: 0.7,  pioggia: 1,   nebbia: 0,    neve: 0 },
    nebbia:    { gente: 0.8,  vista: 0.7,  fango: 1,    pioggia: 0,   nebbia: 1,    neve: 0 },
    neve:      { gente: 0.6,  vista: 0.8,  fango: 0.8,  pioggia: 0,   nebbia: 0.3,  neve: 1 },
  };
  const NOMI = { sereno: TX('meteo.sereno'), pioggia: TX('meteo.pioggia'), temporale: TX('meteo.temporale'),
                 nebbia: TX('meteo.nebbia'), neve: TX('meteo.neve') };
  const VALDARNO = { sereno: 0.63, pioggia: 0.22, nebbia: 0.05, temporale: 0.1 };
  const DURATA = [60, 180];   // secondi di un tempo, prima di cambiare
  const DURATA_NEBBIA = [40, 90];         // la nebbia passa prima (06/10)
  // la foschia piena (06/10, era da 16 a 88): sullo schermo, a piedi, dal 4%
  // in basso al 19% in alto (era dal 35% al 60%)
  const NEBBIA_PIENA = { near: 40, far: 160 };
  const TRANSIZIONE = 12;     // secondi per passare da un tempo all'altro

  let pesi = VALDARNO;
  let tipo = 'sereno', prima = 'sereno', k = 1;     // k: quanto c'e' del tempo nuovo
  let resta = 90;             // secondi al prossimo cambio
  let t = 0;                  // l'orologio delle raffiche e del vento
  let lampoT = 4;             // secondi al prossimo lampo
  let fisso = false;          // il collaudo lo blocca: niente cambi
  let cambi = 0;              // quante volte e' cambiato da solo (collaudo)
  let tela = null, g2 = null;
  const gocce = [];

  function init(pianta) {
    pesi = (pianta && pianta.METEO) || VALDARNO;
    // si parte col tempo della citta', non sempre col sereno (il collaudo,
    // fisso, resta sereno)
    tipo = prima = fisso ? 'sereno' : estrai(); k = 1;
    resta = durata(tipo);
    if (!tela) {
      tela = document.createElement('canvas');
      tela.id = 'meteo';
      tela.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;' +
                           'pointer-events:none;z-index:4';
      const game = document.getElementById('game');
      game.parentNode.insertBefore(tela, game.nextSibling);
      g2 = tela.getContext('2d');
    }
  }

  function fattore(nome) {
    const a = TIPI[prima][nome], b = TIPI[tipo][nome];
    return a + (b - a) * k;
  }

  function estrai() {
    let r = Math.random() * Object.values(pesi).reduce((s, v) => s + v, 0);
    let nuovo = 'sereno';
    for (const [n, p] of Object.entries(pesi)) {
      if (!TIPI[n]) continue;
      nuovo = n;
      if ((r -= p) < 0) break;
    }
    return nuovo;
  }

  function durata(t) {
    const [a, b] = t === 'nebbia' ? DURATA_NEBBIA : DURATA;
    return a + Math.random() * (b - a);
  }

  function scegli() {
    let nuovo = estrai();
    if (nuovo === tipo) nuovo = estrai();           // lo stesso tempo, meno spesso
    imposta(nuovo, false);
    resta = durata(nuovo);
  }

  // subito = senza transizione (collaudo, caricamento di una partita)
  function imposta(t, subito = true) {
    if (!TIPI[t]) return;
    prima = subito ? t : (k < 0.5 ? prima : tipo);
    tipo = t;
    k = subito ? 1 : 0;
  }

  // Ritorna il lampo da sommare al flash di game.js (0 se niente)
  function aggiorna(dt, dayT, notte) {
    k = Math.min(1, k + dt / TRANSIZIONE);
    t += dt;
    if (!fisso && (resta -= dt) <= 0) { scegli(); cambi++; }
    if (tipo !== 'temporale' || k < 0.8) return 0;
    lampoT -= dt;
    if (lampoT > 0) return 0;
    lampoT = 5 + Math.random() * 9;
    setTimeout(() => Sfx.tuono && Sfx.tuono(), 400 + Math.random() * 1400);
    return notte ? 0.75 : 0.4;                      // di giorno il lampo si vede meno
  }

  // le raffiche: quanta pioggia o neve c'e' adesso, fra 0,55 e 1,25 del suo
  // pieno, e il vento che la piega (px al secondo, verso sinistra se < 0)
  function raffica() { return 0.9 + 0.35 * Math.sin(t * 0.21) * Math.sin(t * 0.077 + 1.3); }
  function vento() { return -120 + 160 * Math.sin(t * 0.05 + 0.7); }

  // L'ambiente del giorno (ambiente.js) sotto questo cielo
  function applica(e) {
    const p = fattore('pioggia'), n = fattore('nebbia'), s = fattore('neve');
    const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    e.ambient = e.ambient.map(v => v * (1 - 0.24 * p + 0.04 * s));
    const l = (e.fog[0] + e.fog[1] + e.fog[2]) / 3 * 1.1;
    e.fog = mix(e.fog, [l, l * 1.02, l * 1.07], Math.max(n, p * 0.6));
    e.fogNear = e.fogNear + (NEBBIA_PIENA.near - e.fogNear) * n;
    e.fogFar = e.fogFar + (NEBBIA_PIENA.far - e.fogFar) * n;
    e.grade = mix(e.grade, [0.93, 0.97, 1.06], Math.max(p, n) * 0.6);
    e.shadowStrength *= 1 - 0.75 * Math.max(p, n);
    e.vignette += 0.16 * Math.max(p, n);       // il cielo chiuso stringe la vista
    e.bagnato = p;
    return e;
  }

  // Le gocce (o i fiocchi) sullo schermo. dentro: in una stanza non piove
  function disegna(dt, dentro) {
    if (!tela) return;
    const W = tela.clientWidth, H = tela.clientHeight;
    if (tela.width !== W || tela.height !== H) { tela.width = W; tela.height = H; }
    const p = dentro ? 0 : fattore('pioggia'), s = dentro ? 0 : fattore('neve');
    const voluti = Math.round((420 * p + 260 * s) * raffica()), v = vento();
    g2.clearRect(0, 0, W, H);
    if (!voluti) { gocce.length = 0; return; }
    while (gocce.length < voluti)
      gocce.push({ x: Math.random() * W, y: Math.random() * H, v: 0.7 + Math.random() * 0.6,
                   neve: Math.random() * (p + s) < s });
    gocce.length = voluti;
    g2.lineWidth = 1;
    g2.strokeStyle = 'rgba(190,205,225,0.55)';
    g2.beginPath();
    for (const q of gocce) {
      if (q.neve) {
        q.y += 60 * q.v * dt; q.x += (Math.sin(q.y * 0.03 + q.v * 9) * 18 + v * 0.4) * dt;
      } else {
        q.y += 900 * q.v * dt; q.x += (v - 60) * q.v * dt;
      }
      if (q.y > H) { q.y -= H + 20; q.x = Math.random() * (W + 200) - 100; }
      if (q.x < -20) q.x += W + 40;
      if (q.x > W + 20) q.x -= W + 40;
      const pende = (v - 60) / 900 * 22;             // la goccia pende col vento
      if (!q.neve) { g2.moveTo(q.x, q.y); g2.lineTo(q.x - pende * q.v, q.y - 22 * q.v); }
    }
    g2.stroke();
    g2.fillStyle = 'rgba(240,244,250,0.85)';
    for (const q of gocce) if (q.neve) g2.fillRect(q.x | 0, q.y | 0, 2, 2);
  }

  // per il salvataggio
  function stato() { return { tipo, resta: Math.round(resta) }; }
  function rimetti(m) {
    if (!m || !TIPI[m.tipo]) return;
    imposta(m.tipo, true);
    resta = m.resta > 0 ? m.resta : DURATA[0];      // i salvataggi di prima avevano "giorni"
  }

  return { init, aggiorna, applica, disegna, fattore, imposta, stato, rimetti, vento,
           fissa(b) { fisso = !!b; }, lampo() { lampoT = 0; },
           get tipo() { return tipo; }, get nome() { return NOMI[tipo]; },
           get cambi() { return cambi; }, set resta(s) { resta = s; },
           TIPI };
})();
