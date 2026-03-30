import type { Context, Next } from 'hono';
import type { Env } from '../types';

/**
 * Verify JWT-like Bearer token.
 * Simple HMAC-SHA256 token: base64url(payload).base64url(signature)
 */
export async function authMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next
) {
  const header = c.req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = header.slice(7);
  const valid = await verifyToken(token, c.env.JWT_SECRET);
  if (!valid) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  await next();
}

/* ── Token helpers ── */

export async function createToken(secret: string): Promise<string> {
  const payload = {
    sub: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24h
  };
  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const sig = await sign(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

export async function verifyToken(token: string, secret: string): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;

  // Check signature
  const expected = await sign(payloadB64, secret);
  if (sig !== expected) return false;

  // Check expiry
  try {
    const json = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    if (json.exp && json.exp < Math.floor(Date.now() / 1000)) return false;
  } catch {
    return false;
  }
  return true;
}

async function sign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
