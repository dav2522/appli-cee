# Appli CEE — cahier des charges (design validé le 2026-09-29)

## 1. Intention

David (Solhy Énergie) veut, sur son téléphone Android, être « incollable sur les fiches CEE au jour le
jour » et pouvoir, à partir d'un devis ou d'une étude de dimensionnement reçus, obtenir une expertise
complète (fiche applicable, prime, 0 € atteignable, coûts, installateurs et qualifications, marques
et produits éligibles, pièces manquantes, risques).

Usages validés : rendez-vous client (devis → fiche, prime), journal du matin, contrôle d'un dossier
avant signature, prospection (classement des 215 fiches, avis 👍/👎 et commentaires).

Décisions validées :
- **PWA** installée depuis Chrome (icône, plein écran, hors ligne), APK éventuel plus tard.
- **Sans clé API** : l'appli prépare un dossier d'expertise partagé vers l'appli Claude
  (abonnement de David) ; pas d'appel automatique à un modèle.
- **Données du jour dans un dépôt GitHub privé**, poussées par le PC, lues par l'appli avec un jeton.
- Approche **B, données structurées** : `scraper.py` exporte des JSON compacts ; l'appli construit
  ses écrans.

Succès : chaque matin, l'appli montre les données du jour sans intervention ; un devis partagé
depuis Gmail ou Drive donne en moins d'une minute un dossier prêt à envoyer à Claude ; les avis
saisis dans l'appli reviennent dans `avis_fiches.json` du PC.

## 2. Architecture

```
PC (DD\Ademe, pipeline existant)                     GitHub                         Téléphone
─────────────────────────────────                    ──────                         ─────────
veille-pipeline.ps1                                  appli-cee-donnees (privé)      Chrome / PWA
  … publier-app.ps1 -Recevoir  ◄── avis/*.json ──────  avis/<CODE>.json  ◄── PUT ──  avis 👍/👎
  --rapport (fusion des avis)                          app/*.json        ── GET ──►  cache local
run-veille.ps1 (après l'IA, et dans le filet)                                          (IndexedDB)
  --export-app  → app\*.json                         appli-cee (public, Pages)
  publier-app.ps1 -Envoyer ──── PUT app/*.json ────►    code de l'appli   ── GET ──►  index.html…
```

- **`dav2522/appli-cee`** (public, `noindex`, comme `solhy-apercu`) : le code de l'appli, servi par
  GitHub Pages à `https://dav2522.github.io/appli-cee/`. Aucune donnée.
- **`dav2522/appli-cee-donnees`** (privé) : `app/` (données du jour), `avis/` (avis remontés),
  `pc/` (correctifs pour le PC). Créé le 2026-09-29 ; contient déjà `pc/scraper.py` (correctif
  consultations) et `pc/README-consultations.md`.
- **Jeton GitHub** *fine-grained*, créé par David, limité au dépôt `appli-cee-donnees`, permission
  *Contents : read and write*. Deux copies : `secrets\github-token.txt` sur le PC, et l'écran Réglages
  de l'appli (localStorage du téléphone). Jamais dans un chat ni dans un dépôt.

Contraintes reprises du projet Ademe : `scraper.py` reste le seul programme de la veille (la
commande `--export-app` y est ajoutée) ; les scripts PowerShell suivent le modèle de
`send-telegram.ps1` ; aucune règle des `CLAUDE.md` n'est modifiée sans l'accord de David.

## 3. Export des données (`python scraper.py --export-app`)

