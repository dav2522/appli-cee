// js/fiches.js — filtres, tris, groupes (pur)
export const FILTRES_DEFAUT = { avis: "tous", cp: "tous", intensite: "tous", difficulte: "tous", parution: "tous", masquerFins: true, q: "", tri: "potentiel" };
export function normaliser(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’‘`]/g, "'").replace(/\s+/g, " ").trim();
}
function cleParution(anneeMax) { const d = new Date(); d.setFullYear(d.getFullYear() - anneeMax); return +d.toISOString().slice(0, 10).replace(/-/g, ""); }
export function filtrer(fiches, filtres, avis = {}) {
  const f = { ...FILTRES_DEFAUT, ...filtres };
  const q = normaliser(f.q);
  return fiches.filter((x) => {
    const texte = q ? normaliser([x.code, x.titre, x.nom, x.carte?.resume, ...(x.carte?.params || [])].join(" ")) : "";
    if (q && !texte.includes(q)) return false;
    if (x.statut !== "active") return !!q;                       // terminees : seulement par la recherche
    if (!q && f.masquerFins && x.fin_proche) return false;
    const a = (avis[x.code] || {}).avis || "";
    if (f.avis === "up" && a !== "up") return false;
    if (f.avis === "sans" && a) return false;
    if (f.avis === "nodown" && a === "down") return false;
    if (f.cp === "avec" && !((x.cdp?.cp || 1) > 1)) return false;
    if (f.cp === "sans" && (x.cdp?.cp || 1) > 1) return false;
    if (f.intensite !== "tous" && (x.carte?.intensite || "volume") !== f.intensite) return false;
    if (f.difficulte !== "tous" && (x.carte?.difficulte || "") !== f.difficulte) return false;
    if (f.parution === "1a" && (x.parution?.cle || 0) < cleParution(1)) return false;
    if (f.parution === "2a" && (x.parution?.cle || 0) < cleParution(2)) return false;
    return true;
  });
}
export function trier(fiches, tri = "potentiel") {
  const c = {
    potentiel: (a, b) => (a.ordre ?? 1e9) - (b.ordre ?? 1e9) || a.code.localeCompare(b.code),
    volume: (a, b) => (b.marche?.kwh || 0) - (a.marche?.kwh || 0) || a.code.localeCompare(b.code),
    parution: (a, b) => (b.parution?.cle || 0) - (a.parution?.cle || 0) || a.code.localeCompare(b.code),
    code: (a, b) => a.code.localeCompare(b.code),
  }[tri] || (() => 0);
  return [...fiches].sort(c);
}
export function grouper(fiches, libelles) {
  const out = [];
  for (const f of fiches) {
    const g = f.statut === "active" ? (f.groupe ?? 2) : 3;
    let bloc = out[out.length - 1];
    if (!bloc || bloc.groupe !== g) { bloc = { groupe: g, libelle: g === 3 ? "Fiches terminées" : (libelles[g] || ""), fiches: [] }; out.push(bloc); }
    bloc.fiches.push(f);
  }
  return out;
}
export function lireFiltres(params = {}, ui = {}) {
  const f = { ...FILTRES_DEFAUT, ...ui };
  for (const k of ["avis", "cp", "intensite", "difficulte", "parution", "tri", "q"]) if (params[k] !== undefined) f[k] = params[k];
  return f;
}
