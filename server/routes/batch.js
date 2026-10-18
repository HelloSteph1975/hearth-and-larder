import { Router } from 'express';
import { check } from '../validate.js';
import { HttpError, idParam, notFound } from '../http.js';
import { listBatchPlans, placeBatchWeek } from '../services/batch.js';

export function batchPlansRouter(ctx) {
  const r = Router();
  r.get('/', (req, res) => res.json(listBatchPlans(ctx.db)));
  r.post('/:id/place', (req, res) => {
    const id = idParam(req);
    if (!ctx.db.prepare('SELECT 1 FROM batch_plans WHERE id = ? AND deleted_at IS NULL').get(id)) throw notFound();
    const raw = req.body?.dates;
    if (!Array.isArray(raw) || raw.length !== 3) throw new HttpError(400, 'Pick three days.', { dates: 'Pick three days' });
    const dates = raw.map(d => check({ date: 'date!' }, { date: d }).date);
    if (new Set(dates).size !== 3) throw new HttpError(400, 'Pick three different days.', { dates: 'Pick three different days' });
    res.status(201).json(placeBatchWeek(ctx.db, id, dates));
  });
  return r;
}
