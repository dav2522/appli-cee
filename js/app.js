// js/app.js — demarrage, session, routage, etat global, actions partagees par les vues
import { analyserRoute } from "./routeur.js";
import * as stockage from "./stockage.js";
import { lireReglages, creerClient, synchroniser, enregistrerAvis, viderFile, chargerTexte } from "./donnees.js";
import * as vAccueil from "./vues/accueil.js";
import * as vAujourdhui from "./vues/aujourdhui.js";
import * as vFiches from "./vues/fiches.js";
import * as vFiche from "./vues/fiche.js";
import * as vEcheances from "./vues/echeances.js";
import * as vDossiers from "./vues/dossiers.js";
import * as vVideos from "./vues/videos.js";
import * as vProjets from "./vues/projets.js";
import * as vReglages from "./vues/reglages.js";
import * as vConnexion from "./vues/connexion.js";
import { dateFr } from "./format.js";
import { supprimerFichiersDossier } from "./fichiers.js";

export const VERSION_APPLI = "2.0.0";
const VUES = { accueil: vAccueil, aujourdhui: vAujourdhui, fiches: vFiches, fiche: vFiche, echeances: vEcheances, dossiers: vDossiers, dossier: vDossiers,
  videos: vVideos, video: vVideos, projets: vProjets, reglages: vReglages, connexion: vConnexion };
const ONGLET = { accueil: "accueil", aujourdhui: "solhy", fiches: "solhy", fiche: "solhy", echeances: "solhy", dossiers: "solhy", dossier: "solhy",
  videos: "videos", video: "videos", projets: "projets", reglages: "reglages", connexion: "" };
const SOUS_ONGLET = { aujourdhui: "aujourdhui", fiches: "fiches", fiche: "fiches", echeances: "echeances", dossiers: "dossiers", dossier: "dossiers" };
const RETOUR = new Set(["fiche", "dossier", "video"]);
const main = document.getElementById("vue"), bandeau = document.getElementById("bandeau");
const etat = { reglages: lireReglages(), donnees: null, index: {}, textes: {}, dossiers: [], session: null, videos: null, projets: null,
  synchro: { enCours: false, derniere: null, erreur: null }, route: analyserRoute(location.hash), ui: {} };
