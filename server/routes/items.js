import { Router } from 'express';
import { crudRouter } from './crud.js';
import { repos } from '../db/repos.js';
import { itemsWithStock, itemDetail } from '../db/items.js';
import { check } from '../validate.js';
import { HttpError, idParam, notFound } from '../http.js';
import { transaction } from '../db/connection.js';
import { itemSchema, batchSchema } from '../schemas.js';
import { cascadeDeletePhotos, cascadeRestorePhotos } from '../services/photos.js';

function checkItemRefs(ctx, data) {
  const R = repos(ctx.db);
  if (!R.stores.get(data.store_id)) throw new HttpError(400, 'Please pick a store.', { store_id: 'Unknown store' });
  if (data.category_id && !R.categories.get(data.category_id)) throw new HttpError(400, 'Unknown category.', { category_id: 'Unknown category' });
  if (data.location_id) {
    const loc = R.locations.get(data.location_id);
    if (!loc || loc.store_id !== data.store_id) throw new HttpError(400, 'That location is not in this store.', { location_id: 'Pick a location in this store' });
  }
}

function checkBatchRow(ctx, data) {
  if (!repos(ctx.db).items.get(data.item_id)) throw new HttpError(400, 'Unknown item.', { item_id: 'Unknown item' });
  if (data.use_by && data.date_stored && data.use_by < data.date_stored) {
    throw new HttpError(400, 'Please fix the highlighted fields.', { use_by: "Use-by can't be before the date stored" });
  }
}

const ITEM_FILTERS = ['store_id', 'category_id', 'location_id', 'source', 'q', 'low', 'sort'];
const itemFilters = query => Object.fromEntries(ITEM_FILTERS.filter(k => typeof query[k] === 'string').map(k => [k, query[k]]));

const prepareBatch = item => data => ({ unit: item?.unit, ...data, initial_quantity: data.quantity });

export function itemsRouter(ctx) {
  const r = Router();
  r.get('/', (req, res) => res.json(itemsWithStock(ctx.db, itemFilters(req.query))));
  r.get('/:id', (req, res) => {
    const d = itemDetail(ctx.db, idParam(req));
    if (!d) throw notFound('Item not found');
    res.json(d);
  });
  r.post('/', (req, res) => {
    const data = check(itemSchema, req.body);
    checkItemRefs(ctx, data);
    const id = transaction(ctx.db, () => {
      const R = repos(ctx.db);
      const item = R.items.create({ unit: 'each', ...data });
      if (req.body.first_batch) {
        const b = check(batchSchema, { ...req.body.first_batch, item_id: item.id });
        checkBatchRow(ctx, b);
        R.batches.create(prepareBatch(item)(b));
      }
      return item.id;
    });
    res.status(201).json(itemDetail(ctx.db, id));
  });
  r.use(crudRouter(ctx, {
    repo: db => repos(db).items,
    schema: itemSchema,
    validateRow: checkItemRefs,
    onDelete: (ctx, row, stamp) => cascadeDeletePhotos(ctx, 'item', row.id, stamp),
    onRestore: (ctx, row) => cascadeRestorePhotos(ctx, 'item', row.id, row.deleted_at),
  }));
  return r;
}

export function batchesRouter(ctx) {
  const r = Router();
  const setUsedUp = value => (req, res) => {
    const id = idParam(req);
    const b = repos(ctx.db).batches.get(id);
    if (!b) throw notFound('Batch not found');
    res.json(repos(ctx.db).batches.update(id, { used_up_at: value() }));
  };
  r.post('/:id/used-up', setUsedUp(() => new Date().toISOString()));
  r.post('/:id/unuse', setUsedUp(() => null));
  r.post('/', (req, res) => {
    const data = check(batchSchema, req.body);
    checkBatchRow(ctx, data);
    const item = repos(ctx.db).items.get(data.item_id);
    res.status(201).json(repos(ctx.db).batches.create(prepareBatch(item)(data)));
  });
  r.use(crudRouter(ctx, {
    repo: db => repos(db).batches,
    schema: batchSchema,
    filters: ['item_id'],
    validateRow: checkBatchRow,
    // An untouched batch keeps its starting amount in step with edits; once some is used, the start stays put.
    prepareUpdate: (ctx, data, row) => (data.quantity !== undefined && row.quantity === row.initial_quantity
      ? { ...data, initial_quantity: data.quantity } : data),
    onDelete: (ctx, row, stamp) => cascadeDeletePhotos(ctx, 'batch', row.id, stamp),
    onRestore: (ctx, row) => cascadeRestorePhotos(ctx, 'batch', row.id, row.deleted_at),
  }));
  return r;
}
