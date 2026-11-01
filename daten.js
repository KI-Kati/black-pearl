"use strict";
// Alle Spielwerte, uebernommen aus piratenspiel.py. Sie duerfen gefahrlos veraendert werden.

const VERSION = "1.6";
// Knopfgroesse: Anteil der kuerzeren Bildschirmseite, mit Unter- und Obergrenze in Punkten.
const KNOPF_ANTEIL = 0.13, KNOPF_MIN = 72, KNOPF_MAX = 120;
const MUSIK_LAUTSTAERKE = 0.22;
const EFFEKT_LAUTSTAERKE = 0.30;

// Das Spielfeld rechnet in "Einheiten" und bleibt auf jedem Geraet genau 1200 x 800 gross.
const BREITE = 1200, HOEHE = 800;
const HUD_OBEN = 64, HUD_UNTEN = 56;

const SCHIFF_BREITE = 150, SCHIFF_TEMPO = 430;
const SCHUSS_ABSTAND = 0.16, KUGEL_TEMPO = 900, KUGEL_GROESSE = 14;

const BANANEN = 5;
const SCHUTZZEIT = 0.7;
const FLASH_LITE_DAUER = 3.0;

const FAESSER = [0.2, 0.4, 0.6, 0.8];
const FASS_BREITE = 105, FASS_HP = 9, FASS_SCHUTZBEREICH = 80;

const SPALTEN = 11, DX = 70, DY = 52;
const TOKEN_GROESSE = 46, BLOCK_OBEN = 214, START_REIHEN = 3, MAX_REIHEN = 5;
const BLOCK_TEMPO = 80, BLOCK_ABSENKUNG = 12, NACHSCHUB_ABSTAND = 4.0;
const TOKEN_SCHUSS_ABSTAND = [0.45, 0.95], TOKEN_SCHUSS_TEMPO = 300;
const WARNZEIT = 8.0;
const AFFEN_TOKEN_ABSTAND = [25, 40], AFFEN_TOKEN_DAUER = 10;

const KOENIG_BREITE = 120, KOENIG_Y = 130, KOENIG_TEMPO = 70;
const AUFTRITT = { ChatGPT: 35, Gemini: 70 };
const PAUSE_OHNE_KOENIG = 3.0;
const LEBENS_SYMBOLE = { Claude: 6, ChatGPT: 7, Gemini: 8 };
const BUMERANG_TEMPO = 720, BUMERANG_POLSTER = 30, BUMERANG_FANG = 45, BUMERANG_LEBENSDAUER = 5.0;

const BOSS_ALLE_SEKUNDEN = 16, BOSS_ALLE_ABSCHUESSE = 15, BOSS_SPERRZEIT = 8;
const CLAUDE_DENKZEIT = 4, SCHILD_ABSTAND = [9, 14], SCHILD_DAUER = 4;
const GPT_KOPIEN_ZEIT = 8, GPT_DENKZEIT = 3;
const GEMINI_ZIELEN = 1.6, GEMINI_STRAHL = 0.9, GEMINI_OFFEN = 5;
const GEMINI_SCHUSS_ABSTAND = [2.5, 4], GEMINI_SCHUSS_TEMPO = 300;
const GEMINI_LENKUNG = 220, GEMINI_MAX_SEITWAERTS = 180, GEMINI_LENK_ENDE = 170, GEMINI_WARNZEIT = 0.8;
const KOENIG_BUFF_GROESSE = [1.0, 1.25, 1.45, 1.65];
const GEMINI_BUFF_SCHADEN = 0.03;
const ULTI_ERSTES = [18, 28], ULTI_ABSTAND = [30, 40], ULTI_SPERRE = 5;
const LASER_STRICH = 1.8, LASER_FOLGT = 0.8, LASER_FEUER = 0.6, LASER_FASS_SCHADEN = 14;
const GATLING_SAMMELN = 1.5, GATLING_FEUER = 4, GATLING_ABKUEHLEN = 6, GATLING_TAKT = 0.12, GATLING_SCHWARM = 16, GATLING_NEUE_FAESSER = 2;
const FRESSEN_MINDESTENS = 5;
const TOR_CHANCEN = 2, TOR_ERSTES = [6, 12], TOR_ABSTAND = 30, TOR_BREITE = 130, TOR_MIN_WEG = 350, TOR_MAX_WEG = 700, TOR_PUFFER = 0.5;
const TOR_BILD_BREITE = 320, TOR_STRAHL_LAENGE = 300;
// Die Reihenfolge verteilt die Strahlen immer gleichmaessig; wer hinten steht, verschwindet zuerst.
const TOR_STRAHLEN = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15];
const STRAHL_BREITE = 68, STRAHL_FASS_SCHADEN = 14;

