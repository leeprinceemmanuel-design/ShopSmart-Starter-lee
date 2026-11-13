#!/usr/bin/env node
// File: deploy/smoke-test.mjs
// Runs the guide's hosted checks against a REAL address and prints PASS/FAIL for each.
// Needs only Node.js 20+ (built-in fetch). No npm packages.
//
// Usage (from the project root, on your own PC or on the server):
//   PowerShell:  $env:DEMO_PASSWORD="the-demo-password"; node deploy/smoke-test.mjs https://13-229-45-67.sslip.io
//   bash:        DEMO_PASSWORD='the-demo-password' node deploy/smoke-test.mjs https://13-229-45-67.sslip.io
// Local dev:     node deploy/smoke-test.mjs http://localhost:5173 http://localhost:3000/api
// Save results:  add  --out docs/release-evidence/aws-smoke-test.json
//
// It places ONE simulated order with fictional data for ana.demo@example.com.
// It never prints the password or the session cookie.

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outFile = outIndex >= 0 ? args.splice(outIndex, 2)[1] : null;
const SITE = (args[0] || '').replace(/\/$/, '');
const API = (args[1] || `${SITE}/api`).replace(/\/$/, '');
const PASSWORD = process.env.DEMO_PASSWORD;
if (!SITE || !PASSWORD) {
  console.error('Usage: DEMO_PASSWORD=... node deploy/smoke-test.mjs <site-url> [api-url] [--out file.json]');
  process.exit(2);
}

