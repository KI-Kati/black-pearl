"use strict";
// Bildschirm-Aufteilung, Finger, Maus, Tastatur, Pause-Menue und Hauptschleife.

const leinwand = document.getElementById("feld");
const stift = leinwand.getContext("2d");
const klaenge = new Klaenge();
const musik = new Hoellenmusik(klaenge);
let spiel = null;
let phase = "laden";      // laden, start (wartet auf die erste Beruehrung), spiel
let fehler = null;

// ---------------------------------------------------------------- AUFTEILUNG DES BILDSCHIRMS
// Das Feld bleibt auf jedem Geraet 3:2, damit das Spiel ueberall gleich schwer ist.
const auf = { W: 1, H: 1, dpr: 1, s: 1, ox: 0, oy: 0, modus: "unten", knoepfe: [] };

function aufteilen() {
  const W = window.innerWidth, H = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
  leinwand.width = Math.round(W * dpr);
  leinwand.height = Math.round(H * dpr);
  const stil = getComputedStyle(document.getElementById("rand"));
  const rand = { l: parseFloat(stil.paddingLeft) || 0, r: parseFloat(stil.paddingRight) || 0, u: parseFloat(stil.paddingBottom) || 0 };
  // Die Knoepfe bekommen zuerst ihren Platz; das Feld nimmt den groessten Rest.
  // Unten darf ein Knopf die Leiste des Felds ueberdecken, dort faehrt kein Schiff.
  const soll = begrenzen(Math.min(W, H) * KNOPF_ANTEIL, KNOPF_MIN, KNOPF_MAX);
  const s_seite = Math.min((W - 2 * (soll + 24) - rand.l - rand.r) / BREITE, H / HOEHE);
  const s_unten = Math.min(W / BREITE, (H - soll - 14 - rand.u) / (HOEHE - HUD_UNTEN));
  const modus = s_seite >= s_unten ? "seite" : "unten", s = Math.max(s_seite, s_unten);
  const ox = (W - BREITE * s) / 2, oy = modus === "seite" ? (H - HOEHE * s) / 2 : 0;
  const links_frei = ox - rand.l, rechts_frei = ox - rand.r;
  Object.assign(auf, { W, H, dpr, s, ox, oy, modus });
  // Auf kleinen Bildschirmen wird die Schrift groesser.
  if (spiel) spiel.text_faktor = s < 0.62 ? 1.3 : 1;

  if (modus === "seite") {
    // Handy: Bumerang und Affe im linken Streifen, Menue im rechten.
    const g = begrenzen(Math.min(links_frei - 12, rechts_frei - 12, (H - rand.u - 28) / 2), 44, KNOPF_MAX), unten = H - rand.u - 8;
    const lx = rand.l + (links_frei - g) / 2, rx = W - rand.r - (rechts_frei + g) / 2;
    auf.knoepfe = [
      { name: "q", x: lx, y: unten - g * 2 - 10, g },
      { name: "e", x: lx, y: unten - g, g },
      { name: "menue", x: rx, y: unten - g, g },
    ];
  } else {
    // iPad: alle Knoepfe in der unteren Leiste.
    const leiste = H - (oy + (HOEHE - HUD_UNTEN) * s), g = begrenzen(leiste - rand.u - 10, 44, KNOPF_MAX);
    const y = H - rand.u - 5 - g, lx = rand.l + 16;
    auf.knoepfe = [
      { name: "q", x: lx, y, g },
      { name: "e", x: lx + g + 14, y, g },
      { name: "menue", x: W - rand.r - 16 - g, y, g },
    ];
  }
}

const welt_x = (px) => (px - auf.ox) / auf.s;
const welt_y = (py) => (py - auf.oy) / auf.s;
const ist_hochkant = () => auf.H > auf.W;

function sichtbare_knoepfe() {
  if (phase !== "spiel" || spiel.name_eingabe !== null) return [];
  return auf.knoepfe.filter((k) => k.name === "menue" || spiel.zustand === "spiel");
}

function knopf_bei(px, py) {
  return sichtbare_knoepfe().find((k) => px >= k.x - 6 && px <= k.x + k.g + 6 && py >= k.y - 6 && py <= k.y + k.g + 6);
}

