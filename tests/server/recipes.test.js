import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';
import { GALETTE } from './fixtures.js';

let t;
afterEach(() => t?.cleanup());


it('saves a full recipe and reads it back in order', async () => {
  t = makeTestContext();
  const res = await t.http().post('/api/recipes').send(GALETTE);
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  const r = res.body;
  expect(r.tags).toEqual(['supper', 'vegetarian']);
  expect(r.ingredients.map(i => i.name)).toEqual(['Flour', 'Butter', 'Russet potatoes', 'Salt']);
  expect(r.steps.map(s => s.text)).toEqual(['Make the crust.', 'Layer the potatoes.']);
  expect(r).toMatchObject({ times_made: 0, last_made: null, calories: 310 });
});

it('PUT replaces ingredients and steps; PATCH toggles favorite', async () => {
  t = makeTestContext();
  const { id } = (await t.http().post('/api/recipes').send(GALETTE)).body;
  const put = await t.http().put(`/api/recipes/${id}`).send({ ...GALETTE, ingredients: [{ name: 'Leeks', quantity: 2 }], steps: ['One step.'] });
  expect(put.body.ingredients).toHaveLength(1);
  expect(put.body.steps).toHaveLength(1);
  expect((await t.http().patch(`/api/recipes/${id}`).send({ favorite: true })).body.favorite).toBe(1);
});

it('reports which ingredient is invalid', async () => {
  t = makeTestContext();
  const res = await t.http().post('/api/recipes').send({ title: 'Bad', ingredients: [{ name: 'Ok' }, { name: '' }] });
  expect(res.status).toBe(400);
  expect(res.body.details['ingredients.1.name']).toBe('Required');
});

it('cook log drives last made and times made', async () => {
  t = makeTestContext();
  const { id } = (await t.http().post('/api/recipes').send(GALETTE)).body;
  await t.http().post('/api/cook-log').send({ recipe_id: id, cooked_on: '2026-10-01', servings: 4 });
  await t.http().post('/api/cook-log').send({ recipe_id: id, cooked_on: '2026-10-05', servings: 2 });
  const r = (await t.http().get(`/api/recipes/${id}`)).body;
  expect(r).toMatchObject({ times_made: 2, last_made: '2026-10-05' });
  const list = (await t.http().get('/api/recipes?tag=vegetarian')).body;
  expect(list[0]).toMatchObject({ title: GALETTE.title, times_made: 2, total_minutes: 65 });
});

it('lists tags and filters by search; delete and undo', async () => {
  t = makeTestContext();
  const { id } = (await t.http().post('/api/recipes').send(GALETTE)).body;
  expect((await t.http().get('/api/recipes/tags')).body).toEqual(['supper', 'vegetarian']);
  expect((await t.http().get('/api/recipes?q=galette')).body).toHaveLength(1);
  const del = await t.http().delete(`/api/recipes/${id}`);
  expect((await t.http().get('/api/recipes')).body).toHaveLength(0);
  await t.http().post(del.body.restore);
  expect((await t.http().get('/api/recipes')).body).toHaveLength(1);
});

it('rejects ingredients, steps or tags that are not lists', async () => {
  t = makeTestContext();
  for (const key of ['ingredients', 'steps', 'tags']) {
    const res = await t.http().post('/api/recipes').send({ title: 'Bad', [key]: 'x' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain(key);
  }
});
