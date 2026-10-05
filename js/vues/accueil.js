// js/vues/accueil.js — vue d'ensemble : actus CEE, derniers résumés vidéo, projets de la semaine
import { ech, ico, dateFr } from "../format.js";
import { rubriquesDuJour } from "../jour.js";
import { tuilesCee } from "./aujourdhui.js";
import { ETATS, depuis } from "../videos.js";
import { cetteSemaine } from "../projets.js";
export const titre = () => "Accueil";
export function rendre(etat) {
  const d = etat.donnees, h = [];
  h.push(`<div class="actions"><a class="btn" href="#/videos">${ico("video")} Résumer une vidéo</a><a class="btn sec" href="#/dossier/nouveau">${ico("plus")} Nouvelle expertise</a></div>`);
  h.push(`<h2>${ico("solhy")} Actus CEE</h2>`);
  if (!d) h.push(`<p class="resume">Données CEE pas encore chargées.</p>`);
  else {
    const rub = rubriquesDuJour(d.jour?.delta);
    h.push(`<p class="resume">Veille du <b>${dateFr(d.meta.donnees_du)}</b>${rub.length ? "" : " · journée calme"}</p>${tuilesCee(d)}`);
    if (rub.length) h.push(`<ul class="liste">${rub.slice(0, 6).map((r) => `<li><a href="#/aujourdhui">${ech(r.titre)}</a> <span class="resume">(${r.items.length})</span></li>`).join("")}</ul>`);
    h.push(`<p><a href="#/aujourdhui">Voir toute la veille du jour</a></p>`);
  }
  const v = (etat.videos || []).slice(0, 3);
  h.push(`<h2>${ico("video")} Derniers résumés vidéo</h2>`);
  h.push(v.length ? `<ul class="liste">${v.map((x) => `<li><a class="carte-lien" href="#/video/${x.id}"><b>${ech(x.titre || x.lien)}</b><br><span class="resume">${ech(x.chaine)} · <span class="st ${x.etat === "terminee" ? "ok" : x.etat === "echec" ? "bad" : "warn"}">${ech((ETATS[x.etat] || {}).lib || x.etat)}</span> · ${depuis(x.maj_le)}</span></a></li>`).join("")}</ul>`
    : `<p class="resume">Aucun résumé pour l'instant.</p>`);
  const p = cetteSemaine(etat.projets || []).slice(0, 5);
  h.push(`<h2>${ico("projets")} Projets : cette semaine</h2>`);
  h.push(p.length ? `<ul class="liste">${p.map((x) => `<li><a href="#/projets">${ech(x.titre)}</a>${x.prochaine ? `<br><span class="resume">→ ${ech(x.prochaine)}</span>` : ""}${x.attente ? `<br><span class="resume">En attente de : ${ech(x.attente)}</span>` : ""}</li>`).join("")}</ul>`
    : `<p class="resume">Rien de prévu.</p>`);
  return h.join("\n");
}
export function monter(root, etat, actions) {
  if (!etat.videos) actions.chargerVideos().then(() => actions.rendre());
  if (!etat.projets) actions.chargerProjets().then(() => actions.rendre());
}
