// estrai_testi.js — l'inglese, parte 1 (15/10): i testi della storia escono
// dal codice e vanno in src/lingue/it.js, per chiave; nel codice resta TX('chiave').
//
// Lavora su copie: legge i file di SRC, scrive i riscritti e it.js in OUT.
// Per ogni file: lo esegue in una sandbox (i dati: capitoli, scene,
// committenti...), raccoglie le stringhe con almeno uno spazio coi loro
// percorsi, poi nel sorgente sostituisce ogni stringa (anche spezzata con +)
// che ha quel valore con T('percorso'). Alla fine esegue i file riscritti con
// T = il dizionario e controlla che i dati siano IDENTICI a prima.
//
//   node tools/estrai_testi.js src <cartella di prova>   (poi si copiano in src)

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const [SRC, OUT] = process.argv.slice(2);
const FILE = ['story.js', 'storia_fiordo.js', 'storia_mare.js', 'storia_costa.js',
              'storia_ritorno.js', 'passaggi.js', 'campagna.js'];
// il nome della chiave per ogni variabile coi dati
const PREFISSO = {
  CAPITOLI: 'atto1', CAPITOLI_FIORDO: 'atto2', CAPITOLI_MARE: 'atto3',
  CAPITOLI_COSTA: 'atto4', CAPITOLI_RITORNO: 'atto5', CAPITOLI_PROVA: 'prova',
  GIVER_CAP: 'committenti.atto1', GIVER_FIORDO: 'committenti.atto2',
  GIVER_MARE: 'committenti.atto3', GIVER_COSTA: 'committenti.atto4',
  GIVER_RITORNO: 'committenti.atto5', ASCOLTA_REMI: 'atto3.voci',
  SCENE_PASSAGGIO: 'scena', CAMPAGNE: 'campagna', ARMI: 'armi',
};

const VISIBILI = new Set(['titolo', 'nome', 'desc', 'testo', 'apertura', 'chiusura', 'sotto',
  'messaggio', 'fine', 'dice', 'grido', 'scoperto', 'tornato', 'armato', 'disarmo', 'dove']);

// una sandbox con quel che serve ai file per caricarsi senza browser
function sandbox(extra) {
  const nulla = new Proxy(function () {}, {
    get: (t, k) => (k === Symbol.toPrimitive ? () => '' : nulla), apply: () => nulla,
    construct: () => nulla,
  });
  const ctx = { console, Math, JSON, Object, Array, String, Number, Promise, Map, Set,
                document: nulla, window: {}, addEventListener() {}, setInterval() {},
                setTimeout() {}, localStorage: nulla, navigator: nulla, location: nulla,
                TIPI_MISSIONE: {}, ...extra };
  ctx.window = ctx;
  vm.createContext(ctx);
  return ctx;
}

function esegui(ctx, sorgente, nome) {
  const s = sorgente.replace(/^(const|let) /gm, 'var ');
  try { vm.runInContext(s, ctx, { filename: nome }); } catch (e) { /* le parti col DOM */ }
}

// i valori stringa con uno spazio, coi loro percorsi, nell'ordine del sorgente;
// un oggetto gia' visto (le battute dentro l'incarico, i capitoli dentro le
// campagne) e' lo stesso: non si conta due volte
const visti = new WeakSet();
function raccogli(valore, chiave, fuori) {
  if (valore && typeof valore === 'object') {
    if (visti.has(valore)) return;
    visti.add(valore);
  }
  if (typeof valore === 'string') {
    // con uno spazio sempre; una parola sola solo nei campi che si leggono a
    // schermo (i titoli, i nomi), mai in quelli tecnici (tipo, luogo, chi...)
    const campo = chiave.split('.').pop();
    const aSchermo = VISIBILI.has(campo) || chiave.startsWith('committenti.') ||
                     /\.r\d+\.chi$/.test(chiave);
    if (/\s/.test(valore) || (aSchermo && valore.trim())) fuori.push([chiave, valore]);
  } else if (Array.isArray(valore)) {
    valore.forEach((v, i) => {
      const k = v && typeof v === 'object' && !Array.isArray(v) && v.id !== undefined
        ? `cap${v.id}` : chiave.endsWith('.missioni') ? `p${i + 1}`
        : chiave.endsWith('.righe') ? `r${i + 1}`
        : /\.r\d+$/.test(chiave) ? (i === 0 ? 'chi' : 'testo') : String(i + 1);
      raccogli(v, chiave.endsWith('.missioni') ? `${chiave.slice(0, -9)}.${k}` : `${chiave}.${k}`, fuori);
    });
  } else if (valore && typeof valore === 'object') {
    for (const [k, v] of Object.entries(valore)) {
      const kk = /^[\w]+$/.test(k) ? k : k.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');
      raccogli(v, `${chiave}.${kk}`, fuori);
    }
  }
}

