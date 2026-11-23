# OrderPager

Remplace les bippers des restaurants et cafés par le téléphone du client.

1. Le client paie à la caisse et reçoit un ticket avec un numéro.
2. Il scanne le QR code du comptoir et saisit son numéro.
3. Le comptoir appuie sur **Prête** : le téléphone du client sonne et vibre.

Stack : React (Vite) · Node.js / Express · MySQL · Socket.IO · Web Push.

## Démarrage en local

Prérequis : Node 18+ et MySQL 8 (ou Docker).

```bash
# 1. MySQL (optionnel, si vous n'en avez pas déjà un)
docker compose up -d

# 2. Dépendances
npm run install:all

# 3. Configuration
cp server/.env.example server/.env
#   -> adapter DB_PASSWORD, JWT_SECRET, ADMIN_PASSWORD
cd server && npm run vapid && cd ..
#   -> copier les deux clés générées dans server/.env (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)

# 4. Base de données + restaurant de démo
npm run db:init
npm run seed          # crée le restaurant "demo" (mot de passe : demo1234)

# 5. Lancer API (port 4000) + front (port 5173)
npm run dev
```

Pages :

| URL | Usage |
| --- | --- |
| `/admin` | Vous : créer / suspendre les restaurants (mot de passe `ADMIN_PASSWORD`) |
| `/poster/<slug>` | Poster A4 avec QR code à imprimer |
| `/counter` | Écran comptoir (connexion avec le **nom du restaurant** et son mot de passe) |
| `/s/<nom-du-restaurant>` | Page ouverte par le client après le scan |

L'adresse de la page client est **générée automatiquement à partir du nom** : « Café de la Plage » donne `/s/cafe-de-la-plage` (accents et espaces retirés, un numéro est ajouté si le nom existe déjà : `cafe-de-la-plage-2`). Aucun identifiant à saisir à la création. Au comptoir, on se connecte avec le nom tel qu'il est écrit (« Café de la Plage ») ou avec l'adresse.

Si vous **renommez** un restaurant, la fiche propose de mettre l'adresse à jour. C'est optionnel et signalé : le poster QR déjà imprimé ne fonctionne plus après ce changement, il faut le réimprimer.

Test rapide : ouvrez `/counter` (slug `demo`) sur un onglet et `/s/demo` sur un autre, saisissez le numéro `112` côté client, puis appuyez sur **Prête** côté comptoir.

## Fonctionnement

- **Le client crée la commande** en saisissant son numéro. Le comptoir n'a rien à saisir : il voit la commande apparaître et appuie sur *Prête*.
- Si le comptoir tape un numéro **avant** que le client ait scanné, la commande est créée directement « prête » et le client la verra dès qu'il saisira son numéro.
- **Rappeler** (sur une commande prête) refait sonner le téléphone.
- Les numéros se réinitialisent chaque jour (fuseau `TZ_BUSINESS`, par défaut `Africa/Tunis`). Les commandes de plus de 3 jours sont supprimées automatiquement.
- Le comptoir voit si le client suit bien sa commande sur son téléphone (📱). Sinon, le personnel appelle le numéro à voix haute.

## Erreurs de saisie

- **Le client se trompe de numéro** : bouton « Mauvais numéro ? Modifier » sur l'écran d'attente. Sa commande est retirée (sauf si un autre téléphone suit le même numéro) et il retrouve le champ pré-rempli.
- **Le comptoir tape un mauvais numéro** : après « Prête ✓ », un message rappelle le numéro et propose **Annuler**. Les commandes prêtes ont aussi un bouton « Annuler (pas prête) » : la commande repasse en préparation et le téléphone du client arrête de sonner.
- **Faute de frappe détectée** : si personne ne suit le numéro tapé, le message l'indique (« appelez-le à voix haute »). Si deux téléphones suivent le même numéro, la carte affiche ⚠.
- **Restaurant inconnu** : la page client affiche « Restaurant introuvable. Vérifiez le QR code. » et la connexion comptoir refuse l'identifiant.
- **Spam** : la saisie de numéros est limitée à 15 par minute et par adresse IP, et les commandes sont supprimées après 3 jours. Le personnel peut retirer n'importe quelle commande avec « Retirer ».

## Abonnements et essai gratuit

- À la création d'un restaurant dans `/admin`, vous choisissez la durée d'essai (10 jours par défaut, `0` = sans limite).
- La prolongation part de la date de fin actuelle, ou d'aujourd'hui si l'abonnement est déjà expiré.
- La date de fin est le **dernier jour d'accès, inclus**. Après cette date : le comptoir ne peut plus se connecter, les requêtes comptoir sont refusées et la page client affiche « Restaurant introuvable ».
- L'écran comptoir affiche en permanence les **jours restants** de l'abonnement et sa date de fin (vert, orange dans les 7 derniers jours, rouge le dernier jour), plus un bandeau jaune dans les 7 derniers jours. Un restaurant sans date n'affiche rien.
- Un restaurant sans date (`expires_at` vide), comme le restaurant `demo`, n'expire jamais.
- Le paiement reste manuel (espèces, virement, D17…) : vous encaissez, puis vous l'enregistrez dans `/admin` (voir ci-dessous).

