"use strict";
// Alles, was das Spielfeld zeichnet. Gerechnet und gezeichnet wird in Einheiten (1200 x 800).

const einpassen = (bild, mw, mh) => {
  const k = Math.min(mw / bild.width, mh / bild.height);
  return [bild.width * k, bild.height * k];
};

Object.assign(Spiel.prototype, {
  mittig(bild, x, y, w, h = null, glatt = false) {
    const g = this.g;
    h = h === null ? w * bild.height / bild.width : h;
    g.imageSmoothingEnabled = glatt;
    g.drawImage(bild, x - w / 2, y - h / 2, w, h);
  },

  // Fuers Addieren von Licht: Schwarz bleibt unsichtbar, Hell strahlt.
  licht(bild, x, y, b, h, staerke, winkel = 0) {
    if (staerke <= 0) return;
    const g = this.g;
    g.save();
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = begrenzen(staerke, 0, 1);
    g.imageSmoothingEnabled = true;
    g.translate(x, y);
    if (winkel) g.rotate(winkel);
    g.drawImage(bild, -b / 2, -h / 2, b, h);
    g.restore();
  },

  text(inhalt, groesse, farbe, x, y, anker = "center", schatten = true) {
    const g = this.g, px = groesse * 0.74 * this.text_faktor;
    g.font = `700 ${px}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    g.textAlign = anker;
    g.textBaseline = "middle";
    if (schatten) {
      g.fillStyle = "rgb(10,8,14)";
      g.fillText(inhalt, x + 1.6, y + 1.6);
    }
    g.fillStyle = farbe;
    g.fillText(inhalt, x, y);
  },

  rund(x, y, b, h, r) {
    const g = this.g;
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, b, h, r);   // aeltere iPads kennen das noch nicht
    else g.rect(x, y, b, h);
  },

  abdunkeln(deckung = 130 / 255) {
    this.g.fillStyle = `rgba(0,0,8,${deckung})`;
    this.g.fillRect(0, 0, this.W, this.H);
  },

  zeichnen(g) {
    this.g = g;
    if (this.zustand === "menue") {
      this.zeichne_menue();
      return;
    }
    g.imageSmoothingEnabled = false;
    g.drawImage(B.roh["meer.jpg"], 0, 0, this.W, this.H);
    this.zeichne_faesser();
    this.zeichne_koenige();
    this.zeichne_tokens();
    this.zeichne_ziel();
    this.zeichne_kisten();
    this.zeichne_tor();
    this.zeichne_schiff();
    this.zeichne_geschosse();
    this.zeichne_strahl();
    this.zeichne_ulti();
    this.zeichne_bumerang();
    for (const p of this.partikel) {
      const gr = Math.max(1, p[7] * p[4] / p[5]);
      g.fillStyle = p[6];
      g.fillRect(p[0], p[1], gr, gr);
    }
    this.zeichne_affe();
    this.zeichne_hud();
    this.zeichne_blase();
    this.zeichne_meldungen();
  },

  // Wie bei den Koenigen: gruen, dann gelb, kurz vor dem Ende rot.
  balken(x, y, b, h, anteil) {
    const g = this.g;
    g.fillStyle = KONTUR;
    g.fillRect(x - b / 2 - 1, y - h / 2 - 1, b + 2, h + 2);
    g.fillStyle = anteil > 0.5 ? "rgb(90,230,110)" : anteil > 0.25 ? "rgb(255,205,60)" : "rgb(255,70,60)";
    g.fillRect(x - b / 2, y - h / 2, Math.max(1, b * anteil), h);
  },

  zeichne_faesser() {
    const g = this.g;
    for (const f of this.faesser) {
      if (f.hp <= 0) continue;
      // Letzte sichtbare Stufe ist "destroyed"; bei 0 HP verschwindet das Fass.
      const stufe = Math.min(2, Math.floor((1 - f.hp / this.stufe.fass_hp) * 3 + 1e-9));
      const lage = FASS_LAGE[stufe], k = FASS_BREITE / lage.koerper;
      const [x, y] = this.fass_mitte(f);
      g.imageSmoothingEnabled = false;
      g.drawImage(B.roh[`fass_${stufe}.png`], x - lage.mx * k, y - lage.my * k, lage.breite * k, lage.hoehe * k);
      this.balken(x, y + FASS_BREITE * 0.5, 76, 7, begrenzen(f.hp / this.stufe.fass_hp, 0, 1));
    }
  },

  zeichne_koenige() {
    const g = this.g;
    // Angreifende Koenige liegen obenauf; die anderen treten blass zurueck.
    const reihe = [...this.koenige].sort((a, b) => (this.events.has(a) ? 1 : 0) - (this.events.has(b) ? 1 : 0));
    for (const k of reihe) {
      const schluessel = this.frost > 0 ? "frost" : "koenig", breite = KOENIG_BREITE * KOENIG_BUFF_GROESSE[k.buff];
      const bild = B.roh[`${schluessel}_${k.name}.png`], y = this.koenig_y(k);
      if (k.name === "Gemini" && k.blitz > 0 && k.lebt) {
        // Deutliche Warnung: Er leuchtet auf, bevor er schiesst.
        g.globalAlpha = (190 + 65 * Math.sin(this.zeit * 22)) / 255;
        this.mittig(B.gemini_glut, k.x, y, KOENIG_BREITE * 1.9, KOENIG_BREITE * 1.9, true);
        g.globalAlpha = 1;
      }
      const abseits = this.events.size > 0 && !this.events.has(k);
      if (k.lebt && k.schild > 0) this.zeichne_heilig(k, y, 1);
      g.globalAlpha = !k.lebt ? Math.max(0, 1 - k.versinkt) : abseits ? 60 / 255 : 1;
      this.mittig(k.treffer_blitz > 0 ? B.hell[`${schluessel}_${k.name}`] : bild, k.x, y, breite);
      g.globalAlpha = 1;
      if (!k.lebt) continue;
      if (!abseits) this.balken(k.x, y + breite * 0.5 + 6, 96, 8, k.hp / k.hp_max);
      if (k.schild > 0) this.zeichne_heilig(k, y, 0.3, true);
      if (k.blitz > 0) this.zeichne_lupe(k);
      if (k.denkt) this.zeichne_denkpunkte(k);
      if (k.ausweichen && this.frost === 0) this.text("weicht aus", 18, "rgb(255,225,150)", k.x, y + 66);
    }
    for (const [k, e] of this.events) {
      if (!e.kopien) continue;
      const y = this.koenig_y(k);
      for (const c of e.kopien) if (c.lebt) this.mittig(B.roh[`koenig_${k.name}.png`], c.x, y, KOENIG_BREITE);
      // Nur beim Original leuchtet der goldene Kompass.
      const puls = 0.75 + 0.25 * Math.sin(this.zeit * 8), kx = k.x - 0.17 * KOENIG_BREITE, ky = y + 0.225 * KOENIG_BREITE;
      g.globalAlpha = puls;
      this.mittig(B.kompass, kx, ky, 68, 68, true);
      g.globalAlpha = 1;
      for (let s = 0; s < 8; s++) {
        const [dx, dy] = dreh(1, 0, s * 45 + this.zeit * 90);
        linie(g, "rgb(255,240,150)", [[kx + dx * 13, ky + dy * 13], [kx + dx * 30 * puls, ky + dy * 30 * puls]], 2);
      }
    }
  },

  // Heiliges Leuchten: blendet weich ein und aus und addiert echtes Licht.
  zeichne_heilig(k, y, staerke, ring = false) {
    let f = Math.min(1, k.schild / 0.5, (SCHILD_DAUER - k.schild) / 0.3);
    f *= staerke * (0.9 + 0.1 * Math.sin(this.zeit * 7));
    const d = KOENIG_BREITE * 2.6;
    this.licht(B.heilig, k.x, y, d, d, f);
    this.licht(B.strahlen, k.x, y, d, d, f, -(Math.floor(this.zeit * 12) % 10) * 2.25 * Math.PI / 180);
    if (ring) {
      this.licht(B.ring, k.x, y - 56, 100, 49, f / staerke);
      const g = this.g;
      g.fillStyle = "rgb(255,250,220)";
      for (let i = 0; i < 5; i++) {
        const w = zufall(0, 6.283), a = zufall(40, 110);
        g.fillRect(k.x + Math.cos(w) * a, y + Math.sin(w) * a, 4, 4);
      }
    }
  },

  zeichne_denkpunkte(k) {
    for (let i = 0; i < 3; i++) {
      const hop = Math.abs(Math.sin(this.zeit * 5 + i * 0.9)) * 9, x = k.x - 18 + i * 18, y = this.koenig_y(k) - 54 - hop;
      kreis(this.g, "#fff", x, y, 5);
      kreis(this.g, KONTUR, x, y, 5, 1);
    }
  },

  // Kleine Pixel-Lupe neben dem Hut, flackert als Warnung vor dem Schuss.
  zeichne_lupe(k) {
    if (Math.floor(this.zeit * 12) % 2) return;
    const g = this.g, x = k.x + 62, y = this.koenig_y(k) - 38, r = 11;
    kreis(g, "rgb(200,235,255)", x, y, r);
    kreis(g, "rgb(255,215,90)", x, y, r, 3);
    linie(g, "rgb(255,215,90)", [[x + r * 0.7, y + r * 0.7], [x + r * 1.8, y + r * 1.8]], 4);
  },

  zeichne_tokens() {
    for (const t of this.tokens) {
      const schritt = Math.floor(this.zeit * t.wackeln * 0.8 + t.phase) % 2;
      const bild = B.tokens[`${t.affe > 0 ? "Affe" : t.fraktion}/${t.variante}/${schritt}`];
      const [x, y] = this.token_pos(t);
      if (x < -TOKEN_GROESSE || x > this.W + TOKEN_GROESSE) continue;
      if (t.kopfueber) {
        this.g.save();
        this.g.translate(x, y);
        this.g.scale(1, -1);
        this.mittig(bild, 0, 0, TOKEN_GROESSE, TOKEN_GROESSE);
        this.g.restore();
      } else {
        this.mittig(bild, x, y, TOKEN_GROESSE, TOKEN_GROESSE);
      }
      // Der Bumerang ueber dem Kopf zeigt: Dieser Tokenling laedt ihn komplett auf.
      if (t.affe > 0) {
        const b = B.roh["bumerang.png"], [w, h] = einpassen(b, 24, 24);
        this.mittig(b, x, y - TOKEN_GROESSE * 0.72, w, h);
      }
    }
  },

  // Gestrichelte Linie, Fadenkreuz und Restzeit, alles direkt am Schiff.
  zeichne_ziel() {
    if (this.zielen <= 0) return;
    const g = this.g, [px, py] = this.ziel_punkt(), sx = this.x, sy = this.schiff_y;
    g.lineCap = "butt";
    for (const [b, f] of [[6, ZIEL_TINTE], [3, ZIEL_LINIE]]) {
      g.strokeStyle = f;
      g.lineWidth = b;
      g.beginPath();
      for (let teil = 0; teil < 20; teil += 2) {
        g.moveTo(sx + (px - sx) * teil / 20, sy + (py - sy) * teil / 20);
        g.lineTo(sx + (px - sx) * (teil + 1) / 20, sy + (py - sy) * (teil + 1) / 20);
      }
      g.stroke();
    }
    kreis(g, ZIEL_TINTE, px, py, 26, 5);
    kreis(g, ZIEL_KREIS, px, py, 24, 2);
    for (const [b, f] of [[7, ZIEL_TINTE], [4, ZIEL_GOLD]]) {
      linie(g, f, [[px - 12, py - 12], [px + 12, py + 12]], b);
      linie(g, f, [[px - 12, py + 12], [px + 12, py - 12]], b);
    }
    const inhalt = `WERFEN  ${this.zielen.toFixed(1)} s`, x = begrenzen(sx, 100, this.W - 100), y = sy - 66;
    g.fillStyle = ZIEL_TINTE;
    this.rund(x - 78, y - 14, 156, 28, 4);
    g.fill();
    this.text(inhalt, 24, ZIEL_GOLD, x, y, "center", false);
  },

  zeichne_schiff() {
    const g = this.g, y = this.schiff_y + Math.sin(this.zeit * 1.8) * 2, seite = this.blick < 0 ? "links" : "rechts";
    if (this.zustand === "sinkt" || this.zustand === "verloren") {
      g.globalAlpha = 1 - this.sink * 0.35;
      this.mittig(B.roh[`gesunken_${seite}.png`], this.x, y + this.sink * 26, SCHIFF_BREITE);
      g.globalAlpha = 1;
      return;
    }
    const bild = B.roh[`schiff_${seite}.png`];
    if (this.kipp > 0) {
      g.save();
      g.translate(this.x, y);
      g.rotate(-Math.sin(this.kipp / 0.3 * Math.PI) * 7 * this.blick * Math.PI / 180);
      this.mittig(bild, 0, 0, SCHIFF_BREITE);
      g.restore();
    } else {
      if (this.schutz > 0 && Math.floor(this.schutz * 12) % 2) g.globalAlpha = 90 / 255;
      this.mittig(bild, this.x, y, SCHIFF_BREITE);
      g.globalAlpha = 1;
    }
    this.zeichne_schild(y);
    if (this.flash_lite > 0) this.schildchen(`Limit erreicht! ${this.flash_lite.toFixed(1)} s`, this.x, this.schiff_y - 70);
  },

  zeichne_schild(y) {
    // In den letzten zwei Sekunden flackert er als Warnung.
    if (this.schild_stufe === 0 && this.schild_blitz === 0) return;
    if (this.schild_stufe && this.schild_zeit < 2 && Math.floor(this.schild_zeit * 8) % 2) return;
    this.mittig(B.schild_blase, this.x, y, SCHIFF_BREITE * 1.24, SCHIFF_BREITE * 1.24, true);
    const farbe = this.schild_blitz > 0 ? "#fff" : POWERUPS.schutzschild.farbe;
    for (let s = 0; s < Math.max(1, this.schild_stufe); s++) kreis(this.g, farbe, this.x, y, SCHIFF_BREITE * 0.6 - s * 7, 2);
  },

  schildchen(inhalt, x, y) {
    const g = this.g, b = 220;
    x = begrenzen(x, b / 2 + 2, this.W - b / 2 - 2);
    this.rund(x - b / 2, y - 15, b, 30, 5);
    g.fillStyle = "rgb(120,50,190)";
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = "rgb(230,190,255)";
    g.stroke();
    this.text(inhalt, 22, "#fff", x, y, "center", false);
  },

  zeichne_tor() {
    if (!this.tor) return;
    const g = this.g, x = this.tor.x, oben = this.schiff_y - 80, unten = this.schiff_y + 52;
    // Die Zeit laeuft sichtbar ab: Die Pfosten ruecken bis zum Ablauf zusammen.
    const anteil = begrenzen(this.tor.zeit / this.tor.dauer, 0, 1), halb = TOR_BREITE / 2 * (0.35 + 0.65 * anteil);
    for (const [b, f] of [[11, ZIEL_TINTE], [6, "rgb(255,215,60)"]]) {
      linie(g, f, [[x - halb, unten], [x - halb, oben], [x + halb, oben], [x + halb, unten]], b);
    }
    const bild = B.roh["banane_0.png"], [w, h] = einpassen(bild, 44, 40);
    this.mittig(bild, x, oben - 22, w, h);
    this.text(`DURCHFAHREN! ${this.tor.zeit.toFixed(1)} s`, 28, "rgb(255,225,80)", begrenzen(x, 130, this.W - 130), oben - 56);
  },

  // Farbe, Symbol und Name zeigen schon im Fallen, was in der Kiste steckt.
  zeichne_kisten() {
    for (const kiste of this.fallend) {
      const x = this.kisten_x(kiste), d = POWERUPS[kiste.art], gr = POWERUP_GROESSE;
      this.mittig(B.power_licht[kiste.art], x, kiste.y, gr * 1.7, gr * 1.7, true);
      this.mittig(B.power_kisten[kiste.art], x, kiste.y, gr, gr);
      this.text(d.titel, 20, d.farbe, x, kiste.y - gr * 0.72);
    }
  },

  zeichne_geschosse() {
    const g = this.g;
    for (const [x, y, zeit, radius] of this.explosionen) {
      const a = zeit / 0.35, r = Math.max(2, radius * (0.3 + 0.7 * a));
      kreis(g, "rgb(255,225,120)", x, y, r, Math.max(1, 12 * (1 - a)));
      kreis(g, "rgb(255,130,50)", x, y, r * 0.8, Math.max(1, 6 * (1 - a)));
    }
    for (const k of this.geschosse) {
      if (k.art === "lenkend") {
        this.zeichne_lenkstern(k);
      } else if (k.art === "bombe") {
        this.mittig(B.bombe, k.x, k.y, 34, 34, true);
      } else if (k.art === "kugel") {
        const b = B.power_kugeln[k.power] || B.kugel, w = b.width / 2;
        this.mittig(b, k.x, k.y, w, w, true);
      } else if (k.art === "blase") {
        this.mittig(B.seifenblase, k.x, k.y, 18, 18, true);
      } else {
        this.mittig(B.gegner_kugel, k.x, k.y, 26, 26, true);
      }
    }
  },

  // Verfolgungskugel: ein drehender Stern, damit man sie sofort erkennt.
  zeichne_lenkstern(k) {
    const g = this.g;
    for (const [gr, f] of [[21, "#fff"], [17, "#000"], [13, "rgb(255,40,215)"], [6, "rgb(255,240,70)"]]) {
      g.fillStyle = f;
      g.beginPath();
      for (let s = 0; s < 8; s++) {
        const [dx, dy] = dreh(s % 2 === 0 ? gr : gr * 0.4, 0, s * 45 + k.alter * 400);
        if (s) g.lineTo(k.x + dx, k.y + dy);
        else g.moveTo(k.x + dx, k.y + dy);
      }
      g.closePath();
      g.fill();
    }
  },

  zeichne_ulti() {
    const u = this.ulti;
    if (!u || u.art !== "laser") return;
    const g = this.g, [punkte] = this.laser_weg(u);
    if (u.phase === "strich") {
      // Nur der Strich: So sieht man, wo der Laser landet, und kann weg.
      linie(g, Math.floor(this.zeit * 14) % 2 ? "rgb(255,235,200)" : "rgb(255,60,50)", punkte, 3);
      kreis(g, "rgb(255,90,80)", u.ziel_x, this.schiff_y, 40, 3);
    } else {
      for (const [d, f] of [[16, "rgb(200,40,40)"], [9, "rgb(255,130,90)"], [3, "rgb(255,245,230)"]]) linie(g, f, punkte, d);
    }
  },

  zeichne_strahl() {
    for (const [k, e] of this.events) if (k.name === "Gemini") this.zeichne_ein_strahl(k, e);
  },

  zeichne_ein_strahl(k, e) {
    const g = this.g, y0 = this.koenig_y(k) + 40, sx = k.x;
    let ex = e.strahl_x, ey = this.H - HUD_UNTEN;
    if (e.block_y !== null && e.block_y !== undefined && e.phase === "strahl") {
      // Der Strahl endet am Fass, solange es noch steht.
      const a = (e.block_y - y0) / (this.H - HUD_UNTEN - y0);
      ex = k.x + (e.strahl_x - k.x) * a;
      ey = e.block_y;
    }
    if (e.phase === "zielen") {
      linie(g, "rgb(205,140,255)", [[sx, y0], [ex, ey]], 2);
    } else if (e.phase === "strahl") {
      const halbe = STRAHL_BREITE / 2;
      for (const [a, d] of [[1, 90], [0.55, 110], [0.2, 170]]) {
        g.fillStyle = `rgba(190,110,255,${d / 255})`;
        g.beginPath();
        g.moveTo(sx - halbe * 0.3 * a, y0);
        g.lineTo(sx + halbe * 0.3 * a, y0);
        g.lineTo(ex + halbe * a, ey);
        g.lineTo(ex - halbe * a, ey);
        g.closePath();
        g.fill();
      }
      g.fillStyle = "rgb(255,240,255)";
      for (let i = 0; i < 14; i++) {
        const a = Math.random();
        g.fillRect(sx + (ex - sx) * a + zufall(-halbe, halbe) * a, y0 + (ey - y0) * a, 3, 3);
      }
    }
  },

  zeichne_bumerang() {
    if (!this.bumerang) return;
    const g = this.g, bild = B.roh["bumerang.png"], [w, h] = einpassen(bild, 62, 62);
    g.save();
    g.translate(this.bumerang.x, this.bumerang.y);
    g.rotate(-(Math.floor(this.bumerang.alter * 22) % 12) * 30 * Math.PI / 180);
    this.mittig(bild, 0, 0, w, h);
    g.restore();
  },

  zeichne_affe() {
    if (this.affe_flug === null) return;
    const a = this.affe_flug / 2.6;
    this.mittig(B.roh["affe.png"], -140 + (this.W + 280) * a, this.H * 0.42 + Math.sin(a * Math.PI * 3) * 40, 230);
  },

  zeichne_hud() {
    const g = this.g;
    g.fillStyle = "rgba(6,8,18,.59)";
    g.fillRect(0, 0, this.W, HUD_OBEN);
    g.fillRect(0, this.H - HUD_UNTEN, this.W, HUD_UNTEN);

    // Oben links: feste Plaetze fuer unsere Bananen.
    this.bananen.forEach((s, i) => {
      if (s < 4) {
        const b = B.roh[`banane_${s}.png`], [w, h] = einpassen(b, 44, 40);
        this.mittig(b, 34 + i * 48, HUD_OBEN / 2, w, h);
      }
    });
    // Daneben: die aktive Faehigkeit mit ihrer Restzeit.
    if (this.power) this.faehigkeit_zeile(this.power, this.power_stufe, this.power_zeit, this.power_dauer(this.power_stufe), 272, HUD_OBEN / 2);
    // Rechts der Punkte: die beiden Zusatz-Power-ups.
    const rechts = this.W / 2 + 145;
    if (this.schild_stufe) this.faehigkeit_zeile("schutzschild", this.schild_stufe, this.schild_zeit, this.schild_dauer, rechts - 40, 17);
    if (this.schub_stufe) this.faehigkeit_zeile("schub", this.schub_stufe, this.schub_zeit, this.power_dauer(this.schub_stufe), rechts - 40, 47);

    // Oben Mitte: Punkte.
    this.text(`${this.punkte}`, 44, "rgb(255,225,130)", this.W / 2, 25);
    this.text(`Highscore ${Math.max(this.bestwert, this.punkte)} · Tempo +${Math.round((this.tempo - 1) * 100)} %`, 20, "rgb(205,205,215)", this.W / 2, 52);

    // Oben rechts: Gegnerleben, je anwesendem Koenig eine Zeile.
    const anwesend = this.koenige.filter((k) => k.lebt);
    anwesend.forEach((k, zeile) => {
      const y = anwesend.length === 3 ? 11 + zeile * 21 : HUD_OBEN / 2 + (zeile - (anwesend.length - 1) / 2) * 21;
      const symbole = LEBENS_SYMBOLE[k.name], symbol = B.roh["symbol.png"], [sw, sh] = einpassen(symbol, 26, 18);
      for (let nummer = 0; nummer < symbole; nummer++) {
        const x = this.W - 18 - (symbole - 1 - nummer) * 28, voll = k.hp > nummer * k.pro_symbol;
        // Helles Plaettchen, damit das dunkle Schiffchen auf dem Band sichtbar bleibt.
        this.rund(x - 13.5, y - 10, 27, 20, 4);
        g.fillStyle = voll ? "rgb(232,214,170)" : "rgb(58,58,72)";
        g.fill();
        if (voll) {
          this.mittig(symbol, x, y, sw, sh);
        } else if (k.symbol_verlust.has(nummer) && Math.floor(k.symbol_verlust.get(nummer) * 10) % 2) {
          // Verbrauchte Symbole blinken kurz und blenden aus.
          g.globalAlpha = k.symbol_verlust.get(nummer) / 0.9;
          this.mittig(symbol, x, y, sw, sh);
          g.globalAlpha = 1;
        }
      }
      const kopf = B.roh[`kopf_${k.name}.png`], [kw, kh] = einpassen(kopf, 20, 20);
      this.mittig(kopf, this.W - 18 - symbole * 28 - 2, y, kw, kh);
    });

    // Unten: Hinweis; die Knoepfe selbst zeichnet die Steuerung.
    const y = this.H - HUD_UNTEN / 2;
    if (this.zielen > 0) {
      this.text(`Nochmal drücken: werfen · noch ${Math.ceil(this.zielen)} s`, 26, "rgb(170,230,255)", this.W / 2, y);
    } else if (!this.touch && this.zustand === "spiel") {
      this.text("A/D oder Pfeile: fahren · Q: Bumerang · E: Affe · Leertaste: Menü · M: Ton", 22, "rgb(225,225,230)", this.W / 2, y);
    }
  },

  faehigkeit_zeile(art, stufe, zeit, dauer, x, y) {
    const g = this.g, d = POWERUPS[art];
    this.mittig(B.power_kisten[art], x + 13, y, 26, 26);
    // Diese Zeile bleibt auch auf dem Handy klein, sonst laeuft sie ineinander.
    const klein = 20 / this.text_faktor;
    this.text(d.titel + (stufe > 1 ? ` x${stufe}` : ""), klein, d.farbe, x + 32, y - 7, "left");
    this.text(`${Math.ceil(zeit)} s`, klein, "rgb(235,235,240)", x + 186, y - 7, "right");
    g.fillStyle = "rgb(25,25,35)";
    g.fillRect(x + 32, y + 3, 154, 7);
    g.fillStyle = d.farbe;
    g.fillRect(x + 32, y + 3, 154 * begrenzen(zeit / dauer, 0, 1), 7);
  },

  // ------------------------------------------------------------------ Menue
  menue_zeilen() {
    const mitte = (this.W - 330) / 2 + 10;
    return Object.keys(STUFEN).map((name, nummer) => ({ name, nummer, ...R_mitte(mitte, 305 + nummer * 76, 720, 66) }));
  },

  zeichne_menue() {
    const g = this.g, mitte = (this.W - 330) / 2 + 10;
    this.text("Die Black Pearl gegen die Tokenlinge", 62, "rgb(255,225,130)", this.W / 2, 70);
    Object.keys(LEBENS_SYMBOLE).forEach((name, nummer) => {
      this.mittig(B.roh[`koenig_${name}.png`], mitte + (nummer - 1) * 170, 180, KOENIG_BREITE);
    });
    for (const z of this.menue_zeilen()) {
      const gewaehlt = z.name === this.schwierigkeit, stufe = STUFEN[z.name], y = z.y + z.h / 2;
      g.fillStyle = gewaehlt ? "rgba(255,215,110,.27)" : "rgba(10,12,26,.72)";
      g.fillRect(z.x, z.y, z.w, z.h);
      g.lineWidth = 2;
      g.strokeStyle = gewaehlt ? "rgb(255,225,130)" : "rgb(120,120,135)";
      g.strokeRect(z.x, z.y, z.w, z.h);
      const farbe = z.name === "nightmare" ? "rgb(255,90,80)" : gewaehlt ? "rgb(255,235,160)" : "rgb(225,225,230)";
      this.text(`${z.nummer + 1}  ${stufe.titel}`, 36, farbe, mitte, y - 13);
      this.text(`${stufe.text} Power-ups: ${stufe.powerup_dauer} s.`, 24, "rgb(235,235,240)", mitte, y + 15);
    }
    this.zeichne_top_ten();
    const unten = this.H - 118;
    if (this.touch) {
      this.text("Stufe antippen: Leinen los!", 34, "#fff", this.W / 2, unten);
    } else {
      this.text("Pfeile hoch/runter: wählen · Enter oder Klick: Leinen los · M: Ton", 26, "#fff", this.W / 2, unten);
      this.text("Im Spiel: A/D oder Pfeile fahren · Q Bumerang · E Affe · Leertaste Menü", 24, "rgb(215,215,225)", this.W / 2, unten + 34);
    }
  },

  zeichne_top_ten() {
    const g = this.g, links = this.W - 330;
    g.fillStyle = "rgba(10,12,26,.75)";
    g.fillRect(links, 130, 310, 392);
    g.lineWidth = 2;
    g.strokeStyle = "rgb(255,225,130)";
    g.strokeRect(links, 130, 310, 392);
    this.text("Top Ten", 36, "rgb(255,225,130)", links + 155, 156);
    const top = this.gespeichert.top10;
    for (let n = 0; n < TOP_ZAHL; n++) {
      const y = 190 + n * 32, farbe = n === 0 ? "rgb(255,225,130)" : "rgb(235,235,240)";
      this.text(`${n + 1}.`, 24, farbe, links + 14, y, "left");
      if (n < top.length) {
        this.text(top[n].name, 24, farbe, links + 50, y, "left");
        this.text(String(top[n].punkte), 24, farbe, links + 296, y, "right");
      } else {
        this.text("–", 24, "rgb(140,140,150)", links + 50, y, "left");
      }
    }
  },

  // ------------------------------------------------------------------ Blasen und Meldungen
  zeichne_blase() {
    if (!this.blase) return;
    const g = this.g, groesse = 24, px = groesse * 0.74 * this.text_faktor;
    g.font = `700 ${px}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    const zeilen = [];
    let zeile = "";
    for (const wort of this.blase.text.split(" ")) {
      const probe = `${zeile} ${wort}`.trim();
      if (g.measureText(probe).width <= 330 || !zeile) zeile = probe;
      else { zeilen.push(zeile); zeile = wort; }
    }
    zeilen.push(zeile);
    const rand = 10, zh = px * 1.2;
    const b = Math.max(...zeilen.map((z) => g.measureText(z).width)) + rand * 2, h = zeilen.length * zh + rand * 2;
    const k = this.blase.figur;
    let x, y, spitze = null;
    if (k && k.lebt) {
      // Neben dem Koenig, damit die Blase keine Tokenlinge verdeckt.
      const ky = this.koenig_y(k), abstand = KOENIG_BREITE * KOENIG_BUFF_GROESSE[k.buff] * 0.5, luecke = 14;
      y = ky - h / 2;
      if (k.x < this.W / 2) {
        x = k.x + abstand + luecke;
        spitze = [k.x + abstand, ky, x + 2];
      } else {
        x = k.x - abstand - luecke - b;
        spitze = [k.x - abstand, ky, x + b - 2];
      }
    } else {
      x = this.W / 2 - b / 2;
      y = HUD_OBEN + 50 - h / 2;
    }
    x = begrenzen(x, 0, this.W - b);
    y = begrenzen(y, HUD_OBEN + 4, this.H - HUD_UNTEN - 4 - h);
    if (spitze) {
      const sy = begrenzen(spitze[1], y + 12, y + h - 12);
      g.fillStyle = "rgb(250,247,235)";
      g.beginPath();
      g.moveTo(spitze[0], sy);
      g.lineTo(spitze[2], sy - 9);
      g.lineTo(spitze[2], sy + 9);
      g.closePath();
      g.fill();
    }
    this.rund(x, y, b, h, rand);
    g.fillStyle = "rgb(250,247,235)";
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = KONTUR;
    g.stroke();
    zeilen.forEach((z, i) => this.text(z, groesse, "rgb(28,22,30)", x + b / 2, y + rand + zh * (i + 0.5), "center", false));
  },

  zeichne_meldungen() {
    if (this.ulti && this.zustand === "spiel") {
      const u = this.ulti;
      if (u.phase === "abkuehlen") {
        const rest = Math.max(0, GATLING_ABKUEHLEN * this.stufe.phase_faktor - u.t);
        this.text(`ÜBERHITZT! Jetzt schießen: ${rest.toFixed(1)} s`, 30, "rgb(120,230,255)", this.W / 2, HUD_OBEN + 165);
      } else {
        this.text(u.titel, 34, "rgb(255,110,90)", this.W / 2, HUD_OBEN + 165);
      }
    }
    if (this.meldung && this.zustand === "spiel") {
      const kurz = this.meldung.text.length < 24;
      const x = kurz ? begrenzen(this.x, 120, this.W - 120) : begrenzen(this.x, 360, this.W - 360);
      this.text(this.meldung.text, kurz ? 34 : 26, this.meldung.farbe, x, this.schiff_y - 96);
    }
    if (this.warnung > 0 && this.zustand === "spiel" && Math.floor(this.zeit * 5) % 2) {
      this.text(`Zu viele Tokenlinge! Banane in Gefahr: ${Math.max(1, Math.ceil(WARNZEIT - this.warnung))} s`, 34, "rgb(255,110,80)", this.W / 2, this.block_grenze() + 22);
    }
    if (this.frost > 0) this.text(`FROST ${this.frost.toFixed(1)} s`, 30, "rgb(170,225,255)", this.W / 2, HUD_OBEN + 150);
    if (this.zustand === "gewonnen") this.zeichne_sieg();
    else if (this.zustand === "wahl") this.zeichne_wahl();
    else if (this.zustand === "mimic") this.zeichne_mimic();
    else if (this.zustand === "verloren") this.endbild();
  },

  // Die beiden Knoepfe am Rundenende
  end_knoepfe() {
    const y = this.zustand === "verloren" ? this.H / 2 + 75 : this.H - 62;
    const sichtbar = this.zustand === "verloren"
      || (this.zustand === "gewonnen" && this.sieg_zeit >= SIEG_AUF && this.name_eingabe === null);
    if (!sichtbar) return [];
    return [
      { name: "neu", text: "Neue Runde", ...R_mitte(this.W / 2 - 115, y, 210, 48) },
      { name: "menue", text: "Hauptmenü", ...R_mitte(this.W / 2 + 115, y, 210, 48) },
    ];
  },

  zeichne_end_knoepfe() {
    const g = this.g;
    for (const k of this.end_knoepfe()) {
      this.rund(k.x, k.y, k.w, k.h, 10);
      g.fillStyle = k.name === "neu" ? "rgb(47,127,181)" : "rgba(22,38,58,.95)";
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = "rgba(255,255,255,.6)";
      g.stroke();
      this.text(k.text, 30, "#fff", k.x + k.w / 2, k.y + k.h / 2);
    }
  },

  zeichne_sieg() {
    const g = this.g, zeit = this.sieg_zeit;
    this.abdunkeln(Math.min(130, zeit * 200) / 255);
    let [x, y] = this.truhe_mitte(), winkel = 0, groesse = 1;
    if (zeit < SIEG_LANDUNG) {
      y -= (1 - zeit / SIEG_LANDUNG) ** 2 * (this.H / 2 + 300);
    } else if (zeit < SIEG_AUF) {
      // Die Truhe rappelt immer staerker, bevor sie aufspringt.
      const s = (zeit - SIEG_LANDUNG) / (SIEG_AUF - SIEG_LANDUNG);
      if (this.sieg_sprung !== null) {
        // Die gewaehlte Truhe rueckt in die Mitte und waechst dabei.
        x += (this.sieg_sprung - x) * (1 - s);
        groesse = WAHL_TRUHE_BREITE / TRUHE_BREITE + (1 - WAHL_TRUHE_BREITE / TRUHE_BREITE) * s;
      }
      x += Math.sin(zeit * 38) * 9 * s;
      winkel = Math.sin(zeit * 29) * 5 * s;
    }
    const auf = begrenzen((zeit - SIEG_AUF) / SIEG_UEBERGANG, 0, 1), bogen = Math.sin(auf * Math.PI), d = 620;
    if (auf > 0) {
      const s = Math.max((0.55 + 0.1 * Math.sin(zeit * 5)) * Math.min(1, auf * 2), bogen);
      this.licht(B.heilig, x, y, d, d, s);
      this.licht(B.strahlen, x, y, d, d, s, -(Math.floor(zeit * 10) % 10) * 2.25 * Math.PI / 180);
    }
    // Uebergang: Ueberblenden, gleichzeitig kurz stauchen und strecken.
    for (const [name, deckung] of [["truhe_zu.png", 1 - auf], ["truhe_auf.png", auf]]) {
      if (deckung <= 0) continue;
      const bild = B.roh[name];
      let w = TRUHE_BREITE * groesse, h = w * bild.height / bild.width;
      if (bogen > 0) {
        w = TRUHE_BREITE * (1 - 0.1 * bogen);
        h = TRUHE_BREITE * bild.height / bild.width * (1 + 0.18 * bogen);
      }
      g.save();
      g.globalAlpha = deckung;
      g.translate(x, y);
      if (winkel && bogen <= 0) g.rotate(-winkel * Math.PI / 180);
      this.mittig(bild, 0, 0, w, h);
      g.restore();
    }
    // Der Lichtblitz liegt vorn und ueberdeckt den Bildwechsel.
    this.licht(B.heilig, x, y, d, d, bogen);

    g.imageSmoothingEnabled = false;
    for (const m of this.muenzen) {
      const h = m[7] ? 18 : 26, breiten = [1, 0.8, 0.45, 0.15, 0.45, 0.8];
      const w = Math.max(2, h * breiten[Math.floor(zeit * m[5] + m[4]) % 6]);
      g.drawImage(B.muenze, m[0] - w / 2, m[1] - h / 2, w, h);
    }
    if (auf > 0) {
      this.text(`SIEG auf Stufe ${this.stufe.titel}!`, 62, "rgb(255,225,130)", this.W / 2, 208);
      this.text("Alle drei Könige sind versenkt.", 30, "rgb(255,245,210)", this.W / 2, 254);
      this.text(`Punkte: ${this.punkte}   ·   Highscore: ${Math.max(this.bestwert, this.punkte)}`, 34, "rgb(240,240,245)", this.W / 2, this.H - 108);
      this.zeichne_end_knoepfe();
    }
    this.zeichne_blase();             // Claudes Glueckwunsch bleibt hell lesbar
    if (this.platz) this.text(`Platz ${this.platz} in der Top Ten!`, 34, "rgb(120,255,150)", this.W / 2, this.H - 142);
  },

  wahl_rect(nummer) {
    return R_mitte(this.wahl_x(nummer), this.H / 2 + 75, WAHL_TRUHE_BREITE + 30, WAHL_TRUHE_BREITE + 90);
  },

  zeichne_wahl() {
    const g = this.g;
    this.abdunkeln(140 / 255);
    this.text("Alle drei Könige sind versenkt!", 46, "rgb(255,225,130)", this.W / 2, 170);
    this.text("Zwei Truhen sind echt. Eine ist eine Mimic.", 34, "rgb(255,245,210)", this.W / 2, 220);
    const y = this.H / 2 + 50, bild = B.roh["truhe_zu.png"];
    for (let n = 0; n < 3; n++) {
      const x = this.wahl_x(n), gewaehlt = n === this.wahl_index;
      let y_bild = y;
      if (gewaehlt) {
        y_bild = y + Math.sin(this.zeit * 5) * 6;
        this.licht(B.heilig, x, y_bild, 620, 620, 0.5);
        const r = this.wahl_rect(n);
        this.rund(r.x, r.y, r.w, r.h, 10);
        g.lineWidth = 4;
        g.strokeStyle = "rgb(255,225,130)";
        g.stroke();
      }
      this.mittig(bild, x, y_bild, WAHL_TRUHE_BREITE);
      this.text(String(n + 1), 40, gewaehlt ? "rgb(255,225,130)" : "rgb(225,225,230)", x, y + WAHL_TRUHE_BREITE * 0.56);
    }
    this.text(this.touch ? "Tippe auf eine Truhe, um sie zu öffnen." : "Klick oder 1, 2, 3: Truhe öffnen", 28, "#fff", this.W / 2, this.H - 105);
  },

  zeichne_mimic() {
    const g = this.g, zeit = this.wahl_zeit, y = this.H / 2 + 50, x = this.wahl_x(this.wahl_index);
    if (zeit < MIMIC_WACKELN) {
      this.abdunkeln(140 / 255);
      this.mittig(B.roh["truhe_zu.png"], x + Math.sin(zeit * 42) * 10 * zeit / MIMIC_WACKELN, y, WAHL_TRUHE_BREITE);
      return;
    }
    g.fillStyle = "rgba(70,0,0,.75)";
    g.fillRect(0, 0, this.W, this.H);
    const a = Math.min(1, (zeit - MIMIC_WACKELN) / 0.2);
    this.mittig(B.roh["mimic.png"], this.W / 2 + Math.sin(zeit * 30) * 5, y + 10, 460 * (0.5 + 0.5 * a));
    this.text("MIMIC! Falsche Truhe!", 62, "rgb(255,90,70)", this.W / 2, 186);
    this.text(`Alles von vorn, deine ${this.punkte} Punkte zählen weiter.`, 30, "rgb(255,245,210)", this.W / 2, this.H - 100);
    this.zeichne_blase();
  },

  endbild() {
    this.abdunkeln();
    this.text("Die Black Pearl ist gesunken.", 58, "rgb(255,150,120)", this.W / 2, this.H / 2 - 40);
    this.text(`Punkte: ${this.punkte}   ·   Highscore: ${Math.max(this.bestwert, this.punkte)}`, 34, "rgb(240,240,245)", this.W / 2, this.H / 2 + 15);
    this.zeichne_end_knoepfe();
  },
});
