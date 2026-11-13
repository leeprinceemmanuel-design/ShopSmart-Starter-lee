# Hosted verification record (AWS, v1.2.0)

The **Expected** column was written before any test was run. Fill in **Observed** and **Result** from the real hosted site in a fresh Incognito browser. Keep the exact URL, status code and code version for every check. For a failed check, also save redacted evidence and add a row to "Failed cases".

| | |
| --- | --- |
| Site URL | `https://<SITE_HOST>` = ________________________ |
| API base | `https://<SITE_HOST>/api` (same origin) |
| Code version | tag `v1.2.0`, commit `_______` (`git rev-parse --short HEAD` on the server) |
| Release type | **Hosted** on AWS EC2, ap-southeast-1 (if HTTPS fails: **local**, see Plan D) |
| Tested by / date | Lee, Prince Emmanuel C. / __ Nov 2026, __:__ to __:__ (GMT+8) |
| Automatic run | `aws-smoke-test.json` (after deploy), `aws-smoke-after-reboot.json` (after restart) |

## Guide checks

| # | Check | Expected observation | Smoke ID / how | Observed | Result | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Frontend and direct route | Home page loads with products; typing `https://<SITE_HOST>/cart` and refreshing still shows the app (no 404) | FE-01, FE-02 + browser | | | `AWS-02-home.png`, `AWS-03-direct-route-refresh.png` |
| 2 | API connection | DevTools Network: requests go to `https://<SITE_HOST>/api/...` with no CORS or mixed-content error; `/api/health` → `{"status":"ok"}`; `/api/health/ready` → `{"status":"ok","database":"ok"}`; `http://` redirects to `https://` | API-01…04 + browser | | | `AWS-04-network-https-api.png`, `AWS-05-health-ready.png` |
| 3 | Catalog and cart | Current products appear; search "keyboard" filters; + / − and typed quantity update totals correctly; stock limit message at max | CAT-01 + browser | | | `AWS-06-cart-totals.png` |
| 4 | Account and order | Guest: `/api/orders/<id>` → 401. Ana (owner): 200. Ben (other customer) asking for Ana's order by direct API request → 404, and not in Ben's list | AUTH-01…08 | | | `aws-smoke-test.json`, `AWS-07-my-orders-ana.png`, `AWS-08-ben-denied.png` |
| 5 | Simulated checkout | Signed in as Ana: fictional order saved with an order number, stock drops by the quantity; quantity 0 → 422; more than stock → 409 and nothing saved | ORD-01…04 + browser | | | `AWS-09-order-confirmed.png` |
| 6 | Assistant | "Which keyboard is below ₱2,000?" → Compact Mechanical Keyboard ₱1,850 with a catalog source link that opens the right product; "Do you sell drones?" → honest "could not find"; provider failure → notice that the answer came from the catalog | AI-01, AI-02 + browser | | | `AWS-10-assistant.png`, `AWS-11-assistant-no-match.png` |
| 7 | Restart and logs | After `sudo reboot` the site works again without manual steps; Ana's earlier order is still in My Orders; the API log shows each request's status and has no secrets | rerun smoke + log grep | | | `aws-smoke-after-reboot.json`, `aws-api-log-after-reboot.txt` |
| 8 | Secrets and credits | No `.env`, `.pem` or key in Git (`git ls-files`); bundle grep clean; screenshots blurred; credits still within plan after the demo | Step 5 grep, Billing page | | | `AWS-12-credits-after.png` |

## The two improvements and their retests

The exam's own list of required improvements was not available to me, so I chose the two gaps that the deployment guide itself points out. **To confirm with the instructor.**

### Improvement 1: Sign-in and order ownership

| | |
| --- | --- |
| Problem before | ShopSmart had no sign-in. The guide requires a test customer to sign in and the API to protect private order records. v1.1 had no way to read an order back and no owner on orders. |
| Change | `User` and `Session` tables + migration `1_add_users_sessions_order_owner`; `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`; scrypt password hashes; random session token in an `HttpOnly; Secure; SameSite=Lax` cookie (only its SHA-256 hash is stored); checkout requires sign-in and saves `userId` from the session; `GET /api/orders` and `GET /api/orders/:id` return only the signed-in customer's orders; Sign-in and My Orders pages. |
| Retest (expected) | Guest → 401 · Ana reads own order → 200 · Ben reads Ana's order → 404 · Ben's list excludes it · wrong password → 401, no cookie · old cookie after sign-out → 401 · cookie flags HttpOnly, Secure, SameSite=Lax |
| Retest (observed) | Local `npm run check`: ____ · Hosted smoke AUTH-01…08: ____ |

### Improvement 2: Health check that tests the database

| | |
| --- | --- |
| Problem before | `/api/health` always answered `{"status":"ok"}` even when PostgreSQL was down, so a "green" health check did not prove products or checkout could work (v1.1 known limitation). |
| Change | New `GET /api/health/ready` runs `SELECT 1` with a 3-second limit: 200 `{"status":"ok","database":"ok"}` or 503 `{"status":"error","database":"unreachable"}`; the log names only the error code (e.g. `P1001`), never the connection string. `/api/health` stays a simple "process is alive" check. |
| Retest (expected) | Normal → 200 database ok · with PostgreSQL stopped (`sudo systemctl stop postgresql`) → 503 within about 3 s, while `/api/health` still says ok · log line has a code and no password · after `sudo systemctl start postgresql` → 200 again |
| Retest (observed) | Local tests: ____ · Hosted: normal ____ / DB stopped ____ / DB started ____ |

## Failed cases (fill in if any check fails)

| Check # | Time | URL | Status code | Code version | What happened | First failed connection (from the log) | Fix | Retest result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | |

## Screenshot rules

Blur or crop: AWS account ID, email, `/etc/shopsmart/api.env`, any password, key, cookie value or `DATABASE_URL`. The public IP and `<SITE_HOST>` may be shown, because they are the submitted site URL.
