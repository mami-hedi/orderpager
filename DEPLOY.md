# Mise en production : VPS + Docker

Un seul serveur fait tourner trois conteneurs : **MySQL**, **l'application** (API + WebSocket + site) et **Caddy**, qui fournit le HTTPS automatiquement. MySQL n'est jamais exposé sur Internet.

Le HTTPS est obligatoire pour que les notifications écran éteint et le maintien de l'écran allumé fonctionnent sur les téléphones.

> Les commandes `docker compose` ci-dessous utilisent toujours `-f docker-compose.prod.yml`.
> **Ne lancez jamais `docker-compose.yml` sur le serveur** : c'est le fichier de développement, il ouvre MySQL avec `root` / `root`.

---

## 0. Mettre le code sur GitHub (depuis votre PC)

C'est votre sauvegarde du code, et cela simplifie aussi les mises à jour du serveur.

1. Sur github.com, créez un **dépôt privé** vide nommé `orderpager` (ne cochez ni README, ni .gitignore, ni licence). Gardez-le **privé** : c'est votre produit.
2. Dans le dossier du projet sur votre PC (celui qui contient `package.json` et `DEPLOY.md`) :

```bash
git init -b main
git add .
git status
```

3. **Lisez le résultat de `git status`** : il ne doit apparaître ni `.env` (ni `server/.env`), ni `node_modules`, ni `dist`. S'ils apparaissent, n'allez pas plus loin. Les fichiers `package-lock.json` doivent par contre bien être envoyés, ils garantissent les mêmes versions partout.
4. Puis :

```bash
git commit -m "OrderPager : première version"
git remote add origin https://github.com/VOTRE-COMPTE/orderpager.git
git push -u origin main
```

Windows ouvre une fenêtre pour vous connecter à GitHub la première fois. Ensuite, après chaque modification : `git add .`, `git commit -m "description"`, `git push`.

## 1. Créer le serveur (VPS)

- Système : **Ubuntu 24.04 LTS**.
- Taille minimale : **2 Go de RAM**, 1 à 2 vCPU, 20 Go de disque (MySQL a besoin de mémoire).
- Fournisseurs courants : Hetzner, OVH, DigitalOcean, Contabo. Choisissez un datacenter en Europe. Compter quelques euros par mois.
- Ajoutez votre **clé SSH** à la création si le fournisseur le propose, et notez l'**adresse IP** du serveur (ex. `203.0.113.10`).

## 2. Sécuriser le serveur

Connectez-vous : `ssh root@203.0.113.10`, puis :

```bash
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy     # copie votre clé SSH

apt update && apt -y upgrade
apt -y install unattended-upgrades unzip ufw git
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable
```

Ouvrez **un second terminal** et vérifiez que `ssh deploy@203.0.113.10` fonctionne avant de fermer la session root. Travaillez ensuite avec l'utilisateur `deploy`.

Si votre fournisseur a un pare-feu dans son interface (Hetzner Cloud Firewall, OVH, etc.), autorisez-y aussi les ports **22, 80 et 443**.

## 3. Installer Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
```

Déconnectez-vous puis reconnectez-vous, et vérifiez : `docker compose version`.

## 4. Envoyer le projet sur le serveur

**Option A : depuis GitHub (recommandé)**. Comme le dépôt est privé, le serveur a besoin d'une clé en lecture seule (« clé de déploiement »). Sur le serveur :

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
ssh-keygen -t ed25519 -C "serveur-orderpager" -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub
```

Copiez la ligne affichée. Sur GitHub, ouvrez le dépôt, puis **Settings → Deploy keys → Add deploy key**, collez la clé, donnez-lui un nom (« serveur ») et **laissez « Allow write access » décoché**. De retour sur le serveur :

```bash
printf 'Host github.com\n  IdentityFile ~/.ssh/github_deploy\n  IdentitiesOnly yes\n' >> ~/.ssh/config
chmod 600 ~/.ssh/config
git clone git@github.com:VOTRE-COMPTE/orderpager.git
cd orderpager
```

À la première connexion, répondez `yes` à la question sur l'authenticité de github.com. Si la clé fonctionne, le clonage se fait sans demander de mot de passe.

**Option B : par un fichier zip** (sans GitHub). Depuis Windows (PowerShell), dans le dossier qui contient `orderpager.zip` :

```powershell
scp orderpager.zip deploy@203.0.113.10:~
```

Puis sur le serveur :

```bash
unzip orderpager.zip
cd orderpager
```

## 5. Configurer les secrets

```bash
cp .env.production.example .env
chmod 600 .env
nano .env
```

Générez chaque secret avec `openssl rand -hex 32` (une valeur différente pour `MYSQL_ROOT_PASSWORD`, `DB_PASSWORD` et `JWT_SECRET`). `ADMIN_PASSWORD` : 10 caractères minimum, sans `$` ni guillemets. Le serveur **refuse de démarrer** si `JWT_SECRET` ou `ADMIN_PASSWORD` sont faibles ou laissés par défaut.

Notez ces mots de passe dans un gestionnaire de mots de passe : le fichier `.env` n'est pas sauvegardé par le script de sauvegarde.

## 6. Choisir l'adresse (`DOMAIN`)

**Pour tester sans domaine** : écrivez l'IP avec des tirets, suivie de `.sslip.io`. Pour `203.0.113.10` :

```
DOMAIN=203-0-113-10.sslip.io
```

Caddy obtient un vrai certificat HTTPS pour cette adresse. **Ne faites jamais imprimer de posters avec cette adresse** : le QR code contient l'adresse du site, et elle changera.

**Pour la production**, chez votre registrar de domaine, créez un enregistrement **A** qui pointe votre nom (ex. `bip.exemple.com`) vers l'IP du serveur. Attendez qu'il soit actif (`ping bip.exemple.com` doit répondre avec la bonne IP), puis :

