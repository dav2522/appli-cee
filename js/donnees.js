// js/donnees.js — reglages, client de l'API du serveur, decision de synchro, file d'avis. Pur sauf fetch injecte.
// Depuis le socle B (05/10/2026) : les donnees viennent du serveur de l'appli (session par empreinte), plus de GitHub ni de jeton.
export const SCHEMA_APPLI = 1;
export const API = "/api/cee/";
export const FICHIERS_PRINCIPAUX = ["fiches.json", "jour.json", "fil.json", "consultations.json", "registre.json", "jalons.json", "avis.json"];
export const SECTEURS = ["BAR", "BAT", "IND", "AGRI", "TRA", "RES"];

export function lireReglages() {
  return { theme: localStorage.getItem("theme") || "auto" };
}
export function ecrireReglages(r) {
  localStorage.setItem("theme", r.theme || "auto"); localStorage.removeItem("jeton");   // ancien jeton GitHub : effacé
}

// Memes chemins que l'ancien depot (app/…, avis/…), servis par le serveur avec le cookie de session.
export function creerClient(fetchImpl, racine = API) {
  async function lire(chemin) {
    const r = await fetchImpl(racine + chemin, { credentials: "same-origin" });
    return { status: r.status, texte: await r.text() };
  }
  return {
    lire,
    async lireJson(chemin) {
      const r = await lire(chemin);
      if (r.status === 404) return null;
      if (r.status !== 200) throw new Error("HTTP " + r.status);
      return JSON.parse(r.texte);
    },
    async ecrire(chemin, texte) {
      const r = await fetchImpl(racine + chemin, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: texte });
      return r.status;
    },
  };
}

export function decisionSynchro(locale, distante, force = false) {
  if (!distante || typeof distante !== "object") return { action: "injoignable", fichiers: [] };
  if ((distante.schema || 1) > SCHEMA_APPLI) return { action: "schema_appli", fichiers: [] };
  const fichiers = FICHIERS_PRINCIPAUX.filter((n) => !distante.fichiers || n in distante.fichiers);
  if (force || !locale || (distante.genere_le || "") > (locale.genere_le || "")) return { action: "telecharger", fichiers };
  return { action: "a_jour", fichiers: [] };
}

export async function synchroniser({ client, stockage, force = false, maintenant = () => new Date().toISOString() }) {
  const locale = await stockage.lire("donnees", "meta");
  let r;
  try { r = await client.lire("app/meta.json"); } catch { return { ok: false, erreur: "reseau", meta: locale }; }
  if (r.status === 401 || r.status === 403) return { ok: false, erreur: "connexion", meta: locale };
  if (r.status !== 200) return { ok: false, erreur: "http " + r.status, meta: locale };
  let distante;
  try { distante = JSON.parse(r.texte); } catch { return { ok: false, erreur: "meta illisible", meta: locale }; }
  const d = decisionSynchro(locale, distante, force);
  if (d.action === "schema_appli") return { ok: false, erreur: "schema_appli", meta: locale };
  if (d.action === "a_jour") { await stockage.ecrire("donnees", "synchro", maintenant()); return { ok: true, telecharges: 0, meta: locale }; }
  let n = 0;
  for (const nom of d.fichiers) {
    let f;
    try { f = await client.lire("app/" + nom); } catch { return { ok: false, erreur: "reseau", meta: locale }; }
    if (f.status !== 200) return { ok: false, erreur: "fichier " + nom + " : HTTP " + f.status, meta: locale };
    await stockage.ecrire("donnees", nom.replace(/\.json$/, ""), JSON.parse(f.texte));
    n++;
  }
  for (const s of SECTEURS) await stockage.supprimer("donnees", "textes/" + s);   // recharges a la demande
  await stockage.ecrire("donnees", "meta", distante);
  await stockage.ecrire("donnees", "synchro", maintenant());
  return { ok: true, telecharges: n, meta: distante };
}

export async function chargerTexte({ client, stockage, secteur }) {
  const cle = "textes/" + secteur;
  const local = await stockage.lire("donnees", cle);
  if (local) return local.textes || {};
  const r = await client.lire("app/textes/" + secteur + ".json");
  if (r.status !== 200) throw new Error("HTTP " + r.status);
  const t = JSON.parse(r.texte);
  await stockage.ecrire("donnees", cle, t);
  return t.textes || {};
}

export function avisGagnant(local, distant) {
  if (!distant || !distant.le) return local;
  if (!local || !local.le) return distant;
  return distant.le > local.le ? distant : local;
}

export async function viderFile({ stockage, client }) {
  let envoyes = 0, restants = 0;
  for (const { cle: code, val } of await stockage.tout("file")) {
    try {
      const distant = await client.lireJson("avis/" + code + ".json");
      const gagnant = avisGagnant(val, distant);
      if (gagnant === val) {
        const st = await client.ecrire("avis/" + code + ".json", JSON.stringify(val));
        if (st !== 200 && st !== 201) { restants++; continue; }
      } else {
        const local = (await stockage.lire("donnees", "avis")) || { schema: SCHEMA_APPLI, fiches: {} };
        local.fiches = local.fiches || {}; local.fiches[code] = gagnant; await stockage.ecrire("donnees", "avis", local);
      }
      await stockage.supprimer("file", code); envoyes++;
    } catch { restants++; }
  }
  return { envoyes, restants };
}

export async function enregistrerAvis({ stockage, client, code, avis, commentaire }) {
  const entree = { avis: avis || "", commentaire: (commentaire || "").trim(), le: new Date().toISOString().slice(0, 19) };
  const local = (await stockage.lire("donnees", "avis")) || { schema: SCHEMA_APPLI, fiches: {} };
  local.fiches = local.fiches || {}; local.fiches[code] = entree;
  await stockage.ecrire("donnees", "avis", local);
  await stockage.ecrire("file", code, entree);
  return viderFile({ stockage, client });
}
