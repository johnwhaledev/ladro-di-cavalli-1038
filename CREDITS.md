# Crediti e licenze — Ladro di cavalli 1038 d.C.

Tre sorgenti, tre regimi diversi. Vanno tenuti distinti prima di pubblicare
qualunque cosa.

---

## 1. Fogli concept generati da te (ChatGPT)

`test_games/_archive/ChatGPT Image 17 set 2026, 21_05_40.png`
`test_games/_archive/ChatGPT Image 17 set 2026, 21_12_05.png`

Da questi vengono **tutti gli edifici, tetti, mura, castello, props, bancarelle,
stendardi, veicoli, cavalli, animali, navi, icone UI e i dieci terreni** —
221 pezzi ritagliati con `tools/slice_sheet.py`, curati a mano in
`tools/build_assets.py`.

Sono tuoi: li hai generati tu. Verifica però i termini d'uso vigenti del
servizio con cui li hai prodotti prima di venderli come parte di un prodotto:
la questione del diritto d'autore su output generativi non è chiusa e cambia
per giurisdizione. Per un progetto personale non c'è problema.

**Nota tecnica importante:** questi fogli NON sono tileset. Fondo nero invece
di canale alfa, etichette cotte nell'immagine, ogni pannello con una griglia
propria (nessuno è davvero 32×32 malgrado la scritta), e le righe marcate
"idle / walk / run 4 dir." sono variazioni disegnate, non frame coerenti: il
piede si sposta a caso fra un frame e il successivo. Per questo i personaggi
animati vengono da un pack esterno.

### 1bis. Sprite generati con meta/muse-image

I lotti del generatore (`_archive/mcp_crt/mcp_crt`, i prompt fuori dalla repo):
edifici, mura, porte, navi, la galea dell'atto III, i pezzi della corte e
del Fiordo, ridotti alla grana dei personaggi da `tools/ripulisci_nano.py` e
innestati da `tools/innesta_nano.py`. Stesso discorso dei fogli ChatGPT: per
un progetto personale nessun problema; prima di vendere, i termini d'uso
del servizio.

### 1ter. Pezzi disegnati da codice

Mura modulari, porte, castello composto, tende e insegne, staccionate,
lampioni, casse, croci, gogna, forca, rastrelliera, tavoli, moli, segni
sopra la testa (`tools/disegna_pezzi.py`), le fiamme e il fumo
(`tools/pezzi_fuoco.py`), i pezzi del Fiordo (`tools/pezzi_nord.py`):
scritti per questo progetto.

---

## 2. Il pool "Mini" di `character_studio` — MiniFolks · autore: **LYASeeK**

https://lyaseek.itch.io · pacchetto **MiniFolks - Humans**:
https://lyaseek.itch.io/minifhumans

**Aggiornato il 13/10.** Il character studio e' nato come visore di questi
pacchetti (i suoi script si lanciano "dalla cartella `minifolks_viewer/`"),
e i nomi coincidono (MiniSwordMan, MiniHorseMan, MiniArchMage...). Termini
del pacchetto Humans, letti sulla sua pagina: "You can use this assets as
you like, just don't resell it. Credit is not required but would be
appreciated." Cioe': uso libero, anche dentro un gioco; **vietato
rivenderli**; credito facoltativo (lo si da'). Gli altri personaggi del
pool (contadini, mestieri, nobili, fauna) vengono con ogni probabilita'
dagli altri pacchetti MiniFolks dello stesso autore: **da controllare uno
per uno** sulle loro pagine, che i termini siano gli stessi.

43 personaggi, spritesheet a celle 32x32 con manifest di animazioni segmentate,
gia' lavorati dal tuo toolkit (`auto_manifest.py` e compagni) e archiviati in
`star_drifter/generators/character_studio/characters/`.

Da qui viene **tutta la popolazione e tutta la fauna del gioco**: contadini, villani, mercanti,
fabbro, minatore, boscaiolo, becchino, raccoglitrice, cacciatore, nobili, re,
regina, principe, principessa, suora, ladro, spadaccino, lanciere, scudiero,
alabardiere, balestriere, arciere, cavaliere e uomo a cavallo — piu' la fauna
(lupo, orso, cinghiale, volpe, cervi, lepre, uccello) e un drago.

Sono di **solo profilo**: nessun frame frontale o di spalle. Il motore li
specchia in base alla direzione, come fa gia' con i veicoli.

Dallo stesso pool vengono, composti nel character studio, i personaggi
delle altre citta' (Vik, Ban, Sar, Pir: vichinghi, banditi, saraceni,
pirati, con asini, muli, cammelli e dromedari) e, con `tools/build_ladro.py`,
il protagonista e le sue selle (cavallo, asino, cammello, dromedario):
portano lo stesso debito di provenienza qui sotto.

**Attenzione alle licenze — il punto aperto fino al 13/10.** Il `README_toolkit.md`
del toolkit lo dice esplicitamente: questi asset provengono da pacchetti itch.io
diversi, con licenze proprie (alcune vietano la rivendita, alcune richiedono
credito), e lo script traccia la provenienza ma non verifica la licenza. Il
campo `license_TODO` di `package_builder.py` esiste per questo.

Per un progetto personale non c'e' problema. **Prima di vendere qualunque
cosa, la provenienza di ognuno di questi 43 va ricostruita e verificata**
(per il pacchetto Humans fatto: v. sopra). E' l'unico debito legale del
progetto. Pubblicare il gioco gratis con questi sprite dentro l'atlante non
e' rivenderli.

