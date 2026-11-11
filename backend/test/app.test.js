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