const results = [];
function record(id, check, expected, passed, observed) {
  results.push({ id, check, expected, observed, result: passed ? 'PASS' : 'FAIL' });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${id.padEnd(6)} ${check}  ->  ${observed}`);
}

async function call(path, { method = 'GET', body, cookie, origin, base = API } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  if (origin) headers.Origin = origin;
  const started = Date.now();
  const response = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual', signal: AbortSignal.timeout(30000) });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* HTML or empty */ }
  return { status: response.status, headers: response.headers, text, json, ms: Date.now() - started };
}

// Keeps only "name=value" from Set-Cookie, so we can send it back like a browser.
function sessionCookieFrom(response) {
  const raw = response.headers.getSetCookie?.() ?? [];
  const line = raw.find((value) => value.startsWith('shopsmart_session='));
  return line ? { pair: line.split(';')[0], flags: line.split(';').slice(1).map((flag) => flag.trim().toLowerCase()) } : null;
}

async function signIn(email, password) {
  const response = await call('/auth/login', { method: 'POST', body: { email, password } });
  return { response, cookie: sessionCookieFrom(response) };
}

async function main() {
  console.log(`ShopSmart smoke test  site=${SITE}  api=${API}  at ${new Date().toISOString()}\n`);

  // 1. Frontend and direct route
  const home = await call('/', { base: SITE });
  record('FE-01', 'Home page loads', '200 with the React root element', home.status === 200 && home.text.includes('id="root"'), `${home.status}`);
  const deep = await call('/orders/123', { base: SITE });
  record('FE-02', 'Direct visit to a React route (/orders/123)', '200 index.html, not a 404 page', deep.status === 200 && deep.text.includes('id="root"'), `${deep.status}`);

  // 2. API connection and health
  const health = await call('/health');
  record('API-01', '/api/health (process alive)', '200 {"status":"ok"}', health.status === 200 && health.json?.status === 'ok', `${health.status} ${health.text.slice(0, 60)}`);
  const ready = await call('/health/ready');
  record('API-02', '/api/health/ready (database reachable)', '200 database ok', ready.status === 200 && ready.json?.database === 'ok', `${ready.status} ${ready.text.slice(0, 60)}`);
  if (SITE.startsWith('https://')) {
    let httpStatus = 'no answer';
    try { httpStatus = String((await call('/', { base: SITE.replace('https://', 'http://') })).status); } catch { /* port 80 closed is also fine */ }
    record('API-03', 'Plain HTTP is not served as the app', 'redirect (308/301) to HTTPS', ['301', '302', '307', '308', 'no answer'].includes(httpStatus), httpStatus);
  }
  const cors = await call('/products', { origin: 'https://evil.example' });
  record('API-04', 'Other websites are not allowed by CORS', 'no Access-Control-Allow-Origin for https://evil.example', cors.headers.get('access-control-allow-origin') !== 'https://evil.example', `ACAO=${cors.headers.get('access-control-allow-origin') ?? 'none'}`);

  // 3. Catalog
  const productsResponse = await call('/products');
  const products = productsResponse.json?.products ?? [];
  record('CAT-01', 'Products come from PostgreSQL', '200 with at least 1 product', productsResponse.status === 200 && products.length > 0, `${productsResponse.status}, ${products.length} products`);

  // 4. Account and order ownership
  const guestList = await call('/orders');
  record('AUTH-01', 'Guest asks for order list', '401 SIGN_IN_REQUIRED', guestList.status === 401, `${guestList.status}`);
  const wrong = await signIn('ana.demo@example.com', `${PASSWORD}-wrong`);
  record('AUTH-02', 'Wrong password', '401, no session cookie', wrong.response.status === 401 && !wrong.cookie, `${wrong.response.status}`);
  const ana = await signIn('ana.demo@example.com', PASSWORD);
  const flags = ana.cookie?.flags ?? [];
  const httpsSite = SITE.startsWith('https://');
  const cookieOk = flags.includes('httponly') && flags.includes('samesite=lax') && (!httpsSite || flags.includes('secure'));
  record('AUTH-03', 'Ana signs in', `200 + cookie HttpOnly, SameSite=Lax${httpsSite ? ', Secure' : ''}`, ana.response.status === 200 && cookieOk, `${ana.response.status} flags=[${flags.filter((f) => !f.startsWith('expires') && !f.startsWith('max-age')).join(', ')}]`);
  if (!ana.cookie) throw new Error('Ana could not sign in; check DEMO_PASSWORD and that npm run users:demo was run on the server.');

  // 5. Simulated checkout
  const product = products.find((p) => p.stock >= 1);
  const customer = { customerName: 'Ana Demo', email: 'ana.demo@example.com', address: '123 Sample Street, Test City' };
  const zero = await call('/orders', { method: 'POST', cookie: ana.cookie.pair, body: { ...customer, items: [{ productId: product.id, quantity: 0 }] } });
  record('ORD-01', 'Quantity 0 is refused', '422 INVALID_ORDER', zero.status === 422, `${zero.status}`);
  const lowStock = products.find((p) => p.stock >= 1 && p.stock < 20);
  if (lowStock) {
    const excess = await call('/orders', { method: 'POST', cookie: ana.cookie.pair, body: { ...customer, items: [{ productId: lowStock.id, quantity: lowStock.stock + 1 }] } });
    record('ORD-02', `More than stock (${lowStock.stock + 1} x ${lowStock.name})`, '409 INSUFFICIENT_STOCK, nothing saved', excess.status === 409, `${excess.status}`);
  }
  const created = await call('/orders', { method: 'POST', cookie: ana.cookie.pair, body: { ...customer, items: [{ productId: product.id, quantity: 1 }] } });
  const orderId = created.json?.id;
  record('ORD-03', `Valid fictional order (1 x ${product.name})`, '201 with an order number', created.status === 201 && Number.isInteger(orderId), `${created.status} order #${orderId}`);
  const after = await call(`/products/${product.id}`);
  record('ORD-04', 'Stock went down by 1', `${product.stock - 1}`, after.json?.stock === product.stock - 1, `${after.json?.stock}`);

  const own = await call(`/orders/${orderId}`, { cookie: ana.cookie.pair });
  record('AUTH-04', 'Owner (Ana) reads her order', '200', own.status === 200 && own.json?.id === orderId, `${own.status}`);
  const guest = await call(`/orders/${orderId}`);
  record('AUTH-05', 'Guest reads Ana\'s order by direct API request', '401', guest.status === 401, `${guest.status}`);
  const ben = await signIn('ben.demo@example.com', PASSWORD);
  const benRead = await call(`/orders/${orderId}`, { cookie: ben.cookie?.pair });
  record('AUTH-06', 'Another customer (Ben) reads Ana\'s order by direct API request', '404 ORDER_NOT_FOUND', ben.response.status === 200 && benRead.status === 404, `sign-in ${ben.response.status}, read ${benRead.status}`);
  const benList = await call('/orders', { cookie: ben.cookie?.pair });
  const leaked = (benList.json?.orders ?? []).some((order) => order.id === orderId);
  record('AUTH-07', 'Ben\'s order list does not include Ana\'s order', 'not listed', benList.status === 200 && !leaked, `${benList.status}, leaked=${leaked}`);

  // 6. Assistant
  const ask = await call('/assistant/questions', { method: 'POST', body: { question: 'Which keyboard is below ₱2,000?' } });
  const byId = new Map(products.map((p) => [p.id, p]));
  const recommended = ask.json?.recommendedProducts ?? [];
  const grounded = recommended.length > 0 && recommended.every((r) => byId.has(r.id) && byId.get(r.id).price === r.price && r.price < 2000);
  record('AI-01', 'Assistant: keyboard below ₱2,000', 'each recommended product exists with the same price, < ₱2,000', ask.status === 200 && grounded, `${ask.status} source=${ask.json?.answerSource} ${recommended.map((r) => `#${r.id} ₱${r.price}`).join(', ')}${ask.json?.notice ? ' (fallback notice shown)' : ''}`);
  const none = await call('/assistant/questions', { method: 'POST', body: { question: 'Do you sell drones?' } });
  record('AI-02', 'Assistant: product that does not exist', '200, no recommendations', none.status === 200 && (none.json?.recommendedProducts ?? []).length === 0, `${none.status}, ${(none.json?.recommendedProducts ?? []).length} recommended`);

  // 7. Sign-out really ends the session
  const out = await call('/auth/logout', { method: 'POST', cookie: ana.cookie.pair });
  const reuse = await call('/auth/me', { cookie: ana.cookie.pair });
  record('AUTH-08', 'Old cookie after sign-out', 'sign-out 204, then 401', out.status === 204 && reuse.status === 401, `${out.status}, then ${reuse.status}`);
  if (ben.cookie) await call('/auth/logout', { method: 'POST', cookie: ben.cookie.pair });
}

main()
  .catch((error) => { record('RUN', 'Test run finished', 'no crash', false, error.message); })
  .finally(async () => {
    const failed = results.filter((r) => r.result === 'FAIL').length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    if (outFile) {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(outFile, JSON.stringify({ site: SITE, api: API, ranAt: new Date().toISOString(), results }, null, 2));
      console.log(`Saved ${outFile}`);
    }
    process.exitCode = failed ? 1 : 0;
  });
