"use strict";
// Alle Toene werden selbst erzeugt: Effekte, Monkey-Island-Melodie und Geminis Kampfmusik.
// Berechnet wird schon beim Laden; iOS gibt den Ton aber erst nach der ersten Beruehrung frei.

const RATE_EFFEKTE = 32000, RATE_THEMA = 22050;

const HALBTON = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };

// "Der Fluch der Token-Karibik": 16 Takte in 4 Akten.
// Jeder Eintrag: Grundbass, Wechselbass, drei Akkordtoene
const SCORE_HARMONIE = [
  // Akt I: Segel am Horizont
  ["A1", "E2", ["A3", "C4", "E4"]],
  ["G1", "D2", ["G3", "B3", "D4"]],
  ["F1", "C2", ["F3", "A3", "C4"]],
  ["E1", "B1", ["E3", "G#3", "B3"]],
  // Akt II: Breitseite!
  ["C2", "G2", ["C4", "E4", "G4"]],
  ["G1", "D2", ["G3", "B3", "D4"]],
  ["D2", "A1", ["D3", "F3", "A3"]],
  ["E1", "B1", ["E3", "G#3", "D4"]],
  // Akt III: LeChucks Voodoo-Lagune
  ["A1", "E2", ["A3", "C4", "E4"]],
  ["D2", "A1", ["D3", "F3", "A3"]],
  ["F1", "C2", ["F3", "A3", "D#4"]],
  ["E1", "B1", ["E3", "G#3", "B3"]],
  // Akt IV: Der Mahlstrom
  ["D2", "A1", ["D3", "F3", "A3"]],
  ["D#2", "A1", ["D#3", "F#3", "C4"]],
  ["E2", "B1", ["E3", "G#3", "B3"]],
  ["E1", "E2", ["E3", "G#3", "D4"]],
];

// Hauptmelodie: Position 0..15 im Takt -> Note
const SCORE_MELODIE = [
  { 0: "A4", 2: "B4", 3: "C5", 6: "E5", 8: "D5", 10: "C5", 12: "B4", 14: "A4" },
  { 0: "G4", 2: "A4", 3: "B4", 6: "D5", 8: "C5", 10: "B4", 12: "A4", 14: "G4" },
  { 0: "F4", 2: "G4", 3: "A4", 6: "C5", 8: "B4", 10: "A4", 12: "G#4", 14: "A4" },
  { 0: "B4", 3: "G#4", 6: "E4", 8: "G#4", 10: "B4", 12: "E5", 14: "D5", 15: "B4" },
  { 0: "C5", 3: "E5", 6: "G5", 8: "E5", 10: "D5", 12: "C5", 14: "E5" },
  { 0: "D5", 3: "G5", 6: "B5", 8: "A5", 10: "G5", 12: "F5", 14: "D5" },
  { 0: "F5", 2: "E5", 4: "D5", 6: "C5", 8: "B4", 10: "C5", 12: "D5", 14: "F5" },
  { 0: "E5", 3: "B4", 6: "G#4", 8: "B4", 10: "E5", 12: "G#5", 14: "A5", 15: "B5" },
  { 0: "A5", 3: "E5", 6: "C5", 8: "E5", 11: "F5", 12: "E5", 14: "C5" },
  { 0: "D5", 3: "F5", 6: "A5", 8: "G5", 11: "F5", 12: "E5", 14: "D5" },
  { 0: "C5", 3: "D#5", 6: "F5", 8: "A5", 11: "G#5", 12: "F5", 14: "D#5" },
  { 0: "E5", 2: "F5", 4: "E5", 6: "D5", 8: "C5", 10: "B4", 12: "G#4", 14: "B4" },
  { 0: "D5", 2: "F5", 4: "A5", 6: "F5", 8: "D5", 10: "F5", 12: "A5", 14: "D6" },
  { 0: "D#5", 2: "F#5", 4: "A5", 6: "C6", 8: "B5", 10: "A5", 12: "F#5", 14: "D#5" },
  { 0: "E5", 2: "G#5", 4: "B5", 6: "E6", 8: "D6", 10: "B5", 12: "G#5", 14: "E5" },
  // Das grosse Glissando-Finale vor dem Drop
  { 0: "E5", 2: "F5", 4: "G#5", 6: "A5", 8: "B5", 10: "C6", 12: "D6", 14: "E6" },
];