// una stringa JS letta dal sorgente ('...' o "..."), col suo valore
const LETTERALE = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/y;
function valoreDi(lett) { return vm.runInNewContext(lett); }

// tutte le espressioni "stringa (+ stringa)*" del sorgente, fuori dai commenti
function espressioni(src) {
  const fuori = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 2; continue; }
    if (c === '`') { i = src.indexOf('`', i + 1) + 1; continue; }         // i template no
    if (c === "'" || c === '"') {
      const inizio = i;
      let fine = i, valore = '', pezzi = 0;
      for (;;) {
        LETTERALE.lastIndex = fine;
        const m = LETTERALE.exec(src);
        if (!m) break;
        valore += valoreDi(m[0]); pezzi++;
        fine = LETTERALE.lastIndex;
        const dopo = /^\s*\+\s*(?=['"])/.exec(src.slice(fine, fine + 200));
        if (!dopo) break;
        fine += dopo[0].length;
      }
      if (!pezzi) { i++; continue; }
      // la chiave di un oggetto ('il nostromo': ...) resta com'e'
      const chiaveOggetto = /^\s*:/.test(src.slice(fine, fine + 5)) && pezzi === 1 &&
        /[{,]\s*$/.test(src.slice(Math.max(0, inizio - 40), inizio));
      if (!chiaveOggetto) fuori.push({ inizio, fine, valore });
      i = fine;
      continue;
    }
    i++;
  }
  return fuori;
}

const dizionario = {};
const rapporto = [];
const prima = sandbox({});
const dopo = sandbox({});
fs.mkdirSync(OUT, { recursive: true });

for (const nome of FILE) {
  const src = fs.readFileSync(path.join(SRC, nome), 'utf8');
  const chiavi = Object.keys(prima);
  esegui(prima, src, nome);
  const nuove = Object.keys(prima).filter(k => !chiavi.includes(k));
  const testi = [];
  for (const v of nuove) {
    const val = prima[v];
    if (typeof val === 'function') continue;
    if (val && typeof val === 'object' && !Array.isArray(val) && !PREFISSO[v] &&
        Object.values(val).some(x => typeof x === 'function')) continue;      // i moduli
    raccogli(val, PREFISSO[v] || v.toLowerCase(), testi);
  }
  // nel sorgente: ogni espressione stringa col valore di un testo non ancora usato
  const usati = new Set();
  let out = '', da = 0, sostituite = 0;
  for (const e of espressioni(src)) {
    const k = testi.findIndex(([, v], j) => !usati.has(j) && v === e.valore);
    if (k < 0) continue;
    usati.add(k);
    const [chiave, valore] = testi[k];
    dizionario[chiave] = valore;
    out += src.slice(da, e.inizio) + `TX('${chiave}')`;
    da = e.fine;
    sostituite++;
  }
  out += src.slice(da);
  fs.writeFileSync(path.join(OUT, nome), out);
  const mancano = testi.filter((t, j) => !usati.has(j)).map(([k]) => k);
  rapporto.push({ nome, testi: testi.length, sostituite, mancano });
}

// it.js: le chiavi in ordine, una per riga
let it = '// lingue/it.js — i testi del gioco in italiano, per chiave (lingua.js, T).\n' +
         '// Generato il 15/10 dai file della storia (estrai_testi.js); da qui in poi\n' +
         '// i testi si cambiano qui.\n\nconst TESTI_IT = {\n';
for (const [k, v] of Object.entries(dizionario)) it += `  '${k}': ${JSON.stringify(v)},\n`;
it += '};\n';
fs.writeFileSync(path.join(OUT, 'it.js'), it);

// il controllo: i file riscritti, con T sul dizionario, danno gli stessi dati
const T = k => { if (!(k in dizionario)) throw new Error('chiave assente ' + k); return dizionario[k]; };
dopo.TX = T;
const diversi = [];
for (const nome of FILE) esegui(dopo, fs.readFileSync(path.join(OUT, nome), 'utf8'), nome);
for (const v of Object.keys(prima)) {
  const a = prima[v], b = dopo[v];
  if (typeof a === 'function' || (a && typeof a === 'object' && !Array.isArray(a) &&
      !PREFISSO[v] && Object.values(a).some(x => typeof x === 'function'))) continue;
  if (JSON.stringify(a) !== JSON.stringify(b)) diversi.push(v);
}
console.log(JSON.stringify({ rapporto, chiavi: Object.keys(dizionario).length,
                             parole: Object.values(dizionario).join(' ').split(/\s+/).length,
                             diversi }, null, 1));
