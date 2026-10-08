import { it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeTestContext } from './helpers.js';
import { loadConfig } from '../../server/config.js';
import { backupNow, restoreBackup } from '../../server/services/backup.js';

let t;
const tmpDirs = [];
afterEach(() => {
  t?.cleanup();
  while (tmpDirs.length) fs.rmSync(tmpDirs.pop(), { recursive: true, force: true });
});
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]);

const upload = (h, ownerType, ownerId) => h().post('/api/photos').field('owner_type', ownerType).field('owner_id', String(ownerId))
  .attach('file', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' });

it('refuses data changes from another site and requests that name another host', async () => {
  t = makeTestContext();
  const h = t.http;
  expect((await h().post('/api/items').set('Origin', 'https://evil.example').send({ store_id: 1, name: 'Jam' })).status).toBe(403);
  expect((await h().post('/api/items').set('Origin', 'null').send({ store_id: 1, name: 'Jam' })).status).toBe(403);
  expect((await h().get('/api/items').set('Host', 'evil.example')).status).toBe(403);
  expect((await h().get('/photos/1-abcdef12.jpg').set('Host', 'evil.example:4193')).status).toBe(403);
  // Reads may come from anywhere on this computer; a local Origin may write.
  expect((await h().get('/api/items').set('Origin', 'https://evil.example')).status).toBe(200);
  expect((await h().post('/api/items').set('Origin', 'http://localhost:4193').send({ store_id: 1, name: 'Jam' })).status).toBe(201);
  expect((await h().get('/api/items').set('Host', 'localhost:4193')).status).toBe(200);
  expect((await h().get('/api/items')).status).toBe(200);
});

it('serves only app-named photo files, with nosniff', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = (await h().post('/api/items').send({ store_id: 1, name: 'Jam' })).body;
  const photo = (await upload(h, 'item', item.id)).body;
  const ok = await h().get(`/photos/${photo.filename}`);
  expect(ok.status).toBe(200);
  expect(ok.headers['x-content-type-options']).toBe('nosniff');
  fs.writeFileSync(path.join(t.dataDir, 'photos', 'notes.html'), '<script>alert(1)</script>');
  fs.writeFileSync(path.join(t.dataDir, 'photos', '1-abcdef12.svg'), '<svg/>');
  for (const p of ['notes.html', '1-abcdef12.svg', `_trash/${photo.filename}`, `x/${photo.filename}`, '1-abcdef12.jpg']) {
    expect((await h().get(`/photos/${p}`)).status, p).toBe(404);
  }
});

it('treats inherited property names as unknown in lookup maps', async () => {
  t = makeTestContext();
  const h = t.http;
  for (const owner of ['constructor', '__proto__', 'toString']) {
    expect((await upload(h, owner, 1)).status, owner).toBe(400);
  }
  for (const key of ['toString', '__proto__', 'constructor']) {
    const res = await h().put('/api/settings').set('Content-Type', 'application/json').send(`{"${key}":"1"}`);
    expect(res.status, key).toBe(400);
  }
  expect((await h().get('/api/items?sort=constructor')).status).toBe(200);
});

it('ignores unknown item filters', async () => {
  t = makeTestContext();
  await t.http().post('/api/items').send({ store_id: 1, name: 'Jam' });
  const res = await t.http().get('/api/items?ids=1&deleted_at=x');
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(1);
  expect((await t.http().get('/api/items?q=Ja&store_id=1')).body).toHaveLength(1);
});

it('explains a broken config.json and a bad port', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-cfg-'));
  tmpDirs.push(root);
  fs.writeFileSync(path.join(root, 'config.json'), '{ "dataDir": "D:\\Kitchen Data" }');
  expect(() => loadConfig({ env: {}, root })).toThrow(/config\.json.*double backslashes in Windows paths \(\\\\\)/s);
  fs.writeFileSync(path.join(root, 'config.json'), '{ "port": "abc" }');
  expect(() => loadConfig({ env: {}, root })).toThrow(/1 to 65535/);
  fs.writeFileSync(path.join(root, 'config.json'), '{ "port": 70000 }');
  expect(() => loadConfig({ env: {}, root })).toThrow(/1 to 65535/);
  fs.writeFileSync(path.join(root, 'config.json'), '{ "port": 4197 }');
  expect(loadConfig({ env: {}, root }).port).toBe(4197);
  expect(() => loadConfig({ env: { HEARTH_PORT: '0' }, root })).toThrow(/HEARTH_PORT/);
  expect(() => loadConfig({ env: { HEARTH_PORT: '41.5' }, root })).toThrow(/HEARTH_PORT/);
  expect(() => loadConfig({ env: { HEARTH_DEMO_PORT: 'x' }, root, demo: true })).toThrow(/HEARTH_DEMO_PORT/);
});

it('keeps an untouched batch\'s starting amount in step with edits', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = (await h().post('/api/items').send({ store_id: 1, name: 'Jam', unit: 'jar', first_batch: { quantity: 4 } })).body;
  const b = item.batches[0];
  expect((await h().patch(`/api/batches/${b.id}`).send({ quantity: 6 })).body).toMatchObject({ quantity: 6, initial_quantity: 6 });
  t.ctx.db.prepare('UPDATE batches SET quantity = 5 WHERE id = ?').run(b.id); // some was used
  expect((await h().patch(`/api/batches/${b.id}`).send({ quantity: 3 })).body).toMatchObject({ quantity: 3, initial_quantity: 6 });
  expect((await h().patch(`/api/batches/${b.id}`).send({ notes: 'top shelf' })).body).toMatchObject({ quantity: 3, initial_quantity: 6 });
});

it('does not count batches of deleted items on the home screen', async () => {
  t = makeTestContext();
  const h = t.http;
  const keep = (await h().post('/api/items').send({ store_id: 1, name: 'Jam', first_batch: { quantity: 1 } })).body;
  const gone = (await h().post('/api/items').send({ store_id: 1, name: 'Pickles', first_batch: { quantity: 1 } })).body;
  await h().delete(`/api/items/${gone.id}`);
  expect(keep.id).toBeTruthy();
  expect((await h().get('/api/home?today=2026-10-07')).body.counts.batches).toBe(1);
});

it('brings trashed photos back when a restore needs them', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = (await h().post('/api/items').send({ store_id: 1, name: 'Jam' })).body;
  const photo = (await upload(h, 'item', item.id)).body;
  const { name } = backupNow(t.ctx.db, t.dataDir);
  await h().delete(`/api/photos/${photo.id}`);
  const live = path.join(t.dataDir, 'photos', photo.filename);
  expect(fs.existsSync(live)).toBe(false);
  const r = restoreBackup(t.ctx, name);
  expect(r.photosBack).toBe(1);
  expect(fs.existsSync(live)).toBe(true);
  expect((await h().get(`/photos/${photo.filename}`)).status).toBe(200);
});
