// Offline-Speicher: Erst das Netz fragen, damit Aenderungen sofort ankommen; ohne Netz der Speicher.
const SPEICHER = "black-pearl-4";
const DATEIEN = [
  "./", "index.html", "daten.js", "grafik.js", "klang.js", "spiel.js", "weltbild.js", "steuerung.js", "manifest.webmanifest",
  "daten/sprueche.json", "daten/monkey_island_tonfolge.json",
  ...["meer.jpg", "nacht.jpg", "tor.png", "schiff_links.png", "schiff_rechts.png", "gesunken_links.png", "gesunken_rechts.png",
    "koenig_Claude.png", "koenig_ChatGPT.png", "koenig_Gemini.png", "frost_Claude.png", "frost_ChatGPT.png", "frost_Gemini.png",
    "kopf_Claude.png", "kopf_ChatGPT.png", "kopf_Gemini.png", "banane_0.png", "banane_1.png", "banane_2.png", "banane_3.png",
    "symbol.png", "affe.png", "bumerang.png", "fass_0.png", "fass_1.png", "fass_2.png", "truhe_zu.png", "truhe_auf.png", "mimic.png",
    "icon-180.png", "icon-192.png", "icon-512.png"].map((n) => "bilder/" + n),
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SPEICHER).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((namen) => Promise.all(namen.filter((n) => n !== SPEICHER).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    // no-cache: Der Browser muss bei GitHub nachfragen, statt eine alte Fassung aus seinem Speicher zu nehmen.
    fetch(e.request, { cache: "no-cache" }).then((antwort) => {
      if (antwort.ok) {
        const kopie = antwort.clone();
        caches.open(SPEICHER).then((c) => c.put(e.request, kopie));
      }
      return antwort;
    }).catch(() => caches.match(e.request).then((t) => t || caches.match("index.html")))
  );
});
