# ShopSmart Release Note: v1.1.0-rc.1 (release candidate on private Render staging)

| | |
| --- | --- |
| Version and date | v1.1.0-rc.1, 11 November 2026 |
| Code submitted | Branch `feature/release-candidate-qa`, based on `main` at `9f838f8`. Fix commits: `e17b50c`, `39dabcb`, `452660e`, `e407e7f`. _(If you submit a ZIP, write the final commit hash here: `git rev-parse --short HEAD`.)_ |
| Deployment status | **Private staging on Render** (approved by the instructor), deployed 11 Nov 2026. Frontend: https://shopsmart-web-bxov.onrender.com · API: https://shopsmart-api-chlw.onrender.com/api/health · Free Render PostgreSQL in Singapore (expires 11 Dec 2026). Settings: `DEPLOY_RENDER.md`. |
| Final check | `npm run check` passed: lint OK, frontend 10/10 tests, backend 31/31 tests, build OK (`release-evidence/check-after-fix-log.txt`) |

## Working features (verified on 11 Nov 2026)

- Product list and details with stock labels; search box (name or description), category filter and sort.
- `GET /api/products?search=` now uses the same rule as the search box (name or description).
- Cart: add, + / −, type a quantity, remove, stock limit message; totals checked at every step.
- Simulated checkout: valid fictional details create one order; wrong details are refused and the message names the field (for example "Please check: email address").
- Stock: the server refuses an order above current stock (409) and saves nothing, even if stock changed while the item was in the cart.
- Product assistant: Gemini answers checked against the live catalog, with catalog source links; honest "could not find" when nothing matches; rule-based fallback with a notice when the AI provider fails or times out.
- Failures: when the API is down, every page stops loading and shows a plain message instead of "Failed to fetch".
- Privacy: a malformed request body is no longer written to the server log.
- Database: migration `0_init` is committed; `npm run db:deploy` and `npm run db:status` added. Existing local data was kept (no reseed).

## Known limitations

- **No authentication or roles.** Anyone who can reach the API can place a simulated order. Use locally or on private staging with fictional data only.
- **AI:** needs `GEMINI_API_KEY` in `backend/.env`. Without it, or when Gemini is down, answers come from the rule-based catalog search (still correct, less natural).
- **Cart** is not saved: a page refresh or typing a URL empties it.
- After a stock refusal the cart still allows the old quantity; the shopper must lower it (the server never oversells).
- `/api/health` does not check the database.
- Hosted on Render's free plan: the API sleeps after 15 minutes idle (first visit about 1 minute), and the free database is deleted 30 days after creation (11 Dec 2026).
- Most browser UI tests ran on a QA copy of the same frontend on port 5174, because the automated test browser blocks calls from port 5173 to 3000. The final smoke test was then repeated by hand in Chrome on the real port 5173 and passed (see the last row of the smoke test table).

Full list with impact and safe workarounds: `TEST_RECORD.md`, section "Unresolved issues".

## Local startup

Follow `README.md` from "Set up the ShopSmart project". Extra steps for this release:

1. **New database:** `npm run db:migrate` now applies the committed migration `0_init`, then `npm run db:seed` once.
2. **Database created before this release:** do not run `db:migrate` first. From `backend/` run `npx prisma migrate resolve --applied 0_init` once, then check `npm run db:status` from the project root.
3. `npm run check`, then `npm run dev`; open http://localhost:5173 and http://localhost:3000/api/health.
4. Optional AI: add `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_TIMEOUT_MS` to `backend/.env` (see `backend/.env.example`). Never commit `.env`.

## Local smoke test result (release candidate)

