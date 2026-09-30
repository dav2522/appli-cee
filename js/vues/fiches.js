// js/vues/fiches.js — liste des fiches : recherche, filtres, tri, cartes compactes
import { ech, ico, giga, volume, dateFr } from "../format.js";
import { filtrer, trier, grouper, lireFiltres } from "../fiches.js";
export const titre = () => "Fiches";
const DIFF = { vert: "Simple", orange: "Moyen", rouge: "Complexe" };
export function carteCompacte(f, a) {
  const c = f.carte || {};
  const pills = [];
  if ((f.cdp?.cp || 1) > 1) pills.push(`<li class="pill cp-on">CP ×${f.cdp.cp}</li>`);
  if (c.intensite === "dossiers") pills.push(`<li class="pill">${ico("cible")} Quelques dossiers</li>`);
  else if (c.intensite === "volume") pills.push(`<li class="pill">${ico("foule")} Volume</li>`);
  if (DIFF[c.difficulte]) pills.push(`<li class="pill dif-${c.difficulte}"><span class="dot"></span>${DIFF[c.difficulte]}</li>`);
  const marques = [];
  if (f.statut !== "active") marques.push(`<span class="marque">terminée le ${dateFr(f.terminee_le)}</span>`);
  if (f.fin_proche) marques.push(`<span class="marque">${ico("sablier")} fin ${f.fin_proche.au_plus_tot ? "≥ " : ""}${dateFr(f.fin_proche.date)}</span>`);
  if (f.revision) marques.push(`<span class="marque">${ico("alerte")} ${f.revision.includes("suppression") ? "suppression envisagée" : "en révision"}</span>`);
  if (!f.carte) marques.push(`<span class="marque">${ico("alerte")} à analyser</span>`);
  const av = a?.avis === "up" ? " 👍" : a?.avis === "down" ? " 👎" : "";
  return `<a class="carte carte-lien" href="#/fiche/${ech(f.code)}"><div class="code">${ech(f.code)}${av}${marques.join("")}</div><ul class="pills">${pills.join("")}</ul>
<p class="titre">${ech(f.titre)}</p><p class="resume">${ech(c.resume || f.nom || "")}</p>
<p class="resume">${c.gwh != null ? "Valo ≈ <b>" + giga(c.gwh) + "</b>" : ""}${f.marche?.kwh ? " · marché " + volume(f.marche.kwh) + " (" + f.marche.rang + "ᵉ)" : ""}${f.marche && !f.marche.kwh ? " · aucun volume cette année" : ""}</p></a>`;
}
export function rendre(etat, params) {
  const d = etat.donnees;
  if (!d?.fiches) return `<p class="vide">Aucune donnée. <a href="#/reglages">Réglages</a>.</p>`;
  const f = lireFiltres(params, etat.ui.filtres); etat.ui.filtres = f;
  const avis = d.avis?.fiches || {};
  const liste = trier(filtrer(d.fiches.fiches, f, avis), f.tri);
  const bouton = (cle, val, lib) => `<button type="button" data-f="${cle}" data-v="${val}" aria-pressed="${f[cle] === val}">${lib}</button>`;
  const groupes = grouper(liste, d.fiches.groupes || []);
  return `
<div class="recherche">${ico("loupe")}<label class="sr" for="q">Rechercher</label><input id="q" type="search" placeholder="Code, intitulé, paramètre…" value="${ech(f.q)}" autocomplete="off"></div>
<div class="filtres" role="group" aria-label="Avis">${bouton("avis", "tous", "Toutes")}${bouton("avis", "up", "👍")}${bouton("avis", "sans", "Sans avis")}${bouton("avis", "nodown", "Sans 👎")}</div>
<div class="filtres" role="group" aria-label="Profil">${bouton("cp", "avec", "Coup de pouce")}${bouton("intensite", "dossiers", "Quelques dossiers")}${bouton("intensite", "volume", "Volume")}${bouton("difficulte", "vert", "Simple")}${bouton("difficulte", "orange", "Moyen")}${bouton("difficulte", "rouge", "Complexe")}${bouton("parution", "1a", "Parues < 1 an")}${bouton("parution", "2a", "< 2 ans")}<button type="button" data-f="masquerFins" data-v="toggle" aria-pressed="${!f.masquerFins}">Fins ≤ 90 j visibles</button></div>
<div class="filtres" role="group" aria-label="Tri"><span class="resume" style="align-self:center">Tri :</span>${bouton("tri", "potentiel", "Potentiel")}${bouton("tri", "volume", "Volume")}${bouton("tri", "parution", "Parution")}${bouton("tri", "code", "Code")}</div>
<p class="resume" id="nb-fiches">${liste.length} fiche${liste.length > 1 ? "s" : ""}</p>
${liste.length ? groupes.map((g) => `<section><h2>${ech(g.libelle)} <span class="resume">(${g.fiches.length})</span></h2>${g.fiches.map((x) => carteCompacte(x, avis[x.code])).join("")}</section>`).join("") : `<p class="vide">Aucune fiche ne correspond.</p>`}`;
}
export function monter(root, etat, actions) {
  const f = etat.ui.filtres;
  let t;
  root.querySelector("#q").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { f.q = e.target.value; const pos = e.target.selectionStart; actions.rendre(); const q = document.querySelector("#q"); if (q) { q.focus(); q.setSelectionRange(pos, pos); } }, 150); });
  for (const b of root.querySelectorAll(".filtres button")) b.addEventListener("click", () => {
    const k = b.dataset.f, v = b.dataset.v;
    if (v === "toggle") f[k] = !f[k]; else f[k] = (k !== "tri" && f[k] === v) ? "tous" : v;
    actions.rendre();
  });
}
