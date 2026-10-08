import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { crudRouter } from './crud.js';
import { repos } from '../db/repos.js';
import { HttpError } from '../http.js';
import { photoSchema } from '../schemas.js';
import { ALLOWED_TYPES, savePhotoFile, trashPhotoFile, restorePhotoFile } from '../services/photos.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const OWNER_TABLE = { item: 'items', batch: 'batches', recipe: 'recipes' };

export function uploadErrors(err, req, res, next) {
  if (err?.name === 'MulterError') {
    return next(err.code === 'LIMIT_FILE_SIZE'
      ? new HttpError(413, 'That photo is too big (15 MB max).')
      : new HttpError(400, 'That upload could not be read.'));
  }
  next(err);
}

const uploadFile = (req, res, next) => upload.single('file')(req, res, err => (err ? uploadErrors(err, req, res, next) : next()));

export function photosRouter(ctx) {
  const r = Router();
  r.post('/', uploadFile, (req, res) => {
    const body = req.body ?? {};
    const { owner_type, caption } = body;
    const owner_id = Number(body.owner_id);
    if (!req.file || !ALLOWED_TYPES.includes(req.file.mimetype)) throw new HttpError(400, 'Please choose a JPEG, PNG, WebP or GIF image.');
    const table = Object.hasOwn(OWNER_TABLE, owner_type) ? OWNER_TABLE[owner_type] : null;
    if (!table || !ctx.db.prepare(`SELECT id FROM ${table} WHERE id = ? AND deleted_at IS NULL`).get(owner_id)) {
      throw new HttpError(400, 'That photo has nothing to belong to.');
    }
    const filename = savePhotoFile(ctx.config.dataDir, req.file.buffer, req.file.mimetype);
    try {
    const sort_order = ctx.db.prepare('SELECT COUNT(*) n FROM photos WHERE owner_type = ? AND owner_id = ? AND deleted_at IS NULL').get(owner_type, owner_id).n;
    res.status(201).json(repos(ctx.db).photos.create({ owner_type, owner_id, filename, caption: typeof caption === 'string' ? caption.trim() || null : null, sort_order }));
    } catch (err) {
      try { fs.rmSync(path.join(ctx.config.dataDir, 'photos', filename), { force: true }); } catch {}
      throw err;
    }
  });
  r.use(crudRouter(ctx, {
    repo: db => repos(db).photos,
    schema: photoSchema,
    filters: ['owner_type', 'owner_id'],
    onDelete: (ctx, row) => trashPhotoFile(ctx.config.dataDir, row.filename),
    onRestore: (ctx, row) => restorePhotoFile(ctx.config.dataDir, row.filename),
  }));
  return r;
}
