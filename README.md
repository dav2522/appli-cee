# Appli CEE

Application installable (PWA) de pilotage de David : Accueil, Solhy (veille CEE, fiches, échéances, Expertise CEE),
Vidéos (lien YouTube → fiche de synthèse illustrée), Projets en cours, Réglages. Depuis la version 2.0 (V2, branche `main`),
l'appli est servie par son propre serveur (dépôt privé `dav2522/appli-cee-serveur`) : connexion par empreinte (clé d'accès),
plus aucun jeton sur le téléphone, mises en page pour écran plié et déplié (Galaxy Z Fold 7).
Les questions s'ouvrent dans l'appli Claude (abonnement), qui consulte les données CEE grâce au connecteur MCP « Appli CEE ».

- Appli (V2) : https://appli.srv1911219.hstgr.cloud — installation : `INSTALLATION.md`
- **V1 archivée le 05/10/2026** : étiquette `v1.2.0` et branche `v1` (PWA sur GitHub Pages, données lues avec un jeton GitHub). GitHub Pages publie désormais la branche `pages-redirection`, un simple renvoi vers la V2
- Cahier des charges : `docs/superpowers/specs/2026-09-29-appli-cee-design.md` (appli) et
  `docs/superpowers/specs/2026-09-30-dossier-questions-design.md` (documents et questions) ; plans dans `docs/superpowers/plans/`
- Données : dépôt privé `dav2522/appli-cee-donnees` (export `scraper.py --export-app`, publication `--publier-app`)
- Tests : `python3 -m nodejs --test tests/` (unitaires) ; parcours complet avec le serveur : `tests/e2e/parcours.py` du dépôt `appli-cee-serveur`
- Dépendance vendue : pdf.js (`vendor/pdf*.mjs`) ; logo (étoile multicolore, une branche par activité) et icônes générés par `tools/logo.py`

Modules : `js/questions.js` (texte partagé vers l'appli Claude, raccourcis),
`js/fichiers.js` (documents dans IndexedDB), `js/images.js` (réduction des photos), `js/visionneuse.js` (PDF/image),
`js/vues/dossier-questions.js` (section Documents & questions), `js/dossier.js` (suggestion de fiche, paramètres, dossier d'expertise).
