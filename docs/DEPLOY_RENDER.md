# Deploying ShopSmart to Render (private staging)

Platform approved by the instructor: **Render** (render.com), free plan.
Three Render services, created in this order:

| # | Render service | Name to use | What it runs |
| --- | --- | --- | --- |
| 1 | PostgreSQL (Free) | `shopsmart-db` | The database |
| 2 | Web Service (Free) | `shopsmart-api` | Express API |
| 3 | Static Site (Free) | `shopsmart-web` | React frontend (`frontend/dist`) |

Free plan facts to know (check render.com/docs/free, they can change):
- The free database **expires 30 days after it is created**. Grade within that time.
- The free API **sleeps after 15 minutes** without visits. The first visit after that takes about a minute.
- Free web services have **no shell and no pre-deploy command**, so migrations and the first seed run in the start command (`npm run render:start`), see below.

## 1. Database: `shopsmart-db`

New → Postgres. Name `shopsmart-db`, Region: Singapore (closest to the Philippines), Instance type: Free. Create.
When it is ready, copy the **Internal Database URL** (used by the API, it never leaves Render). Keep it secret.

## 2. API: `shopsmart-api`

New → Web Service → connect GitHub repo `ShopSmart-Starter-lee`, branch `main`.

| Setting | Value |
| --- | --- |
| Region | Singapore (same as the database) |
| Root Directory | _(leave empty)_ |
| Runtime | Node |
| Build Command | `npm ci --include=dev && npm run db:generate` |
| Start Command | `npm run render:start --workspace backend` |
| Instance type | Free |
| Health Check Path | `/api/health` (Advanced section) |

`render:start` runs `prisma migrate deploy` (applies committed migrations, never resets), then `seed-if-empty.js` (adds the 6 sample products **only if the Product table is empty**, never deletes), then starts the server.

Environment variables (Environment tab):

| Key | Value | Secret? |
| --- | --- | --- |
| `DATABASE_URL` | Internal Database URL from step 1 | Yes |
| `FRONTEND_URL` | `https://shopsmart-web.onrender.com` (fill in after step 3; exact, no trailing slash) | No |
| `NODE_ENV` | `production` | No |
| `NODE_VERSION` | `22` | No |
| `TRUST_PROXY` | `1` | No |
| `GEMINI_API_KEY` | your Gemini key (optional; without it the assistant uses the catalog fallback) | Yes |
| `GEMINI_MODEL` | same as `backend/.env` | No |
| `GEMINI_TIMEOUT_MS` | `8000` | No |

Do not set `PORT`; Render sets it and the server already reads it.
Check: `https://shopsmart-api.onrender.com/api/health` shows `{"status":"ok"}` and `/api/products` lists 6 products.

## 3. Frontend: `shopsmart-web`

New → Static Site → same repo, branch `main`.

| Setting | Value |
| --- | --- |
| Build Command | `npm ci --include=dev && npm run build --workspace frontend` |
| Publish Directory | `frontend/dist` |
| Environment variable | `VITE_API_URL` = `https://shopsmart-api.onrender.com/api` (public, goes into the bundle) |
| Redirects/Rewrites | Source `/*` → Destination `/index.html` → Action **Rewrite** (so `/cart` works when opened directly) |

Then go back to `shopsmart-api` → Environment and set `FRONTEND_URL` to the static site's exact URL. Saving restarts the API.

Use the real URLs Render gives you; if a name is taken, Render adds letters to it.

## 4. Staging smoke test

Repeat the table in `DEPLOYMENT_PLAN.md` ("Staging smoke test") with the real URLs and record date, URLs and results in `RELEASE_NOTE.md`.

## Privacy

- No sign-in exists, so the site is reachable by anyone with the link: share the links only with the instructor and team, and suspend or delete the services after grading.
- The checkout page shows "Class demo only: please use a made-up name, email and address."
- Only fictional data in demos. Never paste the database URL or Gemini key in chat, screenshots or the repository.
