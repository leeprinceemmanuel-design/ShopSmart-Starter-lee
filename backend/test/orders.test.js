// File: backend/test/orders.test.js
// The ownership rule used by GET /api/orders/:id.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ownedOrderWhere } from '../src/routes/orders.js';

test('an order is looked up by its id AND its owner together', () => {
  assert.deepEqual(ownedOrderWhere(12, 3), { id: 12, userId: 3 });
});

