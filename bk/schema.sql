-- REI SAMPLE — D1 Schema
-- Run: wrangler d1 execute rei-sample-db --file=./schema.sql

CREATE TABLE IF NOT EXISTS photos (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL DEFAULT '',
    r2_key      TEXT NOT NULL UNIQUE,
    width       INTEGER NOT NULL DEFAULT 0,
    height      INTEGER NOT NULL DEFAULT 0,
    size        INTEGER NOT NULL DEFAULT 0,
    mime_type   TEXT NOT NULL DEFAULT 'image/jpeg',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_photos_sort ON photos(sort_order ASC, created_at DESC);
