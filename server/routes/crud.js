import { Router } from 'express';
import { check } from '../validate.js';
import { idParam, notFound } from '../http.js';
import { transaction } from '../db/connection.js';

const pick = (obj, keys) => Object.fromEntries(keys.filter(k => obj[k] !== undefined).map(k => [k, obj[k]]));

export function crudRouter(ctx, { repo, schema, filters = [], list, beforeDelete, onDelete, onRestore, prepareCreate = d => d, prepareUpdate = (ctx, d) => d, validateRow }) {
  const r = Router();
  const R = () => repo(ctx.db);

  r.get('/', (req, res) => res.json(list ? list(ctx, req) : R().list(pick(req.query, filters))));

  r.get('/:id', (req, res) => {
    const row = R().get(idParam(req));
    if (!row) throw notFound();
    res.json(row);
  });

  r.post('/', (req, res) => {
    const data = prepareCreate(check(schema, req.body));
    validateRow?.(ctx, data, null);
    res.status(201).json(R().create(data));
  });

  r.patch('/:id', (req, res) => {
    const id = idParam(req);
    const row = R().get(id);
    if (!row) throw notFound();
    const data = check(schema, req.body, { partial: true });
    validateRow?.(ctx, { ...row, ...data }, row);
    res.json(R().update(id, prepareUpdate(ctx, data, row)));
  });

  r.delete('/:id', (req, res) => {
    const id = idParam(req);
    const row = R().get(id);
    if (!row) throw notFound();
    const stamp = new Date().toISOString();
    transaction(ctx.db, () => {
      beforeDelete?.(ctx, row);
      R().remove(id, stamp);
      onDelete?.(ctx, row, stamp);
    });
    res.json({ ok: true, restore: `${req.baseUrl}/${id}/restore` });
  });

  r.post('/:id/restore', (req, res) => {
    const id = idParam(req);
    const row = R().get(id, { includeDeleted: true });
    if (!row || !row.deleted_at) throw notFound('Nothing to undo');
    transaction(ctx.db, () => {
      R().restore(id);
      onRestore?.(ctx, row);
    });
    res.json(R().get(id));
  });

  return r;
}