const Q_ABSCHUESSE = 18, E_ABSCHUESSE = 70, Q_ZIELZEIT = 20, Q_SCHWENK = 2.0, Q_ZIEL_Y = KOENIG_Y, Q_ZIEL_RAND = 55;
const ZIEL_LINIE = "rgb(205,243,255)", ZIEL_KREIS = "rgb(207,246,255)", ZIEL_GOLD = "rgb(255,215,90)", ZIEL_TINTE = "rgb(16,14,24)";
const E_FROST = 5;

const PUNKTE_TOKEN = 10, PUNKTE_AFFE = 100, PUNKTE_KOPIE = 25, PUNKTE_KOENIG_TREFFER = 50, PUNKTE_KOENIG_BESIEGT = 500, PUNKTE_BOSSAUFGABE = 150, PUNKTE_BANANE_AM_ENDE = 100;

// "Leicht" ist das Grundspiel; die hoeheren Stufen legen jeweils etwas drauf.
const STUFEN = {
  leicht: { titel: "Leicht", text: "Nur die Tokenlinge schießen.", koenig_schuss: null, alle_zugleich: false, strahl_faesser: false,
    powerup_tempo: 90, powerup_dauer: 20, leben_faktor: 1.0, fass_hp: FASS_HP, tempo_pro_minute: 0.15, tempo_max: 1.5, token_feuer: 1.0, treffer_pro_symbol: 5,
    schiesst_im_angriff: false, kopie_abstand: 1.2, fass_schutz: FASS_SCHUTZBEREICH, drop_faktor: 1.0, kugel_faktor: 1.0, ultis: false, phase_faktor: 1.0, bananen_tor: false },
  mittel: { titel: "Mittel", text: "Die Piratenkönige schießen auch.", koenig_schuss: [2.8, 4.5], alle_zugleich: false, strahl_faesser: false,
    powerup_tempo: 140, powerup_dauer: 15, leben_faktor: 1.0, fass_hp: FASS_HP * 1.25, tempo_pro_minute: 0.25, tempo_max: 1.75, token_feuer: 0.8, treffer_pro_symbol: 6,
    schiesst_im_angriff: false, kopie_abstand: 1.0, fass_schutz: FASS_SCHUTZBEREICH, drop_faktor: 1.0, kugel_faktor: 1.0, ultis: false, phase_faktor: 1.0, bananen_tor: false },
  schwer: { titel: "Schwer", text: "Alle feuern auch im Angriff, Geminis Strahl zerlegt Fässer.", koenig_schuss: [1.0, 1.8], alle_zugleich: true, strahl_faesser: true,
    powerup_tempo: 200, powerup_dauer: 10, leben_faktor: 1.15, fass_hp: FASS_HP * 1.6, tempo_pro_minute: 0.4, tempo_max: 2.0, token_feuer: 0.6, treffer_pro_symbol: 8,
    schiesst_im_angriff: true, kopie_abstand: 0.5, fass_schutz: FASS_SCHUTZBEREICH, drop_faktor: 1.0, kugel_faktor: 1.0, ultis: false, phase_faktor: 1.0, bananen_tor: false },
  nightmare: { titel: "Nightmare", text: "Jeder König hat eine Ulti, kaum Deckung, doppelt zäh.", koenig_schuss: [0.97, 1.75], alle_zugleich: true, strahl_faesser: true,
    powerup_tempo: 260, powerup_dauer: 7, leben_faktor: 1.0, fass_hp: FASS_HP, tempo_pro_minute: 0.5, tempo_max: 2.3, token_feuer: 0.58, treffer_pro_symbol: 16,
    schiesst_im_angriff: false, kopie_abstand: null, fass_schutz: FASS_BREITE / 2, drop_faktor: 1.05, kugel_faktor: 1.03, ultis: true, phase_faktor: 0.7, bananen_tor: true },
};

