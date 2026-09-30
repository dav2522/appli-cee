# Appli CEE

Application web installable (PWA) pour suivre les fiches CEE au jour le jour, conserver les devis et études d'un
dossier, les soumettre à Claude et préparer des dossiers d'expertise. Usage personnel ; les données sont lues dans
un dépôt privé avec un jeton ; les questions s'ouvrent dans l'appli Claude (abonnement), qui consulte les données CEE
grâce au connecteur MCP « Appli CEE » (dépôt privé `appli-cee-donnees`, dossier `connecteur/`).

- Appli : https://dav2522.github.io/appli-cee/ — installation et connecteur Claude : `INSTALLATION.md`
- Cahier des charges : `docs/superpowers/specs/2026-09-29-appli-cee-design.md` (appli) et
  `docs/superpowers/specs/2026-09-30-dossier-questions-design.md` (documents et questions) ; plans dans `docs/superpowers/plans/`
- Données : dépôt privé `dav2522/appli-cee-donnees` (export `scraper.py --export-app`, publication `--publier-app`)
- Tests : `python3 -m nodejs --test tests/` (unitaires) et `python3 tests/rendu/test_rendu.py` (rendu Chromium, partage simulé)
- Dépendance vendue : pdf.js (`vendor/pdf*.mjs`) ; icônes générées depuis `tools/logo-cee.png` par `tools/icones.py`

Modules : `js/questions.js` (texte partagé vers l'appli Claude, raccourcis),
`js/fichiers.js` (documents dans IndexedDB), `js/images.js` (réduction des photos), `js/visionneuse.js` (PDF/image),
`js/vues/dossier-questions.js` (section Documents & questions), `js/dossier.js` (suggestion de fiche, paramètres, dossier d'expertise).
