// js/fichiers.js — fichiers d'un dossier conserves dans IndexedDB (store "fichiers", cle "<dossier>/<id>")
import { MEDIAS_IMAGE } from "./questions.js";
export function cleFichier(dossierId) { return dossierId + "/" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
export async function enregistrerFichiers(stockage, dossierId, files) {
  const entrees = [];
  for (const f of files) {
    const cle = cleFichier(dossierId);
    await stockage.ecrire("fichiers", cle, { nom: f.name, type: f.type, taille: f.size, blob: f, ajoute_le: new Date().toISOString() });
    entrees.push({ nom: f.name, type: f.type, taille: f.size, cle });
  }
  return entrees;
}
export async function lireBlob(stockage, cle) { const v = cle ? await stockage.lire("fichiers", cle) : null; return v ? v.blob : null; }
export const supprimerFichier = (stockage, cle) => stockage.supprimer("fichiers", cle);
export async function supprimerFichiersDossier(stockage, dossierId) { for (const c of await stockage.cles("fichiers", dossierId + "/")) await stockage.supprimer("fichiers", c); }
export async function versBase64(blob) {
  const b = new Uint8Array(await blob.arrayBuffer()); let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
// Prepare les entrees d'un dossier pour construireRequete : PDF/images en base64, textes en clair, absents signales
export async function chargerPourRequete(stockage, entrees) {
  const fichiers = [], manquants = [];
  for (const e of entrees) {
    const blob = await lireBlob(stockage, e.cle);
    if (!blob) { manquants.push(e.nom); continue; }
    if (e.type === "application/pdf" || MEDIAS_IMAGE.has(e.type)) fichiers.push({ nom: e.nom, type: e.type, base64: await versBase64(blob) });
    else if (e.type.startsWith("text/")) fichiers.push({ nom: e.nom, type: e.type, texte: await blob.text() });
    else fichiers.push({ nom: e.nom, type: e.type });
  }
  return { fichiers, manquants };
}
