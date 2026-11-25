// salvataggio.js — lo stato della partita come JSON, e dove tenerlo.
//
// Un salvataggio e' un oggetto piano (soldi, salute, arsenale, capitolo,
// campi presi, ora, posizione, tenda): lo stesso JSON va in localStorage
// (il "Continua" della schermata titolo) e in un file scaricato ("Esporta",
// la copia sicura: localStorage dipende dall'indirizzo del server e sparisce
// se si puliscono i dati del browser). "Importa" rilegge il file.
//
// Si salva nella tenda e a fine capitolo, non ovunque. L'incarico in corso non
// si salva: al caricamento si riparte dal committente dello stesso passo.
//
// Per atti (27/09): la versione 2 porta la storia (l'atto, campagna.js); un
// salvataggio di versione 1 e' dell'atto I e resta buono. All'inizio di ogni
// atto si salva anche in un posto dell'atto (CHIAVE.atto<n>), che non si
// sovrascrive col gioco: dalla schermata titolo si riprende un atto da capo.
//
// Lo stato vive in game.js: questo modulo lo legge e lo rimette attraverso gli
// accessi che game.js gli passa con init().

const Salvataggio = (() => {
  const CHIAVE = 'gth997.salvataggio';
  const VERSIONE = 2;
  let g = null;     // {player, campagna, world, stats, ora, posizione(), rimetti*()}

  function init(accessi) { g = accessi; }

  const tondo = v => Math.round(v * 100) / 100;

  function stato() {
    const { player: p, campagna: c, world: w } = g;
    const pos = g.posizione();
    return {
      gioco: 'GTH 997', versione: VERSIONE,
      quando: new Date().toISOString(),
      citta: w.pianta.nome, chiave: w.pianta.chiave, seme: w.seed,
      soldi: p.money, salute: Math.round(p.hp), taglia: Math.round(p.wanted),
      arsenale: [...p.arsenale], arma: p.arma, uccisi: p.kills,
      storia: Storia.perSalvare(),                    // l'atto (campagna.js)
      capitolo: c.cap, missione: c.miss, finita: c.finita,
      campi: w.accampamenti.map(a => ({ preso: !!a.preso, svaligiato: !!a.svaligiato })),
      ora: tondo(g.ora),
      posizione: { x: tondo(pos.x), z: tondo(pos.z) },
      tenda: g.tenda ? g.tenda() : null,
      meteo: Meteo.stato(),
      nebbia: Nebbia.perSalvare(),                    // la carta scoperta, per citta' (nebbia.js)
      conti: { ...g.stats },
    };
  }

  // Un file che non e' un salvataggio di questo gioco si rifiuta con un
  // perche', invece di rompere la partita a meta'
  function valida(s) {
    if (!s || s.gioco !== 'GTH 997') throw new Error(TX('salva.errore.gioco'));
    if (s.versione > VERSIONE) throw new Error(TX('salva.errore.versione'));
    for (const k of ['soldi', 'salute', 'capitolo', 'missione', 'ora'])
      if (typeof s[k] !== 'number') throw new Error(TX('salva.errore.manca', { k }));
    if (!Array.isArray(s.arsenale) || !s.posizione) throw new Error(TX('salva.errore.arsenale'));
    return s;
  }

  function applica(s) {
    valida(s);
    const { player: p, campagna: c, world: w } = g;
    // posizioni, campi e tenda valgono solo nella citta' in cui si e' salvato
    // si confronta la chiave, che non cambia con la lingua ne' coi nomi
    // (10/11); i salvataggi senza chiave col nome, come prima
    if (s.chiave !== undefined ? s.chiave !== w.pianta.chiave : (s.citta && s.citta !== w.pianta.nome))
      throw new Error(TX('salva.errore.citta', { citta: s.citta }));
    g.rimettiInPiedi();                       // giu' da sella o carro, fuori dalle stanze
    p.money = s.soldi;
    p.hp = Math.min(p.maxHp, Math.max(1, s.salute));
    p.wanted = s.taglia || 0;
    p.kills = s.uccisi || 0;
    p.arsenale = s.arsenale.filter(k => ARMI[k]);
    if (!p.arsenale.length) p.arsenale = ['spada'];
    p.equipaggia(p.arsenale.includes(s.arma) ? s.arma : p.arsenale[0]);
    Storia.rimetti(s.storia);          // i salvataggi di prima del 27/09: atto I
    c.cap = s.capitolo; c.miss = s.missione; c.finita = !!s.finita;
    c.attiva = null;
    (s.campi || []).forEach((k, i) => {
      const a = w.accampamenti[i];
      if (!a) return;
      if (k.preso && !a.preso) g.issaColori(a);
      a.svaligiato = !!k.svaligiato;
    });
    g.ora = s.ora;
    Meteo.rimetti(s.meteo);            // i salvataggi di prima del 25/09 sera non l'hanno
    Nebbia.rimetti(s.nebbia, w);       // quelli di prima del 01/10: la carta e' da scoprire
    Object.assign(g.stats, s.conti || {});
    if (g.rimettiTenda) g.rimettiTenda(s.tenda || null);
    // un salvataggio di Valdarno di prima del 06/10 (la pianta e' cambiata)
    // puo' cadere in acqua o in un muro: si riparte dal punto d'inizio
    const { x, z } = w.blocked(s.posizione.x, s.posizione.z) ? w.spawns.player : s.posizione;
    g.posiziona(x, z);
    g.obiettivo();
  }

  // --- dove sta: il browser e il file

  function scriviLocale(s) {
    try { localStorage.setItem(CHIAVE, JSON.stringify(s)); return true; }
    catch (e) { return false; }
  }

  function leggiLocale() {
    try {
      const t = localStorage.getItem(CHIAVE);
      return t ? valida(JSON.parse(t)) : null;
    } catch (e) { return null; }
  }

  // salva nel browser e restituisce lo stato salvato
  function salva() {
    const s = stato();
    s.nelBrowser = scriviLocale(s);
    return s;
  }

  // --- per atti: l'atto di un salvataggio (0 = atto I, anche per i vecchi)
  const attoDi = s => (s && s.storia && s.storia.atto) || 0;
  const chiaveAtto = n => `${CHIAVE}.atto${n}`;

  // il posto dell'atto in corso: lo stato di adesso, all'inizio dell'atto
  function salvaAtto() {
    const s = stato();
    try { localStorage.setItem(chiaveAtto(attoDi(s)), JSON.stringify(s)); s.nelBrowser = true; }
    catch (e) { s.nelBrowser = false; }
    return s;
  }

  // gli atti che si possono riprendere da capo: [{atto, s}], in ordine
  function leggiAtti() {
    const out = [];
    for (let n = 0; n < 5; n++) {
      try {
        const t = localStorage.getItem(chiaveAtto(n));
        if (t) out.push({ atto: n, s: valida(JSON.parse(t)) });
      } catch (e) { /* un posto rovinato non ferma gli altri */ }
    }
    return out;
  }

  function nomeFile(s) {
    const q = new Date(s.quando || Date.now()), due = n => String(n).padStart(2, '0');
    const d = `${q.getFullYear()}-${due(q.getMonth() + 1)}-${due(q.getDate())}_` +
              `${due(q.getHours())}${due(q.getMinutes())}`;          // ora locale
    return `gth997_${(s.citta || 'partita').toLowerCase()}_atto${attoDi(s) + 1}_` +
           `cap${s.capitolo + 1}_${d}.json`;
  }

  function esporta(s) {
    const blob = new Blob([JSON.stringify(s, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nomeFile(s);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return a.download;
  }

  async function importa(file) {
    return valida(JSON.parse(await file.text()));
  }

  return { init, stato, applica, valida, salva, leggiLocale, scriviLocale,
           esporta, importa, nomeFile, CHIAVE, salvaAtto, leggiAtti, attoDi };
})();
