import test from 'node:test';
import assert from 'node:assert/strict';
import { AiProviderError } from '../src/services/aiProvider.js';
import { answerQuestion, buildAssistantResponse, getSearchTerms, parseBudget, rankProducts, verifyDraft } from '../src/services/assistant.js';

const products = [
  { id: 1, name: 'Keyboard', category: 'Accessories', description: 'Mechanical keyboard', price: 1800, stock: 2 },
  { id: 2, name: 'Mouse', category: 'Accessories', description: 'Wireless mouse', price: 600, stock: 3 }
];

// Same shape as the seeded catalog. price is an object here, like a Prisma Decimal.
const decimal = (value) => ({ valueOf: () => String(value), toString: () => String(value) });
const catalog = [
  { id: 11, name: 'Wireless Mouse', description: 'Quiet wireless mouse with adjustable sensitivity and USB receiver.', category: 'Accessories', price: decimal(650), stock: 12 },
  { id: 12, name: 'Compact Mechanical Keyboard', description: 'Hot-swappable compact keyboard with tactile switches.', category: 'Accessories', price: decimal(1850), stock: 8 },
  { id: 13, name: 'USB-C Study Lamp', description: 'Adjustable desk lamp with three brightness levels.', category: 'Study', price: decimal(900), stock: 10 },
  { id: 14, name: '1080p Webcam', description: 'Full HD webcam with privacy cover and built-in microphone.', category: 'Video', price: decimal(1450), stock: 6 },
  { id: 15, name: 'Laptop Stand', description: 'Foldable aluminum stand for laptops up to 16 inches.', category: 'Study', price: decimal(1200), stock: 9 },
  { id: 16, name: 'USB Headset', description: 'Over-ear headset with noise-reducing boom microphone.', category: 'Audio', price: decimal(1350), stock: 7 }
];
const keyboardQuestion = 'Which keyboard is below ₱2,000?';
const keyboardOnly = [catalog[1]];
const quietLogger = { warn() {} };
const goodDraft = JSON.stringify({ answer: 'The Compact Mechanical Keyboard (₱1,850) is in stock and is below your ₱2,000 budget.', productIds: [12] });

function failureReason(text, selected = keyboardOnly, question = keyboardQuestion) {
  try {
    verifyDraft(text, selected, catalog, question);
    return 'passed';
  } catch (error) {
    return error.reason;
  }
}

// Starter tests, kept unchanged.
test('parseBudget extracts a peso budget', () => assert.equal(parseBudget('below ₱2,000'), 2000));
test('rankProducts respects the budget', () => assert.deepEqual(rankProducts(products, 'mouse below 700').map((p) => p.id), [2]));
test('assistant response contains traceable sources', () => assert.equal(buildAssistantResponse(products, 'keyboard').sources[0].id, 1));

test('parseBudget does not read product details as a budget', () => {
  assert.equal(parseBudget('Do you have a 1080p webcam?'), null);
  assert.equal(parseBudget('stand for laptops up to 16 inches'), null);
  assert.equal(parseBudget('headset under 2k'), 2000);
  assert.equal(parseBudget('lamp for PHP 1,000'), 1000);
  assert.equal(parseBudget('keyboard above ₱1,000'), null);
});

test('getSearchTerms keeps product words and drops filler words', () => {
  assert.deepEqual(getSearchTerms(keyboardQuestion), ['keyboard']);
  assert.deepEqual(getSearchTerms('Do you sell gaming keyboards?'), ['gaming', 'keyboard']);
});

test('rankProducts finds the keyboard and nothing unrelated', () => {
  assert.deepEqual(rankProducts(catalog, keyboardQuestion).map((p) => p.id), [12]);
});

test('rankProducts leaves out out-of-stock and inactive products', () => {
  const changed = [{ ...catalog[1], stock: 0 }, { ...catalog[0], active: false }, catalog[2]];
  assert.deepEqual(rankProducts(changed, 'keyboard'), []);
  assert.deepEqual(rankProducts(changed, 'mouse'), []);
});

test('no match: the provider is not called and nothing is invented', async () => {
  let calls = 0;
  const result = await answerQuestion(catalog, 'Do you sell drones?', { draftProvider: async () => { calls += 1; return goodDraft; } });
  assert.equal(calls, 0);
  assert.deepEqual(result.recommendedProducts, []);
  assert.deepEqual(result.sources, []);
  assert.match(result.answer, /could not find/);
});

test('out of stock: the product is named as unavailable but not recommended', async () => {
  const changed = catalog.map((p) => (p.id === 12 ? { ...p, stock: 0 } : p));
  const result = await answerQuestion(changed, keyboardQuestion, { draftProvider: async () => goodDraft, logger: quietLogger });
  assert.deepEqual(result.recommendedProducts, []);
  assert.match(result.answer, /out of stock/);
});

test('over budget: says the real price and recommends nothing', async () => {
  const result = await answerQuestion(catalog, 'keyboard below ₱1,000', { draftProvider: async () => goodDraft });
  assert.deepEqual(result.recommendedProducts, []);
  assert.match(result.answer, /₱1,850/);
});

