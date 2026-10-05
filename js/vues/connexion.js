// js/vues/connexion.js — connexion par empreinte (clé d'accès), première inscription avec un code, ajout d'un appareil
import { ech, ico } from "../format.js";
import { optionsCreation, optionsConnexion, jsonCreation, jsonConnexion } from "../webauthn.js";
export const titre = () => "Connexion";
async function poster(url, corps) {
  const r = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps || {}) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || "Erreur " + r.status);
  return d;
}
export function rendre(etat, p) {
  const s = etat.session || {};
  if (p.ajout && s.connecte) return `<section class="carte connexion"><h2>Ajouter un appareil</h2>
<p>Sur l'appareil à ajouter, ou sur ce téléphone pour une seconde clé : crée une clé d'accès liée à ton compte.</p>
<button type="button" class="btn" id="c-creer">${ico("cle")} Créer une clé d'accès</button><p id="c-etat" class="resume" aria-live="polite"></p><div id="c-secours" hidden></div></section>`;
  if (!etat.session) return `<p class="vide">Serveur injoignable : vérifie ta connexion, puis touche ↻.</p>`;
  if (s.peut_inscrire && !s.connecte) return `<section class="carte connexion"><h2>Code accepté</h2>
<p>Crée maintenant ta clé d'accès : le téléphone va te demander ton empreinte (ou le verrouillage de l'écran).</p>
<button type="button" class="btn" id="c-creer">${ico("cle")} Créer ma clé d'accès</button><p id="c-etat" class="resume" aria-live="polite"></p><div id="c-secours" hidden></div></section>`;
  const premiere = !s.cles;
  return `<section class="carte connexion">
<h2>${premiere ? "Première connexion" : "Bonjour David"}</h2>
${premiere ? "<p>Saisis le code d'inscription reçu, puis crée ta clé d'accès. Ensuite, ton empreinte suffira.</p>"
    : `<button type="button" class="btn" id="c-empreinte">${ico("cle")} Me connecter avec mon empreinte</button>`}
<details ${premiere ? "open" : ""}><summary>${premiere ? "Code d'inscription" : "J'ai un code (nouvel appareil ou code de secours)"}</summary>
<label class="champ"><span>Code</span><input id="c-code" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX"></label>
<button type="button" class="btn" id="c-creer">${ico("cle")} Créer ma clé d'accès</button></details>
<p id="c-etat" class="resume" aria-live="polite">${window.PublicKeyCredential ? "" : "Ce navigateur ne gère pas les clés d'accès : ouvre l'appli dans Chrome ou Samsung Internet."}</p>
<div id="c-secours" hidden></div></section>`;
}
export function monter(root, etat, actions, p) {
  const msg = (t) => { root.querySelector("#c-etat").textContent = t; };
  // Erreur affichée telle quelle (nom technique compris) et transmise au serveur pour diagnostic
  const erreur = (e, etape) => {
    const nom = e?.name || "Erreur", texte = e?.message || String(e);
    msg((nom === "NotAllowedError" ? "Opération annulée ou délai dépassé : réessaie. " : "") + "(" + nom + " : " + texte + ")");
    fetch("/api/session/erreur", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ etape, nom, message: texte, navigateur: navigator.userAgent }) }).catch(() => {});
  };
  root.querySelector("#c-empreinte")?.addEventListener("click", async () => {
    try {
      msg("Pose ton doigt sur le capteur…");
      const { defi, options } = await poster("/api/session/connexion/options");
      const cred = await navigator.credentials.get({ publicKey: optionsConnexion(options) });
      await poster("/api/session/connexion/verifier", { defi, credential: jsonConnexion(cred) });
      await actions.apresConnexion();
    } catch (e) { erreur(e, "connexion"); }
  });
  root.querySelector("#c-creer").addEventListener("click", async () => {
    try {
      const code = root.querySelector("#c-code")?.value.trim();
      // Code déjà accepté (session provisoire de 15 min) : on ne le renvoie pas, il ne sert qu'une fois
      const sess = await fetch("/api/session", { credentials: "same-origin" }).then((r) => r.json()).catch(() => ({}));
      if (code && !sess.peut_inscrire) await poster("/api/session/code", { code });
      msg("Crée ta clé : pose ton doigt sur le capteur…");
      const { defi, options } = await poster("/api/session/inscription/options");
      const cred = await navigator.credentials.create({ publicKey: optionsCreation(options) });
      const r = await poster("/api/session/inscription/verifier", { defi, credential: jsonCreation(cred), nom: p.ajout ? "Appareil ajouté" : "Téléphone" });
      if (!r.code_secours) return actions.apresConnexion();
      const z = root.querySelector("#c-secours");
      z.hidden = false; msg("Clé d'accès créée.");
      z.innerHTML = `<div class="bandeau ok"><b>Code de secours, à noter maintenant</b> (gestionnaire de mots de passe ou papier) : il ne sera plus jamais affiché.
Il sert si tu perds ce téléphone.<p class="code-secours">${ech(r.code_secours)}</p></div>
<button type="button" class="btn" id="c-continuer">${ico("ok")} J'ai noté le code</button>`;
      z.querySelector("#c-continuer").addEventListener("click", () => actions.apresConnexion());
    } catch (e) { erreur(e, "inscription"); actions.lireSession(); }
  });
}
