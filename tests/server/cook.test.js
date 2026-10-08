import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';

let t;
afterEach(() => t?.cleanup());

it('takes from the soonest use-by batch first and logs the cook', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = (await h().post('/api/items').send({ store_id: 2, name: 'Potatoes', unit: 'lb',
    first_batch: { quantity: 3, unit: 'lb', use_by: '2026-12-01' } })).body;
  await h().post('/api/batches').send({ item_id: item.id, quantity: 5, unit: 'lb', use_by: '2026-10-20' });
  const { id } = (await h().post('/api/recipes').send({ title: 'Mash', servings: 4,
    ingredients: [{ name: 'Potato', quantity: 6, unit: 'lb' }, { name: 'Chives', quantity: 1, unit: 'tbsp' }] })).body;
  const preview = (await h().post(`/api/recipes/${id}/cook/preview`).send({ servings: 4 })).body;
  expect(preview.deductions.map(d => [d.take, d.available])).toEqual([[5, 5], [1, 3]]);
  expect(preview.unmatched).toEqual(['Chives']);
  const log = await h().post(`/api/recipes/${id}/cook`).send({
    servings: 4, cooked_on: '2026-10-07',
    deductions: preview.deductions.map(d => ({ batch_id: d.batch_id, take: d.take })),
  });
  expect(log.status).toBe(201);
  const detail = (await h().get(`/api/items/${item.id}`)).body;
  expect(detail.quantity).toBe(2);
  expect(detail.batches.find(b => b.use_by === '2026-10-20').used_up_at).toBeTruthy();
  expect((await h().get(`/api/recipes/${id}`)).body).toMatchObject({ times_made: 1, last_made: '2026-10-07' });
});

it('rolls back if a deduction is invalid', async () => {
  t = makeTestContext();
  const { id } = (await t.http().post('/api/recipes').send({ title: 'X' })).body;
  const res = await t.http().post(`/api/recipes/${id}/cook`).send({ servings: 1, cooked_on: '2026-10-07', deductions: [{ batch_id: 999, take: 1 }] });
  expect(res.status).toBe(400);
  expect((await t.http().get(`/api/recipes/${id}`)).body.times_made).toBe(0);
});

it('rejects malformed deductions and skips zero takes', async () => {
  t = makeTestContext();
  const item = (await t.http().post('/api/items').send({ store_id: 2, name: 'Rice', unit: 'cup', first_batch: { quantity: 2, unit: 'cup' } })).body;
  const batch_id = (await t.http().get(`/api/items/${item.id}`)).body.batches[0].id;
  const { id } = (await t.http().post('/api/recipes').send({ title: 'Pilaf' })).body;
  const cook = deductions => t.http().post(`/api/recipes/${id}/cook`).send({ servings: 1, cooked_on: '2026-10-07', deductions });
  expect((await cook('nope')).status).toBe(400);
  expect((await cook(['x'])).status).toBe(400);
  expect((await cook([{ batch_id, take: '' }])).status).toBe(400);
  expect((await cook([{ batch_id, take: null }])).status).toBe(400);
  expect((await cook([{ batch_id, take: 'abc' }])).status).toBe(400);
  expect((await cook([{ batch_id, take: 0 }])).status).toBe(201);
  expect((await t.http().get(`/api/items/${item.id}`)).body.quantity).toBe(2);
});

it('uses a fully consumed batch up exactly, even with an awkward quantity', async () => {
  t = makeTestContext();
  const item = (await t.http().post('/api/items').send({ store_id: 2, name: 'Sugar', unit: 'cup', first_batch: { quantity: 0.333, unit: 'cup' } })).body;
  const { id } = (await t.http().post('/api/recipes').send({ title: 'Syrup', servings: 1, ingredients: [{ name: 'Sugar', quantity: 1, unit: 'cup' }] })).body;
  const preview = (await t.http().post(`/api/recipes/${id}/cook/preview`).send({ servings: 1 })).body;
  expect(preview.deductions[0].take).toBe(0.333);
  await t.http().post(`/api/recipes/${id}/cook`).send({
    servings: 1, cooked_on: '2026-10-07', deductions: preview.deductions.map(d => ({ batch_id: d.batch_id, take: d.take })),
  });
  const detail = (await t.http().get(`/api/items/${item.id}`)).body;
  expect(detail.quantity).toBe(0);
  expect(detail.batches[0].used_up_at).toBeTruthy();
});

