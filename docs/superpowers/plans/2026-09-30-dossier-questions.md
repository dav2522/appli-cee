# Dossier : documents et questions à Claude — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dans l'onglet Dossier, conserver les fichiers importés (PDF, photos, textes), les afficher, poser des questions à Claude dessus (streaming, mémoire de conversation par dossier) et garder un historique dépliable des questions.

**Architecture:** Modules ES purs testés en Node (`questions.js`, `fichiers.js`, `images.js` partiel, rendu HTML de `dossier-questions.js`) + modules navigateur (`claude.js` sur le SDK officiel vendu, `visionneuse.js` sur pdf.js, intégration dans `vues/dossiers.js` et `vues/reglages.js`). IndexedDB v2 avec un store `fichiers` (blobs). Appels directs du téléphone à `api.anthropic.com` avec la clé de David.

**Tech Stack:** HTML/CSS/JS ES modules sans build ; `@anthropic-ai/sdk` 0.129.0 bundlé par esbuild 0.28.2 ; pdf.js vendu ; tests `node --test` (Node 18.4 via `python3 -m nodejs`) et Playwright Python.

**Spec:** `docs/superpowers/specs/2026-09-30-dossier-questions-design.md`

## Global Constraints

- Modèle `claude-opus-5`, `max_tokens` 16 000, `thinking: { type: "adaptive" }`, `betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`, appel via `client.beta.messages.stream(...)` du SDK vendu (`dangerouslyAllowBrowser: true`, `maxRetries: 2`).
- Clé API dans `localStorage` (`cle_api`) uniquement ; jamais dans un dépôt, un test ou un log.
- Historique renvoyé : 8 derniers échanges en état `ok` ; requête refusée côté appli si base64 cumulé > 30 Mo ou > 20 images.
- Images réduites à 2000 px de côté long, JPEG 0,85, avant stockage et envoi.
- Base IndexedDB `appli-cee` version 2, stores `donnees, dossiers, file, partages, fichiers`.
- Tout texte visible en français, avec accents ; identifiants de code en français sans accent (convention du dépôt).
- Commits : message en français, ligne finale `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. Dossier ouvert alors qu'une question était `en_cours` (appli fermée pendant le flux) : l'entrée doit passer en `erreur` « interrompue » avec la réponse partielle, jamais rester bloquée — test dans la tâche 6 (rendu) via `normaliserQuestions`.
2. Photo HEIC ou format non décodable : `reduireImage` rend le fichier original ; `construireRequete` l'ignore ; l'interface affiche « format non pris en charge » au lieu d'un appel qui échoue en 400 — tâche 2 (`construireRequete` ignore les types inconnus, retour `ignores`).
3. Ancien dossier (fichiers sans `cle`) : la question part sans document mais avec le texte extrait ; la liste affiche « non conservé : réimporter » — tâches 2 et 5.
4. Clé absente ou refusée en cours de route : bouton en mode partage, message clair, l'entrée reste dans l'historique avec son état — tâches 3 (`classerErreur`) et 5 (rendu selon la clé).
5. Suppression d'un dossier : les blobs du store `fichiers` sont supprimés (préfixe) — tâche 4 (`supprimerFichiersDossier`) et Playwright (tâche 7).

---

### Task 1: SDK Anthropic vendu

**Files:**
- Create: `tools/bundle-sdk.sh`, `vendor/anthropic-sdk.min.mjs` (généré), `vendor/LICENSE-anthropic-sdk` (copié)
- Test: `tests/claude.test.js`

**Interfaces:**
- Produces: `vendor/anthropic-sdk.min.mjs` — export par défaut `Anthropic` (classe client) exposant `APIError`, `APIConnectionError`, `APIUserAbortError`, `AuthenticationError`, `PermissionDeniedError`, `RateLimitError`, `BadRequestError`, `InternalServerError`, `NotFoundError`, et `APIError.generate(status, corps, message, headers)`.

- [ ] **Step 1: Test qui échoue**

```js
// tests/claude.test.js
import test from "node:test";
import assert from "node:assert/strict";
test("SDK vendu : export par défaut et classes d'erreur", async () => {
  const { default: Anthropic } = await import("../vendor/anthropic-sdk.min.mjs");
  assert.equal(typeof Anthropic, "function");
  for (const k of ["APIError", "APIConnectionError", "APIUserAbortError", "AuthenticationError", "PermissionDeniedError", "RateLimitError", "BadRequestError", "InternalServerError"]) assert.equal(typeof Anthropic[k], "function", k);
  const e = Anthropic.APIError.generate(401, { error: { type: "authentication_error", message: "invalid x-api-key" } }, undefined, new Headers());
  assert.ok(e instanceof Anthropic.AuthenticationError);
});
```

- [ ] **Step 2: Vérifier l'échec** — `cd /home/appli-cee && python3 -m nodejs --test tests/claude.test.js` → Expected: FAIL `ERR_MODULE_NOT_FOUND` (vendor absent).

- [ ] **Step 3: Script de bundle**

```bash
#!/usr/bin/env bash
# tools/bundle-sdk.sh — reconstruit vendor/anthropic-sdk.min.mjs (SDK officiel @anthropic-ai/sdk, bundle navigateur).
# Usage : tools/bundle-sdk.sh [version]   (defaut 0.129.0). Necessite node et npm dans le PATH.
set -euo pipefail
VERSION="${1:-0.129.0}"; ESBUILD="0.28.2"
RACINE="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
cd "$TMP"
npm init -y >/dev/null
npm install --no-audit --no-fund "esbuild@$ESBUILD" "@anthropic-ai/sdk@$VERSION" >/dev/null
printf 'import Anthropic from "@anthropic-ai/sdk";\nexport default Anthropic;\nexport { Anthropic };\n' > entree.mjs
ESB="$(ls node_modules/@esbuild/*/bin/esbuild | head -1)"
"$ESB" entree.mjs --bundle --format=esm --platform=browser --target=es2022 --minify --legal-comments=none --outfile=sortie.mjs
{ printf '// @anthropic-ai/sdk %s (MIT) — bundle esbuild %s, voir tools/bundle-sdk.sh\n' "$VERSION" "$ESBUILD"; cat sortie.mjs; } > "$RACINE/vendor/anthropic-sdk.min.mjs"
cp node_modules/@anthropic-ai/sdk/LICENSE "$RACINE/vendor/LICENSE-anthropic-sdk"
echo "OK : vendor/anthropic-sdk.min.mjs ($(wc -c < "$RACINE/vendor/anthropic-sdk.min.mjs") octets)"
```

- [ ] **Step 4: Exécuter** — `chmod +x tools/bundle-sdk.sh && PATH="/usr/local/lib/python3.12/dist-packages/nodejs/bin:$PATH" tools/bundle-sdk.sh` → Expected: `OK : vendor/anthropic-sdk.min.mjs (≈194000 octets)`.
- [ ] **Step 5: Test vert** — `python3 -m nodejs --test tests/claude.test.js` → Expected: PASS 1/1.
- [ ] **Step 6: Commit** — `git add tools/bundle-sdk.sh vendor/anthropic-sdk.min.mjs vendor/LICENSE-anthropic-sdk tests/claude.test.js && git commit -m "SDK Anthropic vendu (bundle esbuild) pour les questions à Claude"`.

---

### Task 2: `js/questions.js` (pur) et `sectionsTexte`

**Files:**
- Create: `js/questions.js`
- Modify: `js/dossier.js` (extraire `sectionsTexte`), `js/format.js` (`mdBloc`)
- Test: `tests/questions.test.js`, `tests/format.test.js` (ajout)

**Interfaces:**
- Produces: `MODELE = "claude-opus-5"`, `HISTORIQUE_MAX = 8`, `TAILLE_MAX = 30 * 1048576`, `IMAGES_MAX = 20`, `MEDIAS_IMAGE` (Set), `SYSTEME` (string), `SUGGESTIONS = [{ titre, texte }]`, `contexteFiche(fiche, texteOfficiel = "", avis) → string`, `verifierTaille(fichiers) → null | "trop_volumineux" | "trop_images"`, `construireRequete({ fichiers, texteExtrait, questions, question, fiche, texteOfficiel, avis }) → { system, messages, ignores }` (fichiers = `[{ nom, type, base64 }]` ou `{ nom, type, texte }`), `estimerCout(usage) → number ($)`, `formaterCout(usage) → string`, `nouvelleQuestion(question) → { id, le, question, reponse, etat, erreur, modele, usage }`, `messageErreur(code, detail) → string`, `normaliserQuestions(questions) → questions` (en_cours → erreur interrompue).
- `js/dossier.js` : `export function sectionsTexte(texteOfficiel) → { conditions, bareme }` (utilisé par `construireDossier` et `contexteFiche`).
- `js/format.js` : `export function mdBloc(t) → html` (paragraphes, titres `#`, listes `-`/`1.`, gras, code en ligne).

- [ ] **Step 1: Tests qui échouent**

