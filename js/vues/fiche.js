// js/vues/fiche.js — detail d'une fiche
import { ech, ico, md, giga, volume, dateFr, fourchette, totalCout } from "../format.js";
export const titre = (etat, p) => p.code || "Fiche";
const DIFF = { vert: "Simple", orange: "Moyen", rouge: "Complexe" };
const puces = (l) => `<ul class="f-cond">${(l || []).map((x) => `<li>${md(x)}</li>`).join("")}</ul>`;
export function rendreCouts(c) {
  if (c.couts) return `<table><caption>${md(c.couts.titre || "Coût estimé (HT)")}</caption><tbody>${(c.couts.lignes || []).map((l) => `<tr><th scope="row">${md(l[0])}</th><td class="num">${md(l[1])}</td></tr>`).join("")}${c.couts.total ? `<tr class="tot"><th scope="row">Total</th><td class="num"><b>${md(c.couts.total)}</b>${c.couts.total_alt ? `<br><span class="resume">${md(c.couts.total_alt)}</span>` : ""}</td></tr>` : ""}</tbody></table>${c.couts.note ? `<p class="resume">${md(c.couts.note)}</p>` : ""}`;
  const t = totalCout(c.cout);
  if (!t) return "";
  return `<table><caption>Coût estimé HT · cas optimal</caption><tbody>${c.cout.postes.map((p) => `<tr><th scope="row">${md(p[0])}</th><td class="num">${fourchette(p[1], p[2])}</td></tr>`).join("")}<tr class="tot"><th scope="row">Total</th><td class="num"><b>${fourchette(t.min, t.max)}</b></td></tr></tbody></table><p class="resume">${c.cout.note ? md(c.cout.note) + " " : ""}Estimation à confirmer par devis (prix 2026 HT, pose comprise).</p>`;
}
export function rendreOptim(c) {
  const o = c.optim; if (!o) return "";
  return `<details><summary>${md(o.titre || "Tableau d'optimisation")}</summary><div style="overflow-x:auto"><table><thead><tr>${(o.colonnes || []).map((x) => `<th>${md(x)}</th>`).join("")}</tr></thead><tbody>${(o.lignes || []).map((l) => `<tr class="${l[4] || ""}">${l.slice(0, 4).map((x, i) => `<td class="${i === 1 || i === 2 ? "num" : ""}">${md(x)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>${o.note ? `<p class="resume">${md(o.note)}</p>` : ""}</details>`;
}
export function rendre(etat, p) {
  const f = etat.index[p.code];
  if (!f) return `<p class="vide">Fiche ${ech(p.code)} inconnue. <a href="#/fiches">Retour aux fiches</a>.</p>`;
  const c = f.carte || {}, a = etat.donnees?.avis?.fiches?.[f.code] || {};
  const tc = totalCout(c.cout);
  const total = c.couts?.total || (tc ? fourchette(tc.min, tc.max) : "");
  const info = [];
  if (f.marche) info.push(["Marché " + f.marche.annee, f.marche.kwh ? `<b>${volume(f.marche.kwh)}</b> depuis janvier · ${f.marche.rang}ᵉ fiche sur ${f.marche.total}` : "aucun volume depuis janvier"]);
  if (f.parution?.texte) info.push(["Parution", ech(f.parution.texte)]);
  if (f.revision) info.push(["Révision", `${ico("alerte")} ${ech(f.revision)}`]);
  if (f.jo?.length) info.push(["Journal officiel", f.jo.map(ech).join(" ; ")]);
  if (f.fin_proche) info.push(["Fin", `${f.fin_proche.au_plus_tot ? "au plus tôt le " : ""}${dateFr(f.fin_proche.date)}`]);
  else if (f.fins?.fin_texte) info.push(["Fin écrite dans la fiche", dateFr(f.fins.fin_texte)]);
  if (f.statut !== "active") info.push(["Terminée", dateFr(f.terminee_le)]);
  if (c.pourquoi) info.push(["Pourquoi " + (DIFF[c.difficulte] || "").toLowerCase(), md(c.pourquoi)]);
  if (c.leviers?.length) info.push(["Leviers", puces(c.leviers)]);
  if (c.be) info.push(["Bureau d'études", `<b>${c.be.requis ? "Oui" : "Non"}</b>${c.be.opqibi ? " (OPQIBI " + ech(c.be.opqibi) + ")" : ""}${c.be.note ? " : " + md(c.be.note) : ""}`]);
  if (c.verifier?.length) info.push(["À vérifier", puces(c.verifier)]);
  if (total) info.push(["Coût estimé", `<details><summary><b>≈ ${ech(total)}</b> HT · détail</summary>${rendreCouts(c)}</details>`]);
  if (f.verdict) info.push(["Verdict 0 €", `<b>${ech(String(f.verdict.zero_euro).toUpperCase())}</b> (${dateFr(f.verdict.analysee_le)}) — ${ech(f.verdict.justification || "")}`]);
  const cas = c.cas && typeof c.cas === "object" ? `<p class="carte"><b>Cas optimal</b> · ${(c.cas.seg || []).map(md).join(" · ")}${c.gwh != null ? ` · <b>Valo ≈ ${giga(c.gwh)}</b>${(c.cas.cp_inclus || c.cp_inclus) && (f.cdp?.cp || 1) > 1 ? " (CP ×" + f.cdp.cp + " inclus)" : ""}` : ""}</p>` : "";
  return `
<p class="titre" style="font-size:18px">${ech(f.titre)}</p><p class="resume">${ech(f.nom || "")} · ${ech(f.version || "")} · ${ech(f.sous_secteur || f.secteur)}</p>
<ul class="pills">${(f.cdp?.cp || 1) > 1 ? `<li class="pill cp-on">Coup de pouce ×${f.cdp.cp} · ${f.cdp.programmes.map(ech).join(", ")}</li>` : ""}${c.intensite ? `<li class="pill">${c.intensite === "dossiers" ? ico("cible") + " Quelques dossiers suffisent" : ico("foule") + " Volume client élevé"}</li>` : ""}${DIFF[c.difficulte] ? `<li class="pill dif-${c.difficulte}"><span class="dot"></span>${DIFF[c.difficulte]}</li>` : ""}</ul>
<div class="avis" role="group" aria-label="Avis"><button type="button" id="a-up" aria-pressed="${a.avis === "up"}" aria-label="Intéressé">${ico("up")}</button><button type="button" id="a-down" aria-pressed="${a.avis === "down"}" aria-label="Pas intéressé">${ico("down")}</button><button type="button" id="a-com" aria-expanded="${!!a.commentaire}" aria-label="Commentaire">${ico("com")}</button><span class="resume" id="a-etat" style="align-self:center">${a.le ? "avis du " + dateFr(a.le) : ""}</span></div>
<div id="a-zone" ${a.commentaire ? "" : "hidden"}><label class="champ"><span>Commentaire</span><textarea id="a-texte">${ech(a.commentaire || "")}</textarea></label><button type="button" class="btn sec" id="a-enregistrer">Enregistrer le commentaire</button></div>
<p class="resume">${ech(c.resume || "")}</p>${c.params?.length ? `<ul class="pills">${c.params.map((x) => `<li class="pill">${ech(x)}</li>`).join("")}</ul>` : ""}${c.justif ? `<p class="resume"><i>${ech(c.justif)}</i></p>` : ""}
${cas}
<dl class="infos">${info.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
${rendreOptim(c)}
<div class="actions"><a class="btn" href="#/dossier/nouveau?fiche=${ech(f.code)}">${ico("plus")} Nouveau dossier</a>${f.urls?.pdf_officiel ? `<a class="btn sec" href="${ech(f.urls.pdf_officiel)}" target="_blank" rel="noopener">${ico("fichier")} PDF officiel</a>` : ""}</div>
<h2>Chronologie</h2>${f.chronologie?.length ? `<ul class="chrono">${f.chronologie.map((e) => `<li><span class="d">${dateFr(e.date)}</span><span>${ech(e.libelle)}${e.titre ? `<br><span class="resume">${ech(e.titre)}</span>` : ""}${e.url ? ` <a href="${ech(e.url)}" target="_blank" rel="noopener">↗</a>` : ""}</span></li>`).join("")}</ul>` : `<p class="resume">Aucun événement daté.</p>`}
<details id="texte-officiel"><summary>Texte officiel en vigueur</summary><div class="texte-officiel" id="texte-zone">Chargement…</div></details>`;
}
export function monter(root, etat, actions, p) {
  const f = etat.index[p.code]; if (!f) return;
  const maj = async (avis) => { const com = root.querySelector("#a-texte").value; await actions.enregistrerAvis(f.code, avis, com); actions.rendre(); };
  root.querySelector("#a-up").addEventListener("click", () => maj(root.querySelector("#a-up").getAttribute("aria-pressed") === "true" ? "" : "up"));
  root.querySelector("#a-down").addEventListener("click", () => maj(root.querySelector("#a-down").getAttribute("aria-pressed") === "true" ? "" : "down"));
  root.querySelector("#a-com").addEventListener("click", () => { const z = root.querySelector("#a-zone"); z.hidden = !z.hidden; if (!z.hidden) z.querySelector("textarea").focus(); });
  root.querySelector("#a-enregistrer").addEventListener("click", () => maj((etat.donnees?.avis?.fiches?.[f.code] || {}).avis || ""));
  root.querySelector("#texte-officiel").addEventListener("toggle", async (e) => {
    if (!e.target.open) return;
    const z = root.querySelector("#texte-zone");
    try { const t = await actions.chargerTexte(f.secteur); z.textContent = t[f.code] || "Texte non disponible pour cette fiche."; }
    catch (err) { z.textContent = "Texte indisponible hors ligne (" + (err.message || err) + ")."; }
  });
}
