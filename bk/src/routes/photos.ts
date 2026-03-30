import { Hono } from 'hono';
import type { Env, PhotoRow, PhotoPublic } from '../types';
import { authMiddleware } from '../middleware/auth';

export const photosRoutes = new Hono<{ Bindings: Env }>();

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */

function toPublic(row: PhotoRow, baseUrl: string): PhotoPublic {
  return {
    id: row.id,
    title: row.title,
    url: `${baseUrl}/api/photos/${row.id}/image`,
    width: row.width,
    height: row.height,
    size: row.size,
    mime_type: row.mime_type,
    created_at: row.created_at,
    sort_order: row.sort_order,
  };
}

function getBaseUrl(c: { req: { url: string } }): string {
  const u = new URL(c.req.url);
  return `${u.protocol}//${u.host}`;
}

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
]);

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'image/gif': 'gif', 'image/avif': 'avif',
  };
  return map[mime] || 'bin';
}

/* ─────────────────────────────────────────────
   GET /api/photos  — public list
   ───────────────────────────────────────────── */
photosRoutes.get('/', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 200), 500);
  const offset = Number(c.req.query('offset') ?? 0);

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM photos ORDER BY sort_order ASC, created_at DESC LIMIT ? OFFSET ?`
  ).bind(limit, offset).all<PhotoRow>();

  const base = getBaseUrl(c);
  const data = (results ?? []).map((r) => toPublic(r, base));

  return c.json({ data, total: data.length });
});

/* ─────────────────────────────────────────────
   GET /api/photos/:id/image  — serve image from R2
   ───────────────────────────────────────────── */
photosRoutes.get('/:id/image', async (c) => {
  const id = c.req.param('id');

  const row = await c.env.DB.prepare(
    `SELECT r2_key, mime_type FROM photos WHERE id = ?`
  ).bind(id).first<Pick<PhotoRow, 'r2_key' | 'mime_type'>>();

  if (!row) return c.notFound();

  const object = await c.env.STORAGE.get(row.r2_key);
  if (!object) return c.notFound();

  const headers = new Headers();
  headers.set('Content-Type', row.mime_type);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('ETag', object.etag);

  return new Response(object.body, { headers });
});

/* ─────────────────────────────────────────────
   POST /api/photos  — upload (auth required)
   multipart/form-data: file + optional title
   ───────────────────────────────────────────── */
photosRoutes.post('/', authMiddleware, async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const title = (formData.get('title') as string) || '';

  if (!file) {
    return c.json({ error: 'No file provided' }, 400);
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return c.json({ error: `Unsupported file type: ${file.type}` }, 400);
  }

  // Size check (10MB max)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return c.json({ error: 'File too large (max 10MB)' }, 400);
  }

  const id = crypto.randomUUID();
  const ext = extFromMime(file.type);
  const r2Key = `photos/${id}.${ext}`;

  // Read dimensions from the client (sent as form fields)
  const width = Number(formData.get('width') ?? 0);
  const height = Number(formData.get('height') ?? 0);

  // Upload to R2
  await c.env.STORAGE.put(r2Key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { originalName: file.name },
  });

  // Get next sort_order
  const maxSort = await c.env.DB.prepare(
    `SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM photos`
  ).first<{ max_sort: number }>();
  const sortOrder = (maxSort?.max_sort ?? 0) + 1;

  // Insert metadata
  await c.env.DB.prepare(
    `INSERT INTO photos (id, title, r2_key, width, height, size, mime_type, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, title || file.name.replace(/\.[^/.]+$/, ''), r2Key, width, height, file.size, file.type, sortOrder).run();

  const base = getBaseUrl(c);
  return c.json({
    success: true,
    photo: {
      id,
      title: title || file.name.replace(/\.[^/.]+$/, ''),
      url: `${base}/api/photos/${id}/image`,
      width, height,
      size: file.size,
      mime_type: file.type,
      sort_order: sortOrder,
    },
  }, 201);
});

/* ─────────────────────────────────────────────
   DELETE /api/photos/:id  — delete (auth required)
   ───────────────────────────────────────────── */
photosRoutes.delete('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');

  const row = await c.env.DB.prepare(
    `SELECT r2_key FROM photos WHERE id = ?`
  ).bind(id).first<Pick<PhotoRow, 'r2_key'>>();

  if (!row) return c.json({ error: 'Not found' }, 404);

  // Delete from R2
  await c.env.STORAGE.delete(row.r2_key);

  // Delete from D1
  await c.env.DB.prepare(`DELETE FROM photos WHERE id = ?`).bind(id).run();

  return c.json({ success: true });
});

/* ─────────────────────────────────────────────
   PATCH /api/photos/:id  — update title / sort_order
   ───────────────────────────────────────────── */
photosRoutes.patch('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ title?: string; sort_order?: number }>().catch(() => ({}));

  const sets: string[] = [];
  const vals: (string | number)[] = [];

  if (body.title !== undefined) { sets.push('title = ?'); vals.push(body.title); }
  if (body.sort_order !== undefined) { sets.push('sort_order = ?'); vals.push(body.sort_order); }

  if (sets.length === 0) return c.json({ error: 'No fields to update' }, 400);

  vals.push(id);
  await c.env.DB.prepare(
    `UPDATE photos SET ${sets.join(', ')} WHERE id = ?`
  ).bind(...vals).run();

  return c.json({ success: true });
});
