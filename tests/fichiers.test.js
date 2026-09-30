// tests/fichiers.test.js — fichiers d'un dossier dans le store "fichiers" (stockage simule)
import test from "node:test";
import assert from "node:assert/strict";
import { enregistrerFichiers, lireBlob, supprimerFichiersDossier, supprimerFichier, versBase64, chargerPourRequete, cleFichier } from "../js/fichiers.js";
function stockageSimule() {
  const m = new Map();
  return { m, lire: async (s, k) => m.get(s + ":" + k) ?? null, ecrire: async (s, k, v) => { m.set(s + ":" + k, v); }, supprimer: async (s, k) => { m.delete(s + ":" + k); },
    cles: async (s, p) => [...m.keys()].filter((k) => k.startsWith(s + ":" + p)).map((k) => k.slice(s.length + 1)) };
}
// Node 18 n'a pas File : un Blob nomme suffit (name, type, size comme un File)
const fichier = (contenu, name, type) => Object.assign(new Blob([contenu], { type }), { name });
test("enregistrer / lire / supprimer les fichiers d'un dossier", async () => {
  const st = stockageSimule();
  const f = fichier("%PDF-1.4", "devis.pdf", "application/pdf");
  const [e] = await enregistrerFichiers(st, "d1", [f]);
  assert.equal(e.nom, "devis.pdf"); assert.equal(e.type, "application/pdf"); assert.equal(e.taille, 8); assert.ok(e.cle.startsWith("d1/"));
  assert.equal(await (await lireBlob(st, e.cle)).text(), "%PDF-1.4");
  await enregistrerFichiers(st, "d2", [f]);
  await supprimerFichiersDossier(st, "d1");
  assert.equal(await lireBlob(st, e.cle), null);
  assert.equal((await st.cles("fichiers", "d2/")).length, 1);
  await supprimerFichier(st, (await st.cles("fichiers", "d2/"))[0]);
  assert.equal((await st.cles("fichiers", "")).length, 0);
  assert.notEqual(cleFichier("d"), cleFichier("d"));
});
test("versBase64 et chargement pour la requête (texte, pdf, manquant)", async () => {
  const st = stockageSimule();
  assert.equal(await versBase64(new Blob([Uint8Array.from([0x25, 0x50, 0x44, 0x46])])), "JVBERg==");
  const entrees = await enregistrerFichiers(st, "d1", [fichier("%PDF", "a.pdf", "application/pdf"), fichier("PAC 160 kW", "n.txt", "text/plain")]);
  const r = await chargerPourRequete(st, [...entrees, { nom: "ancien.pdf", type: "application/pdf", taille: 1 }]);
  assert.deepEqual(r.manquants, ["ancien.pdf"]);
  assert.equal(r.fichiers.length, 2); assert.equal(r.fichiers[0].base64, "JVBERg=="); assert.equal(r.fichiers[1].texte, "PAC 160 kW");
});
