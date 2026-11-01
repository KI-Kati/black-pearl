"use strict";
// Probe fuer Handy und iPad: Fahren, Knoepfe, Ton, Pause. Die Werte stammen aus piratenspiel.py.

// ---------------------------------------------------------------- EINSTELLUNGEN
const VERSION = "Probe 1";
const BREITE = 1200, HOEHE = 800;
const HUD_OBEN = 64, HUD_UNTEN = 56;
const SCHIFF_BREITE = 150, SCHIFF_TEMPO = 430, SCHIFF_Y = HOEHE - HUD_UNTEN - 60;
const SCHUSS_ABSTAND = 0.16, KUGEL_TEMPO = 900;
const Q_SCHWENK = 2.0, Q_ZIELZEIT = 20, Q_ZIEL_Y = 130, Q_ZIEL_RAND = 55, BUMERANG_TEMPO = 720;
const Q_MUENZEN = 5;       // so viele Muenzen laden den Bumerang
const E_LADEZEIT = 10;     // Sekunden, bis der Affe bereit ist
const AFFE_DAUER = 2.6;
const MUENZ_ABSTAND = 1.1, MUENZ_TEMPO = 240;
const LAST_MUENZEN = 200;  // Belastungstest

const leinwand = document.getElementById("feld");
const stift = leinwand.getContext("2d");
const bilder = {};
const NAMEN = ["meer.jpg", "schiff_links.png", "schiff_rechts.png", "affe.png", "bumerang.png"];

const begrenzen = (w, a, b) => Math.max(a, Math.min(b, w));
const zufall = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- ZUSTAND
let zustand = "laden";     // laden, start, spiel
let pausiert = false;
let musik_laut = 0.8;       // 0 bis 1, beide unabhaengig voneinander
let geraeusche_laut = 0.8;
let stumm = false;          // Taste M am PC
let last = false;
let x, ziel, blick, schuss_warten, kugeln, muenzen, muenz_warten, punkte, q_ladung, e_ladung;
let zielen, schwenk, schwenk_start, bumerang, affe, scheibe, funken, meldung;
let zeit = 0, fps = 60;
try {
  const m = parseFloat(localStorage.getItem("musik")), g = parseFloat(localStorage.getItem("geraeusche"));
  if (m >= 0 && m <= 1) musik_laut = m;
  if (g >= 0 && g <= 1) geraeusche_laut = g;
} catch (e) { /* ohne Speicher gelten die Startwerte */ }

function neu_starten() {
  x = ziel = BREITE / 2;
  blick = 1;
  schuss_warten = 0;
  kugeln = [];
  muenzen = [];
  muenz_warten = 0.5;
  punkte = 0;
  q_ladung = 0;
  e_ladung = 0;
  zielen = 0;
  schwenk = 0;
  schwenk_start = 0;
  bumerang = null;
  affe = null;
  scheibe = { x: BREITE / 2, phase: 0, blitz: 0 };
  funken = [];
  meldung = null;
}
neu_starten();

function melden(text, dauer = 1.6) {
  meldung = { text, zeit: dauer };
}

// ---------------------------------------------------------------- AUFTEILUNG DES BILDSCHIRMS
// Das Feld bleibt auf jedem Geraet 3:2, damit das Spiel ueberall gleich schwer ist.
const auf = { W: 1, H: 1, s: 1, ox: 0, oy: 0, modus: "unten", knoepfe: [] };

function aufteilen() {
  const W = window.innerWidth, H = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  leinwand.width = Math.round(W * dpr);
  leinwand.height = Math.round(H * dpr);
  stift.setTransform(dpr, 0, 0, dpr, 0, 0);

  const stil = getComputedStyle(document.getElementById("rand"));
  const rand = {
    l: parseFloat(stil.paddingLeft) || 0, r: parseFloat(stil.paddingRight) || 0,
    u: parseFloat(stil.paddingBottom) || 0,
  };
  const s = Math.min(W / BREITE, H / HOEHE);
  const ox = (W - BREITE * s) / 2;
  const links_frei = ox - rand.l, rechts_frei = ox - rand.r;
  const modus = Math.min(links_frei, rechts_frei) >= 56 ? "seite" : "unten";
  const oy = modus === "seite" ? (H - HOEHE * s) / 2 : 0;
  Object.assign(auf, { W, H, s, ox, oy, modus });

  if (modus === "seite") {
    // Handy: Bumerang und Affe im linken Streifen, Menue im rechten.
    const g = begrenzen(Math.min(links_frei, rechts_frei) - 12, 44, 92);
    const unten = H - rand.u - 8;
    const lx = rand.l + (links_frei - g) / 2, rx = W - rand.r - (rechts_frei + g) / 2;
    auf.knoepfe = [
      { name: "q", x: lx, y: unten - g * 2 - 10, g },
      { name: "e", x: lx, y: unten - g, g },
      { name: "menue", x: rx, y: unten - g, g },
    ];
  } else {
    // iPad: alle Knoepfe in der unteren Leiste, dort stand am PC die Steuerungshilfe.
    const leiste = H - (oy + (HOEHE - HUD_UNTEN) * s);
    const g = begrenzen(leiste - rand.u - 10, 44, 84);
    const y = H - rand.u - 5 - g;
    const lx = rand.l + 16;
    auf.knoepfe = [
      { name: "q", x: lx, y, g },
      { name: "e", x: lx + g + 14, y, g },
      { name: "menue", x: W - rand.r - 16 - g, y, g },
    ];
  }
}

