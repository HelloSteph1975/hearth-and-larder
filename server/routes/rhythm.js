import { Router } from 'express';
import { crudRouter } from './crud.js';
import { transaction } from '../db/connection.js';
import { repos } from '../db/repos.js';
import { check } from '../validate.js';
import { HttpError, idParam, notFound } from '../http.js';
import { rhythmSchema, rhythmLogSchema, harvestSchema } from '../schemas.js';
import { listRhythms, logMade, rhythmErrors } from '../services/rhythm.js';

function checkRhythm(ctx, data) {
  const errors = rhythmErrors(data);
  if (errors) throw new HttpError(400, 'Please fix the highlighted fields.', errors);
}

export function rhythmsRouter(ctx) {
  const r = Router();
  r.get('/', (req, res) => {
    const { today } = check({ today: 'date!' }, req.query);
    res.json(listRhythms(ctx.db, today));
  });
  r.post('/', (req, res) => {
    const data = check(rhythmSchema, req.body);
    checkRhythm(ctx, data);
    if (data.sort_order == null) data.sort_order = ctx.db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 n FROM rhythms').get().n;
    res.status(201).json(repos(ctx.db).rhythms.create(data));
  });
  r.post('/:id/made', (req, res) => {
    const id = idParam(req);
    if (!repos(ctx.db).rhythms.get(id)) throw notFound();
    const { made_on } = check({ made_on: 'date!' }, req.body);
    const log = logMade(ctx.db, id, made_on);
    res.status(201).json({ ...log, undo: `/api/rhythm-log/${log.id}` });
  });
  r.use(crudRouter(ctx, { repo: db => repos(db).rhythms, schema: rhythmSchema, validateRow: checkRhythm }));
  return r;
}

export function rhythmLogRouter(ctx) {
  const checkLog = (ctx, data) => {
    if (!repos(ctx.db).rhythms.get(data.rhythm_id)) throw new HttpError(400, 'Unknown staple.', { rhythm_id: 'Unknown staple' });
  };
  return crudRouter(ctx, { repo: db => repos(db).rhythmLog, schema: rhythmLogSchema, filters: ['rhythm_id'], validateRow: checkLog });
}

// Harvests come from the Log a harvest dialog, or from a garden app on this computer.
// A garden app (such as Seed & Harvest) keys its harvests by its own name and id. Sending the same key
// again updates that row (bringing it back from the Trash if needed); deleting it is safe to repeat.
const SOURCE = /^[A-Za-z0-9-]{1,40}$/;
const EXTERNAL = /^[A-Za-z0-9-]{1,80}$/;
function externalKey(req) {
  const { source, externalId } = req.params;
  if (!SOURCE.test(source) || !EXTERNAL.test(externalId)) throw new HttpError(400, 'Bad source or id.');
  return { source, externalId };
}
const byKey = (db, { source, externalId }) => db.prepare('SELECT id FROM harvests WHERE source = ? AND external_id = ?').get(source, externalId);

export function harvestsRouter(ctx) {
  const r = Router();
  r.put('/external/:source/:externalId', (req, res) => {
    const key = externalKey(req);
    const { source: _s, external_id: _e, ...fields } = check(harvestSchema, { ...req.body, source: key.source });
    const R = repos(ctx.db).harvests;
    const out = transaction(ctx.db, () => {
      const found = byKey(ctx.db, key);
      if (!found) return { row: R.create({ ...fields, source: key.source, external_id: key.externalId }), created: true };
      if (R.get(found.id, { includeDeleted: true })?.deleted_at) R.restore(found.id);
      return { row: R.update(found.id, { ...fields }), created: false };
    });
    res.status(out.created ? 201 : 200).json(out.row);
  });
  r.delete('/external/:source/:externalId', (req, res) => {
    const key = externalKey(req);
    transaction(ctx.db, () => {
      const found = byKey(ctx.db, key);
      if (found && !repos(ctx.db).harvests.get(found.id, { includeDeleted: true })?.deleted_at) repos(ctx.db).harvests.remove(found.id);
    });
    res.json({ ok: true });
  });
  // A garden harvest keeps its source when edited by hand: the app finds it again by source and id.
  const keepSource = (c, data, row) => {
    if (row.external_id == null) return data;
    const { source: _s, ...rest } = data;
    return rest;
  };
  r.use(crudRouter(ctx, { repo: db => repos(db).harvests, schema: harvestSchema, prepareUpdate: keepSource }));
  return r;
}
