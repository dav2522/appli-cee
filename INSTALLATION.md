# Appli CEE 2.0 — installation sur le Samsung Galaxy Z Fold 7

Adresse : **https://appli.srv1911219.hstgr.cloud**

L'appli est servie par ton serveur. Tu te connectes avec ton **empreinte** (clé d'accès) : plus aucun jeton GitHub.

## 1. Mise en ligne (une seule fois)

Le garde-fou de sécurité m'interdit d'ouvrir moi-même un service sur Internet. Deux façons de faire :

- **Le plus simple :** réponds dans le chat avec la phrase d'accord que je t'ai donnée. Je lance alors la commande.
- **Ou, depuis un terminal sur le serveur :**
  ```bash
  cd /docker/appli && docker compose up -d --build
  ```

Le certificat HTTPS est créé automatiquement en quelques secondes (Let's Encrypt, via Traefik).

## 2. Première connexion (2 minutes)

1. Sur le Fold 7, ouvre **Chrome** (ou Samsung Internet) à l'adresse **https://appli.srv1911219.hstgr.cloud**.
2. L'écran **« Première connexion »** s'affiche. Saisis le **code d'inscription** que je t'ai donné dans le chat (format `XXXX-XXXX-XXXX`, valable 7 jours, à usage unique).
3. Touche **« Créer ma clé d'accès »**, puis pose ton doigt sur le capteur : le téléphone enregistre la clé.
4. Un **code de secours** s'affiche **une seule fois**. Note-le dans ton gestionnaire de mots de passe ou sur papier : il sert si tu perds le téléphone. Puis touche **« J'ai noté le code »**.
5. Les fois suivantes : **« Me connecter avec mon empreinte »**, une fois tous les 30 jours au plus (la session se prolonge à chaque utilisation).

## 3. Installer l'appli (icône sur l'écran d'accueil)

- **Chrome :** menu ⋮ → **« Installer l'application »** (ou « Ajouter à l'écran d'accueil » → Installer).
- **Samsung Internet :** menu ☰ → **« Ajouter la page à »** → **Écran d'accueil**.

L'icône **CEE** apparaît. L'appli s'ouvre en plein écran, sans barre d'adresse.

Un appui long sur l'icône donne deux raccourcis : **Résumer une vidéo** et **Nouvelle expertise CEE**.

**L'ancienne appli (V1)** est archivée depuis le 05/10/2026 : son adresse (dav2522.github.io/appli-cee) renvoie vers la nouvelle et efface l'ancien jeton et le cache du téléphone.

## 4. Ce que tu trouves dans l'appli

| Onglet | Contenu |
|---|---|
| **Accueil** | Actus CEE du jour (tuiles et nouveautés), derniers résumés vidéo, projets de la semaine, boutons « Résumer une vidéo » et « Nouvelle expertise » |
| **Solhy** | Sous-barre **Veille · Fiches · Échéances · Expertise CEE** (tout l'ancien module CEE, inchangé) |
| **Vidéos** | Colle un lien YouTube → **Résumer**. L'état s'affiche en direct (vérification, transcription, rédaction), puis la fiche illustrée. Compte 2 à 3 min pour une vidéo de 10 min |
| **Projets** | « Cette semaine » (projets en cours et ce qui attend une action de ta part), colonnes En cours, En attente, À faire, Plus tard, Fait. Chaque projet a une prochaine action, une attente et une checklist |
| **Réglages** | Connexion (ajouter un appareil, se déconnecter), données, export et import des expertises |

**Plié ou déplié.**
- **Plié** : une colonne, les onglets en bas.
- **Déplié** : les onglets passent sur la gauche, et Vidéos s'affiche en deux volets, la liste à gauche et la fiche à droite.
- Plier ou déplier ne fait rien perdre : même écran, même saisie.

**Partager vers l'appli.**
- Dans l'**appli YouTube** : Partager → **CEE**. L'onglet Vidéos s'ouvre avec le lien déjà rempli.
- Un **PDF ou une photo** (Gmail, Drive, WhatsApp) : Partager → **CEE**. Une nouvelle expertise s'ouvre, comme avant.

**Hors ligne.** Les données CEE, les fiches vidéo déjà ouvertes et les projets restent lisibles.

## 5. Si quelque chose cloche

- **« Opération annulée ou délai dépassé »** : relance, et pose le doigt dès que la fenêtre s'ouvre.
- **Téléphone perdu ou changé** : sur le nouvel appareil, « J'ai un code » → saisis ton **code de secours** → crée une nouvelle clé.
- **« Session expirée »** : reconnecte-toi avec ton empreinte. Les données en cache restent affichées.
- **Une vidéo en « Échec »** : le message dit pourquoi : vidéo privée ou non répertoriée, pas de parole, Gemini saturé (réessaie quelques minutes plus tard), limite de 10 vidéos par jour.

## 6. Pas encore actif

| Fonction | Ce qu'il faut |
|---|---|
| « Demander » à Claude sur chaque écran (avec ton abonnement) | Ton **accord explicite** |
| Synchronisation des Projets avec Todoist | Un **jeton d'API Todoist** (Todoist › Paramètres › Intégrations › Développeur) |
| Boutique LED, suivi de dossiers, Immobilier, cours de Torah, news du jour | Leurs sources de données (voir `PLAN_DASHBOARD.md`) |

## Côté serveur (pour mémoire)

- **Code :** `/docker/appli/serveur` (dépôt privé `appli-cee-serveur`).
- **Interface :** `/docker/appli/interface` (dépôt `appli-cee`, branche `main`). Mise à jour : `git -C /docker/appli/interface pull`.
- **Base :** `/docker/appli/donnees/appli.db`, sauvegardée chaque nuit à 02:30 UTC dans Drive › IA › Appli CEE › Sauvegardes (30 jours).
- **Avis 👍/👎 :** recopiés toutes les 15 min dans le dépôt de données, pour la veille.
- **Clé Gemini :** `/etc/appli-cee-serveur.env` (mode 600).