const fx = (w) => auf.ox + w * auf.s;
const fy = (w) => auf.oy + w * auf.s;

function knopf_bei(px, py) {
  return auf.knoepfe.find((k) => px >= k.x - 6 && px <= k.x + k.g + 6 && py >= k.y - 6 && py <= k.y + k.g + 6);
}

const ist_hochkant = () => auf.H > auf.W;

// Pause-Menue: fuenf gleich grosse Felder in der Mitte
function menue_felder() {
  const h = begrenzen(auf.H * 0.115, 40, 62), b = Math.min(340, auf.W * 0.6), luecke = h * 0.2;
  const y0 = auf.H / 2 - (5 * h + 4 * luecke) / 2 + h * 0.45;
  return [
    { name: "weiter", text: "Weiter" },
    { name: "neu", text: "Neu starten" },
    { name: "musik", regler: true, text: "Musik", wert: () => musik_laut },
    { name: "geraeusche", regler: true, text: "Geräusche", wert: () => geraeusche_laut },
    { name: "last", text: () => (last ? "Belastungstest: an" : "Belastungstest: aus") },
  ].map((f, i) => ({ ...f, x: (auf.W - b) / 2, y: y0 + i * (h + luecke), b, h }));
}

// ---------------------------------------------------------------- TON
// Alles wird selbst erzeugt; iOS erlaubt das erst nach der ersten Beruehrung.
const ton = { kontext: null, musik: null, geraeusche: null, effekte: {}, naechster: 0, schritt: 0 };

