import { Hono } from 'hono';
import type { Env } from '../types';
import { createToken } from '../middleware/auth';

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