// ---------------------------------------------------------------- PAUSE-MENUE
function menue_felder() {
  const im_haupt = spiel.zustand === "menue";
  const eintraege = im_haupt
    ? [{ name: "weiter", text: "Zurück" }]
    : [{ name: "weiter", text: "Weiter" }, { name: "neu", text: "Neu starten" }, { name: "haupt", text: "Hauptmenü" }];
  eintraege.push({ name: "musik", regler: true, text: "Musik", wert: () => klaenge.musik_laut });
  eintraege.push({ name: "geraeusche", regler: true, text: "Geräusche", wert: () => klaenge.geraeusche_laut });
  const n = eintraege.length, h = begrenzen(auf.H * 0.115, 40, 62), b = Math.min(400, auf.W * 0.6), luecke = h * 0.2;
  const y0 = auf.H / 2 - (n * h + (n - 1) * luecke) / 2 + h * 0.45;
  return eintraege.map((f, i) => ({ ...f, x: (auf.W - b) / 2, y: y0 + i * (h + luecke), b, h }));
}

const menue_feld_bei = (px, py) => menue_felder().find((m) => px >= m.x && px <= m.x + m.b && py >= m.y && py <= m.y + m.h);
const regler_bahn = (f) => ({ x: f.x + f.b * 0.56, b: f.b * 0.44 - f.h * 0.4 });

function regler_setzen(name, px) {
  const bahn = regler_bahn(menue_felder().find((m) => m.name === name));
  const wert = Math.round(begrenzen((px - bahn.x) / bahn.b, 0, 1) * 20) / 20;
  if (name === "musik") klaenge.musik_laut = wert;
  else klaenge.geraeusche_laut = wert;
  klaenge.stumm = false;
  klaenge.regler();
}

function menue_waehlen(name) {
  if (name === "weiter") { spiel.pausiert = false; fuehrung = null; }
  else if (name === "neu") spiel.neu_starten();
  else if (name === "haupt") spiel.zum_menue();
}

// ---------------------------------------------------------------- FINGER UND MAUS
let fuehrung = null;          // der Finger, der gerade lenkt
let regler_griff = null;      // der Finger auf einem Lautstaerke-Regler
let tipp = null;              // ein Finger, der ausserhalb des Kampfs aufgesetzt wurde
const gedrueckt = new Map();

function lenken(px) {
  spiel.ziel_x = begrenzen(welt_x(px), SCHIFF_BREITE / 2, BREITE - SCHIFF_BREITE / 2);
}

leinwand.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  try { leinwand.setPointerCapture(e.pointerId); } catch (f) { /* unkritisch */ }
  if (e.pointerType === "touch") spiel_touch(true);
  if (phase !== "spiel" || ist_hochkant()) { tipp = e.pointerId; return; }
  if (spiel.pausiert) {
    const f = menue_feld_bei(e.clientX, e.clientY);
    if (f && f.regler) {
      regler_griff = { id: e.pointerId, name: f.name };
      regler_setzen(f.name, e.clientX);
    } else {
      tipp = e.pointerId;
    }
    return;
  }
  const k = knopf_bei(e.clientX, e.clientY);
  if (k) {
    gedrueckt.set(e.pointerId, k.name);
    if (k.name === "q") spiel.q_druecken();
    else if (k.name === "e") spiel.e_druecken();
    else spiel.pausiert = true;
  } else if (spiel.zustand === "spiel") {
    fuehrung = e.pointerId;
    lenken(e.clientX);
  } else {
    tipp = e.pointerId;
  }
});

leinwand.addEventListener("pointermove", (e) => {
  if (regler_griff && e.pointerId === regler_griff.id) regler_setzen(regler_griff.name, e.clientX);
  else if (e.pointerId === fuehrung && spiel.zustand === "spiel" && !spiel.pausiert) lenken(e.clientX);
});

function finger_los(e) {
  if (regler_griff && e.pointerId === regler_griff.id) {
    // Beim Loslassen ein Probeklang, damit man die neue Lautstaerke der Geraeusche hoert.
    if (regler_griff.name === "geraeusche") klaenge.spiele("muenze");
    regler_griff = null;
    klaenge.merken();
  }
  if (e.pointerId === fuehrung) fuehrung = null;   // Das Ziel bleibt: Antippen heisst "fahr dorthin".
  gedrueckt.delete(e.pointerId);
}

leinwand.addEventListener("pointercancel", (e) => {
  finger_los(e);
  if (tipp === e.pointerId) tipp = null;
});

