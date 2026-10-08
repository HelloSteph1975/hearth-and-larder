import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';

let t;
afterEach(() => t?.cleanup());

it('GET /api/health reports ok', async () => {
  t = makeTestContext();
  const res = await t.http().get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ ok: true, demo: false });
});

it('unknown api routes return JSON 404', async () => {
  t = makeTestContext();
  const res = await t.http().get('/api/nope');
  expect(res.status).toBe(404);
  expect(res.body.error).toBeTruthy();
});
