// js/webauthn.js — conversions pour les clés d'accès (empreinte). Pur : testé sans navigateur.
export function versOctets(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
}
export function versB64url(tampon) {
  let s = ""; for (const o of new Uint8Array(tampon)) s += String.fromCharCode(o);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
// Options JSON du serveur -> objets attendus par navigator.credentials.create / get
export function optionsCreation(o) {
  return { ...o, challenge: versOctets(o.challenge), user: { ...o.user, id: versOctets(o.user.id) },
    excludeCredentials: (o.excludeCredentials || []).map((c) => ({ ...c, id: versOctets(c.id) })) };
}
export function optionsConnexion(o) {
  return { ...o, challenge: versOctets(o.challenge), allowCredentials: (o.allowCredentials || []).map((c) => ({ ...c, id: versOctets(c.id) })) };
}
// Réponse du navigateur -> JSON pour le serveur
export function jsonCreation(c) {
  return { id: c.id, rawId: versB64url(c.rawId), type: c.type, response: {
    clientDataJSON: versB64url(c.response.clientDataJSON), attestationObject: versB64url(c.response.attestationObject),
    transports: c.response.getTransports ? c.response.getTransports() : [] }, clientExtensionResults: {} };
}
export function jsonConnexion(c) {
  const r = c.response;
  return { id: c.id, rawId: versB64url(c.rawId), type: c.type, response: {
    clientDataJSON: versB64url(r.clientDataJSON), authenticatorData: versB64url(r.authenticatorData),
    signature: versB64url(r.signature), userHandle: r.userHandle ? versB64url(r.userHandle) : null }, clientExtensionResults: {} };
}