// Gegenstimme: Zupf-Harfe, in Akt III Steeldrum
const SCORE_KONTER = [
  { 0: "E4", 4: "A4", 7: "C5", 10: "A4", 14: "E4" },
  { 0: "D4", 4: "G4", 7: "B4", 10: "G4", 14: "D4" },
  { 0: "C4", 4: "F4", 7: "A4", 10: "F4", 14: "C4" },
  { 0: "B3", 4: "E4", 7: "G#4", 10: "B4", 14: "G#4" },
  { 0: "G4", 4: "C5", 7: "E5", 10: "C5", 14: "G4" },
  { 0: "D4", 4: "G4", 7: "B4", 10: "D5", 14: "B4" },
  { 0: "A3", 4: "D4", 7: "F4", 10: "A4", 14: "F4" },
  { 0: "B3", 4: "E4", 7: "G#4", 10: "B4", 14: "D5" },
  { 0: "C5", 2: "A4", 4: "E5", 6: "A4", 8: "C5", 10: "A4", 12: "E5", 14: "A4" },
  { 0: "F5", 2: "D5", 4: "A5", 6: "D5", 8: "F5", 10: "D5", 12: "A5", 14: "D5" },
  { 0: "D#5", 2: "C5", 4: "A5", 6: "C5", 8: "D#5", 10: "C5", 12: "F5", 14: "A5" },
  { 0: "E5", 2: "B4", 4: "G#4", 6: "B4", 8: "E5", 10: "G#5", 12: "B5", 14: "E5" },
  { 0: "A4", 2: "D5", 4: "F5", 6: "A5", 8: "F5", 10: "D5", 12: "A4", 14: "F5" },
  { 0: "A4", 2: "D#5", 4: "F#5", 6: "C6", 8: "A5", 10: "F#5", 12: "D#5", 14: "C5" },
  { 0: "B4", 2: "E5", 4: "G#5", 6: "B5", 8: "G#5", 10: "E5", 12: "B4", 14: "G#4" },
  { 0: "E4", 1: "G#4", 2: "B4", 3: "D5", 4: "E5", 5: "G#5", 6: "B5", 7: "D6" },
];

const DAUER = {
  kick: 0.22, snare: 0.16, hat: 0.055, crash: 0.55, bordkanone: 0.38, bass: 0.24, brass: 0.28, choir: 1.1,
  lead: 0.22, lead_hoch: 0.18, zupf: 0.20, steel: 0.17, panik_arp: 0.09, alarm: 0.32,
};

const EFFEKTE = {
  schuss: [0.11, 180, 70, 0.75, 0.55],
  platz: [0.09, 620, 180, 0.15, 0.45],
  treffer: [0.22, 150, 50, 0.7, 0.9],
  abprall: [0.16, 1250, 1500, 0.0, 0.5],
  blase: [0.07, 500, 1000, 0.0, 0.3],
  boom: [0.7, 110, 30, 0.9, 1.0],
  frost: [0.55, 1800, 500, 0.35, 0.5],
  wurf: [0.28, 300, 800, 0.2, 0.45],
  strahl: [0.8, 900, 300, 0.25, 0.7],
  truhe: [0.6, 500, 1500, 0.1, 0.7],
  muenze: [0.09, 2300, 3000, 0.0, 0.16],
};

function geraeusch_rechnen(dauer, start, ende, rauschen, staerke) {
  const n = Math.round(RATE_EFFEKTE * dauer), d = new Float32Array(n), pegel = EFFEKT_LAUTSTAERKE * staerke;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const a = i / n;
    phase += (start + (ende - start) * a) / RATE_EFFEKTE;
    const ton = phase % 1 < 0.5 ? 1 : -1;
    d[i] = pegel * ((1 - rauschen) * ton + rauschen * zufall(-1, 1)) * (1 - a) ** 1.5;
  }
  return d;
}

function note_midi(note) {
  return 12 * (Number(note[note.length - 1]) + 1) + HALBTON[note.slice(0, -1)];
}

function transponieren(note, halbtoene) {
  const midi = note_midi(note) + halbtoene;
  const namen = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
  return namen[midi % 12] + (Math.floor(midi / 12) - 1);
}

