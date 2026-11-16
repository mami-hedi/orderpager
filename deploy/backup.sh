#!/usr/bin/env bash
# Sauvegarde de la base MySQL dans ./backups (compressée), en gardant 14 jours.
# À lancer chaque nuit avec cron (voir DEPLOY.md, étape 10).
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p backups

FILE="backups/orderpager_$(date +%F_%H%M).sql.gz"

docker compose -f docker-compose.prod.yml exec -T db \
  sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines orderpager' \
  | gzip > "$FILE"

# Refuse une sauvegarde vide ou corrompue
gzip -t "$FILE"
if [ "$(stat -c %s "$FILE")" -lt 500 ]; then
  echo "Sauvegarde suspecte (trop petite) : $FILE" >&2
  rm -f "$FILE"
  exit 1
fi

# Supprime les sauvegardes de plus de 14 jours
find backups -name 'orderpager_*.sql.gz' -mtime +14 -delete

echo "$(date -Is) OK $FILE ($(du -h "$FILE" | cut -f1))"
