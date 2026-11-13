import test from 'node:test';
import assert from 'node:assert/strict';
import { assistantQuestionSchema, orderSchema } from '../src/validators/schemas.js';

test('a valid classroom order passes validation', () => {
  const result = orderSchema.safeParse({
    customerName: 'Ana Reyes',
    email: 'ana@example.com',
    address: 'Angeles City, Pampanga',
    items: [{ productId: 1, quantity: 2 }]
  });
  assert.equal(result.success, true);
});

test('duplicate products fail order validation', () => {
  const result = orderSchema.safeParse({
    customerName: 'Ana Reyes',
    email: 'ana@example.com',
    address: 'Angeles City, Pampanga',
    items: [{ productId: 1, quantity: 1 }, { productId: 1, quantity: 1 }]
  });
  assert.equal(result.success, false);
});

test('an oversized assistant question fails validation', () => {
  assert.equal(assistantQuestionSchema.safeParse({ question: 'x'.repeat(301) }).success, false);
});

test('sign-in email is compared in lower case', async () => {
  const { signInSchema } = await import('../src/validators/schemas.js');
  const result = signInSchema.safeParse({ email: 'Ana.Demo@Example.com', password: 'x' });
  assert.equal(result.success, true);
  assert.equal(result.data.email, 'ana.demo@example.com');
});

test('sign-in refuses an empty or huge password', async () => {
  const { signInSchema } = await import('../src/validators/schemas.js');
  assert.equal(signInSchema.safeParse({ email: 'ana.demo@example.com', password: '' }).success, false);
  assert.equal(signInSchema.safeParse({ email: 'ana.demo@example.com', password: 'x'.repeat(201) }).success, false);
});
