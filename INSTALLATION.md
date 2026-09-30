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

## 4. Un devis ou une étude arrive
- Depuis Gmail, Drive, WhatsApp, l'appareil photo… : **Partager** le PDF (ou la photo) → **Appli CEE**. Un dossier s'ouvre :
  les documents sont **conservés dans l'appli** (encore là après fermeture), affichés dans la visionneuse (pages du PDF,
  photo ; **Ouvrir** pour le lecteur du téléphone), le texte est extrait, les fiches suggérées et les paramètres relevés
  (puissance, surface, Etas, montant HT…). Ou : onglet **Dossiers** → **Depuis un fichier** ; dans un dossier → **Ajouter**.
  Les photos sont réduites à 2000 px avant stockage.
- **Question à Claude** : taper la question ou toucher un raccourci — *Analyser ce devis*, *Contre-expertise de l'étude*
  (méthode, hypothèses, conformité à la fiche et aux points contrôlés par les organismes d'inspection accrédités COFRAC),
  *Conformité à la fiche* — puis **Ouvrir dans Claude** et choisir **Claude** dans le menu de partage. La question, la fiche
  choisie et les documents du dossier s'ouvrent dans l'appli Claude, qui répond avec ton abonnement (aucun coût en plus) en
  consultant les données CEE grâce au connecteur de l'étape 5.
- **Historique** (dépliable sous la question) : toutes les questions du dossier avec leur date ; colle la réponse de Claude
  dans l'entrée pour la garder ; *Reprendre* renvoie la question dans la zone de saisie, *Supprimer* l'efface.
- **Dossier d'expertise complet** (inchangé) : choisir la fiche → **Générer le dossier** → **Partager vers
  Claude** : le dossier (mission, conditions de la fiche, barème, paramètres, texte du devis) part vers l'appli Claude
  **avec les fichiers du dossier**. Coller la réponse de Claude → **Enregistrer** ; **Exporter .md** garde une copie.

## 5. Connecteur Claude « Appli CEE » (une fois, 2 minutes)
Il donne à Claude (appli Claude, navigateur, ordinateur) un accès en lecture aux données de la veille : recherche de fiches,
fiche complète (coûts, leviers, points à vérifier, verdict « 0 € », ton avis), texte officiel (conditions, barème), journal du
jour, fil de veille, consultations publiques, échéances. Compris dans l'abonnement : c'est Claude qui lit ces données, rien
n'est facturé en plus.
1. Sur claude.ai (dans le navigateur du téléphone ou de l'ordinateur) : **Connecteurs** → **Ajouter un connecteur
   personnalisé** → nom `Appli CEE`, adresse : voir **Drive › IA › Appli CEE › connecteur-claude.md** (adresse secrète,
   ne pas la publier) → **Ajouter**.
2. Dans une conversation de l'appli Claude, vérifier que « Appli CEE » est activé dans le menu des outils ; Claude s'en sert
   tout seul dès que la question porte sur les CEE (« que dit BAT-TH-163 sur l'appoint ? », « quoi de neuf ce matin ? »).
3. Les données sont celles que le PC pousse chaque matin dans le dépôt privé (tirées par le serveur toutes les 15 minutes).

## 6. Si quelque chose cloche
- « Jeton refusé » : jeton expiré ou sans droit *Contents* sur `appli-cee-donnees` → en créer un nouveau (étape 1).
- Claude ne trouve pas les données CEE : connecteur « Appli CEE » désactivé dans la conversation (menu des outils), ou
  adresse du connecteur modifiée (reprendre celle de `connecteur-claude.md`).
- « Ouvrir dans Claude » ne propose pas Claude : installer l'appli Claude ; sinon la question est copiée, à coller dans Claude.
- « Hors ligne : données du … » : pas de réseau, l'appli montre le dernier état connu.
- « Les données du PC sont plus récentes que cette version de l'appli » : recharger la page (mise à jour de l'appli).
- Données bizarres : Réglages → **Vider le cache des données** puis ↻.
- Un document marqué « non conservé : réimporter » : dossier créé avant la version 1.1, le fichier n'avait pas été gardé.

## 7. Confidentialité
Code public sans donnée ; données privées derrière le jeton ; documents et questions sur le téléphone (IndexedDB), envoyés à
l'appli Claude seulement quand tu les partages ; le connecteur ne donne accès qu'aux données de la veille, en lecture, depuis
les serveurs d'Anthropic uniquement et à une adresse secrète ; aucune clé API.
