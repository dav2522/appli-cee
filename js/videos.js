// js/videos.js — reconnaissance des liens, états, minutage (pur)
const ID = /^[A-Za-z0-9_-]{11}$/;
const HOTES = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"]);

export function identifiantYoutube(lien) {
  let u; try { u = new URL(String(lien || "").trim()); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const parts = u.pathname.split("/").filter(Boolean);
  let c = null;
  if (u.hostname === "youtu.be") c = parts[0];
  else if (HOTES.has(u.hostname)) c = u.pathname === "/watch" ? u.searchParams.get("v") : (["shorts", "live", "embed"].includes(parts[0]) ? parts[1] : null);
  return c && ID.test(c) ? c : null;
}
// Premier lien YouTube trouvé dans un texte partagé (« Regarde ça https://youtu.be/… »)
export function lienDansTexte(texte) {
  for (const m of String(texte || "").matchAll(/https?:\/\/\S+/g)) if (identifiantYoutube(m[0])) return m[0];
  return null;
}
export const ETATS = {
  en_attente: { lib: "En attente", fini: false }, verification: { lib: "Vérification de la vidéo", fini: false },
  transcription: { lib: "Transcription par Gemini", fini: false }, synthese: { lib: "Rédaction de la fiche", fini: false },
  relance: { lib: "Nouvelle synthèse en attente", fini: false }, terminee: { lib: "Fiche prête", fini: true }, echec: { lib: "Échec", fini: true },
};
export const enCours = (videos) => videos.some((v) => !(ETATS[v.etat] || { fini: true }).fini);
export function depuis(iso, maintenant = Date.now()) {
  const s = Math.max(0, Math.round((maintenant - Date.parse(iso)) / 1000));
  return s < 60 ? "à l'instant" : s < 3600 ? "il y a " + Math.round(s / 60) + " min" : s < 86400 ? "il y a " + Math.round(s / 3600) + " h" : "il y a " + Math.round(s / 86400) + " j";
}
