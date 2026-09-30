// js/vues/echeances.js — jalons, consultations en cours, top volume, terminees
import { ech, ico, dateFr, jours, volume } from "../format.js";
export const titre = () => "Échéances";
const LIB = { actif: "Active", rev: "En révision", fini: "Terminée" };
export function rendre(etat) {
  const d = etat.donnees;
  if (!d?.jalons) return `<p class="vide">Aucune donnée.</p>`;
  const auj = new Date().toISOString().slice(0, 10);
  const jal = (d.jalons.jalons || []).filter((j) => j.date >= auj);
  const cons = Object.values(d.consultations?.consultations || {}).filter((c) => c.en_cours).sort((a, b) => a.fin.localeCompare(b.fin));
  const term = (d.fiches?.fiches || []).filter((f) => f.statut !== "active").sort((a, b) => (b.terminee_le || "").localeCompare(a.terminee_le || ""));
  const lien = (c) => `<a class="code" href="#/fiche/${ech(c)}">${ech(c)}</a>`;
  return `
<h2 style="margin-top:0">${ico("echeances")} Prochains jalons</h2>
${jal.length ? `<ul class="liste">${jal.map((j) => `<li><b>${dateFr(j.date)}</b> <span class="st ${jours(j.date) <= 30 ? "rev" : ""}">J-${jours(j.date)}</span><br>${ech(j.objet)}${(j.fiches || []).length ? `<br><span class="resume">${j.fiches.slice(0, 12).map(lien).join(" ")}${j.fiches.length > 12 ? "…" : ""}</span>` : ""}${j.source ? ` <a href="${ech(j.source)}" target="_blank" rel="noopener">↗</a>` : ""}</li>`).join("")}</ul>` : `<p class="resume">Aucun jalon à venir.</p>`}
<h2>${ico("fiches")} Consultations CEE en cours (${cons.length})</h2>
${cons.map((c) => `<article class="carte"><b>${ech(c.titre)}</b><br><span class="resume">du ${dateFr(c.debut)} au ${dateFr(c.fin)} · J-${jours(c.fin)}${c.contributions != null ? " · " + c.contributions + " contribution(s)" : ""}</span>${c.objet ? `<p class="resume">${ech(c.objet)}</p>` : ""}${c.entree_en_vigueur ? `<p class="resume"><b>Entrée en vigueur :</b> ${ech(c.entree_en_vigueur)}</p>` : ""}${(c.fiches_citees || []).length ? `<p>${c.fiches_citees.map((k) => `${lien(k)} <span class="resume">${ech((c.actions?.[k] || {}).action || "")}</span>`).join(" · ")}</p>` : `<p class="resume">Aucune fiche citée.</p>`}<a href="${ech(c.url)}" target="_blank" rel="noopener">Consultation ↗</a></article>`).join("")}
<h2>${ico("foule")} Top ${d.jalons.top_volume.length} · volume CEE ${d.fiches?.annee_volume || ""} <span class="resume">${ech(d.jalons.periode || "")}</span></h2>
<div style="overflow-x:auto"><table><thead><tr><th>Fiche</th><th>Intitulé</th><th class="num">Volume</th><th>Statut</th><th>Mise en ligne</th><th>Fin</th></tr></thead><tbody>
${d.jalons.top_volume.map((t) => `<tr><th scope="row">${lien(t.code)}</th><td>${ech(t.titre)}</td><td class="num">${volume(t.kwh)}</td><td><span class="st ${t.statut}" title="${ech(t.motif || "")}">${LIB[t.statut]}</span></td><td>${t.mise_en_ligne ? (t.marque === "≤" ? "≤ " : "") + dateFr(t.mise_en_ligne) + (t.marque === "*" ? "*" : "") : "n.c."}</td><td>${t.fin ? dateFr(t.fin) : t.fin_prevue ? (t.au_plus_tot ? "≥ " : "") + dateFr(t.fin_prevue) : "–"}</td></tr>`).join("")}
</tbody></table></div><p class="resume">* date de l'arrêté de création ; ≤ première version absente du catalogue.</p>
<h2>${ico("x")} Fiches terminées récemment (${term.length})</h2>
<ul class="liste">${term.map((f) => `<li>${lien(f.code)} ${ech(f.nom || f.titre)} · <span class="resume">${dateFr(f.terminee_le)}${f.fins?.jo ? " (Journal officiel)" : ""}</span></li>`).join("")}</ul>`;
}
