// File: backend/src/auth/password.js
// Hashes and checks passwords with scrypt, which is built into Node.js (no extra package).
// We never store the password itself, only "scrypt$<cost>$<salt>$<hash>".
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;
const COST = 16384; // how much work one guess takes; higher = slower to brute-force
const BLOCK_SIZE = 8;
const PARALLEL = 1;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16); // a new random salt per user, so equal passwords get different hashes
  const hash = await scrypt(String(password), salt, KEY_LENGTH, { N: COST, r: BLOCK_SIZE, p: PARALLEL });
  return `scrypt$${COST}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored ?? '').split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false;
  const cost = Number(parts[1]);
  // Refuse odd cost values so a damaged row cannot make the server do huge work.
  if (!Number.isInteger(cost) || cost < 1024 || cost > 65536) return false;
  const salt = Buffer.from(parts[2], 'base64');
  const expected = Buffer.from(parts[3], 'base64');
  if (salt.length === 0 || expected.length !== KEY_LENGTH) return false;
  const actual = await scrypt(String(password), salt, KEY_LENGTH, { N: cost, r: BLOCK_SIZE, p: PARALLEL });
  // timingSafeEqual takes the same time whether the first or last byte differs.
  return crypto.timingSafeEqual(actual, expected);
}

// Used when the email does not exist, so "wrong email" takes as long as "wrong password"
// and an attacker cannot tell which emails have accounts.
let dummyHashPromise;
export function dummyPasswordHash() {
  dummyHashPromise ??= hashPassword(crypto.randomBytes(16).toString('hex'));
  return dummyHashPromise;
}
