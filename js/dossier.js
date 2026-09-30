// js/dossier.js — suggestion de fiches, parametres d'un devis, dossier d'expertise (pur)
import { normaliser } from "./fiches.js";
import { dateFr, giga } from "./format.js";
export const DEVIS_MAX = 12000;
const CODE_RE = /\b(?:BAR|BAT|IND|AGRI|TRA|RES)-[A-Z]{2}-\d{3}\b/g;
const VIDES = new Set(["de", "des", "du", "la", "le", "les", "un", "une", "et", "ou", "en", "a", "au", "aux", "d", "l", "par", "pour", "sur", "type", "avec", "sans", "dans", "d'un", "d'une", "mise", "place", "systeme", "installation", "existant", "existante", "neuf", "neuve"]);
const SECTEURS = { BAT: /\b(tertiaire|bureau|ehpad|ecole|hopital|hotel|commerce|entrepot|gymnase|mairie|clinique)\b/, BAR: /\b(logement|residentiel|copropriete|maison|appartement|immeuble d'habitation|bailleur|hlm)\b/, IND: /\b(industrie|industriel|usine|atelier|process|site de production)\b/, AGRI: /\b(agricole|serre|exploitation|elevage|maraich)\b/, TRA: /\b(camion|poids lourd|vehicule|bateau|bus|autocar|transport)\b/, RES: /\b(reseau de chaleur|eclairage public|reseau)\b/ };
function mots(s) { return normaliser(s).replace(/[^a-z0-9' ]/g, " ").split(" ").filter((m) => m.length > 2 && !VIDES.has(m)); }

export function suggererFiches(texte, fiches, n = 5) {
  const t = normaliser(texte || "");
  if (!t) return [];
  const cites = new Set((String(texte).toUpperCase().match(CODE_RE) || []));
  const motsTexte = new Set(mots(t));
  const secteurs = Object.entries(SECTEURS).filter(([, re]) => re.test(t)).map(([s]) => s);
  const out = [];
  for (const f of fiches) {
    if (f.statut !== "active") continue;
    let score = 0; const raisons = [];
    if (cites.has(f.code)) { score = 100; raisons.push("code cité dans le document"); }
    const cles = new Set([...mots(f.titre), ...mots(f.nom || ""), ...mots(f.carte?.resume || ""), ...(f.carte?.params || []).flatMap(mots)]);
    const communs = [...cles].filter((m) => motsTexte.has(m));
    if (communs.length) { score += Math.min(60, communs.length * 12); raisons.push("mots-clés : " + communs.slice(0, 6).join(", ")); }
    if (secteurs.includes(f.secteur)) { score += 15; raisons.push("secteur " + f.secteur); }
    if (score > 0) out.push({ code: f.code, score, raisons });
  }
  return out.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code)).slice(0, n);
}

function nombre(s) { return s == null ? null : parseFloat(String(s).replace(/\s/g, "").replace(",", ".")); }
export function extraireParametres(texte) {
  const t = String(texte || "");
  const n = normaliser(t);
  const prem = (re) => { const m = t.match(re); return m ? nombre(m[1]) : null; };
  const NUM = "(\\d{1,3}(?:[ \\u00a0.]\\d{3})*(?:,\\d{2})?)";
  const lireMontant = (m) => nombre(m[1].replace(/[ \u00a0.]/g, "").replace(",", "."));
  const montants = [...[...t.matchAll(new RegExp(NUM + "\\s*€?\\s*(?:HT|H\\.T\\.)", "gi"))].map(lireMontant),        // « 148 500 € HT »
    ...[...t.matchAll(new RegExp("(?:HT|H\\.T\\.)\\s*:?\\s*" + NUM + "(?![\\d,])", "gi"))].map(lireMontant)];       // « total HT : 148 500,00 € »
  return {
    puissance_kw: prem(/(\d{1,4}(?:[.,]\d+)?)\s*kW(?!h)/i),
    surface_m2: prem(/(\d{1,3}(?:[ \u00a0]?\d{3})*)\s*m(?:²|2(?!\d))/i),
    etas: prem(/etas\s*[:=]?\s*(?:≥|>=)?\s*(\d{2,3}(?:[.,]\d+)?)\s*%/i),
    cop: prem(/\bcop\s*[:=]?\s*(?:≥|>=)?\s*(\d(?:[.,]\d+)?)/i),
    scop: prem(/\bscop\s*[:=]?\s*(?:≥|>=)?\s*(\d(?:[.,]\d+)?)/i),
    zone: (t.match(/\bzone\s*(?:climatique)?\s*(H[123])\b/i) || [])[1]?.toUpperCase() || null,
    montant_ht: montants.length ? Math.max(...montants) : null,
    energie: /\bfioul\b/.test(n) ? "fioul" : /\bgaz\b/.test(n) ? "gaz" : /\bcharbon\b/.test(n) ? "charbon" : /\bbiomasse|granul|bois\b/.test(n) ? "bois" : /\belectri/.test(n) ? "électricité" : null,
    secteur: SECTEURS.BAT.test(n) ? "tertiaire" : SECTEURS.BAR.test(n) ? "résidentiel" : SECTEURS.IND.test(n) ? "industrie" : SECTEURS.AGRI.test(n) ? "agriculture" : null,
  };
}

function section(texte, debut, fins, max = 6000) {
  const t = String(texte || "");
  const m = t.match(debut); if (!m) return "";
  let s = t.slice(m.index);
  const j = Math.min(...fins.map((re) => { const x = s.slice(m[0].length).search(re); return x < 0 ? s.length : x + m[0].length; }));
  s = s.slice(0, j).trim();
  return s.length > max ? s.slice(0, max) + "\n[…]" : s;
}
// Extraits du texte officiel utiles a une expertise : conditions de delivrance et bareme (aussi utilises par questions.js)
export function sectionsTexte(texteOfficiel) {
  return { conditions: section(texteOfficiel, /\d\.\s*Conditions pour la d[ée]livrance/i, [/\n\s*\d\.\s*Dur[ée]e de vie/i, /\n\s*\d\.\s*Montant de certificats/i]),
    bareme: section(texteOfficiel, /\d\.\s*Montant de certificats/i, [/Annexe 1/i], 4000) };
}
const LIB = { puissance_kw: "Puissance", surface_m2: "Surface", etas: "Etas (%)", cop: "COP", scop: "SCOP", zone: "Zone climatique", montant_ht: "Montant HT du devis (€)", energie: "Énergie remplacée", secteur: "Secteur" };
export function construireDossier({ fiche, texteOfficiel, parametres = {}, devisTexte = "", fichiers = [], avis, aujourdhui = new Date().toISOString().slice(0, 10) }) {
  const c = fiche.carte || {};
  const { conditions: cond, bareme } = sectionsTexte(texteOfficiel);
  let devis = String(devisTexte || "").trim();
  const tronque = devis.length > DEVIS_MAX;
  if (tronque) devis = devis.slice(0, DEVIS_MAX) + "\n[texte du devis tronqué à " + DEVIS_MAX + " caractères]";
  const params = Object.entries(parametres).filter(([, v]) => v != null && v !== "").map(([k, v]) => `- ${LIB[k] || k} : ${typeof v === "number" ? v.toLocaleString("fr-FR") : v}${k === "puissance_kw" ? " kW" : k === "surface_m2" ? " m²" : ""}`);
  const joints = fichiers.map((f) => `- ${f.nom} (${f.type || "?"}, ${Math.round((f.taille || 0) / 1024)} Ko) — joint au partage`);
  const L = [];
  L.push(`# Expertise CEE — ${fiche.code} · ${fiche.titre}`, `Dossier préparé le ${dateFr(aujourdhui)} par l'Appli CEE de Solhy Énergie.`, " ",
    "## Mission", "Tu es expert du dispositif des certificats d'économies d'énergie (CEE) en France. À partir du devis (ou de l'étude) ci-dessous et du texte officiel de la fiche, produis une expertise complète, structurée, chiffrée et prudente (signale chaque hypothèse). Réponds en français, dans cet ordre :",
    "1. **Conformité** : point par point, chaque condition de la fiche est-elle remplie par le devis ? Ce qui manque ou doit être corrigé.",
    "2. **Calcul** : kWh cumac selon le barème de la fiche (montre le calcul avec les paramètres), puis prime à **7 €/MWh cumac**, Coup de pouce inclus seulement si ses conditions sont remplies (coefficient de la charte), plafond ×5.",
    "3. **0 € atteignable ?** : T = aides ÷ coût total HT ; T ≥ 100 % → oui ; 85–100 % → incertain, reste à charge en € ; < 85 % → non.",
    "4. **Coûts de marché** : le devis est-il dans les fourchettes habituelles (matériel, pose, études, dépose) ? Écarts et leviers pour réduire le coût à prime égale.",
    "5. **Qui contacter pour la pose** : qualifications exigées (RGE, OPQIBI, autres), types d'entreprises, ordre de grandeur des délais.",
    "6. **Marques et produits éligibles** : références courantes répondant aux seuils (Etas, COP, classe…) avec ordre de prix.",
    "7. **Pièces et risques** : justificatifs à réunir (dépose, attestation, étude, contrôle sur site), dates de fin de fiche, pièges connus.",
    " ", "## Fiche", `- Code : ${fiche.code} — ${fiche.titre}${fiche.nom ? " (" + fiche.nom + ")" : ""}`, `- Version : ${fiche.version || "?"}${fiche.applicable_depuis ? ", applicable depuis le " + dateFr(fiche.applicable_depuis) : ""}`,
    `- Coup de pouce : ${(fiche.cdp?.cp || 1) > 1 ? "×" + fiche.cdp.cp + " (" + (fiche.cdp.programmes || []).join(", ") + ")" : "aucun"}`,
    fiche.fin_proche ? `- Fin de la fiche : ${fiche.fin_proche.au_plus_tot ? "au plus tôt le " : ""}${dateFr(fiche.fin_proche.date)}` : fiche.fins?.fin_texte ? `- Fin écrite dans la fiche : ${dateFr(fiche.fins.fin_texte)}` : "",
    c.resume ? `- Résumé : ${c.resume}` : "", c.gwh != null ? `- Cas optimal de référence : ${(c.cas?.seg || []).join(" · ")} → ≈ ${giga(c.gwh)}` : "",
    c.verifier?.length ? "- À vérifier :\n" + c.verifier.map((x) => "  - " + x).join("\n") : "", c.leviers?.length ? "- Leviers :\n" + c.leviers.map((x) => "  - " + x).join("\n") : "",
    c.cout?.postes?.length ? "- Coûts habituels (HT) :\n" + c.cout.postes.map((p) => `  - ${p[0]} : ${p[1]} – ${p[2]} €`).join("\n") : "",
    avis?.commentaire ? `- Note de Solhy : ${avis.commentaire}` : "",
    " ", "### Extraits du texte officiel", cond ? cond : "(conditions non disponibles hors ligne : voir le PDF officiel)", " ", bareme ? bareme : "",
    " ", "## Paramètres relevés dans le devis", params.length ? params.join("\n") : "- (aucun paramètre détecté automatiquement)",
    " ", "## Devis", devis || "(pas de texte extrait : lire le fichier joint)", " ", "## Fichiers", joints.length ? joints.join("\n") : "- aucun");
  return L.filter((x) => x !== "").map((x) => (x === " " ? "" : x)).join("\n");
}
export function nouveauDossier(partiel = {}) {
  const maintenant = new Date().toISOString();
  return { id: "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), cree_le: maintenant, maj_le: maintenant, titre: partiel.titre || "", fiche: partiel.fiche || "", parametres: partiel.parametres || {}, devis_texte: partiel.devis_texte || "", fichiers: partiel.fichiers || [], dossier: partiel.dossier || "", reponse: partiel.reponse || "", etat: "brouillon" };
}
