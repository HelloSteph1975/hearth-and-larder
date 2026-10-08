import { createRepo } from './repo.js';

const cache = new WeakMap();

export function repos(db) {
  let r = cache.get(db);
  if (!r) {
    r = {
      stores: createRepo(db, 'stores', ['name', 'icon', 'color', 'sort_order'], { orderBy: 'sort_order, id' }),
      categories: createRepo(db, 'categories', ['name', 'kind', 'sort_order'], { orderBy: 'kind, sort_order, name' }),
      locations: createRepo(db, 'locations', ['store_id', 'name', 'sort_order'], { orderBy: 'sort_order, name COLLATE NOCASE' }),
      items: createRepo(db, 'items', ['store_id', 'category_id', 'location_id', 'name', 'unit', 'low_threshold', 'notes', 'favorite'], { orderBy: 'name COLLATE NOCASE' }),
      batches: createRepo(db, 'batches', ['item_id', 'quantity', 'initial_quantity', 'unit', 'date_stored', 'use_by', 'source', 'method',
        'container', 'container_count', 'recipe_id', 'batch_code', 'notes', 'price', 'vendor', 'purchased_on', 'used_up_at'],
        { orderBy: '(use_by IS NULL), use_by, id' }),
      photos: createRepo(db, 'photos', ['owner_type', 'owner_id', 'filename', 'caption', 'sort_order'], { orderBy: 'sort_order, id' }),
      recipes: createRepo(db, 'recipes', ['title', 'description', 'servings', 'prep_minutes', 'cook_minutes', 'source_credit',
        'is_family_recipe', 'favorite', 'rating', 'notes', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg'],
        { orderBy: 'title COLLATE NOCASE' }),
      cookLog: createRepo(db, 'cook_log', ['recipe_id', 'cooked_on', 'servings', 'notes'], { orderBy: 'cooked_on DESC, id DESC' }),
      plan: createRepo(db, 'meal_plan', ['date', 'slot', 'recipe_id', 'note', 'servings', 'sort_order'], { orderBy: 'date, sort_order, id' }),
      shopping: createRepo(db, 'shopping_items', ['name', 'quantity', 'unit', 'category_id', 'est_price', 'checked', 'origin', 'plan_range'],
        { orderBy: 'checked, name COLLATE NOCASE' }),
    };
    cache.set(db, r);
  }
  return r;
}