function klang_rechnen(art, note) {
  const dauer = DAUER[art], rate = RATE_EFFEKTE, n = Math.floor(rate * dauer), d = new Float32Array(n), tau = Math.PI * 2;
  const hz = note ? 440 * 2 ** ((note_midi(note) - 69) / 12) : 110;
  let phase = 0, rausch = 0.3719, filter = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    rausch = (rausch * 1664525 + 1013904223) % 4294967296;
    const noise = rausch / 2147483648 - 1;
    const rein = Math.min(1, t / 0.004), raus = Math.min(1, (dauer - t) / 0.025), w = tau * hz * t;
    let sig;
    if (art === "kick") {
      // Trockene Holzdeck-Stampfpauke
      phase += tau * (42 + 210 * Math.exp(-t * 44)) / rate;
      sig = 0.92 * Math.sin(phase) * Math.exp(-t * 16) + 0.25 * noise * Math.exp(-t * 120);
    } else if (art === "snare") {
      // Schnarrende Marine-Trommel
      phase += tau * (185 + 90 * Math.exp(-t * 40)) / rate;
      sig = 0.42 * Math.sin(phase) * Math.exp(-t * 26) + (noise - filter) * 0.68 * Math.exp(-t * 19);
      filter = noise;
    } else if (art === "hat") {
      // Metallischer Saebel-Klick
      sig = (noise - filter) * 0.45 * Math.exp(-t * 80);
      filter = noise;
    } else if (art === "crash") {
      // Meeresgischt
      sig = (noise - filter * 0.7) * 0.32 * Math.exp(-t * 6);
      filter = noise;
    } else if (art === "bordkanone") {
      // Tiefer Kanonen-Impact auf die Eins bei Bosskaempfen
      phase += tau * (34 + 95 * Math.exp(-t * 22)) / rate;
      sig = Math.tanh(1.8 * (0.8 * Math.sin(phase) + 0.5 * noise * Math.exp(-t * 18))) * Math.exp(-t * 9.5);
    } else if (art === "bass") {
      // Saegezahn-Kielbass mit Sub-Oktave und Tiefpass, der sich schliesst
      const roh = 0.6 * (2 * ((hz * t) % 1) - 1) + 0.55 * Math.sin(w * 0.5);
      filter += (0.12 + 0.55 * Math.exp(-t * 14)) * (roh - filter);
      sig = Math.tanh(2.1 * filter) * Math.exp(-t * 3.5);
    } else if (art === "lead" || art === "lead_hoch") {
      // Chiptune-Schifferklavier
      const f = hz * (1 + (t > 0.04 ? 0.004 * Math.sin(tau * 6.8 * t) : 0));
      const puls25 = (f * t) % 1 < 0.25 ? 0.85 : -0.35, puls50 = (f * 1.0045 * t) % 1 < 0.5 ? 0.65 : -0.65;
      filter += 0.42 * (0.55 * puls25 + 0.45 * puls50 - filter);
      sig = filter * Math.exp(-t * (art === "lead_hoch" ? 4.2 : 2.8));
    } else if (art === "zupf") {
      // Kiel-Harfe
      const zupf = Math.sin(w) + 0.6 * Math.sin(2 * w) + 0.35 * Math.sin(3 * w) + 0.2 * Math.sin(4 * w);
      sig = 0.52 * zupf * Math.exp(-t * 10.5) + noise * 0.35 * Math.exp(-t * 140);
    } else if (art === "steel") {
      // Karibische Steeldrum
      const mod = 1.9 * Math.exp(-t * 28) * Math.sin(w * 2.98);
      sig = (0.75 * Math.sin(w + mod) + 0.25 * Math.sin(w * 2)) * Math.exp(-t * 13);
    } else if (art === "brass") {
      // Blechblaeser mit kurzem Lippen-Slur
      const b = tau * hz * (1 - 0.035 * Math.exp(-t * 75)) * t;
      sig = (0.55 * Math.sin(b) + 0.4 * Math.sin(2 * b) + 0.28 * Math.sin(3 * b) + 0.18 * Math.sin(4 * b)) * Math.min(1, t / 0.015) * Math.exp(-t * 4.8);
    } else if (art === "choir") {
      // Geisterschiff-Pad
      const w2 = tau * hz * (1 + 0.003 * Math.sin(tau * 5.2 * t)) * t;
      sig = (0.45 * Math.sin(w) + 0.45 * Math.sin(w2) + 0.2 * Math.sin(w * 1.5)) * Math.min(1, t / 0.09) * Math.exp(-t * 1.4);
    } else if (art === "panik_arp") {
      // Messerscharfes Todesangst-Arpeggio
      sig = ((hz * t) % 1 < 0.125 ? 0.8 : -0.25) * Math.exp(-t * 18);
    } else {
      // Schiffsglocke in Seenot
      sig = 0.65 * Math.sin(w + 2.2 * Math.sin(w * 2.76)) * Math.exp(-t * 5);
    }
    d[i] = begrenzen(sig * rein * Math.max(0, raus) * 0.72, -1, 1);
  }
  return d;
}

