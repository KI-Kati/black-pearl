"use strict";
// Alle Toene werden selbst erzeugt: Effekte, Monkey-Island-Melodie und die Hoellenmusik von ChatGPT.
// Berechnet wird schon beim Laden; iOS gibt den Ton aber erst nach der ersten Beruehrung frei.

const RATE_EFFEKTE = 32000, RATE_THEMA = 22050;

const TON = { C: 0, "C#": 1, D: 2, Eb: 3, E: 4, F: 5, "F#": 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };

// D-Moll, mit finsterem Eb-Reibungston und A-Dur-Kadenz.
const AKKORDE = [
  ["D2", ["D3", "F3", "A3"]],
  ["Eb2", ["Eb3", "G3", "Bb3"]],
  ["Bb1", ["Bb2", "D3", "F3"]],
  ["A1", ["A2", "C#3", "E3"]],
  ["G1", ["G2", "Bb2", "D3"]],
  ["Eb2", ["Eb3", "G3", "Bb3"]],
  ["Bb1", ["Bb2", "D3", "F3"]],
  ["A1", ["A2", "C#3", "E3"]],
];

// Index = Sechzehntelschritt.
const RIFFS = [
  { 0: "D5", 2: "Eb5", 3: "D5", 6: "A4", 8: "D5", 10: "F5", 12: "Eb5", 14: "D5" },
  { 0: "Eb5", 3: "G5", 4: "F5", 7: "Eb5", 8: "Bb4", 10: "D5", 12: "Eb5", 15: "D5" },
  { 0: "F5", 2: "D5", 4: "Bb4", 6: "D5", 8: "F5", 11: "Ab5", 12: "F5", 14: "D5" },
  { 0: "E5", 2: "C#5", 4: "A4", 7: "C#5", 8: "E5", 10: "G5", 12: "E5", 15: "C#5" },
  { 0: "D5", 1: "F5", 4: "A5", 6: "Eb5", 8: "D5", 10: "F5", 12: "A5", 14: "C6" },
  { 0: "Bb5", 3: "G5", 4: "Eb5", 7: "G5", 8: "F5", 10: "Eb5", 12: "D5", 15: "Eb5" },
  { 0: "F5", 2: "Bb5", 4: "A5", 7: "F5", 8: "D5", 10: "F5", 12: "Bb5", 14: "A5" },
  { 0: "G5", 2: "E5", 4: "C#5", 6: "E5", 8: "G5", 10: "Bb5", 12: "A5", 14: "C#6" },
];
const LAUT = { kick: .55, snare: .34, hat: .18, crash: .24, bass: .37, brass: .25, lead: .26, choir: .21, alarm: .16 };
const DAUER = { kick: .29, snare: .20, hat: .085, crash: .65, bass: .32, brass: .33, lead: .26, choir: 1.4, alarm: .42 };
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

function frequenz(note) {
  const midi = 12 * (Number(note[note.length - 1]) + 1) + TON[note.slice(0, -1)];
  return 440 * 2 ** ((midi - 69) / 12);
}

