// File: backend/test/products.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProductWhere } from '../src/routes/products.js';

test('no search text returns every active product', () => {
  assert.deepEqual(buildProductWhere(''), { active: true });
  assert.deepEqual(buildProductWhere('   '), { active: true });
  assert.deepEqual(buildProductWhere(undefined), { active: true });
});

test('search text matches the name OR the description, like the search box', () => {
  const where = buildProductWhere('  privacy ');
  assert.equal(where.active, true);
  assert.deepEqual(where.OR, [
    { name: { contains: 'privacy', mode: 'insensitive' } },
    { description: { contains: 'privacy', mode: 'insensitive' } }
  ]);
});
