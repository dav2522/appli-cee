// js/jour.js — rubriques du jour a partir de delta_du_jour (pur)
import { dateFr } from "./format.js";
const jma = (d) => dateFr(d) || "?";
function fiche(x, extra = "") { return { code: x.code, texte: (x.nom || "") + extra, url: x.url_pdf_officiel }; }
export function rubriquesDuJour(delta) {
  const d = delta || {};
  const rg = d.reglementaire || {};
  const out = [];
  const pousser = (cle, titre, icone, items) => { if (items && items.length) out.push({ cle, titre, icone, items }); };
  const abrogJo = (rg.jo || []).flatMap((t) => Object.entries(t.fiches || {}).filter(([, a]) => a === "abrogée")
    .map(([code]) => ({ code, texte: "abrogée au Journal officiel du " + jma(t.date_publication) + (t.date_application ? ", applicable le " + jma(t.date_application) : ""), url: t.url })));
  pousser("arretees", "Fiches arrêtées ou supprimées", "alerte", [...(d.arretees || []).map((x) => fiche(x, " — " + (x.abrogee_au ? "abrogée au " + jma(x.abrogee_au) : "fin de validité " + jma(x.fin_validite)))), ...abrogJo]);
  pousser("jo", "Journal officiel", "fiches", (rg.jo || []).map((t) => ({ texte: (t.titre || t.cle) + " — JO du " + jma(t.date_publication) + (t.date_application ? ", applicable le " + jma(t.date_application) : ""),
    sous: Object.entries(t.fiches || {}).map(([c, a]) => c + " " + a).join(", "), url: t.url })));
  const cdp = d.coup_de_pouce || {};
  pousser("cdp_perdu", "Coup de pouce perdu", "alerte", (cdp.perdu || []).map((x) => fiche(x, " — " + (x.programmes || []).join(", "))));
  pousser("cdp_gagne", "Coup de pouce gagné", "jour", (cdp.gagne || []).map((x) => fiche(x, " — " + (x.programmes || []).join(", "))));
  pousser("revisions", "Révisions", "fiches", (d.revisions || []).map((x) => fiche(x, " — " + x.version_avant + " → " + x.version + (x.en_vigueur ? "" : ", applicable le " + jma(x.applicable_depuis)))));
  pousser("nouvelles", "Nouvelles fiches", "plus", (d.nouvelles || []).map((x) => fiche(x, " — " + (x.version || ""))));
  pousser("a_venir", "À venir", "sablier", (d.a_venir || []).map((x) => fiche(x, " — applicable le " + jma(x.applicable_depuis) + " (J-" + x.jours + ")")));
  const sup = d.suppressions || {};
  pousser("suppressions", "Suppressions annoncées", "alerte", [...(sup.nouvelles_candidates || []).map((x) => fiche(x, " — candidate à la suppression (DGEC)")),
    ...(sup.projets_en_cours || []).map((s) => ({ texte: (s.reference || "projet") + " : " + (s.nb_fiches ?? "?") + " fiches — consultation jusqu'au " + jma(s.consultation_fin) + (s.jours_avant_fin_consultation >= 0 ? " (J-" + s.jours_avant_fin_consultation + ")" : " (close)"), sous: s.note, url: s.source }))]);
  pousser("fins", "Fins programmées", "sablier", (d.fin_programmee || []).map((x) => fiche(x, " — " + jma(x.date) + " (J-" + x.jours + ", " + x.motif + ")")));
  const ad = d.calculateur_ademe || {};
  pousser("ademe_retirees", "Retirées du calculateur ADEME", "alerte", (ad.retirees || []).map((x) => fiche(x, " — statut DGEC : " + x.statut)));
  pousser("ademe_ajoutees", "Ajoutées au calculateur ADEME", "plus", (ad.ajoutees || []).map((x) => fiche(x)));
  const co = d.consultations || {};
  const cons = (c) => ({ texte: c.titre, sous: "du " + jma(c.debut) + " au " + jma(c.fin) + (c.jours_restants >= 0 ? " (J-" + c.jours_restants + ")" : "") + ((c.fiches_citees || []).length ? " · " + c.fiches_citees.length + " fiche(s) : " + c.fiches_citees.slice(0, 8).join(", ") + (c.fiches_citees.length > 8 ? "…" : "") : ""), url: c.url, id: c.id });
  const nouvellesIds = new Set((co.nouvelles || []).map((c) => c.id));
  pousser("consultations_nouvelles", "Nouvelles consultations publiques", "plus", (co.nouvelles || []).map(cons));
  pousser("consultations", "Consultations CEE en cours", "echeances", (co.en_cours || []).filter((c) => !nouvellesIds.has(c.id)).map(cons));
  pousser("documents_modifies", "Documents modifiés à URL inchangée", "fichier", (rg.documents_modifies || []).map((x) => ({ texte: (x.genre || "") + " " + (x.ref || ""), sous: x.url, url: x.url })));
  pousser("atee", "ATEE / Club C2E", "fiches", [...(rg.atee_documents || []).map((x) => ({ texte: x.libelle, sous: x.secteur, url: x.url })), ...(rg.webinaires || []).map((x) => ({ texte: x.libelle, sous: jma(x.date) }))]);
  pousser("actus", "Actualités", "fiches", (rg.editorial || []).map((x) => ({ texte: x.titre, sous: x.source + (x.note ? " · " + x.note : ""), url: x.url })));
  return out;
}
export function nettoyerTelegram(html) {
  return String(html || "").replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<(?!\/?(b|i|code)>|a href="https?:\/\/[^"]+"|\/a>)[^>]*>/gi, "").replace(/\n/g, "<br>");
}
