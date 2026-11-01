// Offline-Speicher: Erst das Netz fragen, damit Aenderungen sofort ankommen; ohne Netz der Speicher.
const SPEICHER = "black-pearl-1";
const DATEIEN = [
  "./", "index.html", "spiel.js", "manifest.webmanifest",
  "bilder/meer.jpg", "bilder/schiff_links.png", "bilder/schiff_rechts.png",
  "bilder/affe.png", "bilder/bumerang.png", "bilder/icon-180.png", "bilder/icon-192.png", "bilder/icon-512.png",
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
    fetch(e.request).then((antwort) => {
      if (antwort.ok) {
        const kopie = antwort.clone();
        caches.open(SPEICHER).then((c) => c.put(e.request, kopie));
      }
      return antwort;
    }).catch(() => caches.match(e.request).then((t) => t || caches.match("index.html")))
  );
});
