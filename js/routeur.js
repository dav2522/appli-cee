// js/routeur.js — analyse du hash (pur)
const VUES = new Set(["aujourdhui", "fiches", "fiche", "echeances", "dossiers", "dossier", "reglages"]);

export function analyserRoute(hash) {
  const [chemin, requete = ""] = (hash || "").replace(/^#\/?/, "").split("?");
  const parts = chemin.split("/").filter(Boolean);
  const vue = parts[0] || "aujourdhui";
  if (!VUES.has(vue)) return { vue: "aujourdhui", params: {} };
  const params = {};
  if (vue === "fiche" && parts[1]) params.code = decodeURIComponent(parts[1]);
  if (vue === "dossier" && parts[1]) params.id = decodeURIComponent(parts[1]);
  for (const [k, v] of new URLSearchParams(requete)) params[k] = v;
  if ((vue === "fiche" || vue === "dossier") && !parts[1]) return { vue: vue === "fiche" ? "fiches" : "dossiers", params: {} };
  return { vue, params };
}

export function chemin(vue, params = {}) {
  if (vue === "fiche") return "#/fiche/" + encodeURIComponent(params.code);
  if (vue === "dossier") return "#/dossier/" + encodeURIComponent(params.id);
  return "#/" + vue;
}
