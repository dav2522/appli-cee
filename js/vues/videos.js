// js/vues/videos.js — coller un lien, suivre l'état réel, lire la fiche illustrée (deux volets sur grand écran)
import { ech, ico, dateFr } from "../format.js";
import { ETATS, enCours, depuis, identifiantYoutube } from "../videos.js";
export const titre = (etat) => (etat.route.vue === "video" ? "Fiche vidéo" : "Vidéos");
const classeEtat = (e) => (e === "terminee" ? "ok" : e === "echec" ? "bad" : "warn");

function liste(etat, choisie) {
  const v = etat.videos || [];
  if (!v.length) return `<p class="vide">Aucune vidéo pour l'instant. Colle un lien YouTube ci-dessus, ou partage une vidéo depuis l'appli YouTube vers cette appli.</p>`;
  return `<ul class="liste videos">${v.map((x) => `<li${String(x.id) === String(choisie) ? ' aria-current="true"' : ""}><a class="carte-lien" href="#/video/${x.id}">
<b>${ech(x.titre || x.lien)}</b><br><span class="resume">${ech(x.chaine)}${x.chaine ? " · " : ""}<span class="st ${classeEtat(x.etat)}">${ech((ETATS[x.etat] || {}).lib || x.etat)}</span> · ${depuis(x.maj_le)}</span></a></li>`).join("")}</ul>`;
}

function formulaire(p) {
  return `<form id="v-form" class="carte" autocomplete="off"><label class="champ"><span>Lien de la vidéo YouTube</span>
<input id="v-lien" type="url" inputmode="url" placeholder="https://www.youtube.com/watch?v=…" value="${ech(p.lien || "")}" required></label>
<div class="actions"><button class="btn" type="submit">${ico("video")} Résumer</button></div><p id="v-msg" class="resume" aria-live="polite"></p></form>`;
}

function detail(etat, v) {
  if (!v) return `<p class="vide">Choisis une vidéo dans la liste.</p>`;
  const e = ETATS[v.etat] || { lib: v.etat, fini: true };
  const h = [`<p class="resume"><a href="${ech(v.lien)}" target="_blank" rel="noopener">${ech(v.titre || v.lien)}</a><br>${ech(v.chaine)} · demandée le ${dateFr(v.cree_le)}</p>`,
    `<p><span class="st ${classeEtat(v.etat)}">${ech(e.lib)}</span> <span class="resume">mis à jour ${depuis(v.maj_le)}</span></p>`];
  if (!e.fini) h.push(`<p class="resume">Gemini lit la vidéo : 2 à 3 min pour 10 min de vidéo. Cet écran se met à jour tout seul.</p>`);
  if (v.etat === "echec") h.push(`<div class="bandeau bad">${ech(v.message)}</div><div class="actions"><button class="btn sec" id="v-reessayer" type="button">Réessayer</button></div>`);
  if (v.etat === "terminee") h.push(`<div class="actions"><button class="btn sec" id="v-relancer" type="button">Relancer la synthèse</button><button class="btn danger" id="v-supprimer" type="button">Supprimer</button></div>
<iframe id="v-fiche" class="fiche-video" title="Fiche de synthèse"></iframe>`);
  return h.join("\n");
}

export function rendre(etat, p) {
  const choisie = etat.route.vue === "video" ? p.id : null;
  const v = choisie ? (etat.videos || []).find((x) => String(x.id) === String(choisie)) : null;
  if (choisie) return `<div class="deux-volets avec-detail"><aside class="volet-liste">${liste(etat, choisie)}</aside><section class="volet-detail">${detail(etat, v)}</section></div>`;
  return `<div class="deux-volets"><aside class="volet-liste">${formulaire(p)}${liste(etat)}</aside><section class="volet-detail"><p class="vide">Choisis une vidéo pour lire sa fiche.</p></section></div>`;
}

let minuterie = null;
export async function monter(root, etat, actions, p) {
  clearTimeout(minuterie);
  if (!etat.videos) { await actions.chargerVideos(); return actions.rendre(); }
  const suivre = () => {                      // suivi en direct tant qu'une vidéo est en cours et que l'écran est ouvert
    if (!enCours(etat.videos || [])) return;
    minuterie = setTimeout(async () => {
      if (!["videos", "video"].includes(etat.route.vue) || document.hidden) return suivre();
      await actions.chargerVideos(); actions.rendre();
    }, 3000);
  };
  suivre();
  const form = root.querySelector("#v-form");
  if (form) form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const lien = root.querySelector("#v-lien").value.trim(), msg = root.querySelector("#v-msg");
    if (!identifiantYoutube(lien)) { msg.textContent = "Lien non pris en charge : seules les vidéos YouTube publiques le sont pour l'instant."; return; }
    msg.textContent = "Envoi…";
    const r = await actions.demanderVideo(lien, false);
    if (r.erreur) { msg.textContent = r.erreur; return; }
    if (r.deja) {
      msg.innerHTML = `Déjà résumée le ${dateFr(r.deja.cree_le)}. <a href="#/video/${r.deja.id}">Ouvrir la fiche</a> · <button type="button" class="lien" id="v-forcer">Résumer quand même</button>`;
      root.querySelector("#v-forcer").addEventListener("click", async () => { const r2 = await actions.demanderVideo(lien, true); if (r2.video) actions.naviguer("#/video/" + r2.video.id); else msg.textContent = r2.erreur; });
      return;
    }
    actions.naviguer("#/video/" + r.video.id);
  });
  if (etat.route.vue !== "video") return;
  const id = p.id;
  root.querySelector("#v-reessayer")?.addEventListener("click", async () => {
    const v = (etat.videos || []).find((x) => String(x.id) === String(id));
    const r = v && await actions.demanderVideo(v.lien, true);
    if (r?.video) actions.naviguer("#/video/" + r.video.id);
  });
  root.querySelector("#v-relancer")?.addEventListener("click", async () => { await actions.api("POST", "/api/videos/" + id + "/relancer"); await actions.chargerVideos(); actions.rendre(); });
  root.querySelector("#v-supprimer")?.addEventListener("click", async () => {
    if (!confirm("Supprimer cette fiche ?")) return;
    await actions.api("DELETE", "/api/videos/" + id); await actions.chargerVideos(); actions.naviguer("#/videos");
  });
  const cadre = root.querySelector("#v-fiche");
  if (cadre) {
    const html = await actions.ficheVideo(id);
    if (!html) { cadre.replaceWith(Object.assign(document.createElement("p"), { className: "resume", textContent: "Fiche indisponible hors ligne : ouvre-la une fois en ligne pour la garder." })); return; }
    cadre.addEventListener("load", () => {                         // hauteur du cadre = hauteur de la fiche (pas de double défilement)
      const ajuster = () => { try { cadre.style.height = cadre.contentDocument.documentElement.scrollHeight + "px"; } catch { /* cadre étranger */ } };
      ajuster(); setTimeout(ajuster, 600); new ResizeObserver(ajuster).observe(cadre.contentDocument.documentElement);
    });
    cadre.src = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  }
}
