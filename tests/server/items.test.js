import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';

let t;
afterEach(() => t?.cleanup());

async function addItem(h, body) {
  const res = await h().post('/api/items').send(body);
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body;
}

it('creates an item with a first batch and sums stock across batches', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = await addItem(h, {
    store_id: 1, name: 'Apple butter', unit: 'jar', low_threshold: 2,
    first_batch: { quantity: 6, unit: 'jar', source: 'preserved', method: 'water bath', container: 'half-pint jar',
      container_count: 6, date_stored: '2026-09-20', use_by: '2027-09-20', batch_code: 'AB-0926' },
  });
  await h().post('/api/batches').send({ item_id: item.id, quantity: 2, unit: 'jar', source: 'bought', price: 9.5, vendor: 'Market', purchased_on: '2026-10-01', use_by: '2026-11-02' });
  const list = (await h().get('/api/items?store_id=1')).body;
  expect(list).toHaveLength(1);
  expect(list[0]).toMatchObject({ name: 'Apple butter', quantity: 8, batch_count: 2, next_use_by: '2026-11-02', is_low: false });
  expect(list[0].sources.sort()).toEqual(['bought', 'preserved']);
});

it('flags low stock and filters by source and search', async () => {
  t = makeTestContext();
  const h = t.http;
  await addItem(h, { store_id: 2, name: 'Russet potatoes', unit: 'lb', low_threshold: 5, first_batch: { quantity: 3, unit: 'lb', source: 'home-grown' } });
  await addItem(h, { store_id: 2, name: 'Carrots', unit: 'lb', first_batch: { quantity: 4, unit: 'lb', source: 'bought' } });
  expect((await h().get('/api/items?low=1')).body.map(i => i.name)).toEqual(['Russet potatoes']);
  expect((await h().get('/api/items?source=bought')).body.map(i => i.name)).toEqual(['Carrots']);
  expect((await h().get('/api/items?q=russ')).body).toHaveLength(1);
});

it('converts batch units into the item unit', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = await addItem(h, { store_id: 3, name: 'Flour', unit: 'lb', first_batch: { quantity: 5, unit: 'lb' } });
  await h().post('/api/batches').send({ item_id: item.id, quantity: 16, unit: 'oz' });
  const [row] = (await h().get('/api/items')).body;
  expect(row.quantity).toBeCloseTo(6, 2);
});

it('item detail shows batches and price history; used-up batches drop out of stock', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = await addItem(h, { store_id: 3, name: 'Honey', unit: 'jar', first_batch: { quantity: 2, unit: 'jar', price: 12, purchased_on: '2026-09-01', source: 'bought' } });
  const detail = (await h().get(`/api/items/${item.id}`)).body;
  expect(detail.batches).toHaveLength(1);
  expect(detail.price_history[0]).toMatchObject({ price: 12, quantity: 2 });
  await h().post(`/api/batches/${detail.batches[0].id}/used-up`);
  expect((await h().get(`/api/items/${item.id}`)).body.quantity).toBe(0);
});

it('rejects a use-by before the stored date', async () => {
  t = makeTestContext();
  const item = await addItem(t.http, { store_id: 1, name: 'Pickles' });
  const res = await t.http().post('/api/batches').send({ item_id: item.id, quantity: 1, date_stored: '2026-10-01', use_by: '2026-09-01' });
  expect(res.status).toBe(400);
  expect(res.body.details.use_by).toMatch(/before/);
});

it('delete and undo an item', async () => {
  t = makeTestContext();
  const item = await addItem(t.http, { store_id: 1, name: 'Jam' });
  const del = await t.http().delete(`/api/items/${item.id}`);
  expect((await t.http().get('/api/items')).body).toHaveLength(0);
  await t.http().post(del.body.restore);
  expect((await t.http().get('/api/items')).body).toHaveLength(1);
});
