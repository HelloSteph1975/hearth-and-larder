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

// `reserved` (name|family -> base amount) is stock earlier lines of the same recipe already claimed.
export function availability(index, name, qty, unit, reserved = new Map()) {
  const key = normalizeName(name);
  const batches = index.get(key) ?? [];
  if (!batches.length) return { status: 'missing', have: 0 };
  if (qty == null) return { status: 'have', have: null };
  const family = unitFamily(unit);
  const claim = `${key}|${family}`;
  let base = 0;
  let mismatch = false;
  for (const b of batches) {
    const x = toBase(b.quantity, b.unit);
    if (x.family === family) base += x.amount;
    else mismatch = true;
  }
  base = Math.max(0, base - (reserved.get(claim) ?? 0));
  reserved.set(claim, (reserved.get(claim) ?? 0) + Math.min(base, toBase(qty, unit).amount));
  const have = round(fromBase(base, unit));
  if (have >= qty - 1e-9) return { status: 'have', have };
  if (mismatch) return { status: 'check', have };
  return { status: have > 0 ? 'partial' : 'missing', have };
}

export function recipeStatus(index, recipe, servings = recipe.servings) {
  const counts = { have: 0, partial: 0, check: 0, missing: 0, staple: 0 };
  const missing_names = [];
  let can_make = true;
  // A name can appear on several lines (dough and filling); they share the stock, required lines first.
  const reserved = new Map();
  const statusOf = new Map();
  const order = recipe.ingredients.filter(i => !i.is_staple && !i.optional).concat(recipe.ingredients.filter(i => !i.is_staple && i.optional));
  for (const ing of order) {
    statusOf.set(ing, availability(index, ing.name, scaleQty(ing.quantity, recipe.servings, servings), ing.unit, reserved));
  }
  const ingredients = recipe.ingredients.map(ing => {
    const scaled_quantity = scaleQty(ing.quantity, recipe.servings, servings);
    if (ing.is_staple) { counts.staple++; return { ...ing, scaled_quantity, status: 'staple', have: null }; }
    const a = statusOf.get(ing);
    counts[a.status]++;
    if ((a.status === 'missing' || a.status === 'partial') && !ing.optional) { can_make = false; if (!missing_names.includes(ing.name)) missing_names.push(ing.name); }
    return { ...ing, scaled_quantity, ...a };
  });
  return { servings, ingredients, counts, can_make, missing_names };
}
