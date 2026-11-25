// entities.js — giocatore, popolo, guardie, fauna, veicoli.
//
// Il cast viene dal pool "Mini" di character_studio: 43 personaggi di profilo,
// gia' animati. Non c'e' una dimensione "direzione": chi va a sinistra e'
// disegnato specchiato, esattamente come i veicoli. A camera inclinata di 58°
// il profilo regge; e in cambio si hanno ruoli veri con l'attrezzo in mano e
// animazioni di mestiere, che quattro direzioni di un manichino non davano.

// gli sprite del pool guardano a destra
function flipFromVx(vx, prev) {
  if (vx > 0.08) return false;
  if (vx < -0.08) return true;
  return prev;
}

class Actor {
  constructor(sprite, x, z) {
    this.sprite = sprite;      // nome nel pool, es. 'MiniPeasant'
    this.fazione = 'borgo';
    this.x = x; this.z = z;
    this.vx = 0; this.vz = 0;
    this.flip = Math.random() < 0.5;
    this.anim = 'idle'; this.frame = 0; this.at = 0;
    this.hp = 30; this.maxHp = 30;
    this.dead = false; this.deadT = 0;
    this.speed = 3.4;
    this.hitT = 0;
    this.atkT = 0;
    this.radius = 0.42;
  }

  setAnim(a) {
    if (this.anim !== a) { this.anim = a; this.frame = 0; this.at = 0; }
  }

  animate(dt, rates) {
    const n = Assets.charFrameCount(this.sprite, this.anim);
    if (!n) return;
    this.at += dt * (rates[this.anim] || 8);
    if (this.at < 1) return;
    const adv = Math.floor(this.at);
    this.at -= adv;
    const once = (this.anim === 'attack' || this.anim === 'hit' ||
                  this.anim === 'death');
    if (once && this.frame + adv >= n - 1) {
      this.frame = n - 1;
      if (this.anim !== 'death') this.setAnim('idle');
    } else {
      this.frame = (this.frame + adv) % n;
    }
  }

  faceMove() { this.flip = flipFromVx(this.vx, this.flip); }

  hurt(n) {
    if (this.dead) return;
    this.hp -= n;
    this.hitT = 0.25;
    if (this.hp <= 0) {
      this.dead = true; this.deadT = 0;
      this.setAnim('death');
    } else if (this.anim !== 'attack' && !this.disarcionato) {
      // chi e' appena caduto da cavallo resta a terra: il sussulto del colpo
      // gli sovrascriverebbe la caduta e si rialzerebbe subito in piedi
      this.setAnim('hit');
    }
  }
}

class Player extends Actor {
  constructor(x, z) {
    super(ARMI.spada.sprite, x, z);
    this.hp = this.maxHp = 100;
    // a piedi piu' svelto di prima (4,2 e 7,4: "senza carro e' lentissimo",
    // 25/09 notte); la ronda a quattro stelle ti sta dietro al passo, non
    // di corsa, e quella a cavallo ti prende
    this.speed = 5.0;
    this.runSpeed = 8.6;
    this.stamina = 1;
    this.money = 25;
    this.wanted = 0;          // punti, 0..60
    this.vehicle = null;
    this.attackCd = 0;
    this.kills = 0;
    this.arma = 'spada';
    this.arsenale = ['spada'];   // chiavi di ARMI possedute
    this.disarcionato = 0;       // secondi a terra dopo una caduta
  }

  get w() { return ARMI[this.arma]; }

  // La veste della citta' (29/09): nella Costa saracena il ladro va in beige
  // (pianta.VESTE_LADRO = '@beige', le varianti di prepara_varianti.py). Se
  // l'atlante della citta' non ha la variante, resta il mantello grigio
  veste(nome) {
    const v = Player.veste ? nome + Player.veste : nome;
    return Player.veste && Assets.charDef(v) ? v : nome;
  }

  // la citta' cambia (game.js, nuovoMondo): la veste si rimette addosso. Se
  // la citta' non ne dice una, quella dell'atto (il beige dell'atto V)
  vesti(suffisso) {
    Player.veste = suffisso || Storia.veste();
    this.sprite = this.veste(this.vehicle && this.vehicle.type === 'cavallo'
      ? (this.vehicle.sella || SPRITE_CAVALLO) : ARMI[this.arma].sprite);
  }

  // cambiare arma cambia il personaggio: nel pool l'arma e' il vestito
  equipaggia(chiave) {
    if (!ARMI[chiave] || !this.arsenale.includes(chiave)) return false;
    this.arma = chiave;
    if (!this.vehicle) this.sprite = this.veste(ARMI[chiave].sprite);
    this.frame = 0; this.at = 0;
    return true;
  }

