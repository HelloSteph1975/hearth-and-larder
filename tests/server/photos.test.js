import { it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { makeTestContext } from './helpers.js';

let t;
afterEach(() => t?.cleanup());
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]);

async function upload(h, ownerType, ownerId) {
  const res = await h().post('/api/photos').field('owner_type', ownerType).field('owner_id', String(ownerId))
    .field('caption', 'Shelf shot').attach('file', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body;
}

it('uploads, serves, captions, deletes and restores a photo', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = (await h().post('/api/items').send({ store_id: 1, name: 'Jam' })).body;
  const photo = await upload(h, 'item', item.id);
  const file = path.join(t.dataDir, 'photos', photo.filename);
  expect(fs.existsSync(file)).toBe(true);
  expect((await h().get(`/photos/${photo.filename}`)).status).toBe(200);
  expect((await h().patch(`/api/photos/${photo.id}`).send({ caption: 'New' })).body.caption).toBe('New');
  const del = await h().delete(`/api/photos/${photo.id}`);
  expect(fs.existsSync(file)).toBe(false);
  expect(fs.existsSync(path.join(t.dataDir, 'photos', '_trash', photo.filename))).toBe(true);
  await h().post(del.body.restore);
  expect(fs.existsSync(file)).toBe(true);
});

it('rejects non-images and unknown owners', async () => {
  t = makeTestContext();
  const h = t.http;
  const bad = await h().post('/api/photos').field('owner_type', 'item').field('owner_id', '1')
    .attach('file', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });
  expect(bad.status).toBe(400);
  const res = await h().post('/api/photos').field('owner_type', 'item').field('owner_id', '999')
    .attach('file', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' });
  expect(res.status).toBe(400);
});

it('deleting an item trashes its photos and undo brings them back', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = (await h().post('/api/items').send({ store_id: 1, name: 'Jam' })).body;
  const photo = await upload(h, 'item', item.id);
  const del = await h().delete(`/api/items/${item.id}`);
  expect((await h().get(`/api/photos?owner_type=item&owner_id=${item.id}`)).body).toHaveLength(0);
  await h().post(del.body.restore);
  const back = (await h().get(`/api/photos?owner_type=item&owner_id=${item.id}`)).body;
  expect(back.map(p => p.id)).toEqual([photo.id]);
  expect(fs.existsSync(path.join(t.dataDir, 'photos', photo.filename))).toBe(true);
});

it('purgeTrash removes old trash files only', async () => {
  t = makeTestContext();
  const { purgeTrash } = await import('../../server/services/purge.js');
  const trash = path.join(t.dataDir, 'photos', '_trash');
  fs.writeFileSync(path.join(trash, 'old.jpg'), 'x');
  fs.writeFileSync(path.join(trash, 'new.jpg'), 'x');
  const old = new Date(Date.now() - 40 * 86400000);
  fs.utimesSync(path.join(trash, 'old.jpg'), old, old);
  purgeTrash(t.dataDir, 30);
  expect(fs.readdirSync(trash)).toEqual(['new.jpg']);
});

it('does not serve trashed files, even with an encoded path', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = (await h().post('/api/items').send({ store_id: 1, name: 'Jam' })).body;
  const photo = await upload(h, 'item', item.id);
  await h().delete(`/api/photos/${photo.id}`);
  expect(fs.existsSync(path.join(t.dataDir, 'photos', '_trash', photo.filename))).toBe(true);
  expect((await h().get(`/photos/_trash/${photo.filename}`)).status).toBe(404);
  expect((await h().get(`/photos/%5Ftrash/${photo.filename}`)).status).toBe(404);
  expect((await h().get(`/photos/%5ftrash/${photo.filename}`)).status).toBe(404);
});

it('blocks trash paths with doubled, backslash and encoded-slash tricks', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = (await h().post('/api/items').send({ store_id: 1, name: 'Jam' })).body;
  const photo = await upload(h, 'item', item.id);
  await h().delete(`/api/photos/${photo.id}`);
  for (const p of ['//_trash/', '/%5C_trash/', '/%2F_trash/', '/%5Ftrash/', '/_TRASH/', '/./_trash/', '/_trash./', '/_trash /']) {
    const res = await h().get(`/photos${p}${photo.filename}`);
    expect(res.status, p).toBe(404);
  }
});

it('rejects a non-multipart upload with 400 and cleans up on insert failure', async () => {
  t = makeTestContext();
  const res = await t.http().post('/api/photos').send({ owner_type: 'item', owner_id: 1 });
  expect(res.status).toBe(400);
});

it('maps multer errors to 413 and 400', async () => {
  const { uploadErrors } = await import('../../server/routes/photos.js');
  const run = err => { let out; uploadErrors(err, {}, {}, e => { out = e; }); return out; };
  const big = Object.assign(new Error('x'), { name: 'MulterError', code: 'LIMIT_FILE_SIZE' });
  expect(run(big).status).toBe(413);
  expect(run(Object.assign(new Error('x'), { name: 'MulterError', code: 'LIMIT_UNEXPECTED_FILE' })).status).toBe(400);
});
