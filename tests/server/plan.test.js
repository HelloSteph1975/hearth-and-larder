import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';

let t;
afterEach(() => t?.cleanup());

it('plans, moves and removes meals', async () => {
  t = makeTestContext();
  const h = t.http;
  const rec = (await h().post('/api/recipes').send({ title: 'Porridge', servings: 2 })).body;
  const a = (await h().post('/api/plan').send({ date: '2026-10-08', slot: 'breakfast', recipe_id: rec.id })).body;
  expect(a).toMatchObject({ servings: 2, sort_order: 0 });
  const b = (await h().post('/api/plan').send({ date: '2026-10-08', slot: 'breakfast', note: 'Leftovers' })).body;
  expect(b.sort_order).toBe(1);
  await h().patch(`/api/plan/${a.id}`).send({ date: '2026-10-09', slot: 'supper' });
  const week = (await h().get('/api/plan?from=2026-10-06&to=2026-10-12')).body;
  expect(week.map(e => [e.date, e.slot, e.recipe_title ?? e.note])).toEqual([
    ['2026-10-08', 'breakfast', 'Leftovers'], ['2026-10-09', 'supper', 'Porridge'],
  ]);
  const del = await h().delete(`/api/plan/${b.id}`);
  expect((await h().get('/api/plan?from=2026-10-06&to=2026-10-12')).body).toHaveLength(1);
  await h().post(del.body.restore);
  expect((await h().get('/api/plan?from=2026-10-06&to=2026-10-12')).body).toHaveLength(2);
});

it('needs a recipe or a note, and a known slot', async () => {
  t = makeTestContext();
  expect((await t.http().post('/api/plan').send({ date: '2026-10-08', slot: 'breakfast' })).status).toBe(400);
  expect((await t.http().post('/api/plan').send({ date: '2026-10-08', slot: 'brunch', note: 'x' })).status).toBe(400);
  expect((await t.http().get('/api/plan')).status).toBe(400);
});