## 3. Pixel Crawler — Free Pack 2.11 · autore: **Anokolisa**

https://www.patreon.com/Anokolisa · AnomalyPixel@gmail.com

Resta in uso per **quattro alberi ad alto fusto** e lo sprite del fuoco. Il
corpo animato che avevo usato nella prima versione e' stato sostituito dal pool
Mini.

Termini dichiarati nel pack (`Terms.txt`, copiato in `_src/pc/`): credito non
obbligatorio ma gradito; modificabili in forma e colore; uso commerciale
consentito; **non rivendibili**, nemmeno modificati, ne' commercializzabili
come prodotto finale.

## 3ter. Gli animali dei fogli non sono usati

I ritagli di mucche, pecore, maiali, galline, capre e cani dai fogli ChatGPT
sono immagini ferme: accanto a cervi e volpi animati non reggevano. Sono stati
tolti dall'atlas. Il pool Mini però **non ha bestiame** — niente mucche,
pecore, maiali o galline — quindi le stalle e i recinti dei campi restano
vuoti. Se il bestiame serve, va cercato un pack animato dedicato.

## 4. Codice e caratteri

- **three.js r128** — MIT, © 2010-2021 three.js authors. Copia locale in
  `vendor/three.min.js`, nessuna CDN: il gioco gira offline.
- **Press Start 2P** — il carattere dell'interfaccia, di CodeMan38
  (Cody "CodeMan38" Boisclair), SIL Open Font License 1.1. Copia locale in
  `fonts/` (latin e latin-ext), nessuna chiamata a Google Fonts.
- Tutto il resto (motore 2.5D, shader, generazione del mondo, IA, HUD,
  pipeline Python) è scritto per questo progetto.

---

## 5. Audio

Gli **effetti** (passi, colpi, monete, corno, tuono) sono sintetizzati a
runtime con Web Audio (`src/audio.js`): nessun file, nessuna licenza.

**Musiche e ambienti** (dal 08/10, `src/colonna.js`, file in `assets/audio/`
fatti da `tools/prepara_suoni.py`, sorgenti in `_src/audio/`): tutti **CC0**
(pubblico dominio). Si possono pubblicare e modificare; il credito non e'
obbligatorio, lo si da' lo stesso.

Musiche, da OpenGameArt.org:

| Nel gioco | Brano | Autore | Pagina |
|:---|:---|:---|:---|
| esplorazione | Medieval: Exploration | RandomMind | opengameart.org/content/medieval-exploration |
| raccolto | Medieval: Harvest Season | RandomMind | opengameart.org/content/medieval-harvest-season |
| osteria | Medieval: The Old Tower Inn | RandomMind | opengameart.org/content/medieval-the-old-tower-inn |
| banchetto | Medieval: King's Feast | RandomMind | opengameart.org/content/medieval-kings-feast |
| battaglia | Medieval: Battle | RandomMind | opengameart.org/content/medieval-battle |
| vichinghi | Viking March | nightm4re | opengameart.org/content/viking-march |
| deserto | Desert Loop | iamoneabe | opengameart.org/content/desert-loop |
| marinai | A Sailor's Chant | Thimras | opengameart.org/content/a-sailors-chant |

Ambienti registrati dal vero, da **BigSoundBank** (Joseph Sardin,
bigsoundbank.com), CC0: mercato all'aperto (2728), uccelli al risveglio
(0222), campagna (0097), ruscello (0864), uccelli di notte (0315), allocco
(1763), vento fra gli alberi (0904), conversazioni in una piccola sala
(3542), camino (2855), vento che fischia (0147), gabbiani sul porto (2573),
cicale (3002), onde e sterne (0267), remare piano (1514), alberi che
fischiano (2443), barca sottocoperta (0695), pioggia e tuoni (0740). Il
numero e' quello della pagina sul sito.

## Mana Seed / Seliel the Shaper — VERIFICATO 20/09
Licenza letta: selieltheshaper.weebly.com/user-license.html

- uso **commerciale AMMESSO** ("MAY be a commercial product you charge money for")
- modifica **esplicitamente ammessa**: "You MAY edit, recolor, or change the
  assets in any way you see fit... erase, move, rotate, resize"
- credito **non obbligatorio** ("don't have to credit me... Just don't claim
  you drew it yourself")
- **VIETATO**: "You may NOT resell or redistribute (either commercially or
  freely) my assets for other people to make their own products."
- gli asset marcati "free" su itch non hanno il limite di un prodotto per
  licenza; quelli a pagamento si'

Cosa significa per noi, in concreto:
- Gentle Forest si puo' usare, anche in un prodotto a pagamento
- l'atlante va benissimo: e' esattamente "resize/rotate/edit"
- NON si possono pubblicare i FILE SORGENTE del pacchetto
- attenzione a `_src/` e a `_pipeline_sorgenti.zip`: contengono sorgenti di
  terzi. Vanno esclusi da qualunque repo pubblico. Sul disco locale va bene.

## Kenney — Roguelike/RPG pack · licenza **CC0**

https://kenney.nl · foglio `rl_roguelikeSheet_transparent.png` in
`_src/kenney_prova/`.

Da qui vengono **pavimento, parete e arredo degli interni** (la taverna):
le tile citate in `src/stanze/*.json` come `rpg:RR_CC`, portate nell'atlante
da `tools/interni.py`. CC0: nessun obbligo, nemmeno di credito; lo si da'
lo stesso.