function klang_rechnen(art, note) {
  const dauer = DAUER[art], n = Math.floor(RATE_EFFEKTE * dauer), d = new Float32Array(n), tau = Math.PI * 2;
  const hz = note ? frequenz(note) : 0;
  let phase = 0, letztes = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE_EFFEKTE, r = zufall(-1, 1), hoch = r - letztes;
    letztes = r;
    const attack = Math.min(1, t / .008), release = Math.min(1, (dauer - t) / .035), ph = tau * hz * t;
    let x;
    if (art === "kick") {
      phase += tau * (47 + 175 * Math.exp(-t * 35)) / RATE_EFFEKTE;
      x = .88 * Math.sin(phase) * Math.exp(-t * 17) + r * .11 * Math.exp(-t * 105);
    } else if (art === "snare") {
      x = (hoch * .58 + .23 * Math.sin(tau * 190 * t)) * Math.exp(-t * 22);
    } else if (art === "hat") {
      x = hoch * .5 * Math.exp(-t * 65);
    } else if (art === "crash") {
      x = hoch * .29 * Math.exp(-t * 6);
    } else if (art === "bass") {
      const wobble = .2 * Math.sin(tau * 31 * t) * Math.exp(-t * 15);
      x = Math.tanh(2 * (Math.sin(ph + wobble) + .38 * Math.sin(2 * ph))) * Math.exp(-t * 3);
    } else if (art === "brass") {
      x = 0;
      for (let k = 1; k < 7; k++) x += Math.sin(k * ph) / k;
      x *= .55 * Math.exp(-t * 5);
    } else if (art === "choir") {
      x = (.44 * Math.sin(ph * .995) + .44 * Math.sin(ph * 1.005) + .2 * Math.sin(2 * ph) + .12 * Math.sin(3 * ph))
        * Math.min(1, t / .12) * (.85 + .15 * Math.sin(tau * 3 * t));
    } else if (art === "alarm") {
      x = (.52 * Math.sin(ph + 2.1 * Math.sin(ph * .5)) + .3 * Math.sin(ph * 2.02)) * Math.exp(-t * 2);
    } else {
      x = (.58 * Math.sin(ph + 1.8 * Math.sin(2 * ph)) + .25 * Math.sin(3.01 * ph) + .1 * Math.sin(5 * ph)) * Math.exp(-t * 3);
    }
    d[i] = begrenzen(x * attack * Math.max(0, release) * .78, -1, 1);
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

  vorbereiten(tonfolge) {
    for (const [name, w] of Object.entries(EFFEKTE)) this.roh["e/" + name] = [geraeusch_rechnen(...w), RATE_EFFEKTE];
    for (const art of ["kick", "snare", "hat", "crash"]) this.roh["m/" + art] = [klang_rechnen(art), RATE_EFFEKTE];
    for (const [grund, akkord] of AKKORDE) {
      this.roh["m/bass/" + grund] = [klang_rechnen("bass", grund), RATE_EFFEKTE];
      for (const note of [akkord[0], akkord[2]]) {
        this.roh["m/brass/" + note] = [klang_rechnen("brass", note), RATE_EFFEKTE];
        this.roh["m/choir/" + note] = [klang_rechnen("choir", note), RATE_EFFEKTE];
      }
    }
    for (const riff of RIFFS) for (const note of werte(riff)) this.roh["m/lead/" + note] = [klang_rechnen("lead", note), RATE_EFFEKTE];
    for (const note of ["Eb5", "D5"]) this.roh["m/alarm/" + note] = [klang_rechnen("alarm", note), RATE_EFFEKTE];
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
    this.stimmen = {};
    for (const [art, laut] of Object.entries(LAUT)) {
      this.stimmen[art] = this.kontext.createGain();
      this.stimmen[art].gain.value = laut * .52;
      this.stimmen[art].connect(this.musik);
    }
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

  stimme(art, note, wann) {
    const b = this.puffer[note ? `m/${art}/${note}` : "m/" + art];
    if (!b) return;
    const q = this.kontext.createBufferSource();
    q.buffer = b;
    q.connect(this.stimmen[art]);
    q.start(wann);
  }

  // Monkey Island laeuft im Menue und am Spielende, im Kampf die Hoellenmusik.
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

// Echtzeit-Musik, die sich an Spieltempo, Bossen und Bananen orientiert.
class Hoellenmusik {
  constructor(klaenge) {
    this.klaenge = klaenge;
    this.bpm = 176;
    this.schritt = 0;
    this.laeuft = false;
    this.naechster = 0;
    this.kritisch = this.gefahr = this.boss = false;
    this.druck = 1;
  }

  takt(wann) {
    const k = this.klaenge, i = this.schritt % 16, takt = Math.floor(this.schritt / 16) % 8;
    const [grund, akkord] = AKKORDE[takt];
    const intensiv = this.druck > 1.32 || this.boss;
    const in_ = (...w) => w.includes(i);
    if (in_(0, 4, 8, 12) || (intensiv && in_(3, 10, 14))) k.stimme("kick", null, wann);
    if (in_(4, 12) || (this.kritisch && in_(7, 15))) k.stimme("snare", null, wann);
    if (i % 2 === 0 || (intensiv && in_(3, 7, 11, 15)) || (this.kritisch && i % 2)) k.stimme("hat", null, wann);
    if (in_(0, 3, 6, 8, 11, 14)) k.stimme("bass", grund, wann);
    if (in_(0, 8) && (intensiv || takt % 2 === 0)) {
      k.stimme("brass", akkord[0], wann);
      k.stimme("brass", akkord[2], wann);
    }
    if (i === 0) {
      k.stimme("choir", akkord[0], wann);
      if (this.boss || this.gefahr) k.stimme("choir", akkord[2], wann);
    }
    if (RIFFS[takt][i]) k.stimme("lead", RIFFS[takt][i], wann);
    if (i === 0 && (takt === 0 || takt === 4)) k.stimme("crash", null, wann);
    if (this.kritisch && in_(2, 10)) k.stimme("alarm", i === 2 ? "Eb5" : "D5", wann);
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
    const leben = spiel.bananen.reduce((s, b) => s + Math.max(0, 3 - b), 0) / (spiel.bananen.length * 3);
    this.kritisch = leben <= .25;
    this.gefahr = leben <= .5;
    this.boss = spiel.events.size > 0;
    this.druck = Math.max(1, spiel.tempo);
    const soll = Math.min(270, 176 + 57 * (this.druck - 1) + (this.kritisch ? 26 : this.gefahr ? 10 : 0));
    this.bpm += (soll - this.bpm) * Math.min(1, dt * 2.5);
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
