import { getSettings } from './settings.js';
import { itemsWithStock } from '../db/items.js';
import { listRecipes } from '../db/recipes.js';
import { planEntries } from '../db/plan.js';
import { stockIndex, recipeStatus } from './stock.js';

const dayDiff = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);

export function homeSummary(db, today) {
  const settings = getSettings(db);
  const soon = Number(settings.use_soon_days);
  const use_soon = db.prepare(`SELECT b.id AS batch_id, b.item_id, i.name AS item_name, s.name AS store_name, b.quantity, b.unit, b.use_by
    FROM batches b JOIN items i ON i.id = b.item_id JOIN stores s ON s.id = i.store_id
    WHERE b.deleted_at IS NULL AND i.deleted_at IS NULL AND b.used_up_at IS NULL AND b.use_by IS NOT NULL
    ORDER BY b.use_by`).all()
    .map(b => ({ ...b, days_left: dayDiff(b.use_by, today) }))
    .filter(b => b.days_left <= soon);
  const index = stockIndex(db);
  const can_make = listRecipes(db).map(r => ({ ...r, status: recipeStatus(index, r) }))
    .filter(r => r.ingredients.length && r.status.can_make).slice(0, 4);
  const recently_cooked = db.prepare(`SELECT c.id, c.recipe_id, r.title, c.cooked_on FROM cook_log c JOIN recipes r ON r.id = c.recipe_id
    WHERE c.deleted_at IS NULL AND r.deleted_at IS NULL ORDER BY c.cooked_on DESC, c.id DESC LIMIT 5`).all();
  const count = sql => db.prepare(sql).get().n;
  return {
    settings,
    use_soon,
    running_low: itemsWithStock(db, { low: '1' }),
    today: planEntries(db, today, today),
    can_make,
    recently_cooked,
    counts: {
      items: count('SELECT COUNT(*) n FROM items WHERE deleted_at IS NULL'),
      recipes: count('SELECT COUNT(*) n FROM recipes WHERE deleted_at IS NULL'),
      batches: count(`SELECT COUNT(*) n FROM batches b JOIN items i ON i.id = b.item_id
        WHERE b.deleted_at IS NULL AND b.used_up_at IS NULL AND i.deleted_at IS NULL`),
    },
  };
}
