"use strict";
// Die Spiellogik, Zeile fuer Zeile aus piratenspiel.py uebertragen.

function neues_geschoss(x, y, vx, vy, art, farbe = null, power = null, rest = 0) {
  return { x, y, vx, vy, art, farbe, power, rest, abgeprallt: false, alter: 0, treffer: new Set(), staerke: 1 };
}

function neuer_tokenling(spalte, zeile, fraktion, kopfueber = false) {
  return {
    spalte, zeile, fraktion, kopfueber, variante: ganzzahl(TOKEN_VARIANTEN.length), phase: zufall(0, 6.28),
    wackeln: zufall(5, 9), einflug: 1, affe: 0, orbit: null, schwarm: 0, fressen: null,
  };
}

function neuer_koenig(name, x, pro_symbol) {
  const schuss_in = zufall_von(GEMINI_SCHUSS_ABSTAND);
  return {
    name, x, pro_symbol, fraktion: name, einflug: 1, richtung: wahl([-1, 1]),
    hp_max: LEBENS_SYMBOLE[name] * pro_symbol, hp: LEBENS_SYMBOLE[name] * pro_symbol,
    denkt: false, schild: 0, schild_in: name === "Claude" ? zufall_von(SCHILD_ABSTAND) : 0,
    ausweichen: false, ausweich_zeit: 0, ausweich_richtung: 1, schuss_in, schuss_voll: schuss_in, blitz: 0,
    ulti_in: zufall_von(ULTI_ERSTES), panzer: false, treffer_blitz: 0, buff: 0, versinkt: 0, symbol_verlust: new Map(),
    get lebt() { return this.hp > 0; },
  };
}

const SPEICHER_NAME = "bp_spielstand";

class Spiel {
  constructor(klaenge, sprueche) {
    this.klaenge = klaenge;
    this.sprueche = sprueche;
    this.gespeichert = this.stand_laden();
    this.W = BREITE;
    this.H = HOEHE;
    this.tasten = new Set();
    this.pausiert = false;
    this.schwierigkeit = "leicht";
    this.text_faktor = 1;
    this.neu_starten();
    this.zustand = "menue";
    this.blase = null;
  }

  get stufe() { return STUFEN[this.schwierigkeit]; }
  get event() { const e = this.events.values().next(); return e.done ? null : e.value; }
  get tempo() { return Math.min(this.stufe.tempo_max, 1 + this.zeit / 60 * this.stufe.tempo_pro_minute); }
  // Gegnerkugeln legen nur halb so stark zu, damit man noch ausweichen kann.
  get kugel_tempo() { return (1 + (this.tempo - 1) * 0.5) * this.stufe.kugel_faktor; }

  starten(schwierigkeit) {
    this.schwierigkeit = schwierigkeit;
    this.neu_starten();
  }

  zum_menue() {
    this.neu_starten();
    this.zustand = "menue";
    this.blase = null;
  }

  // ------------------------------------------------------------------ Start
  neu_starten() {
    this.ergebnis_sichern();
    this.zustand = "spiel";
    this.pausiert = false;
    this.zeit = 0;
    this.punkte = 0;
    this.gesichert = false;

    this.x = this.W / 2;
    this.ziel_x = null;           // Hierhin faehrt das Schiff, wenn der Finger es geschickt hat.
    this.blick = 1;
    this.kipp = 0;
    this.sink = 0;
    this.schuss_warten = 0;
    this.schutz = 0;
    this.flash_lite = 0;
    this.bananen = new Array(BANANEN).fill(0);  // 0 frisch, 1 alt, 2 ranzig, 3 tot, 4 weg
    this.bananen_tot = new Map();
    this.treffer_gesamt = Math.round(BANANEN * 3 * this.stufe.leben_faktor);
    this.schaden_puffer = this.treffer_gesamt - BANANEN * 3;

    this.geschosse = [];
    this.geschosse_neu = [];
    this.token_rects = [];
    this.partikel = [];
    this.explosionen = [];
    this.fallend = [];
    this.power = null;
    this.power_stufe = 0;
    this.power_zeit = 0;
    this.schwenk_start = 0;
    this.power_in = POWERUP_ABSTAND_START / this.stufe.drop_faktor;
    this.sieg_zeit = null;
    this.sieg_sprung = null;
    this.wahl_index = 1;
    this.wahl_mimic = 0;
    this.wahl_zeit = 0;
    this.name_eingabe = null;
    this.name_fertig = false;
    this.platz = null;
    this.muenzen = [];
    this.muenzen_rest = 0;
    this.tor = null;
    this.tor_chancen = TOR_CHANCEN;
    this.tor_in = zufall_von(TOR_ERSTES);
    this.schild_stufe = 0;
    this.schild_zeit = 0;
    this.schild_dauer = 0;
    this.schild_blitz = 0;
    this.schub_stufe = 0;
    this.schub_zeit = 0;
    this.meldung = null;
    this.tokens = [];
    this.block_x = (this.W - (SPALTEN - 1) * DX) / 2;
    this.block_y = BLOCK_OBEN;
    this.absenkung = 0;
    this.block_richtung = 1;
    this.rueckzug = 0;
    this.warnung = 0;
    this.nachschub_in = NACHSCHUB_ABSTAND;
    this.token_schuss_in = 2;
    this.affe_in = zufall_von(AFFEN_TOKEN_ABSTAND);

    this.faesser = FAESSER.map((anteil, i) => ({ anteil, hp: this.stufe.fass_hp, phase: i * 1.7, tempo: 1.1 + i * 0.13 }));

    this.koenige = [];
    this.auftritte = ["Claude", "ChatGPT", "Gemini"];
    this.ohne_koenig = 0;
    this.events = new Map();
    this.ulti = null;
    this.ulti_sperre = 0;
    this.schwarm_immun = false;
    this.schwarm_mitte = [0, 0];
    this.boss_in = BOSS_ALLE_SEKUNDEN;
    this.boss_sperre = BOSS_SPERRZEIT;
    this.abschuesse_seit_boss = 0;
    this.boss_reihum = 0;

    this.q_ladung = 0;
    this.e_ladung = 0;
    this.zielen = 0;
    this.schwenk = 0;
    this.bumerang = null;
    this.frost = 0;
    this.affe_flug = null;

    this.blase = null;
    this.blase_pause = 0;
    this.geplant = [];
    this.geplauder_in = zufall(8, 13);

    this.koenig_auftritt("Claude");
    for (let i = 0; i < START_REIHEN; i++) this.zusatz_reihe("Claude", true);
    this.block_y = BLOCK_OBEN + (START_REIHEN - 1) * DY;
  }

  stand_laden() {
    const leer = { top10: [], letzte_runde: 0 };
    try {
      const d = JSON.parse(localStorage.getItem(SPEICHER_NAME));
      if (d) {
        leer.top10 = (d.top10 || []).map((e) => ({ name: String(e.name), punkte: Number(e.punkte) || 0, stufe: String(e.stufe || "") }))
          .sort((a, b) => b.punkte - a.punkte).slice(0, TOP_ZAHL);
        leer.letzte_runde = Number(d.letzte_runde) || 0;
      }
    } catch (e) { /* ohne Speicher startet die Liste leer */ }
    return leer;
  }

  get bestwert() { const t = this.gespeichert.top10; return t.length ? t[0].punkte : 0; }

  speichern() {
    try { localStorage.setItem(SPEICHER_NAME, JSON.stringify(this.gespeichert)); } catch (e) { /* dann nur fuer diese Sitzung */ }
  }

  // Merkt sich die letzte Runde; in die Top Ten kommt nur, wer gewinnt.
  ergebnis_sichern() {
    if (this.gesichert !== false || this.punkte <= 0) return;
    this.gesichert = true;
    this.gespeichert.letzte_runde = this.punkte;
    this.speichern();
  }

  schafft_top_ten() {
    const t = this.gespeichert.top10;
    return this.punkte > 0 && (t.length < TOP_ZAHL || this.punkte > t[t.length - 1].punkte);
  }

  eintragen(name) {
    name = name.trim().slice(0, NAME_MAX) || NAME_STANDARD;
    const eintrag = { name, punkte: this.punkte, stufe: this.stufe.titel }, t = this.gespeichert.top10;
    t.push(eintrag);
    t.sort((a, b) => b.punkte - a.punkte);
    t.length = Math.min(t.length, TOP_ZAHL);
    const i = t.indexOf(eintrag);
    this.platz = i >= 0 ? i + 1 : null;
    this.name_eingabe = null;
    this.name_fertig = true;
    this.speichern();
  }

  // Alte Top-Ten-Eintraege von der PC-Fassung einmalig uebernehmen
  importieren(eintraege) {
    const t = this.gespeichert.top10;
    for (const e of eintraege) {
      if (!t.some((a) => a.name === e.name && a.punkte === e.punkte)) t.push({ name: String(e.name), punkte: Number(e.punkte) || 0, stufe: String(e.stufe || "") });
    }
    t.sort((a, b) => b.punkte - a.punkte);
    t.length = Math.min(t.length, TOP_ZAHL);
    this.speichern();
  }

  // ------------------------------------------------------------------ Lage
  get schiff_y() { return this.H - HUD_UNTEN - 60; }
  get fass_y() { return this.schiff_y - 135; }
  block_grenze() { return this.fass_y - 66; }

  schiff_rect() {
    const b = SCHIFF_BREITE * 0.68, h = SCHIFF_BREITE * 0.42;
    return R(Math.round(this.x - b / 2), Math.round(this.schiff_y - 6), Math.round(b), Math.round(h));
  }

  fass_mitte(f) { return [f.anteil * this.W, this.fass_y + Math.sin(this.zeit * f.tempo + f.phase) * 7]; }

  // Das noch stehende Fass, unter dem das Schiff gerade sicher ist.
  schutz_fass() {
    for (const f of this.faesser) {
      if (f.hp > 0 && Math.abs(this.x - f.anteil * this.W) <= this.stufe.fass_schutz) return f;
    }
    return null;
  }

  fass_rect(f) {
    const [x, y] = this.fass_mitte(f);
    return R(Math.round(x - FASS_BREITE / 2), Math.round(y - FASS_BREITE * 0.45), FASS_BREITE, Math.round(FASS_BREITE * 0.9));
  }

  koenig_y(k) { return KOENIG_Y - k.einflug * 220 + k.versinkt * 40; }

