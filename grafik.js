"use strict";
// Bilder laden und alle kleinen Figuren malen; alles nur einmal beim Start.

function flaeche(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// Rechteck mit Pixel-Ecken, damit die kleinen Figuren scharf bleiben
function pixelrect(g, farbe, x, y, w, h, r = 0) {
  g.fillStyle = farbe;
  for (let z = 0; z < h; z++) {
    let einzug = 0;
    const rand = Math.min(z, h - 1 - z);
    if (r > 0 && rand < r) einzug = Math.round(r - Math.sqrt(Math.max(0, r * r - (r - rand - 0.5) ** 2)));
    g.fillRect(x + einzug, y + z, w - 2 * einzug, 1);
  }
}

function kreis(g, farbe, x, y, r, dicke = 0) {
  g.beginPath();
  g.arc(x, y, Math.max(0.1, r - dicke / 2), 0, Math.PI * 2);
  if (dicke) { g.strokeStyle = farbe; g.lineWidth = dicke; g.stroke(); }
  else { g.fillStyle = farbe; g.fill(); }
}

function linie(g, farbe, punkte, dicke, schliessen = false) {
  g.strokeStyle = farbe;
  g.lineWidth = dicke;
  g.lineJoin = "round";
  g.lineCap = "round";
  g.beginPath();
  punkte.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  if (schliessen) g.closePath();
  g.stroke();
}

function kugel_malen(groesse) {
  const c = flaeche(groesse, groesse), g = c.getContext("2d");
  const r = groesse / 2, schritte = Math.max(1, Math.floor(r));
  for (let i = 0; i < schritte; i++) {
    const anteil = i / schritte, hell = Math.floor(15 + 95 * anteil ** 2), versatz = r * 0.35 * anteil;
    kreis(g, `rgb(${hell},${hell},${hell})`, r - versatz, r - versatz, r * (1 - anteil));
  }
  return c;
}

function eigene_kugel_rahmen(kugel) {
  const groesse = Math.round(kugel.width * 1.6), c = flaeche(groesse, groesse), g = c.getContext("2d"), m = groesse / 2;
  kreis(g, KONTUR, m, m, m);
  kreis(g, "#fff", m, m, Math.max(1, m - Math.max(1, Math.floor(groesse / 14))));
  g.drawImage(kugel, Math.round(m - kugel.width / 2), Math.round(m - kugel.height / 2));
  return c;
}

function farbkugel_malen(groesse, farbe) {
  const c = flaeche(groesse, groesse), g = c.getContext("2d"), r = groesse / 2;
  kreis(g, KONTUR, r, r, r);
  kreis(g, farbe, r, r, Math.max(1, r - groesse / 14));
  kreis(g, "#fff", r * 0.7, r * 0.7, Math.max(1, r * 0.28));
  return eigene_kugel_rahmen(c);
}

function gegner_kugel_malen(groesse) {
  const c = flaeche(groesse, groesse), g = c.getContext("2d"), m = groesse / 2;
  kreis(g, "rgba(255,255,255,.47)", m, m, m);
  kreis(g, "#000", m, m, m * 0.76);
  kreis(g, "rgb(255,30,70)", m, m, m * 0.6);
  kreis(g, "rgb(255,235,60)", m, m, m * 0.28);
  return c;
}

function bombe_malen(groesse) {
  const c = flaeche(groesse, groesse), g = c.getContext("2d");
  const r = groesse * 0.36, mx = groesse * 0.42, my = groesse * 0.6;
  kreis(g, "#fff", mx, my, r + groesse * 0.06);
  kreis(g, "rgb(12,12,18)", mx, my, r);
  kreis(g, "rgb(120,120,135)", mx - r * 0.35, my - r * 0.35, r * 0.22);
  linie(g, "rgb(205,175,120)", [[groesse * 0.62, groesse * 0.34], [groesse * 0.82, groesse * 0.12]], groesse / 12);
  kreis(g, "rgb(255,190,60)", groesse * 0.84, groesse * 0.11, groesse * 0.09);
  return c;
}

function muenze_malen() {
  const c = flaeche(32, 32), g = c.getContext("2d");
  kreis(g, "rgb(120,74,14)", 16, 16, 16);
  kreis(g, "rgb(255,200,50)", 16, 16, 14);
  kreis(g, "rgb(205,140,28)", 16, 16, 10, 2);
  g.fillStyle = "rgb(150,96,20)"; g.fillRect(14, 10, 4, 12);
  g.fillStyle = "rgb(255,245,180)"; g.fillRect(8, 6, 6, 4);
  return c;
}

function seifenblase_malen(gr) {
  const c = flaeche(gr, gr), g = c.getContext("2d");
  kreis(g, "rgba(190,230,255,.27)", gr / 2, gr / 2, gr / 2);
  kreis(g, "rgba(235,250,255,.86)", gr / 2, gr / 2, gr / 2, Math.max(1, gr / 9));
  kreis(g, "rgba(255,255,255,.94)", gr * 0.35, gr * 0.33, Math.max(1, gr / 9));
  return c;
}

function powerup_malen(name) {
  const farbe = POWERUPS[name].farbe, c = flaeche(44, 44), g = c.getContext("2d");
  g.scale(2, 2);
  pixelrect(g, KONTUR, 0, 0, 22, 22, 3);
  pixelrect(g, "rgb(40,30,34)", 1, 1, 20, 20, 2);
  g.strokeStyle = farbe; g.lineWidth = 2;
  g.strokeRect(2, 2, 18, 18);
  if (name === "breitseite") {
    for (const ende of [[5, 6], [11, 4], [17, 6]]) linie(g, farbe, [[11, 17], ende], 2);
  } else if (name === "prellkugel") {
    linie(g, farbe, [[4, 17], [8, 5], [13, 16], [18, 5]], 2);
  } else if (name === "voodoo") {
    kreis(g, farbe, 11, 11, 6, 2);
    g.fillStyle = farbe; g.fillRect(10, 10, 3, 3);
    linie(g, farbe, [[11, 3], [11, 6]], 1);
    linie(g, farbe, [[11, 16], [11, 19]], 1);
  } else if (name === "grogbombe") {
    kreis(g, "rgb(235,235,240)", 10, 13, 6);
    kreis(g, "rgb(10,10,14)", 10, 13, 5);
    linie(g, "rgb(200,170,120)", [[13, 9], [16, 5]], 2);
    g.fillStyle = farbe; g.fillRect(16, 3, 3, 3);
  } else if (name === "schutzschild") {
    linie(g, farbe, [[5, 5], [17, 5], [17, 12], [11, 18], [5, 12]], 2, true);
    g.fillStyle = farbe; g.fillRect(10, 8, 3, 5);
  } else if (name === "schub") {
    linie(g, farbe, [[4, 5], [9, 11], [4, 17]], 2);
    linie(g, farbe, [[11, 5], [16, 11], [11, 17]], 2);
  } else {
    linie(g, farbe, [[11, 18], [11, 4]], 2);
    linie(g, farbe, [[11, 4], [7, 8]], 2);
    linie(g, farbe, [[11, 4], [15, 8]], 2);
    linie(g, "rgb(235,235,240)", [[5, 13], [17, 13]], 2);
  }
  return c;
}

function tokenling_malen(fraktion, variante, schritt) {
  const f = FARBEN[fraktion], c = flaeche(20, 20), g = c.getContext("2d");
  const r = (farbe, x, y, w, h, rad = 0) => pixelrect(g, farbe, x, y, w, h, rad);
  const [gesicht, bauch] = TOKEN_VARIANTEN[variante];
  const [fuss_l, fuss_r] = schritt === 0 ? [16, 17] : [17, 16];
  r(KONTUR, 5, fuss_l, 4, 3);
  r(KONTUR, 11, fuss_r, 4, 3);
  r(KONTUR, 1, 9 + schritt, 2, 3);
  r(KONTUR, 17, 10 - schritt, 2, 3);
  r(KONTUR, 2, 2, 16, 15, 4);
  r(f.haut, 3, 3, 14, 13, 3);
  r(f.dunkel, 3, 13, 14, 3, 2);
  r(f.hell, 4, 4, 5, 1);
  r(f.hell, 4, 5, 1, 2);
  if (fraktion === "Affe") {
    r(KONTUR, 0, 5, 3, 4);
    r(KONTUR, 17, 5, 3, 4);
    r(f.hell, 1, 6, 1, 2);
    r(f.hell, 18, 6, 1, 2);
    r(f.hell, 5, 5, 10, 9, 2);
  }
  if (gesicht === "schlaf") {
    r(KONTUR, 5, 6, 4, 1);
    r(KONTUR, 11, 6, 4, 1);
  } else {
    r(f.augen, 5, 4, 4, 4);
    r(f.augen, 11, 4, 4, 4);
    if (gesicht === "schiel") {
      r(KONTUR, 7, 5, 2, 2);
      r(KONTUR, 11, 5, 2, 2);
    } else {
      r(KONTUR, 6, 5, 2, 2);
      r(KONTUR, 12, 5, 2, 2);
    }
  }
  if (bauch) {
    let x = 10 - Math.floor((bauch.length * 4 - 1) / 2);
    for (const zeichen of bauch) {
      MINI_SCHRIFT[zeichen].forEach((zeile, y) => {
        for (let sp = 0; sp < zeile.length; sp++) if (zeile[sp] === "1") r(KONTUR, x + sp, 9 + y, 1, 1);
      });
      x += 4;
    }
  } else if (gesicht === "oh") {
    r(KONTUR, 9, 10, 3, 3);
  } else if (gesicht === "grins") {
    r(KONTUR, 6, 10, 8, 2);
    r(f.augen, 7, 10, 6, 1);
  } else {
    r(KONTUR, 8, 11, 4, 1);
  }
  return c;
}

// Weicher Lichtkegel fuers Addieren: Schwarz bleibt unsichtbar, Hell strahlt.
function heiliges_licht() {
  const gr = 256, c = flaeche(gr, gr), g = c.getContext("2d"), v = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, licht = (1 - t) ** 1.5;
    v.addColorStop(t, `rgb(${Math.min(255, 300 * licht) | 0},${Math.min(255, 275 * licht) | 0},${215 * licht | 0})`);
  }
  g.fillStyle = v;
  g.fillRect(0, 0, gr, gr);
  return c;
}

