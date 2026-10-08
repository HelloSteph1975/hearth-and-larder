import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';

let t;
afterEach(() => t?.cleanup());

it('builds a list from the plan minus stock, with prices, and keeps manual items', async () => {
  t = makeTestContext();
  const h = t.http;
  await h().post('/api/items').send({ store_id: 3, name: 'Flour', unit: 'cup', category_id: 2,
    first_batch: { quantity: 2, unit: 'cup', price: 4, purchased_on: '2026-09-01' } });
  const rec = (await h().post('/api/recipes').send({ title: 'Biscuits', servings: 4, ingredients: [
    { name: 'Flour', quantity: 3, unit: 'cup' }, { name: 'Buttermilk', quantity: 1, unit: 'cup' },
    { name: 'Salt', quantity: 1, unit: 'tsp', is_staple: true }] })).body;
  await h().post('/api/plan').send({ date: '2026-10-08', slot: 'breakfast', recipe_id: rec.id, servings: 8 });
  await h().post('/api/shopping').send({ name: 'Dish soap' });
  const built = (await h().post('/api/shopping/build').send({ from: '2026-10-06', to: '2026-10-12' })).body;
  const byName = Object.fromEntries(built.map(i => [i.name, i]));
  expect(byName.Flour).toMatchObject({ quantity: 4, unit: 'cup', origin: 'plan', est_price: 8, category_name: 'Pantry Staples' });
  expect(byName.Buttermilk).toMatchObject({ quantity: 2, unit: 'cup', est_price: null });
  expect(byName['Dish soap'].origin).toBe('manual');
  expect(byName.Salt).toBeUndefined();
  const again = (await h().post('/api/shopping/build').send({ from: '2026-10-06', to: '2026-10-12' })).body;
  expect(again).toHaveLength(3);
});

it('puts ticked items away as new batches', async () => {
  t = makeTestContext();
  const h = t.http;
  const eggs = (await h().post('/api/shopping').send({ name: 'Eggs', quantity: 12, unit: 'each', est_price: 6 })).body;
  await h().patch(`/api/shopping/${eggs.id}`).send({ checked: true });
  const res = await h().post('/api/shopping/put-away').send({ ids: [eggs.id], store_id: 1, today: '2026-10-07' });
  expect(res.status).toBe(200);
  const items = (await h().get('/api/items?store_id=1')).body;
  expect(items[0]).toMatchObject({ name: 'Eggs', quantity: 12 });
  const detail = (await h().get(`/api/items/${items[0].id}`)).body;
  expect(detail.batches[0]).toMatchObject({ source: 'bought', price: 6, purchased_on: '2026-10-07', date_stored: '2026-10-07' });
  expect((await h().get('/api/shopping')).body).toHaveLength(0);
});

it('clear checked can be undone', async () => {
  t = makeTestContext();
  const h = t.http;
  const a = (await h().post('/api/shopping').send({ name: 'Tea', checked: true })).body;
  await h().post('/api/shopping').send({ name: 'Coffee' });
  const cleared = (await h().post('/api/shopping/clear-checked')).body;
  expect(cleared.ids).toEqual([a.id]);
  expect((await h().get('/api/shopping')).body.map(i => i.name)).toEqual(['Coffee']);
  await h().post('/api/shopping/restore-many').send({ stamp: cleared.stamp });
  expect((await h().get('/api/shopping')).body).toHaveLength(2);
});

const cats = async h => Object.fromEntries((await h().get('/api/categories')).body.filter(c => c.kind === 'shopping').map(c => [c.name, c.id]));

it('gives out-of-stock items their mapped shopping category', async () => {
  t = makeTestContext();
  const h = t.http;
  const dairy = (await h().get('/api/categories')).body.find(c => c.name === 'Dairy & Eggs' && c.kind === 'item');
  const item = (await h().post('/api/items').send({ store_id: 1, name: 'Butter', unit: 'cup', category_id: dairy.id,
    first_batch: { quantity: 1, unit: 'cup' } })).body;
  const detail = (await h().get(`/api/items/${item.id}`)).body;
  await h().patch(`/api/batches/${detail.batches[0].id}`).send({ quantity: 0, used_up_at: new Date().toISOString() });
  const rec = (await h().post('/api/recipes').send({ title: 'Toast', servings: 1, ingredients: [{ name: 'Butter', quantity: 1, unit: 'cup' }] })).body;
  await h().post('/api/plan').send({ date: '2026-10-08', slot: 'lunch', recipe_id: rec.id });
  const built = (await h().post('/api/shopping/build').send({ from: '2026-10-06', to: '2026-10-12' })).body;
  expect(built[0]).toMatchObject({ name: 'Butter', category_id: (await cats(h))['Dairy & Eggs'], category_name: 'Dairy & Eggs' });
});