  koenig_rect(k, x = null) {
    x = x === null ? k.x : x;
    const f = KOENIG_BUFF_GROESSE[k.buff], b = KOENIG_BREITE * 0.72 * f, h = KOENIG_BREITE * 0.82 * f;
    return R(Math.round(x - b / 2), Math.round(this.koenig_y(k) - h / 2), Math.round(b), Math.round(h));
  }

  token_pos(t) {
    let x = this.block_x + t.spalte * DX + Math.sin(this.zeit * t.wackeln + t.phase) * 3;
    let y = this.block_y + t.zeile * DY + this.absenkung;
    y += Math.abs(Math.sin(this.zeit * t.wackeln * 0.7 + t.phase)) * -4;
    y -= t.einflug * 300;
    if (this.rueckzug > 0) {
      // Zur naeheren Seite aus dem Schussweg; das ist keine Zerstoerung.
      x += (t.spalte < SPALTEN / 2 ? -1 : 1) * this.rueckzug ** 2 * this.W;
    }
    if (t.schwarm > 0) {
      const w = (t.orbit || 0) + this.zeit * 2.2;
      x += (this.schwarm_mitte[0] + Math.cos(w) * 105 - x) * t.schwarm;
      y += (this.schwarm_mitte[1] + Math.sin(w) * 70 - y) * t.schwarm;
    }
    if (t.fressen !== null && t.fressen > 0 && this.ulti) {
      const k = this.ulti.koenig, a = Math.min(1, t.fressen);
      x += (k.x - x) * a;
      y += (this.koenig_y(k) - y) * a;
    }
    return [x, y];
  }

  token_rect(t) {
    const [x, y] = this.token_pos(t), g = TOKEN_GROESSE - 4;
    return R(Math.round(x - g / 2), Math.round(y - g / 2), g, g);
  }

  block_unten() {
    if (!this.tokens.length) return 0;
    return this.block_y + Math.max(...this.tokens.map((t) => t.zeile)) * DY + this.absenkung + TOKEN_GROESSE / 2;
  }

  reihen() { return new Set(this.tokens.map((t) => t.zeile)).size; }
  lebende_koenige() { return this.koenige.filter((k) => k.lebt); }

  // Wer gerade getroffen werden kann: beim Bossangriff nur der Angreifer.
  aktive_koenige() {
    const lebend = this.lebende_koenige();
    return this.events.size ? lebend.filter((k) => this.events.has(k)) : lebend;
  }

  // ------------------------------------------------------------------ Eingabe
  wahl_x(nummer) { return this.W / 2 + (nummer - 1) * WAHL_ABSTAND; }

  truhe_oeffnen() {
    if (this.wahl_zeit < WAHL_SPERRE) return;
    if (this.wahl_index === this.wahl_mimic) {
      this.zustand = "mimic";
      this.wahl_zeit = 0;
      this.klaenge.spiele("truhe");
      this.blase = null;
      this.sag("Claude", "Spieler verliert", true);
    } else {
      this.sieg_starten(this.wahl_x(this.wahl_index));
    }
  }

  // Von vorn, aber die Punkte zaehlen weiter.
  mimic_neustart() {
    const punkte = this.punkte;
    this.neu_starten();
    this.punkte = punkte;
  }

  q_druecken() {
    if (this.zielen > 0) {
      this.bumerang_werfen();
    } else if (this.q_ladung >= Q_ABSCHUESSE && !this.bumerang) {
      if (!this.lebende_koenige().length) {
        this.melden("Noch kein Piratenkönig in Reichweite. Ladung bleibt erhalten.");
        return;
      }
      this.zielen = Q_ZIELZEIT;
      this.schwenk = 0;
      // Der Schwenk beginnt genau ueber dem Schiff.
      const [mitte, weite] = this.ziel_winkel();
      this.schwenk_start = Math.asin(begrenzen(-mitte / weite, -1, 1));
    } else if (!this.bumerang) {
      this.melden(`Bumerang: ${this.q_ladung}/${Q_ABSCHUESSE} – Tokenlinge treffen lädt auf.`);
    }
  }

  melden(text, zeit = 2, farbe = "#fff") { this.meldung = { text, zeit, farbe }; }

  // Scheibenwischer: Die Linie dreht sich um das Schiff und faehrt mit ihm mit.
  ziel_punkt() {
    const [mitte, weite] = this.ziel_winkel();
    const w = mitte + weite * Math.sin(this.schwenk_start + this.schwenk * 2 * Math.PI / Q_SCHWENK);
    return [this.x + Math.tan(w) * (this.schiff_y - Q_ZIEL_Y), Q_ZIEL_Y];
  }

  // Der Ausschlag reicht je Seite genau bis zum Rand; so bleibt das X nirgends haengen.
  ziel_winkel() {
    const h = this.schiff_y - Q_ZIEL_Y;
    const rechts = Math.atan2(this.W - Q_ZIEL_RAND - this.x, h), links = Math.atan2(this.x - Q_ZIEL_RAND, h);
    return [(rechts - links) / 2, (rechts + links) / 2];
  }

  bumerang_werfen() {
    const ziel = this.ziel_punkt();
    // Der Flug dauert; ein anvisierter Koenig wird deshalb verfolgt, statt verfehlt zu werden.
    let verfolgt = null;
    for (const k of this.lebende_koenige()) {
      const weite = KOENIG_BREITE * KOENIG_BUFF_GROESSE[k.buff] * 0.5 + BUMERANG_FANG;
      if (Math.abs(k.x - ziel[0]) <= weite && (!verfolgt || Math.abs(k.x - ziel[0]) < Math.abs(verfolgt.x - ziel[0]))) verfolgt = k;
    }
    this.zielen = 0;
    this.q_ladung = 0;
    this.bumerang = { x: this.x, y: this.schiff_y, ziel, zurueck: false, getroffen: new Set(), alter: 0, koenig: verfolgt };
    this.klaenge.spiele("wurf");
  }

  e_druecken() {
    if (this.e_ladung < E_ABSCHUESSE || this.frost > 0) return;
    this.e_ladung = 0;
    this.frost = E_FROST;
    this.affe_flug = 0;
    this.klaenge.spiele("boom");
    this.klaenge.spiele("frost");
    if (this.event) this.event_abbrechen();
    if (this.ulti) this.ulti_abbrechen();
    this.rueckzug = 0;
    // Alle Tokenlinge platzen gleichzeitig; das laedt die Ulti nicht wieder auf.
    for (const t of [...this.tokens]) this.token_abschuss(t, true);
    for (const g of this.geschosse) {
      if (g.art === "gegner" || g.art === "lenkend") this.partikel_wolke(g.x, g.y, 3, ["rgb(210,240,255)"], 60);
    }
    this.geschosse = this.geschosse.filter((g) => g.art !== "gegner" && g.art !== "lenkend");
    for (const k of this.lebende_koenige()) {
      k.schild = 0;
      k.denkt = false;
      k.blitz = 0;
      k.ausweichen = false;
    }
    const lebend = this.lebende_koenige();
    if (lebend.length) {
      this.blase = null;
      this.sag(wahl(lebend), "Dreiköpfiger Affe erscheint", true);
    }
  }

  // ------------------------------------------------------------------ Spruchblasen
  // Hoechstens eine Blase; ueberzaehlige Reaktionen werden einfach verworfen.
  sag(figur, kategorie, wichtig = false) {
    if (this.blase && (this.blase.wichtig || !wichtig)) return false;
    if (!wichtig && this.blase_pause > 0) return false;
    const ist_koenig = typeof figur !== "string", name = ist_koenig ? figur.name : figur;
    const auswahl = (this.sprueche[name] || {})[kategorie];
    if (!auswahl || !auswahl.length) return false;
    this.blase = { figur: ist_koenig ? figur : null, name, text: wahl(auswahl), zeit: BLASE_DAUER, wichtig };
    return true;
  }

  blasen_update(dt) {
    if (this.blase) {
      this.blase.zeit -= dt;
      if (this.blase.zeit <= 0) {
        this.blase = null;
        this.blase_pause = BLASE_PAUSE;
      }
    } else if (this.blase_pause > 0) {
      this.blase_pause -= dt;
    }
  }

  plaudern_update(dt) {
    for (const e of this.geplant) e[0] -= dt;
    for (const e of this.geplant.filter((a) => a[0] <= 0)) {
      entfernen(this.geplant, e);
      if (e[1].lebt) this.sag(e[1], e[2], true);
    }
    this.geplauder_in -= dt;
    if (this.geplauder_in <= 0) {
      this.geplauder_in = zufall(8, 14);
      const lebend = this.lebende_koenige();
      if (lebend.length) {
        const k = wahl(lebend), themen = lebend.filter((a) => a !== k).map((a) => `Trifft ${a.name}`);
        if (k.name === "Claude") themen.push("Zufällig zwischendurch", "Zufällig zwischendurch", "Zufällig zwischendurch");
        if (themen.length) this.sag(k, wahl(themen));
      }
    }
  }

  // ------------------------------------------------------------------ Tokenlinge
  zusatz_reihe(fraktion, sofort = false) {
    if (this.reihen() >= MAX_REIHEN) return;
    const zeile = this.tokens.length ? Math.min(...this.tokens.map((t) => t.zeile)) - 1 : 0;
    const verkehrt = fraktion === "ChatGPT" ? ganzzahl(SPALTEN) : -1;
    for (let spalte = 0; spalte < SPALTEN; spalte++) {
      const t = neuer_tokenling(spalte, zeile, fraktion, spalte === verkehrt);
      t.einflug = sofort ? 0 : 1;
      this.tokens.push(t);
    }
  }

  // Die Fraktion mit den wenigsten Tokenlingen bekommt den Nachschub.
  naechste_fraktion() {
    const lebend = this.lebende_koenige();
    if (!lebend.length) return null;
    let beste = null, wenigste = Infinity;
    for (const k of lebend) {
      const n = this.tokens.filter((t) => t.fraktion === k.fraktion).length;
      if (n < wenigste) { wenigste = n; beste = k.fraktion; }
    }
    return beste;
  }

