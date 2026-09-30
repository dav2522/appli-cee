// js/vues/dossiers.js — liste des dossiers et editeur (import, suggestion, parametres, dossier, partage, reponse)
import { ech, ico, dateFr } from "../format.js";
import { suggererFiches, extraireParametres, construireDossier, nouveauDossier } from "../dossier.js";
export const titre = (etat, p) => (etat.route.vue === "dossier" ? (p.id === "nouveau" ? "Nouveau dossier" : "Dossier") : "Dossiers");
const LIB = { puissance_kw: "Puissance (kW)", surface_m2: "Surface (m²)", etas: "Etas (%)", cop: "COP", scop: "SCOP", zone: "Zone (H1/H2/H3)", montant_ht: "Montant HT (€)", energie: "Énergie remplacée", secteur: "Secteur" };
export function preparerDossier({ fiches, textes, texteExtrait, fichiers, fiche, parametres, avis }) {
  const suggestions = suggererFiches(texteExtrait, fiches);
  const f = fiches.find((x) => x.code === fiche);
  const dossier = f ? construireDossier({ fiche: f, texteOfficiel: (textes[f.secteur] || {})[f.code] || "", parametres, devisTexte: texteExtrait, fichiers, avis }) : "";
  return { suggestions, dossier };
}
export function rendre(etat, p) {
  if (etat.route.vue === "dossiers") {
    const l = [...etat.dossiers].sort((a, b) => (b.maj_le || "").localeCompare(a.maj_le || ""));
    return `<div class="actions"><a class="btn" href="#/dossier/nouveau">${ico("plus")} Nouveau dossier</a><label class="btn sec" for="d-fichier">${ico("fichier")} Depuis un fichier</label><input id="d-fichier" type="file" accept="application/pdf,image/*,text/plain" multiple class="sr"></div>
<p class="resume">Ou partagez un PDF / une photo depuis Gmail, Drive, WhatsApp… vers « Appli CEE ».</p>
${l.length ? `<ul class="liste">${l.map((d) => `<li><a class="carte-lien" href="#/dossier/${ech(d.id)}"><b>${ech(d.titre || d.fiche || "Sans titre")}</b> <span class="st ${d.etat === "reponse" ? "actif" : d.etat === "partage" ? "rev" : ""}">${ech({ brouillon: "brouillon", partage: "partagé", reponse: "réponse reçue" }[d.etat] || d.etat)}</span><br><span class="resume">${ech(d.fiche || "fiche à choisir")} · ${dateFr(d.maj_le)} · ${d.fichiers.length} fichier(s)</span></a></li>`).join("")}</ul>` : `<p class="vide">Aucun dossier.</p>`}`;
  }
  const d = etat.ui.dossier;
  if (!d || d.id !== p.id) return `<p class="vide">Chargement…</p>`;
  const fiches = etat.donnees?.fiches?.fiches || [];
  const f = etat.index[d.fiche];
  const sugg = d.suggestions || [];
  const options = fiches.filter((x) => x.statut === "active").map((x) => `<option value="${ech(x.code)}" ${x.code === d.fiche ? "selected" : ""}>${ech(x.code)} — ${ech(x.titre)}</option>`).join("");
  return `
<label class="champ"><span>Titre</span><input id="d-titre" value="${ech(d.titre)}" placeholder="Client, objet…"></label>
<p class="resume">${d.fichiers.length ? d.fichiers.map((x) => ico("fichier") + " " + ech(x.nom)).join(" · ") : "Aucun fichier"} · <label for="d-plus" style="color:var(--action-clair);cursor:pointer">ajouter</label><input id="d-plus" type="file" accept="application/pdf,image/*,text/plain" multiple class="sr"></p>
${d.devis_texte ? `<details><summary>Texte extrait (${d.devis_texte.length} caractères)</summary><div class="texte-officiel">${ech(d.devis_texte.slice(0, 4000))}${d.devis_texte.length > 4000 ? "…" : ""}</div></details>` : d.fichiers.length ? `<div class="bandeau">Aucun texte lisible dans le fichier (scan ou photo) : choisissez la fiche ci-dessous ; le fichier sera joint au partage.</div>` : ""}
${sugg.length ? `<h2>Fiches suggérées</h2><div class="filtres">${sugg.map((s) => `<button type="button" data-fiche="${ech(s.code)}" aria-pressed="${s.code === d.fiche}" title="${ech(s.raisons.join(" ; "))}">${ech(s.code)} <span class="resume">${s.score}</span></button>`).join("")}</div>` : ""}
<label class="champ"><span>Fiche</span><select id="d-fiche"><option value="">— choisir —</option>${options}</select></label>
${f ? `<p class="resume">${ech(f.titre)} · ${ech(f.carte?.resume || "")} <a href="#/fiche/${ech(f.code)}">voir la fiche</a></p>` : ""}
<h2>Paramètres</h2><div class="tuiles">${Object.entries(LIB).map(([k, lib]) => `<label class="champ"><span>${lib}</span><input data-param="${k}" value="${ech(d.parametres[k] ?? "")}" inputmode="${/energie|secteur|zone/.test(k) ? "text" : "decimal"}"></label>`).join("")}</div>
<div class="actions"><button type="button" class="btn" id="d-generer" ${f ? "" : "disabled"}>${ico("ok")} Générer le dossier</button></div>
${d.dossier ? `<h2>Dossier d'expertise</h2><textarea id="d-dossier" rows="14">${ech(d.dossier)}</textarea>
<div class="actions"><button type="button" class="btn" id="d-partager">${ico("partage")} Partager vers Claude</button><button type="button" class="btn sec" id="d-copier">Copier</button><button type="button" class="btn sec" id="d-export">Exporter .md</button></div><p id="d-etat" class="resume" aria-live="polite"></p>` : ""}
<h2>Réponse de Claude</h2><textarea id="d-reponse" rows="8" placeholder="Collez ici la réponse (ou partagez-la depuis Claude vers l'Appli CEE)">${ech(d.reponse || "")}</textarea>
<div class="actions"><button type="button" class="btn sec" id="d-enregistrer">Enregistrer</button><button type="button" class="btn danger" id="d-supprimer">Supprimer</button></div>`;
}
async function lireFichiers(files) {
  const { texteDuPdf, fichiersVersEntrees } = await import("../pdf.js");
  const entrees = fichiersVersEntrees(files); let texte = "";
  for (const f of files) {
    if (f.size > 25 * 1048576) { alert(f.name + " dépasse 25 Mo : ignoré."); continue; }
    try { if (f.type === "application/pdf") texte += (await texteDuPdf(f)) + "\n"; else if (f.type.startsWith("text/")) texte += (await f.text()) + "\n"; } catch (e) { console.warn(e); }
  }
  return { entrees, texte: texte.trim(), objets: [...files] };
}
export async function monter(root, etat, actions, p) {
  if (etat.route.vue === "dossiers") {
    root.querySelector("#d-fichier").addEventListener("change", (e) => { etat.ui.fichiersEnAttente = [...e.target.files]; actions.naviguer("#/dossier/nouveau?fichiers=1"); });
    return;
  }
  const fiches = etat.donnees?.fiches?.fiches || [];
  if (!etat.ui.dossier || etat.ui.dossier.id !== p.id) {
    let d;
    if (p.id === "nouveau") {
      d = nouveauDossier({ fiche: p.fiche || "" });
      let files = etat.ui.fichiersEnAttente || []; etat.ui.fichiersEnAttente = null;
      if (p.partage) { const pa = await actions.lirePartage(); if (pa) { files = pa.fichiers || []; d.titre = pa.titre || ""; if (pa.texte && !files.length) d.devis_texte = pa.texte; } }
      if (files.length) { const r = await lireFichiers(files); d.fichiers = r.entrees; d.devis_texte = d.devis_texte || r.texte; etat.ui.objets = r.objets; }
      if (d.devis_texte) { d.parametres = extraireParametres(d.devis_texte); d.suggestions = suggererFiches(d.devis_texte, fiches); if (!d.fiche && d.suggestions[0] && d.suggestions[0].score >= 60) d.fiche = d.suggestions[0].code; }
      etat.ui.dossier = d;
      location.replace("#/dossier/" + d.id); etat.route = { vue: "dossier", params: { id: d.id } };
    } else { d = etat.dossiers.find((x) => x.id === p.id) || nouveauDossier({}); d.id = d.id || p.id; d.suggestions = d.devis_texte ? suggererFiches(d.devis_texte, fiches) : []; }
    etat.ui.dossier = d; actions.rendre(); return;
  }
  const d = etat.ui.dossier;
  const lireForm = () => { d.titre = root.querySelector("#d-titre").value; d.fiche = root.querySelector("#d-fiche").value; for (const i of root.querySelectorAll("[data-param]")) { const v = i.value.trim(); d.parametres[i.dataset.param] = v === "" ? null : (isNaN(+v.replace(",", ".")) ? v : +v.replace(",", ".")); } d.reponse = root.querySelector("#d-reponse").value; if (root.querySelector("#d-dossier")) d.dossier = root.querySelector("#d-dossier").value; };
  root.querySelector("#d-fiche").addEventListener("change", () => { lireForm(); actions.rendre(); });
  for (const b of root.querySelectorAll("[data-fiche]")) b.addEventListener("click", () => { lireForm(); d.fiche = b.dataset.fiche; actions.rendre(); });
  root.querySelector("#d-plus").addEventListener("change", async (e) => { lireForm(); const r = await lireFichiers([...e.target.files]); d.fichiers.push(...r.entrees); d.devis_texte = [d.devis_texte, r.texte].filter(Boolean).join("\n"); etat.ui.objets = [...(etat.ui.objets || []), ...r.objets]; d.parametres = { ...extraireParametres(d.devis_texte), ...Object.fromEntries(Object.entries(d.parametres).filter(([, v]) => v != null)) }; d.suggestions = suggererFiches(d.devis_texte, fiches); actions.rendre(); });
  root.querySelector("#d-generer").addEventListener("click", async () => {
    lireForm(); const f = etat.index[d.fiche]; if (!f) return;
    let textes = {}; try { textes = { [f.secteur]: await actions.chargerTexte(f.secteur) }; } catch { /* hors ligne : dossier sans extraits */ }
    d.dossier = construireDossier({ fiche: f, texteOfficiel: (textes[f.secteur] || {})[f.code] || "", parametres: d.parametres, devisTexte: d.devis_texte, fichiers: d.fichiers, avis: etat.donnees?.avis?.fiches?.[f.code] });
    if (!d.titre) d.titre = f.code + " — " + (d.fichiers[0]?.nom || dateFr(d.cree_le.slice(0, 10)));
    await actions.enregistrerDossier(d); actions.rendre();
  });
  root.querySelector("#d-enregistrer").addEventListener("click", async () => { lireForm(); if (d.reponse && d.etat !== "reponse") d.etat = "reponse"; await actions.enregistrerDossier(d); root.querySelector("#d-enregistrer").textContent = "Enregistré"; });
  root.querySelector("#d-supprimer").addEventListener("click", async () => { if (confirm("Supprimer ce dossier ?")) { await actions.supprimerDossier(d.id); etat.ui.dossier = null; actions.naviguer("#/dossiers"); } });
  const partagerBtn = root.querySelector("#d-partager");
  if (partagerBtn) {
    const { partager, copier } = await import("../partage.js");
    partagerBtn.addEventListener("click", async () => { lireForm(); const r = await partager({ titre: d.titre, texte: d.dossier, fichiers: etat.ui.objets || [] }); root.querySelector("#d-etat").textContent = { partage: "Partagé. Collez la réponse ci-dessous quand vous l'avez.", copie: "Partage indisponible : dossier copié dans le presse-papiers.", annule: "Partage annulé.", echec: "Partage et copie impossibles." }[r]; if (r === "partage" || r === "copie") { d.etat = d.etat === "reponse" ? d.etat : "partage"; await actions.enregistrerDossier(d); } });
    root.querySelector("#d-copier").addEventListener("click", async () => { lireForm(); root.querySelector("#d-etat").textContent = (await copier(d.dossier)) ? "Copié." : "Copie impossible."; });
    root.querySelector("#d-export").addEventListener("click", () => { lireForm(); const blob = new Blob([d.dossier + (d.reponse ? "\n\n## Réponse\n" + d.reponse : "")], { type: "text/markdown" }); const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: (d.titre || "dossier").replace(/[^\w-]+/g, "_") + ".md" }); a.click(); });
  }
}
