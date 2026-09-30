// js/questions.js — questions a Claude sur les documents d'un dossier (pur : requete, historique, couts, libelles)
import { dateFr, giga } from "./format.js";
import { sectionsTexte } from "./dossier.js";
export const MODELE = "claude-opus-5";
export const HISTORIQUE_MAX = 8;
export const TAILLE_MAX = 30 * 1048576;      // base64 cumule par requete (limite API : 32 Mo)
export const IMAGES_MAX = 20;               // au-dela, l'API impose une limite de dimensions plus stricte
export const MEDIAS_IMAGE = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const TARIF = { entree: 5, cache_lu: 0.5, cache_ecrit: 6.25, sortie: 25 };   // $ par million de jetons, claude-opus-5
export const SYSTEME = [
  "Tu es expert du dispositif des certificats d'économies d'énergie (CEE) en France, au service de Solhy Énergie (bureau d'études et mandataire CEE). Tu réponds en français, de façon structurée, chiffrée et prudente.",
  "Règles :",
  "- Appuie-toi d'abord sur les documents joints (devis, étude de dimensionnement, photos) : cite la page, le poste ou le montant concerné.",
  "- Signale explicitement chaque hypothèse, chaque information manquante et ce qu'il faudrait demander au client ou à l'installateur.",
  "- Pour une question de conformité, passe en revue chaque exigence une par une (fiche d'opération standardisée, arrêté, règles de l'art et normes citées, référentiel de contrôle CEE appliqué par les organismes d'inspection accrédités COFRAC) et conclus : conforme / non conforme / à vérifier, avec la correction à apporter.",
  "- Pour un devis : postes, cohérence des quantités et des prix avec le marché, points à négocier, pièces justificatives attendues pour le dossier CEE.",
  "- N'invente jamais un prix, une référence ou un texte : donne des ordres de grandeur en le disant. Calculs en kWh cumac montrés étape par étape quand la fiche est fournie.",
  "- Termine par une synthèse en 3 à 5 lignes et la liste des actions à mener.",
].join("\n");
export const SUGGESTIONS = [
  { titre: "Analyser ce devis", texte: "Analyse ce devis : postes et quantités, cohérence des prix avec le marché, points à négocier, conformité aux conditions de la fiche CEE, pièces manquantes pour le dossier." },
  { titre: "Contre-expertise de l'étude", texte: "Fais la contre-expertise de cette étude de dimensionnement : méthode et hypothèses, cohérence des résultats (déperditions, puissance, débits, températures), conformité aux exigences de la fiche CEE, aux normes citées et aux points vérifiés lors des contrôles par un organisme d'inspection accrédité COFRAC. Liste les non-conformités et ce qu'il faut corriger." },
  { titre: "Conformité à la fiche", texte: "Vérifie point par point la conformité de ce dossier aux conditions de délivrance de la fiche CEE choisie, puis calcule les kWh cumac et la prime attendue en montrant le calcul." },
];
export function contexteFiche(fiche, texteOfficiel = "", avis) {
  if (!fiche) return "";
  const c = fiche.carte || {}; const { conditions, bareme } = sectionsTexte(texteOfficiel);
  const L = [`Fiche CEE choisie par l'utilisateur : ${fiche.code} — ${fiche.titre}${fiche.nom ? " (" + fiche.nom + ")" : ""}.`,
    `Version ${fiche.version || "?"}${fiche.applicable_depuis ? ", applicable depuis le " + dateFr(fiche.applicable_depuis) : ""}. Coup de pouce : ${(fiche.cdp?.cp || 1) > 1 ? "×" + fiche.cdp.cp + " (" + (fiche.cdp.programmes || []).join(", ") + ")" : "aucun"}.`,
    fiche.fin_proche ? `Fin de la fiche : ${fiche.fin_proche.au_plus_tot ? "au plus tôt le " : ""}${dateFr(fiche.fin_proche.date)}.` : "",
    c.resume ? "Résumé : " + c.resume : "", c.gwh != null ? `Cas optimal de référence : ${(c.cas?.seg || []).join(" · ")} → ≈ ${giga(c.gwh)}.` : "",
    c.verifier?.length ? "À vérifier : " + c.verifier.join(" ; ") : "", c.leviers?.length ? "Leviers : " + c.leviers.join(" ; ") : "",
    c.cout?.postes?.length ? "Coûts habituels HT : " + c.cout.postes.map((p) => `${p[0]} ${p[1]}–${p[2]} €`).join(" ; ") : "",
    avis?.commentaire ? "Note de Solhy : " + avis.commentaire : "",
    conditions ? "\nExtrait du texte officiel — conditions :\n" + conditions : "", bareme ? "\nExtrait du texte officiel — montant :\n" + bareme : ""];
  return L.filter(Boolean).join("\n");
}
export function verifierTaille(fichiers) {
  let total = 0, images = 0;
  for (const f of fichiers) { total += (f.base64 || f.texte || "").length; if (MEDIAS_IMAGE.has(f.type)) images++; }
  if (total > TAILLE_MAX) return "trop_volumineux";
  if (images > IMAGES_MAX) return "trop_images";
  return null;
}
// fichiers : [{ nom, type, base64 }] (PDF, image) ou [{ nom, type, texte }] ; questions : historique du dossier
export function construireRequete({ fichiers = [], texteExtrait = "", questions = [], question, fiche = null, texteOfficiel = "", avis } = {}) {
  const system = [{ type: "text", text: SYSTEME, cache_control: { type: "ephemeral" } }];
  const ctx = contexteFiche(fiche, texteOfficiel, avis); if (ctx) system.push({ type: "text", text: ctx });
  const blocs = [], ignores = []; let dernier = -1, n = 0;
  for (const f of fichiers) {
    if (f.type === "application/pdf" && f.base64) { n++; blocs.push({ type: "text", text: `Document ${n} : ${f.nom}` }, { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.base64 } }); dernier = blocs.length - 1; }
    else if (MEDIAS_IMAGE.has(f.type) && f.base64) { n++; blocs.push({ type: "text", text: `Document ${n} : ${f.nom}` }, { type: "image", source: { type: "base64", media_type: f.type, data: f.base64 } }); dernier = blocs.length - 1; }
    else if (f.texte != null) { n++; blocs.push({ type: "text", text: `Document ${n} : ${f.nom}\n\n${f.texte}` }); }
    else ignores.push(f.nom);
  }
  if (dernier >= 0) blocs[dernier].cache_control = { type: "ephemeral" };   // documents mis en cache : les relances les relisent a 10 % du prix
  if (!n && texteExtrait) blocs.push({ type: "text", text: "Texte extrait du document :\n\n" + texteExtrait });
  const hist = questions.filter((q) => q.etat === "ok" && q.reponse).slice(-HISTORIQUE_MAX);
  const messages = [];
  const premiere = hist.length ? hist[0].question : question;
  messages.push({ role: "user", content: [...blocs, { type: "text", text: premiere }] });
  hist.forEach((q, i) => {
    const rep = { type: "text", text: q.reponse }; if (i === hist.length - 1) rep.cache_control = { type: "ephemeral" };
    messages.push({ role: "assistant", content: [rep] });
    messages.push({ role: "user", content: [{ type: "text", text: i + 1 < hist.length ? hist[i + 1].question : question }] });
  });
  return { system, messages, ignores };
}
export function estimerCout(u) { return u ? ((u.entree || 0) * TARIF.entree + (u.cache_lu || 0) * TARIF.cache_lu + (u.cache_ecrit || 0) * TARIF.cache_ecrit + (u.sortie || 0) * TARIF.sortie) / 1e6 : 0; }
const nb = (x) => Math.round(x || 0).toLocaleString("fr-FR").replace(/[   ]/g, " ");   // separateur de milliers : espace insecable, quelle que soit la version d'ICU
export function formaterCout(u) {
  if (!u) return "";
  const entree = (u.entree || 0) + (u.cache_lu || 0) + (u.cache_ecrit || 0);
  return `${nb(entree)} jetons en entrée${u.cache_lu ? " dont " + nb(u.cache_lu) + " lus en cache" : ""} · ${nb(u.sortie)} en sortie · ≈ ${estimerCout(u).toFixed(2).replace(".", ",")} $`;
}
export function nouvelleQuestion(question) {
  return { id: "q" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), le: new Date().toISOString(), question: String(question || "").trim(), reponse: "", etat: "en_cours", erreur: "", modele: MODELE, usage: null };
}
const ERREURS = {
  sans_cle: "Aucune clé API : saisissez-la dans Réglages, ou partagez la question vers l'appli Claude.",
  cle: "Clé API refusée par Anthropic : vérifiez-la dans Réglages.",
  interdit: "Accès refusé par Anthropic (permissions ou crédit du compte).",
  limite: "Trop de requêtes pour le moment : réessayez dans une minute.",
  requete: "Requête refusée par l'API",
  surcharge: "Service Anthropic surchargé ou indisponible : réessayez un peu plus tard.",
  reseau: "Hors ligne ou réseau indisponible : la question sera à reposer.",
  arret: "Question arrêtée.",
  trop_volumineux: "Documents trop volumineux pour une requête (plus de 30 Mo) : retirez ou réduisez un fichier.",
  trop_images: "Plus de 20 images : retirez-en avant de poser la question.",
  refus: "Claude a refusé cette demande.",
  tronquee: "Réponse tronquée (limite de longueur atteinte) : posez une question plus ciblée.",
  interrompue: "Question interrompue (appli fermée pendant la réponse).",
  inconnue: "Erreur inattendue",
};
export function messageErreur(code, detail = "") { const m = ERREURS[code] || ERREURS.inconnue; return detail ? `${m} : ${detail}` : m; }
// Une question restee « en cours » (appli fermee pendant le flux) devient une erreur, reponse partielle conservee
export function normaliserQuestions(questions = []) {
  return questions.map((q) => (q.etat === "en_cours" ? { ...q, etat: "erreur", erreur: "interrompue" } : q));
}
