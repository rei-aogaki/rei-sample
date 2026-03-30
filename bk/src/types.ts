/** Cloudflare Env bindings */
export interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  ADMIN_PASSWORD: string;
  JWT_SECRET: string;
}

/** photos table row */
export interface PhotoRow {
  id: string;
  title: string;
  r2_key: string;
  width: number;
  height: number;
  size: number;
  mime_type: string;
  created_at: string;
  sort_order: number;
}

/** Public photo response (hides r2_key) */
export interface PhotoPublic {
  id: string;
  title: string;
  url: string;
  width: number;
  height: number;
  size: number;
  mime_type: string;
  created_at: string;
  sort_order: number;
}