function puffer(dauer, welle) {
  const n = Math.floor(ton.kontext.sampleRate * dauer);
  const b = ton.kontext.createBuffer(1, n, ton.kontext.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = welle(i / ton.kontext.sampleRate, i / n);
  return b;
}

function ton_starten() {
  if (ton.kontext) return;
  const Klasse = window.AudioContext || window.webkitAudioContext;
  if (!Klasse) return;
  ton.kontext = new Klasse();
  ton.musik = ton.kontext.createGain();
  ton.geraeusche = ton.kontext.createGain();
  ton_regler();
  ton.musik.connect(ton.kontext.destination);
  ton.geraeusche.connect(ton.kontext.destination);
  const pi2 = Math.PI * 2;
  ton.effekte = {
    schuss: puffer(0.11, (t, a) => (Math.sin(pi2 * (180 - 110 * a) * t) * 0.6 + (Math.random() * 2 - 1) * 0.4) * (1 - a) * (1 - a) * 0.5),
    muenze: puffer(0.2, (t, a) => Math.sin(pi2 * (a < 0.35 ? 988 : 1319) * t) * (1 - a) * 0.4),
    bumerang: puffer(0.35, (t, a) => Math.sin(pi2 * (300 + 500 * a) * t) * Math.sin(Math.PI * a) * 0.4),
    affe: puffer(0.5, (t, a) => Math.sin(pi2 * (500 + 300 * Math.sin(a * 18)) * t) * (1 - a) * 0.4),
    klick: puffer(0.05, (t, a) => Math.sin(pi2 * 660 * t) * (1 - a) * 0.3),
  };
}

function ton_wecken() {
  ton_starten();
  if (ton.kontext && ton.kontext.state !== "running") ton.kontext.resume().catch(() => {});
}

function spiele(name) {
  if (!ton.kontext || ton.kontext.state !== "running" || !ton.effekte[name]) return;
  const q = ton.kontext.createBufferSource();
  q.buffer = ton.effekte[name];
  q.connect(ton.geraeusche);
  q.start();
}

// Eine kleine eigene Testmelodie, damit man Musik und Effekte zusammen hoert.
const BASS = [110, 110, 165, 110, 98, 98, 147, 98, 87, 87, 131, 87, 82, 82, 123, 82];
const OBEN = [440, 0, 523, 0, 392, 0, 494, 0, 349, 0, 440, 0, 330, 415, 494, 0];

function note(frequenz, wann, dauer, lautstaerke, art) {
  const o = ton.kontext.createOscillator(), g = ton.kontext.createGain();
  o.type = art;
  o.frequency.value = frequenz;
  g.gain.setValueAtTime(lautstaerke, wann);
  g.gain.exponentialRampToValueAtTime(0.001, wann + dauer);
  o.connect(g);
  g.connect(ton.musik);
  o.start(wann);
  o.stop(wann + dauer);
}

function musik_planen() {
  if (!ton.kontext || ton.kontext.state !== "running") return;
  const jetzt = ton.kontext.currentTime;
  if (ton.naechster < jetzt) ton.naechster = jetzt + 0.05;
  while (ton.naechster < jetzt + 0.25) {
    const i = ton.schritt % BASS.length;
    note(BASS[i], ton.naechster, 0.26, 0.13, "triangle");
    if (OBEN[i]) note(OBEN[i], ton.naechster, 0.24, 0.05, "square");
    ton.naechster += 0.22;
    ton.schritt++;
  }
}

function ton_regler() {
  if (ton.musik) ton.musik.gain.value = stumm ? 0 : musik_laut;
  if (ton.geraeusche) ton.geraeusche.gain.value = stumm ? 0 : geraeusche_laut;
}

function ton_merken() {
  try {
    localStorage.setItem("musik", String(musik_laut));
    localStorage.setItem("geraeusche", String(geraeusche_laut));
  } catch (e) { /* dann nur fuer diese Runde */ }
}

// Taste M am PC: alles stumm, die eingestellte Lautstaerke bleibt erhalten.
function ton_umschalten() {
  stumm = !stumm;
  ton_regler();
}

function regler_bahn(f) {
  return { x: f.x + f.b * 0.5, b: f.b * 0.5 - f.h * 0.4 };
}

function regler_setzen(name, px) {
  const f = menue_felder().find((m) => m.name === name), bahn = regler_bahn(f);
  const wert = Math.round(begrenzen((px - bahn.x) / bahn.b, 0, 1) * 20) / 20;
  if (name === "musik") musik_laut = wert;
  else geraeusche_laut = wert;
  stumm = false;
  ton_regler();
}

// ---------------------------------------------------------------- BILDSCHIRM WACH HALTEN
let wachhalter = null;
async function wach_halten() {
  try {
    if ("wakeLock" in navigator && !wachhalter && document.visibilityState === "visible") {
      wachhalter = await navigator.wakeLock.request("screen");
      wachhalter.addEventListener("release", () => { wachhalter = null; });
    }
  } catch (e) { /* nicht ueberall erlaubt; das Spiel laeuft trotzdem */ }
}

// ---------------------------------------------------------------- KNOEPFE
function ziel_winkel() {
  const hoehe = SCHIFF_Y - Q_ZIEL_Y;
  const rechts = Math.atan2(BREITE - Q_ZIEL_RAND - x, hoehe);
  const links = Math.atan2(x - Q_ZIEL_RAND, hoehe);
  return [(rechts - links) / 2, (rechts + links) / 2];
}

function ziel_punkt() {
  const [mitte, weite] = ziel_winkel();
  const winkel = mitte + weite * Math.sin(schwenk_start + schwenk * 2 * Math.PI / Q_SCHWENK);
  return x + Math.tan(winkel) * (SCHIFF_Y - Q_ZIEL_Y);
}

function bumerang_druecken() {
  if (zielen > 0) {
    bumerang = { x, y: SCHIFF_Y, zx: ziel_punkt(), zurueck: false, dreh: 0 };
    zielen = 0;
    q_ladung = 0;
    spiele("bumerang");
  } else if (q_ladung >= Q_MUENZEN && !bumerang) {
    zielen = Q_ZIELZEIT;
    schwenk = 0;
    const [mitte, weite] = ziel_winkel();
    schwenk_start = Math.asin(begrenzen(-mitte / weite, -1, 1));
    spiele("klick");
  } else if (!bumerang) {
    melden(`Bumerang: ${q_ladung}/${Q_MUENZEN} Münzen`);
  }
}

function affe_druecken() {
  if (e_ladung < E_LADEZEIT) {
    melden(`Affe lädt noch ${Math.ceil(E_LADEZEIT - e_ladung)} s`);
    return;
  }
  e_ladung = 0;
  affe = { zeit: 0 };
  spiele("affe");
  for (const m of muenzen) { punkte++; q_ladung = Math.min(Q_MUENZEN, q_ladung + 1); funkenwolke(m.x, m.y, 4); }
  muenzen = [];
}

function pause_setzen(an) {
  pausiert = an;
  if (!an) { fuehrung = null; ton_wecken(); }
}

function knopf_druecken(name) {
  if (name === "q") bumerang_druecken();
  else if (name === "e") affe_druecken();
  else if (name === "menue") { pause_setzen(true); spiele("klick"); }
}

function menue_waehlen(name) {
  spiele("klick");
  if (name === "weiter") pause_setzen(false);
  else if (name === "neu") { neu_starten(); pause_setzen(false); }
  else if (name === "last") { last = !last; if (!last) muenzen = muenzen.slice(0, 5); }
}

// ---------------------------------------------------------------- BERUEHRUNG UND MAUS
let fuehrung = null;          // der Finger, der gerade lenkt
const gedrueckt = new Set();  // Knoepfe, die gerade unter einem Finger liegen
const finger = new Map();
let regler_griff = null;      // der Finger auf einem Lautstaerke-Regler
let regler_gerade_los = false;

function menue_feld_bei(px, py) {
  return menue_felder().find((m) => px >= m.x && px <= m.x + m.b && py >= m.y && py <= m.y + m.h);
}

function lenken(px) {
  ziel = begrenzen((px - auf.ox) / auf.s, SCHIFF_BREITE / 2, BREITE - SCHIFF_BREITE / 2);
}

leinwand.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  try { leinwand.setPointerCapture(e.pointerId); } catch (f) { /* unkritisch */ }
  if (zustand === "spiel" && pausiert && !ist_hochkant()) {
    const f = menue_feld_bei(e.clientX, e.clientY);
    if (f && f.regler) {
      regler_griff = { id: e.pointerId, name: f.name };
      regler_setzen(f.name, e.clientX);
    }
    return;
  }
  if (zustand !== "spiel" || pausiert || ist_hochkant()) return;
  const k = knopf_bei(e.clientX, e.clientY);
  if (k) {
    finger.set(e.pointerId, k.name);
    gedrueckt.add(k.name);
    knopf_druecken(k.name);
  } else {
    fuehrung = e.pointerId;
    lenken(e.clientX);
  }
});