| Check | Result |
| --- | --- |
| Health | `GET /api/health` → `200 {"status":"ok"}` |
| Products | 6 products listed |
| Cart | totals correct after add / + / − / type / remove |
| Simulated checkout | Order #9, ₱900.00, fictional customer (`RC-smoke-checkout-order-9.jpg`) |
| Assistant | Keyboard ₱1,850 with source #8; AI timeout gives a fallback with a notice |
| Data kept | 6 products, 8 orders; orders from 24 Sep and 3 Nov still present; migration status up to date |
| Secrets | No `.env` tracked; key and DB password not in Git history or in `frontend/dist` |
| Privacy | Only fictional names and `@example.com` emails used |
| Chrome on http://localhost:5173 (11 Nov 2026, 17:11–17:22) | Pass: `GET http://localhost:3000/api/products` → 200 OK with `Access-Control-Allow-Origin: http://localhost:5173`; cart 2 × lamp = ₱1,800; order #10, ₱1,800.00; assistant answered Compact Mechanical Keyboard ₱1,850 with source #8; health `{"status":"ok"}` (`RC-chrome-5173-*.png`) |

## Staging smoke test (Render, 11 Nov 2026, 18:27–18:31 GMT+8)

| Check | Pass condition | Result | Evidence |
| --- | --- | --- | --- |
| Health | `https://shopsmart-api-chlw.onrender.com/api/health` → `{"status":"ok"}` | Pass | `STG-05-render-health.png` |
| Migrations + first data | Render log: "All migrations have been successfully applied." and "Database was empty. Added 6 sample products." | Pass | Render deploy log, 18:09 |
| Products | 6 products from the Render database (mouse 12, keyboard 8, lamp 10 …) | Pass | `STG-01-render-products.png` |
| Frontend reaches intended API | Products load on `shopsmart-web-bxov.onrender.com` only after `FRONTEND_URL` was set on the API (CORS) | Pass | `STG-01-render-products.png` |
| Direct link | `/cart` opened directly returns the app, not "Not Found" (rewrite `/*` → `/index.html`) | Pass | checked 18:22 |
| Cart + checkout | 2 × USB-C Study Lamp = ₱1,800; demo notice shown; order **#1**, ₱1,800.00; cart emptied | Pass | `STG-02-render-checkout-demo-notice.png`, `STG-03-render-order-1.png` |
| Assistant | Compact Mechanical Keyboard ₱1,850 with source "Catalog product #2" (AI answer, no fallback notice) | Pass | `STG-04-render-assistant.png` |
| Secrets | `DATABASE_URL` and `GEMINI_API_KEY` only in Render's environment settings, hidden in screenshots; not in repo or bundle | Pass | Render Environment page |
| Privacy | Only fictional names and `@example.com` emails; checkout shows "Class demo only" notice | Pass | `STG-02-…` |

**Access for the instructor:** open https://shopsmart-web-bxov.onrender.com. The free API sleeps after 15 minutes without visits, so the first page can take about a minute to load; refresh once if the products do not appear. Use only made-up details at checkout. The site has no sign-in, so the links are shared only with the instructor and the team, and the services will be suspended after grading.

## Team record

| Member | Test they ran | Contribution | Issue they can explain |
| --- | --- | --- | --- |
| Lee, Prince Emmanuel C. | TC-06 Stock: put all 8 keyboards in the cart, let another fictional customer buy 1, then checked out and saw the 409 "Only 7 unit(s)…" refusal with the cart and stock unchanged. Also ran the final Chrome smoke test on port 5173 (order #10). | Ran the baseline `npm run check`; fixed D1 (request body in logs) and D3 (baseline migration `0_init`); made the branch and PR #5. | D1: why a broken checkout body put the customer's name, email and address in the server log, and how logging only `[traceId] status code` fixes it. |
| John Micheal Agustin | TC-04 invalid checkout (email `juan.test@example` refused with 422) and TC-08 API down (stopped the API and checked that every page stops loading and shows a message). | Recorded the expected and observed results in this test record; fixed D4/D5 in `frontend/src/services/api.js` with 5 tests in `api.test.js`. | D4: why the page said "Failed to fetch" when the server was down, and how `api.js` now turns that into "ShopSmart could not be reached…". |
| Jerry Jr Busa | TC-07 and TC-09 assistant: keyboard question with source #8, honest "could not find" for drones, and the AI timeout fallback with its notice. Also API-04 search for "privacy". | Wrote the deployment plan and diagram (`DEPLOYMENT_PLAN.md`); fixed D2 (API search now checks name or description). | D3: why `prisma migrate deploy` would create no tables without committed migrations, and why `db:seed` must never run on staging after the first order. |