Nouvelle commande, sans réseau, à lancer après `--rapport` (avis fusionnés) et après l'analyse IA
(journal, fil, daily du jour). Écrit dans `app\` (nouveau dossier de DD\Ademe). Tous les fichiers
sont en JSON compact, ASCII pur (`ensure_ascii`), avec `schema` = 1.

| Fichier | Contenu | Source sur le PC |
|---|---|---|
| `meta.json` | `schema`, `genere_le`, `donnees_du`, `passage` (date, début, fin, codes DGEC/ADEME/veille, VPN, incidents), `compteurs` (actives, mouvements, consultations en cours, fins ≤ 90 j, avis 👍), `fichiers` {nom: taille} | etat_pipeline.json, delta_du_jour.json |
| `fiches.json` | `annee_volume`, `fiches` : pour chaque fiche active ou terminée depuis moins d'un an : `code, secteur, sous_secteur, titre` (carte), `nom` (officiel), `statut, version, applicable_depuis, parution` {cle, texte}, `fins` {abrogee_au, fin_validite, fin_texte, abrogation_droit}, `fin_proche` {date, au_plus_tot} ou null, `terminee_le`, `cdp` {actif, programmes, cp}, `marche` {kwh, rang, total}, `carte` (tous les champs v2 : resume, params, justif, intensite, difficulte, gwh, cp_inclus, pourquoi, leviers, be, verifier, cas, cout, couts, optim, version, analyse_le), `revision` (texte ou null), `jo` [phrases], `verdict` {zero_euro, justification, rapport, analysee_le} ou null, `presence` {ademe, dgec}, `urls` {pdf_officiel, pdf_ademe}, `chronologie` [{date, type: version/projet/jo, libelle, ref}] | catalogue_officiel.json, fiches_cartes.json, fiches_vues.json, registre_reglementaire.json, fonctions existantes (`alertes_fin`, `revisions_en_cours`, `jo_par_fiche`, `info_parution`) |
| `textes/<SECTEUR>.json` | {code: texte officiel en vigueur sans annexes, ≤ 30 000 car.} | `textes_fiches()` |
| `jour.json` | `delta` (delta_du_jour.json intégral), `telegram_brut` (HTML Telegram), `daily` (rapports\daily\AAAA-MM-JJ.html du jour, sinon null) | fichiers existants |
| `fil.json` | `bandeau` {titre, texte}, `entrees` (60 dernières) : {date, type, titre, chips [{type, texte}], faits [{etat, texte}], paragraphes [html], details [{titre, html}]} | rapports\fil-de-veille.html (analyse des `<article class="entry">`) |
| `consultations.json` | {id: {id, titre, url, debut, fin, en_cours, vue_le, fiches_citees, actions, objet, entree_en_vigueur, nor, dates, documents, genres, contributions}} | catalogue_officiel.json → meta.consultations_cee |
| `registre.json` | `textes` (JO et consultations : titre, nor, source, categorie, dates, statut, fiches, url, objet ≤ 500 car.), `fiches` (chronologie), `editorial` (30 derniers), `webinaires` | registre_reglementaire.json |
| `jalons.json` | `jalons` (prochains_jalons du journal), `top_volume` (15 fiches : code, titre, volume, statut, mise_en_ligne, fin) | fiches_vues.json, logique de `recap_volume` |
| `avis.json` | avis_fiches.json intégral | avis_fiches.json |

Garde-fous : la commande refuse d'écrire si le catalogue ou les cartes sont illisibles (code 1) ; elle
n'écrit `fiches.json` que s'il compte au moins 90 % des fiches actives du catalogue ; chaque fichier
est écrit de façon atomique (`_ecrire_json`).

## 4. Scripts PC

**`publier-app.ps1`** (à côté de `send-telegram.ps1`) :
- `-Envoyer` : pour chaque fichier de `app\`, `PUT /repos/dav2522/appli-cee-donnees/contents/app/<nom>`
  (contenu base64, `sha` lu au préalable s'il existe, message « données du AAAA-MM-JJ »). Ne pousse que
  les fichiers dont le sha local diffère. Code 0 envoyé, 1 échec, 2 jeton absent.
- `-Recevoir` : liste `avis/`, télécharge chaque `<CODE>.json` (format {avis, commentaire, le}, celui de
  la page privée) dans `logs\avis-en-ligne\` si `le` est plus récent que la copie locale. Code 0/1/2.
- Jeton : `secrets\github-token.txt` (blancs retirés, jamais affiché) ; TLS 1.2 ; 3 tentatives.

**Intégration (correctifs proposés, appliqués par David)** :
- `veille-pipeline.ps1` : après l'étape e (VPN éteint vérifié) et avant `--rapport` : `publier-app.ps1 -Recevoir`
  (un échec n'arrête rien : incident consigné).
- `run-veille.ps1` : après l'analyse IA et après le filet de sécurité : `python scraper.py --export-app`
  puis `publier-app.ps1 -Envoyer` ; résultat écrit dans `logs\veille-reveil.log`.
- La tâche Claude de 09:15 (pages claude.ai) est inchangée.

## 5. L'appli

### 5.1 Base technique
- HTML, CSS et JavaScript (modules ES) sans framework ni build ; seule bibliothèque embarquée :
  **pdf.js** (fichiers `pdf.min.mjs` + worker, vendus dans `vendor/`) pour le texte des PDF.
- `manifest.webmanifest` (nom « Appli CEE », `display: standalone`, icônes, `share_target`) et
  `sw.js` (précache de l'appli, cache des données, réception des partages).
- Stockage : IndexedDB (`donnees`, `dossiers`, `file d'attente des avis`), localStorage (réglages).
- Charte : `design-system/solhy-cee-report/MASTER.md` du projet Ademe — IBM Plex Sans, navy `#0F172A`,
  secondaire `#334155`, action `#0369A1`, **mode sombre OLED par défaut**, clair si le système le
  demande ; icônes SVG (jamais d'emoji comme icône), cibles tactiles ≥ 44 px, contraste ≥ 4,5:1,
  `prefers-reduced-motion` respecté, aucune barre fixe qui cache du contenu. La réalisation passe par le
  skill `ui-ux-pro-max` (règle du projet).
- Langue : français ; dates `jj/mm/aaaa` ; volumes en GWh/TWh comme le rapport (`giga_txt`, `_volume_txt`).

### 5.2 Synchronisation
- Au lancement et sur demande : `GET contents/app/meta.json` (`Accept: application/vnd.github.raw+json`,
  `Authorization: Bearer <jeton>`). Si `genere_le` est plus récent que la copie locale, téléchargement des
  fichiers listés dans `meta.fichiers` (les `textes/` à la demande, mis en cache ensuite), écriture en
  IndexedDB, puis rendu. Sinon : rendu depuis le cache.
- Avis : un tap 👍/👎 ou un commentaire écrit localement, puis `PUT contents/avis/<CODE>.json`
  ({avis: "up"|"down"|"", commentaire, le: ISO}) ; `sha` relu en cas de conflit ; hors ligne → file
  d'attente rejouée à la prochaine synchro. L'appli est la source la plus récente : `--rapport` garde
  l'avis dont `le` est le plus récent (règle existante).

### 5.3 Écrans (barre d'onglets en bas : Aujourd'hui · Fiches · Échéances · Dossier · Réglages)

**Aujourd'hui** — en-tête : date des données, état du passage (OK / incidents, VPN), heure de synchro.
Tuiles : fiches actives, mouvements du jour, consultations en cours, fins ≤ 90 j, mes 👍. Rubriques du
jour, dans l'ordre du daily et seulement si non vides : arrêtées / supprimées, Journal officiel,
Coup de pouce perdu / gagné, révisions, nouvelles, à venir, suppressions annoncées (J-x), fins programmées,
retirées / ajoutées au calculateur ADEME, consultations nouvelles / en cours, documents modifiés,
ATEE, actus. Puis le daily du jour (HTML Telegram rendu) et le fil de veille (entrées dépliables).
Chaque code de fiche est un lien vers sa fiche.

**Fiches** — champ de recherche fixe (code, titre, résumé, paramètres ; fiches terminées comprises),
filtres (avis : tous / 👍 / sans avis / non 👎 ; Coup de pouce ; dossiers / volume ; difficulté ; parution
< 1 an / < 2 ans ; fins ≤ 90 j masquées par défaut), tris (potentiel — ordre du rapport —, volume,
parution, code). Groupes du rapport (CP + dossiers, dossiers, volume). Carte compacte : code, pills,
titre, résumé, valo du cas optimal, marché, marques (fin, révision, à analyser), avis. Tap → **Fiche**.

**Fiche** — tout le contenu v2 (résumé, paramètres, justification, marché, parution, révision, JO,
pourquoi, leviers, bureau d'études, à vérifier, coût estimé et détail des postes, tableau
d'optimisation, cas optimal et valo, verdict avec justification), avis et commentaire (synchronisés),
chronologie (versions, projets d'arrêté avec action et statut, textes du JO), texte officiel en
accordéon (chargé à la demande), liens PDF officiel / ADEME, bouton « Nouveau dossier avec cette fiche ».

**Échéances** — agenda des jalons (date, objet, fiches liées), consultations en cours (fin, J-x,
fiches, actions), Top 15 volume, fiches terminées récemment.

**Dossier** — liste des dossiers (titre, date, fiche, état : brouillon / partagé / réponse reçue).
Nouveau dossier : (1) fichier reçu par partage Android (PDF, image) ou choisi (`<input type=file>`),
plusieurs fichiers possibles ; (2) extraction du texte des PDF (pdf.js) ; images conservées telles
quelles ; (3) suggestion de fiches : codes cités, mots-clés (PAC, air/eau, eau/eau, géothermie,
chaudière, biomasse, isolation, combles, murs, LED, luminaire, GTB, VMC, solaire, réseau de chaleur,
destratification, moteur, variateur…), secteur (bureaux, EHPAD, logement, industrie, serre) ;
(4) choix de la fiche (recherche possible) et confirmation de paramètres clés pré-remplis par
expressions régulières (puissance kW, surface m², Etas / COP / SCOP, zone climatique, secteur,
énergie remplacée, montant HT du devis) ; (5) génération du dossier ; (6) partage.

Le **dossier d'expertise** (texte Markdown) contient : mission (« Tu es expert CEE… ») ; ce qu'on
attend, dans l'ordre : conformité du devis aux conditions de la fiche (point par point), calcul du
kWh cumac et de la prime à 7 €/MWh (Coup de pouce inclus si les conditions sont remplies, coefficient
de la charte), 0 € atteignable ? (T = aides ÷ coût), écart avec le coût de marché (fourchettes de
la carte), qui contacter pour la pose (qualifications exigées par la fiche, RGE / OPQIBI, types
d'entreprises), marques et produits éligibles avec ordre de prix, pièces manquantes et risques
(dépose, attestation, contrôle sur site, date de fin de fiche) ; puis le contexte : carte de la fiche
(résumé, conditions à vérifier, leviers, coûts), extraits pertinents du texte officiel (conditions et
barème), paramètres saisis, texte extrait du devis. Le dossier est copié dans le presse-papiers et
partagé (`navigator.share` avec le texte **et** les fichiers d'origine) ; si le partage de fichiers
échoue, texte seul puis fichiers séparément. La réponse de Claude revient par partage inverse
(share target texte) ou collage dans le dossier ; export du dossier complet en `.md`.

**Réglages** — jeton (saisie masquée, test de connexion), dépôt, dernière synchro, « Mettre à jour
maintenant », taille du cache et vidage, export / import des dossiers (JSON), version de l'appli
et du schéma, lien vers la page privée claude.ai.

### 5.4 Gestion des erreurs
- Jeton absent → écran Réglages ; jeton refusé (401/403) → message et données en cache conservées.
- Hors ligne → bandeau « hors ligne, données du jj/mm », tout reste consultable.
- `schema` des données > celui de l'appli → « mettre à jour l'appli » ; < → « données du PC à mettre à
  jour ».
- PDF sans texte (scan) → suggestion impossible, choix manuel ; le fichier part quand même vers Claude.
- Fichier > 25 Mo refusé avec message.
- Écriture d'avis : conflit de `sha` → relecture et nouvel essai ; échec réseau → file d'attente.

## 6. Tests
- Python (`tests/test_export_app.py`, `unittest`) : sur une copie des données du 29/09 : schéma et
  présence des fichiers, 215 fiches actives, fiches 👍 présentes avec leurs tableaux, textes par secteur,
  fil analysé (nombre d'entrées, champs), consultations avec actions, refus si catalogue illisible.
- JavaScript (`tests/*.test.js`, `node:test`, sans dépendance) : filtres et tris (mêmes résultats que
  le rapport sur un jeu de 20 fiches), suggestion de fiches, extraction des paramètres, construction du
  dossier, décision de synchronisation (dates), file d'attente des avis.
- Rendu : Chromium headless (Playwright déjà installé sur le serveur) à 390 × 844 : captures des cinq
  écrans en sombre et en clair, navigation, recherche, filtre, fiche, création d'un dossier depuis un
  PDF de test ; mode hors ligne (service worker) ; audit d'installabilité PWA.
- Bout en bout : export réel sur les données du 29/09 poussé dans `appli-cee-donnees`, synchronisation
  depuis Chromium avec le jeton du serveur (jamais affiché), écriture d'un avis de test puis rapatriement
  par `publier-app.ps1 -Recevoir` (testé ici avec `pwsh` si disponible, sinon par un équivalent Python
  jetable et le script relu ligne à ligne).

## 7. Livraison et mise en service (à la charge de David)
1. Créer le jeton fine-grained (pas-à-pas dans `pc/README-appli.md`), le coller dans `secrets\github-token.txt`
   et dans l'appli.
2. Appliquer sur le PC : `scraper.py` (consultations + `--export-app`), `publier-app.ps1`, les deux
   lignes dans `veille-pipeline.ps1` et `run-veille.ps1`. Lancer une fois `python scraper.py --export-app`
   puis `publier-app.ps1 -Envoyer`.
3. Ouvrir `https://dav2522.github.io/appli-cee/` dans Chrome, « Ajouter à l'écran d'accueil »,
   coller le jeton, vérifier la date des données.
4. Vérifier sur le téléphone que le partage vers l'appli Claude accepte texte + fichiers (sinon le
   repli texte seul s'applique).

## 8. Hors périmètre v1
Calculateurs de prime par fiche dans l'appli, OCR des photos (la photo est partagée telle quelle),
APK / Play Store, notifications push, plusieurs utilisateurs, appel direct à un modèle.

## 9. Ordre de réalisation prévu
1. `--export-app` et ses tests (données du 29/09 disponibles sur le serveur).
2. `publier-app.ps1`, correctifs des deux `.ps1`, `pc/README-appli.md`.
3. Appli : socle (manifest, service worker, synchro, cache, réglages) puis Aujourd'hui, Fiches, Fiche.
4. Échéances.
5. Dossier (partage entrant, pdf.js, suggestion, paramètres, dossier, partage sortant, réponse).
6. Tests de rendu, publication GitHub Pages, notice d'installation.
