import fs from 'node:fs';
import path from 'node:path';
import { transaction } from '../db/connection.js';

export function purgeSoftDeleted(db, dataDir, { days = 30, now = Date.now() } = {}) {
  const cutoff = new Date(now - days * 86400000).toISOString();
  const old = table => `SELECT id FROM ${table} WHERE deleted_at IS NOT NULL AND deleted_at < '${cutoff}'`;
  let files = [];
  const counts = transaction(db, () => {
    const counts = {};
    const run = (label, sql) => { counts[label] = (counts[label] ?? 0) + db.prepare(sql).run().changes; };
    // Collect photo files first (own rows and rows removed by cascade); delete the files after commit.
    const doomedBatches = `SELECT id FROM batches WHERE item_id IN (${old('items')}) OR id IN (${old('batches')})`;
    files = db.prepare(`SELECT filename FROM photos WHERE id IN (${old('photos')})
      OR (owner_type = 'item' AND owner_id IN (${old('items')}))
      OR (owner_type = 'batch' AND owner_id IN (${doomedBatches}))
      OR (owner_type = 'recipe' AND owner_id IN (${old('recipes')}))`).all().map(r => r.filename);
    run('photos', `DELETE FROM photos WHERE id IN (${old('photos')})`);
    // Cook deductions point at cook logs and batches, so they go before either.
    const doomedLogs = `SELECT id FROM cook_log WHERE recipe_id IN (${old('recipes')}) OR id IN (${old('cook_log')})`;
    run('cook_deductions', `DELETE FROM cook_deductions WHERE cook_log_id IN (${doomedLogs}) OR batch_id IN (${doomedBatches})`);
    // Children of purged parents.
    run('batches', `DELETE FROM batches WHERE item_id IN (${old('items')}) OR id IN (${old('batches')})`);
    run('photos', `DELETE FROM photos WHERE owner_type = 'batch' AND owner_id NOT IN (SELECT id FROM batches)`);
    run('photos', `DELETE FROM photos WHERE owner_type = 'item' AND owner_id IN (${old('items')})`);
    run('items', `DELETE FROM items WHERE id IN (${old('items')})`);
    const goneStores = `${old('stores')} AND id NOT IN (SELECT store_id FROM items)`;
    const goneLocations = `SELECT id FROM locations WHERE id IN (${old('locations')}) OR store_id IN (${goneStores})`;
    db.prepare(`UPDATE items SET location_id = NULL WHERE location_id IN (${goneLocations})`).run();
    run('locations', `DELETE FROM locations WHERE id IN (${goneLocations})`);
    db.prepare(`UPDATE items SET category_id = NULL WHERE category_id IN (${old('categories')})`).run();
    db.prepare(`UPDATE shopping_items SET category_id = NULL WHERE category_id IN (${old('categories')})`).run();
    run('categories', `DELETE FROM categories WHERE id IN (${old('categories')})`);
    run('cook_log', `DELETE FROM cook_log WHERE recipe_id IN (${old('recipes')}) OR id IN (${old('cook_log')})`);
    run('meal_plan', `DELETE FROM meal_plan WHERE recipe_id IN (${old('recipes')}) OR id IN (${old('meal_plan')})`);
    db.prepare(`UPDATE batches SET recipe_id = NULL WHERE recipe_id IN (${old('recipes')})`).run();
    run('photos', `DELETE FROM photos WHERE owner_type = 'recipe' AND owner_id IN (${old('recipes')})`);
    run('recipes', `DELETE FROM recipes WHERE id IN (${old('recipes')})`);
    run('shopping_items', `DELETE FROM shopping_items WHERE id IN (${old('shopping_items')})`);
    run('stores', `DELETE FROM stores WHERE id IN (${goneStores})`);
    return counts;
  });
  for (const f of files) {
    for (const dir of [path.join(dataDir, 'photos'), path.join(dataDir, 'photos', '_trash')]) {
      try { fs.rmSync(path.join(dir, f), { force: true }); } catch {}
    }
  }
  return counts;
}
