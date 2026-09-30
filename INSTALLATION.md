# Appli CEE — installation sur le téléphone (Android, Chrome)

Adresse de l'appli : **https://dav2522.github.io/appli-cee/** (code public, aucune donnée dedans).
Les données viennent du dépôt privé `dav2522/appli-cee-donnees`, lu avec un jeton qui reste sur le téléphone.

## 1. Créer le jeton GitHub (une fois, 3 minutes)
1. Sur github.com (connecté avec le compte `dav2522`) : photo de profil → **Settings** → tout en bas
   **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Token name `appli-cee` ; Expiration : 1 an ; **Repository access : Only select repositories → `appli-cee-donnees`** ;
   Permissions → Repository permissions → **Contents : Read and write**. Generate token.
3. Copier le jeton (`github_pat_…`). Il sert deux fois : dans l'appli (Réglages) et sur le PC
   (`DD\Ademe\secrets\github-token.txt`, voir `README-appli.md` du dépôt de données).
   Ne jamais le coller dans un chat, un mail ou un dépôt.

## 2. Installer l'appli
1. Ouvrir https://dav2522.github.io/appli-cee/ dans **Chrome**.
2. Menu ⋮ → **« Installer l'application »** (ou « Ajouter à l'écran d'accueil »). L'icône « CEE » apparaît.
3. Ouvrir l'appli → onglet **Réglages** → coller le jeton → **Enregistrer et synchroniser** → « Connecté : 7 fichier(s) ».
4. L'onglet **Aujourd'hui** affiche les données du jour. Tout reste consultable hors ligne ; le bouton ↻ en haut à droite force la mise à jour.

## 3. Chaque matin
Le PC exporte et pousse les données après le passage de 08:07 (voir `README-appli.md`). L'appli les récupère à l'ouverture
si elles sont plus récentes. Les avis 👍/👎 et commentaires saisis dans l'appli repartent vers le PC au passage suivant.

## 4. Un devis arrive
- Depuis Gmail, Drive, WhatsApp… : **Partager** le PDF (ou la photo) → **Appli CEE**. Un dossier s'ouvre avec le texte extrait,
  les fiches suggérées et les paramètres relevés (puissance, surface, Etas, montant HT…) : corriger si besoin.
- Ou : onglet **Dossiers** → **Depuis un fichier**.
- Choisir la fiche → **Générer le dossier** → **Partager vers Claude** : le dossier d'expertise (mission, conditions de la
  fiche, barème, paramètres, texte du devis) part vers l'appli Claude **avec le fichier d'origine**. Si le partage de fichiers
  n'est pas proposé, le texte seul est partagé (ou copié) : joindre alors le PDF à la main dans Claude.
- Coller la réponse de Claude dans le dossier (ou la partager depuis Claude vers l'Appli CEE) → **Enregistrer**.
  **Exporter .md** garde une copie.

## 5. Si quelque chose cloche
- « Jeton refusé » : jeton expiré ou sans droit *Contents* sur `appli-cee-donnees` → en créer un nouveau (étape 1).
- « Hors ligne : données du … » : pas de réseau, l'appli montre le dernier état connu.
- « Les données du PC sont plus récentes que cette version de l'appli » : recharger la page (mise à jour de l'appli).
- Données bizarres : Réglages → **Vider le cache des données** puis ↻.
- Un dossier n'a gardé que le texte extrait : les fichiers d'origine ne survivent pas à la fermeture de l'appli ; les rejoindre au partage.

## 6. Confidentialité
Code public sans donnée ; données privées derrière le jeton ; texte du devis sur le téléphone tant qu'il n'est pas partagé ;
aucune clé API, aucun serveur tiers.
