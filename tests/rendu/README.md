# Tests de rendu

`python3 tests/rendu/test_rendu.py [--donnees DOSSIER]` : sert le dépôt sur le port 8766, intercepte l'API GitHub
avec les fichiers de `DOSSIER` (défaut `/home/appli-cee-donnees/app`), joue le scénario (réglages, cinq écrans en
sombre et en clair, avis, recherche, dossier depuis `devis_test.pdf`, mode hors ligne) et écrit les captures dans
`captures/`. Sort en erreur (`ECHEC : …`) si une vérification échoue. `devis_test.py` régénère le PDF de test.
Tests unitaires : `python3 -m nodejs --test tests/` (Node 18 via nodejs-bin) ou `npm test`.
