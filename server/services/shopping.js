import { transaction } from '../db/connection.js';
import { repos } from '../db/repos.js';
import { getRecipe } from '../db/recipes.js';
import { planEntries } from '../db/plan.js';
import { stockIndex, scaleQty } from './stock.js';
import { normalizeName, toBase, fromBase, round } from './units.js';

export function unitPrice(db, name) {
  const key = normalizeName(name);
  const rows = db.prepare(`SELECT b.price, COALESCE(b.initial_quantity, b.quantity) AS qty, b.unit, i.name
    FROM batches b JOIN items i ON i.id = b.item_id
    WHERE b.deleted_at IS NULL AND b.price IS NOT NULL ORDER BY COALESCE(b.purchased_on, b.created_at) DESC, b.id DESC`).all();
  const row = rows.find(r => normalizeName(r.name) === key && r.qty > 0);
  if (!row) return null;
  const base = toBase(row.qty, row.unit);
  return { family: base.family, perBase: row.price / base.amount };
}

const SHOPPING_CATEGORY = {
  'Root Vegetables': 'Produce', Fruit: 'Produce', 'Herbs & Spices': 'Produce',
  'Dairy & Eggs': 'Dairy & Eggs', 'Meat & Fish': 'Meat & Fish',
  'Grains & Flours': 'Pantry Staples', Baking: 'Pantry Staples', 'Oils & Vinegars': 'Pantry Staples',
  'Dried Goods': 'Pantry Staples', Preserves: 'Pantry Staples',
};

function categoryLookup(db) {
  const shopping = new Map(db.prepare("SELECT id, name FROM categories WHERE kind = 'shopping' AND deleted_at IS NULL ORDER BY id").all().map(c => [c.name, c.id]));
  const byItem = new Map();
  for (const i of db.prepare(`SELECT i.name, c.name AS category FROM items i LEFT JOIN categories c ON c.id = i.category_id AND c.deleted_at IS NULL
    WHERE i.deleted_at IS NULL ORDER BY i.id`).all()) {
    const key = normalizeName(i.name);
    if (!byItem.has(key)) byItem.set(key, i.category);
  }
  return name => {
    const cat = byItem.get(normalizeName(name));
    if (cat === undefined) return null;
    return shopping.get(Object.hasOwn(SHOPPING_CATEGORY, cat ?? '') ? SHOPPING_CATEGORY[cat] : 'Other') ?? null;
  };
}

// Plan rows already in the basket count as bought, so a rebuild doesn't ask for them twice.
function tickedPlanRows(db) {
  const base = new Map(); // name|family -> amount already ticked
  const names = new Set(); // every ticked name
  const blanket = new Set(); // ticked with no amount: covers the whole need
  for (const r of db.prepare("SELECT name, quantity, unit FROM shopping_items WHERE origin = 'plan' AND checked = 1 AND deleted_at IS NULL").all()) {
    const name = normalizeName(r.name);
    names.add(name);
    if (r.quantity == null) { blanket.add(name); continue; }
    const x = toBase(r.quantity, r.unit);
    const key = `${name}|${x.family}`;
    base.set(key, (base.get(key) ?? 0) + x.amount);
  }
  return { base, names, blanket };
}

export function buildFromPlan(db, from, to) {
  const index = stockIndex(db);
  const needs = new Map(); // key -> { name, unit, family, base, unitless }
  const recipeCache = new Map();
  for (const entry of planEntries(db, from, to)) {
    if (!entry.recipe_id) continue;
    if (!recipeCache.has(entry.recipe_id)) recipeCache.set(entry.recipe_id, getRecipe(db, entry.recipe_id));
    const recipe = recipeCache.get(entry.recipe_id);
    for (const ing of recipe.ingredients) {
      if (ing.is_staple || ing.optional) continue;
      const qty = scaleQty(ing.quantity, recipe.servings, entry.servings ?? recipe.servings);
      const { family, amount } = qty == null ? { family: 'unitless', amount: 0 } : toBase(qty, ing.unit);
      const key = `${normalizeName(ing.name)}|${family}`;
      const n = needs.get(key) ?? { name: ing.name, unit: ing.unit, family, base: 0, unitless: qty == null };
      n.base += amount;
      needs.set(key, n);
    }
  }
  const categoryFor = categoryLookup(db);
  const ticked = tickedPlanRows(db);
  const out = [];
  for (const [key, n] of needs) {
    const name = key.split('|')[0];
    const batches = index.get(name) ?? [];
    const category_id = categoryFor(n.name);
    if (n.unitless) {
      if (!batches.length && !ticked.names.has(name)) out.push({ name: n.name, quantity: null, unit: null, category_id, est_price: null });
      continue;
    }
    if (ticked.blanket.has(name)) continue;
    const haveBase = batches.reduce((s, b) => { const x = toBase(b.quantity, b.unit); return x.family === n.family ? s + x.amount : s; }, 0);
    const shortBase = n.base - haveBase - (ticked.base.get(key) ?? 0);
    if (shortBase <= 1e-9) continue;
    const price = unitPrice(db, n.name);
    out.push({
      name: n.name,
      quantity: round(fromBase(shortBase, n.unit)),
      unit: n.unit,
      category_id,
      est_price: price && price.family === n.family ? round(price.perBase * shortBase) : null,
    });
  }
  return transaction(db, () => {
    // Only live rows: a deleted row keeps its Undo until the 30-day purge.
    db.prepare("DELETE FROM shopping_items WHERE origin = 'plan' AND checked = 0 AND deleted_at IS NULL").run();
    const R = repos(db).shopping;
    for (const item of out) R.create({ ...item, origin: 'plan', plan_range: `${from}..${to}` });
    return listShopping(db);
  });
}

export function listShopping(db) {
  return db.prepare(`SELECT s.*, c.name AS category_name, c.sort_order AS category_sort FROM shopping_items s
    LEFT JOIN categories c ON c.id = s.category_id AND c.kind = 'shopping' AND c.deleted_at IS NULL
    WHERE s.deleted_at IS NULL ORDER BY s.checked, c.sort_order, s.name COLLATE NOCASE`).all();
}

export function putAway(db, { ids, store_id, today }) {
  return transaction(db, () => {
    const R = repos(db);
    const stamp = new Date().toISOString();
    const batches = [];
    for (const id of ids) {
      const s = R.shopping.get(Number(id));
      if (!s) continue;
      const key = normalizeName(s.name);
      let item = db.prepare('SELECT * FROM items WHERE store_id = ? AND deleted_at IS NULL').all(store_id).find(i => normalizeName(i.name) === key);
      if (!item) item = R.items.create({ store_id, name: s.name, unit: s.unit || 'each' });
      const quantity = s.quantity ?? 1;
      batches.push(R.batches.create({
        item_id: item.id, quantity, initial_quantity: quantity, unit: s.unit || item.unit, source: 'bought', method: 'as bought',
        price: s.est_price, purchased_on: today, date_stored: today,
      }));
      R.shopping.remove(s.id, stamp);
    }
    return { batches, stamp };
  });
}
