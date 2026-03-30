/**
 * Cloudflare Pages Functions — catch-all route for /api/*
 * Uses hono/cloudflare-pages adapter to properly pass env bindings.
 */
import { handle } from 'hono/cloudflare-pages';
import app from '../../src/index';

export const onRequest = handle(app);
