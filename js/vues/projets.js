// js/vues/projets.js — projets en cours : « cette semaine », colonnes, prochaine action, attente, checklist
import { ech, ico } from "../format.js";
import { COLONNES, MAX_EN_COURS, parColonne, cetteSemaine, nouveauProjet, avancement } from "../projets.js";
export const titre = () => "Projets en cours";

function carteProjet(p) {
  const av = avancement(p);
  return `<article class="carte projet" data-id="${p.id}">
<b>${ech(p.titre)}</b>${av !== null ? ` <span class="resume">${av} %</span>` : ""}
${p.prochaine ? `<p class="resume">Prochaine action : ${ech(p.prochaine)}</p>` : ""}${p.attente ? `<p class="resume">En attente de : ${ech(p.attente)}</p>` : ""}
${(p.taches || []).length ? `<ul class="checklist">${p.taches.map((t, i) => `<li><label><input type="checkbox" data-tache="${i}" ${t.fait ? "checked" : ""}> ${ech(t.texte)}</label></li>`).join("")}</ul>` : ""}
<details><summary>Modifier</summary>
<label class="champ"><span>Titre</span><input data-champ="titre" value="${ech(p.titre)}"></label>
<label class="champ"><span>Statut</span><select data-champ="statut">${COLONNES.map(([k, l]) => `<option value="${k}" ${k === p.statut ? "selected" : ""}>${l}</option>`).join("")}</select></label>
<label class="champ"><span>Prochaine action</span><input data-champ="prochaine" value="${ech(p.prochaine)}"></label>
<label class="champ"><span>En attente de</span><input data-champ="attente" value="${ech(p.attente)}"></label>
<label class="champ"><span>Ajouter une tâche</span><input data-champ="tache" placeholder="Nouvelle tâche…"></label>
<div class="actions"><button type="button" class="btn" data-enregistrer>${ico("ok")} Enregistrer</button><button type="button" class="btn danger" data-supprimer>Supprimer</button></div>
</details></article>`;
}

export function rendre(etat) {
  const projets = etat.projets;
  if (!projets) return `<p class="vide">Chargement…</p>`;
  const col = parColonne(projets), semaine = cetteSemaine(projets);
  return `<h2 style="margin-top:0">${ico("jour")} Cette semaine</h2>
${semaine.length ? `<ul class="liste">${semaine.map((x) => `<li><b>${ech(x.titre)}</b>${x.prochaine ? `<br><span class="resume">→ ${ech(x.prochaine)}</span>` : ""}${x.attente ? `<br><span class="resume">En attente de : ${ech(x.attente)}</span>` : ""}</li>`).join("")}</ul>` : `<p class="resume">Rien cette semaine.</p>`}
${col.en_cours.length > MAX_EN_COURS ? `<div class="bandeau">${col.en_cours.length} projets en cours : au-delà de ${MAX_EN_COURS}, on se disperse. Passe-en un « En attente » ou « Plus tard ».</div>` : ""}
<div class="nouveau-projet"><label class="champ"><span>Nouveau projet</span><input id="p-nouveau" placeholder="Titre du projet"></label><button type="button" class="btn sec" id="p-ajouter">${ico("plus")} Ajouter</button></div>
<div class="tableau">${COLONNES.map(([k, l]) => `<section class="colonne"><h2>${l} <span class="resume">(${col[k].length})</span></h2>
${k === "fait" || k === "plus_tard" ? `<details><summary>Afficher</summary>${col[k].map(carteProjet).join("")}</details>` : col[k].map(carteProjet).join("") || '<p class="resume">—</p>'}</section>`).join("")}</div>
<p class="resume">Synchronisation avec Todoist : à venir (jeton d'API à fournir).</p>`;
}

export async function monter(root, etat, actions) {
  if (!etat.projets) { await actions.chargerProjets(); return actions.rendre(); }
  const sauver = async (projets) => { await actions.enregistrerProjets(projets); actions.rendre(); };
  root.querySelector("#p-ajouter").addEventListener("click", () => {
    const t = root.querySelector("#p-nouveau").value.trim(); if (t) sauver(nouveauProjet(etat.projets, t));
  });
  for (const art of root.querySelectorAll(".projet")) {
    const id = Number(art.dataset.id), copie = () => etat.projets.map((p) => ({ ...p, taches: [...(p.taches || [])] }));
    for (const c of art.querySelectorAll("[data-tache]")) c.addEventListener("change", () => {
      const ps = copie(), p = ps.find((x) => x.id === id); p.taches[Number(c.dataset.tache)] = { ...p.taches[Number(c.dataset.tache)], fait: c.checked }; sauver(ps);
    });
    art.querySelector("[data-enregistrer]").addEventListener("click", () => {
      const ps = copie(), p = ps.find((x) => x.id === id), v = (n) => art.querySelector(`[data-champ="${n}"]`).value.trim();
      Object.assign(p, { titre: v("titre") || p.titre, statut: v("statut"), prochaine: v("prochaine"), attente: v("attente") });
      if (v("tache")) p.taches.push({ texte: v("tache"), fait: false });
      sauver(ps);
    });
    art.querySelector("[data-supprimer]").addEventListener("click", () => { if (confirm("Supprimer ce projet ?")) sauver(etat.projets.filter((p) => p.id !== id)); });
  }
}