  // in sella il protagonista non e' un altro personaggio: e' lo stesso corpo
  // composto sopra il cavallo (o sopra l'asino: v.sella, bestie.js)
  sali(v) {
    this.vehicle = v;
    this.sprite = this.veste((v.type === 'cavallo') ? (v.sella || SPRITE_CAVALLO)
                                                    : ARMI[this.arma].sprite);
  }

  scendi() {
    this.vehicle = null;
    this.sprite = this.veste(ARMI[this.arma].sprite);
  }

  // La bestia e' caduta sotto di te. Non si smonta: si vola giu'. Per un
  // secondo e mezzo resti a terra senza controllo, poi ti rialzi.
  cadi() {
    const dir = this.vehicle ? Math.cos(this.vehicle.rot) : (this.flip ? -1 : 1);
    const sp = this.vehicle ? Math.abs(this.vehicle.speed) : 4;
    this.vehicle = null;
    this.sprite = this.veste(ARMI[this.arma].sprite);
    this.disarcionato = 1.5;
    this.setAnim('death');          // nel pool e' la caduta a terra
    this.vx = Math.sign(dir) * Math.min(9, sp * 0.8);
    this.vz = 0;
  }

  get stars() { return this.wanted <= 0 ? 0 : Math.min(5, Math.ceil(this.wanted / 8)); }

  hurt(n) {
    let d = n * (this.w.difesa || 1);
    // in sella una buona parte del colpo la prende la bestia: e' cosi' che
    // il cavallo puo' morire sotto di te invece di essere invulnerabile
    if (this.vehicle && this.vehicle.type === 'cavallo') {
      const suCavallo = d * 0.6;
      d -= suCavallo;
      if (this.vehicle.ferisci(suCavallo) && typeof onCavalloAbbattuto === 'function')
        onCavalloAbbattuto(this.vehicle);
    }
    // minimo: la vita sotto cui non si scende (l'ammutinamento dell'atto III:
    // ti disarmano, non ti uccidono; missioni_nave.js)
    if (this.minimo) d = Math.min(d, Math.max(0, this.hp - this.minimo));
    super.hurt(d);
  }
}

class Npc extends Actor {
  constructor(sprite, x, z, prof, res) {
    super(sprite, x, z);
    this.prof = prof || 'cittadino';
    // un residente ha un'ancora e un raggio: non si allontana dal suo posto
    this.anchor = res ? { x: res.x, z: res.z } : null;
    this.raggio = res ? res.raggio : 0;
    this.fisso = res ? res.fisso : false;
    this.nome = res ? res.nome : null;
    if (res) this.flip = res.flip;
    this.state = 'wander';
    this.t = Math.random() * 3;
    this.hp = this.maxHp = 24;
    this.speed = 1.5 + Math.random() * 1.1;
    this.home = { x, z };
    this.heading = Math.random() * Math.PI * 2;
    this.fleeT = 0;
    // gli artigiani hanno un'animazione di mestiere: ogni tanto si fermano
    // sul posto a lavorare invece di vagare, e la piazza sembra viva
    this.worker = Assets.charFrameCount(sprite, 'work') > 0 &&
                  ['artigiano', 'contadino', 'mercante', 'boscaiolo']
                    .includes(this.prof);
    this.workT = 0;
  }
}

class Guard extends Actor {
  constructor(x, z, sprite, res) {
    super(sprite || 'MiniSpearMan', x, z);
    this.prof = 'guardia';
    this.hp = this.maxHp = 55;
    this.speed = 3.2;
    this.mounted = Assets.charDef(this.sprite) &&
                   Assets.charDef(this.sprite).cat === 'montato';
    if (this.mounted) { this.speed = 5.6; this.hp = this.maxHp = 80; }
    this.state = 'patrol';
    this.heading = Math.random() * Math.PI * 2;
    this.t = 0;
    this.atkCd = 0;
    this.post = { x, z };
    this.meta = null;          // punto di ronda corrente
    this.informato = 0;        // secondi in cui sa della taglia
    this.daAvvisare = null;    // collega a cui sta portando la notizia
    this.anchor = res ? { x: res.x, z: res.z } : null;
    this.raggio = res ? res.raggio : 0;
    this.fisso = res ? res.fisso : false;
  }
}

