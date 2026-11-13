// File: backend/src/middleware/auth.js
// loadUser:    finds who is signed in (or nobody) from the session cookie.
// requireUser: stops the request with 401 when nobody is signed in.
import { prisma } from '../lib/prisma.js';
import { hashSessionToken, readCookie, SESSION_COOKIE } from '../auth/session.js';

export async function loadUser(request, _response, next) {
  request.user = null;
  request.sessionId = null;
  try {
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    if (!token) return next(); // no cookie = guest; no database call needed
    const session = await prisma.session.findUnique({
      where: { id: hashSessionToken(token) },
      include: { user: { select: { id: true, name: true, email: true } } }
    });
    if (session && session.expiresAt > new Date()) {
      request.user = session.user; // never includes passwordHash
      request.sessionId = session.id;
    }
    next();
  } catch (error) { next(error); }
}

export function requireUser(request, response, next) {
  if (request.user) return next();
  response.status(401).json({ error: { code: 'SIGN_IN_REQUIRED', message: 'Please sign in to continue.' } });
}
