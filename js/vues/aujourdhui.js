// js/vues/aujourdhui.js
import { ech, ico, dateFr } from "../format.js";
import { rubriquesDuJour, nettoyerTelegram } from "../jour.js";
export const titre = () => "Aujourd'hui";
function lien(code) { return code ? `<a class="code" href="#/fiche/${ech(code)}">${ech(code)}</a> ` : ""; }
export function rendre(etat) {
  const d = etat.donnees;
  if (!d) return `<p class="vide">Aucune donnée. ${etat.reglages.jeton ? "Synchronisation en cours…" : '<a href="#/reglages">Saisir le jeton</a>.'}</p>`;
  const m = d.meta, p = m.passage || {}, c = m.compteurs || {};
  const incidents = (p.incidents || []).length;
  const etatPassage = p.date ? (p.dgec_code === 0 && p.ademe_code === 0 && !incidents ? ["ok", "Passage du " + dateFr(p.date) + " OK"] : ["warn", "Passage du " + dateFr(p.date) + " : " + (incidents ? incidents + " incident(s)" : "source en échec")]) : ["bad", "Pas de passage"];
  const tuile = (cls, val, lbl, href) => `<a class="tuile ${cls}" href="${href}"><span class="val">${val}</span><span class="lbl">${lbl}</span></a>`;
  const rubriques = rubriquesDuJour(d.jour?.delta);
  const avisUp = Object.values(d.avis?.fiches || {}).filter((a) => a.avis === "up").length;
  const html = [`
<p class="resume">Données du <b>${dateFr(m.donnees_du)}</b> · <span class="st ${etatPassage[0]}">${ech(etatPassage[1])}</span>${p.vpn_final ? " · VPN " + (p.vpn_final === "Disconnected" ? "éteint" : ech(p.vpn_final)) : ""}</p>
<div class="tuiles">
  ${tuile("", c.actives ?? "—", "fiches actives", "#/fiches")}
  ${tuile(c.mouvements ? "warn" : "ok", c.mouvements ?? 0, "mouvement" + (c.mouvements > 1 ? "s" : ""), "#/aujourdhui")}
  ${tuile("", c.consultations_en_cours ?? 0, "consultations en cours", "#/echeances")}
  ${tuile(c.fins_90j ? "warn" : "", c.fins_90j ?? 0, "fins sous 90 j", "#/echeances")}
  ${tuile("", avisUp, "fiches 👍", "#/fiches?avis=up")}
</div>`];
  if (incidents) html.push(`<div class="bandeau bad">${(p.incidents || []).map(ech).join("<br>")}</div>`);
  if (!rubriques.length) html.push(`<p class="carte">Journée calme : aucune fiche créée, révisée, arrêtée ou entrant en vigueur.</p>`);
  for (const r of rubriques) html.push(`<section class="rubrique"><h2>${ico(r.icone)} ${ech(r.titre)} <span class="resume">(${r.items.length})</span></h2><ul class="liste">${r.items.map((i) =>
    `<li>${lien(i.code)}${ech(i.texte)}${i.sous ? `<br><span class="resume">${ech(i.sous)}</span>` : ""}${i.url ? ` <a href="${ech(i.url)}" rel="noopener" target="_blank">↗</a>` : ""}</li>`).join("")}</ul></section>`);
  if (d.jour?.daily) html.push(`<details open><summary>Daily du ${dateFr(d.jour.date)}</summary><div class="daily">${nettoyerTelegram(d.jour.daily)}</div></details>`);
  else if (d.jour?.telegram_brut) html.push(`<details><summary>Daily brut du ${dateFr(d.jour.date)}</summary><div class="daily">${nettoyerTelegram(d.jour.telegram_brut)}</div></details>`);
  const fil = d.fil?.entrees || [];
  if (fil.length) {
    html.push(`<h2>${ico("fiches")} Fil de veille</h2>`);
    if (d.fil.bandeau) html.push(`<div class="bandeau">${ech(d.fil.bandeau.titre)} — ${ech(d.fil.bandeau.texte)}</div>`);
    html.push(fil.slice(0, 15).map((e, i) => `<article class="entry ${ech(e.type)}"><span class="date">${dateFr(e.date)}</span>${e.chips.map((c) => `<span class="chip">${ech(c.texte)}</span>`).join("")}<h3>${e.titre}</h3>${i < 3 ? `<div>${e.faits.map((f) => `<span class="fact ${ech(f.etat)}">${ech(f.texte)}</span>`).join("")}</div>${e.paragraphes.map((x) => `<p>${x}</p>`).join("")}${e.details.map((dt) => `<details><summary>${ech(dt.titre)}</summary><div>${dt.html}</div></details>`).join("")}` : `<details><summary>Détails</summary>${e.paragraphes.map((x) => `<p>${x}</p>`).join("")}</details>`}</article>`).join(""));
  }
  return html.join("\n");
}
