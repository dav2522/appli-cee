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
- **Question à Claude** (avec la clé de l'étape 5) : taper la question ou toucher un raccourci — *Analyser ce devis*,
  *Contre-expertise de l'étude* (méthode, hypothèses, conformité à la fiche et aux points contrôlés par les organismes
  d'inspection accrédités COFRAC), *Conformité à la fiche* — puis **Poser la question**. La réponse arrive en direct dans
  l'appli, avec le nombre de jetons et le coût estimé ; **Arrêter** interrompt. Claude reçoit les documents du dossier, la
  fiche choisie (résumé, conditions, barème) et les 8 questions précédentes du dossier : les relances gardent le contexte.
- **Historique** (dépliable sous la réponse) : toutes les questions du dossier avec date, réponse repliée, *Reprendre*
  (renvoie la question dans la zone de saisie), *Supprimer*.
- **Dossier d'expertise complet** (chemin sans clé, inchangé) : choisir la fiche → **Générer le dossier** → **Partager vers
  Claude** : le dossier (mission, conditions de la fiche, barème, paramètres, texte du devis) part vers l'appli Claude
  **avec les fichiers du dossier**. Coller la réponse de Claude → **Enregistrer** ; **Exporter .md** garde une copie.

## 5. Clé API Anthropic (questions à Claude dans l'appli)
1. Sur https://platform.claude.com (compte Anthropic, avec un moyen de paiement ou des crédits) : **API keys** →
   **Create key**, nom `appli-cee`. Copier la clé (`sk-ant-…`) : elle n'est affichée qu'une fois.
2. Dans l'appli : **Réglages** → **Clé API Anthropic** → coller → **Enregistrer** → **Tester la clé** → « Clé valide (Claude Opus 5) ».
3. Coût, facturé à l'usage sur ce compte (modèle `claude-opus-5` : 5 $ par million de jetons en entrée, 25 $ en sortie,
   documents relus depuis le cache à 0,50 $) : un devis PDF de 3 pages représente environ 8 000 jetons, soit **≈ 0,05 $ pour
   la première question**, moins pour les suivantes (cache) ; une réponse longue ≈ 0,05 $. Le coût de chaque réponse est
   affiché sous celle-ci. Une photo compte 1 500 à 4 800 jetons selon sa taille.
4. Sécurité : la clé reste dans le stockage local de l'appli sur ce téléphone et ne part qu'à `api.anthropic.com`. Elle est
   révocable à tout moment depuis la Console (et à révoquer si le téléphone est perdu). Ne jamais la coller ailleurs.
5. Limites : 30 Mo de documents par question, 20 images au plus, PDF de 600 pages au plus ; les fichiers sont conservés dans
   l'appli mais **pas** dans l'export JSON des dossiers (Réglages) ; les formats non pris en charge (HEIC…) sont signalés
   « non envoyés » — préférer JPEG/PNG.
6. Sans clé : le bouton devient **Partager la question vers Claude** (appli Claude, avec les documents) et la réponse se
   colle dans l'entrée de l'historique. **Effacer** la clé dans Réglages revient à ce mode.

## 6. Si quelque chose cloche
- « Jeton refusé » : jeton expiré ou sans droit *Contents* sur `appli-cee-donnees` → en créer un nouveau (étape 1).
- « Clé API refusée par Anthropic » : clé mal copiée ou révoquée → Réglages → **Tester la clé**, sinon en créer une (étape 5).
- « Accès refusé (permissions ou crédit) » : plus de crédit ou clé restreinte sur la Console Anthropic.
- « Trop de requêtes » / « Service surchargé » : réessayer dans une minute.
- « Question interrompue » : l'appli a été fermée pendant la réponse ; la partie reçue est gardée, reposer la question.
- « Hors ligne : données du … » : pas de réseau, l'appli montre le dernier état connu (les questions attendent le réseau).
- « Les données du PC sont plus récentes que cette version de l'appli » : recharger la page (mise à jour de l'appli).
- Données bizarres : Réglages → **Vider le cache des données** puis ↻.
- Un document marqué « non conservé : réimporter » : dossier créé avant la version 1.1, le fichier n'avait pas été gardé.

## 7. Confidentialité
Code public sans donnée ; données privées derrière le jeton ; documents et questions sur le téléphone (IndexedDB) ;
documents envoyés à Anthropic seulement quand une question est posée avec la clé (pas d'entraînement sur ces données selon
les conditions de l'API) ; aucun autre serveur tiers.