function thema_rechnen(frequenzen, dauern) {
  let gesamt = 0;
  const laengen = dauern.map((ms) => { const n = Math.max(1, Math.round(RATE_THEMA * ms / 1000)); gesamt += n; return n; });
  const d = new Float32Array(gesamt);
  let pos = 0;
  frequenzen.forEach((hz, nr) => {
    const n = laengen[nr];
    if (hz > 0) {
      const periode = RATE_THEMA / hz, blende = Math.max(1, Math.min(Math.round(RATE_THEMA * 0.001), n >> 1));
      for (let i = 0; i < n; i++) {
        const huelle = Math.min(1, i / blende, (n - 1 - i) / blende);
        d[pos + i] = ((i % periode) < periode / 2 ? MUSIK_LAUTSTAERKE : -MUSIK_LAUTSTAERKE) * huelle;
      }
    }
    pos += n;
  });
  return d;
}

class Klaenge {
  constructor() {
    this.kontext = null;
    this.stumm = false;
    this.musik_laut = 0.8;      // 0 bis 1, beide unabhaengig voneinander
    this.geraeusche_laut = 0.8;
    this.roh = {};              // Float32-Daten, solange iOS noch keinen Ton erlaubt
    this.puffer = {};
    this.thema_quelle = null;
    this.thema_soll = false;
    try {
      const m = parseFloat(localStorage.getItem("musik")), g = parseFloat(localStorage.getItem("geraeusche"));
      if (m >= 0 && m <= 1) this.musik_laut = m;
      if (g >= 0 && g <= 1) this.geraeusche_laut = g;
    } catch (e) { /* ohne Speicher gelten die Startwerte */ }
  }

  stimme_rechnen(art, note) {
    const name = note ? `m/${art}/${note}` : "m/" + art;
    if (!this.roh[name]) this.roh[name] = [klang_rechnen(art, note), RATE_EFFEKTE];
  }

  vorbereiten(tonfolge) {
    for (const [name, w] of Object.entries(EFFEKTE)) this.roh["e/" + name] = [geraeusch_rechnen(...w), RATE_EFFEKTE];
    for (const art of ["kick", "snare", "hat", "crash", "bordkanone"]) this.stimme_rechnen(art);
    for (const [grund, wechsel, akk] of SCORE_HARMONIE) {
      this.stimme_rechnen("bass", grund);
      this.stimme_rechnen("bass", wechsel);
      for (const n of akk) {
        this.stimme_rechnen("brass", n);
        this.stimme_rechnen("choir", n);
        this.stimme_rechnen("panik_arp", transponieren(n, 12));
      }
    }
    for (const takt of SCORE_MELODIE) {
      for (const n of werte(takt)) {
        this.stimme_rechnen("lead", n);
        this.stimme_rechnen("lead_hoch", transponieren(n, 12));
      }
    }
    for (const takt of SCORE_KONTER) {
      for (const n of werte(takt)) {
        this.stimme_rechnen("zupf", n);
        this.stimme_rechnen("steel", n);
      }
    }
    for (const n of ["A5", "D#5", "E5"]) this.stimme_rechnen("alarm", n);
    if (tonfolge) this.roh.thema = [thema_rechnen(tonfolge.frequenzen_hz, tonfolge.dauern_ms), RATE_THEMA];
    if (this.kontext) this.puffer_bauen();
  }

  puffer_bauen() {
    for (const [name, [daten, rate]] of Object.entries(this.roh)) {
      if (this.puffer[name]) continue;
      const b = this.kontext.createBuffer(1, daten.length, rate);
      b.copyToChannel(daten, 0);
      this.puffer[name] = b;
    }
    this.thema_pruefen();
  }