  tokens_update(dt) {
    if (!this.tokens.length) {
      this.block_y = BLOCK_OBEN;
      this.absenkung = Math.max(0, this.absenkung - 40);
    }
    for (const t of this.tokens) {
      t.einflug = Math.max(0, t.einflug - dt * 1.6);
      t.schwarm += begrenzen((t.orbit !== null ? 1 : 0) - t.schwarm, -dt * 1.5, dt * 1.5);
      if (t.affe > 0) t.affe -= dt;
    }
    this.rueckzug += begrenzen((this.event ? 1 : 0) - this.rueckzug, -dt * 1.6, dt * 1.6);
    if (this.frost > 0) return;

    if (this.tokens.length && !this.event) {
      const spalten = this.tokens.map((t) => t.spalte), sp_min = Math.min(...spalten), sp_max = Math.max(...spalten);
      this.block_x += this.block_richtung * BLOCK_TEMPO * this.tempo * dt;
      const links = this.block_x + sp_min * DX - TOKEN_GROESSE, rechts = this.block_x + sp_max * DX + TOKEN_GROESSE;
      if (links < 0 || rechts > this.W) {
        this.block_x -= Math.min(links, 0) + Math.max(rechts - this.W, 0);
        this.block_richtung *= -1;
        this.absenkung += BLOCK_ABSENKUNG;
      }
      // Neue Reihen schieben den Block weich nach unten, statt in die Koenige.
      const oben = this.block_y + Math.min(...this.tokens.map((t) => t.zeile)) * DY;
      if (oben < BLOCK_OBEN) this.block_y += Math.min(BLOCK_OBEN - oben, 120 * dt);

      this.nachschub_in -= dt * this.tempo;
      const ziel_reihen = Math.min(MAX_REIHEN, START_REIHEN + this.lebende_koenige().length - 1);
      if (this.nachschub_in <= 0 && this.reihen() < ziel_reihen) {
        const f = this.naechste_fraktion();
        if (f) this.zusatz_reihe(f);
        this.nachschub_in = NACHSCHUB_ABSTAND;
      }
      this.token_schuss_in -= dt;
      if (this.token_schuss_in <= 0 && this.rueckzug < 0.05) {
        this.token_schuss_in = zufall_von(TOKEN_SCHUSS_ABSTAND) * this.stufe.token_feuer / this.tempo;
        this.token_schiesst();
      }
      this.affe_in -= dt;
      if (this.affe_in <= 0) {
        this.affe_in = zufall_von(AFFEN_TOKEN_ABSTAND);
        const kandidaten = this.tokens.filter((t) => t.einflug === 0);
        if (kandidaten.length) wahl(kandidaten).affe = AFFEN_TOKEN_DAUER;
      }
      this.ueberfuellung_update(dt);
    } else if (!this.tokens.length && !this.event) {
      this.nachschub_in -= dt;
      if (this.nachschub_in <= 0) {
        const f = this.naechste_fraktion();
        if (f) this.zusatz_reihe(f);
        this.nachschub_in = NACHSCHUB_ABSTAND;
      }
    }
  }

  ueberfuellung_update(dt) {
    if (this.block_unten() > this.block_grenze()) {
      this.warnung += dt;
      if (this.warnung >= WARNZEIT) {
        this.warnung = 0;
        const untersten = Math.max(...this.tokens.map((t) => t.zeile));
        for (const t of this.tokens.filter((a) => a.zeile === untersten)) {
          this.token_platzt(t);
          entfernen(this.tokens, t);
        }
        this.absenkung = Math.max(0, this.absenkung - DY);
        this.ganze_banane_weg();
      }
    } else {
      this.warnung = 0;
    }
  }

  token_schiesst() {
    const spalten = new Map();
    for (const t of this.tokens) {
      if (t.schwarm > 0 || t.fressen !== null) continue;
      if (t.einflug === 0 && (!spalten.has(t.spalte) || t.zeile > spalten.get(t.spalte).zeile)) spalten.set(t.spalte, t);
    }
    if (spalten.size) {
      const t = wahl([...spalten.values()]), [x, y] = this.token_pos(t);
      this.geschosse.push(neues_geschoss(x, y + TOKEN_GROESSE / 2, 0, TOKEN_SCHUSS_TEMPO * this.kugel_tempo, "gegner", FARBEN[t.fraktion].haut));
    }
  }

  token_platzt(t) {
    const [x, y] = this.token_pos(t), f = FARBEN[t.affe > 0 ? "Affe" : t.fraktion];
    this.partikel_wolke(x, y, 14, [f.haut, f.hell, f.dunkel, KONTUR], 190);
  }

  token_abschuss(t, durch_ulti = false) {
    this.token_platzt(t);
    entfernen(this.tokens, t);
    this.token_rects = this.token_rects.filter((e) => e[0] !== t);
    const war_affe = t.affe > 0;
    this.punkte += war_affe ? PUNKTE_AFFE : PUNKTE_TOKEN;
    if (durch_ulti) return;
    this.klaenge.spiele("platz");
    this.abschuesse_seit_boss++;
    this.q_ladung = war_affe ? Q_ABSCHUESSE : Math.min(Q_ABSCHUESSE, this.q_ladung + 1);
    this.e_ladung = Math.min(E_ABSCHUESSE, this.e_ladung + 1);
    if (Math.random() < 0.15) {
      const besitzer = this.lebende_koenige().filter((k) => k.fraktion === t.fraktion);
      if (besitzer.length) this.sag(besitzer[0], "Tokenling abgeschossen");
    }
  }

  // ------------------------------------------------------------------ Koenige
  koenig_auftritt(name) {
    entfernen(this.auftritte, name);
    const k = neuer_koenig(name, this.W * 0.5, this.stufe.treffer_pro_symbol);
    if (this.stufe.koenig_schuss) k.schuss_in = k.schuss_voll = zufall_von(this.stufe.koenig_schuss);
    const begegnet = this.lebende_koenige();
    this.koenige.push(k);
    if (name === "Claude") {
      this.sag(k, "Spielstart", true);
    } else {
      this.sag(k, "Erscheint", true);
      this.zusatz_reihe(name);
      if (begegnet.length) this.geplant.push([BLASE_DAUER + 1, wahl(begegnet), `Trifft ${name}`]);
    }
  }

  auftritte_update(dt) {
    if (!this.auftritte.length || this.event || this.frost > 0) return;
    if (this.lebende_koenige().length) this.ohne_koenig = 0;
    else this.ohne_koenig += dt;
    const name = this.auftritte[0];
    if (this.zeit >= AUFTRITT[name] || this.ohne_koenig >= PAUSE_OHNE_KOENIG) this.koenig_auftritt(name);
  }

  koenige_update(dt) {
    const lebend = this.lebende_koenige();
    for (const k of this.koenige) {
      k.einflug = Math.max(0, k.einflug - dt / 1.2);
      k.treffer_blitz = Math.max(0, k.treffer_blitz - dt);
      for (const [nummer, rest] of [...k.symbol_verlust]) {
        if (rest - dt <= 0) k.symbol_verlust.delete(nummer);
        else k.symbol_verlust.set(nummer, rest - dt);
      }
      if (!k.lebt) k.versinkt += dt;
    }
    this.koenige = this.koenige.filter((k) => k.lebt || k.versinkt < 1);
    if (this.frost > 0) return;
    lebend.forEach((k, nummer) => {
      // Jeder Koenig faehrt in seinem eigenen Abschnitt, damit sie sich nicht decken.
      const b = this.W / lebend.length, links = nummer * b + KOENIG_BREITE * 0.55, rechts = (nummer + 1) * b - KOENIG_BREITE * 0.55;
      const e = this.events.get(k);
      if (k.ausweich_zeit > 0) {
        k.ausweich_zeit -= dt;
        k.x += k.ausweich_richtung * 420 * dt;
      } else if (e && e.kopien) {
        k.x += begrenzen(e.original_x - k.x, -500 * dt, 500 * dt);
      } else if (!k.denkt) {
        const ziel = begrenzen(k.x, links, rechts);
        if (ziel !== k.x) {
          k.x += begrenzen(ziel - k.x, -220 * dt, 220 * dt);
        } else {
          k.x += k.richtung * KOENIG_TEMPO * this.tempo * dt;
          if (k.x <= links || k.x >= rechts) {
            k.richtung = k.x <= links ? 1 : -1;
            k.x = begrenzen(k.x, links, rechts);
          }
        }
      }
      if (k.name === "Claude" && !this.event) {
        if (k.schild > 0) {
          k.schild -= dt;
        } else {
          k.schild_in -= dt;
          if (k.schild_in <= 0) {
            k.schild = SCHILD_DAUER;
            k.schild_in = zufall_von(SCHILD_ABSTAND);
          }
        }
      }
      const abstand = this.stufe.koenig_schuss;
      // Auf "Schwer" sind die Koenige auch im eigenen Angriff nicht wehrlos.
      let feuert = !this.event || (this.events.has(k) && this.stufe.schiesst_im_angriff);
      if (this.ulti && this.ulti.koenig === k) feuert = false;
      if (abstand && k.name !== "Gemini" && feuert && k.einflug === 0) {
        k.schuss_in -= dt;
        if (k.schuss_in <= 0) {
          k.schuss_in = zufall_von(abstand) / this.tempo;
          this.koenig_feuert(k.x, k);
          this.klaenge.spiele("schuss");
        }
      }
      if (k.name === "Gemini" && feuert) {
        k.schuss_in -= dt;
        const warnung = Math.min(GEMINI_WARNZEIT, k.schuss_voll * 0.6);
        if (!this.events.has(k)) k.blitz = k.schuss_in > 0 && k.schuss_in <= warnung ? warnung : 0;
        if (k.schuss_in <= 0) {
          k.schuss_in = k.schuss_voll = zufall_von(abstand || GEMINI_SCHUSS_ABSTAND) / this.tempo;
          this.gemini_schuss(k);
        }
      }
    });
  }

  koenig_feuert(x, k) {
    this.geschosse.push(neues_geschoss(x, this.koenig_y(k) + 50, 0, TOKEN_SCHUSS_TEMPO * this.kugel_tempo, "gegner", FARBEN[k.fraktion].haut));
  }

  // Nach dem Fressen feuert er einen Faecher: 3, 5 oder 7 Kugeln.
  gemini_schuss(k) {
    const anzahl = 1 + 2 * k.buff;
    for (let nummer = 0; nummer < anzahl; nummer++) {
      const seit = (nummer - (anzahl - 1) / 2) * 70;
      const kugel = neues_geschoss(k.x, this.koenig_y(k) + 50, seit, GEMINI_SCHUSS_TEMPO * this.kugel_tempo, "lenkend", "rgb(196,120,255)");
      kugel.staerke = 1 + GEMINI_BUFF_SCHADEN * k.buff;
      this.geschosse.push(kugel);
    }
    this.klaenge.spiele("abprall");
  }

