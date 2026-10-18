import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';
import { rhythmStatus, seasonStart, nextSeason } from '../../server/services/rhythm.js';

let t;
afterEach(() => t?.cleanup());

const list = today => t.http().get(`/api/rhythms?today=${today}`).then(r => r.body);
const byName = async (today, name) => (await list(today)).find(r => r.name === name);

it('seeds the starter staples in order, none of them made yet', async () => {
  t = makeTestContext();
  const rows = await list('2026-10-17');
  expect(rows.length).toBeGreaterThanOrEqual(30);
  expect(rows[0]).toMatchObject({ name: 'Bread', every_min: 1, every_unit: 'weeks', state: 'new', last_made: null });
  // In October, autumn things are in season and due; summer things wait for next year.
  expect(rows.find(r => r.name === 'Apple butter')).toMatchObject({ state: 'due', in_season: true, due_from: '2026-09-01' });
  expect(rows.find(r => r.name === 'Pesto')).toMatchObject({ state: 'later', in_season: false, next_season: '2027-06-01' });
});

it('works out when a repeat staple is due, then overdue', () => {
  const r = { every_min: 2, every_max: 4, every_unit: 'weeks' };
  expect(rhythmStatus(r, { lastMade: '2026-10-01' }, '2026-10-10')).toMatchObject({ state: 'later', due_from: '2026-10-15', due_to: '2026-10-29' });
  expect(rhythmStatus(r, { lastMade: '2026-10-01' }, '2026-10-20').state).toBe('due');
  expect(rhythmStatus(r, { lastMade: '2026-10-01' }, '2026-10-30').state).toBe('overdue');
  expect(rhythmStatus({ every_min: 1, every_unit: 'years' }, { lastMade: '2026-03-10' }, '2026-10-10').due_from).toBe('2027-03-10');
});

it('handles seasons that run over the new year', () => {
  const winter = new Set([12, 1, 2]);
  expect(seasonStart('2027-01-15', winter)).toBe('2026-12-01');
  expect(seasonStart('2026-10-15', winter)).toBeNull();
  expect(nextSeason('2026-10-15', winter)).toBe('2026-12-01');
  expect(nextSeason('2027-01-15', winter)).toBe('2027-12-01');
  const r = { season_months: '12,1,2' };
  expect(rhythmStatus(r, { lastMade: '2026-12-20' }, '2027-01-15').state).toBe('later');
  expect(rhythmStatus(r, { lastMade: '2026-02-20' }, '2027-01-15').state).toBe('due');
});

it('logs a make and takes it back', async () => {
  t = makeTestContext();
  const ghee = await byName('2026-10-17', 'Ghee');
  const made = (await t.http().post(`/api/rhythms/${ghee.id}/made`).send({ made_on: '2026-10-17' })).body;
  expect(await byName('2026-10-17', 'Ghee')).toMatchObject({ state: 'later', last_made: '2026-10-17', due_from: '2026-10-31' });
  await t.http().delete(made.undo);
  expect((await byName('2026-10-17', 'Ghee')).last_made).toBeNull();
});

it('a harvest makes its staples due, until one is made', async () => {
  t = makeTestContext();
  const h = t.http;
  await h().post('/api/harvests').send({ crop: 'Tomato', quantity: 6, unit: 'lb', harvested_on: '2026-10-14', source: 'garden app' });
  const canned = await byName('2026-10-17', 'Canned tomatoes');
  expect(canned).toMatchObject({ state: 'harvest', harvest: { crop: 'Tomato', quantity: 6, unit: 'lb', harvested_on: '2026-10-14' } });
  expect((await byName('2026-10-17', 'Salsa')).state).toBe('harvest');
  await h().post(`/api/rhythms/${canned.id}/made`).send({ made_on: '2026-10-15' });
  expect((await byName('2026-10-17', 'Canned tomatoes')).state).toBe('later');
  // Two weeks on, the harvest no longer counts.
  expect((await byName('2026-10-29', 'Salsa')).state).toBe('new');
});