leinwand.addEventListener("pointerup", (e) => {
  finger_los(e);
  // Nur ein eigener Tipp zaehlt, nicht der Finger, der gerade noch das Schiff gelenkt hat.
  const war_tipp = tipp === e.pointerId;
  if (war_tipp) tipp = null;
  if (!war_tipp || ist_hochkant()) return;
  tippen(e.clientX, e.clientY);
});

function tippen(px, py) {
  if (phase === "start") {
    phase = "spiel";
    wach_halten();
    return;
  }
  if (phase !== "spiel") return;
  if (spiel.pausiert) {
    const f = menue_feld_bei(px, py);
    if (f && !f.regler) menue_waehlen(f.name);
    return;
  }
  const x = welt_x(px), y = welt_y(py);
  if (spiel.zustand === "menue") {
    const z = spiel.menue_zeilen().find((a) => R_innen(a, x, y));
    if (z) spiel.starten(z.name);
  } else if (spiel.zustand === "wahl") {
    for (let n = 0; n < 3; n++) {
      if (R_innen(spiel.wahl_rect(n), x, y)) {
        spiel.wahl_index = n;
        spiel.truhe_oeffnen();
        break;
      }
    }
  } else {
    const k = spiel.end_knoepfe().find((a) => R_innen(a, x, y));
    if (k && k.name === "neu") spiel.neu_starten();
    else if (k) spiel.zum_menue();
  }
}

function spiel_touch(an) { if (spiel) spiel.touch = an; }

// iOS zaehlt nur touchend und click als Erlaubnis fuer Ton, pointerup reicht dort nicht.
document.addEventListener("touchend", () => klaenge.wecken(), { passive: true });
document.addEventListener("click", () => klaenge.wecken());

for (const art of ["gesturestart", "gesturechange", "dblclick", "contextmenu"]) {
  document.addEventListener(art, (e) => e.preventDefault());
}
document.addEventListener("touchmove", (e) => { if (e.target === leinwand) e.preventDefault(); }, { passive: false });

// ---------------------------------------------------------------- TASTATUR
window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.repeat) return;
  klaenge.wecken();
  if (phase === "start") { phase = "spiel"; wach_halten(); return; }
  if (phase !== "spiel") return;
  spiel.touch = false;
  spiel.tasten.add(e.code);
  if (e.code === "KeyM") { klaenge.stumm_umschalten(); return; }
  if (e.code === "Space" || e.code === "Escape") { e.preventDefault(); spiel.pausiert = !spiel.pausiert; return; }
  if (spiel.pausiert) return;
  if (e.code === "F5") { e.preventDefault(); spiel.neu_starten(); return; }
  if (spiel.zustand === "menue") {
    const namen = Object.keys(STUFEN), nummer = namen.indexOf(spiel.schwierigkeit);
    if (e.code === "ArrowUp" || e.code === "KeyW") spiel.schwierigkeit = namen[(nummer + 3) % 4];
    else if (e.code === "ArrowDown" || e.code === "KeyS") spiel.schwierigkeit = namen[(nummer + 1) % 4];
    else if (/^Digit[1-4]$/.test(e.code)) spiel.starten(namen[Number(e.code[5]) - 1]);
    else if (e.code === "Enter" || e.code === "NumpadEnter") spiel.starten(spiel.schwierigkeit);
  } else if (spiel.zustand === "wahl") {
    if (e.code === "ArrowLeft" || e.code === "KeyA") spiel.wahl_index = (spiel.wahl_index + 2) % 3;
    else if (e.code === "ArrowRight" || e.code === "KeyD") spiel.wahl_index = (spiel.wahl_index + 1) % 3;
    else if (/^Digit[1-3]$/.test(e.code)) { spiel.wahl_index = Number(e.code[5]) - 1; spiel.truhe_oeffnen(); }
    else if (e.code === "Enter" || e.code === "NumpadEnter") spiel.truhe_oeffnen();
  } else if (spiel.zustand === "spiel") {
    if (e.code === "KeyQ") spiel.q_druecken();
    else if (e.code === "KeyE") spiel.e_druecken();
  }
});
window.addEventListener("keyup", (e) => { if (spiel) spiel.tasten.delete(e.code); });
window.addEventListener("blur", () => { if (spiel) spiel.tasten.clear(); });

// ---------------------------------------------------------------- NAME FUER DIE TOP TEN
const namensfeld = document.getElementById("namensfeld"), name_eingabe = document.getElementById("name");

