// js/fichiers.js — fichiers d'un dossier conserves dans IndexedDB (store "fichiers", cle "<dossier>/<id>")
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
