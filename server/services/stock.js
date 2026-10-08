import { normalizeName, toBase, fromBase, unitFamily, round } from './units.js';

export function stockIndex(db) {
  const rows = db.prepare(`SELECT b.id AS batch_id, b.item_id, b.quantity, b.unit, b.use_by, i.name AS item_name, i.category_id
    FROM batches b JOIN items i ON i.id = b.item_id
    WHERE b.deleted_at IS NULL AND i.deleted_at IS NULL AND b.used_up_at IS NULL AND b.quantity > 0
    ORDER BY (b.use_by IS NULL), b.use_by, b.id`).all();
  const index = new Map();
  for (const r of rows) {
    const key = normalizeName(r.item_name);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(r);
  }
  return index;
}

export function scaleQty(qty, from, to) {
  if (qty == null) return null;
  if (!from || !to) return qty;
  return round((qty * to) / from);
}

export function availability(index, name, qty, unit) {
  const batches = index.get(normalizeName(name)) ?? [];
  if (!batches.length) return { status: 'missing', have: 0 };
  if (qty == null) return { status: 'have', have: null };
  const family = unitFamily(unit);
  let base = 0;
  let mismatch = false;
  for (const b of batches) {
    const x = toBase(b.quantity, b.unit);
    if (x.family === family) base += x.amount;
    else mismatch = true;
  }
  const have = round(fromBase(base, unit));
  if (have >= qty - 1e-9) return { status: 'have', have };
  if (mismatch) return { status: 'check', have };
  return { status: have > 0 ? 'partial' : 'missing', have };
}

export function recipeStatus(index, recipe, servings = recipe.servings) {
  const counts = { have: 0, partial: 0, check: 0, missing: 0, staple: 0 };
  const missing_names = [];
  let can_make = true;
  const ingredients = recipe.ingredients.map(ing => {
    const scaled_quantity = scaleQty(ing.quantity, recipe.servings, servings);
    if (ing.is_staple) { counts.staple++; return { ...ing, scaled_quantity, status: 'staple', have: null }; }
    const a = availability(index, ing.name, scaled_quantity, ing.unit);
    counts[a.status]++;
    if ((a.status === 'missing' || a.status === 'partial') && !ing.optional) { can_make = false; missing_names.push(ing.name); }
    return { ...ing, scaled_quantity, ...a };
  });
  return { servings, ingredients, counts, can_make, missing_names };
}
