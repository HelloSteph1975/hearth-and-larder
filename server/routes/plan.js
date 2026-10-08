import { Router } from 'express';
import { crudRouter } from './crud.js';
import { repos } from '../db/repos.js';
import { planEntries } from '../db/plan.js';
import { check } from '../validate.js';
import { HttpError } from '../http.js';
import { planSchema } from '../schemas.js';

function checkEntry(ctx, data) {
  if (!data.recipe_id && !data.note) throw new HttpError(400, 'Pick a recipe or write a note.', { note: 'Pick a recipe or write a note' });
  if (data.recipe_id && !repos(ctx.db).recipes.get(data.recipe_id)) throw new HttpError(400, 'Unknown recipe.', { recipe_id: 'Unknown recipe' });
}

export function planRouter(ctx) {
  const r = Router();
  r.get('/', (req, res) => {
    const { from, to } = check({ from: 'date!', to: 'date!' }, req.query);
    res.json(planEntries(ctx.db, from, to));
  });
  r.post('/', (req, res) => {
    const data = check(planSchema, req.body);
    checkEntry(ctx, data);
    if (data.servings == null && data.recipe_id) data.servings = repos(ctx.db).recipes.get(data.recipe_id).servings;
    if (data.sort_order == null) {
      data.sort_order = ctx.db.prepare('SELECT COUNT(*) n FROM meal_plan WHERE date = ? AND slot = ? AND deleted_at IS NULL').get(data.date, data.slot).n;
    }
    res.status(201).json(repos(ctx.db).plan.create(data));
  });
  r.use(crudRouter(ctx, { repo: db => repos(db).plan, schema: planSchema, validateRow: checkEntry }));
  return r;
}
