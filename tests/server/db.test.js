import { it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { makeTestContext } from './helpers.js';
import { transaction } from '../../server/db/connection.js';

let t;
afterEach(() => t?.cleanup());

it('creates the data folder layout', () => {
  t = makeTestContext();
  for (const p of ['hearth.db', 'photos', 'photos/_trash', 'backups']) {
    expect(fs.existsSync(path.join(t.dataDir, p))).toBe(true);
  }
});

it('seeds the three stores and categories', () => {
  t = makeTestContext();
  const names = t.ctx.db.prepare('SELECT name FROM stores ORDER BY sort_order').all().map(r => r.name);
  expect(names).toEqual(['Larder', 'Root Cellar', 'Pantry']);
  const n = t.ctx.db.prepare("SELECT COUNT(*) n FROM categories WHERE kind='item'").get().n;
  expect(n).toBeGreaterThan(5);
});

it('migrations are idempotent', async () => {
  t = makeTestContext();
  const { migrate } = await import('../../server/db/migrations.js');
  migrate(t.ctx.db);
  expect(t.ctx.db.prepare('SELECT COUNT(*) n FROM stores').get().n).toBe(3);
});

it('transaction rolls back on error and supports nesting', () => {
  t = makeTestContext();
  const db = t.ctx.db;
  expect(() => transaction(db, () => {
    db.prepare("INSERT INTO stores (name) VALUES ('Temp')").run();
    transaction(db, () => db.prepare("INSERT INTO stores (name) VALUES ('Inner')").run());
    throw new Error('boom');
  })).toThrow('boom');
  expect(db.prepare("SELECT COUNT(*) n FROM stores WHERE name IN ('Temp','Inner')").get().n).toBe(0);
});