// Power-ups: "abstand" ist die Schussrate waehrend der Faehigkeit.
const POWERUPS = {
  breitseite: { titel: "Breitseite", farbe: "rgb(255,200,70)", abstand: 0.16 },
  prellkugel: { titel: "Prellkugel", farbe: "rgb(90,235,130)", abstand: 0.2 },
  voodoo: { titel: "Voodoo-Kugel", farbe: "rgb(210,110,255)", abstand: 0.22 },
  grogbombe: { titel: "Grogbombe", farbe: "rgb(255,110,60)", abstand: 0.7 },
  rammkugel: { titel: "Rammkugel", farbe: "rgb(90,200,255)", abstand: 0.2 },
  // Diese beiden laufen zusaetzlich und ersetzen die Schussfaehigkeit nicht.
  schutzschild: { titel: "Schutzschild", farbe: "rgb(255,130,210)", abstand: null },
  schub: { titel: "Rückenwind", farbe: "rgb(245,245,255)", abstand: null },
};
const SCHUB_FAKTOR = { 1: 1.4, 2: 1.7, 3: 2.0 };
const POWERUP_MAX_STUFE = 3, POWERUP_GROESSE = 46;
const POWERUP_ABSTAND_START = 8.2, POWERUP_ABSTAND_MIN = 2.7, POWERUP_ZEITRAUM = 180;
const VOODOO_TEMPO = 650, VOODOO_DREHUNG = 320, VOODOO_LEBENSDAUER = 2.5;
const BOMBE_TEMPO = 520, BOMBE_RADIUS = 110, BOMBE_SCHADEN = 2;
const SPLITTER_TEMPO = 480, SPLITTER_LEBENSDAUER = 0.55;

const SIEG_LANDUNG = 0.7, SIEG_AUF = 1.8, SIEG_UEBERGANG = 0.45, SIEG_FONTAENE = 3.0;
const SIEG_REGEN_PRO_SEKUNDE = 60, SIEG_FONTAENE_PRO_SEKUNDE = 45, SIEG_MAX_MUENZEN = 420;
const TRUHE_BREITE = 380, WAHL_TRUHE_BREITE = 240, WAHL_ABSTAND = 330;
const WAHL_SPERRE = 0.8;   // kurz gesperrt, damit ein Kampf-Tipp nicht aus Versehen eine Truhe oeffnet
const MIMIC_WACKELN = 0.8, MIMIC_DAUER = 3.8, NAME_NACH = 2.5, NAME_MAX = 12, NAME_STANDARD = "Pirat", TOP_ZAHL = 10;

const BLASE_DAUER = 3.5, BLASE_PAUSE = 7.0;

const FARBEN = {
  Claude: { haut: "rgb(226,124,84)", hell: "rgb(250,200,165)", dunkel: "rgb(160,72,46)", augen: "rgb(255,244,228)" },
  ChatGPT: { haut: "rgb(38,170,170)", hell: "rgb(150,232,226)", dunkel: "rgb(14,96,124)", augen: "rgb(255,255,255)" },
  Gemini: { haut: "rgb(112,92,226)", hell: "rgb(236,150,226)", dunkel: "rgb(62,44,150)", augen: "rgb(255,240,255)" },
  Affe: { haut: "rgb(132,84,44)", hell: "rgb(230,190,140)", dunkel: "rgb(84,50,24)", augen: "rgb(255,255,255)" },
};
const KONTUR = "rgb(22,16,24)";

const MINI_SCHRIFT = {
  "?": ["111", "001", "011", "000", "010"],
  "!": ["010", "010", "010", "000", "010"],
  "4": ["101", "101", "111", "001", "001"],
  "0": ["111", "101", "101", "101", "111"],
};
const TOKEN_VARIANTEN = [["normal", ""], ["schiel", ""], ["oh", ""], ["grins", ""], ["normal", "?"], ["schiel", "!"], ["schlaf", "404"]];

// ---------------------------------------------------------------- HELFER
const begrenzen = (w, a, b) => Math.max(a, Math.min(b, w));
const zufall = (a, b) => a + Math.random() * (b - a);
const zufall_von = (paar) => zufall(paar[0], paar[1]);
const wahl = (liste) => liste[Math.floor(Math.random() * liste.length)];
const ganzzahl = (n) => Math.floor(Math.random() * n);
const werte = (o) => Object.values(o);
const entfernen = (liste, x) => { const i = liste.indexOf(x); if (i >= 0) liste.splice(i, 1); };

function dreh(x, y, grad) {
  const w = grad * Math.PI / 180, c = Math.cos(w), s = Math.sin(w);
  return [x * c - y * s, x * s + y * c];
}

// Rechtecke wie in Pygame: x, y, Breite, Hoehe
const R = (x, y, w, h) => ({ x, y, w, h });
const R_mitte = (cx, cy, w, h) => ({ x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h });
const R_gross = (r, dx, dy) => ({ x: r.x - dx / 2, y: r.y - dy / 2, w: r.w + dx, h: r.h + dy });
const R_ueberlappt = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const R_innen = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Schneidet eine Strecke mit dem Rechteck; liefert den ersten Punkt oder null.
function clipline(r, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  let t0 = 0, t1 = 1;
  const p = [-dx, dx, -dy, dy], q = [x0 - r.x, r.x + r.w - x0, y0 - r.y, r.y + r.h - y0];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return null; continue; }
    const t = q[i] / p[i];
    if (p[i] < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
    else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  return [x0 + t0 * dx, y0 + t0 * dy];
}
