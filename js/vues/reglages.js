// js/vues/reglages.js
import { ech, dateFr, ico } from "../format.js";
import { VERSION_APPLI } from "../app.js";
import { estimation } from "../stockage.js";
export const titre = () => "Réglages";
export function rendre(etat) {
  const m = etat.donnees?.meta;
  return `
<section class="carte">
  <h2 style="margin-top:0">Jeton GitHub</h2>
  <p class="resume">Jeton « fine-grained » limité au dépôt privé des données (voir INSTALLATION.md). Il reste sur ce téléphone.</p>
  <label class="champ"><span>Jeton</span><input id="r-jeton" type="password" autocomplete="off" value="${ech(etat.reglages.jeton)}" placeholder="github_pat_…"></label>
  <div class="actions"><button type="button" class="btn" id="r-enregistrer">${ico("ok")} Enregistrer et synchroniser</button></div>
  <p id="r-resultat" class="resume" aria-live="polite"></p>
</section>
<section class="carte">
  <h2 style="margin-top:0">Données</h2>
  <dl class="infos">
    <dt>Données du PC</dt><dd>${m ? dateFr(m.donnees_du) + " (export du " + ech((m.genere_le || "").replace("T", " à ").slice(0, 19)) + ")" : "aucune"}</dd>
    <dt>Dernière synchronisation</dt><dd>${etat.synchro.derniere ? ech(etat.synchro.derniere.replace("T", " ").slice(0, 16)) : "jamais"}</dd>
    <dt>Fiches en cache</dt><dd>${etat.donnees?.fiches?.fiches?.length || 0}</dd>
    <dt>Espace utilisé</dt><dd id="r-espace">…</dd>
  </dl>
  <div class="actions">
    <button type="button" class="btn sec" id="r-synchro">${ico("sync")} Mettre à jour maintenant</button>
    <button type="button" class="btn sec" id="r-vider">${ico("x")} Vider le cache des données</button>
  </div>
</section>
<section class="carte">
  <h2 style="margin-top:0">Dossiers</h2>
  <div class="actions">
    <button type="button" class="btn sec" id="r-export">${ico("partage")} Exporter les dossiers (JSON)</button>
    <label class="btn sec" for="r-import">${ico("fichier")} Importer un export</label><input id="r-import" type="file" accept="application/json" class="sr">
  </div>
</section>
<section class="carte">
  <h2 style="margin-top:0">À propos</h2>
  <p class="resume">Appli CEE ${VERSION_APPLI} · schéma des données ${m ? m.schema : "—"} · <a href="https://github.com/dav2522/appli-cee" rel="noopener">code source</a></p>
</section>`;
}
export function monter(root, etat, actions) {
  estimation().then((e) => { const z = root.querySelector("#r-espace"); if (z) z.textContent = (e.usage / 1048576).toFixed(1) + " Mo"; });
  root.querySelector("#r-enregistrer").addEventListener("click", async () => {
    const res = root.querySelector("#r-resultat"); res.textContent = "Connexion…";
    const r = await actions.enregistrerJeton(root.querySelector("#r-jeton").value);
    const msg = !r ? "Jeton vide." : r.ok ? "Connecté : " + r.telecharges + " fichier(s) téléchargé(s)." : "Échec : " + (r.erreur === "jeton" ? "jeton refusé" : r.erreur);
    const z = document.querySelector("#r-resultat"); if (z) z.textContent = msg;
  });
  root.querySelector("#r-synchro").addEventListener("click", () => actions.synchroniser(true));
  root.querySelector("#r-vider").addEventListener("click", () => { if (confirm("Vider les données en cache ? Elles seront retéléchargées.")) actions.viderCache(); });
  root.querySelector("#r-export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(etat.dossiers, null, 1)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "dossiers-cee.json" }); a.click();
  });
  root.querySelector("#r-import").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { for (const d of JSON.parse(await f.text())) if (d && d.id) await actions.enregistrerDossier(d); alert("Dossiers importés."); }
    catch { alert("Fichier illisible."); }
  });
}