it('adds up an ingredient across plan entries and units', async () => {
  t = makeTestContext();
  const h = t.http;
  const a = (await h().post('/api/recipes').send({ title: 'A', servings: 1, ingredients: [{ name: 'Honey', quantity: 1, unit: 'cup' }] })).body;
  const b = (await h().post('/api/recipes').send({ title: 'B', servings: 1, ingredients: [{ name: 'honey', quantity: 16, unit: 'tbsp' }] })).body;
  await h().post('/api/plan').send({ date: '2026-10-08', slot: 'lunch', recipe_id: a.id });
  await h().post('/api/plan').send({ date: '2026-10-09', slot: 'lunch', recipe_id: b.id });
  const built = (await h().post('/api/shopping/build').send({ from: '2026-10-06', to: '2026-10-12' })).body;
  expect(built).toHaveLength(1);
  expect(built[0]).toMatchObject({ quantity: 2, unit: 'cup' });
});

it('omits ingredients that stock fully covers', async () => {
  t = makeTestContext();
  const h = t.http;
  await h().post('/api/items').send({ store_id: 3, name: 'Oats', unit: 'cup', first_batch: { quantity: 5, unit: 'cup' } });
  const rec = (await h().post('/api/recipes').send({ title: 'Porridge', servings: 1, ingredients: [{ name: 'Oats', quantity: 2, unit: 'cup' }] })).body;
  await h().post('/api/plan').send({ date: '2026-10-08', slot: 'breakfast', recipe_id: rec.id });
  expect((await h().post('/api/shopping/build').send({ from: '2026-10-06', to: '2026-10-12' })).body).toHaveLength(0);
});

it('keeps ticked plan rows on rebuild and replaces unticked ones', async () => {
  t = makeTestContext();
  const h = t.http;
  const rec = (await h().post('/api/recipes').send({ title: 'Soup', servings: 1, ingredients: [
    { name: 'Leeks', quantity: 2, unit: 'each' }, { name: 'Stock', quantity: 1, unit: 'cup' }] })).body;
  await h().post('/api/plan').send({ date: '2026-10-08', slot: 'supper', recipe_id: rec.id });
  const first = (await h().post('/api/shopping/build').send({ from: '2026-10-06', to: '2026-10-12' })).body;
  const leeks = first.find(i => i.name === 'Leeks');
  const stock = first.find(i => i.name === 'Stock');
  await h().patch(`/api/shopping/${leeks.id}`).send({ checked: true });
  const again = (await h().post('/api/shopping/build').send({ from: '2026-10-06', to: '2026-10-12' })).body;
  expect(again.map(i => i.id)).toContain(leeks.id);
  // The ticked leeks cover the need, so the rebuild doesn't add a second row for them.
  expect(again.filter(i => i.name === 'Leeks')).toHaveLength(1);
  expect(again.filter(i => i.name === 'Stock' && !i.checked)).toHaveLength(1);
  expect(stock).toBeTruthy();
});

it('subtracts ticked plan amounts from a rebuild, matching by name and unit family', async () => {
  t = makeTestContext();
  const h = t.http;
  const rec = (await h().post('/api/recipes').send({ title: 'Stew', servings: 1, ingredients: [
    { name: 'Carrots', quantity: 2, unit: 'lb' }, { name: 'Bay leaf', quantity: null }] })).body;
  await h().post('/api/plan').send({ date: '2026-10-08', slot: 'supper', recipe_id: rec.id });
  const first = (await h().post('/api/shopping/build').send({ from: '2026-10-06', to: '2026-10-12' })).body;
  const carrots = first.find(i => i.name === 'Carrots');
  const bay = first.find(i => i.name === 'Bay leaf');
  await h().patch(`/api/shopping/${carrots.id}`).send({ checked: true, quantity: 16, unit: 'oz' }); // only 1 lb bought so far
  await h().patch(`/api/shopping/${bay.id}`).send({ checked: true });
  const again = (await h().post('/api/shopping/build').send({ from: '2026-10-06', to: '2026-10-12' })).body;
  const open = again.filter(i => !i.checked);
  expect(open.map(i => [i.name, i.quantity, i.unit])).toEqual([['Carrots', 1, 'lb']]);
});

it('orders the list by shopping category and sends the category order', async () => {
  t = makeTestContext();
  const h = t.http;
  const cats = (await h().get('/api/categories?kind=shopping')).body;
  const produce = cats.find(c => c.name === 'Produce');
  const household = cats.find(c => c.name === 'Household');
  await h().post('/api/shopping').send({ name: 'Soap', category_id: household.id });
  await h().post('/api/shopping').send({ name: 'Leeks', category_id: produce.id });
  const rows = (await h().get('/api/shopping')).body;
  expect(rows.map(r => [r.name, r.category_sort])).toEqual([['Leeks', produce.sort_order], ['Soap', household.sort_order]]);
});

it('puts away into an existing item as a new batch', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = (await h().post('/api/items').send({ store_id: 1, name: 'Eggs', unit: 'each', first_batch: { quantity: 6, unit: 'each' } })).body;
  const s = (await h().post('/api/shopping').send({ name: 'eggs', quantity: 12, unit: 'each' })).body;
  await h().post('/api/shopping/put-away').send({ ids: [s.id], store_id: 1, today: '2026-10-07' });
  const items = (await h().get('/api/items?store_id=1')).body;
  expect(items).toHaveLength(1);
  const detail = (await h().get(`/api/items/${item.id}`)).body;
  expect(detail.batches).toHaveLength(2);
  expect(detail.quantity).toBe(18);
});
