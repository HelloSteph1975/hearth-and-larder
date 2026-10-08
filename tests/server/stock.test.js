import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';
import { GALETTE } from './fixtures.js';

let t;
afterEach(() => t?.cleanup());

async function stock(h, store_id, name, unit, quantity, extra = {}) {
  return (await h().post('/api/items').send({ store_id, name, unit, first_batch: { quantity, unit, ...extra } })).body;
}

it('marks ingredients have / partial / missing / staple and scales', async () => {
  t = makeTestContext();
  const h = t.http;
  await stock(h, 3, 'Flour', 'cup', 10);
  await stock(h, 2, 'Russet potato', 'lb', 1);
  const { id } = (await h().post('/api/recipes').send(GALETTE)).body;
  const r = (await h().get(`/api/recipes/${id}`)).body;
  const by = Object.fromEntries(r.status.ingredients.map(i => [i.name, i.status]));
  expect(by).toEqual({ Flour: 'have', Butter: 'missing', 'Russet potatoes': 'partial', Salt: 'staple' });
  expect(r.status.can_make).toBe(false);
  expect(r.status.missing_names).toEqual(['Butter', 'Russet potatoes']);
  const half = (await h().get(`/api/recipes/${id}?servings=2`)).body;
  expect(half.status.ingredients[2]).toMatchObject({ scaled_quantity: 1, status: 'have' });
});

it('flags mismatched unit families as check', async () => {
  t = makeTestContext();
  await stock(t.http, 3, 'Butter', 'lb', 2);
  const { id } = (await t.http().post('/api/recipes').send({ title: 'Toast', ingredients: [{ name: 'Butter', quantity: 2, unit: 'cup' }] })).body;
  expect((await t.http().get(`/api/recipes/${id}`)).body.status.ingredients[0].status).toBe('check');
});

it('can-make sorts recipes by fewest missing', async () => {
  t = makeTestContext();
  await stock(t.http, 3, 'Oats', 'cup', 5);
  await t.http().post('/api/recipes').send({ title: 'Porridge', ingredients: [{ name: 'Oats', quantity: 1, unit: 'cup' }] });
  await t.http().post('/api/recipes').send(GALETTE);
  const list = (await t.http().get('/api/can-make')).body;
  expect(list.map(r => r.title)).toEqual(['Porridge', GALETTE.title]);
  expect(list[0].status.can_make).toBe(true);
});

it('counts repeated ingredient lines against the same stock', async () => {
  t = makeTestContext();
  await stock(t.http, 3, 'Flour', 'cup', 3);
  const { id } = (await t.http().post('/api/recipes').send({ title: 'Pie', servings: 1, ingredients: [
    { name: 'Flour', quantity: 2, unit: 'cup' }, { name: 'Flour', quantity: 2, unit: 'cup' }, { name: 'flour', quantity: 1, unit: 'cup', optional: true }] })).body;
  const s = (await t.http().get(`/api/recipes/${id}`)).body.status;
  expect(s.ingredients.map(i => [i.status, i.have])).toEqual([['have', 3], ['partial', 1], ['missing', 0]]);
  expect(s.can_make).toBe(false);
  expect(s.missing_names).toEqual(['Flour']);
});

it('serves required lines before optional ones when stock is shared', async () => {
  t = makeTestContext();
  await stock(t.http, 3, 'Butter', 'cup', 1);
  const { id } = (await t.http().post('/api/recipes').send({ title: 'Toast', servings: 1, ingredients: [
    { name: 'Butter', quantity: 1, unit: 'cup', optional: true }, { name: 'Butter', quantity: 1, unit: 'cup' }] })).body;
  const s = (await t.http().get(`/api/recipes/${id}`)).body.status;
  expect(s.ingredients.map(i => i.status)).toEqual(['missing', 'have']);
  expect(s.can_make).toBe(true);
});
