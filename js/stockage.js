// js/stockage.js — IndexedDB (memes stores que sw.js)
const NOM = "appli-cee", VERSION = 1, STORES = ["donnees", "dossiers", "file", "partages"];
let dbPromesse;
export function ouvrir() {
  if (!dbPromesse) dbPromesse = new Promise((ok, ko) => {
    const r = indexedDB.open(NOM, VERSION);
    r.onupgradeneeded = () => { for (const s of STORES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); };
    r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
  });
  return dbPromesse;
}
function requete(store, mode, fn) {
  return ouvrir().then((db) => new Promise((ok, ko) => {
    const t = db.transaction(store, mode); const r = fn(t.objectStore(store));
    t.oncomplete = () => ok(r && "result" in r ? r.result : undefined); t.onerror = () => ko(t.error); t.onabort = () => ko(t.error);
  }));
}
export const lire = (store, cle) => requete(store, "readonly", (s) => s.get(cle)).then((v) => v ?? null);
export const ecrire = (store, cle, val) => requete(store, "readwrite", (s) => s.put(val, cle));
export const supprimer = (store, cle) => requete(store, "readwrite", (s) => s.delete(cle));
export const vider = (store) => requete(store, "readwrite", (s) => s.clear());
export async function tout(store) {
  const db = await ouvrir();
  return new Promise((ok, ko) => {
    const out = []; const t = db.transaction(store, "readonly"); const c = t.objectStore(store).openCursor();
    c.onsuccess = () => { const cur = c.result; if (cur) { out.push({ cle: cur.key, val: cur.value }); cur.continue(); } else ok(out); };
    c.onerror = () => ko(c.error);
  });
}
export async function estimation() {
  if (!navigator.storage?.estimate) return { usage: 0, quota: 0 };
  const e = await navigator.storage.estimate(); return { usage: e.usage || 0, quota: e.quota || 0 };
}
