import { Router } from 'express';
import { HttpError } from '../http.js';
import { itemsRouter, batchesRouter } from './items.js';
import { photosRouter } from './photos.js';
import { recipesRouter, cookLogRouter, canMakeRoute } from './recipes.js';
import { planRouter } from './plan.js';
import { shoppingRouter } from './shopping.js';
import { storesRouter, categoriesRouter, locationsRouter } from './stores.js';
import { settingsRouter, homeRoute } from './settings.js';
import { systemRouter } from './system.js';

export function apiRouter(ctx, { onShutdown }) {
  const r = Router();
  r.get('/health', (req, res) => res.json({ ok: true, version: '1.0.0', demo: ctx.config.demo }));
  r.use('/stores', storesRouter(ctx));
  r.use('/categories', categoriesRouter(ctx));
  r.use('/locations', locationsRouter(ctx));
  r.use('/items', itemsRouter(ctx));
  r.use('/batches', batchesRouter(ctx));
  r.use('/photos', photosRouter(ctx));
  r.get('/can-make', canMakeRoute(ctx));
  r.use('/recipes', recipesRouter(ctx));
  r.use('/cook-log', cookLogRouter(ctx));
  r.use('/plan', planRouter(ctx));
  r.use('/shopping', shoppingRouter(ctx));
  r.use('/settings', settingsRouter(ctx));
  r.get('/home', homeRoute(ctx));
  r.use(systemRouter(ctx, { onShutdown }));
  r.use((req, res, next) => next(new HttpError(404, 'No such API route')));
  return r;
}
