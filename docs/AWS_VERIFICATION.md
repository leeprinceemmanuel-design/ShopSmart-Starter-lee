# Hosted verification record (AWS, v1.2.0)

The **Expected** column was written before any test was run. **Observed** is from the real hosted site, tested in a fresh Incognito window on 13 Nov 2026.

| | |
| --- | --- |
| Site URL | **https://13-238-143-254.sslip.io** |
| API base | `https://13-238-143-254.sslip.io/api` (same origin as the site) |
| Code version | tag `v1.2.0`, commit **`3fc432f`** (checked with `git rev-parse --short HEAD` on the server) |
| Release type | **Hosted** on AWS EC2 `shopsmart-demo` (t3.micro), Region **ap-southeast-2 (Sydney)** |
| Tested by / date | Lee, Prince Emmanuel C. / 13 Nov 2026, 21:30–22:05 (GMT+8) |
| Automatic runs | `aws-smoke-test.json` (21:40, **21/21**), `aws-smoke-after-reboot.json` (22:03, **21/21**) |
| Local check before release | `npm run check`: lint, frontend tests, **backend 49/49**, build OK; local smoke **20/20** (`local-smoke-test.json`) |

## Guide checks

| # | Check | Expected observation | Observed on the hosted site | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | Frontend and direct route | Home page loads with products; typing `/cart` directly still shows the app (no 404) | Home 200 with 6 products; `/cart` and `/orders/123` typed directly → 200, the app loads (Caddy SPA rewrite) | **Pass** | `AWS-02-home.png`, `AWS-03-direct-route-refresh.png`, smoke FE-01/02 |
| 2 | API connection | Browser calls `https://<site>/api/...` with no CORS or mixed-content error; `/api/health` ok; `/api/health/ready` database ok; `http://` redirects to `https://` | Network: `products` 200 from the same HTTPS origin, no CORS error; `/api/health` `{"status":"ok"}`; `/api/health/ready` `{"status":"ok","database":"ok"}`; `http://` → **308** to HTTPS; CORS allows only `https://13-238-143-254.sslip.io` | **Pass** | `AWS-04-network-https-api.png`, `AWS-05-health-ready.png`, smoke API-01…04 |
| 3 | Catalog and cart | Current products appear; quantity and totals correct | 6 products from PostgreSQL; 2 × USB-C Study Lamp = ₱1,800 | **Pass** | `AWS-06-cart-totals.png`, smoke CAT-01 |
| 4 | Account and order | Guest → 401; owner → 200; another customer by direct API request → 404 and not listed | Guest `/api/orders` and `/api/orders/3` → **401**; Ana → **200**; Ben `/api/orders/3` → **404**, `leaked=false`; in the browser, Ben at `/orders/1` → "This order could not be found in your account."; cookie flags `HttpOnly, Secure, SameSite=Lax`; old cookie after sign-out → 401 | **Pass** | `AWS-07-my-orders-ana.png`, `AWS-08a-ben-orders-empty.png`, `AWS-08b-ben-denied-order-1.png`, smoke AUTH-01…08 |
| 5 | Simulated checkout | Valid fictional order saved; quantity 0 → 422; more than stock → 409, nothing saved | Ana's order #2 ₱1,800.00 confirmed in the browser; smoke: quantity 0 → **422**, 13 × mouse (stock 12) → **409**, valid → **201** order #1, stock 12 → 11 | **Pass** | `AWS-09-order-confirmed.png`, smoke ORD-01…04 |
| 6 | Assistant | Keyboard question → Compact Mechanical Keyboard ₱1,850 with a catalog source; "drones" → honest no-match; provider failure → clear notice | Keyboard ₱1,850 with source "Catalog product #2", price equals the database; "Do you sell drones?" → "could not find", 0 recommended; Gemini answered **HTTP 503** (log: `reason=ai_unavailable status=503`), so the page showed "The AI helper could not be used for this answer, so it comes straight from the catalog." | **Pass** (provider-failure path) | `AWS-10-assistant.png`, `AWS-11-assistant-no-match.png`, smoke AI-01/02, `aws-api-log-after-reboot.txt` |
| 7 | Restart and logs | After `sudo reboot` the site works with no manual steps; earlier orders still there; logs show each request and no secrets | `up 2 min`; services `enabled`; smoke after reboot **21/21**; next order is **#3** and stock went 11 → 10, so orders #1–#2 and stock survived; log lines show method, path, status, time only; `grep` for `postgresql://`, `password=`, `AIza`, `GEMINI_API_KEY` → **OK: no secrets in API log** | **Pass** | `AWS-15-smoke-after-reboot-21-of-21.png`, `aws-smoke-after-reboot.json`, `aws-api-log-after-reboot.txt` |
| 8 | Secrets and credits | No secret in the repository, browser bundle or screenshots; credits within plan | Bundle grep → `OK: bundle is clean`; `/etc/shopsmart/api.env` is `-rw-r----- root shopsmart`; `.env`, `*.pem` and `api.env` are in `.gitignore`; screenshots cropped (no account ID or passwords); credits US$137 before → **US$136.85** after deploying and testing (22:17), amount due **US$0.00**, Free plan until 8 May 2027 | **Pass** | `AWS-01-security-group.png`, `AWS-16-billing-after-deploy.png`, `AWS_RESOURCE_REGISTER.md` |

