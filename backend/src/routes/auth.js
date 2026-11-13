// File: backend/src/routes/auth.js
// POST /api/auth/login   email + password -> sets the session cookie
// POST /api/auth/logout  deletes the session and the cookie
// GET  /api/auth/me      who is signed in (401 for a guest)
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { dummyPasswordHash, verifyPassword } from '../auth/password.js';
import {
  clearSessionCookieOptions, hashSessionToken, newSessionToken,
  SESSION_COOKIE, SESSION_MAX_AGE_MS, sessionCookieOptions
} from '../auth/session.js';
import { requireUser } from '../middleware/auth.js';
import { signInSchema } from '../validators/schemas.js';

const router = Router();

// Slows down password guessing: 10 tries per 15 minutes per visitor IP.
const signInLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_SIGN_IN_ATTEMPTS', message: 'Too many sign-in attempts. Please wait 15 minutes and try again.' } }
});

const WRONG_DETAILS = { error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } };

router.post('/login', signInLimiter, async (request, response, next) => {
  try {
    const parsed = signInSchema.safeParse(request.body);
    if (!parsed.success) return response.status(422).json({ error: { code: 'INVALID_SIGN_IN', message: 'Enter a valid email address and a password.' } });

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    // Always run one password check, even for an unknown email (same time either way).
    const passwordOk = await verifyPassword(parsed.data.password, user?.passwordHash ?? await dummyPasswordHash());
    // Same message for "no such email" and "wrong password", so emails cannot be guessed.
    if (!user || !passwordOk) return response.status(401).json(WRONG_DETAILS);

    const token = newSessionToken();
    await prisma.session.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } }); // tidy old sessions
    await prisma.session.create({
      data: { id: hashSessionToken(token), userId: user.id, expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS) }
    });
    response.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    response.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) { next(error); }
});

router.post('/logout', async (request, response, next) => {
  try {
    if (request.sessionId) await prisma.session.deleteMany({ where: { id: request.sessionId } });
    response.clearCookie(SESSION_COOKIE, clearSessionCookieOptions());
    response.status(204).end();
  } catch (error) { next(error); }
});

router.get('/me', requireUser, (request, response) => response.json({ user: request.user }));

export default router;
