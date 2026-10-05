// js/projets.js — tableau des projets (pur)
export const COLONNES = [["en_cours", "En cours"], ["en_attente", "En attente"], ["a_faire", "À faire"], ["plus_tard", "Plus tard"], ["fait", "Fait"]];
export const MAX_EN_COURS = 3;
export function parColonne(projets) {
  const out = Object.fromEntries(COLONNES.map(([k]) => [k, []]));
  for (const p of projets) (out[p.statut] || out.a_faire).push(p);
  return out;
}
// « Cette semaine » : prochaine action des projets en cours + ce qui attend une action de David (pas tout le tableau)
export const attendDavid = (p) => /^david\b/i.test(String(p.attente || "").trim());
export function cetteSemaine(projets) {
  return projets.filter((p) => p.statut === "en_cours" || (attendDavid(p) && p.statut !== "fait" && p.statut !== "plus_tard"))
    .map((p) => ({ id: p.id, titre: p.titre, prochaine: p.prochaine, attente: p.attente, statut: p.statut }));
}
export function nouveauProjet(projets, titre) {
  const id = projets.reduce((m, p) => Math.max(m, p.id || 0), 0) + 1;
  return [...projets, { id, titre: String(titre).trim(), statut: "a_faire", prochaine: "", attente: "", taches: [] }];
}
export const avancement = (p) => (p.taches || []).length ? Math.round(100 * p.taches.filter((t) => t.fait).length / p.taches.length) : null;
