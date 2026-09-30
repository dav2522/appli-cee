# Dossier : documents et questions à Claude — cahier des charges

Date : 2026-09-30.

> **Révisé le 2026-09-30 (après-midi), à la demande de David (« pas d'API, je ne veux pas payer en plus »)** : la clé API et les appels directs sont retirés (v1.2.0). « Ouvrir dans Claude » partage la question et les documents vers l'appli Claude, qui consulte les données grâce au connecteur MCP « Appli CEE » (dépôt `appli-cee-donnees`, `connecteur/`). Les sections 1 et 3 ci-dessous décrivent la v1.1.0. Complète la spec du 2026-09-29 (`2026-09-29-appli-cee-design.md`). Demande de David :

> Dans l'onglet « Dossier », ajouter l'import de fichiers (PDF ou images : devis, études de dimensionnement…). L'utilisateur doit pouvoir interagir avec ces documents et poser toutes sortes de questions (analyser un devis, contre-expertise d'une étude de dimensionnement pour vérifier sa conformité aux exigences du COFRAC…). Sous le document et l'espace d'échange, un historique dépliable des questions posées.

## 1. Décisions

- **Moteur : clé API Anthropic saisie dans Réglages** (obligatoire pour une interaction réelle dans l'appli). Stockée dans `localStorage` du téléphone comme le jeton GitHub ; jamais envoyée ailleurs qu'à `api.anthropic.com`. Facturation à l'usage sur le compte de David.
- **Sans clé, rien ne casse** : le bouton « Poser la question » devient « Partager la question vers Claude » (Web Share vers l'appli Claude, texte + fichiers) ; l'entrée est ajoutée à l'historique en état `partage` et la réponse se colle à la main dans l'entrée.
- **Modèle** : `claude-opus-5` (constante `MODELE` dans `js/claude.js`), thinking adaptatif, streaming, `max_tokens` 16 000, `fallbacks: "default"` avec l'en-tête beta `server-side-fallback-2026-07-01` (repli serveur en cas de refus du classifieur).
- **SDK officiel** `@anthropic-ai/sdk` (0.129.0, MIT) bundlé par esbuild en un module ESM unique `vendor/anthropic-sdk.min.mjs` (≈ 190 Ko), importé dynamiquement à la première question. Client créé avec `dangerouslyAllowBrowser: true` (appli mono-utilisateur, clé locale) et `maxRetries: 2`.
- **Fichiers conservés dans l'appli** : les PDF, images et textes importés sont stockés dans IndexedDB (nouveau store `fichiers`, base v2) et rechargés à l'ouverture du dossier. Les dossiers créés avant cette version gardent leurs métadonnées ; leurs fichiers absents sont signalés « non conservé : réimporter ».
- **Images réduites** côté téléphone avant stockage et envoi : côté long ≤ 2000 px, JPEG qualité 0,85 (photos de téléphone souvent > 5 Mo ; limite API 10 Mo par image, requête 32 Mo).
- **Conversation par dossier** : chaque question et sa réponse sont enregistrées dans le dossier (`d.questions`). Les 8 derniers échanges sont renvoyés à Claude avec la nouvelle question (mémoire de conversation).

## 2. Écran du dossier (ordre vertical)

1. Titre (existant).
2. **Documents** : liste des fichiers (nom, taille, type ; bouton × pour retirer), bouton « Ajouter » (PDF, image/*, texte), rappel du partage Android. Visionneuse du fichier sélectionné (onglets si plusieurs) :
   - PDF : rendu page par page sur `<canvas>` via pdf.js (déjà vendu), boutons ‹ › et « page n / N », bouton « Ouvrir » (blob dans le lecteur du téléphone) ;
   - image : `<img>` (objet URL), « Ouvrir » ;
   - texte : bloc `.texte-officiel`.
3. **Question à Claude** : raccourcis (`SUGGESTIONS`, 3 boutons qui remplissent la zone), `textarea#q-texte`, bouton `#q-poser` (« Poser la question » ou « Partager la question vers Claude » sans clé), bouton `#q-arreter` pendant le flux. Zone `#q-reponse` : réponse en streaming (rendu `md()` + paragraphes), puis ligne de coût (« 12 300 jetons en entrée dont 11 800 en cache · 850 en sortie · ≈ 0,09 $ »). Message d'erreur dans `#q-etat` (`aria-live`).
4. **Historique** : `<details id="q-historique">` fermé par défaut, `summary` = « Historique — N question(s) ». Entrées du plus récent au plus ancien : date/heure, question, `<details>` avec la réponse (ou textarea « Coller la réponse » en état `partage`), bouton « Supprimer ». Bouton « Reprendre » remet la question dans la zone de saisie.
5. Existant : fiches suggérées, choix de la fiche, paramètres, génération et partage du dossier d'expertise, réponse collée, enregistrer / supprimer.

Le texte extrait des PDF (pdf.js) continue d'alimenter la suggestion de fiche et les paramètres ; il n'est plus affiché en bloc « Texte extrait » (remplacé par la visionneuse) mais reste dans `d.devis_texte`.

## 3. Requête envoyée à Claude

- `system` (tableau) : `[ {type:"text", text: SYSTEME, cache_control:{type:"ephemeral"}}, {type:"text", text: contexteFiche(...)} ]` si une fiche est choisie, sinon le seul bloc `SYSTEME`.
  - `SYSTEME` : expert du dispositif CEE en France ; répond en français, structuré, chiffré, prudent ; cite le document (page, poste, montant) ; signale hypothèses et manques ; pour une conformité, passe chaque exigence en revue (fiche, règles de l'art, référentiel de contrôle CEE appliqué par les organismes d'inspection accrédités COFRAC) et conclut conforme / non conforme / à vérifier ; ne jamais inventer un prix ou une référence, donner des ordres de grandeur en le disant.
  - `contexteFiche` : code, titre, version et date d'application, résumé, coup de pouce, fin de fiche, « à vérifier », leviers, coûts habituels, note de Solhy, extraits « Conditions pour la délivrance » et « Montant de certificats » (mêmes sections que `construireDossier`, extraites par `sectionsTexte` dans `dossier.js`).
- `messages` :
  1. `user` : pour chaque fichier, un bloc texte « Document n : nom » suivi du bloc `document` (PDF, `source.type = "base64"`, `media_type = "application/pdf"`) ou `image` (JPEG/PNG/WebP/GIF, base64) ; un fichier texte devient un bloc texte « Document n : nom » + contenu. `cache_control: {type:"ephemeral"}` sur le dernier bloc document/image. Puis la première question de l'historique conservé (ou la question courante s'il n'y a pas d'historique).
  2. Alternance `assistant` (réponse texte) / `user` (question) pour les échanges conservés (état `ok` seulement, 8 derniers), puis la question courante en dernier `user`.
  - Sans fichier : la question seule (texte extrait éventuel en préambule).
- Garde-fous côté appli : somme des tailles base64 > 30 Mo → erreur `trop_volumineux` sans appel ; plus de 20 images → erreur `trop_images`.
- Réponse : texte concaténé des blocs `text` (événement `text` du flux) ; `stop_reason` `max_tokens` → mention « réponse tronquée » ; `refusal` → message « Claude a refusé cette demande » ; `usage` conservé (`input_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`, `output_tokens`).
- Erreurs (classe SDK → code) : `AuthenticationError` → `cle` ; `PermissionDeniedError` → `interdit` ; `RateLimitError` → `limite` ; `BadRequestError` → `requete` (message API joint) ; `InternalServerError` → `surcharge` ; `APIConnectionError` → `reseau` ; `AbortError` → `arret` ; autre → `inconnue`.

## 4. Données

- `stockage.js` : `VERSION = 2`, stores `donnees, dossiers, file, partages, fichiers`.
- Store `fichiers` : clé `"<dossier_id>/<identifiant unique (horodatage base 36 + aléa)>"`, valeur `{ nom, type, taille, blob, ajoute_le }`. Suppression du dossier → suppression de ses fichiers (préfixe `"<dossier_id>/"`).
- `d.fichiers[i] = { nom, type, taille, cle }` (`cle` absente pour les anciens dossiers).
- `d.questions = [{ id, le, question, reponse, etat: "ok"|"erreur"|"partage"|"en_cours", erreur, modele, usage: {entree, cache_lu, cache_ecrit, sortie} }]`, ordre chronologique. Une entrée encore `en_cours` à l'ouverture du dossier (appli fermée pendant le flux) passe en `erreur` avec `erreur = "interrompue"`, la réponse partielle est conservée.
- Réglages : `cle_api` dans `localStorage` (`lireReglages/ecrireReglages`).
- Export/import JSON des dossiers (Réglages) : les questions suivent ; les blobs ne sont pas exportés (limite documentée).

## 5. Modules

| Fichier | Rôle | Testable en Node |
|---|---|---|
| `js/questions.js` | pur : `SYSTEME`, `SUGGESTIONS`, `contexteFiche`, `construireRequete({ fichiers, texteExtrait, questions, question, fiche, texteOfficiel, avis })` → `{ system, messages }`, `verifierTaille(fichiers)`, `estimerCout(usage)`, `formaterCout`, `nouvelleQuestion`, `messageErreur(code, detail)`, `HISTORIQUE_MAX = 8` | oui |
| `js/claude.js` | `creerClaude(cle)` (import dynamique du SDK vendu), `demander({ cle, requete, surTexte, signal })` → `{ texte, stop, usage, modele }`, `classerErreur(e)`, `testerCle(cle)` (`client.models.retrieve(MODELE)`) | partiellement (classerErreur, avec fetch simulé) |
| `js/images.js` | `dimensionsReduites(l, h, max)` (pur), `reduireImage(file, max = 2000)` → `File` JPEG (navigateur) | dimensions |
| `js/fichiers.js` | `enregistrerFichiers(stockage, dossierId, files)` → entrées, `lireBlob(stockage, cle)`, `supprimerFichiersDossier(stockage, dossierId)`, `versBase64(blob)` | oui (stockage simulé) |
| `js/visionneuse.js` | `monterVisionneuse(el, { blob, type, nom })` (pdf.js canvas / img / texte) | non (Playwright) |
| `js/vues/dossier-questions.js` | `rendreQuestions(etat, d)` (HTML de la section 2-3-4) et `monterQuestions(root, etat, actions, d)` | rendu : oui |
| `js/vues/dossiers.js` | intègre les sections, persistance des fichiers, suppression en cascade | rendu partiel |
| `js/vues/reglages.js` | carte « Clé API Anthropic » : champ, « Enregistrer », « Tester la clé », résultat | non |
| `vendor/anthropic-sdk.min.mjs`, `vendor/LICENSE-anthropic-sdk`, `tools/bundle-sdk.sh` | SDK bundlé et script de reconstruction | — |
| `sw.js` | pré-cache des nouveaux modules ; `api.anthropic.com` jamais intercepté | — |
| `css/app.css` | `.docs`, `.visionneuse`, `.q-*`, `.historique` | — |
| `INSTALLATION.md`, `README.md` | création de la clé API, coût, limites | — |

## 6. Tests

- Node (`node --test tests/`) : `questions.test.js` (requête avec 2 fichiers + historique coupé à 8, cache_control sur le dernier document, sans fichier, taille > 30 Mo, coût, messages d'erreur), `images.test.js` (dimensions), `fichiers.test.js` (stockage simulé), `claude.test.js` (`classerErreur` avec les classes du SDK vendu, `demander` avec `fetch` simulé renvoyant un flux SSE), `dossier-questions.test.js` (rendu HTML : sans clé → libellé partage ; historique N ; entrée `partage` → textarea).
- Playwright (`tests/rendu/test_rendu.py`) : `api.anthropic.com/v1/messages` intercepté (SSE simulé, corps vérifié : `document` PDF + `image` + question) ; import `devis_test.pdf` + une image PNG générée ; question → réponse streamée visible ; rechargement → historique 1 entrée, visionneuse canvas rendue ; suppression du dossier → store `fichiers` vidé ; sans clé → libellé « Partager la question vers Claude ».

## 7. Hors périmètre

OCR local, Files API (à envisager si les envois répétés de gros PDF pèsent), choix du modèle dans l'interface, export des blobs dans l'export JSON, chat global hors dossier.
