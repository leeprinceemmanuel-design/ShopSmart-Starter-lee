// File: backend/test/auth-helpers.test.js
// Password hashing and cookie helpers. Built-in Node.js only, no database needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dummyPasswordHash, hashPassword, verifyPassword } from '../src/auth/password.js';
import { clearSessionCookieOptions, hashSessionToken, newSessionToken, readCookie, sessionCookieOptions } from '../src/auth/session.js';

test('a password hash is not the password and checks correctly', async () => {
  const hash = await hashPassword('demo-password-123');
  assert.match(hash, /^scrypt\$16384\$/);
  assert.ok(!hash.includes('demo-password-123'));
  assert.equal(await verifyPassword('demo-password-123', hash), true);
  assert.equal(await verifyPassword('demo-password-124', hash), false);
});

test('the same password gets a different hash each time (random salt)', async () => {
  assert.notEqual(await hashPassword('same-password-1'), await hashPassword('same-password-1'));
});

test('damaged or empty stored hashes never match', async () => {
  for (const stored of [undefined, '', 'plain-text', 'scrypt$1$abc$def', 'bcrypt$x$y$z', 'scrypt$999999999$AAAA$AAAA']) {
    assert.equal(await verifyPassword('anything', stored), false, `stored value ${stored}`);
  }
});

test('the dummy hash is a valid hash that no normal password matches', async () => {
  const hash = await dummyPasswordHash();
  assert.match(hash, /^scrypt\$/);
  assert.equal(await verifyPassword('', hash), false);
});

test('session tokens are long, random, and only their hash is stored', () => {
  const token = newSessionToken();
  assert.ok(token.length >= 40);
  assert.notEqual(token, newSessionToken());
  assert.match(hashSessionToken(token), /^[0-9a-f]{64}$/);
  assert.equal(hashSessionToken(token), hashSessionToken(token));
  assert.notEqual(hashSessionToken(token), token);
});

test('readCookie finds the session cookie among others', () => {
  assert.equal(readCookie('a=1; shopsmart_session=abc123; b=2', 'shopsmart_session'), 'abc123');
  assert.equal(readCookie('shopsmart_session_old=zzz', 'shopsmart_session'), null);
  assert.equal(readCookie(undefined, 'shopsmart_session'), null);
  assert.equal(readCookie('shopsmart_session=%E0%A4%A', 'shopsmart_session'), null); // broken encoding
});

test('cookie is HttpOnly and SameSite=Lax; Secure in production', () => {
  const local = sessionCookieOptions({ NODE_ENV: 'development' });
  assert.deepEqual({ ...local, maxAge: undefined }, { httpOnly: true, secure: false, sameSite: 'lax', path: '/api', maxAge: undefined });
  assert.equal(sessionCookieOptions({ NODE_ENV: 'production' }).secure, true);
  assert.equal(sessionCookieOptions({ NODE_ENV: 'production', COOKIE_SECURE: 'false' }).secure, false);
  // SameSite=None is only allowed by browsers together with Secure.
  assert.equal(sessionCookieOptions({ COOKIE_SAMESITE: 'none', COOKIE_SECURE: 'false' }).secure, true);
  assert.equal(sessionCookieOptions({ COOKIE_SAMESITE: 'weird' }).sameSite, 'lax');
  assert.equal('maxAge' in clearSessionCookieOptions({}), false);
});