  koenig_treffer(k, schaden) {
    const vorher = Math.floor((k.hp + k.pro_symbol - 1) / k.pro_symbol);
    k.hp = Math.max(0, k.hp - schaden);
    const nachher = Math.floor((k.hp + k.pro_symbol - 1) / k.pro_symbol);
    for (let nummer = nachher; nummer < vorher; nummer++) k.symbol_verlust.set(nummer, 0.9);
    this.punkte += PUNKTE_KOENIG_TREFFER;
    k.treffer_blitz = 0.12;
    this.klaenge.spiele("treffer");
    const f = FARBEN[k.fraktion];
    this.partikel_wolke(k.x, this.koenig_y(k), 12, [f.haut, f.hell, "#fff"], 170);
    if (this.events.has(k)) this.events.get(k).getroffen = true;
    k.ausweichen = false;
    if (k.lebt) {
      if (Math.random() < 0.5) this.sag(k, "Getroffen");
    } else {
      this.koenig_besiegt(k);
    }
  }

  koenig_besiegt(k) {
    this.punkte += PUNKTE_KOENIG_BESIEGT;
    this.klaenge.spiele("boom");
    const f = FARBEN[k.fraktion];
    this.partikel_wolke(k.x, this.koenig_y(k), 50, [f.haut, f.hell, f.dunkel, "rgb(255,230,120)"], 300);
    const kategorie = { Claude: "Getroffen", ChatGPT: "Besiegt", Gemini: "Entkommt" }[k.name];
    this.blase = null;
    this.sag(k.name, kategorie, true);
    if (this.events.has(k)) this.event_beenden(k);
    if (this.ulti && this.ulti.koenig === k) this.ulti_abbrechen();
    if (!this.lebende_koenige().length && !this.auftritte.length) this.spiel_gewonnen();
  }

  // ------------------------------------------------------------------ Bossangriffe
  boss_update(dt) {
    if (this.events.size) {
      for (const k of [...this.events.keys()]) if (this.events.has(k)) this.event_update(k, dt);
      return;
    }
    if (this.frost > 0 || this.ulti) return;
    this.boss_sperre -= dt;
    this.boss_in -= dt * this.tempo;
    const faellig = this.boss_in <= 0 || this.abschuesse_seit_boss >= BOSS_ALLE_ABSCHUESSE;
    const lebend = this.lebende_koenige().filter((k) => k.einflug === 0);
    if (faellig && this.boss_sperre <= 0 && lebend.length) {
      if (this.stufe.alle_zugleich && lebend.length === 3) {
        for (const k of lebend) this.event_starten(k);
      } else {
        this.event_starten(lebend[this.boss_reihum % lebend.length]);
        this.boss_reihum++;
      }
    }
  }

  event_starten(k) {
    k.schild = 0;
    k.blitz = 0;
    const e = { koenig: k, t: 0, getroffen: false };
    this.events.set(k, e);
    if (k.name === "Claude") {
      e.phase = "denken";
      k.denkt = true;
      this.sag(k, "Denkpause beginnt", true);
    } else if (k.name === "ChatGPT") {
      e.phase = "kopien";
      const plaetze = [this.W * 0.25, this.W * 0.5, this.W * 0.75].sort(() => Math.random() - 0.5);
      e.original_x = plaetze[0];
      e.kopien = plaetze.slice(1).map((p) => ({ x: k.x, ziel: p, lebt: true }));
      e.kopie_schuss = 1.2;
      this.sag(k, "Erzeugt seine Kopien", true);
    } else {
      e.phase = "zielen";
      e.strahl_x = this.x;
      e.strahl_traf = false;
      k.blitz = GEMINI_ZIELEN;
      this.klaenge.spiele("abprall");
    }
  }

  event_update(k, dt) {
    const e = this.events.get(k), pf = this.stufe.phase_faktor;
    e.t += dt;
    if (k.name === "Claude") {
      if (e.t >= CLAUDE_DENKZEIT * pf) this.event_beenden(k);
    } else if (k.name === "ChatGPT") {
      if (e.phase === "kopien") {
        for (const c of e.kopien) c.x += begrenzen(c.ziel - c.x, -500 * dt, 500 * dt);
        e.kopie_schuss -= dt;
        if (e.kopie_schuss <= 0 && this.stufe.kopie_abstand) {
          e.kopie_schuss = this.stufe.kopie_abstand / this.tempo;
          const lebend = e.kopien.filter((c) => c.lebt);
          if (lebend.length) this.koenig_feuert(wahl(lebend).x, k);
        }
        if (e.t >= GPT_KOPIEN_ZEIT * pf) this.event_beenden(k);
      } else if (e.t >= GPT_DENKZEIT * pf) {
        this.sag(k, "Denkpause endet", true);
        k.denkt = false;
        this.event_beenden(k);
      }
    } else if (e.phase === "zielen") {
      k.blitz = Math.max(0, GEMINI_ZIELEN - e.t);
      if (e.t <= GEMINI_ZIELEN - 0.5) e.strahl_x = this.x;
      if (e.t >= GEMINI_ZIELEN) {
        e.phase = "strahl";
        e.t = 0;
        k.blitz = 0;
        this.klaenge.spiele("strahl");
      }
    } else if (e.phase === "strahl") {
      const frei = this.strahl_gegen_faesser(k, e, dt), r = this.schiff_rect();
      if (frei && !e.strahl_traf && this.zustand === "spiel" && r.x - STRAHL_BREITE / 2 < e.strahl_x && e.strahl_x < r.x + r.w + STRAHL_BREITE / 2) {
        e.strahl_traf = true;
        if (!this.schild_faengt_ab()) {
          this.flash_lite = FLASH_LITE_DAUER;
          this.power_verlieren();
          this.klaenge.spiele("frost");
        }
      }
      if (e.t >= GEMINI_STRAHL) {
        e.phase = "offen";
        e.t = 0;
      }
    } else if (e.t >= GEMINI_OFFEN * pf) {
      this.event_beenden(k);
    }
  }

  // Ein Fass stoppt den Strahl; auf "Schwer" brennt er es dabei durch.
  strahl_gegen_faesser(k, e, dt) {
    e.block_y = null;
    const schaden = this.stufe.strahl_faesser ? STRAHL_FASS_SCHADEN * dt : 0;
    const y0 = this.koenig_y(k) + 40, unten = this.H - HUD_UNTEN;
    let frei = true;
    for (const f of this.faesser) {
      if (f.hp <= 0) continue;
      const [fx, fy] = this.fass_mitte(f);
      const strahl_x = k.x + (e.strahl_x - k.x) * (fy - y0) / (unten - y0);
      if (Math.abs(strahl_x - fx) < (FASS_BREITE + STRAHL_BREITE / 2) / 2) {
        if (schaden) this.fass_treffer(f, schaden);
        if (f.hp > 0) {
          frei = false;
          e.block_y = fy;
        }
      }
    }
    // Steht das Schiff unter einem Fass, faengt dieses den Strahl in jedem Fall ab.
    const schutz = this.schutz_fass();
    if (frei && schutz) {
      if (schaden) this.fass_treffer(schutz, schaden);
      if (schutz.hp > 0) {
        frei = false;
        e.block_y = this.fass_mitte(schutz)[1];
      }
    }
    return frei;
  }

  gpt_original_getroffen(k, schaden) {
    const e = this.events.get(k);
    for (const c of e.kopien) if (c.lebt) this.partikel_wolke(c.x, this.koenig_y(k), 26, werte(FARBEN.ChatGPT), 220);
    delete e.kopien;
    e.phase = "denkpause";
    e.t = 0;
    k.denkt = true;
    this.koenig_treffer(k, schaden);
    if (this.events.has(k)) this.sag(k, "Denkpause beginnt", true);
  }

  event_beenden(k = null) {
    k = k || this.events.keys().next().value;
    const e = this.events.get(k);
    this.events.delete(k);
    k.denkt = false;
    k.blitz = 0;
    this.boss_sperre = BOSS_SPERRZEIT;
    this.boss_in = BOSS_ALLE_SEKUNDEN;
    this.abschuesse_seit_boss = 0;
    this.nachschub_in = Math.max(this.nachschub_in, 2);
    this.token_schuss_in = Math.max(this.token_schuss_in, 1.5);
    if (e.getroffen) {
      this.punkte += PUNKTE_BOSSAUFGABE;
    } else if (k.lebt) {
      // Aufgabe verpasst: eine Reihe mehr, und Claude weicht der naechsten Kugel aus.
      this.zusatz_reihe(k.fraktion);
      if (k.name === "Claude") {
        k.ausweichen = true;
        this.sag(k, "Denkpause endet", true);
      } else {
        this.sag(k, "Entkommt", true);
      }
    }
  }

  // Der Frost stoppt einen laufenden Bossangriff ohne Strafe.
  event_abbrechen() {
    for (const k of this.events.keys()) {
      k.denkt = false;
      k.blitz = 0;
    }
    this.events = new Map();
    this.boss_sperre = BOSS_SPERRZEIT;
    this.boss_in = BOSS_ALLE_SEKUNDEN;
    this.abschuesse_seit_boss = 0;
  }

  // Nur auf Nightmare; es laeuft immer hoechstens eine Ulti gleichzeitig.
  ulti_update(dt) {
    if (!this.stufe.ultis || this.frost > 0) return;
    if (this.ulti) {
      this.ulti_ablauf(dt);
      return;
    }
    this.ulti_sperre = Math.max(0, this.ulti_sperre - dt);
    const bereit = [];
    for (const k of this.lebende_koenige()) {
      if (k.einflug === 0) {
        k.ulti_in -= dt;
        if (k.ulti_in <= 0) bereit.push(k);
      }
    }
    if (bereit.length && !this.events.size && this.ulti_sperre <= 0) this.ulti_starten(wahl(bereit));
  }

