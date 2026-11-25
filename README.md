# Ladro di cavalli 1038 d.C.

Un gioco alla GTA 1997 ambientato nel 1038 d.C., in 2.5D su three.js: l'Italia
carolingia (Valdarno, un borgo murato sul fiume con cinque quartieri, porto,
bosco dei briganti e campagna), i fiordi del nord e la costa saracena. Gira da
file locale, offline, senza build. (Valdarno e' il nome della prima citta'.)

Links: [www.johnwhale.com](https://www.johnwhale.com) ·
[Ko-fi](https://ko-fi.com/johnwhale) · [GitHub](https://github.com/johnwhaledev)
(il repository del gioco non e' ancora stato creato).

## Avviare

`AVVIA.bat`: avvia il server (finestra ridotta a icona, chiuderla per
fermarlo) e apre il browser quando risponde. Gli script si caricano con la loro
data di modifica nell'URL, quindi dopo un aggiornamento basta ricaricare.

Doppio clic su `index.html` non basta: Chrome blocca `fetch()` su `file://`.
A mano, un server statico nella cartella:

```bat
python -m http.server 8080
```

poi `http://localhost:8080/`.

La città si sceglie dal menu "Città (prova)" del titolo, o nell'indirizzo:
`?pianta=gen-<seme>` (un borgo generato), `?pianta=fiordo-<seme>` (un fiordo
generato), `?pianta=costa-<seme>` (una città della Costa saracena),
`?pianta=fiordo` (Valdarno con l'atlante del Fiordo), `?pianta=nave` (la nave
pirata dell'atto III in prova: in catene nella stiva, col Fiordo dietro). A
partita avviata, in console: `__game.debug.citta('fiordo-3')` (o `'valdarno'`),
`__game.debug.nave()`.

**Collaudo a schermo** (server su 8123, Playwright del venv degli strumenti):

```bat
python -m http.server 8123 --bind 127.0.0.1
C:\app\mcp\tools\.venv\Scripts\python.exe tools\collaudo.py [scene...]
```

Fotografa quartieri, corte, un campo nemico, una pineta, un carro in corsa,
un acquisto alla fucina e la piazza di notte in `out/collaudo/`, con misure,
fps, errori di console e una firma del mondo (se non cambia, il mondo generato
è identico). Esce con 1 se qualcosa non va.

## Comandi

| | |
|---|---|
| WASD / frecce | camminare |
| Maiusc | correre (consuma fiato) |
| Spazio | colpire (o tirare, se hai arco o balestra) |
| 1-9 | cambiare arma |
| B | bottega delle armi (dentro la bottega di Ferrante) |
| E | salire in sella, parlare, scendere, entrare nelle case segnate |
| T (tenuto) | piantare o smontare la tenda, fuori dalle mura (dal capitolo 2) |
| M | carta del regno |
| Tab | plancia di bordo (in alto: "Esporta partita") |
| N | spegnere e riaccendere la musica (gli ambienti restano) |
| Esc | chiudi |

Su telefono compaiono la manopola (spinta in fondo fa correre), E, ⚔ e ☰:
il ☰ apre un menu con Plancia, Carta, Arma (la dopo), Tenda (tenuta premuta)
e Musica (`src/tocco.js`). Per giocarlo sul telefono senza server:
`python tools/impacchetta_mobile.py` scrive `out/mobile/ladro1038.html`, il
gioco in una pagina sola da aprire con Chrome. Nella schermata iniziale,
CREDITI in fondo.

## Com'è fatto

```
index.html          pagina, HUD, plancia, schermata titolo
vendor/three.min.js three.js r128 (locale, niente CDN)
assets/             atlas + manifest prodotti dalla pipeline Python
src/assets.js       caricamento atlas, lookup sprite, UV
src/piante.js       la pianta di ogni citta' come dato (PIANTE.valdarno): cinta,
                    porte, piazza, castello, vie, strade di campagna, fiume
src/genera_pianta.js  una citta' nuova da un seme: PIANTE.genera(seme, stile)
src/pianta_fiordo.js  il borgo vichingo da un seme: mezzaluna di palizzata sulla
                    baia, porto dentro, strade di assi, sala del jarl, thing, hof
src/world_fiordo.js costruisce il borgo vichingo (palizzata, porte, case lunghe)
src/pianta_costa.js   la citta' della Costa saracena da un seme: medina murata sul mare,
                    suk sulla via grande, casba del palazzo dell'emiro, oasi a levante
src/world_costa.js  costruisce la Costa (mura di Valdarno color arenaria, medina, suk,
                    casba, hammam, cimitero, oasi)
src/fuochi.js       fiamme e fumo animati (fuochi, focolari, camini)
src/viaggio.js      le citta' per chiave, il cambio di citta' a partita avviata, e il
                    viaggio in barca: dal largo si salpa verso la citta' dell'atto
src/world.js        generazione mondo: World(seme, pianta) → terreno, strade, props, collisioni
src/world_borgo.js  case sulle vie, piazza, corte, porto, Lanterna Rossa
src/world_corte.js  il castello del 1038: la torre nel recinto di tronchi su terrapieno
src/world_campagna.js  bosco a macchie, campi, accampamenti nemici, cunicolo (pozzo e botola)
src/world_abitanti.js  punti di partenza, committenti, residenti
src/nav.js          A* sulla griglia delle collisioni (passanti, residenti, messaggeri)
src/traffico.js     carri in transito col carrettiere: tappe sulle strade, furto e carico
src/ambiente.js     le fasi del giorno (luce, nebbia, viraggio)
src/audio.js        gli effetti, sintetizzati in WebAudio
src/colonna.js      la colonna sonora: musiche e ambienti registrati (assets/audio/), una
                    miscela per luogo, ora, tempo e inseguimento, sfumate l'una nell'altra
src/interni.js      stanze dentro le case (src/stanze/*.json, e src/stanze/fiordo/ e
                    src/stanze/costa/ per le stanze delle altre citta'): entrare e uscire;
                    una stanza con "uscite" (il cunicolo) porta da un punto a un altro,
                    o in un'altra stanza (la botola della nave, src/stanze/nave/)
src/nave.js         la nave pirata dell'atto III: la stiva, il ponte della galea visto
                    dall'alto sul mare che scorre (scia, remi, vela), le mani del ladro
                    (ai ferri, a mani nude, armate)
src/tenda.js        la tenda del ladro: piantarla, smontarla, disegnarla
src/salvataggio.js  lo stato della partita in JSON: localStorage ("Continua") e file
src/gfx.js          renderer 2.5D: chunk, billboard, luci, post-processing
src/story.js        armi, listino della fucina, i cinque capitoli dell'atto I
src/storia_fiordo.js  i cinque capitoli dell'atto II (il Fiordo) e i suoi committenti
src/storia_mare.js  i quattro capitoli dell'atto III sulla nave pirata (testi: bozze)
src/storia_costa.js  i cinque capitoli dell'atto IV alla Costa saracena (testi: bozze)
src/storia_ritorno.js  i cinque capitoli dell'atto V, il ritorno a Valdarno (testi: bozze)
src/campagna.js     la campagna in cinque atti (CAMPAGNE, ATTI) e la storia fuori dal
                    mondo (Storia: atto, capitolo, cosa si perde nel passaggio);
                    la missione di prova per il collaudo
src/passaggi.js     le scene di passaggio: velo nero, titolo, righe di dialogo
src/missioni.js     i tipi di missione nuovi: scorta, duello nel cerchio, bestia con
                    le orme, imbarco (il registro TIPI_MISSIONE)
src/missioni_luoghi.js  gara (barca, cavallo), difesa di una porta, furto in stanza
src/missioni_nave.js  l'atto III: la chiave del nostromo, i ferri ai rematori,
                    l'ammutinamento; la guida sulla nave (stella e obiettivo)
src/missioni_costa.js  l'atto IV: la carovana dal caravanserraglio all'oasi, coi
                    cammelli dietro ai cammellieri e i predoni per strada
src/missioni_ritorno.js  l'atto V: la cattura del Ciambellano, vivo, fino in piazza
src/tocco.js        il menu ☰ del telefono (plancia, carta, arma, tenda, musica)
src/crediti.js      la pagina dei crediti nella schermata iniziale
src/viaggi.js       il menu delle citta' dopo il finale: nel titolo e nella plancia
src/bestie.js       chi tira i carri per citta' (cavallo, asino, mulo, cammello,
                    dromedario) e chi si cavalca oltre al cavallo (asino, cammello)
src/entities.js     giocatore, popolo, guardie, fauna, veicoli
src/game.js         ciclo, IA, missioni, ricercato, giorno/notte
src/hud.js          HUD, minimappa, plancia, carta
src/obiettivo.js    l'obiettivo dell'incarico su minimappa e carta, anche nella nebbia
```

### Il trucco del renderer

La camera ha **imbardata e inclinazione fisse**, come in GTA 1997. Ne segue che
tutti i billboard condividono lo stesso orientamento: l'inclinazione si può
cuocere dentro la geometria una volta sola. Ogni chunk di mondo diventa così
**una sola draw call** per centinaia di sprite statici, invece di una per
sprite. Il depth test fa da solo l'ordinamento — niente sorting per Y ogni
frame, che è la voce di costo tipica di questi motori.

Il terreno è una texture per chunk disegnata su canvas 2D (1024², 16 tile di
lato): tile ripetuti 2×2 con rotazione e variante pseudocasuale, bordi sfumati
verso i vicini con una maschera frastagliata. Le strade non sono un layer
separato, sono terreno anche loro — per questo i bordi risultano organici
senza codice dedicato. Un secondo canvas piccolo porta la maschera dell'acqua,
che lo shader usa per l'increspatura animata.

Illuminazione: `ShaderMaterial` con fino a 24 luci puntiformi passate come
uniform (torce, bracieri, falò, la torcia del giocatore di notte), colore
ambiente interpolato su sette fasi del giorno, fog lineare sulla distanza.
Post-processing in quattro passate: bright-pass, blur H, blur V, composite con
bloom, vignettatura, grana e color grading.

### La camera

Non è un treppiede incollato al personaggio. Anticipa nella direzione in cui ti
muovi (8 unità a piedi, 18 in sella, in proporzione alla velocità), si allarga
quando corri, quando guidi veloce e **quando hai la taglia addosso** — 52 unità
fermo, 66 con quattro stelle: devi vedere la ronda arrivare. Quando ti fermi
l'anticipo rientra più in fretta di quanto sia uscito e la camera torna a
centrarti. Quando parte una missione guarda per un attimo verso l'obiettivo,
con una campana che va e torna senza stacchi.

Lo scossone sugli impatti è solo traslazione, mai rotazione: i billboard sono
cotti per un orientamento fisso della camera, e farla ruotare li rivelerebbe
per quello che sono.

### L'altro villaggio

Tre accampamenti nel bosco a levante — tende e stendardi rossi, falò con luce
rossastra, una palizzata sul lato che guarda il borgo: il rosso è il loro
colore, il blu quello del borgo e della ronda. Un campo ripulito con la forza
passa al borgo, issa il blu e smette di mandare gente. La loro gente non è tinta a
runtime: ha **sprite propri con la divisa rossa**, prodotti in fase di build
rimappando i pixel blu delle vesti (`prepara_varianti.py`). Incarnato, cuoio,
elmo e contorno restano dove sono, quindi lo sprite non si spappola come
farebbe una tinta globale.

Non sono sudditi del balivo, e questo cambia le regole: **ucciderli non alza la
taglia**, e quello che portavano addosso resta a te (14-30 denari). Ogni tanto
tentano un assalto: suona il corno dalle mura, il popolo scappa, e le guardie
**mollano te** per correre alla porta. È la finestra migliore per sparire con
qualche stella addosso.

### Un protagonista solo, composto dai layer

Il ladro — cappuccio e mantello — è **sempre lo stesso corpo**. `build_ladro.py`
segue il principio di `mashup_character.py` del tuo toolkit: il layer `main`
(l'identità) resta quello di MiniThief, e a cambiare sono solo `hands` e
`slash`, cioè le mani che impugnano e il lampo del colpo, prestati dal
personaggio che possiede quell'arma. Otto varianti — spada, pugnale, lancia,
scudo, alabarda, arco, balestra — e le selle: sul cavallo sotto va il
layer `Horse` di MiniHorseMan e sopra il corpo del ladro alzato di sette
pixel; sull'asino (BanAsino) lo stesso; sul cammello e sul dromedario
(SarCammello, SarDromedario, alla Costa) il ladro sta nove pixel piu' su,
sopra la gobba.

A cavallo esistono solo le andature, e per un motivo: `hit` e `death` non si
possono comporre — il cavallo si accascia con la sua animazione mentre il corpo
usa la propria, e viene fuori un uomo sospeso sopra un cavallo morto.

Quando la bestia muore non si smonta: **si vola giù**. Lo sprite composto si
divide in due — una carcassa con `cavallo_mini` (il cavallo da solo, che si
accascia) e il ladro a terra, che scivola per l'abbrivio e dopo un secondo e
mezzo si rialza. In sella il cavallo incassa il 60% dei colpi che prendi, e un
urto violento lo può uccidere da solo: è quello che rende la cavalcata una
scelta e non un bonus.

Ogni arma porta i suoi numeri (danno, portata, cadenza) e qualche tratto: il
pugnale dimezza i punti di taglia, lo scudo dimezza i danni subiti.

Le armi a distanza mirano da sole al nemico più vicino: con personaggi di solo
profilo non si può puntare in otto direzioni, e l'auto-mira è la convenzione
degli arcade dall'alto. In mischia ti giri da solo verso l'ostile più vicino a
portata (i passanti non attirano la mira), e da cavallo si combatte e si
travolge. La freccia è un quad ruotato nel piano della camera
(`pushQuadRot` in `gfx.js`) — l'unico sprite del gioco che non sta dritto.

### Due misure che decidono tutto

**Scala unica.** Prima normalizzavo ogni personaggio alla stessa altezza
dividendo per l'altezza del suo sprite. Sbagliato: quell'altezza include
l'attrezzo impugnato — forcone, spada, alabarda — che sporge sopra la testa,
quindi più lungo l'attrezzo più piccolo veniva l'omino. Il pool è disegnato
tutto alla stessa scala da una mano sola: basta un fattore unico
(`PPU_UMANO` in `build_mini.py`), e le proporzioni relative restano quelle
dell'artista. Gli animali sono l'eccezione — l'artista li ha disegnati per
riempire la cella, non in scala — e hanno un'altezza obiettivo per specie.

**Architettura ×1.35.** Le altezze scelte a occhio sui ritagli davano case
alte 3 volte una persona; una casa a graticcio di due-tre piani ne sta 4-5.
Il fattore si applica solo a ciò che è architettura (`PREFISSI_EDIFICI`).

### Pipeline asset

Sta in `tools/`, si rilancia solo quando cambiano gli asset. I sorgenti stanno
in `_src/` (pool, layer, ritagli, catalogo), fuori da `src/` che è il codice:
la licenza Mana Seed vieta di ridistribuirli. `percorsi.py` dice dove sta cosa.

```
sincronizza_layers.py  personaggi dal character studio a _src/mini e _src/layers
                  (per default solo il resoconto, --scrivi per scrivere)
build_ladro.py    compone il protagonista dai layer: corpo del ladro fisso,
                  mani e arma innestate dagli altri personaggi; il contorno
                  dei cavalli si rifà con generate_outline.py del character
                  studio (../star_drifter/generators/character_studio)
prepara_varianti.py  divise rosse dei nemici (rimappa il blu) e registrazione
                  delle varianti del protagonista nel pool
build_accessori.py   elmi e cappucci agganciati alla testa, frame per frame
build_mini.py     impacchetta il pool Mini: misura piano d'appoggio e centro
                  del corpo per personaggio, mappa le animazioni sul
                  vocabolario del gioco
build_atlanti.py  un atlante per città in dist/<mappa>/; i pezzi scelti il
                  cui ritaglio non c'è più li eredita da _src/riferimento/
innesta_nano.py   sprite generati (lotto di Valdarno) ridotti alla grana dei
                  personaggi e innestati per nome; scrive assets/ completo
ripulisci_nano.py immagine generata → sprite (scacchiera finta, scala)
pezzi_nord.py     i pezzi del fiordo vichingo: palizzata, torrette, pietre runiche,
                  focolare lungo, scudi, idoli, strade di assi
pezzi_fuoco.py    i fotogrammi della fiamma e gli sbuffi di fumo (src/fuochi.js)
disegna_pezzi.py  mura modulari, porte, castello composto, tende e insegne delle fazioni,
                  staccionate, lampioni, casse, croci, carriola, gogna,
                  rastrelliera, tavoli, moli, segni sopra la testa: pixel art
                  da codice, stessa grana (innestati da innesta_nano; da solo
                  scrive un provino)
interni.py        le tile Kenney citate da src/stanze/*.json, per l'atlante
                  (innestate da innesta_nano; da solo scrive un provino)
taglia_kenney.py  griglie numerate dei fogli Kenney (out/kenney_*_griglia.png):
                  servono a scegliere le tile "rpg:RR_CC" delle stanze
provino_alberi.py solo provino: alberi ridotti alla grana dei personaggi
collaudo.py       il gioco in Chromium: foto, misure, errori (v. Avviare)
prepara_suoni.py  musiche e ambienti da _src/audio/ ad assets/audio/ (MP3, gli ambienti in
                  loop senza stacco); i crediti in CREDITS.md, sezione 5
collaudo_campagna.py  le scene della campagna: atti, scene di passaggio, viaggio,
                  missioni di prova, salvataggio per atti, finale dell'atto I
```

La catena completa, dal character studio al gioco:

```
python tools/sincronizza_layers.py --scrivi
python tools/build_ladro.py
python tools/prepara_varianti.py
python tools/build_accessori.py MiniOldManWarrior:elmo_nasale MiniHalberdMan:elmo_nasale MiniHunter:cappuccio
python tools/build_atlanti.py borgo
python tools/innesta_nano.py
```

## Cosa c'è dentro

- **la campagna in cinque atti**, tutti giocabili dal 13/10: Valdarno, il
  Fiordo, la nave pirata, la Costa saracena, il ritorno a Valdarno fino alla
  forca del Ciambellano (i testi degli atti III-V sono bozze); poi i
  contratti liberi
- 210 pezzi di mondo ritagliati dai tuoi fogli, 10 terreni × 4 varianti
- arredo urbano per quartiere: botti e cataste nei bassifondi, banchi e ceste
  al mercato, statue e fontane nel quartiere nobile, casse e gabbie al porto
- 43 personaggi dal pool `character_studio` (1582 frame), tutti alla stessa
  scala: mestieri veri con l'attrezzo in mano, animazioni di lavoro, fauna
- ~5.600 props piazzati, ~40 veicoli guidabili (cavalli, carri, carrozze)
- **142 residenti**: gente con un posto e un mestiere che non cambia mai. Un
  banchista dietro ogni bancarella della piazza, il re e la corte nel cortile
  del castello, le suore alla chiesa e il becchino nel cimitero, il fabbro alla
  sua fucina nei bassifondi, nocchieri sui moli, contadini nei campi,
  boscaioli accanto ai tronchi tagliati, briganti all'accampamento. Entrano ed
  escono dalla scena in base alla distanza ma restano gli stessi e tornano al
  loro posto.
- **densità per quartiere**: il mercato è pieno, il quartiere nobile è vuoto ma
  pattugliato, i campi e il bosco sono radi
- gli artigiani si fermano sul posto a lavorare (il fabbro martella, il
  minatore scava, il becchino vanga)
- **ronde vere**: le guardie camminano sulle vie lastricate scegliendo punti di
  pattuglia, non vagano a caso; fuori dalle mura non ce n'è, ed è il motivo per
  cui il bosco è dei briganti. Da tre stelle arriva la ronda a cavallo, più
  veloce di te a piedi
- **l'altro villaggio**: 3 accampamenti nel bosco, ~23 guerrieri, assalti
  periodici al borgo con le guardie che cambiano bersaglio
- fauna animata nel bosco e nei campi: lupi, orsi e cinghiali attaccano, cervi,
  volpi e lepri scappano, gli uccelli volano sopra i tetti e si alzano quando
  passi
- **campagna in 5 capitoli**: Fango e paglia (bassifondi) → La piazza si compra
  (mercato) → Carico di notte (porto) → Il patto del bosco → La corona
  (castello). 16 missioni su sei tipi riusabili: consegna, furto di mezzo,
  caccia all'uomo, fuga dalla ronda, riscossione crediti, colpo a tempo.
  Ogni capitolo ha un committente suo — gli altri ti mandano via
- **7 armi che sono 7 personaggi**: spada, pugnale, lancia, spada e scudo,
  arco, balestra, alabarda. Le prime quattro si comprano da Ferrante, balestra
  e alabarda le consegna la storia
- ciclo giorno/notte di 260 s, meteo luminoso, torce accese solo di notte
- plancia di bordo (zaino, diario, regno) e carta del regno etichettata
- **salvataggi**: a fine capitolo e nella tenda, nel browser ("Continua" sul
  titolo) e come file JSON ("Esporta partita" nella plancia, "Importa partita"
  sul titolo)
- **la tenda** (premio del capitolo 1): si pianta fuori dalle mura, dentro si
  dorme fino all'alba e si salva
- **18 osterie** riconoscibili per strada: insegna col boccale e lanterna
- **il cunicolo** fra la corte del castello e un pozzo nel bosco, dalla fine del
  capitolo 4: si entra solo se nessuno ti vede

## Cosa manca, in ordine di resa

1. **I testi definitivi** degli atti III-V (oggi bozze) e i nomi propri
   (il protagonista, le città, i personaggi): sono le ultime scelte d'autore.
2. **Frontali e spalle per i personaggi.** Il pool e' di solo profilo. I layer
   separati nei manifest permetterebbero di derivare le viste frontale e di
   spalle ridisegnando la testa via script — lavoro incerto sui 32 px, ma e'
   l'unico modo per avere le quattro direzioni con questo cast.
3. **Dialoghi.** I committenti dicono una battuta e basta. Un sistema di
   dialogo a scelte, sul modello di `dialogue-ui.js` di Star Drifter, darebbe
   corpo ai personaggi.
4. **Una seconda lingua** (inglese): oggi i testi stanno dentro il codice.
5. **Editor del mondo.** Le piante sono codice (`piante.js`, `pianta_*.js`). Un
   editor sul modello di `generators/world_editor/` le renderebbe modificabili
   senza toccare il codice.

## Licenze

Il **codice** è sotto licenza MIT (`LICENSE`). Gli **asset** (immagini,
atlanti, audio, font) no: restano con le loro licenze, in `CREDITS.md` — ci
sono tre regimi diversi e uno è restrittivo.
