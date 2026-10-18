import { Router } from 'express';
import { crudRouter } from './crud.js';
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
export function harvestsRouter(ctx) {
  return crudRouter(ctx, { repo: db => repos(db).harvests, schema: harvestSchema });
}
