// js/claude.js — appels a l'API Anthropic depuis le telephone (SDK officiel vendu, cle locale a l'appareil)
import { MODELE } from "./questions.js";
export const MAX_TOKENS = 16000;
export const BETAS = ["server-side-fallback-2026-07-01"];   // fallbacks: "default" (repli serveur si refus du classifieur)
let sdk;
export async function chargerSdk() { if (!sdk) sdk = (await import("../vendor/anthropic-sdk.min.mjs")).default; return sdk; }
export async function creerClaude(cle, options = {}) {
  const A = await chargerSdk();
  // dangerouslyAllowBrowser : appli mono-utilisateur, la cle ne quitte pas le telephone (voir INSTALLATION.md)
  return new A({ apiKey: cle, dangerouslyAllowBrowser: true, maxRetries: 2, ...options });
}
// requete = { system, messages } de questions.js ; surTexte recoit chaque morceau de texte au fil du flux
export async function demander({ cle, requete, surTexte, signal, options }) {
  const client = await creerClaude(cle, options);
  const flux = client.beta.messages.stream({ model: MODELE, max_tokens: MAX_TOKENS, betas: BETAS, fallbacks: "default", thinking: { type: "adaptive" }, system: requete.system, messages: requete.messages }, signal ? { signal } : undefined);
  if (surTexte) flux.on("text", surTexte);
  const m = await flux.finalMessage();
  const u = m.usage || {};
  return { texte: m.content.filter((b) => b.type === "text").map((b) => b.text).join(""), stop: m.stop_reason, modele: m.model || MODELE,
    usage: { entree: u.input_tokens || 0, cache_lu: u.cache_read_input_tokens || 0, cache_ecrit: u.cache_creation_input_tokens || 0, sortie: u.output_tokens || 0 } };
}
export function classerErreur(e) {
  const A = sdk;
  if (!A || !(e instanceof A.APIError)) return e && e.name === "AbortError" ? "arret" : "inconnue";
  if (e instanceof A.APIUserAbortError) return "arret";
  if (e instanceof A.APIConnectionError) return "reseau";
  if (e instanceof A.AuthenticationError) return "cle";
  if (e instanceof A.PermissionDeniedError) return "interdit";
  if (e instanceof A.RateLimitError) return "limite";
  if (e instanceof A.BadRequestError) return "requete";
  if (e instanceof A.InternalServerError) return "surcharge";
  return "inconnue";
}
export function detailErreur(e) { return e && e.error && e.error.error && e.error.error.message ? e.error.error.message : (e && e.message) || ""; }
export async function testerCle(cle, options) {
  try { const m = await (await creerClaude(cle, options)).models.retrieve(MODELE); return { ok: true, modele: m.display_name || m.id }; }
  catch (e) { return { ok: false, code: classerErreur(e), detail: detailErreur(e) }; }
}
