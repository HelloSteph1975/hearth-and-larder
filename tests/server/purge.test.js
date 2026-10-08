import { it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { makeTestContext } from './helpers.js';
import { purgeSoftDeleted } from '../../server/services/purge.js';

let t;
afterEach(() => t?.cleanup());

it('hard-deletes rows soft-deleted over 30 days ago, children first', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = (await h().post('/api/items').send({ store_id: 1, name: 'Jam', first_batch: { quantity: 1 } })).body;
  const keep = (await h().post('/api/items').send({ store_id: 1, name: 'Fresh delete' })).body;
  await h().delete(`/api/items/${item.id}`);
  await h().delete(`/api/items/${keep.id}`);
  t.ctx.db.prepare("UPDATE items SET deleted_at = '2026-08-01T00:00:00.000Z' WHERE id = ?").run(item.id);
  purgeSoftDeleted(t.ctx.db, t.dataDir, { now: Date.parse('2026-10-07T00:00:00Z') });
  const ids = t.ctx.db.prepare('SELECT id FROM items').all().map(r => r.id);
  expect(ids).toEqual([keep.id]);
  expect(t.ctx.db.prepare('SELECT COUNT(*) n FROM batches').get().n).toBe(0);
});

const OLD = '2026-08-01T00:00:00.000Z';
const NOW = Date.parse('2026-10-07T00:00:00Z');

it('purges a deleted store together with its locations', () => {
  t = makeTestContext();
  const db = t.ctx.db;
  const sid = db.prepare("INSERT INTO stores (name, deleted_at) VALUES ('Gone', ?)").run(OLD).lastInsertRowid;
  db.prepare("INSERT INTO locations (store_id, name) VALUES (?, 'Shelf')").run(sid);
  purgeSoftDeleted(db, t.dataDir, { now: NOW });
  expect(db.prepare('SELECT COUNT(*) n FROM stores WHERE id = ?').get(sid).n).toBe(0);
  expect(db.prepare('SELECT COUNT(*) n FROM locations WHERE store_id = ?').get(sid).n).toBe(0);
});

it('purges a recipe with cook log, plan rows and a trashed photo file', () => {
  t = makeTestContext();
  const db = t.ctx.db;
  const rid = db.prepare("INSERT INTO recipes (title, deleted_at) VALUES ('Old', ?)").run(OLD).lastInsertRowid;
  db.prepare("INSERT INTO cook_log (recipe_id, cooked_on) VALUES (?, '2026-07-01')").run(rid);
  db.prepare("INSERT INTO meal_plan (date, slot, recipe_id) VALUES ('2026-07-02', 'supper', ?)").run(rid);
  db.prepare("INSERT INTO photos (owner_type, owner_id, filename) VALUES ('recipe', ?, 'p1.jpg')").run(rid);
  const file = path.join(t.dataDir, 'photos', '_trash', 'p1.jpg');
  fs.writeFileSync(file, 'x');
  purgeSoftDeleted(db, t.dataDir, { now: NOW });
  expect(db.prepare('SELECT COUNT(*) n FROM recipes').get().n).toBe(0);
  expect(db.prepare('SELECT COUNT(*) n FROM cook_log').get().n).toBe(0);
  expect(db.prepare('SELECT COUNT(*) n FROM meal_plan').get().n).toBe(0);
  expect(db.prepare('SELECT COUNT(*) n FROM photos').get().n).toBe(0);
  expect(fs.existsSync(file)).toBe(false);
});

it('purges old cook logs and batches that have cook deductions', async () => {
  t = makeTestContext();
  const h = t.http;
  const db = t.ctx.db;
  const item = (await h().post('/api/items').send({ store_id: 1, name: 'Oats', unit: 'cup', first_batch: { quantity: 4 } })).body;
  const other = (await h().post('/api/items').send({ store_id: 1, name: 'Honey', unit: 'jar', first_batch: { quantity: 2 } })).body;
  const { id } = (await h().post('/api/recipes').send({ title: 'Porridge', servings: 1 })).body;
  const cook = batch_id => h().post(`/api/recipes/${id}/cook`).send({ servings: 1, cooked_on: '2026-07-01', deductions: [{ batch_id, take: 1 }] });
  const log = (await cook(item.batches[0].id)).body;
  await cook(other.batches[0].id);
  await h().delete(`/api/cook-log/${log.id}`);
  await h().delete(`/api/items/${other.id}`);
  db.prepare('UPDATE cook_log SET deleted_at = ? WHERE id = ?').run(OLD, log.id);
  db.prepare('UPDATE items SET deleted_at = ? WHERE id = ?').run(OLD, other.id);
  expect(() => purgeSoftDeleted(db, t.dataDir, { now: NOW })).not.toThrow();
  expect(db.prepare('SELECT COUNT(*) n FROM cook_log').get().n).toBe(1);
  expect(db.prepare('SELECT COUNT(*) n FROM cook_deductions').get().n).toBe(0);
  expect(db.prepare('SELECT COUNT(*) n FROM items').get().n).toBe(1);
});

it('keeps photo files that a kept backup still needs', async () => {
  const { backupNow } = await import('../../server/services/backup.js');
  const { purgeTrash } = await import('../../server/services/purge.js');
  t = makeTestContext();
  const db = t.ctx.db;
  const rid = db.prepare("INSERT INTO recipes (title) VALUES ('Old')").run().lastInsertRowid;
  const add = name => db.prepare("INSERT INTO photos (owner_type, owner_id, filename) VALUES ('recipe', ?, ?)").run(rid, name);
  add('1-aaaaaaaa.jpg');
  add('2-bbbbbbbb.jpg');
  backupNow(db, t.dataDir, new Date('2026-07-15T12:00:00'));
  add('3-cccccccc.jpg');
  db.prepare('UPDATE recipes SET deleted_at = ?').run(OLD);
  db.prepare('UPDATE photos SET deleted_at = ?').run(OLD);
  const photos = path.join(t.dataDir, 'photos');
  fs.writeFileSync(path.join(photos, '1-aaaaaaaa.jpg'), 'x'); // still in the live folder
  fs.writeFileSync(path.join(photos, '_trash', '2-bbbbbbbb.jpg'), 'x');
  fs.writeFileSync(path.join(photos, '_trash', '3-cccccccc.jpg'), 'x');
  purgeSoftDeleted(db, t.dataDir, { now: NOW });
  expect(db.prepare('SELECT COUNT(*) n FROM photos').get().n).toBe(0);
  // The backup's photos wait in the trash; the one no backup knows about is gone.
  expect(fs.readdirSync(path.join(photos, '_trash')).sort()).toEqual(['1-aaaaaaaa.jpg', '2-bbbbbbbb.jpg']);
  expect(fs.existsSync(path.join(photos, '1-aaaaaaaa.jpg'))).toBe(false);
  const old = new Date(NOW - 40 * 86400000);
  for (const f of fs.readdirSync(path.join(photos, '_trash'))) fs.utimesSync(path.join(photos, '_trash', f), old, old);
  expect(purgeTrash(t.dataDir, 30, NOW)).toBe(0);
  fs.rmSync(path.join(t.dataDir, 'backups'), { recursive: true });
  expect(purgeTrash(t.dataDir, 30, NOW)).toBe(2);
});
