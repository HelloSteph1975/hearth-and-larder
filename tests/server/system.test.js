import { it, expect, afterEach, vi } from 'vitest';
import { makeTestContext } from './helpers.js';

let t;
afterEach(() => t?.cleanup());

it('shutdown backs up then calls onShutdown', async () => {
  const onShutdown = vi.fn();
  t = makeTestContext({ onShutdown });
  const res = await t.http().post('/api/shutdown');
  expect(res.status).toBe(200);
  await new Promise(r => setTimeout(r, 20));
  expect(onShutdown).toHaveBeenCalled();
  expect((await t.http().get('/api/backups')).body).toHaveLength(1);
});

it('backup now and data folder path', async () => {
  t = makeTestContext();
  expect((await t.http().post('/api/backups')).status).toBe(201);
  expect((await t.http().get('/api/data-folder')).body.path).toBe(t.dataDir);
});

it('shutdown refuses a foreign Origin', async () => {
  const onShutdown = vi.fn();
  t = makeTestContext({ onShutdown });
  const res = await t.http().post('/api/shutdown').set('Origin', 'https://evil.example');
  expect(res.status).toBe(403);
  await new Promise(r => setTimeout(r, 20));
  expect(onShutdown).not.toHaveBeenCalled();
});
