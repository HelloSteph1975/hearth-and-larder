import { it, expect, beforeEach, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';

let t;
beforeEach(() => { t = makeTestContext(); });
afterEach(() => t.cleanup());

const put = (source, id, body) => t.http().put(`/api/harvests/external/${source}/${id}`).send(body);
const del = (source, id) => t.http().delete(`/api/harvests/external/${source}/${id}`);
const live = () => t.ctx.db.prepare('SELECT * FROM harvests WHERE deleted_at IS NULL ORDER BY id').all();
const TOMATO = { crop: 'Tomato', quantity: 4.5, unit: 'lb', harvested_on: '2026-10-14', note: 'From Seed & Harvest: Bed, Home' };

it('a garden app’s harvest is created once and updated on resend', async () => {
  const first = await put('seed-and-harvest', '12', TOMATO);
  expect(first.status).toBe(201);
  expect(first.body).toMatchObject({ crop: 'Tomato', quantity: 4.5, unit: 'lb', source: 'seed-and-harvest', external_id: '12' });
  const again = await put('seed-and-harvest', '12', { ...TOMATO, quantity: 6 });
  expect(again.status).toBe(200);
  expect(again.body).toMatchObject({ id: first.body.id, quantity: 6 });
  expect(live()).toHaveLength(1);
});

it('deleting by outside id is safe to repeat', async () => {
  await put('seed-and-harvest', '12', TOMATO);
  expect((await del('seed-and-harvest', '12')).body).toEqual({ ok: true });
  expect(live()).toHaveLength(0);
  expect((await del('seed-and-harvest', '12')).status).toBe(200);
  expect((await del('seed-and-harvest', '99')).status).toBe(200);
});

it('a deleted harvest sent again comes back', async () => {
  const first = await put('seed-and-harvest', '12', TOMATO);
  await del('seed-and-harvest', '12');
  const back = await put('seed-and-harvest', '12', TOMATO);
  expect(back.body.id).toBe(first.body.id);
  expect(live()).toHaveLength(1);
});

it('the same outside id from two sources are two harvests', async () => {
  await put('seed-and-harvest', '12', TOMATO);
  await put('other-garden', '12', TOMATO);
  expect(live()).toHaveLength(2);
});

it('bad source or id is refused, and so is a harvest without a crop or date', async () => {
  expect((await put('bad source!', '12', TOMATO)).status).toBe(400);
  expect((await put('seed-and-harvest', 'x'.repeat(81), TOMATO)).status).toBe(400);
  expect((await put('seed-and-harvest', '12', { quantity: 1 })).status).toBe(400);
});

it('harvests logged by hand are unchanged', async () => {
  const res = await t.http().post('/api/harvests').send({ crop: 'Basil', harvested_on: '2026-10-16' });
  expect(res.status).toBe(201);
  expect(res.body.external_id ?? null).toBeNull();
});

it('editing a garden harvest by hand keeps its source, so the next resend finds it', async () => {
  const first = await put('seed-and-harvest', '12', TOMATO);
  const edit = await t.http().patch(`/api/harvests/${first.body.id}`).send({ source: 'manual', quantity: 5 });
  expect(edit.status).toBe(200);
  expect(edit.body).toMatchObject({ source: 'seed-and-harvest', quantity: 5 });
  await put('seed-and-harvest', '12', { ...TOMATO, quantity: 7 });
  expect(live()).toHaveLength(1);
  expect(live()[0]).toMatchObject({ id: first.body.id, quantity: 7 });
});

it('upgrading keeps saved harvests as they were, twice over', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { migrations, migrate } = await import('../../server/db/migrations.js');
  const db = new DatabaseSync(':memory:');
  try {
    for (const step of migrations.slice(0, 5)) { if (typeof step === 'function') step(db); else db.exec(step); }
    db.exec('PRAGMA user_version = 5');
    const add = db.prepare('INSERT INTO harvests (crop, quantity, unit, harvested_on, source, deleted_at) VALUES (?, ?, ?, ?, ?, ?)');
    add.run('Tomato', 2, 'lb', '2026-08-01', 'garden', null);
    add.run('Bean', 1, 'lb', '2026-08-02', 'garden', null);
    add.run('Squash', 3, 'count', '2026-08-03', 'garden', '2026-09-01 10:00:00');
    const before = db.prepare('SELECT * FROM harvests ORDER BY id').all();
    migrate(db);
    migrate(db);
    const after = db.prepare('SELECT * FROM harvests ORDER BY id').all();
    expect(after.map(({ external_id, ...r }) => r)).toEqual(before);
    expect(after.every(r => r.external_id === null)).toBe(true);
  } finally {
    db.close();
  }
});
