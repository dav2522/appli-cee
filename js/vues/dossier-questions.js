// js/vues/dossier-questions.js — section « Documents & questions » d'un dossier (rendu pur + interactions monter*)
import { ech, ico, mdBloc } from "../format.js";
import { SUGGESTIONS, MESSAGES_PARTAGE, texteAPartager, nouvelleQuestion } from "../questions.js";
import { lireBlob, supprimerFichier } from "../fichiers.js";
const ko = (o) => Math.max(1, Math.round((o || 0) / 1024)) + " Ko";
const heure = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); };
export function rendreDocuments(d, ui = {}) {
  const vu = ui.fichierVu ?? 0;
  const liste = d.fichiers.length ? `<ul class="docs">${d.fichiers.map((f, i) => `<li><button type="button" class="doc" data-voir="${i}" aria-pressed="${i === vu}">${ico("fichier")} <span>${ech(f.nom)}</span> <small>${ko(f.taille)}${f.cle ? "" : " · non conservé : réimporter"}</small></button><button type="button" class="x" data-retirer="${i}" aria-label="Retirer ${ech(f.nom)}">${ico("x")}</button></li>`).join("")}</ul>` : `<p class="vide">Aucun document. Ajoutez un devis, une étude ou une photo, ou partagez-les depuis une autre appli.</p>`;
  return `<section id="docs-zone"><h2>Documents</h2>${liste}
<div class="actions"><label class="btn sec" for="d-plus">${ico("plus")} Ajouter (PDF, photo, texte)</label><input id="d-plus" type="file" accept="application/pdf,image/*,text/plain" multiple class="sr"></div>
<div id="v-zone" class="visionneuse" ${d.fichiers.length ? "" : "hidden"}></div></section>`;
}
export function rendreHistorique(d) {
  const qs = [...(d.questions || [])].reverse();
  const n = qs.length;
  return `<details id="q-historique"><summary>Historique — ${n} question${n > 1 ? "s" : ""}</summary>${n ? `<ul class="historique">${qs.map((q) => `<li class="hist"><div class="hist-tete"><span class="resume">${heure(q.le)}</span><span class="actions-mini"><button type="button" class="lien" data-reprendre="${ech(q.id)}">Reprendre</button><button type="button" class="lien" data-supprimer-q="${ech(q.id)}">Supprimer</button></span></div><p class="q-question">${ech(q.question)}</p>
${q.reponse ? `<details><summary>Réponse de Claude</summary><div class="q-reponse">${mdBloc(q.reponse)}</div></details>` : `<textarea data-coller="${ech(q.id)}" rows="4" placeholder="Colle ici la réponse de Claude"></textarea>`}</li>`).join("")}</ul>` : "<p class='vide'>Aucune question pour l'instant.</p>"}</details>`;
}
export function rendreQuestions(etat, d) {
  const ui = etat.ui || {};
  return `<section id="q-zone"><h2>Question à Claude</h2>
<div class="filtres">${SUGGESTIONS.map((s, i) => `<button type="button" data-sugg="${i}">${ech(s.titre)}</button>`).join("")}</div>
<textarea id="q-texte" rows="3" placeholder="Votre question sur ces documents…">${ech(ui.brouillonQuestion || "")}</textarea>
<div class="actions"><button type="button" class="btn" id="q-ouvrir">${ico("partage")} Ouvrir dans Claude</button></div>
<p id="q-etat" class="resume" aria-live="polite">${ech(ui.messageQuestion || "La question et les documents s'ouvrent dans l'appli Claude (ton abonnement), qui consulte les données CEE grâce au connecteur « Appli CEE ».")}</p>
${rendreHistorique(d)}</section>`;
}