it('a home-grown batch on the shelves counts as a harvest', async () => {
  t = makeTestContext();
  const h = t.http;
  const cellar = (await h().get('/api/stores')).body.find(s => s.name === 'Root Cellar');
  const item = (await h().post('/api/items').send({ store_id: cellar.id, name: 'Apples', unit: 'lb' })).body;
  await h().post('/api/batches').send({ item_id: item.id, quantity: 20, unit: 'lb', source: 'home-grown', date_stored: '2026-10-16' });
  expect((await byName('2026-10-17', 'Apple butter')).harvest).toMatchObject({ crop: 'Apples', quantity: 20 });
});

it('a planned staple ticked done logs a make, and unticking or removing it takes it back', async () => {
  t = makeTestContext();
  const h = t.http;
  const yogurt = await byName('2026-10-17', 'Yogurt');
  const e = (await h().post('/api/plan').send({ date: '2026-10-19', slot: 'batch', note: 'Yogurt', rhythm_id: yogurt.id })).body;
  await h().patch(`/api/plan/${e.id}`).send({ done_on: '2026-10-19' });
  expect((await byName('2026-10-20', 'Yogurt')).last_made).toBe('2026-10-19');
  await h().patch(`/api/plan/${e.id}`).send({ done_on: '2026-10-20' });
  expect((await h().get(`/api/rhythm-log?rhythm_id=${yogurt.id}`)).body.map(l => l.made_on)).toEqual(['2026-10-20']);
  const del = (await h().delete(`/api/plan/${e.id}`)).body;
  expect((await byName('2026-10-20', 'Yogurt')).last_made).toBeNull();
  await h().post(del.restore);
  expect((await byName('2026-10-20', 'Yogurt')).last_made).toBe('2026-10-20');
  await h().patch(`/api/plan/${e.id}`).send({ done_on: null });
  expect((await byName('2026-10-20', 'Yogurt')).last_made).toBeNull();
  expect((await h().post('/api/plan').send({ date: '2026-10-19', slot: 'batch', note: 'x', rhythm_id: 9999 })).status).toBe(400);
});

it('adds, edits and checks a staple of her own', async () => {
  t = makeTestContext();
  const h = t.http;
  const add = body => h().post('/api/rhythms').send(body);
  expect((await add({ name: 'Granola' })).status).toBe(400);
  expect((await add({ name: 'Granola', every_min: 2 })).status).toBe(400);
  expect((await add({ name: 'Granola', every_min: 3, every_max: 2, every_unit: 'weeks' })).status).toBe(400);
  expect((await add({ name: 'Elderflower cordial', season_months: '5,13' })).status).toBe(400);
  const g = (await add({ name: 'Granola', every_min: 2, every_unit: 'weeks', crops: 'Oats' })).body;
  const rows = await list('2026-10-17');
  expect(rows.at(-1)).toMatchObject({ name: 'Granola', state: 'new' });
  expect((await h().patch(`/api/rhythms/${g.id}`).send({ every_min: null, season_months: '6,7' })).status).toBe(200);
  expect((await h().patch(`/api/rhythms/${g.id}`).send({ season_months: null })).status).toBe(400);
});

it('the Hearth lists what is due this week, most pressing first', async () => {
  t = makeTestContext();
  const h = t.http;
  const rows = await list('2026-10-17');
  const id = name => rows.find(r => r.name === name).id;
  await h().post(`/api/rhythms/${id('Bread')}/made`).send({ made_on: '2026-10-01' }); // overdue
  await h().post(`/api/rhythms/${id('Ghee')}/made`).send({ made_on: '2026-10-05' }); // due from 19 Oct, within the week
  await h().post(`/api/rhythms/${id('Mustard')}/made`).send({ made_on: '2026-10-16' }); // not for a while
  await h().post('/api/harvests').send({ crop: 'Basil', harvested_on: '2026-10-16' });
  const due = (await h().get('/api/home?today=2026-10-17')).body.due_soon.map(r => [r.name, r.state]);
  expect(due.slice(0, 2)).toEqual([['Pesto', 'harvest'], ['Bread', 'overdue']]);
  expect(due).toContainEqual(['Ghee', 'later']);
  expect(due.map(d => d[0])).not.toContain('Mustard');
  expect(due.map(d => d[0])).not.toContain('Yogurt');
});
