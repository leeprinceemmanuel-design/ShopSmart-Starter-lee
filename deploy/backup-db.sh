#!/usr/bin/env bash
# File: deploy/backup-db.sh
# Makes a compressed copy of the ShopSmart database before a risky change
# (a new migration, a new release). Keeps the 7 newest copies.
# Run on the EC2 server:  sudo bash /opt/shopsmart/deploy/backup-db.sh
set -euo pipefail

BACKUP_DIR=/var/backups/shopsmart
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

FILE="$BACKUP_DIR/shopsmart-$(date +%Y%m%d-%H%M%S).sql.gz"
# The postgres system user can read the database without a password (local peer login).
sudo -u postgres pg_dump --no-owner shopsmart | gzip > "$FILE"
chmod 600 "$FILE"
echo "Backup written: $FILE ($(du -h "$FILE" | cut -f1))"

# Delete all but the 7 newest backups.
ls -1t "$BACKUP_DIR"/shopsmart-*.sql.gz | tail -n +8 | xargs -r rm --
