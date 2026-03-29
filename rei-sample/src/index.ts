import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { photosRoutes } from './routes/photos';
import { authRoutes } from './routes/auth';

const app = new Hono<{ Bindings: Env }>();

/* ── Global middleware ── */
app.use('/api/*', cors());

/* ── Mount routes ── */
app.route('/api/auth', authRoutes);
app.route('/api/photos', photosRoutes);

/* ── Health ── */
app.get('/api/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }));

export default app;
