# Tests de rendu

Depuis le socle B (05/10/2026), l'appli est servie par son serveur : le test d'affichage complet vit dans le dépôt
`dav2522/appli-cee-serveur`, `tests/e2e/parcours.py`. Il couvre, avec le vrai serveur et Chromium :
- connexion par clé d'accès virtuelle (inscription avec code, code de secours, reconnexion par empreinte) ;
- Accueil, Solhy (Veille, Fiches, Échéances, Expertise CEE), avis recopiés pour la veille ;
- Expertise CEE : import de `devis_test.pdf` (suggestion BAT-TH-163, puissance 160 kW), dossier d'expertise, visionneuse, partage vers Claude ;
- Vidéos (lien refusé, « déjà résumée », fiche dans son cadre), Projets en cours ;
- partage Android (lien YouTube → Vidéos, document → Expertise), lecture hors ligne ;
- mises en page plié (390 px) et déplié (884 px), repli sans rechargement, aucune violation de la politique de sécurité.

`devis_test.pdf` (généré par `devis_test.py`) reste ici : le parcours l'utilise.
