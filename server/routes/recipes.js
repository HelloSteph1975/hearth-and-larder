import { Router } from 'express';
import { crudRouter } from './crud.js';
import { repos } from '../db/repos.js';
import { getRecipe, listRecipes, saveRecipe, allTags } from '../db/recipes.js';
import { HttpError, idParam, notFound } from '../http.js';
import { recipeSchema, cookLogSchema } from '../schemas.js';
import { stockIndex, recipeStatus } from '../services/stock.js';
import { proposeDeductions, applyCook, returnCookStock, reapplyCookStock } from '../services/cook.js';
import { check } from '../validate.js';
import { cascadeDeletePhotos, cascadeRestorePhotos } from '../services/photos.js';

function positiveServings(v) {
  const n = typeof v === 'string' ? (v.trim() === '' ? NaN : Number(v.trim())) : v;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) throw new HttpError(400, 'Servings must be a positive number.', { servings: 'Must be a positive number' });
  return n;
}

export function recipesRouter(ctx) {
  const r = Router();
  r.get('/', (req, res) => {
    const index = stockIndex(ctx.db);
    let rows = listRecipes(ctx.db, req.query).map(rec => {
      const s = recipeStatus(index, rec);
      const total = rec.ingredients.filter(i => !i.is_staple).length;
      return { ...rec, stock: { have: s.counts.have, total, can_make: s.can_make } };
    });
    if (req.query.can_make === '1') rows = rows.filter(x => x.stock.can_make);
    res.json(rows);
  });
  r.get('/tags', (req, res) => res.json(allTags(ctx.db)));
  r.get('/:id', (req, res) => {
    const recipe = getRecipe(ctx.db, idParam(req));
    if (!recipe) throw notFound('Recipe not found');
    const servings = req.query.servings !== undefined ? positiveServings(req.query.servings) : recipe.servings;
    res.json({ ...recipe, status: recipeStatus(stockIndex(ctx.db), recipe, servings) });
  });
  r.post('/:id/cook/preview', (req, res) => res.json(proposeDeductions(ctx.db, idParam(req), req.body?.servings !== undefined ? positiveServings(req.body.servings) : null)));
  r.post('/:id/cook', (req, res) => {
    const recipe_id = idParam(req);
    const data = check({ cooked_on: 'date!', servings: { type: 'number', min: 0 }, notes: 'string' }, req.body);
    res.status(201).json(applyCook(ctx.db, { recipe_id, ...data, deductions: req.body.deductions ?? [] }));
  });
  r.post('/', (req, res) => res.status(201).json(saveRecipe(ctx.db, req.body)));
  r.put('/:id', (req, res) => res.json(saveRecipe(ctx.db, req.body, idParam(req))));
  r.use(crudRouter(ctx, {
    repo: db => repos(db).recipes,
    schema: recipeSchema,
    onDelete: (ctx, row, stamp) => cascadeDeletePhotos(ctx, 'recipe', row.id, stamp),
    onRestore: (ctx, row) => cascadeRestorePhotos(ctx, 'recipe', row.id, row.deleted_at),
  }));
  return r;
}

export function cookLogRouter(ctx) {
  return crudRouter(ctx, {
    repo: db => repos(db).cookLog,
    schema: cookLogSchema,
    filters: ['recipe_id'],
    onDelete: (ctx, row) => returnCookStock(ctx.db, row.id),
    onRestore: (ctx, row) => reapplyCookStock(ctx.db, row.id),
    validateRow(ctx, data) {
      if (!repos(ctx.db).recipes.get(data.recipe_id)) throw new HttpError(400, 'Unknown recipe.', { recipe_id: 'Unknown recipe' });
    },
  });
}

export function canMakeRoute(ctx) {
  return (req, res) => {
    const index = stockIndex(ctx.db);
    const rows = listRecipes(ctx.db).map(rec => ({ ...rec, status: recipeStatus(index, rec) }))
      .filter(r => r.ingredients.length > 0);
    const missing = r => r.status.counts.missing + r.status.counts.partial;
    rows.sort((a, b) => missing(a) - missing(b) || a.title.localeCompare(b.title));
    res.json(rows);
  };
}