it('rejects non-positive servings', async () => {
  t = makeTestContext();
  const { id } = (await t.http().post('/api/recipes').send({ title: 'X', servings: 2 })).body;
  expect((await t.http().get(`/api/recipes/${id}?servings=-2`)).status).toBe(400);
  expect((await t.http().get(`/api/recipes/${id}?servings=abc`)).status).toBe(400);
  expect((await t.http().post(`/api/recipes/${id}/cook/preview`).send({ servings: -2 })).status).toBe(400);
  expect((await t.http().get(`/api/recipes/${id}?servings=`)).status).toBe(400);
  expect((await t.http().post(`/api/recipes/${id}/cook/preview`).send({ servings: 0 })).status).toBe(400);
  expect((await t.http().get(`/api/recipes/${id}?servings=4`)).status).toBe(200);
});

it('deleting a cook log puts the stock back, and restoring it takes it again', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = (await h().post('/api/items').send({ store_id: 2, name: 'Potatoes', unit: 'lb',
    first_batch: { quantity: 3, unit: 'lb', use_by: '2026-12-01' } })).body;
  await h().post('/api/batches').send({ item_id: item.id, quantity: 5, unit: 'lb', use_by: '2026-10-20' });
  const { id } = (await h().post('/api/recipes').send({ title: 'Mash', servings: 4, ingredients: [{ name: 'Potato', quantity: 6, unit: 'lb' }] })).body;
  const preview = (await h().post(`/api/recipes/${id}/cook/preview`).send({ servings: 4 })).body;
  // Ask for more than the second batch holds: only what was really taken is recorded.
  const log = (await h().post(`/api/recipes/${id}/cook`).send({ servings: 4, cooked_on: '2026-10-07',
    deductions: [{ batch_id: preview.deductions[0].batch_id, take: 5 }, { batch_id: preview.deductions[1].batch_id, take: 1 }] })).body;
  const rows = t.ctx.db.prepare('SELECT batch_id, amount, was_used_up FROM cook_deductions WHERE cook_log_id = ? ORDER BY id').all(log.id);
  expect(rows.map(r => [r.amount, r.was_used_up])).toEqual([[5, 1], [1, 0]]);
  const stock = async () => (await h().get(`/api/items/${item.id}`)).body.batches.map(b => [b.quantity, Boolean(b.used_up_at)]).sort();
  expect(await stock()).toEqual([[0, true], [2, false]]);

  const del = await h().delete(`/api/cook-log/${log.id}`);
  expect(del.status).toBe(200);
  expect(await stock()).toEqual([[3, false], [5, false]]);
  expect((await h().get(`/api/recipes/${id}`)).body.times_made).toBe(0);

  expect((await h().post(del.body.restore)).status).toBe(200);
  expect(await stock()).toEqual([[0, true], [2, false]]);
  expect((await h().get(`/api/cook-log?recipe_id=${id}`)).body).toHaveLength(1);
});

it('restoring a cook log takes only what is left if the shelves changed meanwhile', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = (await h().post('/api/items').send({ store_id: 2, name: 'Oats', unit: 'cup', first_batch: { quantity: 4, unit: 'cup' } })).body;
  const batch_id = item.batches[0].id;
  const { id } = (await h().post('/api/recipes').send({ title: 'Porridge', servings: 1 })).body;
  const log = (await h().post(`/api/recipes/${id}/cook`).send({ servings: 1, cooked_on: '2026-10-07', deductions: [{ batch_id, take: 3 }] })).body;
  const del = (await h().delete(`/api/cook-log/${log.id}`)).body;
  await h().patch(`/api/batches/${batch_id}`).send({ quantity: 1 });
  await h().post(del.restore);
  const b = (await h().get(`/api/items/${item.id}`)).body.batches[0];
  expect(b.quantity).toBe(0);
  expect(b.used_up_at).toBeTruthy();
  // Deleting again gives back exactly what the restore took.
  await h().delete(`/api/cook-log/${log.id}`);
  expect((await h().get(`/api/items/${item.id}`)).body.batches[0]).toMatchObject({ quantity: 1, used_up_at: null });
});