const client = creerClient(fetch.bind(window));
let routeApresConnexion = null;

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
  if (s.erreur === "connexion") return message("Session expirée : reconnecte-toi avec ton empreinte. Données en cache conservées.", "warn");
  if (s.erreur === "schema_appli") return message("Les données sont plus récentes que cette version de l'appli : mets l'appli à jour.", "warn");
  if (s.erreur === "reseau") return message(etat.donnees ? "Hors ligne : données du " + dateFr(etat.donnees.meta.donnees_du) + "." : "Hors ligne et aucune donnée en cache.", "warn");
  if (s.erreur) return message("Synchronisation impossible (" + s.erreur + ").", "bad");
  message("");
}
async function api(methode, url, corps) {
  const r = await fetch(url, { method: methode, credentials: "same-origin", headers: corps === undefined ? {} : { "Content-Type": "application/json" },
    body: corps === undefined ? undefined : JSON.stringify(corps) });
  if (r.status === 401) { etat.session = { ...(etat.session || {}), connecte: false }; }
  const d = await r.json().catch(() => ({}));
  return { status: r.status, ok: r.ok, d };
}
const clientHorsLigne = { lireJson: async () => { throw new Error("hors ligne"); }, lire: async () => { throw new Error("hors ligne"); }, ecrire: async () => 0 };
export const actions = {
  naviguer(h) { location.hash = h; },
  api,
  async synchroniser(force = false) {
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
    etat.textes[secteur] = await chargerTexte({ client: navigator.onLine ? client : clientHorsLigne, stockage, secteur });
    return etat.textes[secteur];
  },
  async enregistrerAvis(code, avis, commentaire) {
    if (!etat.donnees) return null;
    etat.donnees.avis = etat.donnees.avis || { schema: 1, fiches: {} };
    etat.donnees.avis.fiches = etat.donnees.avis.fiches || {};
    etat.donnees.avis.fiches[code] = { avis, commentaire: (commentaire || "").trim(), le: new Date().toISOString().slice(0, 19) };
    return enregistrerAvis({ stockage, client, code, avis, commentaire });
  },
  async viderCache() { await stockage.vider("donnees"); etat.donnees = null; etat.index = {}; etat.textes = {}; etat.synchro.derniere = null; etat.videos = null; etat.projets = null; rendre(); },
  async enregistrerDossier(d) { d.maj_le = new Date().toISOString(); await stockage.ecrire("dossiers", d.id, d); etat.dossiers = (await stockage.tout("dossiers")).map((x) => x.val); return d; },
  async supprimerDossier(id) { await supprimerFichiersDossier(stockage, id); await stockage.supprimer("dossiers", id); etat.dossiers = (await stockage.tout("dossiers")).map((x) => x.val); },
  stockage,
  async lirePartage() { const p = await stockage.lire("partages", "courant"); if (p) await stockage.supprimer("partages", "courant"); return p; },
  // Vidéos : liste et fiches gardées en cache pour la lecture hors ligne
  async chargerVideos() {
    try { const r = await api("GET", "/api/videos"); if (r.ok) { etat.videos = r.d; await stockage.ecrire("donnees", "videos/liste", r.d); return; } } catch { /* hors ligne */ }
    etat.videos = (await stockage.lire("donnees", "videos/liste")) || [];
  },
  async demanderVideo(lien, forcer) {
    try {
      const r = await api("POST", "/api/videos", { lien, forcer });
      if (!r.ok) return { erreur: r.d.detail || "Erreur " + r.status };
      await actions.chargerVideos(); return r.d;
    } catch { return { erreur: "Hors ligne : réessaie une fois connecté." }; }
  },
  async ficheVideo(id) {
    const cle = "videos/fiche/" + id;
    try { const r = await fetch("/api/videos/" + id + "/fiche", { credentials: "same-origin" }); if (r.ok) { const html = await r.text(); await stockage.ecrire("donnees", cle, html); return html; } } catch { /* hors ligne */ }
    return stockage.lire("donnees", cle);
  },
  async chargerProjets() {
    try { const r = await api("GET", "/api/projets"); if (r.ok) { etat.projets = r.d; await stockage.ecrire("donnees", "projets", r.d); return; } } catch { /* hors ligne */ }
    etat.projets = (await stockage.lire("donnees", "projets")) || [];
  },
  async enregistrerProjets(projets) {
    const r = await api("PUT", "/api/projets", projets).catch(() => null);
    if (r?.ok) { etat.projets = r.d; await stockage.ecrire("donnees", "projets", r.d); } else message("Projets non enregistrés : connexion au serveur impossible.", "bad");
  },
  async lireSession() {
    try { const r = await api("GET", "/api/session"); if (r.ok) etat.session = r.d; } catch { etat.session = null; }   // null = hors ligne
    return etat.session;
  },
  async apresConnexion() {
    await actions.lireSession();
    const cible = routeApresConnexion || "#/accueil"; routeApresConnexion = null;
    etat.videos = null; etat.projets = null;
    actions.naviguer(cible); actions.synchroniser(true);
  },
  async deconnexion() {
    await api("POST", "/api/session/deconnexion").catch(() => null);
    await actions.lireSession();                          // état réel (nombre de clés), même après un démarrage hors ligne
    etat.session = { ...(etat.session || {}), connecte: false };
    actions.naviguer("#/connexion");
  },
  rendre: () => rendre(), etat,
};
function rendre() {
  const { vue, params } = etat.route;
  // Pas de session (et serveur joignable) : écran de connexion, puis retour à l'écran demandé
  if (etat.session && !etat.session.connecte && vue !== "connexion") { routeApresConnexion = location.hash || "#/accueil"; location.replace("#/connexion"); etat.route = analyserRoute("#/connexion"); return rendre(); }
  const mod = VUES[vue] || vAccueil;
  document.getElementById("titre-vue").textContent = mod.titre ? mod.titre(etat, params) : "Appli CEE";
  document.getElementById("b-retour").hidden = !RETOUR.has(vue);
  document.body.dataset.vue = vue;
  for (const a of document.querySelectorAll(".onglets a")) a.setAttribute("aria-current", a.dataset.vue === ONGLET[vue] ? "page" : "false");
  const sous = document.getElementById("sous-onglets");
  sous.hidden = ONGLET[vue] !== "solhy";
  for (const a of sous.querySelectorAll("a")) a.setAttribute("aria-current", a.dataset.vue === SOUS_ONGLET[vue] ? "page" : "false");
  main.innerHTML = mod.rendre ? mod.rendre(etat, params) : "<p class='vide'>À venir</p>";
  if (mod.monter) mod.monter(main, etat, actions, params);
}
window.addEventListener("hashchange", () => { etat.route = analyserRoute(location.hash); rendre(); window.scrollTo(0, 0); });
document.getElementById("b-synchro").addEventListener("click", () => actions.synchroniser(true));
document.getElementById("b-retour").addEventListener("click", () => history.length > 1 ? history.back() : actions.naviguer("#/" + ({ fiche: "fiches", dossier: "dossiers", video: "videos" }[etat.route.vue] || "accueil")));
(async function demarrer() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
  await chargerCache();
  etat.dossiers = (await stockage.tout("dossiers")).map((x) => x.val);
  await actions.lireSession();
  rendre();
  if (etat.session?.connecte) actions.synchroniser(false);
  else if (!etat.session) { etat.synchro.erreur = "reseau"; messageSynchro(); }      // serveur injoignable : cache
})();
