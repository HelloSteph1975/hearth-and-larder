import { it, expect, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { makeTestContext } from './helpers.js';
import { migrations, migrate } from '../../server/db/migrations.js';
import { addTime, readyWindow, jarsWorking } from '../../server/services/batch.js';

let t;
afterEach(() => t?.cleanup());

const plans = async () => (await t.http().get('/api/batch-plans')).body;
const week = (from, to) => t.http().get(`/api/plan?from=${from}&to=${to}`).then(r => r.body);

it('seeds twelve batch weeks in order, three days each', async () => {
  t = makeTestContext();
  const list = await plans();
  expect(list.map(p => p.week_no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  expect(list.every(p => p.days.length === 3)).toBe(true);
  expect(list[0].month_title).toBe('Month 1: Mexican foundations');
  expect(list[0].days.map(d => d.kind)).toEqual(['big', 'jar', 'refill']);
  expect(list[0].days[1]).toMatchObject({ ready_min: 7, ready_max: 14, ready_unit: 'days' });
  expect(list[0].days[0].ingredients).toContain('Black beans');
  expect(list[7].days[1]).toMatchObject({ kind: 'big', ready_min: 6, ready_max: 10, ready_unit: 'months' });
  expect(list.every(p => !p.done && p.runs.length === 0)).toBe(true);
});

it('keeps existing plan rows when the batch slot is added', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (let i = 0; i < 3; i++) {
    const step = migrations[i];
    if (typeof step === 'function') step(db); else db.exec(step);
    db.exec(`PRAGMA user_version = ${i + 1}`);
  }
  db.exec("INSERT INTO meal_plan (date, slot, note) VALUES ('2026-10-08', 'supper', 'Soup night')");
  migrate(db);
  expect(db.prepare('SELECT date, slot, note FROM meal_plan').all()).toEqual([{ date: '2026-10-08', slot: 'supper', note: 'Soup night' }]);
  db.exec("INSERT INTO meal_plan (date, slot, note) VALUES ('2026-10-09', 'batch', 'Bake')");
  expect(() => db.exec("INSERT INTO meal_plan (date, slot, note) VALUES ('2026-10-09', 'brunch', 'x')")).toThrow();
  db.close();
});

it('places a week on three days, Day 1 first, and marks it done when every task is done', async () => {
  t = makeTestContext();
  const h = t.http;
  const w1 = (await plans())[0];
  const res = await h().post(`/api/batch-plans/${w1.id}/place`).send({ dates: ['2026-10-24', '2026-10-19', '2026-10-21'] });
  expect(res.status).toBe(201);
  const entries = await week('2026-10-19', '2026-10-25');
  expect(entries.map(e => [e.date, e.slot, e.batch_kind, e.batch_day_no, e.batch_week])).toEqual([
    ['2026-10-19', 'batch', 'big', 1, 1], ['2026-10-21', 'batch', 'jar', 2, 1], ['2026-10-24', 'batch', 'refill', 3, 1],
  ]);
  const jar = entries[1];
  expect(jar.note).toMatch(/sourdough starter/);
  expect(jar).toMatchObject({ ready_from: '2026-10-28', ready_to: '2026-11-04' });

  let p = (await plans())[0];
  expect(p.runs).toHaveLength(1);
  expect(p.done).toBe(false);
  // Started a day late: the ready window follows the day it was done.
  await h().patch(`/api/plan/${jar.id}`).send({ done_on: '2026-10-22' });
  expect((await week('2026-10-21', '2026-10-21'))[0]).toMatchObject({ ready_from: '2026-10-29', ready_to: '2026-11-05' });
  for (const e of entries.filter(x => x.id !== jar.id)) await h().patch(`/api/plan/${e.id}`).send({ done_on: e.date });
  p = (await plans())[0];
  expect(p.done).toBe(true);
  expect(p.done_on).toBe('2026-10-24');
});

it('refuses a bad placement', async () => {
  t = makeTestContext();
  const id = (await plans())[0].id;
  const post = (pid, body) => t.http().post(`/api/batch-plans/${pid}/place`).send(body);
  expect((await post(id, { dates: ['2026-10-19', '2026-10-21'] })).status).toBe(400);
  expect((await post(id, { dates: ['2026-10-19', '2026-10-19', '2026-10-21'] })).status).toBe(400);
  expect((await post(id, { dates: ['2026-10-19', '2026-13-01', '2026-10-21'] })).status).toBe(400);
  expect((await post(9999, { dates: ['2026-10-19', '2026-10-20', '2026-10-21'] })).status).toBe(404);
  expect((await week('2026-10-01', '2026-10-31'))).toHaveLength(0);
});

it('a batch entry can be a recipe or a note like any other', async () => {
  t = makeTestContext();
  const rec = (await t.http().post('/api/recipes').send({ title: 'Sourdough loaf', servings: 1 })).body;
  expect((await t.http().post('/api/plan').send({ date: '2026-10-08', slot: 'batch', recipe_id: rec.id })).status).toBe(201);
  expect((await t.http().post('/api/plan').send({ date: '2026-10-08', slot: 'batch', note: 'Ghee' })).status).toBe(201);
  expect((await week('2026-10-08', '2026-10-08')).map(e => e.recipe_title ?? e.note)).toEqual(['Sourdough loaf', 'Ghee']);
});

it('puts a placed week\'s missing ingredients on the shopping list', async () => {
  t = makeTestContext();
  const h = t.http;
  const pantry = (await h().get('/api/stores')).body.find(s => s.name === 'Pantry');
  const item = (await h().post('/api/items').send({ store_id: pantry.id, name: 'Black beans', unit: 'lb' })).body;
  await h().post('/api/batches').send({ item_id: item.id, quantity: 2, unit: 'lb' });
  const w1 = (await plans())[0];
  await h().post(`/api/batch-plans/${w1.id}/place`).send({ dates: ['2026-10-19', '2026-10-21', '2026-10-24'] });
  const list = (await h().post('/api/shopping/build').send({ from: '2026-10-19', to: '2026-10-25' })).body;
  const names = list.map(s => s.name);
  expect(names).toContain('Whole rye berries');
  expect(names).toContain('Whole milk, grass-fed');
  expect(names).not.toContain('Black beans');
  expect(names.filter(n => n === 'Carrots')).toHaveLength(1);
  expect(list.every(s => s.origin === 'plan' && s.quantity == null)).toBe(true);

  // A task already done needs nothing more.
  const entries = await week('2026-10-19', '2026-10-25');
  await h().patch(`/api/plan/${entries[1].id}`).send({ done_on: '2026-10-21' });
  const after = (await h().post('/api/shopping/build').send({ from: '2026-10-19', to: '2026-10-25' })).body.map(s => s.name);
  expect(after).not.toContain('Whole rye berries');
});

it('works out ready dates in days, weeks and months', () => {
  expect(addTime('2026-10-19', 14, 'days')).toBe('2026-11-02');
  expect(addTime('2026-10-19', 3, 'weeks')).toBe('2026-11-09');
  expect(addTime('2026-01-31', 1, 'months')).toBe('2026-02-28');
  expect(addTime('2026-10-19', 10, 'months')).toBe('2027-08-19');
  expect(readyWindow({ date: '2026-10-19', ready_min: null })).toEqual({ ready_from: null, ready_to: null });
  expect(readyWindow({ date: '2026-10-19', done_on: null, ready_min: 2, ready_max: 6, ready_unit: 'months' }))
    .toEqual({ ready_from: '2026-12-19', ready_to: '2027-04-19' });
});

it('lists jars still working on the home page', async () => {
  t = makeTestContext();
  const list = await plans();
  await t.http().post(`/api/batch-plans/${list[0].id}/place`).send({ dates: ['2026-10-19', '2026-10-21', '2026-10-24'] });
  await t.http().post(`/api/batch-plans/${list[3].id}/place`).send({ dates: ['2026-10-26', '2026-10-28', '2026-10-31'] });
  const home = (await t.http().get('/api/home?today=2026-10-22')).body;
  expect(home.jars_working.map(j => [j.batch_week, j.ready_from, j.ready_to])).toEqual([
    [1, '2026-10-28', '2026-11-04'], [4, '2026-12-28', '2027-04-28'],
  ]);
  // Long past its window, a jar drops off the list.
  expect(jarsWorking(t.ctx.db, '2026-12-01').map(j => j.batch_week)).toEqual([4]);
});

it('a week is done only when all three days are ticked, on the last day ticked', async () => {
  t = makeTestContext();
  const h = t.http;
  const w1 = (await plans())[0];
  await h().post(`/api/batch-plans/${w1.id}/place`).send({ dates: ['2026-10-19', '2026-10-21', '2026-10-24'] });
  const [a, b, c] = await week('2026-10-19', '2026-10-25');
  await h().patch(`/api/plan/${a.id}`).send({ done_on: '2026-10-19' });
  await h().delete(`/api/plan/${b.id}`);
  await h().delete(`/api/plan/${c.id}`);
  expect((await plans())[0].done).toBe(false);
  await h().post(`/api/plan/${b.id}/restore`);
  await h().post(`/api/plan/${c.id}/restore`);
  await h().patch(`/api/plan/${b.id}`).send({ done_on: '2026-10-21' });
  await h().patch(`/api/plan/${c.id}`).send({ done_on: '2026-10-26' });
  expect((await plans())[0]).toMatchObject({ done: true, done_on: '2026-10-26' });
});

it('a batch task swapped for a recipe drops the old ingredients and ready time but stays in its week', async () => {
  t = makeTestContext();
  const h = t.http;
  const w1 = (await plans())[0];
  await h().post(`/api/batch-plans/${w1.id}/place`).send({ dates: ['2026-10-19', '2026-10-21', '2026-10-24'] });
  const jar = (await week('2026-10-21', '2026-10-21'))[0];
  const rec = (await h().post('/api/recipes').send({ title: 'Pancakes', servings: 2 })).body;
  await h().patch(`/api/plan/${jar.id}`).send({ recipe_id: rec.id, note: null });
  const after = (await week('2026-10-21', '2026-10-21'))[0];
  expect(after).toMatchObject({ recipe_title: 'Pancakes', batch_kind: null, ready_from: null });
  const list = (await h().post('/api/shopping/build').send({ from: '2026-10-19', to: '2026-10-25' })).body.map(s => s.name);
  expect(list).not.toContain('Whole rye berries');
  expect((await plans())[0].runs[0].tasks).toBe(3);
  // Editing a task's note keeps it linked.
  const big = (await week('2026-10-19', '2026-10-19'))[0];
  await h().patch(`/api/plan/${big.id}`).send({ note: 'Beans only this time' });
  expect((await week('2026-10-19', '2026-10-19'))[0].batch_kind).toBe('big');
});

it('a batch need is left off when a planned recipe asks for the same thing by amount', async () => {
  t = makeTestContext();
  const h = t.http;
  const w1 = (await plans())[0];
  await h().post(`/api/batch-plans/${w1.id}/place`).send({ dates: ['2026-10-19', '2026-10-21', '2026-10-24'] });
  const rec = (await h().post('/api/recipes').send({ title: 'Carrot soup', servings: 2, ingredients: [{ name: 'Carrots', quantity: 2, unit: 'lb' }] })).body;
  await h().post('/api/plan').send({ date: '2026-10-20', slot: 'supper', recipe_id: rec.id });
  const list = (await h().post('/api/shopping/build').send({ from: '2026-10-19', to: '2026-10-25' })).body;
  expect(list.filter(s => s.name === 'Carrots').map(s => [s.quantity, s.unit])).toEqual([[2, 'lb']]);
});

it('a recipe asking for none of something leaves the batch need on the list', async () => {
  t = makeTestContext();
  const h = t.http;
  const w1 = (await plans())[0];
  await h().post(`/api/batch-plans/${w1.id}/place`).send({ dates: ['2026-10-19', '2026-10-21', '2026-10-24'] });
  const rec = (await h().post('/api/recipes').send({ title: 'Plain broth', servings: 2, ingredients: [{ name: 'Carrots', quantity: 0, unit: 'lb' }] })).body;
  await h().post('/api/plan').send({ date: '2026-10-20', slot: 'supper', recipe_id: rec.id });
  const list = (await h().post('/api/shopping/build').send({ from: '2026-10-19', to: '2026-10-25' })).body;
  expect(list.filter(s => s.name === 'Carrots').map(s => s.quantity)).toEqual([null]);
});
