# ShopSmart Release Note: v1.2.0 (AWS deployment with sign-in)

| | |
| --- | --- |
| Version and date | **v1.2.0**, 13 November 2026 |
| Code | PR #9 merged into `main`; tag **`v1.2.0`**, commit **`3fc432f`** (the same commit runs on the server) |
| Release type | **Hosted** on AWS |
| Site URL | **https://13-238-143-254.sslip.io** |
| Tested URLs | `/`, `/cart` and `/orders/<id>` opened directly, `/api/health`, `/api/health/ready`, `/api/products`, `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`, `/api/orders`, `/api/orders/<id>`, `/api/assistant/questions`, plus `http://` → `https://` |
| AWS account plan | **Free plan**: US$137 credits and 178 days left on 13 Nov 2026 (about 10 May 2027). Credits after the demo: ____ |
| AWS services | **Amazon EC2** (one `t3.micro`, Ubuntu 24.04), **Amazon EBS** (20 GiB gp3 root volume), **VPC security group** `shopsmart-web-sg`, one auto-assigned **public IPv4** address. No RDS and no Amplify (see `AWS_DECISION_RECORD.md`). |
| Region | **ap-southeast-2, Asia Pacific (Sydney)**. The account's Free plan project is fixed to this Region. |
| On the instance | Caddy (HTTPS from Let's Encrypt, static files, reverse proxy) → Express API (systemd `shopsmart-api`, 127.0.0.1:3000) → PostgreSQL 16 (127.0.0.1:5432) |
| AI provider | Google Gemini with a **server-only** key. During the hosted tests Gemini answered HTTP 503 (temporarily unavailable), so the assistant used its rule-based catalog answer and showed the fallback notice. |
| Final checks | Local `npm run check` passed (backend 49/49, build OK); local smoke 20/20; **hosted smoke 21/21, and 21/21 again after a reboot** |

## What is new in v1.2.0

1. **Sign-in and order ownership (improvement 1).** Fictional test customers `ana.demo@example.com` and `ben.demo@example.com` can sign in. Checkout requires sign-in and takes the order owner from the session. **My Orders** lists only your own orders. A guest gets 401; another customer gets 404 for an order that is not theirs.
2. **Database readiness check (improvement 2).** `GET /api/health/ready` answers 503 when PostgreSQL cannot be reached, instead of a misleading "ok". Tested by stopping PostgreSQL on the server: 200 → 503 → 200.
3. **AWS deployment files:** `deploy/Caddyfile`, `deploy/shopsmart-api.service`, `deploy/api.env.example`, `deploy/backup-db.sh`, and `deploy/smoke-test.mjs` (automatic hosted checks).
4. Express listens only on `127.0.0.1` (`HOST`). CORS allows cookies from `FRONTEND_URL` only.

## Database changes

| Migration | What it does | Data kept? |
| --- | --- | --- |
| `0_init` | Product, Order, OrderItem (from v1.1) | n/a |
| `1_add_users_sessions_order_owner` | Adds `User`, `Session`, and a nullable `Order.userId` with indexes | **Yes.** Only adds; earlier orders stay with no owner |

On the server, `prisma migrate deploy` runs before every start of the service, and the first start added the 6 sample products because the table was empty. `npm run db:seed` was never run on the server. After the reboot, orders #1 and #2 were still there (the next order was #3). Migration history: `release-evidence/aws-migrate-status.txt` ("2 migrations found … Database schema is up to date!").

## Verification summary (hosted, 13 Nov 2026)

Full table with expected and observed results: `AWS_VERIFICATION.md`.

| Check | Result |
| --- | --- |
| Frontend and direct route | **Pass** |
| API connection (HTTPS, same origin, health + ready, HTTP → 308) | **Pass** |
| Catalog and cart | **Pass** |
| Account and order ownership (401 / 200 / 404) | **Pass** |
| Simulated checkout (201 / 422 / 409, stock decreases) | **Pass** |
| Assistant (grounded answer / no match / provider-failure fallback) | **Pass** |
| Restart and logs (21/21 after reboot, no secrets in log) | **Pass** |
| Secrets and credits | **Pass** (credits after the demo: fill in) |

Two problems were found and fixed during deployment: a stale local migration history (F1) and Caddy's log file permission (F2). Details are in `AWS_VERIFICATION.md`, "Failed cases".

## Known limitations

- **Single EC2 host:** if the instance is down, the whole site is down. There are no automatic database backups; `deploy/backup-db.sh` is run by hand before changes.
- **Demo accounts only:** no self-registration, password reset or admin role. Both demo customers share one demo password, created on the server and never committed.
- **Free host name:** `sslip.io` depends on an outside DNS service and Let's Encrypt limits. A stop/start of the instance changes the public IP and therefore the site address (a reboot does not).
- **Region:** Sydney instead of the closer Singapore, because the Free plan project is fixed to Sydney.
- **Dependencies:** `npm ci` reports 17 known vulnerabilities in third-party packages (4 moderate, 8 high, 5 critical). Not fixed in this release, because `npm audit fix --force` can upgrade packages to versions that break the app. To review before any real use.
- **AI provider** can be unavailable (seen as HTTP 503 during testing). The assistant then answers from the catalog and says so.
- The **cart** is kept in memory: a full page refresh empties it.
- The **Render** staging from v1.1 does not support sign-in (cross-site cookie). See the note in `DEPLOY_RENDER.md`.
- Resources are removed after grading (`DEPLOY_AWS.md` Step 12; dates in `AWS_RESOURCE_REGISTER.md`).

## Previous release

v1.1.0-rc.1 (Render staging, 11 Nov 2026): `RELEASE_NOTE_v1.1.0.md`.
