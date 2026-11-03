import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGeminiRequest, buildProductFacts, redactPrivateText, requestDraft } from '../src/services/aiProvider.js';

const product = { id: 12, name: 'Compact Mechanical Keyboard', description: 'Hot-swappable compact keyboard.', category: 'Accessories', price: { valueOf: () => '1850.00' }, stock: 8, active: true, createdAt: 'x', costPrice: 999 };
const env = { GEMINI_API_KEY: 'test-secret-key', GEMINI_MODEL: 'test-model', GEMINI_BASE_URL: 'https://provider.test/v1' };
const replyWith = (text) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });

async function reasonFor(fetchImpl, useEnv = env) {
  try {
    await requestDraft('keyboard', [product], { fetchImpl, env: useEnv });
    return 'passed';
  } catch (error) {
    assert.doesNotMatch(`${error.message} ${error.stack}`, /test-secret-key/);
    return error.reason;
  }
}

test('only public product fields go to the provider, with price as a number', () => {
  assert.deepEqual(buildProductFacts([product]), [{ id: 12, name: 'Compact Mechanical Keyboard', description: 'Hot-swappable compact keyboard.', category: 'Accessories', price: 1850, stock: 8 }]);
});

test('private details typed by the customer are removed from the prompt', () => {
  assert.equal(redactPrivateText('email ana@example.com or call 0917 123 4567 about a mouse'), 'email [removed] or call [removed] about a mouse');
  const body = JSON.stringify(buildGeminiRequest('my email is ana@example.com', [product]));
  assert.doesNotMatch(body, /ana@example/);
});

test('budget numbers stay in the question', () => assert.equal(redactPrivateText('keyboard below ₱2,000'), 'keyboard below ₱2,000'));

test('the key is sent in a header, not in the URL or body', async () => {
  let call;
  const text = await requestDraft('keyboard', [product], {
    env,
    fetchImpl: async (url, options) => { call = { url, options }; return replyWith('{"answer":"ok","productIds":[12]}'); }
  });
  assert.equal(text, '{"answer":"ok","productIds":[12]}');
  assert.equal(call.url, 'https://provider.test/v1/models/test-model:generateContent');
  assert.equal(call.options.headers['x-goog-api-key'], 'test-secret-key');
  assert.doesNotMatch(call.url + call.options.body, /test-secret-key/);
});

test('provider problems become reason codes', async () => {
  assert.equal(await reasonFor(async () => new Response('slow down', { status: 429 })), 'ai_rate_limited');
  assert.equal(await reasonFor(async () => new Response('broken', { status: 500 })), 'ai_unavailable');
  assert.equal(await reasonFor(async () => new Response('bad key', { status: 403 })), 'ai_unavailable');
  assert.equal(await reasonFor(async () => { throw new TypeError('fetch failed'); }), 'ai_unavailable');
  assert.equal(await reasonFor(async () => new Response('<html>', { status: 200 })), 'ai_invalid_format');
  assert.equal(await reasonFor(async () => new Response('{"candidates":[]}', { status: 200 })), 'ai_invalid_format');
  assert.equal(await reasonFor(async () => replyWith('anything'), {}), 'ai_not_configured');
});

test('a slow provider is stopped by the time limit', async () => {
  // A real request keeps Node running while it waits. This timer does the same job in the test.
  const keepAlive = setTimeout(() => {}, 1000);
  const neverAnswers = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason));
  });
  assert.equal(await reasonFor(neverAnswers, { ...env, GEMINI_TIMEOUT_MS: '20' }), 'ai_timeout');
  clearTimeout(keepAlive);
});
