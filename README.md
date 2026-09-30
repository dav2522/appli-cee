# Appli CEE

Application web installable (PWA) pour suivre les fiches CEE au jour le jour, conserver les devis et études d'un
dossier, interroger Claude dessus et préparer des dossiers d'expertise. Usage personnel ; les données sont lues dans
un dépôt privé avec un jeton, les questions à Claude passent par une clé API Anthropic saisie dans Réglages.

- Appli : https://dav2522.github.io/appli-cee/ — installation, clé API, coûts : `INSTALLATION.md`
- Cahier des charges : `docs/superpowers/specs/2026-09-29-appli-cee-design.md` (appli) et
  `docs/superpowers/specs/2026-09-30-dossier-questions-design.md` (documents et questions) ; plans dans `docs/superpowers/plans/`
- Données : dépôt privé `dav2522/appli-cee-donnees` (export `scraper.py --export-app`, publication `--publier-app`)
- Tests : `python3 -m nodejs --test tests/` (unitaires) et `python3 tests/rendu/test_rendu.py` (rendu Chromium, API simulée)
- Dépendances vendues : pdf.js (`vendor/pdf*.mjs`) et le SDK officiel `@anthropic-ai/sdk` bundlé par `tools/bundle-sdk.sh`
  (`vendor/anthropic-sdk.min.mjs`, chargé à la première question)

Modules : `js/questions.js` (requête à Claude, historique, coûts), `js/claude.js` (SDK, streaming, erreurs),
`js/fichiers.js` (documents dans IndexedDB), `js/images.js` (réduction des photos), `js/visionneuse.js` (PDF/image),
`js/vues/dossier-questions.js` (section Documents & questions), `js/dossier.js` (suggestion de fiche, paramètres, dossier d'expertise).