```js
// tests/questions.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { construireRequete, verifierTaille, estimerCout, formaterCout, nouvelleQuestion, messageErreur, normaliserQuestions, contexteFiche, HISTORIQUE_MAX, SUGGESTIONS, SYSTEME } from "../js/questions.js";
const F = JSON.parse(readFileSync(new URL("./fixtures/fiches-mini.json", import.meta.url))).fiches;
const fiche = F.find((f) => f.code === "BAT-TH-163");
const pdf = { nom: "devis.pdf", type: "application/pdf", base64: "JVBERi0=" };
const photo = { nom: "photo.jpg", type: "image/jpeg", base64: "/9j/4AAQ" };
const txt = { nom: "notes.txt", type: "text/plain", texte: "PAC 160 kW" };

test("requête : documents étiquetés, cache sur le dernier document, question en dernier", () => {
  const r = construireRequete({ fichiers: [pdf, photo, txt], question: "Ce devis est-il conforme ?" });
  assert.equal(r.messages.length, 1);
  const c = r.messages[0].content;
  assert.deepEqual(c.map((b) => b.type), ["text", "document", "text", "image", "text", "text"]);
  assert.equal(c[0].text, "Document 1 : devis.pdf");
  assert.equal(c[1].source.media_type, "application/pdf");
  assert.equal(c[3].source.media_type, "image/jpeg");
  assert.deepEqual(c[3].cache_control, { type: "ephemeral" });
  assert.equal(c[1].cache_control, undefined);
  assert.ok(c[4].text.startsWith("Document 3 : notes.txt"));
  assert.equal(c[5].text, "Ce devis est-il conforme ?");
  assert.equal(r.system[0].text, SYSTEME);
  assert.deepEqual(r.system[0].cache_control, { type: "ephemeral" });
  assert.deepEqual(r.ignores, []);
});
test("requête : type inconnu ignoré et signalé", () => {
  const r = construireRequete({ fichiers: [{ nom: "x.heic", type: "image/heic", base64: "AA==" }], question: "?" });
  assert.deepEqual(r.ignores, ["x.heic"]);
  assert.deepEqual(r.messages[0].content.map((b) => b.type), ["text"]);
});
test("requête : sans fichier, le texte extrait précède la question", () => {
  const r = construireRequete({ fichiers: [], texteExtrait: "Devis n° 12", question: "Résume." });
  const c = r.messages[0].content;
  assert.equal(c.length, 2);
  assert.ok(c[0].text.includes("Devis n° 12"));
  assert.equal(c[1].text, "Résume.");
});
test("requête : historique limité aux 8 derniers échanges ok, alternance, cache sur la dernière réponse", () => {
  const questions = [];
  for (let i = 1; i <= 10; i++) questions.push({ question: "Q" + i, reponse: "R" + i, etat: "ok" });
  questions.push({ question: "Qerr", reponse: "", etat: "erreur" });
  const r = construireRequete({ fichiers: [pdf], questions, question: "Qnouvelle" });
  assert.equal(r.messages.length, 2 * HISTORIQUE_MAX + 1);
  assert.equal(r.messages[0].content.at(-1).text, "Q3");
  assert.equal(r.messages[1].role, "assistant");
  assert.equal(r.messages[1].content[0].text, "R3");
  assert.deepEqual(r.messages.at(-2).content[0].cache_control, { type: "ephemeral" });
  assert.equal(r.messages.at(-1).role, "user");
  assert.equal(r.messages.at(-1).content[0].text, "Qnouvelle");
  assert.ok(!JSON.stringify(r.messages).includes("Qerr"));
});
test("requête : fiche choisie → second bloc système avec le code et les conditions", () => {
  const texte = "1. Secteur\n2. Conditions pour la délivrance de certificats\nLa pompe...\n3. Durée de vie conventionnelle\n15 ans\n4. Montant de certificats en kWh cumac\nTableau\nAnnexe 1";
  const r = construireRequete({ fichiers: [], question: "?", fiche, texteOfficiel: texte, avis: { commentaire: "à surveiller" } });
  assert.equal(r.system.length, 2);
  assert.ok(r.system[1].text.includes("BAT-TH-163") && r.system[1].text.includes("La pompe...") && r.system[1].text.includes("Tableau") && r.system[1].text.includes("à surveiller"));
  assert.ok(!r.system[1].text.includes("15 ans"));
  assert.equal(contexteFiche(null), "");
});
test("taille : > 30 Mo de base64 ou > 20 images refusé", () => {
  assert.equal(verifierTaille([pdf, photo]), null);
  assert.equal(verifierTaille([{ nom: "gros.pdf", type: "application/pdf", base64: "x".repeat(31 * 1048576) }]), "trop_volumineux");
  assert.equal(verifierTaille(Array.from({ length: 21 }, () => photo)), "trop_images");
});
test("coût : tarif Opus 5, cache lu à 10 %", () => {
  const u = { entree: 1_000_000, cache_lu: 1_000_000, cache_ecrit: 0, sortie: 100_000 };
  assert.equal(estimerCout(u).toFixed(2), "8.00");
  assert.equal(formaterCout({ entree: 500, cache_lu: 11800, cache_ecrit: 0, sortie: 850 }), "12 300 jetons en entrée dont 11 800 lus en cache · 850 en sortie · ≈ 0,03 $");
});
test("nouvelle question, messages d'erreur, suggestions", () => {
  const q = nouvelleQuestion("  Bonjour ? ");
  assert.equal(q.question, "Bonjour ?"); assert.equal(q.etat, "en_cours"); assert.ok(q.id && q.le);
  assert.ok(messageErreur("cle").includes("Réglages"));
  assert.ok(messageErreur("requete", "prompt is too long").includes("prompt is too long"));
  assert.ok(messageErreur("inexistant").length > 0);
  assert.equal(SUGGESTIONS.length, 3);
  assert.ok(SUGGESTIONS[1].texte.includes("COFRAC"));
});
test("normaliser : une question restée en cours devient une erreur « interrompue »", () => {
  const [a, b] = normaliserQuestions([{ question: "Q", reponse: "partiel", etat: "en_cours" }, { question: "Q2", reponse: "R", etat: "ok" }]);
  assert.equal(a.etat, "erreur"); assert.equal(a.erreur, "interrompue"); assert.equal(a.reponse, "partiel"); assert.equal(b.etat, "ok");
});
```

Ajout à `tests/format.test.js` :

```js
import { mdBloc } from "../js/format.js";
test("mdBloc : paragraphes, titres, listes, gras, code", () => {
  const h = mdBloc("## Conformité\n\nLe devis est **conforme**.\nSuite.\n\n- point `un`\n- point deux\n\n1. premier\n2. second");
  assert.equal(h, "<h3>Conformité</h3><p>Le devis est <b>conforme</b>.<br>Suite.</p><ul><li>point <code>un</code></li><li>point deux</li></ul><ol><li>premier</li><li>second</li></ol>");
  assert.equal(mdBloc("<script>"), "<p>&lt;script&gt;</p>");
});
```

- [ ] **Step 2: Vérifier l'échec** — `python3 -m nodejs --test tests/questions.test.js tests/format.test.js` → Expected: FAIL (module `questions.js` absent, `mdBloc` non exporté).

- [ ] **Step 3: `sectionsTexte` dans `js/dossier.js`**

Remplacer les deux appels `section(...)` de `construireDossier` par :

```js
export function sectionsTexte(texteOfficiel) {
  return { conditions: section(texteOfficiel, /\d\.\s*Conditions pour la d[ée]livrance/i, [/\n\s*\d\.\s*Dur[ée]e de vie/i, /\n\s*\d\.\s*Montant de certificats/i]),
    bareme: section(texteOfficiel, /\d\.\s*Montant de certificats/i, [/Annexe 1/i], 4000) };
}
```
et dans `construireDossier` : `const { conditions: cond, bareme } = sectionsTexte(texteOfficiel);`.

- [ ] **Step 4: `mdBloc` dans `js/format.js`**