  ulti_starten(k) {
    k.schild = 0;
    k.schild_in += 8;
    if (k.name === "Claude") {
      this.ulti = { koenig: k, art: "laser", phase: "strich", t: 0, ziel_x: this.x, wand: wahl([0, this.W]), traf: false, titel: "LASER ÜBER BANDE!" };
      k.denkt = true;
      this.sag(k, "Denkpause beginnt", true);
    } else if (k.name === "Gemini") {
      const eigene = this.tokens.filter((t) => t.fraktion === "Gemini" && t.orbit === null);
      if (eigene.length < FRESSEN_MINDESTENS) {
        k.ulti_in = 5;
        return;
      }
      eigene.forEach((t, nummer) => { t.fressen = -nummer * 0.07; });   // einer nach dem anderen
      this.ulti = { koenig: k, art: "fressen", phase: "fressen", t: 0, titel: "TOKEN-FRESSER!" };
      k.denkt = true;
      this.sag(k, "Erscheint", true);
    } else {
      const eigene = this.tokens.filter((t) => t.fraktion === "ChatGPT" && t.fressen === null);
      if (!eigene.length) {
        k.ulti_in = 5;
        this.zusatz_reihe("ChatGPT");
        return;
      }
      const schwarm = eigene.slice(0, GATLING_SCHWARM);
      schwarm.forEach((t, nummer) => { t.orbit = nummer * 6.283 / schwarm.length; });
      this.schwarm_mitte = [k.x, this.koenig_y(k)];
      this.schwarm_immun = true;
      k.panzer = true;
      k.denkt = true;
      this.ulti = { koenig: k, art: "gatling", phase: "sammeln", t: 0, takt: 0, titel: "GATLING-WACHE!" };
      this.sag(k, "Erscheint", true);
    }
  }

  ulti_ablauf(dt) {
    const u = this.ulti, k = u.koenig;
    u.t += dt;
    if (u.art === "laser") this.laser_ablauf(u, k, dt);
    else if (u.art === "fressen") this.fressen_ablauf(u, k, dt);
    else this.gatling_ablauf(u, k, dt);
  }

  ulti_ende() {
    const k = this.ulti.koenig;
    this.ulti_abbrechen();
    k.ulti_in = zufall_von(ULTI_ABSTAND);
  }

  ulti_abbrechen() {
    if (!this.ulti) return;
    const k = this.ulti.koenig;
    this.ulti = null;
    k.denkt = false;
    k.panzer = false;
    this.schwarm_immun = false;
    this.ulti_sperre = ULTI_SPERRE;
    this.boss_sperre = Math.max(this.boss_sperre, 4);
    for (const t of this.tokens) {
      t.orbit = null;
      t.fressen = null;
    }
  }

  // Vom Koenig an die Wand und von dort zum Landepunkt; ein Fass stoppt den Strahl.
  laser_weg(u) {
    const k = u.koenig, start = [k.x, this.koenig_y(k) + 40], ziel = [u.ziel_x, this.schiff_y];
    const gespiegelt = 2 * u.wand - ziel[0];
    const anteil = gespiegelt !== start[0] ? (u.wand - start[0]) / (gespiegelt - start[0]) : 0.5;
    const bande = [u.wand, start[1] + (ziel[1] - start[1]) * anteil];
    for (const [von, nach, davor] of [[start, bande, [start]], [bande, ziel, [start, bande]]]) {
      let bestes = null, abstand = Infinity;
      for (const f of this.faesser) {
        if (f.hp <= 0) continue;
        const s = clipline(this.fass_rect(f), von[0], von[1], nach[0], nach[1]);
        if (s) {
          const neu = Math.hypot(s[0] - von[0], s[1] - von[1]);
          if (neu < abstand) { bestes = [f, s]; abstand = neu; }
        }
      }
      if (bestes) return [[...davor, bestes[1]], bestes[0]];
    }
    return [[start, bande, ziel], null];
  }

  laser_ablauf(u, k, dt) {
    if (u.phase === "strich") {
      if (u.t <= LASER_FOLGT) u.ziel_x = this.x;
      if (u.t >= LASER_STRICH) {
        u.phase = "feuer";
        u.t = 0;
        this.klaenge.spiele("strahl");
      }
      return;
    }
    const [punkte, fass] = this.laser_weg(u);
    if (fass) {
      this.fass_treffer(fass, LASER_FASS_SCHADEN * dt);
    } else if (!u.traf) {
      const a = punkte[punkte.length - 2], e = punkte[punkte.length - 1];
      const trifft = clipline(R_gross(this.schiff_rect(), 30, 30), a[0], a[1], e[0], e[1]);
      if (trifft && !this.schutz_fass()) {
        // Viel Schaden: eine ganze Banane, ausser der Schild faengt ihn ab.
        u.traf = true;
        if (!this.schild_faengt_ab()) this.ganze_banane_weg();
      }
    }
    if (u.t >= LASER_FEUER && this.ulti === u) this.ulti_ende();
  }

  fressen_ablauf(u, k, dt) {
    const beute = this.tokens.filter((t) => t.fressen !== null);
    for (const t of beute) {
      t.fressen += dt * 1.4;
      if (t.fressen >= 1) {
        entfernen(this.tokens, t);
        this.partikel_wolke(k.x, this.koenig_y(k), 6, werte(FARBEN.Gemini), 120);
        this.klaenge.spiele("blase");
      }
    }
    if (!beute.length) {
      k.buff = Math.min(3, k.buff + 1);
      this.klaenge.spiele("boom");
      this.partikel_wolke(k.x, this.koenig_y(k), 40, ["rgb(205,120,255)", "rgb(255,230,255)"], 260);
      this.ulti_ende();
    }
  }

  gatling_ablauf(u, k, dt) {
    this.schwarm_mitte = [k.x, this.koenig_y(k)];
    const schwarm = this.tokens.filter((t) => t.orbit !== null);
    if (u.phase === "sammeln") {
      if (u.t >= GATLING_SAMMELN) {
        u.phase = "feuer";
        u.t = 0;
      }
    } else if (u.phase === "feuer") {
      u.takt -= dt;
      while (u.takt <= 0) {
        u.takt += GATLING_TAKT;
        const quelle = wahl([...schwarm, null]);
        const [x, y] = quelle ? this.token_pos(quelle) : [k.x, this.koenig_y(k) + 50];
        this.geschosse.push(neues_geschoss(x, y, zufall(-120, 120), TOKEN_SCHUSS_TEMPO * this.kugel_tempo * 1.1, "gegner", FARBEN.ChatGPT.haut));
        this.klaenge.spiele("schuss");
      }
      if (u.t >= GATLING_FEUER) {
        // Abkuehlen: Jetzt sind ChatGPT und sein Schwarm wehrlos, und neue Faesser kommen.
        u.phase = "abkuehlen";
        u.t = 0;
        k.panzer = false;
        this.schwarm_immun = false;
        this.faesser_nachschub(GATLING_NEUE_FAESSER);
        this.sag(k, "Denkpause beginnt", true);
      }
    } else {
      if (Math.random() < dt * 30) {
        const [x, y] = schwarm.length ? this.token_pos(wahl(schwarm)) : [k.x, this.koenig_y(k)];
        this.partikel.push([x, y, zufall(-20, 20), -60, 0.5, 0.5, "rgb(235,235,240)", 4]);
      }
      if (u.t >= GATLING_ABKUEHLEN * this.stufe.phase_faktor) {
        this.sag(k, "Denkpause endet", true);
        this.ulti_ende();
      }
    }
  }

  faesser_nachschub(anzahl) {
    const kaputt = this.faesser.filter((f) => f.hp <= 0);
    for (let i = 0; i < anzahl; i++) {
      let fass;
      if (kaputt.length) {
        fass = kaputt.pop();
        fass.hp = this.stufe.fass_hp;
      } else {
        const belegt = new Set(this.faesser.map((f) => f.anteil));
        const frei = [0.1, 0.3, 0.5, 0.7, 0.9].filter((a) => !belegt.has(a));
        if (!frei.length) return;
        fass = { anteil: wahl(frei), hp: this.stufe.fass_hp, phase: zufall(0, 6), tempo: 1.2 };
        this.faesser.push(fass);
      }
      const [x, y] = this.fass_mitte(fass);
      this.partikel_wolke(x, y, 24, ["rgb(70,220,100)", "rgb(140,255,150)"], 170);
    }
  }

  frost_update(dt) {
    if (this.affe_flug !== null) {
      this.affe_flug += dt;
      if (this.affe_flug > 2.6) this.affe_flug = null;
    }
    if (this.frost <= 0) return;
    this.frost -= dt;
    if (this.frost <= 0) {
      this.frost = 0;
      // Auftauen: jeder Ueberlebende bringt neue Tokenlinge mit.
      for (const k of this.lebende_koenige()) this.zusatz_reihe(k.fraktion);
      this.nachschub_in = NACHSCHUB_ABSTAND;
      this.token_schuss_in = 2;
    }
  }

  // ------------------------------------------------------------------ Spieler
  spieler_update(dt) {
    const tempo = SCHIFF_TEMPO * (this.flash_lite > 0 ? 0.5 : SCHUB_FAKTOR[this.schub_stufe] || 1);
    const t = this.tasten;
    const taste = (t.has("KeyD") || t.has("ArrowRight") ? 1 : 0) - (t.has("KeyA") || t.has("ArrowLeft") ? 1 : 0);
    let richtung = taste, schritt = tempo * dt;
    if (taste) {
      this.ziel_x = null;
    } else if (this.ziel_x !== null) {
      // Der Finger setzt nur das Ziel; das Schiff faehrt mit seinem normalen Tempo dorthin.
      const abstand = this.ziel_x - this.x;
      if (Math.abs(abstand) < 2) {
        this.ziel_x = null;
        richtung = 0;
      } else {
        richtung = Math.sign(abstand);
        schritt = Math.min(schritt, Math.abs(abstand));
      }
    }
    this.x = begrenzen(this.x + richtung * schritt, SCHIFF_BREITE / 2, this.W - SCHIFF_BREITE / 2);
    if (richtung && richtung !== this.blick) {
      this.blick = richtung;
      this.kipp = 0.3;
      for (let i = 0; i < 10; i++) {
        this.partikel.push([this.x - richtung * zufall(20, 70), this.schiff_y + 45, -richtung * zufall(30, 120), zufall(-70, -10), 0.45, 0.45, "rgb(225,240,250)", zufall(2, 4)]);
      }
    }
    if (this.schub_stufe && richtung && Math.random() < 0.5) {
      this.partikel.push([this.x - richtung * zufall(40, 80), this.schiff_y + zufall(20, 48), -richtung * zufall(60, 180), zufall(-20, 10), 0.35, 0.35, "rgb(245,245,255)", zufall(2, 4)]);
    }
    this.kipp = Math.max(0, this.kipp - dt);
    this.schutz = Math.max(0, this.schutz - dt);
    this.flash_lite = Math.max(0, this.flash_lite - dt);

    // Die Kanone feuert immer von selbst.
    this.schuss_warten -= dt;
    if (this.schuss_warten <= 0) {
      this.schuss_warten = SCHUSS_ABSTAND;
      if (this.flash_lite > 0) {
        this.geschosse.push(neues_geschoss(this.x, this.schiff_y - 40, 0, -KUGEL_TEMPO * 0.4, "blase"));
        this.klaenge.spiele("blase");
      } else {
        this.feuern();
      }
    }
    if (this.zielen > 0) {
      this.zielen = Math.max(0, this.zielen - dt);   // Abbruch kostet keine Ladung
      this.schwenk += dt;
    }
  }

