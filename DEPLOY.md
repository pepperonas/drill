# Deployment — drill.celox.io

Target: VPS `69.62.121.168` (nginx + systemd, same pattern as xword/xchange).
DNS: A-record `drill → 69.62.121.168` already set.

## 1. Google OAuth (one-time)

In <https://console.cloud.google.com/apis/credentials> create an **OAuth 2.0 Client ID**
(type: Web application):

- **Authorized JavaScript origins:** `https://drill.celox.io`
- **Authorized redirect URI:** `https://drill.celox.io/api/auth/callback`

OAuth consent screen: external, scopes `openid email profile`. Note the Client ID + Secret.

## 2. Backend (`/opt/drill-api`)

```bash
# from the Mac, in the repo root
cd /Users/martin/claude/drill/server
rsync -avz --exclude node_modules --exclude data --exclude .env \
  ./ root@69.62.121.168:/opt/drill-api/

ssh root@69.62.121.168 'cd /opt/drill-api && npm install --omit=dev'

# create the env file (mode 640, root:www-data)
ssh root@69.62.121.168 'nano /opt/drill-api/.env'   # fill from .env.example
ssh root@69.62.121.168 'chown root:www-data /opt/drill-api/.env && chmod 640 /opt/drill-api/.env'

# data dir owned by www-data
ssh root@69.62.121.168 'mkdir -p /opt/drill-api/data && chown -R www-data:www-data /opt/drill-api/data'

# systemd service
ssh root@69.62.121.168 'cp /opt/drill-api/drill-api.service /etc/systemd/system/ && \
  systemctl daemon-reload && systemctl enable --now drill-api && systemctl status drill-api --no-pager'
```

Generate the session secret with `openssl rand -hex 32`.

## 3. Frontend (`/var/www/drill.celox.io`)

```bash
cd /Users/martin/claude/drill
npm run build
ssh root@69.62.121.168 'mkdir -p /var/www/drill.celox.io'
rsync -avz --delete dist/ root@69.62.121.168:/var/www/drill.celox.io/
ssh root@69.62.121.168 'chown -R root:root /var/www/drill.celox.io && chmod -R u=rwX,go=rX /var/www/drill.celox.io'
```

## 4. nginx + TLS

```bash
scp server/nginx-drill.conf root@69.62.121.168:/etc/nginx/sites-available/drill.celox.io
ssh root@69.62.121.168 'ln -sf /etc/nginx/sites-available/drill.celox.io /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx'
ssh root@69.62.121.168 'certbot --nginx -d drill.celox.io --non-interactive --agree-tos -m martin.pfeffer@celox.io'
```

## 5. DB backups (optional, recommended)

Mirror the xword pattern with a daily timer:

```bash
# drill-backup.service  (Type=oneshot, ExecStart=/usr/bin/node /opt/drill-api/scripts/backup.js)
# drill-backup.timer    (OnCalendar=*-*-* 03:30:00)
ssh root@69.62.121.168 'systemctl enable --now drill-backup.timer'
```

Backups land in `/var/backups/drill/drill-YYYY-MM-DD.db`.

## Redeploy cheatsheet

```bash
# frontend only (bump CACHE in public/sw.js per release!)
cd /Users/martin/claude/drill && npm run build && \
  rsync -avz --delete dist/ root@69.62.121.168:/var/www/drill.celox.io/

# backend only
cd /Users/martin/claude/drill/server && npm test && \
  rsync -avz --exclude node_modules --exclude data --exclude .env ./ root@69.62.121.168:/opt/drill-api/ && \
  ssh root@69.62.121.168 'cd /opt/drill-api && npm install --omit=dev && systemctl restart drill-api && systemctl is-active drill-api'
```

## Logs

```bash
ssh root@69.62.121.168 'journalctl -u drill-api -f'
```
