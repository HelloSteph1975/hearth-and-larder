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

it('seeds the five stores and categories', () => {
  t = makeTestContext();
  const names = t.ctx.db.prepare('SELECT name FROM stores ORDER BY sort_order').all().map(r => r.name);
  expect(names).toEqual(['Larder', 'Root Cellar', 'Pantry', 'Refrigerator', 'Freezer']);
  const n = t.ctx.db.prepare("SELECT COUNT(*) n FROM categories WHERE kind='item'").get().n;
  expect(n).toBeGreaterThan(5);
});

it('migrations are idempotent', async () => {
  t = makeTestContext();
  const { migrate } = await import('../../server/db/migrations.js');
  migrate(t.ctx.db);
  migrate(t.ctx.db);
  expect(t.ctx.db.prepare('SELECT COUNT(*) n FROM stores').get().n).toBe(5);
  expect(t.ctx.db.prepare('SELECT COUNT(*) n FROM locations').get().n).toBe(5);
});

const shelvesOf = (db, store) => db.prepare(
  'SELECT l.name FROM locations l JOIN stores s ON s.id = l.store_id WHERE s.name = ? ORDER BY l.sort_order').all(store).map(r => r.name);

it('gives the Refrigerator and Freezer their icons and starter shelves', () => {
  t = makeTestContext();
  const db = t.ctx.db;
  const rows = db.prepare("SELECT name, icon, sort_order FROM stores WHERE name IN ('Refrigerator','Freezer') ORDER BY sort_order").all();
  expect(rows.map(r => ({ ...r }))).toEqual([
    { name: 'Refrigerator', icon: 'fridge', sort_order: 3 },
    { name: 'Freezer', icon: 'freezer', sort_order: 4 },
  ]);
  expect(shelvesOf(db, 'Refrigerator')).toEqual(['Top shelf', 'Crisper drawer', 'Door']);
  expect(shelvesOf(db, 'Freezer')).toEqual(['Top shelf', 'Bottom drawer']);
  expect(shelvesOf(db, 'Larder')).toEqual([]);
});

it('upgrading keeps a store the user already named Freezer and adds only the Refrigerator', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { migrations, migrate } = await import('../../server/db/migrations.js');
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(migrations[0]);
    db.exec(migrations[1]);
    db.exec('PRAGMA user_version = 2');
    db.exec("UPDATE stores SET sort_order = 7 WHERE name = 'Pantry'");
    const mine = Number(db.prepare("INSERT INTO stores (name, icon, color, sort_order) VALUES ('freezer', 'snowflake', '#000000', 3)").run().lastInsertRowid);
    db.prepare("INSERT INTO locations (store_id, name) VALUES (?, 'Chest')").run(mine);
    db.prepare("INSERT INTO items (store_id, name, unit) VALUES (?, 'Peas', 'cup')").run(mine);
    db.prepare("INSERT INTO items (store_id, name, unit) VALUES (1, 'Jam', 'jar')").run();
    const before = db.prepare('SELECT * FROM items ORDER BY id').all();
    const storesBefore = db.prepare('SELECT * FROM stores ORDER BY id').all();

    migrate(db);
    expect(db.prepare('PRAGMA user_version').get().user_version).toBe(migrations.length);
    const names = db.prepare('SELECT name FROM stores WHERE deleted_at IS NULL ORDER BY sort_order').all().map(r => r.name);
    expect(names).toEqual(['Larder', 'Root Cellar', 'freezer', 'Pantry', 'Refrigerator']);
    const fridge = db.prepare("SELECT * FROM stores WHERE name = 'Refrigerator'").get();
    expect(fridge.sort_order).toBe(8);
    expect(shelvesOf(db, 'Refrigerator')).toEqual(['Top shelf', 'Crisper drawer', 'Door']);
    expect(shelvesOf(db, 'freezer')).toEqual(['Chest']);
    expect(db.prepare('SELECT * FROM items ORDER BY id').all()).toEqual(before);
    expect(db.prepare('SELECT * FROM stores WHERE id <= ? ORDER BY id').all(mine)).toEqual(storesBefore);

    migrate(db);
    expect(db.prepare('SELECT COUNT(*) n FROM stores').get().n).toBe(5);
    expect(db.prepare('SELECT COUNT(*) n FROM locations').get().n).toBe(4);
  } finally {
    db.close();
  }
});

it('a deleted store with the same name does not block the new one', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { migrations, migrate } = await import('../../server/db/migrations.js');
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(migrations[0]);
    db.exec(migrations[1]);
    db.exec('PRAGMA user_version = 2');
    db.exec("INSERT INTO stores (name, icon, sort_order, deleted_at) VALUES ('Refrigerator', 'snowflake', 3, datetime('now'))");
    migrate(db);
    expect(db.prepare("SELECT COUNT(*) n FROM stores WHERE name = 'Refrigerator' AND deleted_at IS NULL").get().n).toBe(1);
  } finally {
    db.close();
  }
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