leinwand.addEventListener("pointermove", (e) => {
  if (regler_griff && e.pointerId === regler_griff.id) regler_setzen(regler_griff.name, e.clientX);
  else if (e.pointerId === fuehrung && zustand === "spiel" && !pausiert) lenken(e.clientX);
});

function finger_los(e) {
  if (regler_griff && e.pointerId === regler_griff.id) {
    // Beim Loslassen ein Probeklang, damit man die neue Lautstaerke der Geraeusche hoert.
    if (regler_griff.name === "geraeusche") spiele("muenze");
    regler_griff = null;
    ton_merken();
    regler_gerade_los = true;
  }
  if (e.pointerId === fuehrung) fuehrung = null;   // Das Ziel bleibt: Antippen heisst "fahr dorthin".
  const name = finger.get(e.pointerId);
  if (name) { finger.delete(e.pointerId); gedrueckt.delete(name); }
}
leinwand.addEventListener("pointercancel", finger_los);
leinwand.addEventListener("pointerup", (e) => {
  regler_gerade_los = false;
  finger_los(e);
  ton_wecken();
  if (ist_hochkant()) return;
  if (zustand === "start") {
    zustand = "spiel";
    wach_halten();
  } else if (zustand === "spiel" && pausiert && !regler_gerade_los) {
    const f = menue_feld_bei(e.clientX, e.clientY);
    if (f && !f.regler) menue_waehlen(f.name);
  }
});

for (const art of ["gesturestart", "gesturechange", "dblclick", "contextmenu"]) {
  document.addEventListener(art, (e) => e.preventDefault());
}
document.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

// Am PC bleibt die Tastatur erhalten.
const tasten = new Set();
window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  tasten.add(e.code);
  ton_wecken();
  if (zustand === "start") { zustand = "spiel"; wach_halten(); return; }
  if (zustand !== "spiel") return;
  if (e.code === "Space" || e.code === "Escape") pause_setzen(!pausiert);
  else if (e.code === "KeyM") ton_umschalten();
  else if (e.code === "F5") { e.preventDefault(); neu_starten(); }
  else if (!pausiert && e.code === "KeyQ") bumerang_druecken();
  else if (!pausiert && e.code === "KeyE") affe_druecken();
});
window.addEventListener("keyup", (e) => tasten.delete(e.code));

// App-Wechsel, Anruf, Sperre: sofort Pause und Ton anhalten.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    if (zustand === "spiel") pause_setzen(true);
    if (ton.kontext) ton.kontext.suspend().catch(() => {});
  } else {
    ton_wecken();
    wach_halten();
  }
});
window.addEventListener("pagehide", () => { if (zustand === "spiel") pause_setzen(true); });
window.addEventListener("resize", aufteilen);
window.addEventListener("orientationchange", () => setTimeout(aufteilen, 200));

