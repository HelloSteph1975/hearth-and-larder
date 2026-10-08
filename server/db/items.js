import { convert, normalizeName, round } from '../services/units.js';

const ITEM_SELECT = `
  SELECT i.*, s.name AS store_name, c.name AS category_name, l.name AS location_name,
    (SELECT p.filename FROM photos p WHERE p.owner_type = 'item' AND p.owner_id = i.id AND p.deleted_at IS NULL
      ORDER BY p.sort_order, p.id LIMIT 1) AS photo
  FROM items i
  JOIN stores s ON s.id = i.store_id
  LEFT JOIN categories c ON c.id = i.category_id AND c.deleted_at IS NULL
  LEFT JOIN locations l ON l.id = i.location_id AND l.deleted_at IS NULL
  WHERE i.deleted_at IS NULL`;

export function liveBatches(db, itemIds = null) {
  const base = `SELECT * FROM batches WHERE deleted_at IS NULL AND used_up_at IS NULL`;
  if (itemIds === null) return db.prepare(`${base} ORDER BY (use_by IS NULL), use_by, id`).all();
  if (!itemIds.length) return [];
  return db.prepare(`${base} AND item_id IN (${itemIds.map(() => '?').join(',')}) ORDER BY (use_by IS NULL), use_by, id`).all(...itemIds);
}

export function withStock(item, batches) {
  let quantity = 0;
  let mixed = false;
  const sources = new Set();
  let next = null;
  for (const b of batches) {
    const q = convert(b.quantity, b.unit, item.unit);
    if (q === null) mixed = true;
    else quantity += q;
    if (b.source) sources.add(b.source);
    if (b.use_by && (!next || b.use_by < next)) next = b.use_by;
  }
  quantity = round(quantity);
  return {
    ...item,
    quantity,
    mixed_units: mixed,
    next_use_by: next,
    batch_count: batches.length,
    sources: [...sources],
    is_low: item.low_threshold != null && quantity <= item.low_threshold,
  };
}

const SORTS = {
  name: (a, b) => a.name.localeCompare(b.name),
  use_by: (a, b) => (a.next_use_by ?? '9999') .localeCompare(b.next_use_by ?? '9999') || a.name.localeCompare(b.name),
  quantity: (a, b) => a.quantity - b.quantity || a.name.localeCompare(b.name),
};

export function itemsWithStock(db, f = {}) {
  const where = [];
  const args = [];
  for (const k of ['store_id', 'category_id', 'location_id']) {
    if (f[k] !== undefined && f[k] !== '') { where.push(`i.${k} = ?`); args.push(Number(f[k])); }
  }
  if (f.q) { where.push('i.name LIKE ?'); args.push(`%${f.q}%`); }
  if (f.ids) { where.push(`i.id IN (${f.ids.map(() => '?').join(',')})`); args.push(...f.ids); }
  const items = db.prepare(`${ITEM_SELECT}${where.map(w => ` AND ${w}`).join('')}`).all(...args);
  const byItem = new Map();
  for (const b of liveBatches(db, items.map(i => i.id))) {
    if (!byItem.has(b.item_id)) byItem.set(b.item_id, []);
    byItem.get(b.item_id).push(b);
  }
  let rows = items.map(i => withStock(i, byItem.get(i.id) ?? []));
  if (f.source) rows = rows.filter(r => r.sources.includes(f.source));
  if (f.low === '1' || f.low === true) rows = rows.filter(r => r.is_low);
  return rows.sort(Object.hasOwn(SORTS, f.sort ?? '') ? SORTS[f.sort] : SORTS.name);
}

export function itemDetail(db, id) {
  const [item] = itemsWithStock(db, { ids: [id] });
  if (!item) return null;
  const photosFor = (type, ownerId) => db.prepare(
    'SELECT * FROM photos WHERE owner_type = ? AND owner_id = ? AND deleted_at IS NULL ORDER BY sort_order, id').all(type, ownerId);
  const batches = db.prepare(`SELECT b.*, r.title AS recipe_title FROM batches b LEFT JOIN recipes r ON r.id = b.recipe_id
    WHERE b.item_id = ? AND b.deleted_at IS NULL ORDER BY (b.used_up_at IS NOT NULL), (b.use_by IS NULL), b.use_by, b.id`).all(id)
    .map(b => ({ ...b, photos: photosFor('batch', b.id) }));
  const price_history = db.prepare(`SELECT id AS batch_id, purchased_on, price, COALESCE(initial_quantity, quantity) AS quantity, unit, vendor
    FROM batches WHERE item_id = ? AND deleted_at IS NULL AND price IS NOT NULL ORDER BY COALESCE(purchased_on, created_at) DESC`).all(id);
  const key = normalizeName(item.name);
  const used_in = db.prepare(`SELECT DISTINCT r.id, r.title, ri.name FROM recipe_ingredients ri JOIN recipes r ON r.id = ri.recipe_id
    WHERE r.deleted_at IS NULL`).all().filter(r => normalizeName(r.name) === key).map(({ id, title }) => ({ id, title }));
  return { ...item, batches, photos: photosFor('item', id), price_history, used_in };
}
