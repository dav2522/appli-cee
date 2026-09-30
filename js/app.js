// js/app.js — demarrage, routage, etat global, actions partagees par les vues
import { analyserRoute } from "./routeur.js";
import * as stockage from "./stockage.js";
import { lireReglages, ecrireReglages, creerClient, synchroniser, enregistrerAvis, viderFile, chargerTexte } from "./donnees.js";
import * as vAujourdhui from "./vues/aujourdhui.js";
import * as vFiches from "./vues/fiches.js";
import * as vFiche from "./vues/fiche.js";
import * as vEcheances from "./vues/echeances.js";
import * as vDossiers from "./vues/dossiers.js";
import * as vReglages from "./vues/reglages.js";
import { dateFr } from "./format.js";
import { supprimerFichiersDossier } from "./fichiers.js";

export const VERSION_APPLI = "1.2.0";
const VUES = { aujourdhui: vAujourdhui, fiches: vFiches, fiche: vFiche, echeances: vEcheances, dossiers: vDossiers, dossier: vDossiers, reglages: vReglages };
const ONGLET = { aujourdhui: "aujourdhui", fiches: "fiches", fiche: "fiches", echeances: "echeances", dossiers: "dossiers", dossier: "dossiers", reglages: "reglages" };
const main = document.getElementById("vue"), bandeau = document.getElementById("bandeau");
const etat = { reglages: lireReglages(), donnees: null, index: {}, textes: {}, dossiers: [],
  synchro: { enCours: false, derniere: null, erreur: null }, route: analyserRoute(location.hash), ui: {} };
let client = etat.reglages.jeton ? creerClient(fetch.bind(window), etat.reglages.jeton) : null;

async function chargerCache() {
  const meta = await stockage.lire("donnees", "meta");
  if (!meta) return;
  const d = { meta };
  for (const n of ["fiches", "jour", "fil", "consultations", "registre", "jalons", "avis"]) d[n] = await stockage.lire("donnees", n);
  etat.donnees = d; etat.synchro.derniere = await stockage.lire("donnees", "synchro");
  etat.index = {}; for (const f of d.fiches?.fiches || []) etat.index[f.code] = f;
}
function message(texte, classe = "") {
  bandeau.hidden = !texte; bandeau.className = "bandeau " + classe; bandeau.textContent = texte || "";
}
function messageSynchro() {
  const s = etat.synchro;
  if (s.erreur === "jeton") return message("Jeton refusé par GitHub : vérifiez-le dans Réglages. Données en cache conservées.", "bad");
  if (s.erreur === "schema_appli") return message("Les données du PC sont plus récentes que cette version de l'appli : mettez l'appli à jour.", "warn");
  if (s.erreur === "reseau") return message(etat.donnees ? "Hors ligne : données du " + dateFr(etat.donnees.meta.donnees_du) + "." : "Hors ligne et aucune donnée en cache.", "warn");
  if (s.erreur) return message("Synchronisation impossible (" + s.erreur + ").", "bad");
  message("");
}
const clientHorsLigne = { lireJson: async () => { throw new Error("hors ligne"); }, lire: async () => { throw new Error("hors ligne"); }, ecrire: async () => 0 };
export const actions = {
  naviguer(h) { location.hash = h; },
  async synchroniser(force = false) {
    if (!client) { message("Aucun jeton : ouvrez Réglages pour le saisir.", "warn"); return null; }
    if (etat.synchro.enCours) return null;
    etat.synchro.enCours = true; document.getElementById("b-synchro").classList.add("actif");
    const r = await synchroniser({ client, stockage, force });
    etat.synchro.enCours = false; document.getElementById("b-synchro").classList.remove("actif");
    etat.synchro.erreur = r.ok ? null : r.erreur;
    if (r.ok) { await chargerCache(); try { await viderFile({ stockage, client }); } catch { /* file rejouee plus tard */ } }
    messageSynchro();
    // Une synchro en arriere-plan ne doit pas effacer une saisie en cours (dossier, commentaire) : le rendu
    // est differe a la prochaine navigation si un champ a le focus ou si un dossier est en cours d'edition.
    const saisie = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "") || etat.route.vue === "dossier";
    if (!saisie || force) rendre();
    return r;
  },
  async chargerTexte(secteur) {
    if (etat.textes[secteur]) return etat.textes[secteur];
    etat.textes[secteur] = await chargerTexte({ client: client || clientHorsLigne, stockage, secteur });
    return etat.textes[secteur];
  },
  async enregistrerAvis(code, avis, commentaire) {
    if (!etat.donnees) return null;
    etat.donnees.avis = etat.donnees.avis || { schema: 1, fiches: {} };
    etat.donnees.avis.fiches = etat.donnees.avis.fiches || {};
    etat.donnees.avis.fiches[code] = { avis, commentaire: (commentaire || "").trim(), le: new Date().toISOString().slice(0, 19) };
    return enregistrerAvis({ stockage, client: client || clientHorsLigne, code, avis, commentaire });
  },
  async enregistrerJeton(jeton) {
    etat.reglages.jeton = (jeton || "").trim(); ecrireReglages(etat.reglages);
    client = etat.reglages.jeton ? creerClient(fetch.bind(window), etat.reglages.jeton) : null;
    return actions.synchroniser(true);
  },
  async viderCache() { await stockage.vider("donnees"); etat.donnees = null; etat.index = {}; etat.textes = {}; etat.synchro.derniere = null; rendre(); },
  async enregistrerDossier(d) { d.maj_le = new Date().toISOString(); await stockage.ecrire("dossiers", d.id, d); etat.dossiers = (await stockage.tout("dossiers")).map((x) => x.val); return d; },
  async supprimerDossier(id) { await supprimerFichiersDossier(stockage, id); await stockage.supprimer("dossiers", id); etat.dossiers = (await stockage.tout("dossiers")).map((x) => x.val); },
  stockage,
  async lirePartage() { const p = await stockage.lire("partages", "courant"); if (p) await stockage.supprimer("partages", "courant"); return p; },
  rendre: () => rendre(), etat,
};
function rendre() {
  const { vue, params } = etat.route;
  const mod = VUES[vue] || vAujourdhui;
  document.getElementById("titre-vue").textContent = mod.titre ? mod.titre(etat, params) : "Appli CEE";
  document.getElementById("b-retour").hidden = !(vue === "fiche" || vue === "dossier");
  for (const a of document.querySelectorAll(".onglets a")) a.setAttribute("aria-current", a.dataset.vue === ONGLET[vue] ? "page" : "false");
  main.innerHTML = mod.rendre ? mod.rendre(etat, params) : "<p class='vide'>À venir</p>";
  if (mod.monter) mod.monter(main, etat, actions, params);
}
window.addEventListener("hashchange", () => { etat.route = analyserRoute(location.hash); rendre(); window.scrollTo(0, 0); });
document.getElementById("b-synchro").addEventListener("click", () => actions.synchroniser(true));
document.getElementById("b-retour").addEventListener("click", () => history.length > 1 ? history.back() : actions.naviguer("#/" + ONGLET[etat.route.vue]));
(async function demarrer() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
  await chargerCache();
  etat.dossiers = (await stockage.tout("dossiers")).map((x) => x.val);
  rendre();
  if (client) actions.synchroniser(false);
  else if (!etat.donnees && etat.route.vue !== "reglages") actions.naviguer("#/reglages");
})();