```js
function enLigne(s) { return md(s).replace(/`([^`]+)`/g, "<code>$1</code>"); }
export function mdBloc(t) {
  const out = []; let para = [], liste = null;
  const fin = () => { if (para.length) { out.push("<p>" + para.map(enLigne).join("<br>") + "</p>"); para = []; } if (liste) { out.push("</" + liste + ">"); liste = null; } };
  for (const l of String(t || "").replace(/\r/g, "").split("\n")) {
    if (!l.trim()) { fin(); continue; }
    const titre = l.match(/^(#{1,4})\s+(.*)/), item = l.match(/^\s*(?:[-*•]|(\d+)[.)])\s+(.*)/);
    if (titre) { fin(); const n = Math.min(4, titre[1].length + 2); out.push(`<h${n}>${enLigne(titre[2])}</h${n}>`); continue; }
    if (item) { const type = item[1] ? "ol" : "ul"; if (liste !== type) { fin(); out.push("<" + type + ">"); liste = type; } out.push("<li>" + enLigne(item[2]) + "</li>"); continue; }
    if (liste) fin();
    para.push(l);
  }
  fin(); return out.join("");
}
```

- [ ] **Step 5: `js/questions.js`**

```js
// js/questions.js — questions a Claude sur les documents d'un dossier (pur : requete, historique, couts, libelles)
import { dateFr, giga } from "./format.js";
import { sectionsTexte } from "./dossier.js";
export const MODELE = "claude-opus-5";
export const HISTORIQUE_MAX = 8;
export const TAILLE_MAX = 30 * 1048576;      // base64 cumule par requete (limite API : 32 Mo)
export const IMAGES_MAX = 20;               // au-dela, l'API impose une limite de dimensions plus stricte
export const MEDIAS_IMAGE = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const TARIF = { entree: 5, cache_lu: 0.5, cache_ecrit: 6.25, sortie: 25 };   // $ par million de jetons, claude-opus-5
export const SYSTEME = [
  "Tu es expert du dispositif des certificats d'économies d'énergie (CEE) en France, au service de Solhy Énergie (bureau d'études et mandataire CEE). Tu réponds en français, de façon structurée, chiffrée et prudente.",
  "Règles :",
  "- Appuie-toi d'abord sur les documents joints (devis, étude de dimensionnement, photos) : cite la page, le poste ou le montant concerné.",
  "- Signale explicitement chaque hypothèse, chaque information manquante et ce qu'il faudrait demander au client ou à l'installateur.",
  "- Pour une question de conformité, passe en revue chaque exigence une par une (fiche d'opération standardisée, arrêté, règles de l'art et normes citées, référentiel de contrôle CEE appliqué par les organismes d'inspection accrédités COFRAC) et conclus : conforme / non conforme / à vérifier, avec la correction à apporter.",
  "- Pour un devis : postes, cohérence des quantités et des prix avec le marché, points à négocier, pièces justificatives attendues pour le dossier CEE.",
  "- N'invente jamais un prix, une référence ou un texte : donne des ordres de grandeur en le disant. Calculs en kWh cumac montrés étape par étape quand la fiche est fournie.",
  "- Termine par une synthèse en 3 à 5 lignes et la liste des actions à mener.",
].join("\n");
export const SUGGESTIONS = [
  { titre: "Analyser ce devis", texte: "Analyse ce devis : postes et quantités, cohérence des prix avec le marché, points à négocier, conformité aux conditions de la fiche CEE, pièces manquantes pour le dossier." },
  { titre: "Contre-expertise de l'étude", texte: "Fais la contre-expertise de cette étude de dimensionnement : méthode et hypothèses, cohérence des résultats (déperditions, puissance, débits, températures), conformité aux exigences de la fiche CEE, aux normes citées et aux points vérifiés lors des contrôles par un organisme d'inspection accrédité COFRAC. Liste les non-conformités et ce qu'il faut corriger." },
  { titre: "Conformité à la fiche", texte: "Vérifie point par point la conformité de ce dossier aux conditions de délivrance de la fiche CEE choisie, puis calcule les kWh cumac et la prime attendue en montrant le calcul." },
];
export function contexteFiche(fiche, texteOfficiel = "", avis) {
  if (!fiche) return "";
  const c = fiche.carte || {}; const { conditions, bareme } = sectionsTexte(texteOfficiel);
  const L = [`Fiche CEE choisie par l'utilisateur : ${fiche.code} — ${fiche.titre}${fiche.nom ? " (" + fiche.nom + ")" : ""}.`,
    `Version ${fiche.version || "?"}${fiche.applicable_depuis ? ", applicable depuis le " + dateFr(fiche.applicable_depuis) : ""}. Coup de pouce : ${(fiche.cdp?.cp || 1) > 1 ? "×" + fiche.cdp.cp + " (" + (fiche.cdp.programmes || []).join(", ") + ")" : "aucun"}.`,
    fiche.fin_proche ? `Fin de la fiche : ${fiche.fin_proche.au_plus_tot ? "au plus tôt le " : ""}${dateFr(fiche.fin_proche.date)}.` : "",
    c.resume ? "Résumé : " + c.resume : "", c.gwh != null ? `Cas optimal de référence : ${(c.cas?.seg || []).join(" · ")} → ≈ ${giga(c.gwh)}.` : "",
    c.verifier?.length ? "À vérifier : " + c.verifier.join(" ; ") : "", c.leviers?.length ? "Leviers : " + c.leviers.join(" ; ") : "",
    c.cout?.postes?.length ? "Coûts habituels HT : " + c.cout.postes.map((p) => `${p[0]} ${p[1]}–${p[2]} €`).join(" ; ") : "",
    avis?.commentaire ? "Note de Solhy : " + avis.commentaire : "",
    conditions ? "\nExtrait du texte officiel — conditions :\n" + conditions : "", bareme ? "\nExtrait du texte officiel — montant :\n" + bareme : ""];
  return L.filter(Boolean).join("\n");
}
export function verifierTaille(fichiers) {
  let total = 0, images = 0;
  for (const f of fichiers) { total += (f.base64 || f.texte || "").length; if (MEDIAS_IMAGE.has(f.type)) images++; }
  if (total > TAILLE_MAX) return "trop_volumineux";
  if (images > IMAGES_MAX) return "trop_images";
  return null;
}
export function construireRequete({ fichiers = [], texteExtrait = "", questions = [], question, fiche = null, texteOfficiel = "", avis } = {}) {
  const system = [{ type: "text", text: SYSTEME, cache_control: { type: "ephemeral" } }];
  const ctx = contexteFiche(fiche, texteOfficiel, avis); if (ctx) system.push({ type: "text", text: ctx });
  const blocs = [], ignores = []; let dernier = -1, n = 0;
  for (const f of fichiers) {
    if (f.type === "application/pdf" && f.base64) { n++; blocs.push({ type: "text", text: `Document ${n} : ${f.nom}` }, { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.base64 } }); dernier = blocs.length - 1; }
    else if (MEDIAS_IMAGE.has(f.type) && f.base64) { n++; blocs.push({ type: "text", text: `Document ${n} : ${f.nom}` }, { type: "image", source: { type: "base64", media_type: f.type, data: f.base64 } }); dernier = blocs.length - 1; }
    else if (f.texte != null) { n++; blocs.push({ type: "text", text: `Document ${n} : ${f.nom}\n\n${f.texte}` }); }
    else ignores.push(f.nom);
  }
  if (dernier >= 0) blocs[dernier].cache_control = { type: "ephemeral" };
  if (!n && texteExtrait) blocs.push({ type: "text", text: "Texte extrait du document :\n\n" + texteExtrait });
  const hist = questions.filter((q) => q.etat === "ok" && q.reponse).slice(-HISTORIQUE_MAX);
  const messages = [];
  const premiere = hist.length ? hist[0].question : question;
  messages.push({ role: "user", content: [...blocs, { type: "text", text: premiere }] });
  hist.forEach((q, i) => {
    const rep = { type: "text", text: q.reponse }; if (i === hist.length - 1) rep.cache_control = { type: "ephemeral" };
    messages.push({ role: "assistant", content: [rep] });
    messages.push({ role: "user", content: [{ type: "text", text: i + 1 < hist.length ? hist[i + 1].question : question }] });
  });
  return { system, messages, ignores };
}
export function estimerCout(u) { return u ? ((u.entree || 0) * TARIF.entree + (u.cache_lu || 0) * TARIF.cache_lu + (u.cache_ecrit || 0) * TARIF.cache_ecrit + (u.sortie || 0) * TARIF.sortie) / 1e6 : 0; }
const nb = (x) => Math.round(x || 0).toLocaleString("fr-FR").replace(/[   ]/g, " ");   // separateur de milliers : espace insecable, quelle que soit la version d'ICU
export function formaterCout(u) {
  if (!u) return "";
  const entree = (u.entree || 0) + (u.cache_lu || 0) + (u.cache_ecrit || 0);
  return `${nb(entree)} jetons en entrée${u.cache_lu ? " dont " + nb(u.cache_lu) + " lus en cache" : ""} · ${nb(u.sortie)} en sortie · ≈ ${estimerCout(u).toFixed(2).replace(".", ",")} $`;
}
export function nouvelleQuestion(question) {
  return { id: "q" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), le: new Date().toISOString(), question: String(question || "").trim(), reponse: "", etat: "en_cours", erreur: "", modele: MODELE, usage: null };
}
const ERREURS = {
  sans_cle: "Aucune clé API : saisissez-la dans Réglages, ou partagez la question vers l'appli Claude.",
  cle: "Clé API refusée par Anthropic : vérifiez-la dans Réglages.",
  interdit: "Accès refusé par Anthropic (permissions ou crédit du compte).",
  limite: "Trop de requêtes pour le moment : réessayez dans une minute.",
  requete: "Requête refusée par l'API",
  surcharge: "Service Anthropic surchargé ou indisponible : réessayez un peu plus tard.",
  reseau: "Hors ligne ou réseau indisponible : la question sera à reposer.",
  arret: "Question arrêtée.",
  trop_volumineux: "Documents trop volumineux pour une requête (plus de 30 Mo) : retirez ou réduisez un fichier.",
  trop_images: "Plus de 20 images : retirez-en avant de poser la question.",
  refus: "Claude a refusé cette demande.",
  tronquee: "Réponse tronquée (limite de longueur atteinte) : posez une question plus ciblée.",
  interrompue: "Question interrompue (appli fermée pendant la réponse).",
  inconnue: "Erreur inattendue",
};
export function messageErreur(code, detail = "") { const m = ERREURS[code] || ERREURS.inconnue; return detail ? `${m} : ${detail}` : m; }
export function normaliserQuestions(questions = []) {
  return questions.map((q) => (q.etat === "en_cours" ? { ...q, etat: "erreur", erreur: "interrompue" } : q));
}
```

- [ ] **Step 6: Tests verts** — `python3 -m nodejs --test tests/` → Expected: tous PASS (dont les tests existants de `dossier.test.js`).
- [ ] **Step 7: Commit** — `git add js/questions.js js/dossier.js js/format.js tests/questions.test.js tests/format.test.js && git commit -m "Questions à Claude : construction de la requête, historique, coûts (module pur)"`.

---

### Task 3: `js/claude.js` (SDK, streaming, erreurs)

**Files:**
- Create: `js/claude.js`
- Test: `tests/claude.test.js` (ajouts)

**Interfaces:**
- Consumes: `MODELE` de `questions.js` ; `vendor/anthropic-sdk.min.mjs`.
- Produces: `MAX_TOKENS = 16000`, `BETAS`, `chargerSdk() → Anthropic`, `creerClaude(cle, options) → client`, `demander({ cle, requete, surTexte, signal, options }) → { texte, stop, usage: { entree, cache_lu, cache_ecrit, sortie }, modele }`, `classerErreur(e) → code`, `testerCle(cle, options) → { ok: true, modele } | { ok: false, code, detail }`.

- [ ] **Step 1: Tests qui échouent** (ajouter à `tests/claude.test.js`)

```js
import { demander, classerErreur, testerCle, chargerSdk } from "../js/claude.js";
const SSE = (textes, stop = "end_turn") => [
  'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","model":"claude-opus-5","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":120,"cache_read_input_tokens":1000,"cache_creation_input_tokens":0,"output_tokens":0}}}\n\n',
  'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
  ...textes.map((t) => `event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: t } })}\n\n`),
  'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
  `event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"${stop}","stop_sequence":null},"usage":{"output_tokens":7}}\n\n`,
  'event: message_stop\ndata: {"type":"message_stop"}\n\n'];
