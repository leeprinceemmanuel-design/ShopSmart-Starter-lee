# ShopSmart Release Note: v1.1.0-rc.1 (local release candidate)

| | |
| --- | --- |
| Version and date | v1.1.0-rc.1, 11 November 2026 |
| Code submitted | Branch `feature/release-candidate-qa`, based on `main` at `9f838f8`. Fix commits: `e17b50c`, `39dabcb`, `452660e`, `e407e7f`. _(If you submit a ZIP, write the final commit hash here: `git rev-parse --short HEAD`.)_ |
| Deployment status | **Local release candidate only.** No hosting or cloud database is approved yet, so live staging was **not** done. The staging plan is in `DEPLOYMENT_PLAN.md`. |
| Final check | `npm run check` passed: lint OK, frontend 10/10 tests, backend 31/31 tests, build OK (`release-evidence/check-after-fix.log`) |

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
- `trust proxy` must be set when the API is hosted (see deployment plan).
- Browser UI tests ran on a QA copy of the same frontend on port 5174 because the test browser blocks calls from port 5173 to 3000. The team should repeat the smoke test in Chrome on port 5173 and add that screenshot.

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

## Team record

| Member | Test they ran | Contribution | Issue they can explain |
| --- | --- | --- | --- |
| _(name)_ | | | |
| _(name)_ | | | |
| _(name)_ | | | |
| _(name)_ | | | |
