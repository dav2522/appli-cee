// js/vues/dossier-questions.js — section « Documents & questions » d'un dossier (rendu pur + interactions monter*)
import { ech, ico, mdBloc } from "../format.js";
import { SUGGESTIONS, formaterCout, messageErreur, construireRequete, verifierTaille, nouvelleQuestion } from "../questions.js";
import { chargerPourRequete, lireBlob, supprimerFichier } from "../fichiers.js";
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
  const texte = r.reponse || r.texte || "";
  const corps = texte ? mdBloc(texte) : (r.etat === "en_cours" ? "<p class='resume'>Claude lit les documents…</p>" : "");
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
  root.querySelector("#q-arreter").addEventListener("click", () => ui.controleur?.abort());
  for (const b of root.querySelectorAll("[data-supprimer-q]")) b.addEventListener("click", async () => { d.questions = d.questions.filter((q) => q.id !== b.dataset.supprimerQ); if (ui.reponseCourante?.id === b.dataset.supprimerQ) ui.reponseCourante = null; await actions.enregistrerDossier(d); rafraichir(); });
  for (const b of root.querySelectorAll("[data-reprendre]")) b.addEventListener("click", () => { const q = d.questions.find((x) => x.id === b.dataset.reprendre); if (q) { zone().value = q.question; zone().scrollIntoView({ block: "center" }); zone().focus(); } });
  for (const t of root.querySelectorAll("[data-coller]")) t.addEventListener("change", async () => { const q = d.questions.find((x) => x.id === t.dataset.coller); if (!q) return; q.reponse = t.value.trim(); if (q.reponse) q.etat = "ok"; await actions.enregistrerDossier(d); });
  root.querySelector("#q-poser").addEventListener("click", () => poser(root, etat, actions, d, rafraichir));
}
async function poser(root, etat, actions, d, rafraichir) {
  const ui = etat.ui; const texte = root.querySelector("#q-texte").value.trim(); if (!texte || ui.enCours) return;
  const q = nouvelleQuestion(texte); d.questions = d.questions || []; d.questions.push(q); ui.brouillonQuestion = "";
  const f = etat.index[d.fiche];
  if (!etat.reglages.cle_api) {   // sans cle : partage vers l'appli Claude, reponse a coller dans l'historique
    const { partager } = await import("../partage.js");
    const objets = await objetsDuDossier(actions.stockage, d);
    const r = await partager({ titre: d.titre || "Question CEE", texte: (f ? `Fiche CEE ${f.code} — ${f.titre}\n\n` : "") + texte + (d.devis_texte && !objets.length ? "\n\nTexte du document :\n" + d.devis_texte.slice(0, 12000) : ""), fichiers: objets });
    if (r === "annule" || r === "echec") { d.questions.pop(); ui.reponseCourante = { ...q, etat: "erreur", erreur: r === "annule" ? "arret" : "reseau" }; rafraichir(); return; }
    q.etat = "partage"; ui.reponseCourante = q; await actions.enregistrerDossier(d); rafraichir(); return;
  }
  ui.enCours = true; ui.reponseCourante = q; rafraichir();
  const zoneRep = () => root.querySelector(".q-courante .q-reponse");
  try {
    const { fichiers, manquants } = await chargerPourRequete(actions.stockage, d.fichiers || []);
    const refus = verifierTaille(fichiers); if (refus) throw Object.assign(new Error(refus), { code: refus });
    let texteOfficiel = ""; if (f) { try { texteOfficiel = (await actions.chargerTexte(f.secteur))[f.code] || ""; } catch { /* hors ligne : sans extraits */ } }
    const requete = construireRequete({ fichiers, texteExtrait: d.devis_texte || "", questions: d.questions.filter((x) => x.id !== q.id), question: texte, fiche: f, texteOfficiel, avis: etat.donnees?.avis?.fiches?.[f?.code] });
    if (manquants.length || requete.ignores.length) root.querySelector("#q-etat").textContent = "Non envoyés : " + [...manquants, ...requete.ignores].join(", ");
    const { demander } = await import("../claude.js");
    ui.controleur = new AbortController();
    let minuterie = null;
    const r = await demander({ cle: etat.reglages.cle_api, requete, signal: ui.controleur.signal, surTexte: (t) => { q.reponse += t; if (!minuterie) minuterie = setTimeout(() => { minuterie = null; const z = zoneRep(); if (z) z.innerHTML = mdBloc(q.reponse); }, 150); } });
    q.reponse = r.texte || q.reponse; q.usage = r.usage; q.modele = r.modele; q.stop = r.stop;
    q.etat = r.stop === "refusal" ? "erreur" : "ok"; if (r.stop === "refusal") q.erreur = "refus";
  } catch (e) {
    const { classerErreur, detailErreur } = await import("../claude.js");
    q.etat = "erreur"; q.erreur = e.code || classerErreur(e); q.detail = q.erreur === "requete" || q.erreur === "inconnue" ? detailErreur(e) : "";
  }
  ui.enCours = false; ui.controleur = null; ui.reponseCourante = q;
  await actions.enregistrerDossier(d); rafraichir();
}