function name_fertig(name) {
  namensfeld.style.display = "none";
  name_eingabe.blur();
  spiel.eintragen(name);
}
document.getElementById("name_ok").addEventListener("click", () => { if (name_eingabe.value.trim()) name_fertig(name_eingabe.value); });
document.getElementById("name_ohne").addEventListener("click", () => name_fertig(NAME_STANDARD));
name_eingabe.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && name_eingabe.value.trim()) name_fertig(name_eingabe.value);
  else if (e.key === "Escape") name_fertig(NAME_STANDARD);
});

function namensfeld_pruefen() {
  const offen = namensfeld.style.display === "flex";
  if (spiel.name_eingabe !== null && !offen && !spiel.pausiert) {
    document.getElementById("name_titel").textContent = `Top Ten! ${spiel.punkte} Punkte. Dein Name:`;
    name_eingabe.value = "";
    namensfeld.style.display = "flex";
  } else if (spiel.name_eingabe === null && offen) {
    namensfeld.style.display = "none";
  }
}

// ---------------------------------------------------------------- BILDSCHIRM UND UNTERBRECHUNGEN
let wachhalter = null;
async function wach_halten() {
  try {
    if ("wakeLock" in navigator && !wachhalter && document.visibilityState === "visible") {
      wachhalter = await navigator.wakeLock.request("screen");
      wachhalter.addEventListener("release", () => { wachhalter = null; });
    }
  } catch (e) { /* nicht ueberall erlaubt; das Spiel laeuft trotzdem */ }
}

// App-Wechsel, Anruf, Sperre: sofort Pause und Ton anhalten.
function unterbrechen() {
  if (spiel && phase === "spiel" && spiel.zustand === "spiel") spiel.pausiert = true;
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    unterbrechen();
    klaenge.anhalten();
    if (spiel) spiel.tasten.clear();
  } else {
    klaenge.wecken();
    wach_halten();
  }
});
window.addEventListener("pagehide", unterbrechen);
window.addEventListener("resize", aufteilen);
window.addEventListener("orientationchange", () => setTimeout(aufteilen, 200));

// ---------------------------------------------------------------- ZEICHNEN AUSSERHALB DES FELDS
function schrift(groesse) { return `700 ${groesse}px "Helvetica Neue", Helvetica, Arial, sans-serif`; }

function ptext(t, x, y, groesse, farbe = "#fff", anker = "center") {
  stift.font = schrift(groesse);
  stift.textAlign = anker;
  stift.textBaseline = "middle";
  stift.lineWidth = Math.max(2, groesse / 7);
  stift.lineJoin = "round";
  stift.strokeStyle = "rgba(5,12,20,.85)";
  stift.strokeText(t, x, y);
  stift.fillStyle = farbe;
  stift.fillText(t, x, y);
}

function rund(x, y, b, h, r) {
  stift.beginPath();
  if (stift.roundRect) stift.roundRect(x, y, b, h, r);
  else stift.rect(x, y, b, h);
}

function nacht_zeichnen() {
  const b = B.roh["nacht.jpg"], k = Math.max(auf.W / b.width, auf.H / b.height), w = b.width * k, h = b.height * k;
  stift.imageSmoothingEnabled = false;
  stift.drawImage(b, (auf.W - w) / 2, (auf.H - h) / 2, w, h);
}