test('a checked draft is returned with database prices and matching sources', async () => {
  const result = await answerQuestion(catalog, keyboardQuestion, { draftProvider: async () => goodDraft });
  assert.equal(result.answerSource, 'ai');
  assert.equal(result.answer, JSON.parse(goodDraft).answer);
  assert.deepEqual(result.recommendedProducts, [{ id: 12, name: 'Compact Mechanical Keyboard', price: 1850, category: 'Accessories' }]);
  assert.deepEqual(result.sources, [{ type: 'product', id: 12, name: 'Compact Mechanical Keyboard' }]);
});

test('the provider sees only the selected products', async () => {
  let seen;
  await answerQuestion(catalog, keyboardQuestion, { draftProvider: async (_question, selected) => { seen = selected; return goodDraft; } });
  assert.deepEqual(seen.map((p) => p.id), [12]);
});

test('verifyDraft rejects drafts that break the facts', () => {
  const draft = (answer, productIds = [12]) => JSON.stringify({ answer, productIds });
  const name = 'Compact Mechanical Keyboard';
  assert.equal(failureReason(goodDraft), 'passed');
  assert.equal(failureReason('not json at all'), 'ai_invalid_format');
  assert.equal(failureReason(JSON.stringify({ answer: 'Hi' })), 'ai_invalid_format');
  assert.equal(failureReason(draft(`${name} (₱1,850)`, [999])), 'ai_unknown_product');
  assert.equal(failureReason(draft('Buy this one.')), 'ai_missing_product_name');
  assert.equal(failureReason(draft(`${name} (₱1,850) pairs well with the Wireless Mouse.`)), 'ai_unknown_product');
  assert.equal(failureReason(draft(`${name} costs ₱1,500.`)), 'ai_unsupported_price');
  assert.equal(failureReason(draft(`${name} is 1500 pesos.`)), 'ai_unsupported_price');
  assert.equal(failureReason(draft(`${name} (₱1,850) has 104 keys.`)), 'ai_unsupported_number');
  assert.equal(failureReason(draft(`${name} (₱1,850) is out of stock.`)), 'ai_unsupported_availability');
  assert.equal(failureReason(draft(`${name} (₱1,850) has RGB lights.`)), 'ai_unsupported_claim');
  assert.equal(failureReason(draft(`${name} (₱1,850) comes with free shipping.`)), 'ai_unsupported_claim');
  assert.equal(failureReason(draft(`${name} (₱1,850), see https://example.com`)), 'ai_unsupported_claim');
});

test('verifyDraft rejects a real price placed on the wrong product', () => {
  const both = [catalog[0], catalog[1]];
  const question = 'wireless mouse or keyboard below ₱2,000';
  const swapped = JSON.stringify({ answer: 'Wireless Mouse (₱1,850) and Compact Mechanical Keyboard (₱650).', productIds: [11, 12] });
  const correct = JSON.stringify({ answer: 'Wireless Mouse (₱650) and Compact Mechanical Keyboard (₱1,850).', productIds: [11, 12] });
  assert.equal(failureReason(swapped, both, question), 'ai_unsupported_price');
  assert.equal(failureReason(correct, both, question), 'passed');
});

test('verifyDraft allows a detail that is in the product facts', () => {
  const lamp = JSON.stringify({ answer: 'The Wireless Mouse (₱650) is wireless and quiet.', productIds: [11] });
  assert.equal(failureReason(lamp, [catalog[0]], 'quiet mouse'), 'passed');
});

test('a bad draft is replaced by the rule-based answer', async () => {
  const warnings = [];
  const invented = JSON.stringify({ answer: 'The Compact Mechanical Keyboard costs ₱99.', productIds: [12] });
  const result = await answerQuestion(catalog, keyboardQuestion, { draftProvider: async () => invented, logger: { warn: (line) => warnings.push(line) } });
  assert.equal(result.answerSource, 'rules');
  assert.ok(result.notice);
  assert.match(result.answer, /Compact Mechanical Keyboard \(₱1,850\)/);
  assert.doesNotMatch(result.answer, /₱99/);
  assert.equal(result.sources[0].id, 12);
  assert.match(warnings[0], /reason=ai_unsupported_price/);
});

test('each provider failure ends in the rule-based answer', async () => {
  for (const reason of ['ai_timeout', 'ai_rate_limited', 'ai_unavailable', 'ai_invalid_format', 'ai_not_configured']) {
    const result = await answerQuestion(catalog, keyboardQuestion, {
      draftProvider: async () => { throw new AiProviderError(reason); },
      logger: quietLogger
    });
    assert.equal(result.answerSource, 'rules', reason);
    assert.equal(result.recommendedProducts[0].id, 12, reason);
  }
});

test('the log line holds a reason code, not the question or provider text', async () => {
  const warnings = [];
  await answerQuestion(catalog, `${keyboardQuestion} my email is ana@example.com`, {
    draftProvider: async () => { throw new Error('secret provider text'); },
    logger: { warn: (line) => warnings.push(line) }
  });
  assert.equal(warnings.length, 1);
  assert.doesNotMatch(warnings[0], /ana@example|secret provider/);
});