  starten() {
    if (this.kontext) return;
    const Klasse = window.AudioContext || window.webkitAudioContext;
    if (!Klasse) return;
    // Spiel-Ton statt Klingelton: So bleibt er auch im Lautlos-Modus hoerbar (neuere iPads und iPhones).
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* aeltere Geraete */ }
    this.kontext = new Klasse();
    this.musik = this.kontext.createGain();
    this.geraeusche = this.kontext.createGain();
    this.regler();
    this.musik.connect(this.kontext.destination);
    this.geraeusche.connect(this.kontext.destination);
    this.puffer_bauen();
  }

  wecken() {
    this.starten();
    if (!this.kontext || this.kontext.state === "running") return;
    this.kontext.resume().catch(() => {});
    // iOS gibt den Ton erst frei, wenn waehrend einer Beruehrung wirklich etwas abgespielt wird.
    const still = this.kontext.createBufferSource();
    still.buffer = this.kontext.createBuffer(1, 1, 22050);
    still.connect(this.kontext.destination);
    still.start(0);
  }

  // 80 % auf dem Regler ist genau die Lautstaerke der PC-Fassung.
  regler() {
    if (this.musik) this.musik.gain.value = this.stumm ? 0 : this.musik_laut * 1.25;
    if (this.geraeusche) this.geraeusche.gain.value = this.stumm ? 0 : this.geraeusche_laut * 1.25;
  }

  merken() {
    try {
      localStorage.setItem("musik", String(this.musik_laut));
      localStorage.setItem("geraeusche", String(this.geraeusche_laut));
    } catch (e) { /* dann nur fuer diese Runde */ }
  }

  stumm_umschalten() {
    this.stumm = !this.stumm;
    this.regler();
  }

  spiele(name) {
    const b = this.puffer["e/" + name];
    if (!b || this.kontext.state !== "running") return;
    const q = this.kontext.createBufferSource();
    q.buffer = b;
    q.connect(this.geraeusche);
    q.start();
  }

  stimme(art, note, wann, pegel) {
    const b = this.puffer[note ? `m/${art}/${note}` : "m/" + art];
    if (!b) return;
    const q = this.kontext.createBufferSource(), g = this.kontext.createGain();
    q.buffer = b;
    g.gain.value = begrenzen(pegel, 0, 1);
    q.connect(g);
    g.connect(this.musik);
    q.start(wann);
  }

  // Monkey Island laeuft im Menue und am Spielende, im Kampf Geminis Theme.
  thema(an) {
    this.thema_soll = an;
    this.thema_pruefen();
  }

  thema_pruefen() {
    if (!this.kontext) return;
    if (this.thema_soll && !this.thema_quelle && this.puffer.thema) {
      const q = this.kontext.createBufferSource();
      q.buffer = this.puffer.thema;
      q.loop = true;
      q.connect(this.musik);
      q.start();
      this.thema_quelle = q;
    } else if (!this.thema_soll && this.thema_quelle) {
      this.thema_quelle.stop();
      this.thema_quelle = null;
    }
  }

  anhalten() { if (this.kontext) this.kontext.suspend().catch(() => {}); }
}

// Geminis "Der Fluch der Token-Karibik": folgt Spieltempo, Bossen, Ultis, Bananen und Flash-Lite.
class Kampfmusik {
  constructor(klaenge) {
    this.klaenge = klaenge;
    this.bpm = 152;
    this.schritt = 0;
    this.laeuft = false;
    this.naechster = 0;
    this.tempo_faktor = 1;
    this.gefahr = this.panik = this.boss_aktiv = this.ulti_aktiv = this.unter_wasser = false;
  }

  spiele(art, note, pegel, wann) {
    // Bei Flash-Lite wird alles dumpfer und leiser.
    if (this.unter_wasser) {
      if (art === "hat" || art === "panik_arp" || art === "lead_hoch") return;
      pegel *= 0.42;
    }
    this.klaenge.stimme(art, note, wann, pegel);
  }

