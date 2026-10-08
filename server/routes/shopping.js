import { Router } from 'express';
import { crudRouter } from './crud.js';
import { repos } from '../db/repos.js';
import { check } from '../validate.js';
import { HttpError } from '../http.js';
import { shoppingSchema } from '../schemas.js';
import { buildFromPlan, listShopping, putAway } from '../services/shopping.js';

export function shoppingRouter(ctx) {
  const r = Router();
  r.get('/', (req, res) => res.json(listShopping(ctx.db)));
  r.post('/build', (req, res) => {
    const { from, to } = check({ from: 'date!', to: 'date!' }, req.body);
    res.json(buildFromPlan(ctx.db, from, to));
  });
  r.post('/put-away', (req, res) => {
    const { store_id, today } = check({ store_id: 'int!', today: 'date!' }, req.body);
    if (!Array.isArray(req.body.ids) || !req.body.ids.length) throw new HttpError(400, 'Tick something to put away first.');
    if (!repos(ctx.db).stores.get(store_id)) throw new HttpError(400, 'Unknown store.');
    res.json(putAway(ctx.db, { ids: req.body.ids, store_id, today }));
  });
  r.post('/clear-checked', (req, res) => {
    const stamp = new Date().toISOString();
    const ids = ctx.db.prepare('SELECT id FROM shopping_items WHERE checked = 1 AND deleted_at IS NULL').all().map(x => x.id);
    ctx.db.prepare('UPDATE shopping_items SET deleted_at = ? WHERE checked = 1 AND deleted_at IS NULL').run(stamp);
    res.json({ ids, stamp });
  });
  r.post('/restore-many', (req, res) => {
    const { stamp } = check({ stamp: 'string!' }, req.body);
    ctx.db.prepare('UPDATE shopping_items SET deleted_at = NULL WHERE deleted_at = ?').run(stamp);
    res.json(listShopping(ctx.db));
  });
  r.post('/', (req, res) => res.status(201).json(repos(ctx.db).shopping.create({ ...check(shoppingSchema, req.body), origin: 'manual' })));
  r.use(crudRouter(ctx, { repo: db => repos(db).shopping, schema: shoppingSchema }));
  return r;
}
