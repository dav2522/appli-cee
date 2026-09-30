// sw.js — coquille en cache, donnees jamais en cache (API avec jeton), reception des partages
const CACHE = "appli-cee-v1";
const COQUILLE = ["./", "./index.html", "./css/app.css", "./manifest.webmanifest", "./js/app.js", "./js/routeur.js",
  "./js/format.js", "./js/donnees.js", "./js/stockage.js", "./js/fiches.js", "./js/jour.js", "./js/dossier.js", "./js/pdf.js",
  "./js/partage.js", "./js/vues/aujourdhui.js", "./js/vues/fiches.js", "./js/vues/fiche.js", "./js/vues/echeances.js",
  "./js/vues/dossiers.js", "./js/vues/reglages.js", "./vendor/pdf.min.mjs", "./vendor/pdf.worker.min.mjs",
  "./icons/icon-192.png", "./icons/icon-512.png"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(COQUILLE.map((u) => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
function ouvrirDb() {
  return new Promise((ok, ko) => {
    const r = indexedDB.open("appli-cee", 1);
    r.onupgradeneeded = () => { const db = r.result; for (const s of ["donnees", "dossiers", "file", "partages"]) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s); };
    r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
  });
}
async function stockerPartage(fd) {
  const fichiers = fd.getAll("fichiers").filter((f) => f && f.size);
  const partage = { titre: fd.get("titre") || "", texte: fd.get("texte") || "", url: fd.get("url") || "", fichiers, recu_le: new Date().toISOString() };
  const db = await ouvrirDb();
  await new Promise((ok, ko) => { const t = db.transaction("partages", "readwrite"); t.objectStore("partages").put(partage, "courant"); t.oncomplete = ok; t.onerror = () => ko(t.error); });
}
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === "POST" && url.pathname.endsWith("/partage")) {
    e.respondWith((async () => { try { await stockerPartage(await e.request.formData()); } catch (err) { console.warn(err); }
      return Response.redirect("./#/dossier/nouveau?partage=1", 303); })());
    return;
  }
  if (e.request.method !== "GET" || url.hostname === "api.github.com") return;
  if (url.origin === location.origin || url.hostname.endsWith("gstatic.com") || url.hostname.endsWith("googleapis.com")) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((rep) => {
      if (rep.ok) caches.open(CACHE).then((c) => c.put(e.request, rep.clone())); return rep; }).catch(() => caches.match("./index.html"))));
  }
});
