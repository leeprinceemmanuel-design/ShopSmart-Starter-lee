# ShopSmart Release Note: v1.2.0 (AWS deployment with sign-in)

| | |
| --- | --- |
| Version and date | v1.2.0, __ November 2026 |
| Code | Branch `feature/aws-signin-deploy` → merged to `main` → tag `v1.2.0`, commit `_______` |
| Release type | **Hosted** on AWS (fill in) / **Local** (only if HTTPS could not be obtained; see `DEPLOY_AWS.md` Step 8 Plan D) |
| Site URL | `https://________________.sslip.io` |
| Tested URLs | `/`, `/cart` (direct), `/orders/<id>` (direct), `/api/health`, `/api/health/ready`, `/api/products`, `/api/auth/*`, `/api/orders`, `/api/orders/<id>`, `/api/assistant/questions` |
| AWS account plan | Free / Paid (fill in) · credits remaining before ____ / after ____ · plan expiry ____ |
| AWS services | Amazon EC2 (one `t3.micro`/`t2.micro`-class instance, Ubuntu 24.04), Amazon EBS (root volume, 20 GiB gp3), VPC security group, public IPv4 address. No RDS, no Amplify (see `AWS_DECISION_RECORD.md`). |
| Region | ap-southeast-1, Asia Pacific (Singapore) |
| On the instance | Caddy (HTTPS, static files, reverse proxy) → Express API (systemd, 127.0.0.1:3000) → PostgreSQL 16 (127.0.0.1:5432) |
| AI provider | Google Gemini with a server-only key **or** none (fill in). Without a key, answers are rule-based catalog answers and the page shows a notice saying so. |
| Final local check | `npm run check`: ____ (lint, frontend tests, backend tests, build) |

## What is new in v1.2.0

1. **Sign-in and order ownership (improvement 1).** Fictional test customers `ana.demo@example.com` and `ben.demo@example.com` can sign in. Checkout requires sign-in and saves the order owner from the session. **My Orders** lists only your own orders. A guest gets 401, and another customer gets 404 for an order that is not theirs.
2. **Database readiness check (improvement 2).** `GET /api/health/ready` answers 503 when PostgreSQL cannot be reached, instead of a misleading "ok".
3. **AWS deployment files:** `deploy/Caddyfile`, `deploy/shopsmart-api.service`, `deploy/api.env.example`, `deploy/backup-db.sh`, and `deploy/smoke-test.mjs` (automatic hosted checks).
4. Express can listen only on `127.0.0.1` (`HOST`). CORS allows cookies from `FRONTEND_URL` only.

## Database changes

| Migration | What it does | Data kept? |
| --- | --- | --- |
| `0_init` | Product, Order, OrderItem (from v1.1) | n/a |
| `1_add_users_sessions_order_owner` | adds `User`, `Session`, and a nullable `Order.userId` with indexes | **Yes.** Only adds; earlier orders stay with no owner |

On the server, `prisma migrate deploy` runs before each start of the service. `npm run db:seed` is never run there. The first start adds sample products only if the table is empty. Evidence: `release-evidence/aws-migrate-status.txt`.

## Verification summary (hosted)

Full table with expected and observed results: `AWS_VERIFICATION.md`. Automatic results: `release-evidence/aws-smoke-test.json` and `release-evidence/aws-smoke-after-reboot.json`.

| Check | Result |
| --- | --- |
| Frontend and direct route | ____ |
| API connection (HTTPS, same origin, health + ready) | ____ |
| Catalog and cart | ____ |
| Account and order ownership | ____ |
| Simulated checkout (valid / invalid / excess) | ____ |
| Assistant (grounded answer / no match / fallback) | ____ |
| Restart and logs | ____ |
| Secrets and credits | ____ |

## Known limitations

- **Single EC2 host:** if the instance is down, the whole site is down. No automatic database backups; I run `deploy/backup-db.sh` by hand before changes.
- **Demo accounts only:** there is no self-registration, no password reset and no admin role. Both demo customers share one demo password, created on the server and never committed.
- **Free host name:** `sslip.io` depends on an outside DNS service and Let's Encrypt limits. If the instance is stopped and started, its IP and therefore the site address change.
- The **cart** is still kept in memory: a full page refresh empties it. Navigating to sign-in inside the app keeps it.
- The **Render** staging from v1.1 does not support sign-in (cross-site cookie). See the note in `DEPLOY_RENDER.md`.
- Free/credit plan: resources are removed after grading (`DEPLOY_AWS.md` Step 12; dates in `AWS_RESOURCE_REGISTER.md`).

## Previous release

v1.1.0-rc.1 (Render staging, 11 Nov 2026): `RELEASE_NOTE_v1.1.0.md`.