function fauxFetch(reponses, vu) {
  return async (url, init) => {
    vu.push({ url: String(url), headers: init.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : init.headers, corps: init.body ? JSON.parse(init.body) : null });
    const r = reponses.shift();
    if (r.sse) { let ctrl; const body = new ReadableStream({ start(c) { ctrl = c; for (const s of r.sse) c.enqueue(new TextEncoder().encode(s)); if (!r.ouvert) c.close(); } });
      init.signal?.addEventListener("abort", () => { try { ctrl.error(new DOMException("aborted", "AbortError")); } catch {} });
      return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } }); }
    return new Response(JSON.stringify(r.json), { status: r.status || 200, headers: { "content-type": "application/json" } });
  };
}
const requete = { system: [{ type: "text", text: "sys" }], messages: [{ role: "user", content: [{ type: "text", text: "Q" }] }] };
test("demander : flux texte, usage, en-têtes navigateur, beta fallbacks", async () => {
  const vu = []; const morceaux = [];
  const r = await demander({ cle: "sk-test", requete, surTexte: (t) => morceaux.push(t), options: { fetch: fauxFetch([{ sse: SSE(["Bon", "jour"]) }], vu), maxRetries: 0 } });
  assert.equal(r.texte, "Bonjour"); assert.deepEqual(morceaux, ["Bon", "jour"]); assert.equal(r.stop, "end_turn"); assert.equal(r.modele, "claude-opus-5");
  assert.deepEqual(r.usage, { entree: 120, cache_lu: 1000, cache_ecrit: 0, sortie: 7 });
  const { headers, corps, url } = vu[0];
  assert.ok(url.startsWith("https://api.anthropic.com/v1/messages"));
  assert.equal(headers["anthropic-dangerous-direct-browser-access"], "true"); assert.equal(headers["x-api-key"], "sk-test");
  assert.ok(headers["anthropic-beta"].includes("server-side-fallback-2026-07-01"));
  assert.equal(corps.model, "claude-opus-5"); assert.equal(corps.fallbacks, "default"); assert.deepEqual(corps.thinking, { type: "adaptive" }); assert.equal(corps.max_tokens, 16000); assert.equal(corps.stream, true);
  assert.deepEqual(corps.system, requete.system);
});
test("demander : arrêt par signal → code arret", async () => {
  const ac = new AbortController(); const vu = [];
  const p = demander({ cle: "sk-test", requete, signal: ac.signal, options: { fetch: fauxFetch([{ sse: SSE([]).slice(0, 1), ouvert: true }], vu), maxRetries: 0 } });
  setTimeout(() => ac.abort(), 30);
  await assert.rejects(p);
  try { await p; } catch (e) { assert.equal(classerErreur(e), "arret"); }
});
test("classerErreur : classes du SDK → codes", async () => {
  const A = await chargerSdk();
  const g = (s, type) => A.APIError.generate(s, { error: { type, message: "m" } }, undefined, new Headers());
  assert.equal(classerErreur(g(401, "authentication_error")), "cle");
  assert.equal(classerErreur(g(403, "permission_error")), "interdit");
  assert.equal(classerErreur(g(429, "rate_limit_error")), "limite");
  assert.equal(classerErreur(g(400, "invalid_request_error")), "requete");
  assert.equal(classerErreur(g(529, "overloaded_error")), "surcharge");
  assert.equal(classerErreur(A.APIError.generate(undefined, undefined, "conn", undefined)), "reseau");
  assert.equal(classerErreur(new Error("x")), "inconnue");
});
test("testerCle : GET /v1/models/claude-opus-5 ; 401 → cle", async () => {
  const vu = [];
  assert.deepEqual(await testerCle("sk-ok", { fetch: fauxFetch([{ json: { id: "claude-opus-5", type: "model", display_name: "Claude Opus 5", created_at: "2026-01-01T00:00:00Z" } }], vu), maxRetries: 0 }), { ok: true, modele: "Claude Opus 5" });
  assert.ok(vu[0].url.endsWith("/v1/models/claude-opus-5"));
  const r = await testerCle("sk-bad", { fetch: fauxFetch([{ status: 401, json: { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } } }], []), maxRetries: 0 });
  assert.equal(r.ok, false); assert.equal(r.code, "cle");
});
```

- [ ] **Step 2: Vérifier l'échec** — `python3 -m nodejs --test tests/claude.test.js` → Expected: FAIL (`js/claude.js` absent).

- [ ] **Step 3: `js/claude.js`**

```js
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
```

- [ ] **Step 4: Tests verts** — `python3 -m nodejs --test tests/claude.test.js` → Expected: PASS 5/5. (Si `APIUserAbortError` n'est pas levée par le faux fetch, corriger le faux fetch — `ctrl.error` doit être appelé à l'abort — pas le code.)
- [ ] **Step 5: Commit** — `git add js/claude.js tests/claude.test.js && git commit -m "Client Claude : streaming, erreurs typées, test de clé"`.

---

### Task 4: IndexedDB v2, `js/fichiers.js`, `js/images.js`

**Files:**
- Modify: `js/stockage.js`
- Create: `js/fichiers.js`, `js/images.js`
- Test: `tests/fichiers.test.js`, `tests/images.test.js`

**Interfaces:**
- `stockage.js` : `VERSION = 2`, `STORES` + `"fichiers"`, nouvel export `cles(store, prefixe) → Promise<string[]>` (`getAllKeys(IDBKeyRange.bound(prefixe, prefixe + "￿"))`).
- `fichiers.js` : `cleFichier(dossierId)`, `enregistrerFichiers(stockage, dossierId, files) → [{ nom, type, taille, cle }]`, `lireBlob(stockage, cle) → Blob | null`, `supprimerFichier(stockage, cle)`, `supprimerFichiersDossier(stockage, dossierId)`, `versBase64(blob) → string`, `chargerPourRequete(stockage, entrees) → { fichiers: [{ nom, type, base64 | texte }], manquants: [nom] }`.
- `images.js` : `COTE_MAX = 2000`, `dimensionsReduites(l, h, max) → { l, h, reduit }`, `reduireImage(file, max, qualite) → File` (navigateur ; rend l'original si non décodable).

- [ ] **Step 1: Tests qui échouent**

```js
// tests/fichiers.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { enregistrerFichiers, lireBlob, supprimerFichiersDossier, supprimerFichier, versBase64, chargerPourRequete, cleFichier } from "../js/fichiers.js";
function stockageSimule() {
  const m = new Map();
  return { m, lire: async (s, k) => m.get(s + ":" + k) ?? null, ecrire: async (s, k, v) => { m.set(s + ":" + k, v); }, supprimer: async (s, k) => { m.delete(s + ":" + k); },
    cles: async (s, p) => [...m.keys()].filter((k) => k.startsWith(s + ":" + p)).map((k) => k.slice(s.length + 1)) };
}
// Node 18 n'a pas File : un Blob nomme suffit (name, type, size comme un File)
const fichier = (contenu, name, type) => Object.assign(new Blob([contenu], { type }), { name });
test("enregistrer / lire / supprimer les fichiers d'un dossier", async () => {
  const st = stockageSimule();
  const f = fichier("%PDF-1.4", "devis.pdf", "application/pdf");
  const [e] = await enregistrerFichiers(st, "d1", [f]);
  assert.equal(e.nom, "devis.pdf"); assert.equal(e.type, "application/pdf"); assert.equal(e.taille, 8); assert.ok(e.cle.startsWith("d1/"));
  assert.equal(await (await lireBlob(st, e.cle)).text(), "%PDF-1.4");
  await enregistrerFichiers(st, "d2", [f]);
  await supprimerFichiersDossier(st, "d1");
  assert.equal(await lireBlob(st, e.cle), null);
  assert.equal((await st.cles("fichiers", "d2/")).length, 1);
  await supprimerFichier(st, (await st.cles("fichiers", "d2/"))[0]);
  assert.equal((await st.cles("fichiers", "")).length, 0);
  assert.notEqual(cleFichier("d"), cleFichier("d"));
});
test("versBase64 et chargement pour la requête (texte, pdf, manquant)", async () => {
  const st = stockageSimule();
  assert.equal(await versBase64(new Blob([Uint8Array.from([0x25, 0x50, 0x44, 0x46])])), "JVBERg==");
  const entrees = await enregistrerFichiers(st, "d1", [fichier("%PDF", "a.pdf", "application/pdf"), fichier("PAC 160 kW", "n.txt", "text/plain")]);
  const r = await chargerPourRequete(st, [...entrees, { nom: "ancien.pdf", type: "application/pdf", taille: 1 }]);
  assert.deepEqual(r.manquants, ["ancien.pdf"]);
  assert.equal(r.fichiers.length, 2); assert.equal(r.fichiers[0].base64, "JVBERg=="); assert.equal(r.fichiers[1].texte, "PAC 160 kW");
});
```

```js
// tests/images.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { dimensionsReduites, COTE_MAX } from "../js/images.js";
test("dimensions réduites : côté long à 2000, proportions gardées, petites images intactes", () => {
  assert.equal(COTE_MAX, 2000);
  assert.deepEqual(dimensionsReduites(4000, 3000), { l: 2000, h: 1500, reduit: true });
  assert.deepEqual(dimensionsReduites(1200, 1600), { l: 1200, h: 1600, reduit: false });
  assert.deepEqual(dimensionsReduites(3000, 4000, 1000), { l: 750, h: 1000, reduit: true });
});
```

- [ ] **Step 2: Vérifier l'échec** — `python3 -m nodejs --test tests/fichiers.test.js tests/images.test.js` → Expected: FAIL (modules absents).

- [ ] **Step 3: `js/stockage.js`** — `VERSION = 2`, `STORES = ["donnees", "dossiers", "file", "partages", "fichiers"]`, ajouter :

```js
export const cles = (store, prefixe) => requete(store, "readonly", (s) => s.getAllKeys(IDBKeyRange.bound(prefixe, prefixe + "￿"))).then((v) => v || []);
```

- [ ] **Step 4: `js/fichiers.js`**

```js
// js/fichiers.js — fichiers d'un dossier conserves dans IndexedDB (store "fichiers", cle "<dossier>/<id>")
import { MEDIAS_IMAGE } from "./questions.js";
export function cleFichier(dossierId) { return dossierId + "/" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
export async function enregistrerFichiers(stockage, dossierId, files) {
  const entrees = [];
  for (const f of files) {
    const cle = cleFichier(dossierId);
    await stockage.ecrire("fichiers", cle, { nom: f.name, type: f.type, taille: f.size, blob: f, ajoute_le: new Date().toISOString() });
    entrees.push({ nom: f.name, type: f.type, taille: f.size, cle });
  }
  return entrees;
}
export async function lireBlob(stockage, cle) { const v = cle ? await stockage.lire("fichiers", cle) : null; return v ? v.blob : null; }
export const supprimerFichier = (stockage, cle) => stockage.supprimer("fichiers", cle);
export async function supprimerFichiersDossier(stockage, dossierId) { for (const c of await stockage.cles("fichiers", dossierId + "/")) await stockage.supprimer("fichiers", c); }
export async function versBase64(blob) {
  const b = new Uint8Array(await blob.arrayBuffer()); let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
export async function chargerPourRequete(stockage, entrees) {
  const fichiers = [], manquants = [];
  for (const e of entrees) {
    const blob = await lireBlob(stockage, e.cle);
    if (!blob) { manquants.push(e.nom); continue; }
    if (e.type === "application/pdf" || MEDIAS_IMAGE.has(e.type)) fichiers.push({ nom: e.nom, type: e.type, base64: await versBase64(blob) });
    else if (e.type.startsWith("text/")) fichiers.push({ nom: e.nom, type: e.type, texte: await blob.text() });
    else fichiers.push({ nom: e.nom, type: e.type });
  }
  return { fichiers, manquants };
}
```

- [ ] **Step 5: `js/images.js`**

```js
// js/images.js — reduction des photos avant stockage et envoi (cote long <= 2000 px, JPEG)
export const COTE_MAX = 2000;
export function dimensionsReduites(l, h, max = COTE_MAX) {
  const k = Math.min(1, max / Math.max(l, h, 1));
  return { l: Math.max(1, Math.round(l * k)), h: Math.max(1, Math.round(h * k)), reduit: k < 1 };
}
export async function reduireImage(file, max = COTE_MAX, qualite = 0.85) {
  if (!file.type.startsWith("image/")) return file;
  let bitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { return file; }   // format non decodable : original conserve
  const { l, h, reduit } = dimensionsReduites(bitmap.width, bitmap.height, max);
  if (!reduit && file.type === "image/jpeg" && file.size <= 3 * 1048576) { bitmap.close(); return file; }
  const canvas = document.createElement("canvas"); canvas.width = l; canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, l, h); bitmap.close();
  const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", qualite));
  return blob ? new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
}
```

- [ ] **Step 6: Tests verts** — `python3 -m nodejs --test tests/` → Expected: tous PASS.
- [ ] **Step 7: Commit** — `git add js/stockage.js js/fichiers.js js/images.js tests/fichiers.test.js tests/images.test.js && git commit -m "Fichiers du dossier conservés dans IndexedDB (v2), réduction des photos"`.

---

### Task 5: Rendu de la section « Documents & questions » + CSS

**Files:**
- Create: `js/vues/dossier-questions.js`
- Modify: `css/app.css`
- Test: `tests/dossier-questions.test.js`

**Interfaces:**
- Produces: `rendreDocuments(d, ui) → html` (section `#docs-zone`), `rendreQuestions(etat, d) → html` (section `#q-zone` : saisie + réponse courante + historique), `libellePoser(etat) → "Poser la question" | "Partager la question vers Claude"`, `rendreHistorique(d) → html`.
- `ui` : `{ fichierVu: index, reponseCourante: { id, question, texte, etat, erreur, usage } | null, enCours: bool }`.
- Ids/attributs consommés par la tâche 6 : `#d-plus`, `[data-voir]`, `[data-retirer]`, `#v-zone`, `[data-sugg]`, `#q-texte`, `#q-poser`, `#q-arreter`, `#q-etat`, `#q-reponse`, `#q-historique`, `[data-supprimer-q]`, `[data-reprendre]`, `[data-coller]`.

- [ ] **Step 1: Tests qui échouent**

```js
// tests/dossier-questions.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { rendreDocuments, rendreQuestions, libellePoser, rendreHistorique } from "../js/vues/dossier-questions.js";
const etatCle = { reglages: { cle_api: "sk-x" }, ui: {} }, etatSans = { reglages: { cle_api: "" }, ui: {} };
const d = { id: "d1", fichiers: [{ nom: "devis.pdf", type: "application/pdf", taille: 2048, cle: "d1/a" }, { nom: "ancien.pdf", type: "application/pdf", taille: 10 }], questions: [] };
test("documents : liste, taille, non conservé, onglets et zone de visionneuse", () => {
  const h = rendreDocuments(d, { fichierVu: 0 });
  assert.ok(h.includes("devis.pdf") && h.includes("2 Ko") && h.includes("non conservé"));
  assert.ok(h.includes('data-voir="0"') && h.includes('aria-pressed="true"') && h.includes('id="v-zone"') && h.includes('data-retirer="1"') && h.includes('id="d-plus"'));
  assert.ok(rendreDocuments({ ...d, fichiers: [] }, {}).includes("Aucun document"));
});
test("questions : libellé selon la clé, suggestions, réponse courante en streaming", () => {
  assert.equal(libellePoser(etatCle), "Poser la question"); assert.equal(libellePoser(etatSans), "Partager la question vers Claude");
  const h = rendreQuestions({ ...etatCle, ui: { reponseCourante: { question: "Q ?", texte: "Le devis est **conforme**.", etat: "en_cours" }, enCours: true } }, d);
  assert.ok(h.includes('data-sugg="0"') && h.includes('id="q-texte"') && h.includes("Poser la question"));
  assert.ok(h.includes("<b>conforme</b>") && !h.includes('id="q-arreter" hidden'));
  const h2 = rendreQuestions({ ...etatSans, ui: {} }, d);
  assert.ok(h2.includes("Partager la question vers Claude") && h2.includes('id="q-arreter" hidden'));
});
test("historique : compte, ordre inverse, réponse dépliable, partage → zone à coller, erreur affichée", () => {
  const dd = { ...d, questions: [
    { id: "a", le: "2026-09-30T08:00:00.000Z", question: "Q1", reponse: "R1", etat: "ok", usage: { entree: 10, cache_lu: 0, cache_ecrit: 0, sortie: 5 } },
    { id: "b", le: "2026-09-30T09:00:00.000Z", question: "Q2", reponse: "", etat: "partage" },
    { id: "c", le: "2026-09-30T10:00:00.000Z", question: "Q3", reponse: "partiel", etat: "erreur", erreur: "interrompue" }] };
  const h = rendreHistorique(dd);
  assert.ok(h.includes("Historique — 3 questions"));
  assert.ok(h.indexOf("Q3") < h.indexOf("Q2") && h.indexOf("Q2") < h.indexOf("Q1"));
  assert.ok(h.includes('data-coller="b"') && h.includes('data-supprimer-q="a"') && h.includes('data-reprendre="a"'));
  assert.ok(h.includes("interrompue") && h.includes("R1") && h.includes("jetons"));
  assert.ok(rendreHistorique(d).includes("Historique — 0 question"));
});
```

- [ ] **Step 2: Vérifier l'échec** — `python3 -m nodejs --test tests/dossier-questions.test.js` → Expected: FAIL (module absent).

- [ ] **Step 3: `js/vues/dossier-questions.js`**

```js
// js/vues/dossier-questions.js — section « Documents & questions » d'un dossier (rendu pur ; interactions dans monterQuestions)
import { ech, ico, mdBloc } from "../format.js";
import { SUGGESTIONS, formaterCout, messageErreur } from "../questions.js";
const ko = (o) => Math.max(1, Math.round((o || 0) / 1024)) + " Ko";
const heure = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); };
export function libellePoser(etat) { return etat.reglages.cle_api ? "Poser la question" : "Partager la question vers Claude"; }
export function rendreDocuments(d, ui = {}) {
  const vu = ui.fichierVu ?? 0;
  const liste = d.fichiers.length ? `<ul class="docs">${d.fichiers.map((f, i) => `<li><button type="button" class="doc" data-voir="${i}" aria-pressed="${i === vu}">${ico("fichier")} <span>${ech(f.nom)}</span> <small>${ko(f.taille)}${f.cle ? "" : " · non conservé : réimporter"}</small></button><button type="button" class="x" data-retirer="${i}" aria-label="Retirer ${ech(f.nom)}">${ico("x")}</button></li>`).join("")}</ul>` : `<p class="vide">Aucun document. Ajoutez un devis, une étude ou une photo, ou partagez-les depuis une autre appli.</p>`;
  return `<section id="docs-zone"><h2>Documents</h2>${liste}
<div class="actions"><label class="btn sec" for="d-plus">${ico("plus")} Ajouter (PDF, photo, texte)</label><input id="d-plus" type="file" accept="application/pdf,image/*,text/plain" multiple class="sr"></div>
<div id="v-zone" class="visionneuse" ${d.fichiers.length ? "" : "hidden"}></div></section>`;
}
function rendreReponse(ui) {
  const r = ui.reponseCourante; if (!r) return "";
  const corps = r.texte ? mdBloc(r.texte) : (r.etat === "en_cours" ? "<p class='resume'>Claude lit les documents…</p>" : "");
  const pied = r.etat === "erreur" ? `<p class="bandeau bad">${ech(messageErreur(r.erreur, r.detail))}</p>` : r.etat === "partage" ? `<p class="resume">Question partagée vers Claude : collez la réponse dans l'historique ci-dessous.</p>` : r.usage ? `<p class="resume">${ech(formaterCout(r.usage))}${r.stop === "max_tokens" ? " · " + ech(messageErreur("tronquee")) : ""}</p>` : "";
  return `<div class="q-courante"><p class="q-question">${ech(r.question)}</p><div class="q-reponse">${corps}</div>${pied}</div>`;
}
export function rendreHistorique(d) {
  const qs = [...(d.questions || [])].reverse();
  const n = qs.length;
  return `<details id="q-historique"><summary>Historique — ${n} question${n > 1 ? "s" : ""}</summary>${n ? `<ul class="historique">${qs.map((q) => `<li class="hist ${ech(q.etat)}"><div class="hist-tete"><span class="resume">${heure(q.le)}</span><span class="actions-mini"><button type="button" class="lien" data-reprendre="${ech(q.id)}">Reprendre</button><button type="button" class="lien" data-supprimer-q="${ech(q.id)}">Supprimer</button></span></div><p class="q-question">${ech(q.question)}</p>
${q.etat === "partage" ? `<textarea data-coller="${ech(q.id)}" rows="4" placeholder="Collez ici la réponse de Claude">${ech(q.reponse || "")}</textarea>` : `<details><summary>${q.etat === "erreur" ? "Erreur : " + ech(messageErreur(q.erreur, q.detail)) : "Réponse"}</summary><div class="q-reponse">${mdBloc(q.reponse || "")}</div>${q.usage ? `<p class="resume">${ech(formaterCout(q.usage))}</p>` : ""}</details>`}</li>`).join("")}</ul>` : "<p class='vide'>Aucune question pour l'instant.</p>"}</details>`;
}
export function rendreQuestions(etat, d) {
  const ui = etat.ui || {};
  return `<section id="q-zone"><h2>Question à Claude</h2>
<div class="filtres">${SUGGESTIONS.map((s, i) => `<button type="button" data-sugg="${i}">${ech(s.titre)}</button>`).join("")}</div>
<textarea id="q-texte" rows="3" placeholder="Votre question sur ces documents…">${ech(ui.brouillonQuestion || "")}</textarea>
<div class="actions"><button type="button" class="btn" id="q-poser" ${ui.enCours ? "disabled" : ""}>${ico(etat.reglages.cle_api ? "com" : "partage")} ${libellePoser(etat)}</button><button type="button" class="btn sec" id="q-arreter" ${ui.enCours ? "" : "hidden"}>Arrêter</button></div>
<p id="q-etat" class="resume" aria-live="polite">${etat.reglages.cle_api ? "" : "Sans clé API (Réglages), la question et les documents sont partagés vers l'appli Claude."}</p>
${rendreReponse(ui)}
${rendreHistorique(d)}</section>`;
}
```

- [ ] **Step 4: CSS** (ajouter à `css/app.css`)

```css
.docs{list-style:none;margin:var(--sm) 0;padding:0}.docs li{display:flex;align-items:center;gap:var(--xs)}
.doc{flex:1;display:flex;align-items:center;gap:var(--sm);min-height:44px;padding:var(--xs) var(--sm);border:1px solid var(--bord);border-radius:var(--r-sm);background:var(--fond-2);color:var(--texte);text-align:left}
.doc[aria-pressed=true]{border-color:var(--action-clair);background:var(--fond-3)}.doc span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.doc small{color:var(--texte-2)}
.docs .x{width:44px;height:44px;border:0;background:transparent;color:var(--texte-2)}
.visionneuse{margin:var(--sm) 0;border:1px solid var(--bord);border-radius:var(--r-sm);background:var(--fond-2);overflow:hidden}
.visionneuse canvas,.visionneuse img{display:block;width:100%;height:auto;background:#fff}
.visionneuse .barre{display:flex;align-items:center;justify-content:space-between;gap:var(--sm);padding:var(--xs) var(--sm);font-size:14px}
.visionneuse .barre button{min-width:44px;min-height:40px;border:1px solid var(--bord);border-radius:var(--r-sm);background:var(--fond-3);color:var(--texte)}
.q-courante{margin:var(--md) 0}.q-question{font-weight:600;margin:var(--sm) 0}.q-reponse{overflow-wrap:anywhere}.q-reponse p{margin:var(--sm) 0}.q-reponse h3,.q-reponse h4{margin:var(--md) 0 var(--xs)}.q-reponse code{background:var(--fond-3);padding:0 4px;border-radius:4px}
.historique{list-style:none;margin:0;padding:0}.hist{border-top:1px solid var(--bord);padding:var(--sm) 0}.hist-tete{display:flex;justify-content:space-between;gap:var(--sm)}.hist.erreur .q-question{color:var(--texte-2)}
.actions-mini{display:flex;gap:var(--md)}.lien{border:0;background:none;color:var(--action-clair);padding:0;min-height:28px}
```

- [ ] **Step 5: Tests verts** — `python3 -m nodejs --test tests/` → Expected: tous PASS.
- [ ] **Step 6: Commit** — `git add js/vues/dossier-questions.js css/app.css tests/dossier-questions.test.js && git commit -m "Rendu de la section Documents & questions (liste, saisie, réponse, historique dépliable)"`.

---

### Task 6: Intégration navigateur (dossiers, visionneuse, réglages, app, sw)

**Files:**
- Create: `js/visionneuse.js`
- Modify: `js/vues/dossiers.js`, `js/vues/dossier-questions.js` (ajout `monterQuestions`, `monterDocuments`), `js/vues/reglages.js`, `js/donnees.js`, `js/app.js`, `sw.js`

**Interfaces:**
- `visionneuse.js` : `monterVisionneuse(el, { blob, type, nom }) → Promise<() => void>` (fonction de démontage : révoque l'URL).
- `donnees.js` : `lireReglages()` renvoie aussi `cle_api` ; `ecrireReglages` l'écrit.
- `app.js` : `actions.enregistrerCle(cle)`, `actions.supprimerDossier(id)` supprime aussi les fichiers, `actions.stockage` exposé (module), `etat.ui.dossier` normalisé (`normaliserQuestions`) à l'ouverture.
- `dossier-questions.js` : `monterDocuments(root, etat, actions, d)` et `monterQuestions(root, etat, actions, d)`.

- [ ] **Step 1: `js/visionneuse.js`**

```js
// js/visionneuse.js — affichage d'un document conserve (PDF page par page via pdf.js, image, texte)
import { ech } from "./format.js";
let lib;
async function pdfjs() { if (!lib) { lib = await import("../vendor/pdf.min.mjs"); lib.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdf.worker.min.mjs", import.meta.url).href; } return lib; }
export async function monterVisionneuse(el, { blob, type, nom }) {
  const url = URL.createObjectURL(blob);
  const ouvrir = `<a class="btn sec" href="${url}" target="_blank" rel="noopener">Ouvrir</a>`;
  el.hidden = false;
  if (type.startsWith("image/")) { el.innerHTML = `<img src="${url}" alt="${ech(nom)}"><div class="barre"><span>${ech(nom)}</span>${ouvrir}</div>`; return () => URL.revokeObjectURL(url); }
  if (type.startsWith("text/")) { el.innerHTML = `<div class="texte-officiel" style="padding:8px">${ech(await blob.text())}</div><div class="barre"><span>${ech(nom)}</span>${ouvrir}</div>`; return () => URL.revokeObjectURL(url); }
  if (type !== "application/pdf") { el.innerHTML = `<div class="barre"><span>${ech(nom)} : aperçu indisponible</span>${ouvrir}</div>`; return () => URL.revokeObjectURL(url); }
  el.innerHTML = `<canvas></canvas><div class="barre"><button type="button" data-page="-1" aria-label="Page précédente">‹</button><span class="num">…</span><button type="button" data-page="1" aria-label="Page suivante">›</button>${ouvrir}</div>`;
  let doc, page = 1, vivant = true;
  try { doc = await (await pdfjs()).getDocument({ data: await blob.arrayBuffer() }).promise; } catch { el.querySelector(".num").textContent = "PDF illisible"; return () => URL.revokeObjectURL(url); }
  const canvas = el.querySelector("canvas"), num = el.querySelector(".num");
  async function afficher() {
    const p = await doc.getPage(page); const base = p.getViewport({ scale: 1 });
    const largeur = Math.max(200, el.clientWidth || 360); const echelle = largeur / base.width; const vp = p.getViewport({ scale: echelle * (window.devicePixelRatio || 1) });
    canvas.width = vp.width; canvas.height = vp.height; canvas.style.width = "100%";
    await p.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
    if (vivant) num.textContent = `${ech(nom)} — page ${page} / ${doc.numPages}`;
  }
  for (const b of el.querySelectorAll("[data-page]")) b.addEventListener("click", () => { const n = page + Number(b.dataset.page); if (n >= 1 && n <= doc.numPages) { page = n; afficher(); } });
  await afficher();
  return () => { vivant = false; URL.revokeObjectURL(url); doc.destroy?.(); };
}
```

- [ ] **Step 2: `monterDocuments` et `monterQuestions`** (ajouter à `js/vues/dossier-questions.js`)

```js
import { construireRequete, verifierTaille, nouvelleQuestion } from "../questions.js";
import { chargerPourRequete, lireBlob, supprimerFichier } from "../fichiers.js";
export async function monterDocuments(root, etat, actions, d, { surAjout, surRetrait }) {
  const zone = root.querySelector("#v-zone"); const ui = etat.ui;
  if (ui.demonterVue) { ui.demonterVue(); ui.demonterVue = null; }
  const voir = async (i) => { ui.fichierVu = i; for (const b of root.querySelectorAll("[data-voir]")) b.setAttribute("aria-pressed", String(Number(b.dataset.voir) === i));
    if (ui.demonterVue) { ui.demonterVue(); ui.demonterVue = null; }
    const f = d.fichiers[i]; const blob = f && await lireBlob(actions.stockage, f.cle);
    if (!blob) { zone.hidden = !f; zone.innerHTML = f ? "<div class='barre'><span>Fichier non conservé : réimportez-le.</span></div>" : ""; return; }
    const { monterVisionneuse } = await import("../visionneuse.js"); ui.demonterVue = await monterVisionneuse(zone, { blob, type: f.type, nom: f.nom }); };
  for (const b of root.querySelectorAll("[data-voir]")) b.addEventListener("click", () => voir(Number(b.dataset.voir)));
  for (const b of root.querySelectorAll("[data-retirer]")) b.addEventListener("click", async () => { const i = Number(b.dataset.retirer); const f = d.fichiers[i]; if (!confirm("Retirer " + f.nom + " du dossier ?")) return; if (f.cle) await supprimerFichier(actions.stockage, f.cle); d.fichiers.splice(i, 1); await surRetrait(); });
  root.querySelector("#d-plus").addEventListener("change", (e) => surAjout([...e.target.files]));
  if (d.fichiers.length) voir(Math.min(ui.fichierVu ?? 0, d.fichiers.length - 1));
}
export function monterQuestions(root, etat, actions, d, { rafraichir }) {
  const ui = etat.ui;
  const zone = () => root.querySelector("#q-texte");
  for (const b of root.querySelectorAll("[data-sugg]")) b.addEventListener("click", () => { zone().value = SUGGESTIONS[Number(b.dataset.sugg)].texte; zone().focus(); });
  root.querySelector("#q-arreter").addEventListener("click", () => ui.controleur?.abort());
  for (const b of root.querySelectorAll("[data-supprimer-q]")) b.addEventListener("click", async () => { d.questions = d.questions.filter((q) => q.id !== b.dataset.supprimerQ); if (ui.reponseCourante?.id === b.dataset.supprimerQ) ui.reponseCourante = null; await actions.enregistrerDossier(d); rafraichir(); });
  for (const b of root.querySelectorAll("[data-reprendre]")) b.addEventListener("click", () => { const q = d.questions.find((x) => x.id === b.dataset.reprendre); if (q) { zone().value = q.question; zone().scrollIntoView({ block: "center" }); zone().focus(); } });
  for (const t of root.querySelectorAll("[data-coller]")) t.addEventListener("change", async () => { const q = d.questions.find((x) => x.id === t.dataset.coller); if (!q) return; q.reponse = t.value.trim(); if (q.reponse) q.etat = "ok"; await actions.enregistrerDossier(d); });
  root.querySelector("#q-poser").addEventListener("click", () => poser(root, etat, actions, d, rafraichir));
}
async function poser(root, etat, actions, d, rafraichir) {
  const ui = etat.ui; const texte = root.querySelector("#q-texte").value.trim(); if (!texte || ui.enCours) return;
  const q = nouvelleQuestion(texte); d.questions = d.questions || []; d.questions.push(q); ui.brouillonQuestion = "";
  const f = etat.index[d.fiche];
  if (!etat.reglages.cle_api) {   // sans cle : partage vers l'appli Claude, reponse a coller
    const { partager } = await import("../partage.js");
    const objets = []; for (const e of d.fichiers) { const b = await lireBlob(actions.stockage, e.cle); if (b) objets.push(new File([b], e.nom, { type: e.type })); }
    const r = await partager({ titre: d.titre || "Question CEE", texte: (f ? `Fiche CEE ${f.code} — ${f.titre}\n\n` : "") + texte + (d.devis_texte && !objets.length ? "\n\nTexte du document :\n" + d.devis_texte.slice(0, 12000) : ""), fichiers: objets });
    if (r === "annule" || r === "echec") { d.questions.pop(); ui.reponseCourante = { ...q, etat: "erreur", erreur: r === "annule" ? "arret" : "reseau" }; rafraichir(); return; }
    q.etat = "partage"; ui.reponseCourante = { ...q }; await actions.enregistrerDossier(d); rafraichir(); return;
  }
  ui.enCours = true; ui.reponseCourante = { ...q, texte: "" }; rafraichir();
  const zoneRep = () => root.querySelector(".q-courante .q-reponse");
  try {
    const { fichiers, manquants } = await chargerPourRequete(actions.stockage, d.fichiers || []);
    const refus = verifierTaille(fichiers); if (refus) throw Object.assign(new Error(refus), { code: refus });
    let texteOfficiel = ""; if (f) { try { texteOfficiel = (await actions.chargerTexte(f.secteur))[f.code] || ""; } catch { /* hors ligne : sans extraits */ } }
    const requete = construireRequete({ fichiers, texteExtrait: d.devis_texte || "", questions: d.questions.filter((x) => x.id !== q.id), question: texte, fiche: f, texteOfficiel, avis: etat.donnees?.avis?.fiches?.[f?.code] });
    if (manquants.length || requete.ignores.length) root.querySelector("#q-etat").textContent = "Non envoyés : " + [...manquants, ...requete.ignores].join(", ");
    const { demander } = await import("../claude.js");
    ui.controleur = new AbortController();
    let tampon = "", minuterie = null;
    const r = await demander({ cle: etat.reglages.cle_api, requete, signal: ui.controleur.signal, surTexte: (t) => { q.reponse += t; tampon += t; if (!minuterie) minuterie = setTimeout(() => { minuterie = null; const z = zoneRep(); if (z) z.innerHTML = mdBloc(q.reponse); }, 150); } });
    q.reponse = r.texte || q.reponse; q.usage = r.usage; q.modele = r.modele; q.stop = r.stop;
    q.etat = r.stop === "refusal" ? "erreur" : "ok"; if (r.stop === "refusal") q.erreur = "refus";
  } catch (e) {
    const { classerErreur, detailErreur } = await import("../claude.js");
    q.etat = "erreur"; q.erreur = e.code || classerErreur(e); q.detail = q.erreur === "requete" || q.erreur === "inconnue" ? detailErreur(e) : "";
  }
  ui.enCours = false; ui.controleur = null; ui.reponseCourante = { ...q, texte: q.reponse };
  await actions.enregistrerDossier(d); rafraichir();
}
```

- [ ] **Step 3: `js/vues/dossiers.js`** — remplacer `lireFichiers` par `importerFichiers(files, d, etat, actions)` (réduction des images, stockage des blobs, extraction du texte PDF/texte, mise à jour de `d.fichiers`, `d.devis_texte`, paramètres, suggestions, enregistrement du dossier) :

```js
async function importerFichiers(files, d, etat, actions) {
  const { texteDuPdf } = await import("../pdf.js"); const { reduireImage } = await import("../images.js"); const { enregistrerFichiers } = await import("../fichiers.js");
  const prets = []; let texte = "";
  for (let f of files) {
    if (f.size > 25 * 1048576) { alert(f.name + " dépasse 25 Mo : ignoré."); continue; }
    if (f.type.startsWith("image/")) f = await reduireImage(f);
    try { if (f.type === "application/pdf") texte += (await texteDuPdf(f)) + "\n"; else if (f.type.startsWith("text/")) texte += (await f.text()) + "\n"; } catch (e) { console.warn(e); }
    prets.push(f);
  }
  d.fichiers.push(...await enregistrerFichiers(actions.stockage, d.id, prets));
  d.devis_texte = [d.devis_texte, texte.trim()].filter(Boolean).join("\n");
  const fiches = etat.donnees?.fiches?.fiches || [];
  if (d.devis_texte) { d.parametres = { ...extraireParametres(d.devis_texte), ...Object.fromEntries(Object.entries(d.parametres || {}).filter(([, v]) => v != null)) }; d.suggestions = suggererFiches(d.devis_texte, fiches); if (!d.fiche && d.suggestions[0] && d.suggestions[0].score >= 60) d.fiche = d.suggestions[0].code; }
  etat.ui.fichierVu = d.fichiers.length - prets.length;
  await actions.enregistrerDossier(d);
}
```

Dans `rendre` (vue `dossier`) : après le champ Titre, insérer `rendreDocuments(d, etat.ui)` puis `rendreQuestions(etat, d)` ; retirer le `<p class="resume">` des fichiers et le bloc « Texte extrait » ; garder le reste. Dans `monter` : à la création (`nouveau`) appeler `importerFichiers(files, d, etat, actions)` au lieu de `lireFichiers` (le dossier est donc enregistré dès l'import) ; à l'ouverture d'un dossier existant : `d.questions = normaliserQuestions(d.questions || [])`, `d.fichiers = d.fichiers || []` ; après le rendu : `monterDocuments(root, etat, actions, d, { surAjout: async (files) => { lireForm(); await importerFichiers(files, d, etat, actions); actions.rendre(); }, surRetrait: async () => { await actions.enregistrerDossier(d); actions.rendre(); } })` et `monterQuestions(root, etat, actions, d, { rafraichir })` où `rafraichir` remplace le contenu de `#q-zone` par `rendreQuestions(etat, d)` (via un élément temporaire) puis rappelle `monterQuestions`. Le partage du dossier d'expertise (`#d-partager`) prend désormais ses fichiers dans le store (`lireBlob` pour chaque `d.fichiers[i].cle`) au lieu de `etat.ui.objets`.

- [ ] **Step 4: `js/donnees.js`** — `lireReglages` : `cle_api: localStorage.getItem("cle_api") || ""` ; `ecrireReglages` : `localStorage.setItem("cle_api", r.cle_api || "")`.

- [ ] **Step 5: `js/app.js`** — importer `normaliserQuestions` (questions.js) et `supprimerFichiersDossier` (fichiers.js) ; `actions.stockage = stockage` ; `enregistrerCle(cle) { etat.reglages.cle_api = (cle || "").trim(); ecrireReglages(etat.reglages); }` ; `supprimerDossier(id)` appelle d'abord `supprimerFichiersDossier(stockage, id)` ; `VERSION_APPLI = "1.1.0"`.

- [ ] **Step 6: `js/vues/reglages.js`** — carte « Clé API Anthropic » après la carte Jeton :

```html
<section class="carte"><h2 style="margin-top:0">Clé API Anthropic</h2>
<p class="resume">Pour poser des questions à Claude sur les documents d'un dossier (facturée à l'usage sur votre compte Anthropic, voir INSTALLATION.md). Elle reste sur ce téléphone.</p>
<label class="champ"><span>Clé</span><input id="r-cle" type="password" autocomplete="off" value="${ech(etat.reglages.cle_api)}" placeholder="sk-ant-…"></label>
<div class="actions"><button type="button" class="btn" id="r-cle-enregistrer">${ico("ok")} Enregistrer</button><button type="button" class="btn sec" id="r-cle-tester">Tester la clé</button></div>
<p id="r-cle-resultat" class="resume" aria-live="polite"></p></section>
```
et dans `monter` : `#r-cle-enregistrer` → `actions.enregistrerCle(valeur)` + « Clé enregistrée. » (ou « Clé effacée. ») ; `#r-cle-tester` → `const { testerCle } = await import("../claude.js"); const r = await testerCle(valeur)` → « Clé valide (Claude Opus 5). » ou `messageErreur(r.code, r.detail)`.

- [ ] **Step 7: `sw.js`** — ajouter à `COQUILLE` : `"./js/questions.js", "./js/claude.js", "./js/images.js", "./js/fichiers.js", "./js/visionneuse.js", "./js/vues/dossier-questions.js"`.

- [ ] **Step 8: Vérification** — `python3 -m nodejs --test tests/` → Expected: tous PASS (les modules navigateur ne sont pas importés par les tests). Puis `python3 tests/rendu/test_rendu.py` (harnais actuel) → Expected: `RENDU OK` (le flux dossier existant continue de fonctionner : suggestion BAT-TH-163, génération du dossier).
- [ ] **Step 9: Commit** — `git add -A js sw.js && git commit -m "Onglet Dossier : documents conservés, visionneuse, questions à Claude, clé API dans Réglages"`.

---

### Task 7: Test de rendu Playwright (API simulée)

**Files:**
- Modify: `tests/rendu/test_rendu.py`, `tests/rendu/README.md`

- [ ] **Step 1: Ajouter l'interception d'`api.anthropic.com`**

```python
def sse_simule(texte):
    ev = ['event: message_start\ndata: {"type":"message_start","message":{"id":"msg_t","type":"message","role":"assistant","model":"claude-opus-5","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":3000,"cache_read_input_tokens":0,"cache_creation_input_tokens":2500,"output_tokens":0}}}\n\n',
          'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n']
    for mot in texte.split(" "):
        ev.append('event: content_block_delta\ndata: ' + json.dumps({"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": mot + " "}}) + '\n\n')
    ev += ['event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
           'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":42}}\n\n',
           'event: message_stop\ndata: {"type":"message_stop"}\n\n']
    return "".join(ev)


def route_claude(route):
    u = urllib.parse.urlparse(route.request.url)
    if u.path.startswith("/v1/models/"):
        return route.fulfill(status=200, body=json.dumps({"id": "claude-opus-5", "type": "model", "display_name": "Claude Opus 5", "created_at": "2026-01-01T00:00:00Z"}), content_type="application/json")
    if u.path.endswith("/v1/messages"):
        route_claude.corps.append(json.loads(route.request.post_data))
        return route.fulfill(status=200, body=sse_simule("Réponse **simulée** : le devis est conforme à la fiche."), content_type="text/event-stream")
    route.fulfill(status=404, body="{}", content_type="application/json")


route_claude.corps = []
```
(`import json` en tête ; `ctx.route("https://api.anthropic.com/**", route_claude)` à côté de la route GitHub.)

- [ ] **Step 2: Scénario (thème sombre, après la génération du dossier existante)**

```python
                # sans cle : libelle de partage ; puis cle enregistree et testee
                verifier("Partager la question vers Claude" in pg.inner_text("#q-poser"), "libellé sans clé")
                url_dossier = pg.url
                pg.goto(base + "#/reglages"); pg.fill("#r-cle", "sk-ant-test"); pg.click("#r-cle-enregistrer")
                pg.click("#r-cle-tester"); pg.wait_for_function("document.querySelector('#r-cle-resultat').textContent.includes('valide')", timeout=10000)
                pg.goto(url_dossier); pg.wait_for_selector("#q-poser", timeout=10000)
                # photo ajoutee (PNG genere), visionneuse PDF rendue
                photo = os.path.join(CAPTURES, "..", "photo_test.png"); Image.new("RGB", (1200, 1600), "white").save(photo)
                pg.set_input_files("#d-plus", photo); pg.wait_for_function("document.querySelectorAll('[data-voir]').length === 2", timeout=10000)
                pg.click("[data-voir='0']"); pg.wait_for_selector("#v-zone canvas", timeout=15000)
                verifier("page 1 / 1" in pg.inner_text("#v-zone"), "visionneuse PDF")
                # question -> reponse streamee, cout, historique
                pg.click("[data-sugg='0']"); pg.click("#q-poser")
                pg.wait_for_function("document.querySelector('.q-courante .q-reponse')?.textContent.includes('conforme')", timeout=15000)
                pg.wait_for_function("document.querySelector('#q-historique summary').textContent.includes('1 question')", timeout=10000)
                verifier("simulée" in pg.inner_text(".q-courante") and "jetons" in pg.inner_text(".q-courante"), "réponse et coût")
                corps = route_claude.corps[-1]; contenu = corps["messages"][0]["content"]
                verifier(corps["model"] == "claude-opus-5" and corps["fallbacks"] == "default" and corps["stream"] is True, "requête : modèle/fallbacks/stream")
                verifier([b["type"] for b in contenu] == ["text", "document", "text", "image", "text"], "requête : blocs " + str([b["type"] for b in contenu]))
                verifier(contenu[3].get("cache_control") == {"type": "ephemeral"} and contenu[1]["source"]["media_type"] == "application/pdf", "requête : cache et PDF")
                verifier(corps["system"][0].get("cache_control") == {"type": "ephemeral"} and "BAT-TH-163" in corps["system"][1]["text"], "requête : système + fiche")
                pg.screenshot(path=os.path.join(CAPTURES, "questions-dark.png"))
                # persistance : rechargement -> historique, documents et visionneuse toujours la
                pg.reload(); pg.wait_for_selector("#q-historique", timeout=10000)
                verifier("1 question" in pg.inner_text("#q-historique summary"), "historique après rechargement")
                pg.wait_for_selector("#v-zone canvas", timeout=15000)
                pg.click("#q-historique summary"); pg.click("#q-historique details summary")
                verifier("simulée" in pg.inner_text("#q-historique"), "réponse conservée")
                pg.screenshot(path=os.path.join(CAPTURES, "historique-dark.png"))
                # suppression du dossier -> store fichiers vide
                pg.once("dialog", lambda dlg: dlg.accept()); pg.click("#d-supprimer"); pg.wait_for_url("**#/dossiers", timeout=10000)
                n = pg.evaluate("() => new Promise((ok) => { const r = indexedDB.open('appli-cee'); r.onsuccess = () => { const c = r.result.transaction('fichiers').objectStore('fichiers').count(); c.onsuccess = () => ok(c.result); }; })")
                verifier(n == 0, "fichiers supprimés avec le dossier (%s restant)" % n)
```
(`from PIL import Image` en tête ; `photo_test.png` ajouté à `.gitignore` ; à la fin : `verifier(len(route_claude.corps) == 1, "un seul appel à l'API")`.)

- [ ] **Step 3: Exécuter** — `python3 tests/rendu/test_rendu.py` → Expected: `RENDU OK : 16 captures, PUT ['avis/BAT-TH-163.json']`, aucune erreur de page. Corriger le code (pas le test) si un point échoue, avec systematic-debugging.
- [ ] **Step 4: README du harnais** — décrire l'interception Anthropic et le fichier `photo_test.png` généré.
- [ ] **Step 5: Commit** — `git add tests/rendu/test_rendu.py tests/rendu/README.md tests/rendu/captures .gitignore && git commit -m "Rendu Playwright : documents, question à Claude (API simulée), historique, suppression en cascade"`.

---

### Task 8: Documentation, version, publication

**Files:**
- Modify: `INSTALLATION.md`, `README.md`, `docs/superpowers/specs/2026-09-29-appli-cee-design.md` (renvoi vers la spec du 30/09)

- [ ] **Step 1: INSTALLATION.md** — section « Clé API Anthropic (questions à Claude) » : créer la clé sur https://platform.claude.com (Console → API keys), la coller dans Réglages → « Tester la clé », coût indicatif (Opus 5 : 5 $/M jetons en entrée, 25 $/M en sortie, cache lu à 0,5 $/M ; un devis PDF de 3 pages ≈ 8 000 jetons → ≈ 0,05 $ la première question, moins ensuite grâce au cache ; une réponse longue ≈ 0,05 $), sécurité (clé locale, révocable depuis la Console, ne jamais la partager), limites (30 Mo par question, 20 images, photos réduites à 2000 px, fichiers non exportés dans l'export JSON), sans clé (partage vers l'appli Claude).
- [ ] **Step 2: README.md** — ligne dans la description des onglets + modules ajoutés + `tools/bundle-sdk.sh`.
- [ ] **Step 3: Suite complète** — `python3 -m nodejs --test tests/ && python3 tests/rendu/test_rendu.py` → Expected: tout PASS / `RENDU OK`.
- [ ] **Step 4: Commit et publication** — `git add -A && git commit -m "Documentation : clé API, coûts et limites des questions à Claude ; version 1.1.0" && git push -u origin main` → Expected: push accepté, GitHub Pages redéployé (vérifier `curl -sI https://dav2522.github.io/appli-cee/js/questions.js` → 200 après quelques minutes).
