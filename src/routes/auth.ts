import { Hono } from 'hono';
import type { Env } from '../types';
import { createToken, verifyToken } from '../middleware/auth';

export const authRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /api/auth/login
 * Body: { password: string }
 * Returns: { token: string }
 */
authRoutes.post('/login', async (c) => {
  const body = await c.req.json<{ password?: string }>().catch(() => ({}));
  const password = body.password ?? '';

  if (!c.env.ADMIN_PASSWORD) {
    return c.json({ error: 'ADMIN_PASSWORD not configured' }, 500);
  }

  if (password !== c.env.ADMIN_PASSWORD) {
    return c.json({ error: 'Invalid password' }, 401);
  }

  const token = await createToken(c.env.JWT_SECRET);
  return c.json({ token });
});

/**
 * GET /api/auth/verify
 * Header: Authorization: Bearer <token>
 * Returns: { ok: true } or 401
 */
authRoutes.get('/verify', async (c) => {
  const header = c.req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (!c.env.JWT_SECRET) {
    return c.json({ error: 'JWT_SECRET not configured' }, 500);
  }

  const token = header.slice(7);
  const valid = await verifyToken(token, c.env.JWT_SECRET);
  if (!valid) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  return c.json({ ok: true });
});
