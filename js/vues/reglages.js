// js/vues/reglages.js
import { ech, dateFr, ico } from "../format.js";
import { VERSION_APPLI } from "../app.js";
import { estimation } from "../stockage.js";
export const titre = () => "Réglages";
export function rendre(etat) {
  const m = etat.donnees?.meta;
  return `
<section class="carte">
  <h2 style="margin-top:0">Connexion</h2>
  <p class="resume">${etat.session?.connecte ? "Connecté avec ta clé d'accès (empreinte). La session dure 30 jours et se prolonge à chaque utilisation." : etat.session ? "Non connecté." : "Serveur injoignable : données en cache."}</p>
  <div class="actions">
    <a class="btn sec" href="#/connexion?ajout=1">${ico("cle")} Ajouter un appareil</a>
    <button type="button" class="btn sec" id="r-deconnexion">Se déconnecter</button>
  </div>
</section>
<section class="carte">
  <h2 style="margin-top:0">Discuter avec Claude</h2>
  <p class="resume">Dans un dossier, « Ouvrir dans Claude » envoie la question et les documents à l'appli Claude (ton abonnement, sans coût en plus). Claude y consulte les fiches, textes officiels et l'actualité CEE grâce au connecteur « Appli CEE », à ajouter une fois sur claude.ai → Connecteurs (voir INSTALLATION.md).</p>
</section>
<section class="carte">
  <h2 style="margin-top:0">Données</h2>
  <dl class="infos">
    <dt>Données de la veille</dt><dd>${m ? dateFr(m.donnees_du) + " (export du " + ech((m.genere_le || "").replace("T", " à ").slice(0, 19)) + ")" : "aucune"}</dd>
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
  <h2 style="margin-top:0">Expertise CEE</h2>
  <div class="actions">
    <button type="button" class="btn sec" id="r-export">${ico("partage")} Exporter les expertises (JSON)</button>
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
  root.querySelector("#r-deconnexion").addEventListener("click", () => actions.deconnexion());
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
