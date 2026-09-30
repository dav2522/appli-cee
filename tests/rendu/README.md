# Tests de rendu

`python3 tests/rendu/test_rendu.py [--donnees DOSSIER]` : sert le dépôt sur le port 8766, intercepte l'API GitHub
avec les fichiers de `DOSSIER` (défaut `/home/appli-cee-donnees/app`) et `api.anthropic.com` (test de clé, puis
`/v1/messages` répondu par un flux SSE simulé, le corps de la requête étant vérifié : blocs `document` PDF + `image`,
`cache_control`, fiche dans le système), joue le scénario (réglages, cinq écrans en sombre et en clair, avis,
recherche, dossier depuis `devis_test.pdf`, photo `photo_test.png` générée à la volée, visionneuse PDF, question
à Claude et historique persistant après rechargement, suppression du dossier avec ses fichiers, mode hors ligne)
et écrit les captures dans `captures/`. Sort en erreur (`ECHEC : …`) si une vérification échoue. `devis_test.py`
régénère le PDF de test. Aucune clé réelle n'est utilisée.
Tests unitaires : `python3 -m nodejs --test tests/` (Node 18 via nodejs-bin) ou `npm test`.
