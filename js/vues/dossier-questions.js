// js/vues/dossier-questions.js — section « Documents & questions » d'un dossier (rendu pur ; interactions dans monter*)
import { ech, ico, mdBloc } from "../format.js";
import { SUGGESTIONS, formaterCout, messageErreur } from "../questions.js";
const ko = (o) => Math.max(1, Math.round((o || 0) / 1024)) + " Ko";
const heure = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); };
export function libellePoser(etat) { return etat.reglages.cle_api ? "Poser la question" : "Partager la question vers Claude"; }
export function rendreDocuments(d, ui = {}) {
  const vu = ui.fichierVu ?? 0;
  const liste = d.fichiers.length ? `<ul class="docs">${d.fichiers.map((f, i) => `<li><button type="button" class="doc" data-voir="${i}" aria-pressed="${i === vu}">${ico("fichier")} <span>${ech(f.nom)}</span> <small>${ko(f.taille)}${f.cle ? "" : " · non conservé : réimporter"}</small></button><button type="button" class="x" data-retirer="${i}" aria-label="Retirer ${ech(f.nom)}">${ico("x")}</button></li>`).join("")}</ul>` : `<p class="vide">Aucun document. Ajoutez un devis, une étude ou une photo, ou partagez-les depuis une autre appli.</p>`;
  return `<section id="docs-zone"><h2>Documents</h2>${liste}
<div class="actions"><label class="btn sec" for="d-plus">${ico("plus")} Ajouter (PDF, photo, texte)</label><input id="d-plus" type="file" accept="application/pdf,image/*,text/plain" multiple class="sr"></div>
<div id="v-zone" class="visionneuse" ${d.fichiers.length ? "" : "hidden"}></div></section>`;
}
function rendreReponse(ui) {
  const r = ui.reponseCourante; if (!r) return "";
  const corps = r.texte ? mdBloc(r.texte) : (r.etat === "en_cours" ? "<p class='resume'>Claude lit les documents…</p>" : "");
  const pied = r.etat === "erreur" ? `<p class="bandeau bad">${ech(messageErreur(r.erreur, r.detail))}</p>` : r.etat === "partage" ? `<p class="resume">Question partagée vers Claude : collez la réponse dans l'historique ci-dessous.</p>` : r.usage ? `<p class="resume">${ech(formaterCout(r.usage))}${r.stop === "max_tokens" ? " · " + ech(messageErreur("tronquee")) : ""}</p>` : "";
  return `<div class="q-courante"><p class="q-question">${ech(r.question)}</p><div class="q-reponse">${corps}</div>${pied}</div>`;
}
export function rendreHistorique(d) {
  const qs = [...(d.questions || [])].reverse();
  const n = qs.length;
  return `<details id="q-historique"><summary>Historique — ${n} question${n > 1 ? "s" : ""}</summary>${n ? `<ul class="historique">${qs.map((q) => `<li class="hist ${ech(q.etat)}"><div class="hist-tete"><span class="resume">${heure(q.le)}</span><span class="actions-mini"><button type="button" class="lien" data-reprendre="${ech(q.id)}">Reprendre</button><button type="button" class="lien" data-supprimer-q="${ech(q.id)}">Supprimer</button></span></div><p class="q-question">${ech(q.question)}</p>
${q.etat === "partage" ? `<textarea data-coller="${ech(q.id)}" rows="4" placeholder="Collez ici la réponse de Claude">${ech(q.reponse || "")}</textarea>` : `<details><summary>${q.etat === "erreur" ? "Erreur : " + ech(messageErreur(q.erreur, q.detail)) : "Réponse"}</summary><div class="q-reponse">${mdBloc(q.reponse || "")}</div>${q.usage ? `<p class="resume">${ech(formaterCout(q.usage))}</p>` : ""}</details>`}</li>`).join("")}</ul>` : "<p class='vide'>Aucune question pour l'instant.</p>"}</details>`;
}
export function rendreQuestions(etat, d) {
  const ui = etat.ui || {};
  return `<section id="q-zone"><h2>Question à Claude</h2>
<div class="filtres">${SUGGESTIONS.map((s, i) => `<button type="button" data-sugg="${i}">${ech(s.titre)}</button>`).join("")}</div>
<textarea id="q-texte" rows="3" placeholder="Votre question sur ces documents…">${ech(ui.brouillonQuestion || "")}</textarea>
<div class="actions"><button type="button" class="btn" id="q-poser" ${ui.enCours ? "disabled" : ""}>${ico(etat.reglages.cle_api ? "com" : "partage")} ${libellePoser(etat)}</button><button type="button" class="btn sec" id="q-arreter" ${ui.enCours ? "" : "hidden"}>Arrêter</button></div>
<p id="q-etat" class="resume" aria-live="polite">${etat.reglages.cle_api ? "" : "Sans clé API (Réglages), la question et les documents sont partagés vers l'appli Claude."}</p>
${rendreReponse(ui)}
${rendreHistorique(d)}</section>`;
}