  takt(wann) {
    const s = this.schritt % 16, takt = Math.floor(this.schritt / 16) % 16, akt = Math.floor(takt / 4);
    const [grund, wechsel, akk] = SCORE_HARMONIE[takt];
    const action = this.tempo_faktor > 1.25 || this.boss_aktiv || this.ulti_aktiv;
    const bei = (...w) => w.includes(s);
    const sp = (art, note, pegel) => this.spiele(art, note, pegel, wann);

    // Piraten-Galopp und Kanonendonner
    if (takt === 15) {
      // Takt 16: Trommelwirbel zurueck in Takt 1
      if (s % 2 === 0) sp("kick", null, 0.42);
      sp("snare", null, 0.16 + 0.02 * s);
      if (bei(0, 8, 12, 15)) sp("crash", null, 0.22);
    } else {
      if (bei(0, 6, 8, 12) || (action && bei(3, 14)) || (this.panik && s % 2 === 0)) sp("kick", null, 0.44);
      if (s === 0 && (this.boss_aktiv || this.ulti_aktiv || akt === 3)) sp("bordkanone", null, 0.35);
      if (bei(4, 12) || (bei(7, 15) && (action || akt === 1 || akt === 3)) || (this.panik && bei(2, 10, 14))) sp("snare", null, bei(4, 12) ? 0.30 : 0.21);
      if (bei(0, 2, 3, 4, 6, 8, 10, 11, 12, 14) || this.panik) sp("hat", null, s % 2 === 0 ? 0.14 : 0.09);
      if (s === 0 && takt % 4 === 0) sp("crash", null, 0.20);
    }

    // Rollender Wechselbass
    if (bei(0, 3, 8, 11)) sp("bass", grund, 0.34);
    else if (bei(6, 14)) sp("bass", wechsel, 0.31);
    else if ((action || this.gefahr || akt === 3) && bei(2, 4, 10, 12, 15)) sp("bass", bei(4, 12) ? wechsel : grund, 0.24);

    // Breitseiten-Brass, Geisterchor und Gegenstimme
    if (akt !== 2 && bei(0, 6, 8, 12) && (s === 0 || action || akt === 1 || akt === 3)) {
      sp("brass", akk[0], 0.17);
      sp("brass", akk[2], 0.17);
      if (this.boss_aktiv || this.ulti_aktiv || akt === 3) sp("brass", akk[1], 0.15);
    }
    if (s === 0 && (akt === 2 || akt === 3 || this.gefahr || this.boss_aktiv)) {
      sp("choir", akk[0], 0.18);
      sp("choir", akk[1], 0.15);
    }
    const konter = SCORE_KONTER[takt][s];
    if (konter) sp(akt === 2 ? "steel" : "zupf", konter, akt === 2 ? 0.22 : 0.19);

    // Hauptmelodie; im Kampf und im 4. Akt doppelt sie eine hohe Oktave
    const note = SCORE_MELODIE[takt][s];
    if (note) {
      sp("lead", note, 0.26);
      if (this.boss_aktiv || this.ulti_aktiv || this.panik || akt === 3) sp("lead_hoch", transponieren(note, 12), 0.15);
    }

    // Todesangst: Panik-Arpeggio und Schiffsglocke
    if (this.panik) {
      sp("panik_arp", transponieren(akk[s % 3], 12), 0.15);
      if (bei(2, 10)) sp("alarm", s === 2 ? "A5" : "D#5", 0.18);
    } else if (this.gefahr && s === 14 && takt % 2 === 1) {
      sp("alarm", "E5", 0.13);
    }
    this.schritt++;
  }

  update(dt, spiel) {
    const kontext = this.klaenge.kontext;
    if (spiel.zustand !== "spiel") {
      this.laeuft = false;
      this.schritt = 0;
      return;
    }
    if (!kontext || kontext.state !== "running") return;
    const leben = spiel.bananen.reduce((s, b) => s + Math.max(0, 3 - b), 0) / Math.max(1, spiel.bananen.length * 3);
    this.panik = leben <= 0.25;
    this.gefahr = leben <= 0.5;
    this.boss_aktiv = spiel.events.size > 0;
    this.ulti_aktiv = !!spiel.ulti;
    this.unter_wasser = spiel.flash_lite > 0;
    this.tempo_faktor = Math.max(1, spiel.tempo);

    let ziel = 152 + 58 * (this.tempo_faktor - 1);
    if (this.panik) ziel += 30;
    else if (this.gefahr) ziel += 14;
    if (this.boss_aktiv || this.ulti_aktiv) ziel += 10;
    if (this.unter_wasser) ziel *= 0.78;
    ziel = begrenzen(ziel, 110, 265);
    this.bpm += (ziel - this.bpm) * Math.min(1, dt * 3.5);

    const jetzt = kontext.currentTime;
    if (!this.laeuft || this.naechster < jetzt) {
      this.laeuft = true;
      this.naechster = jetzt + 0.03;
    }
    // Etwas vorausplanen, damit die Musik auch bei Rucklern im Takt bleibt.
    while (this.naechster < jetzt + 0.12) {
      this.takt(this.naechster);
      this.naechster += 60 / this.bpm / 4;
    }
  }
}
