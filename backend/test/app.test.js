// File: backend/test/app.test.js
// Starts the real Express app on a free port. These requests fail before any
// database call, so no PostgreSQL connection is needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { toSafeError } from '../src/middleware/errorHandler.js';

async function withServer(run) {
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try { return await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

// Collects console.error output during a test instead of printing it.
async function captureErrors(run) {
  const lines = [];
  const original = console.error;
  console.error = (...args) => lines.push(args.map(String).join(' '));
  try { await run(); } finally { console.error = original; }
  return lines.join('\n');
}

test('a broken checkout body gets 400 INVALID_JSON and its contents are not logged or echoed', async () => {
  const brokenBody = '{"customerName":"Juan Dela Test","email":"juan.test@example.com","address":"123 Sample Street",';
  let status;
  let body;
  const logged = await captureErrors(() => withServer(async (url) => {
    const response = await fetch(`${url}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: brokenBody });
    status = response.status;
    body = await response.json();
  }));

  assert.equal(status, 400);
  assert.equal(body.error.code, 'INVALID_JSON');
  assert.match(body.error.traceId, /^[0-9a-f-]{36}$/); // was "undefined" before the fix
  for (const privateText of ['juan.test@example.com', 'Juan Dela Test', '123 Sample Street']) {
    assert.ok(!logged.includes(privateText), `log must not contain ${privateText}`);
    assert.ok(!JSON.stringify(body).includes(privateText), `response must not contain ${privateText}`);
  }
  assert.ok(logged.includes(body.error.traceId), 'log line keeps the traceId so the request can still be found');
});

test('our own 4xx errors keep their customer message; unknown errors stay generic', () => {
  const stockError = Object.assign(new Error('Stock changed while placing the order.'), { status: 409, code: 'STOCK_CHANGED' });
  assert.deepEqual(toSafeError(stockError), { status: 409, code: 'STOCK_CHANGED', message: 'Stock changed while placing the order.' });
  const crash = new Error('connect ECONNREFUSED 127.0.0.1:5432');
  assert.deepEqual(toSafeError(crash), { status: 500, code: 'INTERNAL_ERROR', message: 'The server could not complete the request.' });
});

test('trust proxy is off by default and turned on by TRUST_PROXY (for hosts like Render)', () => {
  const saved = process.env.TRUST_PROXY;
  try {
    delete process.env.TRUST_PROXY;
    assert.equal(createApp().get('trust proxy'), false);
    process.env.TRUST_PROXY = '1';
    assert.equal(createApp().get('trust proxy'), 1);
  } finally {
    if (saved === undefined) delete process.env.TRUST_PROXY; else process.env.TRUST_PROXY = saved;
  }
});

// ---- Release 1.2: sign-in, order ownership and database readiness ----
// A guest sends no cookie, so these requests are refused before any database call.

async function withAppServer(app, run) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try { return await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('a guest gets 401 for private order routes and for /api/auth/me', async () => {
  await withServer(async (url) => {
    for (const [method, path] of [['GET', '/api/orders'], ['GET', '/api/orders/1'], ['GET', '/api/auth/me']]) {
      const response = await fetch(`${url}${path}`, { method });
      assert.equal(response.status, 401, `${method} ${path}`);
      assert.equal((await response.json()).error.code, 'SIGN_IN_REQUIRED');
    }
  });
});

test('a guest cannot place an order, even with a valid body', async () => {
  await withServer(async (url) => {
    const response = await fetch(`${url}/api/orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName: 'Juan Dela Test', email: 'juan.test@example.com', address: '123 Sample Street, Test City', items: [{ productId: 1, quantity: 1 }] })
    });
    assert.equal(response.status, 401);
  });
});

test('sign-in with a malformed body is refused with 422 and no cookie', async () => {
  await withServer(async (url) => {
    const response = await fetch(`${url}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'not-an-email', password: '' }) });
    assert.equal(response.status, 422);
    assert.equal(response.headers.get('set-cookie'), null);
  });
});

test('CORS allows credentials only for FRONTEND_URL', async () => {
  await withServer(async (url) => {
    const allowed = await fetch(`${url}/api/health`, { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');
    const other = await fetch(`${url}/api/health`, { headers: { Origin: 'https://evil.example' } });
    assert.notEqual(other.headers.get('access-control-allow-origin'), 'https://evil.example');
  });
});

test('/api/health/ready is 200 when the database answers', async () => {
  await withAppServer(createApp({ checkDatabase: async () => {} }), async (url) => {
    const response = await fetch(`${url}/api/health/ready`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', database: 'ok' });
  });
});

test('/api/health/ready is 503 when the database is down, and logs no connection string', async () => {
  const secretUrl = 'postgresql://shopsmart_user:VerySecret@127.0.0.1:5432/shopsmart';
  let status;
  let body;
  const logged = await captureErrors(() => withAppServer(
    createApp({ checkDatabase: async () => { throw Object.assign(new Error(`Can't reach database server at ${secretUrl}`), { code: 'P1001' }); } }),
    async (url) => {
      const response = await fetch(`${url}/api/health/ready`);
      status = response.status;
      body = await response.json();
    }
  ));
  assert.equal(status, 503);
  assert.deepEqual(body, { status: 'error', database: 'unreachable' });
  assert.ok(logged.includes('P1001'), 'the log names the error code so it can be traced');
  assert.ok(!logged.includes('VerySecret') && !JSON.stringify(body).includes('VerySecret'));
});

test('/api/health still answers without touching the database (liveness)', async () => {
  await withAppServer(createApp({ checkDatabase: async () => { throw new Error('should not be called'); } }), async (url) => {
    const response = await fetch(`${url}/api/health`);
    assert.equal(response.status, 200);
  });
});