// Guerrieri dell'altro villaggio. Non sono criminali del borgo: ucciderli non
// alza la taglia, la ronda anzi combatte al tuo fianco. Si distinguono dalla
// tinta fredda applicata allo sprite — lo stesso pool, un'altra bandiera.
class Nemico extends Actor {
  constructor(sprite, x, z, opt = {}) {
    super(sprite, x, z);
    this.fazione = 'nemico';
    this.prof = 'nemico';
    this.hp = this.maxHp = opt.hp || 46;
    this.speed = opt.speed || 3.1;
    this.taglia = opt.taglia || (14 + Math.floor(Math.random() * 16));
    this.state = 'wander';
    this.heading = Math.random() * Math.PI * 2;
    this.t = Math.random() * 3;
    this.atkCd = 0;
    this.bersaglioCorrente = null;
    this.rancore = 0;                   // secondi in cui punta solo il ladro
    this.anchor = opt.anchor || null;   // accampamento di provenienza
    this.raggio = opt.raggio || 14;
    this.meta = opt.meta || null;       // obiettivo dell'assalto
  }
}

class Beast extends Actor {
  constructor(sprite, x, z) {
    super(sprite, x, z);
    this.prof = 'fauna';
    const cat = (Assets.charDef(sprite) || {}).cat;
    this.aggressive = ['lupo', 'orso', 'cinghiale', 'orso_polare', 'mastino', 'iena',
                       'leone'].includes(cat);
    this.vola = (cat === 'uccello');
    this.quota = 2.6 + Math.random() * 2.4;   // altezza di volo
    this.hp = this.maxHp = this.aggressive ? 40 : 18;
    this.speed = this.aggressive ? 3.9 : 2.6;
    this.state = 'wander';
    this.heading = Math.random() * Math.PI * 2;
    this.t = Math.random() * 3;
    this.atkCd = 0;
  }
}

class Vehicle {
  constructor(spec) {
    Object.assign(this, spec);          // type, name, x, z, rot
    this.speed = 0;
    this.rider = null;
    this.hp = this.maxHp = spec.type === 'cavallo' ? 55 : 90;
    // a piedi si corre a 8,6: un carro che fa 8 non varrebbe la fatica di salirci
    this.maxSpeed = spec.type === 'cavallo' ? 14 : 11;
    this.accel = spec.type === 'cavallo' ? 10 : 6.5;
    this.turn = spec.type === 'cavallo' ? 5.5 : 3.2;     // radianti al secondo
    // la barca va a vela sul fiume: piu' lenta di un carro, vira larga (ma
    // non piu' di chi corre a piedi, 8,6)
    if (spec.type === 'barca') { this.maxSpeed = 10; this.accel = 2.6; this.turn = 1.5; }
    // l'asino e' un cavallo piu' lento (bestie.js)
    if (spec.andatura) Object.assign(this, spec.andatura);
    this.wobble = Math.random() * 6.28;
  }

  get flip() { return Math.cos(this.rot) < 0; }

  ferisci(n) {
    this.hp -= n;
    this.colpito = 0.2;
    return this.hp <= 0;
  }

  update(dt, world, input) {
    if (this.rider) {
      // Si guida come si cammina: la freccia dice DOVE andare sullo schermo,
      // non "sterza a sinistra rispetto al muso" (quello era un carro armato,
      // e rendeva i mezzi inservibili). Il mezzo si volta verso la direzione
      // voluta alla sua velocita' di sterzata e tira tanto piu' quanto e' gia'
      // allineato: un'inversione rallenta, gira e riparte, senza retromarcia.
      const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const dz = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      if (dx || dz) {
        const d = Math.atan2(dz, dx) - this.rot;
        const scarto = Math.atan2(Math.sin(d), Math.cos(d));   // fra -pi e pi
        const passo = this.turn * dt;
        this.rot += Math.max(-passo, Math.min(passo, scarto));
        // nel fango (pioggia, neve) carri e cavalli tirano meno; la barca no
        const fango = this.type === 'barca' ? 1 : Meteo.fattore('fango');
        const voluta = this.maxSpeed * fango * Math.max(0, Math.cos(scarto));
        const k = (this.speed < voluta ? this.accel : this.accel * 1.8) * dt;
        this.speed += Math.max(-k, Math.min(k, voluta - this.speed));
      } else {
        this.speed *= (1 - 2.2 * dt);
      }
    } else {
      this.speed *= (1 - 3 * dt);
    }
    if (Math.abs(this.speed) < 0.02) { this.speed = 0; return; }
    const dx = Math.cos(this.rot) * this.speed * dt;
    const dz = Math.sin(this.rot) * this.speed * dt;
    const before = [this.x, this.z];
    [this.x, this.z] = this.type === 'barca'
      ? world.naviga(this.x, this.z, dx, dz, 1.0)
      : world.move(this.x, this.z, dx, dz, 0.9);
    if (this.x === before[0] && this.z === before[1] && Math.abs(this.speed) > 3) {
      this.crash = Math.min(1, Math.abs(this.speed) / this.maxSpeed);
      this.speed *= -0.25;
    }
  }
}