// ---- interactions (navigateur) ----
// Fichiers du dossier sous forme de File (partage Web Share)
export async function objetsDuDossier(stockage, d) {
  const objets = [];
  for (const e of d.fichiers || []) { const b = await lireBlob(stockage, e.cle); if (b) objets.push(new File([b], e.nom, { type: e.type })); }
  return objets;
}
export async function monterDocuments(root, etat, actions, d, { surAjout, surRetrait }) {
  const zone = root.querySelector("#v-zone"); const ui = etat.ui;
  if (ui.demonterVue) { ui.demonterVue(); ui.demonterVue = null; }
  const voir = async (i) => {
    ui.fichierVu = i; for (const b of root.querySelectorAll("[data-voir]")) b.setAttribute("aria-pressed", String(Number(b.dataset.voir) === i));
    if (ui.demonterVue) { ui.demonterVue(); ui.demonterVue = null; }
    const f = d.fichiers[i]; const blob = f && await lireBlob(actions.stockage, f.cle);
    if (!blob) { zone.hidden = !f; zone.innerHTML = f ? "<div class='barre'><span>Fichier non conservé : réimportez-le.</span></div>" : ""; return; }
    const { monterVisionneuse } = await import("../visionneuse.js"); ui.demonterVue = await monterVisionneuse(zone, { blob, type: f.type, nom: f.nom });
  };
  for (const b of root.querySelectorAll("[data-voir]")) b.addEventListener("click", () => voir(Number(b.dataset.voir)));
  for (const b of root.querySelectorAll("[data-retirer]")) b.addEventListener("click", async () => { const i = Number(b.dataset.retirer); const f = d.fichiers[i]; if (!confirm("Retirer " + f.nom + " du dossier ?")) return; if (f.cle) await supprimerFichier(actions.stockage, f.cle); d.fichiers.splice(i, 1); await surRetrait(); });
  root.querySelector("#d-plus").addEventListener("change", (e) => surAjout([...e.target.files]));
  if (d.fichiers.length) voir(Math.min(ui.fichierVu ?? 0, d.fichiers.length - 1));
}
export function monterQuestions(root, etat, actions, d, { rafraichir }) {
  const ui = etat.ui;
  const zone = () => root.querySelector("#q-texte");
  for (const b of root.querySelectorAll("[data-sugg]")) b.addEventListener("click", () => { zone().value = SUGGESTIONS[Number(b.dataset.sugg)].texte; zone().focus(); });
  for (const b of root.querySelectorAll("[data-supprimer-q]")) b.addEventListener("click", async () => { d.questions = d.questions.filter((q) => q.id !== b.dataset.supprimerQ); await actions.enregistrerDossier(d); rafraichir(); });
  for (const b of root.querySelectorAll("[data-reprendre]")) b.addEventListener("click", () => { const q = d.questions.find((x) => x.id === b.dataset.reprendre); if (q) { zone().value = q.question; zone().scrollIntoView({ block: "center" }); zone().focus(); } });
  for (const t of root.querySelectorAll("[data-coller]")) t.addEventListener("change", async () => { const q = d.questions.find((x) => x.id === t.dataset.coller); if (!q || !t.value.trim()) return; q.reponse = t.value.trim(); q.etat = "ok"; ui.brouillonQuestion = zone().value; await actions.enregistrerDossier(d); rafraichir(); });
  root.querySelector("#q-ouvrir").addEventListener("click", async () => {
    const texte = zone().value.trim(); if (!texte) { zone().focus(); return; }
    const { partager } = await import("../partage.js");
    const fichiers = await objetsDuDossier(actions.stockage, d);
    const r = await partager({ titre: d.titre || "Question CEE", texte: texteAPartager({ question: texte, fiche: etat.index[d.fiche], fichiers: fichiers.map((f) => ({ nom: f.name })), texteExtrait: d.devis_texte || "" }), fichiers });
    ui.messageQuestion = MESSAGES_PARTAGE[r];
    if (r === "partage" || r === "copie") { d.questions = d.questions || []; d.questions.push(nouvelleQuestion(texte)); ui.brouillonQuestion = ""; await actions.enregistrerDossier(d); }
    else ui.brouillonQuestion = texte;
    rafraichir();
  });
}
