# ShopSmart Test Record – Quality and Deployment Challenge

| Item | Value |
| --- | --- |
| Date | 11 November 2026 (Asia/Manila) |
| Starting commit | `9f838f8` (main, after PR #4 grounded assistant) |
| Release candidate branch | `feature/release-candidate-qa` |
| Machine | Windows 11, Node.js v24.13.0, npm 11.6.2, PostgreSQL 18 (service `postgresql-x64-18`), Prisma 6.19.3 |
| Test data | Fictional only: "Juan Dela Test", juan.test@example.com, "123 Sample Street, Test City"; "Maria Sample", maria.sample@example.com |
| Team | Lee, Prince Emmanuel C.; John Micheal Agustin (recorder); Jerry Jr Busa |

Evidence files are in `docs/release-evidence/`. Screenshots start with `UI-` (before fixes), `FIX-` (after fixes) or `RC-` (release smoke test). Logs end in `-log.txt`, `.txt` or `.json`.

## How the tests were run

1. Baseline: `npm run check` and `npx prisma migrate status` from the project root before any change. Log: `baseline-BEFORE-FIXES-log.txt`.
2. API cases: a test script called every route with fixed inputs and wrote expected and observed results to JSON (`api-tests-baseline.json` before fixes, `api-tests-after-fix.json` after fixes). It only uses the public API, never the database directly.
3. Browser cases: the customer journey was clicked through in a browser. The page text and screenshot were captured after each action.
4. Failure cases: the API was stopped for 75 seconds (API outage), then restarted with `GEMINI_TIMEOUT_MS=1` set for that process only (AI provider outage). `backend/.env` was not edited.

**Test-environment note (not an app defect):** the in-app test browser blocks a page on port 5173 from calling port 3000 (`net::ERR_BLOCKED_BY_CLIENT`). So the browser cases ran on a QA copy of the **same frontend source** served on port 5174, which forwards `/api` to the API on port 3000. The QA config (`.qa-local/vite.qa.config.mjs`) is local only and not committed. CORS for the real setup (5173 → 3000) was checked by API case SEC-01. The short smoke test was then repeated by hand in Chrome on the real http://localhost:5173 (see "Smoke test in Chrome on port 5173" below).

## Activity 1 – Baseline

| Check | Observed result |
| --- | --- |
| `npm run check` | Passed (exit 0). Frontend lint OK, backend lint OK, frontend 5/5 tests, backend 27/27 tests, Vite build OK (JS bundle 274.28 kB). |
| `GET /api/health` | `200 {"status":"ok"}` |
| `prisma migrate status` | Connected to `shopsmart` on localhost:5432. **"No migration found in prisma/migrations"**: the tables exist, but no migration files are committed (became defect D3). |

### Feature inventory

| Feature | Status |
| --- | --- |
| Product list, product details, stock labels | Present |
| Search box (name or description), category filter, sort | Present (filtering happens in the browser) |
| Cart: add, + / − buttons, quantity box, remove, stock limit | Present |
| Cart survives a page refresh | **Absent**. The cart is kept in memory only (team design). |
| Itemized checkout review and simulated order | Present |
| Product assistant with catalog sources | Present |
| **Live AI** | **Present.** Google Gemini, key kept on the server only; answers are checked against the catalog, with a rule-based fallback. |
| **Authentication / roles** | **Absent.** No sign-in; no route lists or reads orders. |
| Health endpoint | Present (`/api/health`, does not check the database) |

## Activity 2 – Customer journey (browser)

### TC-01 Browse

- **Starting state:** API and frontend running, catalog has 6 products.
- **Action:** open the home page.
- **Expected:** 6 product cards with price and stock label, no error.
- **Observed:** 6 cards: Wireless Mouse ₱650.00, Compact Mechanical Keyboard ₱1,850.00, USB-C Study Lamp ₱900.00, 1080p Webcam ₱1,450.00, Laptop Stand ₱1,200.00, USB Headset ₱1,350.00. Evidence: `UI-01-home-products-loaded.jpg`.
- **Decision:** Pass.

### TC-02 Search

- **Starting state:** home page loaded.
- **Action and data:** type `keyboard`, then `privacy`, then `drone` in "Search products".
- **Expected:** keyboard shows only the keyboard; privacy shows the webcam (the word is only in its description); drone shows a no-results message.
- **Observed:** `keyboard` → Compact Mechanical Keyboard only. `privacy` → 1080p Webcam only. `drone` → "No products match your filters." Evidence: `UI-02a-search-keyboard.jpg`, `UI-02b-search-no-results.jpg`.
- **Decision:** Pass. (The API's own `?search=` did **not** match descriptions: see API-04 and D2.)

### TC-03 Cart

- **Starting state:** empty cart. Stock: mouse 9, keyboard 8.
- **Action:** add mouse ×1 and keyboard ×2, then open Cart through the nav link.

| Step | Before | After | Expected | Result |
| --- | --- | --- | --- | --- |
| Add mouse ×1, keyboard ×2 | empty | Items 3, Total ₱4,350 (₱650 + ₱3,700) | ₱4,350 | Pass |
| + on mouse | mouse 1 | mouse 2, line ₱1,300; Items 4, Total ₱5,000 | ₱5,000 | Pass |
| − on keyboard | keyboard 2 | keyboard 1, line ₱1,850; Items 3, Total ₱3,150 | ₱3,150 | Pass |
| Type 8 in keyboard box (stock 8) | keyboard 1 | keyboard 8, line ₱14,800; Items 10, Total ₱16,100; "Stock limit reached (8 available)."; + button off | ₱16,100, + off | Pass |
| Type 9 in keyboard box | keyboard 8 | Quantity stays 8; red message "Only 8 unit(s) are available." | refused | Pass |
| Remove mouse | 2 lines | Only keyboard left | line removed | Pass |
| Open `/cart` by typing the URL (full page load) | 3 items | "Your cart is empty" | Team design keeps the cart in memory | Limitation L1 |

Evidence: `UI-03-cart-stock-limit-totals.jpg`.

Side observation: after + or −, the green "added to cart" banner disappears and the list moves up. During testing this made one click land on **Remove** instead of **−**. Low impact, recorded as limitation L3.

### TC-04 Checkout – invalid details refused

- **Starting state:** cart has mouse ×2 and keyboard ×8.
- **Action and data:** name `Juan Dela Test`, email `juan.test@example` (no ending such as .com, which the browser accepts but the server does not), address `123 Sample Street, Test City`, then Place simulated order.
- **Expected:** order refused, no order created, message tells the customer what to fix.
- **Observed:** `422 INVALID_ORDER`; page shows only "Check the customer and cart information." The message does **not** say the email is the problem. No order was created (the next accepted order got the next number, #6, after #5). Evidence: `UI-04-checkout-rejected-email-generic-message.jpg`.
- **Decision:** Fail (message not useful) → defect D5. Retest after fix: "Check the customer and cart information. Please check: email address." Evidence: `FIX-05-checkout-names-the-field.jpg`. **Pass after fix.**

### TC-05 Checkout – valid fictional order

- **Starting state:** cart has keyboard ×1 (₱1,850). Keyboard stock 7.
- **Action:** fictional name, `juan.test@example.com`, fictional address, Place simulated order.
- **Expected:** one order, total ₱1,850, cart emptied, stock 7 → 6.
- **Observed:** "Your simulated order number is #6. Total: ₱1,850.00". Cart (0). API afterwards: keyboard stock 6. Evidence: `UI-05-checkout-order-confirmed.jpg`.
- **Decision:** Pass.

### TC-06 Stock – stock changes while the item is in the cart

- **Starting state:** cart has keyboard ×8 (all 8 in stock) and mouse ×2.
- **Action:** another fictional customer (Maria Sample) buys 1 keyboard through the API → order #5, stock 8 → 7. Then the first customer places their order (keyboard ×8).
- **Expected:** order refused with a stock message, no order created, cart unchanged, stock stays 7.
- **Observed:** `409 INSUFFICIENT_STOCK`; page shows "Only 7 unit(s) of Compact Mechanical Keyboard are available." Order review still shows Keyboard × 8 and total ₱16,100. API: keyboard stock still 7. Evidence: `UI-06-stock-changed-order-refused.jpg`.
- **Decision:** Pass. Limitation L2: the cart still allows 8 until the customer lowers it, but the server always refuses.

### TC-07 Assistant

| Question | Expected | Observed | Decision |
| --- | --- | --- | --- |
| "Which keyboard is below ₱2,000?" | Keyboard ₱1,850 with a catalog source | AI answer: "The Compact Mechanical Keyboard (₱1,850) is available and in stock." Link "Compact Mechanical Keyboard — ₱1,850". Source: "Catalog product #8". (`UI-07a-assistant-keyboard-with-source.jpg`) | Pass |
| "Do you sell drones?" | Honest no match, no products | "I could not find an in-stock product matching that request in the current ShopSmart catalog." No products, no sources. (`UI-07b-assistant-no-match-honest.jpg`) | Pass |
| "I need a keyboard under 500 pesos" (API) | No match, real price of the closest product | "…The closest match, Compact Mechanical Keyboard, costs ₱1,850." | Pass |
| "Something for video calls?" (API) | Webcam or headset with source | AI answer: 1080p Webcam (₱1450), 1 source | Pass |

### TC-08 Failure – API down

- **Starting state:** API on port 3000 stopped; frontend still open.
- **Action:** load the products page; ask the assistant "Which keyboard is below ₱2,000?".
- **Expected:** loading ends and the customer sees a plain, useful message.
- **Observed before fix:** loading ended, but the messages were raw: products page "Request failed with status 500. Make sure the backend is running." (through the QA proxy) and, in the first baseline on port 5173, "Failed to fetch Make sure the backend is running."; assistant "Request failed with status 500." Evidence: `UI-08a-api-down-products-raw-message.jpg`, `UI-08b-api-down-assistant-raw-message.jpg`.
- **Decision:** Fail (message) → defect D4.
- **Retest after fix:** both pages: "The ShopSmart server had a problem. Please try again in a moment." When no response arrives at all, the message is "ShopSmart could not be reached. Check that the server is running, then try again." (unit test). Evidence: `FIX-04a-…`, `FIX-04b-…`. **Pass after fix.**

### TC-09 Failure – AI provider down

- **Starting state:** API restarted with `GEMINI_TIMEOUT_MS=1` for that process only.
- **Action:** ask "Which keyboard is below ₱2,000?".
- **Expected:** no endless loading; a fallback answer built from the catalog, marked as a fallback.
- **Observed:** notice "The AI helper could not be used for this answer, so it comes straight from the catalog." then "…these in-stock products fit your request: Compact Mechanical Keyboard (₱1,850)." with source #8. Server log: `[assistant] using rule-based answer, reason=ai_timeout` (no question text, no key). Evidence: `UI-09-ai-timeout-controlled-fallback.jpg`.
- **Decision:** Pass (before and after the fixes).

### Authentication cases

The team did not add sign-in or roles, so guest/owner/other-customer cases do not apply. Checked directly: `GET /api/orders` and `GET /api/orders/1` both return `404 ROUTE_NOT_FOUND`, so no customer record can be read through the API. `POST /api/orders` is open to anyone who can reach the API (see L4).

## API cases (expected vs observed)

Run before fixes (`api-tests-baseline.json`) and after fixes (`api-tests-after-fix.json`).

| ID | Request | Expected | Before fixes | After fixes |
| --- | --- | --- | --- | --- |
| API-01 | GET /api/health | 200 `{"status":"ok"}` | Pass | Pass |
| API-02 | GET /api/products | 200, active products | Pass (6) | Pass (6) |
| API-03 | ?search=keyboard | keyboard only | Pass | Pass |
| API-04 | ?search=privacy | webcam (same rule as search box) | **Fail**: empty list | Pass |
| API-05 | ?search=zzzz-not-a-product | empty list | Pass | Pass |
| API-06 | GET /api/products/abc | 400 INVALID_PRODUCT_ID | Pass | Pass |
| API-07 | GET /api/products/999999 | 404 PRODUCT_NOT_FOUND | Pass | Pass |
| API-08 | order with bad email + short address | 422 INVALID_ORDER | Pass (fields email, address) | Pass |
| API-09 | order with empty items | 422 | Pass | Pass |
| API-10 | same product twice | 422 | Pass | Pass |
| API-11 | unknown product | 422 PRODUCT_UNAVAILABLE | Pass | Pass |
| API-12 | quantity above stock | 409, stock unchanged | Pass (mouse 9 → 9) | Pass (mouse 7 → 7) |
| API-13 | broken JSON body | 400 INVALID_JSON, no parser internals | **Fail**: 400 `INTERNAL_ERROR` "Expected double-quoted property name in JSON at position 31…" | Pass: 400 INVALID_JSON "The request body is not valid JSON." |
| API-14 | valid order 2 × mouse | 201, total = 2 × price, stock −2 | Pass: #7, ₱1,300, 9 → 7 | Pass: #8, ₱1,300, 7 → 5 |
| AI-01 to AI-04 | assistant questions | see TC-07 | Pass | Pass |
| AI-05 | question "hi" | 422 INVALID_QUESTION | Pass | Pass |
| API-16 | GET /api/nope | 404 ROUTE_NOT_FOUND | Pass | Pass |
| SEC-01 | CORS | only http://localhost:5173 allowed | Pass | Pass |

## Activity 3 – Defects, fixes and repeat tests

Priority follows the challenge: data exposure and broken deployment first.

### D1 – Customer details written to the server log on a malformed checkout request (High, privacy)

- **Starting state:** API running (`npm run dev`).
- **Action:** `POST /api/orders` with the body `{"customerName": "Broken JSON",` (cut off).
- **Actual:** response `400 INTERNAL_ERROR` with the JSON parser's own message. The server log printed `[undefined] SyntaxError …` and the full raw body (`body: '{"customerName": …'`). A real checkout body holds name, email and address, so those would end up in logs. The traceId was `undefined` because the request ID was set after the JSON parser.
- **Expected:** 400 with a fixed message, a traceId, and no request body in the log.
- **Cause:** the error handler logged the whole error object (body-parser attaches the raw body to it), and the request-ID middleware ran after `express.json()`.
- **Fix (commit `e17b50c`):** request ID set first; new `backend/src/middleware/errorHandler.js` returns `400 INVALID_JSON` for parse errors and logs only `[traceId] status code` (plus the stack trace for 500 errors).
- **Test added:** `backend/test/app.test.js` sends a broken checkout body with fictional personal details and asserts: 400 INVALID_JSON, traceId present, details absent from log and response.
- **Repeat test:** live request returned `{"code":"INVALID_JSON","message":"The request body is not valid JSON.","traceId":"0ed0e83a-…"}`; the log line was `[0ed0e83a-…] 400 INVALID_JSON`; the email appeared 0 times in the log. API-13 passes.

### D2 – API search ignores descriptions (Medium)

- **Repro:** `GET /api/products?search=privacy` → empty list, while the search box finds the 1080p Webcam.
- **Fix (`39dabcb`):** `buildProductWhere()` in `routes/products.js` matches name OR description, case-insensitive. Test: `backend/test/products.test.js`. API-04 passes.

### D3 – No committed database migrations (High, blocks deployment)

- **Repro:** `npx prisma migrate status` → "No migration found in prisma/migrations". `prisma migrate deploy` on a new staging database would create **no tables**, so the first product request would fail.
- **Fix (`452660e`):**
  1. Drift check: `prisma migrate diff --from-url <local DB> --to-schema-datamodel prisma/schema.prisma --exit-code` → "No difference detected", exit 0.
  2. Generated `backend/prisma/migrations/0_init/migration.sql` from `schema.prisma` (`migrate diff --from-empty … --script`) and added `migration_lock.toml`.
  3. Marked it as already applied on the local database: `prisma migrate resolve --applied 0_init` (this only records the migration; no table or row was changed).
  4. Added `npm run db:deploy` (`prisma migrate deploy`) and `npm run db:status`.
- **Repeat test:** `migrate status` → "1 migration found in prisma/migrations. Database schema is up to date!" Final database check (ids, totals and dates only, no customer details): 6 products, 8 orders, 8 order items. Orders created before this session (#2 from 24 Sep and #3 from 3 Nov) are still there, so nothing was reseeded or reset. Logs: `migrations-log.txt`, `db-counts-final.txt`, `db-orders-final.txt`, `db-status-final-log.txt`.

### D4 – Raw error text when the API is down (Medium)

- **Repro:** see TC-08.
- **Fix (`e407e7f`):** `frontend/src/services/api.js` turns "no response", "timed out" and "500 without a message" into plain messages; pages show that message. Test: `frontend/src/services/api.test.js` (5 cases). TC-08 passes after fix.

### D5 – Rejected checkout does not say which field is wrong (Low)

- **Repro:** see TC-04.
- **Fix (`e407e7f`):** the API already returns `details.fieldErrors`; `api.js` adds "Please check: email address." using the form's own field names. Test in `api.test.js`. TC-04 passes after fix.

### Smoke test in Chrome on port 5173 (after fixes)

| Step | Expected | Observed | Evidence | Decision |
| --- | --- | --- | --- | --- |
| Open http://localhost:5173 with DevTools → Network, cache disabled | Products request goes to port 3000 and succeeds | `http://localhost:3000/api/products`, 200 OK, `Access-Control-Allow-Origin: http://localhost:5173`; 6 cards with live stock (mouse 5, keyboard 6, lamp 9) | `RC-chrome-5173-products-network.png` | Pass |
| Add USB-C Study Lamp, press + | Qty 2, total ₱1,800 | Qty 2, Items 2, Total ₱1,800 | (seen on screen) | Pass |
| Checkout with fictional details | One order, ₱1,800.00, cart emptied | Order #10, Total ₱1,800.00, Cart (0) | `RC-chrome-5173-checkout.png` | Pass |
| Assistant: "Which keyboard is below ₱2,000?" | Keyboard ₱1,850 with source | AI answer, Compact Mechanical Keyboard ₱1,850, source #8 | `RC-chrome-5173-assistant.png` | Pass |
| http://localhost:3000/api/health | `{"status":"ok"}` | `{"status":"ok"}` | `RC-chrome-5173-health.png` | Pass |

### Staging smoke test on Render (11 Nov 2026)

The same journey was repeated on the hosted site (https://shopsmart-web-bxov.onrender.com → https://shopsmart-api-chlw.onrender.com). All checks passed: 6 products, cart total ₱1,800, order #1, assistant answer with source #2, health `{"status":"ok"}`. Details and evidence: `RELEASE_NOTE.md`, section "Staging smoke test" (`STG-*.png`).

### Final check after fixes

`npm run check` → exit 0: lint OK (both), frontend **10/10** tests (5 new), backend **31/31** tests (4 new), build OK. Log: `check-after-fix-log.txt`. No test was deleted or weakened.

## Unresolved issues and safe temporary limits

| ID | Issue | Impact | Safe temporary limitation |
| --- | --- | --- | --- |
| L1 | Cart is lost on page refresh or when a URL is typed | Shopper must re-add items | Navigate with the app's links; documented in release note |
| L2 | After a 409 stock refusal the cart still allows the old quantity | Shopper sees a clear error and must lower the quantity | Server always rechecks stock inside a transaction, so overselling cannot happen |
| L3 | Banner disappearing after +/− shifts the cart layout | Possible misclick on Remove | Low risk; fix later by reserving the banner's space |
| L4 | No sign-in or roles; `POST /api/orders` is public | Anyone with the URL can create simulated orders | Local or **private** staging only, fictional data only |
| L5 | `/api/health` does not check the database | Health can say "ok" while the database is down | Smoke test always includes `GET /api/products` |
| L6 | Express is not yet told it runs behind a hosting proxy (`trust proxy`) | On a host, all users may share one assistant rate limit | Set `app.set('trust proxy', 1)` when the platform is approved; not testable locally |
| L7 | Dev only: on Windows, `node --watch` restarted the API once when another program read the backend files, cutting one in-flight request (ECONNRESET) | Only in `npm run dev` | Staging uses `npm start` (no watch) |
| L8 | Prisma prints "package.json#prisma is deprecated" | None on Prisma 6 | Move seed config to `prisma.config.ts` before upgrading to Prisma 7 |

## Team record

| Member | Test they ran | Contribution | Issue they can explain |
| --- | --- | --- | --- |
| Lee, Prince Emmanuel C. | TC-06 Stock: put all 8 keyboards in the cart, let another fictional customer buy 1, then checked out and saw the 409 "Only 7 unit(s)…" refusal with the cart and stock unchanged. Also ran the final Chrome smoke test on port 5173 (order #10). | Ran the baseline `npm run check`; fixed D1 (request body in logs) and D3 (baseline migration `0_init`); made the branch and PR #5. | D1: why a broken checkout body put the customer's name, email and address in the server log, and how logging only `[traceId] status code` fixes it. |
| John Micheal Agustin | TC-04 invalid checkout (email `juan.test@example` refused with 422) and TC-08 API down (stopped the API and checked that every page stops loading and shows a message). | Recorded the expected and observed results in this test record; fixed D4/D5 in `frontend/src/services/api.js` with 5 tests in `api.test.js`. | D4: why the page said "Failed to fetch" when the server was down, and how `api.js` now turns that into "ShopSmart could not be reached…". |
| Jerry Jr Busa | TC-07 and TC-09 assistant: keyboard question with source #8, honest "could not find" for drones, and the AI timeout fallback with its notice. Also API-04 search for "privacy". | Wrote the deployment plan and diagram (`DEPLOYMENT_PLAN.md`); fixed D2 (API search now checks name or description). | D3: why `prisma migrate deploy` would create no tables without committed migrations, and why `db:seed` must never run on staging after the first order. |
