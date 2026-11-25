// storia_mare.js — l'atto III, il mare: in catene sulla galea pirata (08/10).
//
// Stessa forma dei capitoli di Valdarno (story.js) e del Fiordo
// (storia_fiordo.js). La storia approvata il 26/09 ha quattro passi: 1. ai
// remi impari chi comanda; 2. rubi la chiave dei ceppi al nostromo; 3.
// durante l'abbordaggio liberi gli altri; 4. l'ammutinamento fallisce e ti
// vendono alla Costa. Tutti e quattro nel gioco (il 2, 3 e 4 dal 09/10).
//
// I TESTI SONO BOZZE (09/10, tua scelta "stella + le mie bozze"): le righe di
// STORIA_BOZZE.md, "Atto III — Il mare", provvisorie finche' non le riscrivi
// tu; quelle che in bozza mancavano (scoperto, l'apertura del passo 3,
// armato, disarmo) le ho aggiunte la' e qui. I testi degli incarichi (cosa
// fare, dove) sono di servizio. I nomi sono di ruolo ("il vecchio al remo"),
// gli stessi della bozza e di src/stanze/nave/.

const GIVER_MARE = { vecchio: TX('committenti.atto3.vecchio') };

// chi si ascolta al passo 1: i nomi sono quelli della stiva (stiva.json)
const ASCOLTA_REMI = {
  [TX('committenti.atto3.vecchio')]: TX('atto3.voci.il_vecchio_al_remo'),
  [TX('stanza.nave.stiva.residenti.7.nome')]: TX('atto3.voci.un_rematore_giovane'),
  [TX('stanza.nave.stiva.residenti.5.nome')]: TX('atto3.voci.un_rematore_del_sud'),
  [TX('nomi.nostromo')]: TX('atto3.voci.il_nostromo'),
};

const CAPITOLI_MARE = [
  {
    id: 1, titolo: TX('atto3.cap1.titolo'), giver: 'vecchio',
    apertura: TX('atto3.cap1.apertura'),
    chiusura: TX('atto3.cap1.chiusura'),
    premio: 0, arma: null,
    missioni: [
      { tipo: 'ascolta', stanza: 'stiva', battute: ASCOLTA_REMI,
        testo: TX('atto3.cap1.p1.testo') },
    ],
  },
  // passo 2 (09/10): la chiave alle spalle del nostromo (missioni_nave.js);
  // presa la chiave si resta ai ferri, e si finge
  {
    id: 2, titolo: TX('atto3.cap2.titolo'), giver: 'vecchio',
    apertura: TX('atto3.cap2.apertura'),
    chiusura: TX('atto3.cap2.chiusura'),
    premio: 0, arma: null,
    missioni: [
      { tipo: 'chiave', stanza: 'stiva', chi: TX('nomi.nostromo'),
        scoperto: TX('atto3.cap2.p1.scoperto'),
        testo: TX('atto3.cap2.p1.testo') },
    ],
  },
  // passo 3 (09/10): la scena della vela (passaggi.js), poi i ferri ai sette
  // rematori prima che torni il nostromo (missioni_nave.js); alla fine i tuoi
  {
    id: 3, titolo: TX('atto3.cap3.titolo'), giver: 'vecchio',
    apertura: TX('atto3.cap3.apertura'),
    chiusura: TX('atto3.cap3.chiusura'),
    premio: 0, arma: null,
    missioni: [
      { tipo: 'liberi', stanza: 'stiva', chi: TX('nomi.nostromo'), tempo: 60, scena: 'vela',
        tornato: TX('atto3.cap3.p1.tornato'),
        testo: TX('atto3.cap3.p1.testo') },
    ],
  },
  // passo 4 (09/10): la sciabola dalla rastrelliera a poppa, i pirati sul
  // ponte; fallisce comunque (missioni_nave.js). Il finale: la scena "La
  // Costa" (passaggi.js) e l'atto IV a Qasr Zarqa (campagna.js)
  {
    id: 4, titolo: TX('atto3.cap4.titolo'), giver: 'vecchio', finale: 'costa',
    apertura: TX('atto3.cap4.apertura'),
    chiusura: '', premio: 0, arma: null,
    missioni: [
      { tipo: 'ammutinamento', stanza: 'ponte', durata: 45, stremo: 0.3,
        armato: TX('atto3.cap4.p1.armato'),
        disarmo: TX('atto3.cap4.p1.disarmo'),
        testo: TX('atto3.cap4.p1.testo') },
    ],
  },
];