function knopf_zeichnen(k) {
  const voll = k.name === "q" ? (spiel.zielen > 0 ? 1 : spiel.q_ladung / Q_ABSCHUESSE) : k.name === "e" ? spiel.e_ladung / E_ABSCHUESSE : 1;
  const nicht_jetzt = (k.name === "q" && spiel.bumerang) || (k.name === "e" && spiel.frost > 0);
  const bereit = voll >= 1 && !nicht_jetzt && k.name !== "menue", r = k.g * 0.22;
  const unten = [...gedrueckt.values()].includes(k.name);
  stift.save();
  rund(k.x, k.y, k.g, k.g, r);
  stift.fillStyle = "rgb(22,38,58)";
  stift.fill();
  stift.clip();
  // Der Knopf ist selbst die Ladeanzeige und fuellt sich von unten.
  if (k.name !== "menue") {
    stift.fillStyle = k.name === "q" ? "rgb(47,127,181)" : "rgb(181,119,47)";
    stift.fillRect(k.x, k.y + k.g * (1 - voll), k.g, k.g * voll);
  }
  stift.restore();
  rund(k.x, k.y, k.g, k.g, r);
  stift.lineWidth = bereit ? 3 : 1.5;
  stift.strokeStyle = unten ? "#fff" : bereit ? (Math.floor(spiel.zeit * 4) % 2 ? "#fff" : "rgb(255,224,138)") : "rgba(255,255,255,.4)";
  stift.stroke();
  if (k.name === "menue") {
    stift.fillStyle = "#fff";
    const b = k.g * 0.42, h = Math.max(2, k.g * 0.05), mx = k.x + (k.g - b) / 2, my = k.y + k.g * 0.38;
    for (let i = -1; i <= 1; i++) stift.fillRect(mx, my + i * k.g * 0.13 - h / 2, b, h);
  } else {
    const bild = B.roh[k.name === "q" ? "bumerang.png" : "affe.png"], g = k.g * 0.6, h = g * bild.height / bild.width;
    stift.imageSmoothingEnabled = true;
    stift.globalAlpha = bereit ? 1 : 0.55;
    stift.drawImage(bild, k.x + (k.g - g) / 2, k.y + k.g * 0.38 - h / 2, g, h);
    stift.globalAlpha = 1;
  }
  const worte = { q: spiel.zielen > 0 ? "WERFEN" : "Bumerang", e: "Affe", menue: "Menü" };
  ptext(worte[k.name], k.x + k.g / 2, k.y + k.g * 0.84, Math.max(10, k.g * 0.17));
}

function pause_zeichnen() {
  stift.fillStyle = "rgba(4,10,18,.72)";
  stift.fillRect(0, 0, auf.W, auf.H);
  const felder = menue_felder(), h0 = felder[0].h;
  ptext(spiel.zustand === "menue" ? "Ton" : "Pause", auf.W / 2, felder[0].y - h0 * 0.7, Math.max(22, h0 * 0.7), "rgb(255,224,138)");
  for (const f of felder) {
    rund(f.x, f.y, f.b, f.h, f.h * 0.22);
    stift.fillStyle = f.name === "weiter" ? "rgb(47,127,181)" : "rgb(22,38,58)";
    stift.fill();
    stift.lineWidth = 1.5;
    stift.strokeStyle = "rgba(255,255,255,.45)";
    stift.stroke();
    if (f.regler) {
      const wert = f.wert(), bahn = regler_bahn(f), my = f.y + f.h / 2, inhalt = `${f.text} ${Math.round(wert * 100)} %`;
      // Die Schrift passt sich an, damit sie nie unter den Regler laeuft (auch nicht bei 100 %).
      const links = f.x + f.h * 0.35, platz = bahn.x - f.h * 0.27 - 8 - links;
      stift.font = schrift(100);
      const breit_100 = stift.measureText("Geräusche 100 %").width;
      ptext(inhalt, links, my, Math.min(f.h * 0.33, platz / breit_100 * 100), "#fff", "left");
      stift.fillStyle = "rgba(255,255,255,.25)";
      rund(bahn.x, my - 4, bahn.b, 8, 4);
      stift.fill();
      stift.fillStyle = "rgb(255,207,63)";
      rund(bahn.x, my - 4, bahn.b * wert, 8, 4);
      stift.fill();
      stift.beginPath();
      stift.arc(bahn.x + bahn.b * wert, my, f.h * 0.27, 0, Math.PI * 2);
      stift.fillStyle = "#fff";
      stift.fill();
    } else {
      ptext(f.text, f.x + f.b / 2, f.y + f.h / 2, f.h * 0.4);
    }
  }
  const letztes = felder[felder.length - 1];
  ptext(`Version ${VERSION}${klaenge.stumm ? " · stumm (Taste M)" : ""}`, auf.W / 2, Math.min(auf.H - 10, letztes.y + letztes.h + 14), 11, "rgb(207,216,227)");
}

