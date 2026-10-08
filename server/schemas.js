export const SOURCES = ['home-grown', 'preserved', 'bought', 'gifted', 'foraged'];
export const METHODS = ['water bath', 'pressure canned', 'dehydrated', 'fermented', 'cured', 'frozen', 'root storage', 'as bought', 'other'];
export const SLOTS = ['breakfast', 'lunch', 'supper', 'snack'];

export const storeSchema = { name: 'string!', icon: { type: 'string', nullable: false }, color: { type: 'string', nullable: false }, sort_order: { type: 'int', nullable: false } };
export const categorySchema = { name: 'string!', kind: { type: ['item', 'shopping'], nullable: false }, sort_order: { type: 'int', nullable: false } };
export const locationSchema = { store_id: 'int!', name: 'string!', sort_order: { type: 'int', nullable: false } };
export const itemSchema = {
  store_id: 'int!', category_id: 'int', location_id: 'int', name: 'string!', unit: { type: 'string', nullable: false },
  low_threshold: { type: 'number', min: 0 }, notes: 'string', favorite: { type: 'bool', nullable: false },
};
export const batchSchema = {
  item_id: 'int!', quantity: { type: 'number', min: 0, required: true }, unit: { type: 'string', nullable: false }, date_stored: 'date', use_by: 'date',
  source: SOURCES, method: METHODS, container: 'string', container_count: { type: 'int', min: 0 }, recipe_id: 'int',
  batch_code: 'string', notes: 'string', price: { type: 'number', min: 0 }, vendor: 'string', purchased_on: 'date',
};
export const photoSchema = { caption: 'string', sort_order: { type: 'int', nullable: false } };
export const recipeSchema = {
  title: 'string!', description: 'string', servings: { type: 'number', min: 0.25, nullable: false }, prep_minutes: { type: 'int', min: 0 },
  cook_minutes: { type: 'int', min: 0 }, source_credit: 'string', is_family_recipe: { type: 'bool', nullable: false }, favorite: { type: 'bool', nullable: false },
  rating: { type: 'int', min: 0, max: 5 }, notes: 'string',
  calories: { type: 'number', min: 0 }, protein_g: { type: 'number', min: 0 }, carbs_g: { type: 'number', min: 0 },
  fat_g: { type: 'number', min: 0 }, fiber_g: { type: 'number', min: 0 }, sugar_g: { type: 'number', min: 0 },
  sodium_mg: { type: 'number', min: 0 },
};
export const ingredientSchema = {
  section: 'string', quantity: { type: 'number', min: 0 }, unit: 'string', name: 'string!', prep_note: 'string',
  optional: { type: 'bool', nullable: false }, is_staple: { type: 'bool', nullable: false },
};
export const cookLogSchema = { recipe_id: 'int!', cooked_on: 'date!', servings: { type: 'number', min: 0 }, notes: 'string' };
export const planSchema = { date: 'date!', slot: { type: SLOTS, required: true }, recipe_id: 'int', note: 'string', servings: { type: 'number', min: 0.25 }, sort_order: { type: 'int', nullable: false } };
export const shoppingSchema = {
  name: 'string!', quantity: { type: 'number', min: 0 }, unit: 'string', category_id: 'int',
  est_price: { type: 'number', min: 0 }, checked: { type: 'bool', nullable: false },
};
