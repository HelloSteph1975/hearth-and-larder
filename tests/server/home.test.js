import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';

let t;
afterEach(() => t?.cleanup());

it('settings have defaults and validate', async () => {
  t = makeTestContext();
  expect((await t.http().get('/api/settings')).body).toMatchObject({ week_start: 'monday', use_soon_days: '14' });
  expect((await t.http().put('/api/settings').send({ household_name: 'Stephanie', use_soon_days: '7' })).body.household_name).toBe('Stephanie');
  expect((await t.http().put('/api/settings').send({ week_start: 'friday' })).status).toBe(400);
  expect((await t.http().put('/api/settings').send({ hacker: 'x' })).status).toBe(400);
});

it('home lists use-soon, running low, today and can-make', async () => {
  t = makeTestContext();
  const h = t.http;
  await h().post('/api/items').send({ store_id: 1, name: 'Apple butter', unit: 'jar', first_batch: { quantity: 2, unit: 'jar', use_by: '2026-10-12' } });
  await h().post('/api/items').send({ store_id: 1, name: 'Old jam', unit: 'jar', first_batch: { quantity: 1, unit: 'jar', use_by: '2027-06-01' } });
  await h().post('/api/items').send({ store_id: 2, name: 'Onions', unit: 'lb', low_threshold: 3, first_batch: { quantity: 1, unit: 'lb' } });
  const rec = (await h().post('/api/recipes').send({ title: 'Onion soup', ingredients: [{ name: 'Onion', quantity: 1, unit: 'lb' }] })).body;
  await h().post('/api/plan').send({ date: '2026-10-07', slot: 'supper', recipe_id: rec.id });
  const home = (await h().get('/api/home?today=2026-10-07')).body;
  expect(home.use_soon.map(u => [u.item_name, u.days_left])).toEqual([['Apple butter', 5]]);
  expect(home.running_low.map(i => i.name)).toEqual(['Onions']);
  expect(home.today.map(e => e.recipe_title)).toEqual(['Onion soup']);
  expect(home.can_make.map(r => r.title)).toEqual(['Onion soup']);
  expect(home.counts).toMatchObject({ items: 3, recipes: 1 });
});

it('settings reject non-string/number values', async () => {
  t = makeTestContext();
  expect((await t.http().put('/api/settings').send({ household_name: null })).status).toBe(400);
  expect((await t.http().put('/api/settings').send({ household_name: {} })).status).toBe(400);
  expect((await t.http().put('/api/settings').send({ use_soon_days: 7 })).body.use_soon_days).toBe('7');
});
