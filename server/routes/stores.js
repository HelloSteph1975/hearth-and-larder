import { crudRouter } from './crud.js';
import { repos } from '../db/repos.js';
import { HttpError } from '../http.js';
import { storeSchema, categorySchema, locationSchema } from '../schemas.js';

export function storesRouter(ctx) {
  return crudRouter(ctx, {
    repo: db => repos(db).stores,
    schema: storeSchema,
    beforeDelete(ctx, row) {
      const n = ctx.db.prepare('SELECT COUNT(*) n FROM items WHERE store_id = ? AND deleted_at IS NULL').get(row.id).n;
      if (n > 0) throw new HttpError(409, `Move or delete the ${n} item${n === 1 ? '' : 's'} in ${row.name} first.`);
    },
  });
}

export function categoriesRouter(ctx) {
  return crudRouter(ctx, { repo: db => repos(db).categories, schema: categorySchema, filters: ['kind'] });
}

export function locationsRouter(ctx) {
  return crudRouter(ctx, {
    repo: db => repos(db).locations,
    schema: locationSchema,
    filters: ['store_id'],
    validateRow(ctx, data) {
      if (!repos(ctx.db).stores.get(data.store_id)) throw new HttpError(400, 'That store does not exist.', { store_id: 'Unknown store' });
    },
  });
}
