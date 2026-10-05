# Appli CEE

Application installable (PWA) de pilotage de David : Accueil, Solhy (veille CEE, fiches, échéances, Expertise CEE),
Vidéos (lien YouTube → fiche de synthèse illustrée), Projets en cours, Réglages. Depuis la version 2.0 (branche `socle-b`),
l'appli est servie par son propre serveur (dépôt privé `dav2522/appli-cee-serveur`) : connexion par empreinte (clé d'accès),
plus aucun jeton sur le téléphone, mises en page pour écran plié et déplié (Galaxy Z Fold 7).
Les questions s'ouvrent dans l'appli Claude (abonnement), qui consulte les données CEE grâce au connecteur MCP « Appli CEE ».

- Appli : https://dav2522.github.io/appli-cee/ — installation et connecteur Claude : `INSTALLATION.md`
- Cahier des charges : `docs/superpowers/specs/2026-09-29-appli-cee-design.md` (appli) et
  `docs/superpowers/specs/2026-09-30-dossier-questions-design.md` (documents et questions) ; plans dans `docs/superpowers/plans/`
- Données : dépôt privé `dav2522/appli-cee-donnees` (export `scraper.py --export-app`, publication `--publier-app`)
- Tests : `python3 -m nodejs --test tests/` (unitaires) ; parcours complet avec le serveur : `tests/e2e/parcours.py` du dépôt `appli-cee-serveur`
- Dépendance vendue : pdf.js (`vendor/pdf*.mjs`) ; icônes générées depuis `tools/logo-cee.png` par `tools/icones.py`

Modules : `js/questions.js` (texte partagé vers l'appli Claude, raccourcis),
`js/fichiers.js` (documents dans IndexedDB), `js/images.js` (réduction des photos), `js/visionneuse.js` (PDF/image),
`js/vues/dossier-questions.js` (section Documents & questions), `js/dossier.js` (suggestion de fiche, paramètres, dossier d'expertise).