function zeichnen() {
  stift.setTransform(auf.dpr, 0, 0, auf.dpr, 0, 0);
  stift.globalAlpha = 1;
  stift.globalCompositeOperation = "source-over";
  stift.fillStyle = "rgb(11,22,34)";
  stift.fillRect(0, 0, auf.W, auf.H);
  if (fehler) { ptext(fehler, auf.W / 2, auf.H / 2, 18, "rgb(255,150,120)"); return; }
  if (phase === "laden") { ptext("Stimme die Kanonen und das Akkordeon …", auf.W / 2, auf.H / 2, Math.min(24, auf.W / 26), "rgb(255,225,130)"); return; }
  if (ist_hochkant()) {
    const g = auf.W * 0.07;
    ptext("Bitte drehen", auf.W / 2, auf.H / 2 - g * 0.8, g * 1.2, "rgb(255,224,138)");
    ptext("Die Black Pearl segelt nur quer.", auf.W / 2, auf.H / 2 + g * 0.8, g * 0.62);
    return;
  }
  if (phase === "start") {
    nacht_zeichnen();
    // Das Bild bringt sein Logo schon mit; darum steht hier nur der Hinweis.
    const e = Math.min(auf.W, auf.H * 1.5) / 100;
    ptext("Zum Starten antippen", auf.W / 2, auf.H * 0.9, e * 4.4);
    const vollbild = window.navigator.standalone || window.matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches;
    if (!vollbild && spiel_ist_touch()) ptext("Für Vollbild: Teilen → Zum Home-Bildschirm", auf.W / 2, auf.H * 0.9 + e * 4.6, Math.max(12, e * 2.2), "rgb(207,216,227)");
    return;
  }
  // Das Nacht-Bild liegt im Hauptmenue unter allem und fuellt den ganzen Bildschirm.
  if (spiel.zustand === "menue") {
    nacht_zeichnen();
    stift.fillStyle = "rgba(0,0,8,.7)";
    stift.fillRect(0, 0, auf.W, auf.H);
  }
  stift.save();
  stift.beginPath();
  stift.rect(auf.ox, auf.oy, BREITE * auf.s, HOEHE * auf.s);
  stift.clip();
  stift.setTransform(auf.dpr * auf.s, 0, 0, auf.dpr * auf.s, auf.dpr * auf.ox, auf.dpr * auf.oy);
  spiel.zeichnen(stift);
  stift.restore();
  stift.setTransform(auf.dpr, 0, 0, auf.dpr, 0, 0);
  for (const k of sichtbare_knoepfe()) knopf_zeichnen(k);
  if (spiel.pausiert) pause_zeichnen();
}

const spiel_ist_touch = () => navigator.maxTouchPoints > 0;

// ---------------------------------------------------------------- HAUPTSCHLEIFE
let vorher = 0;
function schleife(jetzt) {
  const dt = Math.min((jetzt - vorher) / 1000, 0.05);
  vorher = jetzt;
  if (spiel && phase === "spiel") {
    if (ist_hochkant() && spiel.zustand === "spiel") spiel.pausiert = true;
    spiel.update(dt);
    namensfeld_pruefen();
    // Die Musik laeuft im Pause-Menue weiter, damit man ihre Lautstaerke beim Einstellen hoert.
    if (!ist_hochkant()) musik.update(dt, spiel);
    klaenge.thema(spiel.zustand !== "spiel" && !ist_hochkant());
  }
  try {
    zeichnen();
  } catch (f) {
    fehler = "Zeichenfehler: " + f.message;
    console.error(f);
  }
  requestAnimationFrame(schleife);
}

// Alte Top Ten einmalig uebernehmen: ...#top=<base64>
function top_ten_uebernehmen() {
  const m = location.hash.match(/^#top=(.+)$/);
  if (!m) return;
  try {
    const roh = Uint8Array.from(atob(decodeURIComponent(m[1])), (c) => c.charCodeAt(0));
    spiel.importieren(JSON.parse(new TextDecoder().decode(roh)));
  } catch (f) { console.error("Top Ten nicht lesbar", f); }
  history.replaceState(null, "", location.pathname);
}

async function hochfahren() {
  aufteilen();
  requestAnimationFrame(schleife);
  try {
    const [sprueche, tonfolge] = await Promise.all([
      fetch("daten/sprueche.json").then((a) => a.json()),
      fetch("daten/monkey_island_tonfolge.json").then((a) => a.json()),
      bilder_vorbereiten(),
    ]);
    await new Promise((fertig) => setTimeout(fertig, 30));   // Ladebild erst einmal zeigen
    klaenge.vorbereiten(tonfolge);
    spiel = new Spiel(klaenge, sprueche);
    spiel.touch = true;    // Tastatur-Hinweise erst, wenn wirklich eine Taste gedrueckt wurde
    window.spiel = spiel;
    top_ten_uebernehmen();
    aufteilen();
    phase = "start";
    window.app = { get phase() { return phase; }, auf, klaenge, musik, tippen, get fehler() { return fehler; } };
  } catch (f) {
    fehler = "Laden fehlgeschlagen: " + f.message;
    console.error(f);
  }
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
}
hochfahren();
