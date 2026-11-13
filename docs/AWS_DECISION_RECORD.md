# Decision record: how ShopSmart runs on AWS

| | |
| --- | --- |
| Status | Accepted and deployed, 13 Nov 2026 (`https://13-238-143-254.sslip.io`) |
| Author | Lee, Prince Emmanuel C. (individual deployment) |
| Release | v1.2.0 |
| Region | **ap-southeast-2, Asia Pacific (Sydney).** Planned: ap-southeast-1 (Singapore), the closest Region to the Philippines. The account's Free plan project is fixed to Sydney and shows no Region selector, so Sydney was used. The demo is a little slower from the Philippines, which is acceptable for a class demo. |

## What we had to decide

The guide offers two layouts: **(A) one EC2 host**, or **(B) Amplify + EC2 + RDS**. The deployment must give a working customer journey over HTTPS: products, cart, sign-in, a simulated order, owner-only order records and the assistant. It must also stay inside the AWS plan's credits, and I must be able to explain and clean up every part alone.

## Decision

**Layout A: one EC2 instance** (Ubuntu 24.04) running three parts:

| Part | Runs as | Public? |
| --- | --- | --- |
| Caddy web server | `caddy` service, ports 443 and 80 | **Yes**: the only public entry point. Gets the HTTPS certificate, serves `frontend/dist`, sends `/api/*` to Express |
| Express API | `shopsmart-api` systemd service, `127.0.0.1:3000` | No: only Caddy on the same machine can reach it |
| PostgreSQL 16 | `postgresql` service, `127.0.0.1:5432` | No: localhost only; the browser never connects to it |

The security group allows only 443 and 80 from anywhere, and 22 (SSH) from my own IP.

## Why A and not B

1. **One HTTPS address for both site and API.** The browser loads the page and calls `/api` on the same origin. So:
   - no mixed-content block (an HTTPS page calling an HTTP API),
   - no CORS setup between two hosts,
   - the sign-in cookie can be `HttpOnly; Secure; SameSite=Lax`.

   With B, Amplify (`*.amplifyapp.com`) and the EC2 API are on different sites. The API would also need its own HTTPS certificate, and the cookie would need `SameSite=None`, which weakens CSRF protection.
2. **Fewer resources using credits.** One instance and its disk, compared with an Amplify app, an EC2 instance, an RDS instance, RDS storage and backups.
3. **Short demo with fictional data.** The guide allows PostgreSQL on the same EC2 instance for a brief demo.
4. **I can explain every connection.** There are three hops (browser → Caddy → Express → PostgreSQL), and each one is on the diagram.

## What I accept by choosing A (the trade-offs)

| Risk | What I do about it |
| --- | --- |
| Single point of failure: if the instance stops, everything stops | Acceptable for a graded demo. `systemd` restarts Express after a crash and starts everything at boot (tested in the restart check). |
| I maintain the OS, Node, database, backups and HTTPS | `apt upgrade` before the demo; Caddy renews the certificate itself; `deploy/backup-db.sh` before any migration. |
| Terminating the instance deletes the database | That is intended after grading (fictional data). Before then, I never terminate; I back up first. |
| No custom domain | Uses a free `sslip.io` name made from the IP. Plan B is `nip.io`, Plan C is CloudFront, Plan D is the local release (see `DEPLOY_AWS.md` Step 8). |
| A stop/start changes the public IP | Only reboot during the demo window. If the IP changes, update the Caddyfile and `FRONTEND_URL`; no rebuild needed. |

## Settings: public or secret

| Setting | Where it lives | Public or secret |
| --- | --- | --- |
| `VITE_API_URL=/api` | Build command (bundled into the browser JavaScript) | Public, and contains no host |
| `DATABASE_URL` | `/etc/shopsmart/api.env` (owner root, group shopsmart, mode 640) | **Secret** |
| `GEMINI_API_KEY` (optional) | same file | **Secret** |
| `HOST`, `PORT`, `NODE_ENV`, `FRONTEND_URL`, `TRUST_PROXY`, `COOKIE_*` | same file | Not secret |
| Demo customer password | Printed once by `create-demo-customers.js`; kept privately | **Secret** |

## Migrations and data

- `ExecStartPre` in the service runs `prisma migrate deploy`. It applies only committed migrations and never resets or deletes rows.
- Migration `1_add_users_sessions_order_owner` only adds tables and a nullable `Order.userId`. Old orders are kept, with no owner.
- The first start runs `seed-if-empty.js`, which adds the six sample products only when the Product table is empty. `npm run db:seed` (which deletes orders) is **never** run on the server.

## AWS identity vs ShopSmart identity

**IAM / AWS sign-in** decides who may change AWS resources. Only the account owner has access, with MFA on root.
**ShopSmart sign-in** decides which customer is asking. The Express API then checks order ownership on every request. Giving someone AWS access does not let them read a customer's orders through the app, and the reverse is also true.

## Options rejected

- **B: Amplify + EC2 + RDS.** It shows each service more clearly, but it costs more credits and needs two HTTPS endpoints plus cross-site cookies. Better for a longer-lived release.
- **Express on a public port 3000.** Rejected: plain HTTP, and it would expose the development port.
- **Local-only release.** Kept as Plan D, if HTTPS cannot be obtained.
