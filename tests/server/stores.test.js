import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';

let t;
afterEach(() => t?.cleanup());

it('add, edit, delete and undo a store', async () => {
  t = makeTestContext();
  const h = t.http;
  const created = await h().post('/api/stores').send({ name: 'Freezer', icon: 'snowflake' });
  expect(created.status).toBe(201);
  const id = created.body.id;
  expect((await h().patch(`/api/stores/${id}`).send({ name: 'Chest Freezer' })).body.name).toBe('Chest Freezer');
  const del = await h().delete(`/api/stores/${id}`);
  expect(del.body.restore).toBe(`/api/stores/${id}/restore`);
  expect((await h().get('/api/stores')).body.map(s => s.name)).not.toContain('Chest Freezer');
  await h().post(del.body.restore);
  expect((await h().get('/api/stores')).body.map(s => s.name)).toContain('Chest Freezer');
});

it('rejects a store with no name', async () => {
  t = makeTestContext();
  const res = await t.http().post('/api/stores').send({ name: '  ' });
  expect(res.status).toBe(400);
  expect(res.body.details.name).toBe('Required');
});

it('refuses to clear a NOT NULL field with a 400, not a 500', async () => {
  t = makeTestContext();
  const res = await t.http().patch('/api/stores/1').send({ icon: '' });
  expect(res.status).toBe(400);
  expect(res.body.details.icon).toBe('Required');
  expect((await t.http().patch('/api/stores/1').send({ sort_order: null })).status).toBe(400);
  expect((await t.http().patch('/api/stores/1').send({ icon: '   ' })).status).toBe(400);
});

it('refuses to delete a store that still has items', async () => {
  t = makeTestContext();
  t.ctx.db.prepare("INSERT INTO items (store_id, name) VALUES (1, 'Jam')").run();
  const res = await t.http().delete('/api/stores/1');
  expect(res.status).toBe(409);
});

it('locations filter by store and need a real store', async () => {
  t = makeTestContext();
  await t.http().post('/api/locations').send({ store_id: 1, name: 'Shelf B' });
  expect((await t.http().get('/api/locations?store_id=1')).body).toHaveLength(1);
  expect((await t.http().get('/api/locations?store_id=2')).body).toHaveLength(0);
  expect((await t.http().post('/api/locations').send({ store_id: 99, name: 'X' })).status).toBe(400);
});