  feuern() {
    const art = this.power, stufe = this.power_stufe, x = this.x, y = this.schiff_y - 40;
    this.klaenge.spiele("schuss");
    if (art === null) {
      this.geschosse.push(neues_geschoss(x, y, 0, -KUGEL_TEMPO, "kugel"));
      return;
    }
    this.schuss_warten = POWERUPS[art].abstand;
    if (art === "breitseite") {
      // Links, oben, rechts; jede Stufe bringt drei Rohre mehr (3, 6, 9).
      this.faecher(x, y, 3 * stufe, 45 + (stufe - 1) * 7.5, KUGEL_TEMPO, art, 0);
    } else if (art === "prellkugel") {
      this.faecher(x, y, stufe, 6 * (stufe - 1), KUGEL_TEMPO * 0.85, art, 2 + 2 * stufe);
    } else if (art === "voodoo") {
      this.faecher(x, y, stufe, 12 * (stufe - 1), VOODOO_TEMPO, art, 0);
    } else if (art === "rammkugel") {
      this.geschosse.push(neues_geschoss(x, y, 0, -KUGEL_TEMPO * 1.1, "kugel", null, art, 3 * stufe));
    } else {
      this.geschosse.push(neues_geschoss(x, y, 0, -BOMBE_TEMPO, "bombe", null, art, stufe));
    }
  }

  faecher(x, y, anzahl, spreizung, tempo, art, rest) {
    for (let nummer = 0; nummer < anzahl; nummer++) {
      const anteil = anzahl > 1 ? nummer / (anzahl - 1) : 0.5;
      const [vx, vy] = dreh(0, -tempo, -spreizung + 2 * spreizung * anteil);
      this.geschosse.push(neues_geschoss(x, y, vx, vy, "kugel", null, art, rest));
    }
  }

  // Jede Stapelstufe haelt doppelt so lange.
  power_dauer(stufe) { return this.stufe.powerup_dauer * 2 ** (stufe - 1); }

  power_sammeln(name) {
    let stufe;
    if (name === "schutzschild") {
      stufe = this.schild_stufe = Math.min(POWERUP_MAX_STUFE, this.schild_stufe + 1);
      this.schild_zeit = this.schild_dauer = this.power_dauer(stufe);
    } else if (name === "schub") {
      stufe = this.schub_stufe = Math.min(POWERUP_MAX_STUFE, this.schub_stufe + 1);
      this.schub_zeit = this.power_dauer(stufe);
    } else {
      if (name === this.power) {
        this.power_stufe = Math.min(POWERUP_MAX_STUFE, this.power_stufe + 1);
      } else {
        this.power = name;
        this.power_stufe = 1;
      }
      stufe = this.power_stufe;
      this.power_zeit = this.power_dauer(stufe);
    }
    const titel = POWERUPS[name].titel;
    this.meldung = { text: stufe > 1 ? `${titel} x${stufe}!` : `${titel}!`, zeit: 1.4, farbe: POWERUPS[name].farbe };
    this.klaenge.spiele("abprall");
  }

  // Der Schild schluckt einen Treffer; Bananen und Faehigkeiten bleiben heil.
  schild_faengt_ab() {
    if (this.schild_stufe <= 0) return false;
    this.schild_stufe--;
    this.schild_blitz = 0.3;
    this.schutz = 0.25;
    if (this.schild_stufe === 0) this.schild_zeit = 0;
    this.klaenge.spiele("abprall");
    this.partikel_wolke(this.x, this.schiff_y, 14, [POWERUPS.schutzschild.farbe, "#fff"], 200);
    return true;
  }

  power_verlieren() {
    this.power = null;
    this.power_stufe = 0;
    this.power_zeit = 0;
    this.schub_stufe = 0;
    this.schub_zeit = 0;
  }

  powerups_update(dt) {
    // Je laenger die Runde dauert, desto oefter und schneller fallen die Kisten.
    const fortschritt = Math.min(1, this.zeit / POWERUP_ZEITRAUM);
    this.power_in -= dt;
    if (this.power_in <= 0) {
      const abstand = POWERUP_ABSTAND_START + (POWERUP_ABSTAND_MIN - POWERUP_ABSTAND_START) * fortschritt;
      this.power_in = abstand / this.stufe.drop_faktor;
      this.fallend.push({ x: zufall(60, this.W - 60), y: HUD_OBEN, art: wahl(Object.keys(POWERUPS)), phase: zufall(0, 6.28) });
    }
    const tempo = this.stufe.powerup_tempo * (1 + fortschritt);
    const schiff = R_mitte(this.x, this.schiff_y, Math.round(SCHIFF_BREITE * 0.85), Math.round(SCHIFF_BREITE * 0.72));
    for (const kiste of [...this.fallend]) {
      kiste.y += tempo * dt;
      if (R_ueberlappt(this.kisten_rect(kiste), schiff)) {
        entfernen(this.fallend, kiste);
        this.power_sammeln(kiste.art);
      } else if (kiste.y > this.H) {
        entfernen(this.fallend, kiste);
      }
    }
    if (this.power) {
      this.power_zeit -= dt;
      if (this.power_zeit <= 0) {
        this.power = null;
        this.power_stufe = 0;
        this.power_zeit = 0;
      }
    }
    if (this.schild_stufe) {
      this.schild_zeit -= dt;
      if (this.schild_zeit <= 0) {
        this.schild_stufe = 0;
        this.schild_zeit = 0;
      }
    }
    this.schild_blitz = Math.max(0, this.schild_blitz - dt);
    if (this.schub_stufe) {
      this.schub_zeit -= dt;
      if (this.schub_zeit <= 0) {
        this.schub_stufe = 0;
        this.schub_zeit = 0;
      }
    }
    if (this.meldung) {
      this.meldung.zeit -= dt;
      if (this.meldung.zeit <= 0) this.meldung = null;
    }
  }

  tor_update(dt) {
    if (!this.stufe.bananen_tor) return;
    if (this.tor) {
      this.tor.zeit -= dt;
      if (Math.abs(this.x - this.tor.x) <= TOR_BREITE / 2) {
        this.tor_geschafft();
      } else if (this.tor.zeit <= 0) {
        this.tor = null;
        this.tor_in = TOR_ABSTAND;
        this.melden("Tor verpasst!", 1.4, "rgb(255,150,120)");
      }
      return;
    }
    // Nur wenn eine ganze Banane fehlt und man gerade fair losfahren kann.
    if (this.tor_chancen <= 0 || !this.bananen.some((s) => s >= 3) || this.ulti || this.flash_lite > 0) return;
    this.tor_in -= dt;
    if (this.tor_in <= 0) this.tor_starten();
  }

  tor_starten() {
    const rand = SCHIFF_BREITE / 2, links = this.x - rand, rechts = this.W - rand - this.x;
    const seite = links > rechts ? -1 : 1;
    const weg = zufall(TOR_MIN_WEG, Math.min(TOR_MAX_WEG, Math.max(links, rechts)));
    const zeit = weg / SCHIFF_TEMPO + TOR_PUFFER;
    this.tor = { x: this.x + seite * weg, zeit, dauer: zeit };
    this.tor_chancen--;
    this.klaenge.spiele("abprall");
  }

  tor_geschafft() {
    const x = this.tor.x;
    this.tor = null;
    this.tor_in = TOR_ABSTAND;
    // Die zuletzt verlorene Banane kommt ganz frisch zurueck.
    for (let i = this.bananen.length - 1; i >= 0; i--) {
      if (this.bananen[i] >= 3) {
        this.bananen[i] = 0;
        this.bananen_tot.delete(i);
        break;
      }
    }
    this.klaenge.spiele("truhe");
    this.partikel_wolke(x, this.schiff_y, 40, ["rgb(255,225,80)", "rgb(255,245,170)", "#fff"], 280);
    this.melden("Banane zurück!", 1.6, "rgb(255,225,80)");
  }

  kisten_x(kiste) { return kiste.x + Math.sin(this.zeit * 2 + kiste.phase) * 18; }
  kisten_rect(kiste) { return R_mitte(this.kisten_x(kiste), kiste.y, POWERUP_GROESSE, POWERUP_GROESSE); }

  schaden(staerke = 1) {
    if (this.schutz > 0 || this.zustand !== "spiel") return;
    if (this.schild_faengt_ab()) return;
    this.schutz = SCHUTZZEIT;
    this.power_verlieren();
    this.klaenge.spiele("treffer");
    this.partikel_wolke(this.x, this.schiff_y + 10, 12, ["rgb(255,200,90)", "rgb(120,90,60)"], 170);
    // Mit leben_faktor > 1 kostet nicht jeder Treffer eine Bananenstufe.
    this.schaden_puffer += BANANEN * 3 * staerke;
    if (this.schaden_puffer >= this.treffer_gesamt) {
      this.schaden_puffer -= this.treffer_gesamt;
      for (let i = 0; i < this.bananen.length; i++) {
        if (this.bananen[i] < 3) {
          this.bananen[i]++;
          if (this.bananen[i] === 3) this.bananen_tot.set(i, 0.8);
          break;
        }
      }
    }
    this.untergang_pruefen();
  }

  // Strafe bei Ueberfuellung; zaehlt immer, auch waehrend der Schutzzeit.
  ganze_banane_weg() {
    this.power_verlieren();
    for (let i = 0; i < this.bananen.length; i++) {
      if (this.bananen[i] < 3) {
        this.bananen[i] = 3;
        this.bananen_tot.set(i, 0.8);
        break;
      }
    }
    this.klaenge.spiele("treffer");
    this.schutz = SCHUTZZEIT;
    this.untergang_pruefen();
  }

  untergang_pruefen() {
    if (this.bananen.every((s) => s >= 3) && this.zustand === "spiel") {
      this.zustand = "sinkt";
      this.zielen = 0;
      this.sink = 0;
      this.klaenge.spiele("boom");
      this.ergebnis_sichern();
      this.blase = null;
      this.sag("Claude", "Spieler verliert", true);
    }
  }