// ---------------------------------------------------------------- SPIELLOGIK
function funkenwolke(wx, wy, n) {
  if (funken.length > 400) return;
  for (let i = 0; i < n; i++) {
    const w = zufall(0, Math.PI * 2), t = zufall(40, 220);
    funken.push({ x: wx, y: wy, vx: Math.cos(w) * t, vy: Math.sin(w) * t, zeit: zufall(0.3, 0.6) });
  }
}

function aktualisieren(dt) {
  // Tastatur uebersteuert das Ziel, Finger setzen es.
  const richtung_taste = (tasten.has("KeyD") || tasten.has("ArrowRight") ? 1 : 0) - (tasten.has("KeyA") || tasten.has("ArrowLeft") ? 1 : 0);
  if (richtung_taste) ziel = begrenzen(x + richtung_taste * 60, SCHIFF_BREITE / 2, BREITE - SCHIFF_BREITE / 2);
  const abstand = ziel - x, schritt = SCHIFF_TEMPO * dt;
  if (Math.abs(abstand) <= schritt) x = ziel;
  else x += Math.sign(abstand) * schritt;
  if (Math.abs(abstand) > 3) blick = Math.sign(abstand);

  schuss_warten -= dt;
  if (schuss_warten <= 0) {
    schuss_warten = SCHUSS_ABSTAND;
    kugeln.push({ x, y: SCHIFF_Y - 40 });
    spiele("schuss");
  }
  for (const k of kugeln) k.y -= KUGEL_TEMPO * dt;
  kugeln = kugeln.filter((k) => k.y > HUD_OBEN);

  muenz_warten -= dt;
  if (muenz_warten <= 0) {
    muenz_warten = MUENZ_ABSTAND;
    muenzen.push({ x: zufall(60, BREITE - 60), y: HUD_OBEN, frei: false });
  }
  while (last && muenzen.length < LAST_MUENZEN) {
    muenzen.push({ x: zufall(40, BREITE - 40), y: zufall(HUD_OBEN, SCHIFF_Y - 150), frei: true });
  }
  for (const m of muenzen) {
    m.y += MUENZ_TEMPO * dt;
    if (!m.frei && Math.abs(m.y - SCHIFF_Y) < 45 && Math.abs(m.x - x) < SCHIFF_BREITE / 2) {
      m.weg = true;
      punkte++;
      q_ladung = Math.min(Q_MUENZEN, q_ladung + 1);
      funkenwolke(m.x, m.y, 8);
      spiele("muenze");
    }
    if (m.frei && m.y > HOEHE - HUD_UNTEN) m.y = HUD_OBEN;
  }
  muenzen = muenzen.filter((m) => !m.weg && m.y < HOEHE - HUD_UNTEN);

  e_ladung = Math.min(E_LADEZEIT, e_ladung + dt);
  if (zielen > 0) {
    schwenk += dt;
    zielen -= dt;
    if (zielen <= 0) bumerang_druecken();
  }

  scheibe.phase += dt;
  scheibe.x = BREITE / 2 + Math.sin(scheibe.phase * 0.7) * 430;
  scheibe.blitz = Math.max(0, scheibe.blitz - dt);
  if (bumerang) {
    const b = bumerang;
    b.dreh += dt * 14;
    const zx = b.zurueck ? x : b.zx, zy = b.zurueck ? SCHIFF_Y : Q_ZIEL_Y;
    const dx = zx - b.x, dy = zy - b.y, d = Math.hypot(dx, dy), w = BUMERANG_TEMPO * dt;
    if (d <= w) {
      if (b.zurueck) bumerang = null;
      else {
        b.zurueck = true;
        if (Math.abs(b.x - scheibe.x) < 70) {
          punkte += 5;
          scheibe.blitz = 0.5;
          funkenwolke(scheibe.x, Q_ZIEL_Y, 30);
          melden("Treffer! +5");
          spiele("muenze");
        } else melden("Daneben!");
      }
    } else { b.x += dx / d * w; b.y += dy / d * w; }
  }

  if (affe) { affe.zeit += dt; if (affe.zeit > AFFE_DAUER) affe = null; }
  for (const f of funken) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 260 * dt; f.zeit -= dt; }
  funken = funken.filter((f) => f.zeit > 0);
  if (meldung) { meldung.zeit -= dt; if (meldung.zeit <= 0) meldung = null; }
}