## The two improvements and their retests

The exam's own list of required improvements was not available to me, so I chose the two gaps that the deployment guide itself points out. **To confirm with the instructor.**

### Improvement 1: Sign-in and order ownership

| | |
| --- | --- |
| Problem before | ShopSmart had no sign-in, but the guide requires a test customer to sign in and the API to protect private order records. v1.1 had no way to read an order back and no owner on orders. |
| Change | `User` and `Session` tables + migration `1_add_users_sessions_order_owner`; `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`; scrypt password hashes; a random session token in an `HttpOnly; Secure; SameSite=Lax` cookie (only its SHA-256 hash is stored); checkout requires sign-in and saves `userId` from the session; `GET /api/orders` and `GET /api/orders/:id` return only the signed-in customer's orders; Sign-in and My Orders pages. |
| Retest (expected) | Guest → 401 · Ana reads her own order → 200 · Ben reads Ana's order → 404 · Ben's list excludes it · wrong password → 401 and no cookie · old cookie after sign-out → 401 · cookie flags HttpOnly, Secure, SameSite=Lax |
| Retest (observed) | **Local:** `npm run check` backend 49/49; browser: Ben at `/orders/11` → "could not be found"; smoke 20/20. **Hosted:** smoke AUTH-01…08 all pass, twice (before and after reboot); browser: Ben at `/orders/1` → "could not be found". **Pass.** |

### Improvement 2: Health check that tests the database

| | |
| --- | --- |
| Problem before | `/api/health` always answered `{"status":"ok"}`, even when PostgreSQL was down, so a "green" health check did not prove products or checkout could work (v1.1 known limitation). |
| Change | New `GET /api/health/ready` runs `SELECT 1` with a 3-second limit: 200 `{"status":"ok","database":"ok"}` or 503 `{"status":"error","database":"unreachable"}`. The log names only the error code, never the connection string. `/api/health` stays a simple "process is alive" check. |
| Retest (expected) | Normal → 200 database ok · PostgreSQL stopped → 503 while `/api/health` still says ok · log line has a code and no password · PostgreSQL started → 200 again |
| Retest (observed, on the EC2 server, 13 Nov 2026 21:59) | Normal → `{"status":"ok","database":"ok"}` **HTTP 200** · `sudo systemctl stop postgresql` → `/ready` `{"status":"error","database":"unreachable"}` **HTTP 503**, `/health` `{"status":"ok"}` **HTTP 200** · log: `health/ready database check failed: P1001` (no password) · `sudo systemctl start postgresql` → **HTTP 200** again. **Pass.** Evidence: `AWS-13-db-down-ready-503.png`. |

## Failed cases and how they were fixed

| # | Time (GMT+8) | Where | What happened | First failed connection / cause (from the log) | Fix | Retest |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | 20:08 | Local PC, `npm run db:migrate` | Prisma wanted to **reset** the local database ("All data will be lost") | The database history had an old migration `20260910114042_initial_schema` that is not in the project. `migrate dev` treats that as drift. | Answered no (nothing lost); backed up with `pg_dump`; checked with `prisma migrate diff` that only the new tables were missing; removed the stray history row; applied with `prisma migrate deploy` | `db:status` → "Database schema is up to date!", old orders kept |
| F2 | 21:31 | EC2, `systemctl reload caddy` | Caddy refused the new configuration, so no HTTPS yet | `open /var/log/caddy/shopsmart-access.log: permission denied`. `sudo caddy validate` had created the log file as root, and Caddy runs as user `caddy`. | `sudo chown -R caddy:caddy /var/log/caddy`, then `systemctl restart caddy`. `DEPLOY_AWS.md` Step 8 corrected (chown after validate). | `active (running)`, "certificate obtained successfully" for `13-238-143-254.sslip.io` |
| F3 | 21:38 | PC → hosted smoke test | AUTH-03 failed, 9/11 | `DEMO_PASSWORD` was set to the placeholder text, not the server password. The server correctly answered 401. | Set the real server demo password | 21/21 at 21:40 |

## Screenshot rules

Account ID, email, `/etc/shopsmart/api.env`, passwords, keys, cookie values and `DATABASE_URL` are never shown. The public IP and the site address are shown, because they are the submitted site URL.