```bash
nano .env                  # DOMAIN=bip.exemple.com
docker compose -f docker-compose.prod.yml up -d
```

Changer de domaine rend **les anciens QR codes inutilisables** : il faut régénérer et réimprimer les posters.

## 7. Lancer

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
```

La première construction prend quelques minutes. Dans les logs de `app`, vous devez voir `Base "orderpager" prête.` puis `API prête sur http://localhost:4000` (`Ctrl + C` pour quitter les logs).

Ouvrez ensuite `https://VOTRE-DOMAINE/` : la page d'accueil doit s'afficher avec le cadenas.

## 8. Activer les notifications écran éteint (VAPID)

```bash
docker compose -f docker-compose.prod.yml run --rm app npm run vapid
```

Copiez les deux clés affichées dans `.env` (`VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY`), mettez votre vraie adresse dans `VAPID_SUBJECT` (`mailto:...`), puis :

```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs app | tail
```

Le message « VAPID non configuré » ne doit plus apparaître.

## 9. Premier accès et test réel

1. Ouvrez `https://VOTRE-DOMAINE/admin`, connectez-vous avec `ADMIN_PASSWORD`.
2. Créez le premier restaurant (le restaurant `demo` n'existe pas en production).
3. Sur votre téléphone, **en 4G** (pas en Wi-Fi), scannez le poster (`/poster/<adresse>`) et saisissez un numéro.
4. Sur un ordinateur, ouvrez `/counter`, connectez-vous avec le nom du restaurant et appuyez sur « Prête ».

Android : acceptez la demande de notification. iPhone : un encart « Comment faire ? » guide le client pour ajouter le site à l'écran d'accueil (iOS 16.4 ou plus récent), rouvrir l'icône, ressaisir son numéro (prérempli) et accepter les notifications ; sinon le client garde la page ouverte. Vérifiez aussi que `VAPID_SUBJECT` est une vraie adresse `mailto:` (Apple peut refuser l'exemple).

## 10. Sauvegardes

```bash
chmod +x deploy/backup.sh
./deploy/backup.sh                # test : crée un fichier dans backups/
crontab -e
```

Ajoutez cette ligne (sauvegarde chaque nuit à 3 h, 14 jours conservés) :

```
0 3 * * * /home/deploy/orderpager/deploy/backup.sh >> /home/deploy/orderpager/backups/backup.log 2>&1
```

**Une sauvegarde sur le même serveur ne protège pas si le serveur disparaît.** Copiez régulièrement `backups/` ailleurs (votre PC avec `scp`, un stockage cloud, ou activez les snapshots du fournisseur).

Restaurer une sauvegarde :

```bash
gunzip -c backups/orderpager_2026-11-12_0300.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" orderpager'
```

Testez la restauration au moins une fois avant d'avoir de vrais clients.

## 11. Mettre à jour l'application

Sur votre PC, poussez d'abord la nouvelle version (`git add .`, `git commit -m "..."`, `git push`). Puis sur le serveur :

```bash
cd ~/orderpager
./deploy/backup.sh                                       # filet de sécurité
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

(Sans GitHub : envoyez le nouveau zip, puis `unzip -o orderpager.zip` à la place de `git pull`.)

Votre `.env` n'est pas dans GitHub ni dans le zip, il est conservé. Les migrations de base de données s'appliquent toutes seules au démarrage. Le site est indisponible quelques secondes.

## 12. Surveillance

- Créez une sonde gratuite (UptimeRobot, par exemple) sur `https://VOTRE-DOMAINE/api/health` : vous êtes prévenu si le site tombe.
- État : `docker compose -f docker-compose.prod.yml ps`. Logs : `... logs --tail 100 app`.
- Les conteneurs redémarrent seuls après un redémarrage du serveur. Les logs sont limités à 30 Mo par conteneur.

---

## Checklist avant d'imprimer les posters

- [ ] Le **domaine définitif** est configuré (pas `sslip.io`).
- [ ] Le poster est ouvert et imprimé **depuis l'adresse définitive** (`https://domaine/poster/...`).
- [ ] Test complet sur un **Android** et un **iPhone**, en 4G.
- [ ] `ADMIN_PASSWORD` fort, noté dans un gestionnaire de mots de passe.
- [ ] Une **restauration** de sauvegarde a été testée, et les sauvegardes sont copiées hors du serveur.
- [ ] Le mot de passe du comptoir est remis au restaurant.

## Dépannage

| Problème | Cause probable et solution |
| --- | --- |
| Pas de cadenas / erreur de certificat | `docker compose -f docker-compose.prod.yml logs caddy`. Vérifiez que les ports 80 et 443 sont ouverts (pare-feu du fournisseur compris) et que le DNS pointe bien vers l'IP. |
| `502 Bad Gateway` | L'application n'est pas prête ou a planté : `... logs app`. |
| L'application s'arrête avec « JWT_SECRET manquant ou trop faible » | Secrets absents ou trop courts dans `.env` (voir étape 5). |
| `Access denied for user 'orderpager'` | `DB_PASSWORD` a été modifié après le premier démarrage : MySQL ne l'applique qu'à la création du volume. Remettez l'ancienne valeur, ou changez-la dans MySQL avec `ALTER USER`. Ne supprimez pas le volume : vous perdriez les données. |
| Le téléphone ne sonne pas écran éteint | HTTPS actif ? Clés VAPID renseignées ? Notifications acceptées ? Sur iPhone, site ajouté à l'écran d'accueil ? |
| Disque plein | `docker system df`, puis `docker image prune` ; vérifiez la taille de `backups/`. |