## Administration (`/admin`)

Trois onglets :

- **Tableau de bord** : un bloc **« À faire aujourd'hui »** en tête (abonnements en retard, dernier jour, cette semaine, avec distinction essai gratuit / abonnement, boutons « Encaisser » et « Appeler »), puis restaurants actifs et en essai, abonnements payants par mois, encaissé ce mois (avec le mois dernier) et au total, commandes du jour, revenus des 12 derniers mois.
- **Restaurants** : liste avec recherche (nom, identifiant, gérant, téléphone), filtres (actifs, en essai, expirent bientôt, expirés, suspendus) et tri. Statuts : Essai, Payé, Fin d'essai / À renouveler (7 derniers jours), Expiré, Suspendu. Un clic ouvre la **fiche** :
  - *Abonnement* : échéance modifiable, prolongation offerte (+1 mois / +1 an), suspension.
  - *Accès* : liens comptoir, page client et poster QR (avec bouton Copier), changement du mot de passe du comptoir.
  - *Paiements* : formulaire (mois ajoutés, montant pré-rempli avec le prix mensuel × mois, méthode, date, note) et historique. Enregistrer un paiement avec des mois > 0 **prolonge automatiquement l'abonnement** ; avec 0 mois, le paiement est seulement noté.
  - *Informations* : nom affiché, gérant, téléphone, email, prix mensuel, notes internes.
- **Paiements** : registre de tous les paiements, filtrable par restaurant, méthode et période, avec total. Le bouton **Exporter en CSV** produit un fichier qui s'ouvre directement dans Excel (séparateur `;`, virgule décimale).

Supprimer un paiement ne modifie pas l'échéance de l'abonnement : corrigez la date sur la fiche si besoin.

**Mise à jour d'une base existante** : relancez simplement `npm run db:init`. Il crée la table `payments` et ajoute les colonnes manquantes de `shops` sans toucher aux données.

**Sur téléphone** : barre de navigation fixe en bas, restaurants et paiements affichés en cartes, formulaire de création en plein écran, filtres des paiements repliables.

## Notifications et sonnerie : ce qu'il faut savoir

- **Sonnerie dans la page** (WebAudio + vibration) : fonctionne tant que la page reste ouverte. L'écran est maintenu allumé (Wake Lock) pendant l'attente.
- **Web Push** (écran éteint) : fonctionne sur Android/Chrome. Sur **iPhone**, le push n'est disponible que si le site est ajouté à l'écran d'accueil (iOS 16.4+). L'application affiche alors un encart « Recevoir l'alerte même écran verrouillé » avec un guide en 5 étapes (Partager → Sur l'écran d'accueil → Ajouter → ouvrir l'icône → saisir le numéro → Autoriser). Le numéro est conservé dans l'URL (`/s/<slug>?n=112`) et dans un manifeste par restaurant (`/api/manifest`, fonction `client/api/manifest.js` sur Vercel, route Express en secours), car l'app installée a un stockage séparé de Safari. Sans installation, le client garde la page ouverte.
- Le push et le Wake Lock exigent **HTTPS** (sauf `localhost`). Pour tester sur un vrai téléphone, déployez ou utilisez un tunnel (ngrok, Cloudflare Tunnel).
- L'API de vibration n'existe pas sur iOS.
- Sans clés VAPID, tout fonctionne sauf le push.

## Déploiement

**Recommandé : VPS + Docker (MySQL, application et HTTPS automatique) : voir [DEPLOY.md](DEPLOY.md)** pour le guide pas à pas, les sauvegardes et la checklist avant impression des posters.

**Gratuit : TiDB Cloud + Render + Vercel : voir [DEPLOY-GRATUIT.md](DEPLOY-GRATUIT.md)** (avec les limites de l'offre gratuite de Render).

**Alternative : un seul service (Render)**

- Build : `npm install --prefix client && npm install --prefix server && npm run build --prefix client`
- Start : `npm start --prefix server`
- Variables : celles de `server/.env.example`, plus `NODE_ENV=production`. `CLIENT_ORIGIN` = l'URL publique du service.

Le serveur Node sert alors l'API, les WebSockets et le front compilé. Base MySQL : service managé (PlanetScale, Aiven, Railway…) puis `npm run db:init` une fois.

**Option front sur Vercel + API sur Render**

- Front : définir `VITE_API_URL=https://votre-api.onrender.com` au build.
- API : `CLIENT_ORIGIN=https://votre-front.vercel.app`.
- Les WebSockets ne passent pas sur les fonctions serverless de Vercel : l'API doit rester sur Render (ou équivalent).

## Sécurité (déjà en place)

Mots de passe hachés (bcrypt), JWT, limitation de débit sur les routes publiques et de connexion, validation des endpoints push (anti-SSRF), restaurants suspendus coupés immédiatement.

## Pistes pour la suite

- Paiement en ligne de l'abonnement (D17 / Flouci) avec prolongation automatique.
- Plusieurs écrans comptoir par restaurant (comptes employés).
- Intégration caisse (webhook à la validation du paiement).
- Temps d'attente estimé, statistiques.
- Ticket sans QR : lien court ou SMS.
