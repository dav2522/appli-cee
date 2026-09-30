# Appli CEE

Application web installable (PWA) pour suivre les fiches CEE au jour le jour et préparer des dossiers
d'expertise à partir d'un devis. Usage personnel ; les données sont lues dans un dépôt privé avec un jeton.

- Appli : https://dav2522.github.io/appli-cee/ — installation : `INSTALLATION.md`
- Cahier des charges : `docs/superpowers/specs/2026-09-29-appli-cee-design.md` ; plan : `docs/superpowers/plans/2026-09-29-appli-cee.md`
- Données : dépôt privé `dav2522/appli-cee-donnees` (export `scraper.py --export-app`, publication `--publier-app`)
- Tests : `python3 -m nodejs --test tests/` (unitaires) et `python3 tests/rendu/test_rendu.py` (rendu Chromium)
