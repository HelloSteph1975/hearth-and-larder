import { Router } from 'express';
import { crudRouter } from './crud.js';
import { repos } from '../db/repos.js';
import { planWithReady, prepareBatchUpdate } from '../services/batch.js';
import { syncPlanMake } from '../services/rhythm.js';
import { transaction } from '../db/connection.js';
import { check } from '../validate.js';
import { HttpError } from '../http.js';
import { planSchema } from '../schemas.js';

function checkEntry(ctx, data, row) {
  if (!data.recipe_id && !data.note) throw new HttpError(400, 'Pick a recipe or write a note.', { note: 'Pick a recipe or write a note' });
  if (data.recipe_id && !repos(ctx.db).recipes.get(data.recipe_id)) throw new HttpError(400, 'Unknown recipe.', { recipe_id: 'Unknown recipe' });
  // A task keeps working after its staple is deleted; only a new or changed link must name a live staple.
  if (data.rhythm_id && data.rhythm_id !== row?.rhythm_id && !repos(ctx.db).rhythms.get(data.rhythm_id)) throw new HttpError(400, 'Unknown staple.', { rhythm_id: 'Unknown staple' });
}

// A make logged by ticking a planner task goes and comes back with that task.
const LOG_BY_ENTRY = 'UPDATE rhythm_log SET deleted_at = ? WHERE plan_entry_id = ? AND deleted_at IS ?';

export function planRouter(ctx) {
  const r = Router();
  r.get('/', (req, res) => {
    const { from, to } = check({ from: 'date!', to: 'date!' }, req.query);
    res.json(planWithReady(ctx.db, from, to));
  });
  r.post('/', (req, res) => {
    const data = check(planSchema, req.body);
    checkEntry(ctx, data);
    if (data.servings == null && data.recipe_id) data.servings = repos(ctx.db).recipes.get(data.recipe_id).servings;
    if (data.sort_order == null) {
      data.sort_order = ctx.db.prepare('SELECT COUNT(*) n FROM meal_plan WHERE date = ? AND slot = ? AND deleted_at IS NULL').get(data.date, data.slot).n;
    }
    res.status(201).json(transaction(ctx.db, () => {
      const saved = repos(ctx.db).plan.create(data);
      syncPlanMake(ctx.db, saved);
      return saved;
    }));
  });
  r.use(crudRouter(ctx, { repo: db => repos(db).plan, schema: planSchema, validateRow: checkEntry, prepareUpdate: (ctx, data, row) => prepareBatchUpdate(data, row),
    afterUpdate: (ctx, saved) => syncPlanMake(ctx.db, saved),
    onDelete: (ctx, row, stamp) => ctx.db.prepare(LOG_BY_ENTRY).run(stamp, row.id, null),
    onRestore: (ctx, row) => ctx.db.prepare(LOG_BY_ENTRY).run(null, row.id, row.deleted_at),
  }));
  return r;
}
