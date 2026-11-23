# Mise en ligne gratuite : TiDB Cloud + Render + Vercel

| Pièce | Service | Rôle |
| --- | --- | --- |
| Base de données | **TiDB Cloud** (offre gratuite, compatible MySQL) | stocke restaurants, commandes, paiements |
| API + temps réel | **Render** (offre gratuite) | le dossier `server` |
| Site + landing page | **Vercel** (offre gratuite) | le dossier `client` |

Ordre à suivre : base → API → site → lien entre les deux → test.

## Limites à connaître avant de commencer

- **Render gratuit s'endort après 15 min sans visite** et met environ une minute à se réveiller : un client qui scanne pendant ce temps attend. Pour un « bipper », ce n'est pas acceptable. Solution gratuite : étape 7 (sonde toutes les 5 minutes).
- Render gratuit offre **750 heures par mois pour tout le compte**. Un seul service allumé en permanence consomme tout le quota (31 jours = 744 h). **Si vous avez déjà d'autres services gratuits sur Render, ils partagent ces heures** : l'API risque de s'éteindre en fin de mois.
- Une instance gratuite peut redémarrer à tout moment. Les clients connectés se reconnectent seuls, mais gardez cela en tête avant de promettre une disponibilité totale.
- L'adresse `xxx.vercel.app` est dans le QR code. **Si vous changez d'adresse plus tard, il faut réimprimer les posters.** Avant d'imprimer, ajoutez votre nom de domaine à Vercel (Settings → Domains).
- Pour de vrais clients payants, prévoyez un jour l'offre payante de Render (quelques dollars par mois) : plus d'endormissement.

## 1. Base de données (TiDB Cloud)

1. Créez un compte sur tidbcloud.com, puis un cluster **Starter** (gratuit), région la plus proche de votre API Render (Francfort si Render est en Europe).
2. Cliquez sur **Connect**, choisissez **General**, **Generate password** et notez : `HOST`, `PORT` (4000), `USER` (du type `xxxx.root`), le mot de passe.
3. Dans les paramètres d'accès (**IP Access List**), autorisez `0.0.0.0/0` : Render gratuit n'a pas d'adresse fixe.

## 2. Créer les tables (depuis votre PC)

Dans `server\.env` (ne l'envoyez jamais sur GitHub), mettez temporairement :

```
DB_HOST=gateway01.xxxx.prod.aws.tidbcloud.com
DB_PORT=4000
DB_USER=xxxx.root
DB_PASSWORD=le-mot-de-passe-tidb
DB_NAME=orderpager
DB_SSL=true
```

Puis dans le cmd, à la racine du projet :

```
npm run db:init
```

Vous devez voir `Base "orderpager" prête.` Si un message dit que `CREATE DATABASE` est ignoré et que la base est introuvable, mettez `DB_NAME=test` (la base fournie par TiDB) et relancez. **Ne lancez pas `npm run seed`** en production.

Pensez à remettre vos réglages locaux (XAMPP, `DB_SSL=false`) ensuite dans `server\.env`.

## 3. Mettre le code sur GitHub

Voir l'étape 0 de `DEPLOY.md`. Dépôt privé : Render et Vercel savent les lire.

## 4. API sur Render

1. Sur render.com : **New → Blueprint**, choisissez votre dépôt. Render lit `render.yaml` et prépare le service `mh-bip-api` (gratuit).
2. Renseignez les variables demandées :
   - `ADMIN_PASSWORD` : 10 caractères minimum
   - `DB_HOST`, `DB_USER`, `DB_PASSWORD` : ceux de TiDB
   - `CLIENT_ORIGIN` : laissez vide pour l'instant, vous le remplirez à l'étape 6
   - `VAPID_*` : à l'étape suivante
3. `JWT_SECRET` est généré automatiquement.
4. Lancez le déploiement. Quand c'est vert, ouvrez `https://mh-bip-api.onrender.com/api/health` : vous devez voir `{"ok":true}`. Notez cette adresse.

**Clés de notification :** sur votre PC, `cd server` puis `npm run vapid`. Copiez les deux clés dans Render (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`) et mettez `VAPID_SUBJECT` à `mailto:votre@email.com`.

## 5. Site sur Vercel

1. Sur vercel.com : **Add New → Project**, choisissez le dépôt.
2. **Root Directory : `client`**. Framework : Vite (détecté seul).
3. **Environment Variables** : `VITE_API_URL` = l'adresse Render de l'étape 4, **sans `/` final** (ex. `https://mh-bip-api.onrender.com`).
4. Déployez. Notez l'adresse du site (ex. `https://mh-bip.vercel.app`).

## 6. Relier les deux

Dans Render, variable `CLIENT_ORIGIN` = l'adresse Vercel, **sans `/` final**. Si vous avez plusieurs adresses (site Vercel + domaine à vous), séparez-les par une virgule. Render redémarre l'API.

## 7. Garder l'API éveillée

Sur uptimerobot.com (gratuit) : **Add New Monitor**, type HTTP(s), URL `https://mh-bip-api.onrender.com/api/health`, intervalle **5 minutes**.

## 8. Test

1. `https://VOTRE-SITE.vercel.app/` : la landing page s'affiche.
2. `/admin` : mot de passe `ADMIN_PASSWORD`, créez un restaurant.
3. Sur votre téléphone en 4G : ouvrez le poster (`/poster/<nom>`), scannez, saisissez un numéro.
4. Sur un ordinateur : `/counter`, connexion, « Prête ». Le téléphone doit sonner.

## Mises à jour

`git push` : Render et Vercel redéploient seuls. Une modification de la base se fait en relançant `npm run db:init` depuis votre PC avec le `.env` TiDB.

## Dépannage

| Problème | Piste |
| --- | --- |
| Le site s'affiche mais « erreur réseau » | `VITE_API_URL` absente ou avec une faute, puis **redéployer** Vercel (elle est lue à la construction). |
| Erreur CORS dans la console du navigateur | `CLIENT_ORIGIN` ne correspond pas exactement à l'adresse du site (http/https, `/` final). |
| L'API ne démarre pas, « JWT_SECRET… » ou « ADMIN_PASSWORD… » | Valeur absente ou trop courte dans Render. |
| `Access denied` / `ECONNREFUSED` vers TiDB | Mauvais utilisateur (préfixe `xxxx.` inclus), IP Access List, ou `DB_SSL` pas à `true`. |
| Première visite très lente | L'API dormait : vérifiez la sonde de l'étape 7. |
| Actualiser sur `/counter` donne une erreur 404 | `client/vercel.json` absent du dépôt. |

## Notifications sur iPhone (écran verrouillé)

1. Sur Render, vérifiez `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et `VAPID_SUBJECT=mailto:votre@email.com` (une vraie adresse).
2. Redéployez Vercel (le dossier `client/api/manifest.js` est une fonction automatique, rien à configurer).
3. Test sur un iPhone (iOS 16.4+, Safari) : scannez le QR → entrez le numéro → « Comment faire ? » → Partager → Sur l'écran d'accueil → Ajouter → ouvrez l'icône → le numéro est prérempli → « Suivre ma commande » → Autoriser → verrouillez l'écran → appuyez sur « Prête » au comptoir.