function heilige_strahlen() {
  const gr = 256, c = flaeche(gr, gr), g = c.getContext("2d"), m = gr / 2;
  g.fillStyle = "#000";
  g.fillRect(0, 0, gr, gr);
  for (let nummer = 0; nummer < 16; nummer++) {
    for (const [b, farbe] of [[5, "rgb(170,145,85)"], [2.2, "rgb(255,248,215)"]]) {
      const laenge = m * (nummer % 2 ? 1 : 0.75);
      const a = dreh(laenge, 0, nummer * 22.5 - b), e = dreh(laenge, 0, nummer * 22.5 + b);
      g.fillStyle = farbe;
      g.beginPath();
      g.moveTo(m, m);
      g.lineTo(m + a[0], m + a[1]);
      g.lineTo(m + e[0], m + e[1]);
      g.closePath();
      g.fill();
    }
  }
  g.globalCompositeOperation = "multiply";
  const v = g.createRadialGradient(m, m, 0, m, m, m);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, w = 255 * (1 - t) ** 0.7 | 0;
    v.addColorStop(t, `rgb(${w},${w},${w})`);
  }
  g.fillStyle = v;
  g.fillRect(0, 0, gr, gr);
  return c;
}

function heiliger_ring() {
  const breite = 100, hoehe = 33, c = flaeche(breite * 2, hoehe * 3), g = c.getContext("2d"), mx = breite, my = hoehe * 1.5;
  g.fillStyle = "#000";
  g.fillRect(0, 0, c.width, c.height);
  for (let stufe = 10; stufe > 0; stufe--) {
    const w = (10 - stufe) / 10;
    g.fillStyle = `rgb(${255 * w | 0},${225 * w | 0},${130 * w | 0})`;
    g.beginPath();
    g.ellipse(mx, my, breite * (1.3 + stufe * 0.07) / 2, hoehe * (1 + stufe * 0.18) / 2, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "#000";
  g.beginPath();
  g.ellipse(mx, my, breite * 1.05 / 2, hoehe * 0.55 / 2, 0, 0, Math.PI * 2);
  g.fill();
  return c;
}

function leuchtkreis(farbe, staerke) {
  const gr = 256, c = flaeche(gr, gr), g = c.getContext("2d"), m = 128, v = g.createRadialGradient(m, m, 0, m, m, m);
  const rgb = farbe.match(/\d+/g).join(",");
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    v.addColorStop(t, `rgba(${rgb},${(staerke * (1 - t) ** 0.5 + 12) / 255})`);
  }
  g.fillStyle = v;
  g.fillRect(0, 0, gr, gr);
  kreis(g, `rgba(${rgb},.82)`, m, m, m, 6);
  return c;
}

const DATEIEN = [
  "meer.jpg", "nacht.jpg", "schiff_links.png", "schiff_rechts.png", "gesunken_links.png", "gesunken_rechts.png",
  "koenig_Claude.png", "koenig_ChatGPT.png", "koenig_Gemini.png", "frost_Claude.png", "frost_ChatGPT.png", "frost_Gemini.png",
  "kopf_Claude.png", "kopf_ChatGPT.png", "kopf_Gemini.png",
  "banane_0.png", "banane_1.png", "banane_2.png", "banane_3.png", "symbol.png", "affe.png", "bumerang.png",
  "fass_0.png", "fass_1.png", "fass_2.png", "truhe_zu.png", "truhe_auf.png", "mimic.png",
];

// Lage des festen Fasskoerpers in den drei Bildern (Originalmasse): so bleibt das Fass beim Wechsel am Platz.
const FASS_LAGE = [
  { breite: 1536, hoehe: 1024, mx: 745, my: 415, koerper: 590 },
  { breite: 1312, hoehe: 1199, mx: 600, my: 530, koerper: 850 },
  { breite: 1312, hoehe: 1199, mx: 600, my: 550, koerper: 765 },
];

const B = { roh: {} };

function bild_laden(name) {
  return new Promise((fertig, fehler) => {
    const b = new Image();
    b.onload = () => { B.roh[name] = b; fertig(); };
    b.onerror = () => fehler(new Error(name));
    b.src = "bilder/" + name;
  });
}

// Heller Abzug fuer das kurze Aufblitzen eines getroffenen Koenigs
function hell_abzug(bild) {
  const c = flaeche(bild.width, bild.height), g = c.getContext("2d");
  g.drawImage(bild, 0, 0);
  g.globalCompositeOperation = "lighter";
  g.fillStyle = "rgb(130,130,130)";
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = "destination-in";
  g.drawImage(bild, 0, 0);
  return c;
}

async function bilder_vorbereiten() {
  await Promise.all(DATEIEN.map(bild_laden));
  B.tokens = {};
  for (const fraktion of Object.keys(FARBEN)) {
    for (let variante = 0; variante < TOKEN_VARIANTEN.length; variante++) {
      for (const schritt of [0, 1]) B.tokens[`${fraktion}/${variante}/${schritt}`] = tokenling_malen(fraktion, variante, schritt);
    }
  }
  B.hell = {};
  for (const name of Object.keys(LEBENS_SYMBOLE)) {
    B.hell["koenig_" + name] = hell_abzug(B.roh[`koenig_${name}.png`]);
    B.hell["frost_" + name] = hell_abzug(B.roh[`frost_${name}.png`]);
  }
  B.kugel = eigene_kugel_rahmen(kugel_malen(28));
  B.gegner_kugel = gegner_kugel_malen(52);
  B.power_kugeln = {
    breitseite: farbkugel_malen(28, POWERUPS.breitseite.farbe),
    prellkugel: farbkugel_malen(28, POWERUPS.prellkugel.farbe),
    voodoo: farbkugel_malen(28, POWERUPS.voodoo.farbe),
    rammkugel: farbkugel_malen(38, POWERUPS.rammkugel.farbe),
    splitter: farbkugel_malen(20, POWERUPS.grogbombe.farbe),
  };
  B.bombe = bombe_malen(68);
  B.seifenblase = seifenblase_malen(36);
  B.muenze = muenze_malen();
  B.power_kisten = {};
  B.power_licht = {};
  for (const name of Object.keys(POWERUPS)) {
    B.power_kisten[name] = powerup_malen(name);
    B.power_licht[name] = leuchtkreis(POWERUPS[name].farbe, 170);
  }
  B.gemini_glut = leuchtkreis("rgb(205,120,255)", 235);
  B.schild_blase = leuchtkreis(POWERUPS.schutzschild.farbe, 95);
  B.kompass = leuchtkreis("rgb(255,215,70)", 235);
  B.heilig = heiliges_licht();
  B.strahlen = heilige_strahlen();
  B.ring = heiliger_ring();
}