  spiel_gewonnen() {
    this.zustand = "gewonnen";
    this.zielen = 0;
    for (const t of this.tokens) this.token_platzt(t);
    this.tokens = [];
    this.geschosse = [];
    this.fallend = [];
    this.koenige = [];
    this.punkte += this.bananen.filter((s) => s < 3).length * PUNKTE_BANANE_AM_ENDE;
    this.ergebnis_sichern();
    this.blase = null;
    if (this.schwierigkeit === "nightmare") {
      // Zwei echte Truhen, eine Mimic; alle drei sehen gleich aus.
      this.zustand = "wahl";
      this.wahl_index = 1;
      this.wahl_zeit = 0;
      this.wahl_mimic = ganzzahl(3);
    } else {
      this.sieg_starten();
    }
  }

  sieg_starten(sprung = null) {
    this.zustand = "gewonnen";
    this.sieg_sprung = sprung;
    // Die gewaehlte Truhe ist schon gelandet und muss nicht mehr hereinfallen.
    this.sieg_zeit = sprung !== null ? SIEG_LANDUNG : 0;
    this.blase = null;
    this.sag("Claude", "Spieler gewinnt", true);
    if (this.blase) this.blase.zeit = 9999;
  }

  truhe_mitte() { return [this.W / 2, this.H / 2 + 70]; }

  sieg_update(dt) {
    const vorher = this.sieg_zeit;
    this.sieg_zeit += dt;
    const zeit = this.sieg_zeit;
    if (vorher < SIEG_LANDUNG && SIEG_LANDUNG <= zeit) this.klaenge.spiele("treffer");
    if (vorher < SIEG_AUF && SIEG_AUF <= zeit) {
      this.klaenge.spiele("truhe");
      this.klaenge.spiele("boom");
    }
    if (zeit >= SIEG_AUF + NAME_NACH && this.name_eingabe === null && !this.name_fertig && this.schafft_top_ten()) this.name_eingabe = "";
    if (zeit >= SIEG_AUF) {
      this.muenzen_erzeugen(dt);
      if (Math.random() < dt * 5) this.klaenge.spiele("muenze");
    }
    for (const m of this.muenzen) {
      m[0] += m[2] * dt;
      m[1] += m[3] * dt;
      m[3] += m[6] * dt;
    }
    this.muenzen = this.muenzen.filter((m) => m[1] < this.H + 30);
  }

  // Muenze: x, y, vx, vy, Phase, Drehtempo, Schwerkraft, Groesse
  muenzen_erzeugen(dt) {
    const neu = (x, y, vx, vy, sk) => {
      if (this.muenzen.length < SIEG_MAX_MUENZEN) this.muenzen.push([x, y, vx, vy, zufall(0, 6), zufall(8, 18), sk, ganzzahl(2)]);
    };
    this.muenzen_rest += dt * SIEG_REGEN_PRO_SEKUNDE;
    while (this.muenzen_rest >= 1) {
      this.muenzen_rest -= 1;
      neu(zufall(0, this.W), -20, zufall(-40, 40), zufall(170, 340), 120);
    }
    if (this.sieg_zeit < SIEG_AUF + SIEG_FONTAENE) {
      const [x, y] = this.truhe_mitte();
      for (let i = 0, n = Math.max(1, Math.round(dt * SIEG_FONTAENE_PRO_SEKUNDE)); i < n; i++) {
        neu(x + zufall(-80, 80), y - 50, zufall(-300, 300), zufall(-820, -480), 900);
      }
    }
  }

  bananen_update(dt) {
    for (const [i, rest] of [...this.bananen_tot]) {
      if (rest - dt <= 0) {
        this.bananen_tot.delete(i);
        this.bananen[i] = 4;
      } else {
        this.bananen_tot.set(i, rest - dt);
      }
    }
  }

  // ------------------------------------------------------------------ Geschosse
  geschosse_update(dt) {
    const behalten = [];
    // Einmal pro Bild berechnen; mit vielen Kugeln bleibt das Spiel so fluessig.
    this.token_rects = this.rueckzug < 0.05
      ? this.tokens.filter((t) => !(this.schwarm_immun && t.orbit !== null)).map((t) => [t, this.token_rect(t)])
      : [];
    for (const g of this.geschosse) {
      const alt_x = g.x, alt_y = g.y;
      g.alter += dt;
      if (g.power === "splitter" && g.alter > SPLITTER_LEBENSDAUER) continue;
      if (g.power === "voodoo" && !g.abgeprallt) {
        if (g.alter > VOODOO_LEBENSDAUER) continue;
        this.voodoo_lenken(g, dt);
      }
      if (g.art === "lenkend") {
        // Leicht nachlenken, aber kurz vor dem Schiff nicht mehr: So kann man entkommen.
        if (g.y < this.schiff_y - GEMINI_LENK_ENDE) {
          g.vx = begrenzen(g.vx + (this.x - g.x >= 0 ? 1 : -1) * GEMINI_LENKUNG * dt, -GEMINI_MAX_SEITWAERTS, GEMINI_MAX_SEITWAERTS);
        }
        if (Math.random() < 0.4) this.partikel.push([g.x, g.y, 0, 0, 0.3, 0.3, "rgb(225,160,255)", 3]);
      } else if (g.art === "blase") {
        g.vx = Math.sin(g.alter * 9) * 60;
      }
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      if (g.power === "prellkugel" && !g.abgeprallt) this.prellen(g);
      if (g.y < -30 || g.y > this.H + 30 || g.x < -30 || g.x > this.W + 30) {
        if (g.art === "kugel" && !g.abgeprallt && g.y < 0 && !g.power) this.fehlschuss();
        continue;
      }
      if (g.abgeprallt) {
        behalten.push(g);
      } else if (g.art === "bombe") {
        if (this.bombe_trifft(g, alt_x, alt_y) || g.y <= KOENIG_Y - 40) this.explosion(g.x, g.y, g.rest);
        else behalten.push(g);
      } else if (g.art === "kugel" || g.art === "blase") {
        if (!this.spielerkugel_kollision(g, alt_x, alt_y)) behalten.push(g);
      } else if (!this.gegnerkugel_kollision(g, alt_x, alt_y)) {
        behalten.push(g);
      }
    }
    behalten.push(...this.geschosse_neu);
    this.geschosse_neu = [];
    this.geschosse = this.zustand === "spiel" ? behalten : [];
    for (const e of this.explosionen) e[2] += dt;
    this.explosionen = this.explosionen.filter((e) => e[2] < 0.35);
  }

  prellen(g) {
    let seite;
    if (g.x <= 0 || g.x >= this.W) {
      seite = g.x <= 0 ? 1 : -1;
      g.x = begrenzen(g.x, 0, this.W);
    } else if (g.y <= 0) {
      seite = null;
      g.y = 0;
    } else {
      return;
    }
    g.rest--;
    if (g.rest < 0) {
      g.abgeprallt = true;           // verbraucht; verschwindet ohne Wirkung
      g.y = -40;
      return;
    }
    const tempo = Math.hypot(g.vx, g.vy), nach_unten = seite === null || g.vy > 0;
    for (let i = 0; i < 12; i++) {
      const w = zufall(20, 70) * Math.PI / 180, richtung = seite !== null ? seite : wahl([-1, 1]);
      g.vx = Math.sin(w) * tempo * richtung;
      g.vy = Math.cos(w) * tempo * (nach_unten ? 1 : -1);
      if (!nach_unten) break;
      // Zufaelliger Winkel, aber nie in Richtung unseres Schiffs.
      if (Math.abs(g.x + g.vx * (this.schiff_y - g.y) / g.vy - this.x) > SCHIFF_BREITE) break;
    }
  }

  voodoo_lenken(g, dt) {
    let bestes = null, abstand = Infinity;
    const pruefen = (zx, zy) => {
      const neu = (zx - g.x) ** 2 + (zy - g.y) ** 2;
      if (neu < abstand) { bestes = [zx, zy]; abstand = neu; }
    };
    for (const [, r] of this.token_rects) pruefen(r.x + r.w / 2, r.y + r.h / 2);
    for (const k of this.aktive_koenige()) {
      if (k.ausweich_zeit <= 0) { const r = this.koenig_rect(k); pruefen(r.x + r.w / 2, r.y + r.h / 2); }
    }
    if (!bestes) return;
    const wx = bestes[0] - g.x, wy = bestes[1] - g.y;
    if (Math.hypot(wx, wy) < 1) return;
    const grad = (Math.atan2(wy, wx) - Math.atan2(g.vy, g.vx)) * 180 / Math.PI;
    const winkel = (((grad + 180) % 360) + 360) % 360 - 180;
    [g.vx, g.vy] = dreh(g.vx, g.vy, begrenzen(winkel, -VOODOO_DREHUNG * dt, VOODOO_DREHUNG * dt));
  }

  bombe_trifft(g, x0, y0) {
    for (const [, r] of this.token_rects) if (this.linie_trifft(r, x0, y0, g.x, g.y, 8)) return true;
    for (const k of this.aktive_koenige()) if (this.linie_trifft(this.koenig_rect(k), x0, y0, g.x, g.y, 8)) return true;
    for (const [k, e] of this.events) {
      for (const c of e.kopien || []) if (c.lebt && this.linie_trifft(this.koenig_rect(k, c.x), x0, y0, g.x, g.y, 8)) return true;
    }
    return false;
  }

  explosion(x, y, stufe) {
    const radius = BOMBE_RADIUS + 30 * (stufe - 1);
    this.explosionen.push([x, y, 0, radius]);
    this.klaenge.spiele("boom");
    this.partikel_wolke(x, y, 22, ["rgb(255,150,60)", "rgb(255,220,110)", "rgb(60,40,30)"], 260);
    for (const [t, r] of [...this.token_rects]) {
      if (Math.hypot(r.x + r.w / 2 - x, r.y + r.h / 2 - y) <= radius) this.token_abschuss(t);
    }
    for (const [k, e] of [...this.events]) {
      for (const c of e.kopien || []) {
        if (c.lebt && Math.hypot(c.x - x, this.koenig_y(k) - y) <= radius + 40) this.kopie_getroffen(k, c);
      }
    }
    for (const k of this.aktive_koenige()) {
      if (Math.hypot(k.x - x, this.koenig_y(k) - y) > radius + 40) continue;
      const e = this.events.get(k);
      if (k.schild > 0 || k.panzer) {
        this.klaenge.spiele("abprall");
        this.sag(k, "Ablehnungsschild", true);
      } else if (e && e.phase === "kopien") {
        this.gpt_original_getroffen(k, BOMBE_SCHADEN);
      } else {
        this.koenig_treffer(k, BOMBE_SCHADEN);
      }
    }
    // Die Bombe zerfaellt zusaetzlich in kleine Kugeln, die weiterfliegen.
    const anzahl = 8 + 4 * (stufe - 1);
    for (let nummer = 0; nummer < anzahl; nummer++) {
      const [vx, vy] = dreh(SPLITTER_TEMPO, 0, nummer * 360 / anzahl);
      this.geschosse_neu.push(neues_geschoss(x, y, vx, vy, "kugel", null, "splitter"));
    }
  }

