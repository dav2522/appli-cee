// js/questions.js — questions sur les documents d'un dossier, envoyées à l'appli Claude (abonnement, sans API)
// Claude y consulte les données CEE grâce au connecteur MCP « Appli CEE » (dépôt appli-cee-donnees, dossier connecteur/).
const EXTRAIT_MAX = 12000;
export const SUGGESTIONS = [
  { titre: "Analyser ce devis", texte: "Analyse ce devis : postes et quantités, cohérence des prix avec le marché, points à négocier, conformité aux conditions de la fiche CEE, pièces manquantes pour le dossier." },
  { titre: "Contre-expertise de l'étude", texte: "Fais la contre-expertise de cette étude de dimensionnement : méthode et hypothèses, cohérence des résultats (déperditions, puissance, débits, températures), conformité aux exigences de la fiche CEE, aux normes citées et aux points vérifiés lors des contrôles par un organisme d'inspection accrédité COFRAC. Liste les non-conformités et ce qu'il faut corriger." },
  { titre: "Conformité à la fiche", texte: "Vérifie point par point la conformité de ce dossier aux conditions de délivrance de la fiche CEE choisie, puis calcule les kWh cumac et la prime attendue en montrant le calcul." },
];
export const MESSAGES_PARTAGE = {
  partage: "Question envoyée à l'appli Claude. Colle sa réponse dans l'historique si tu veux la garder ici.",
  copie: "Partage indisponible : question copiée, colle-la dans l'appli Claude.",
  annule: "Partage annulé.",
  echec: "Partage et copie impossibles sur cet appareil.",
};
// fichiers : documents joints au partage ; texteExtrait : repli quand aucun document n'est conservé
export function texteAPartager({ question, fiche = null, fichiers = [], texteExtrait = "" }) {
  const L = [String(question || "").trim(), ""];
  if (fiche) L.push(`Fiche CEE : ${fiche.code} — ${fiche.titre}`);
  if (fichiers.length) L.push("Documents joints : " + fichiers.map((f) => f.nom).join(", "));
  L.push("Utilise le connecteur « Appli CEE » pour les fiches, les textes officiels, les coûts et l'actualité CEE.");
  if (!fichiers.length && texteExtrait) L.push("", "Texte extrait du document :", texteExtrait.slice(0, EXTRAIT_MAX) + (texteExtrait.length > EXTRAIT_MAX ? "\n[…]" : ""));
  return L.join("\n");
}
export function nouvelleQuestion(question) {
  return { id: "q" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), le: new Date().toISOString(), question: String(question || "").trim(), reponse: "", etat: "partage" };
}
