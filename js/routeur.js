// js/routeur.js — analyse du hash (pur)
const VUES = new Set(["accueil", "aujourdhui", "fiches", "fiche", "echeances", "dossiers", "dossier", "videos", "video", "projets", "reglages", "connexion"]);
const DETAIL = { fiche: ["code", "fiches"], dossier: ["id", "dossiers"], video: ["id", "videos"] };   // vue détail -> paramètre, vue liste

export function analyserRoute(hash) {
  const [chemin, requete = ""] = (hash || "").replace(/^#\/?/, "").split("?");
  const parts = chemin.split("/").filter(Boolean);
  const vue = parts[0] || "accueil";
  if (!VUES.has(vue)) return { vue: "accueil", params: {} };
  const params = {};
  if (DETAIL[vue] && parts[1]) params[DETAIL[vue][0]] = decodeURIComponent(parts[1]);
  for (const [k, v] of new URLSearchParams(requete)) params[k] = v;
  if (DETAIL[vue] && !parts[1]) return { vue: DETAIL[vue][1], params: {} };
  return { vue, params };
}

export function chemin(vue, params = {}) {
  if (DETAIL[vue]) return "#/" + vue + "/" + encodeURIComponent(params[DETAIL[vue][0]]);
  return "#/" + vue;
}