  // Die Rammkugel fliegt weiter, solange sie noch Durchschlaege hat.
  durchschlaegt(g, ziel) {
    if (g.power !== "rammkugel" || g.rest <= 0) return false;
    g.rest--;
    g.treffer.add(ziel);
    return true;
  }

  fehlschuss() {
    const lebend = this.lebende_koenige();
    if (lebend.length && Math.random() < 0.2) this.sag(wahl(lebend), "Spieler schießt daneben");
  }

  // Prueft den ganzen Flugweg; schnelle Kugeln ueberspringen so nichts.
  linie_trifft(r, x0, y0, x1, y1, polster = 0) {
    return clipline(R_gross(r, polster * 2, polster * 2), x0, y0, x1, y1) !== null;
  }

  spielerkugel_kollision(g, x0, y0) {
    const polster = KUGEL_GROESSE / 2, blase = g.art === "blase";
    for (const [t, r] of this.token_rects) {
      if (this.linie_trifft(r, x0, y0, g.x, g.y, polster)) {
        if (blase) this.blase_platzt(g);
        else this.token_abschuss(t);
        return !this.durchschlaegt(g, t);
      }
    }
    for (const [k, e] of this.events) {
      for (const c of e.kopien || []) {
        if (c.lebt && this.linie_trifft(this.koenig_rect(k, c.x), x0, y0, g.x, g.y, polster)) {
          if (blase) this.blase_platzt(g);
          else this.kopie_getroffen(k, c);
          return !this.durchschlaegt(g, c);
        }
      }
    }
    for (const k of this.aktive_koenige()) {
      if (k.ausweich_zeit > 0 || g.treffer.has(k)) continue;
      if (!this.linie_trifft(this.koenig_rect(k), x0, y0, g.x, g.y, polster)) continue;
      if (blase) {
        this.blase_platzt(g);
        return true;
      }
      if (k.ausweichen) {
        k.ausweichen = false;
        k.ausweich_zeit = 0.35;
        k.ausweich_richtung = k.x < this.W / 2 ? 1 : -1;
        return false;
      }
      if (k.schild > 0 || k.panzer) {
        g.abgeprallt = true;
        g.vy = Math.abs(g.vy) * 0.8;
        g.vx = zufall(-300, 300);
        this.klaenge.spiele("abprall");
        this.sag(k, "Ablehnungsschild", true);
        return false;
      }
      const e = this.events.get(k);
      if (e && e.phase === "kopien") this.gpt_original_getroffen(k, 1);
      else this.koenig_treffer(k, 1);
      return !this.durchschlaegt(g, k);
    }
    return false;
  }

  blase_platzt(g) {
    this.partikel_wolke(g.x, g.y, 5, ["rgb(230,245,255)"], 70);
    this.klaenge.spiele("blase");
  }

  kopie_getroffen(k, c) {
    c.lebt = false;
    this.punkte += PUNKTE_KOPIE;
    this.klaenge.spiele("platz");
    this.partikel_wolke(c.x, this.koenig_y(k), 26, werte(FARBEN.ChatGPT), 220);
    this.sag(k, "Kopie getroffen", !this.blase);
  }

  gegnerkugel_kollision(g, x0, y0) {
    for (const f of this.faesser) {
      if (f.hp > 0 && this.linie_trifft(this.fass_rect(f), x0, y0, g.x, g.y, 4)) {
        this.fass_treffer(f);
        return true;
      }
    }
    if (this.zustand === "spiel" && this.linie_trifft(this.schiff_rect(), x0, y0, g.x, g.y, 4)) {
      // Auch schraege oder nachlenkende Kugeln treffen unter dem Fass nur das Fass.
      const f = this.schutz_fass();
      if (f) this.fass_treffer(f);
      else this.schaden(g.staerke);
      return true;
    }
    return false;
  }

  fass_treffer(f, schaden = 1) {
    f.hp -= schaden;
    const [x, y] = this.fass_mitte(f);
    this.partikel_wolke(x, y, 4, ["rgb(130,90,50)", "rgb(70,200,90)"], 90);
    if (f.hp <= 0) {
      this.partikel_wolke(x, y, 40, ["rgb(130,90,50)", "rgb(92,62,36)", "rgb(70,220,100)", "rgb(140,255,150)"], 240);
      this.klaenge.spiele("treffer");
    }
  }

  bumerang_ende(b) {
    this.bumerang = null;
    const lebend = this.lebende_koenige();
    if (!b.getroffen.size && lebend.length) {
      // Fehlwurf: Dieser Spott kommt immer, auch ueber einen laufenden Spruch.
      this.blase = null;
      this.sag(wahl(lebend), "Spieler schießt daneben", true);
    }
  }

  bumerang_update(dt) {
    const b = this.bumerang;
    if (!b) return;
    b.alter += dt;
    if (b.alter > BUMERANG_LEBENSDAUER) {
      this.bumerang_ende(b);
      return;
    }
    const alt_x = b.x, alt_y = b.y;
    let zx, zy;
    if (b.zurueck) [zx, zy] = [this.x, this.schiff_y];
    else if (b.koenig && b.koenig.lebt) [zx, zy] = [b.koenig.x, this.koenig_y(b.koenig)];
    else [zx, zy] = b.ziel;
    const dx = zx - b.x, dy = zy - b.y, abstand = Math.hypot(dx, dy), schritt = BUMERANG_TEMPO * dt;
    if (abstand <= schritt) {
      if (b.zurueck) {
        this.bumerang_ende(b);
        return;
      }
      b.x = zx;
      b.y = zy;
      b.zurueck = true;
    } else {
      b.x += dx / abstand * schritt;
      b.y += dy / abstand * schritt;
    }
    // Zerstoert alles, was er beruehrt: Tokenlinge und feindliche Kugeln. Unsere Faesser
    // und die Power-up-Kisten laesst er in Ruhe. Koenige verlieren ein ganzes Symbol,
    // auch durch Schild und Schwarm hindurch, jeder hoechstens einmal pro Wurf.
    const p = BUMERANG_POLSTER;
    for (const t of [...this.tokens]) {
      if (this.linie_trifft(this.token_rect(t), alt_x, alt_y, b.x, b.y, p)) this.token_abschuss(t);
    }
    for (const g of [...this.geschosse]) {
      if ((g.art === "gegner" || g.art === "lenkend") && this.abstand_zur_linie(g.x, g.y, alt_x, alt_y, b.x, b.y) <= p) {
        entfernen(this.geschosse, g);
        this.partikel_wolke(g.x, g.y, 4, ["rgb(120,215,255)", "#fff"], 90);
      }
    }
    for (const [k, e] of [...this.events]) {
      for (const c of e.kopien || []) {
        if (c.lebt && this.linie_trifft(this.koenig_rect(k, c.x), alt_x, alt_y, b.x, b.y, p)) {
          b.getroffen.add(c);
          this.kopie_getroffen(k, c);
        }
      }
    }
    for (const k of this.lebende_koenige()) {
      if (b.getroffen.has(k) || !this.linie_trifft(this.koenig_rect(k), alt_x, alt_y, b.x, b.y, p)) continue;
      b.getroffen.add(k);
      const e = this.events.get(k);
      if (e && e.phase === "kopien") this.gpt_original_getroffen(k, k.pro_symbol);
      else this.koenig_treffer(k, k.pro_symbol);
      if (this.zustand !== "spiel") return;
    }
  }

  abstand_zur_linie(px, py, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, l = dx * dx + dy * dy;
    const a = l ? begrenzen(((px - x0) * dx + (py - y0) * dy) / l, 0, 1) : 0;
    return Math.hypot(px - x0 - a * dx, py - y0 - a * dy);
  }

  // ------------------------------------------------------------------ Partikel
  partikel_wolke(x, y, anzahl, farben, tempo) {
    const n = Math.min(anzahl, Math.max(0, 700 - this.partikel.length));
    for (let i = 0; i < n; i++) {
      const w = zufall(0, 6.283), v = zufall(0.25, 1) * tempo, leben = zufall(0.35, 0.8);
      this.partikel.push([x, y, Math.cos(w) * v, Math.sin(w) * v, leben, leben, wahl(farben), zufall(2.5, 5.5)]);
    }
  }

  partikel_update(dt) {
    for (const p of this.partikel) {
      p[0] += p[2] * dt;
      p[1] += p[3] * dt;
      p[3] += 240 * dt;
      p[4] -= dt;
    }
    this.partikel = this.partikel.filter((p) => p[4] > 0);
  }

  // ------------------------------------------------------------------ Ablauf
  update(dt) {
    if (this.pausiert) return;
    if (this.zustand === "menue") {
      this.zeit += dt;
      return;
    }
    if (this.zustand === "wahl") {
      this.zeit += dt;
      this.wahl_zeit += dt;
      this.partikel_update(dt);
      return;
    }
    if (this.zustand === "mimic") {
      this.zeit += dt;
      this.wahl_zeit += dt;
      this.blasen_update(dt);
      if (this.wahl_zeit >= MIMIC_DAUER) this.mimic_neustart();
      return;
    }
    this.partikel_update(dt);
    this.blasen_update(dt);
    this.bananen_update(dt);
    if (this.zustand === "gewonnen") {
      this.zeit += dt;
      this.sieg_update(dt);
      return;
    }
    if (this.zustand === "sinkt" || this.zustand === "verloren") {
      this.zeit += dt;
      this.sink = Math.min(1, this.sink + dt / 2.5);
      if (this.sink >= 1) this.zustand = "verloren";
      return;
    }
    this.zeit += dt;
    this.spieler_update(dt);
    this.powerups_update(dt);
    this.tor_update(dt);
    this.frost_update(dt);
    this.auftritte_update(dt);
    this.koenige_update(dt);
    this.boss_update(dt);
    this.ulti_update(dt);
    this.tokens_update(dt);
    this.geschosse_update(dt);
    if (this.zustand !== "spiel") return;
    this.bumerang_update(dt);
    if (this.zustand === "spiel") this.plaudern_update(dt);
  }
}
