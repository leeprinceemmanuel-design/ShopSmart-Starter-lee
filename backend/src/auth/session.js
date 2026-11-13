// File: backend/src/auth/session.js
// Small helpers for the sign-in cookie. Built-in Node.js only.
import crypto from 'node:crypto';

export const SESSION_COOKIE = 'shopsmart_session';
export const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours: long enough for a class demo

// A long random value. The browser keeps it in an HttpOnly cookie.
export function newSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

// The database stores only this hash. If someone copies the Session table,
// they still cannot build a working cookie from it.
export function hashSessionToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// Reads one cookie from the raw "Cookie" request header, e.g. "a=1; shopsmart_session=xyz".
export function readCookie(header, name) {
  for (const part of String(header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== name) continue;
    const value = part.slice(index + 1).trim();
    try { return decodeURIComponent(value) || null; } catch { return null; }
  }
  return null;
}

// Cookie settings.
// httpOnly: page JavaScript cannot read the cookie (protects it from XSS).
// secure:   only sent over HTTPS. On by default when NODE_ENV=production.
// sameSite: "lax" means another website cannot make the browser send it with a POST (CSRF protection).
// path:     only sent to /api, not with every image or page request.
export function sessionCookieOptions(env = process.env) {
  const sameSite = ['lax', 'strict', 'none'].includes(env.COOKIE_SAMESITE) ? env.COOKIE_SAMESITE : 'lax';
  const secure = sameSite === 'none' || (env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : env.NODE_ENV === 'production');
  return { httpOnly: true, secure, sameSite, path: '/api', maxAge: SESSION_MAX_AGE_MS };
}

// Same options without maxAge, used to delete the cookie on sign-out.
export function clearSessionCookieOptions(env = process.env) {
  const options = sessionCookieOptions(env);
  delete options.maxAge;
  return options;
}
