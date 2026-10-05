// Service worker de remplacement : l'ancienne appli installée efface son cache, se désinscrit et part vers la nouvelle adresse
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) await caches.delete(k);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: "window" })) c.navigate("https://appli.srv1911219.hstgr.cloud/").catch(() => {});
})()));