// ---------------------------------------------------------------- ZEICHNEN
function text(t, tx, ty, groesse, farbe = "#fff", ausrichtung = "center") {
  stift.font = `700 ${groesse}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  stift.textAlign = ausrichtung;
  stift.textBaseline = "middle";
  stift.lineWidth = Math.max(2, groesse / 7);
  stift.strokeStyle = "rgba(5,12,20,.85)";
  stift.lineJoin = "round";
  stift.strokeText(t, tx, ty);
  stift.fillStyle = farbe;
  stift.fillText(t, tx, ty);
}

function rund(rx, ry, b, h, r) {
  stift.beginPath();
  if (stift.roundRect) stift.roundRect(rx, ry, b, h, r);   // aeltere iPads kennen das noch nicht
  else stift.rect(rx, ry, b, h);
}

function feld_zeichnen() {
  const s = auf.s;
  stift.fillStyle = "#0b1622";
  stift.fillRect(0, 0, auf.W, auf.H);
  stift.save();
  stift.beginPath();
  stift.rect(auf.ox, auf.oy, BREITE * s, HOEHE * s);
  stift.clip();
  stift.imageSmoothingEnabled = false;
  stift.drawImage(bilder["meer.jpg"], auf.ox, auf.oy, BREITE * s, HOEHE * s);

  // Zielscheibe fuer den Bumerang
  const sx = fx(scheibe.x), sy = fy(Q_ZIEL_Y), sr = 46 * s;
  for (const [r, farbe] of [[1, "#f4f1e4"], [0.7, "#c8342c"], [0.4, "#f4f1e4"], [0.16, scheibe.blitz > 0 ? "#ffe066" : "#c8342c"]]) {
    stift.beginPath();
    stift.arc(sx, sy, sr * r, 0, Math.PI * 2);
    stift.fillStyle = farbe;
    stift.fill();
  }

  stift.fillStyle = "#ffcf3f";
  stift.strokeStyle = "#8a5a10";
  stift.lineWidth = Math.max(1, 2 * s);
  stift.beginPath();
  for (const m of muenzen) {
    stift.moveTo(fx(m.x) + 13 * s, fy(m.y));
    stift.arc(fx(m.x), fy(m.y), 13 * s, 0, Math.PI * 2);
  }
  stift.fill();
  stift.stroke();

  // Fahrziel als kleine Markierung auf dem Wasser
  if (Math.abs(ziel - x) > 6) {
    stift.strokeStyle = "rgba(255,255,255,.8)";
    stift.lineWidth = Math.max(2, 3 * s);
    stift.beginPath();
    stift.ellipse(fx(ziel), fy(SCHIFF_Y + 50), 26 * s, 8 * s, 0, 0, Math.PI * 2);
    stift.stroke();
  }

  stift.fillStyle = "#1d1410";
  stift.beginPath();
  for (const k of kugeln) {
    stift.moveTo(fx(k.x) + 7 * s, fy(k.y));
    stift.arc(fx(k.x), fy(k.y), 7 * s, 0, Math.PI * 2);
  }
  stift.fill();
  stift.fillStyle = "#ffd070";
  stift.beginPath();
  for (const k of kugeln) {
    stift.moveTo(fx(k.x) + 3 * s, fy(k.y));
    stift.arc(fx(k.x), fy(k.y), 3 * s, 0, Math.PI * 2);
  }
  stift.fill();

  // Ziellinie des Bumerangs
  if (zielen > 0) {
    const zx = ziel_punkt();
    stift.strokeStyle = "#9fe8ff";
    stift.lineWidth = Math.max(2, 4 * s);
    stift.setLineDash([14 * s, 10 * s]);
    stift.beginPath();
    stift.moveTo(fx(x), fy(SCHIFF_Y - 30));
    stift.lineTo(fx(zx), fy(Q_ZIEL_Y));
    stift.stroke();
    stift.setLineDash([]);
    text("X", fx(zx), fy(Q_ZIEL_Y), Math.max(16, 40 * s), "#9fe8ff");
  }

  const bild = bilder[blick < 0 ? "schiff_links.png" : "schiff_rechts.png"];
  const sh = SCHIFF_BREITE * bild.height / bild.width;
  const wippen = Math.sin(zeit * 2.4) * 3;
  stift.drawImage(bild, fx(x - SCHIFF_BREITE / 2), fy(SCHIFF_Y - sh / 2 + wippen), SCHIFF_BREITE * s, sh * s);

  if (bumerang) {
    const b = bilder["bumerang.png"], g = 62 * s;
    stift.save();
    stift.translate(fx(bumerang.x), fy(bumerang.y));
    stift.rotate(bumerang.dreh);
    stift.drawImage(b, -g / 2, -g / 2, g, g * b.height / b.width);
    stift.restore();
  }

  stift.fillStyle = "#ffe48a";
  for (const f of funken) stift.fillRect(fx(f.x), fy(f.y), Math.max(2, 5 * s), Math.max(2, 5 * s));

  if (affe) {
    const b = bilder["affe.png"], bb = 230 * s, a = affe.zeit / AFFE_DAUER;
    stift.drawImage(b, fx(-240 + a * (BREITE + 480)), fy(320 + Math.sin(a * 12) * 50), bb, bb * b.height / b.width);
  }

  // Leisten
  stift.fillStyle = "rgba(6,14,24,.72)";
  stift.fillRect(auf.ox, auf.oy, BREITE * s, HUD_OBEN * s);
  stift.fillRect(auf.ox, fy(HOEHE - HUD_UNTEN), BREITE * s, HUD_UNTEN * s);
  const schrift = Math.max(13, 30 * s);
  text(`${punkte}`, fx(BREITE / 2), fy(HUD_OBEN / 2), Math.max(18, 40 * s), "#ffe08a");
  text(VERSION, fx(20), fy(HUD_OBEN / 2), Math.max(11, 20 * s), "#cfd8e3", "left");
  text(`${Math.round(fps)} Bilder/s`, fx(BREITE - 20), fy(HUD_OBEN / 2), Math.max(11, 20 * s), fps < 45 ? "#ff9d85" : "#cfd8e3", "right");
  if (meldung) text(meldung.text, fx(BREITE / 2), fy(HUD_OBEN + 55), schrift, "#fff");
  stift.restore();
  if (auf.modus === "seite") {
    text("Tippen oder ziehen: fahren", fx(BREITE / 2), fy(HOEHE - HUD_UNTEN / 2), Math.max(11, 22 * s), "#cfd8e3");
  }
}

function knopf_zeichnen(k) {
  const voll = k.name === "q" ? (zielen > 0 ? 1 : q_ladung / Q_MUENZEN) : k.name === "e" ? e_ladung / E_LADEZEIT : 1;
  const bereit = voll >= 1 && !(k.name === "q" && bumerang);
  const r = k.g * 0.22;
  stift.save();
  rund(k.x, k.y, k.g, k.g, r);
  stift.fillStyle = "#16263a";
  stift.fill();
  stift.clip();
  // Der Knopf ist selbst die Ladeanzeige und fuellt sich von unten.
  if (k.name !== "menue") {
    stift.fillStyle = k.name === "q" ? "#2f7fb5" : "#b5772f";
    stift.fillRect(k.x, k.y + k.g * (1 - voll), k.g, k.g * voll);
  }
  stift.restore();
  rund(k.x, k.y, k.g, k.g, r);
  stift.lineWidth = bereit && k.name !== "menue" ? 3 : 1.5;
  stift.strokeStyle = gedrueckt.has(k.name) ? "#fff" : bereit && k.name !== "menue" ? "#ffe08a" : "rgba(255,255,255,.4)";
  stift.stroke();

  const beschriftung = Math.max(10, k.g * 0.17);
  if (k.name === "menue") {
    stift.fillStyle = "#fff";
    const b = k.g * 0.42, h = Math.max(2, k.g * 0.05), mx = k.x + (k.g - b) / 2, my = k.y + k.g * 0.38;
    for (let i = -1; i <= 1; i++) stift.fillRect(mx, my + i * k.g * 0.13 - h / 2, b, h);
  } else {
    const bild = bilder[k.name === "q" ? "bumerang.png" : "affe.png"];
    const g = k.g * 0.6, h = g * bild.height / bild.width;
    stift.imageSmoothingEnabled = true;
    stift.globalAlpha = bereit ? 1 : 0.55;
    stift.drawImage(bild, k.x + (k.g - g) / 2, k.y + k.g * 0.38 - h / 2, g, h);
    stift.globalAlpha = 1;
  }
  const worte = { q: zielen > 0 ? "WERFEN" : "Bumerang", e: "Affe", menue: "Menü" };
  text(worte[k.name], k.x + k.g / 2, k.y + k.g * 0.84, beschriftung);
}

function pause_zeichnen() {
  stift.fillStyle = "rgba(4,10,18,.72)";
  stift.fillRect(0, 0, auf.W, auf.H);
  const felder = menue_felder();
  text("Pause", auf.W / 2, felder[0].y - felder[0].h * 0.7, Math.max(22, felder[0].h * 0.7), "#ffe08a");
  for (const f of felder) {
    rund(f.x, f.y, f.b, f.h, f.h * 0.22);
    stift.fillStyle = f.name === "weiter" ? "#2f7fb5" : "#16263a";
    stift.fill();
    stift.lineWidth = 1.5;
    stift.strokeStyle = "rgba(255,255,255,.45)";
    stift.stroke();
    if (f.regler) {
      const wert = f.wert(), bahn = regler_bahn(f), my = f.y + f.h / 2;
      text(`${f.text} ${Math.round(wert * 100)} %`, f.x + f.h * 0.35, my, f.h * 0.33, "#fff", "left");
      stift.fillStyle = "rgba(255,255,255,.25)";
      rund(bahn.x, my - 4, bahn.b, 8, 4);
      stift.fill();
      stift.fillStyle = "#ffcf3f";
      rund(bahn.x, my - 4, bahn.b * wert, 8, 4);
      stift.fill();
      stift.beginPath();
      stift.arc(bahn.x + bahn.b * wert, my, f.h * 0.27, 0, Math.PI * 2);
      stift.fillStyle = "#fff";
      stift.fill();
    } else {
      text(typeof f.text === "function" ? f.text() : f.text, f.x + f.b / 2, f.y + f.h / 2, f.h * 0.4);
    }
  }
}

function start_zeichnen() {
  stift.fillStyle = "rgba(4,10,18,.45)";
  stift.fillRect(0, 0, auf.W, auf.H);
  const e = Math.min(auf.W, auf.H * 1.5) / 100;
  text("Die Black Pearl", auf.W / 2, auf.H * 0.3, e * 7, "#ffe08a");
  text("Probe für Handy und iPad", auf.W / 2, auf.H * 0.3 + e * 7, e * 3);
  text("Zum Starten antippen", auf.W / 2, auf.H * 0.6, e * 4.4);
  const vollbild = window.navigator.standalone || (window.matchMedia && window.matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches);
  if (!vollbild) text("Für Vollbild: Teilen → Zum Home-Bildschirm", auf.W / 2, auf.H * 0.6 + e * 6, Math.max(12, e * 2.4), "#cfd8e3");
}

function hochkant_zeichnen() {
  stift.fillStyle = "#0b1622";
  stift.fillRect(0, 0, auf.W, auf.H);
  const g = auf.W * 0.07;
  text("Bitte drehen", auf.W / 2, auf.H / 2 - g * 0.8, g * 1.2, "#ffe08a");
  text("Die Black Pearl segelt nur quer.", auf.W / 2, auf.H / 2 + g * 0.8, g * 0.62);
}

function zeichnen() {
  if (zustand === "laden") {
    stift.fillStyle = "#0b1622";
    stift.fillRect(0, 0, auf.W, auf.H);
    text("Lädt …", auf.W / 2, auf.H / 2, 24);
    return;
  }
  if (ist_hochkant()) { hochkant_zeichnen(); return; }
  feld_zeichnen();
  if (zustand === "start") { start_zeichnen(); return; }
  for (const k of auf.knoepfe) knopf_zeichnen(k);
  if (pausiert) pause_zeichnen();
}

// ---------------------------------------------------------------- HAUPTSCHLEIFE
let vorher = 0;
function schleife(jetzt) {
  const roh = (jetzt - vorher) / 1000;
  vorher = jetzt;
  const dt = Math.min(roh, 0.05);
  if (roh > 0 && roh < 1) fps += (1 / roh - fps) * 0.05;
  zeit += dt;
  if (ist_hochkant() && zustand === "spiel" && !pausiert) pause_setzen(true);
  if (zustand === "spiel" && !pausiert) aktualisieren(dt);
  // Die Musik laeuft im Pause-Menue weiter, damit man ihre Lautstaerke beim Einstellen hoert.
  if (zustand === "spiel" && !ist_hochkant()) musik_planen();
  zeichnen();
  requestAnimationFrame(schleife);
}

function bild_laden(name) {
  return new Promise((fertig, fehler) => {
    const b = new Image();
    b.onload = () => { bilder[name] = b; fertig(); };
    b.onerror = () => fehler(new Error(name));
    b.src = "bilder/" + name;
  });
}

aufteilen();
requestAnimationFrame(schleife);
Promise.all(NAMEN.map(bild_laden)).then(() => { zustand = "start"; }).catch((f) => {
  zustand = "laden";
  document.title = "Bild fehlt: " + f.message;
});
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
window.probe = { get x() { return x; }, get ziel() { return ziel; }, get punkte() { return punkte; }, get zustand() { return zustand; }, get pausiert() { return pausiert; }, get auf() { return auf; }, get q_ladung() { return q_ladung; }, set q_ladung(w) { q_ladung = w; }, set e_ladung(w) { e_ladung = w; }, get zielen() { return zielen; }, get bumerang() { return bumerang; }, get affe() { return affe; }, get ton() { return ton.kontext && ton.kontext.state; }, get musik() { return ton.musik && ton.musik.gain.value; }, get geraeusche() { return ton.geraeusche && ton.geraeusche.gain.value; }, get kugeln() { return kugeln.length; }, get last() { return last; } };
