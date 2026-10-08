import fs from 'node:fs';
import path from 'node:path';
import { repos } from '../db/repos.js';
import { transaction } from '../db/connection.js';
import { saveRecipe } from '../db/recipes.js';
import { fileURLToPath } from 'node:url';
import { defaultDataDir, readConfigFile } from '../config.js';

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysFrom = (base, n) => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
  return ymd(d);
};

const STORES = {
  Larder: ['Shelf A', 'Shelf B', 'Top Shelf'],
  'Root Cellar': ['Bin 1', 'Bin 2', 'Sand Crate', 'Hanging Braids'],
  Pantry: ['Flour Crocks', 'Spice Rack', 'Bottom Shelf'],
};

// Batch: [qty, source, method, container, count, daysUntilUseBy, price]
const P = 'preserved';
const WB = 'water bath';
const HG = 'home-grown';
const B = 'bought';
const AB = 'as bought';
const ITEMS = [
  // Larder
  ['Larder', 'Preserves', 'Apple butter', 'jar', 'Shelf A', 2, [[5, P, WB, 'half-pint jar', 5, 330], [1, P, WB, 'half-pint jar', 1, 6]]],
  ['Larder', 'Preserves', 'Strawberry jam', 'jar', 'Shelf A', null, [[4, P, WB, 'half-pint jar', 4, 280]]],
  ['Larder', 'Preserves', 'Dill pickles', 'jar', 'Shelf B', null, [[3, P, WB, 'quart jar', 3, 200]]],
  ['Larder', 'Preserves', 'Tomato sauce', 'jar', 'Shelf B', 3, [[2, P, 'pressure canned', 'quart jar', 2, 9]]],
  ['Larder', 'Preserves', 'Bread-and-butter pickles', 'jar', 'Shelf B', null, [[6, P, WB, 'pint jar', 6, 310]]],
  ['Larder', 'Preserves', 'Peach slices', 'jar', 'Top Shelf', null, [[3, P, WB, 'pint jar', 3, 120]]],
  ['Larder', 'Preserves', 'Honey', 'jar', 'Top Shelf', null, [[2, B, AB, 'jar', 2, 600, 12.5]]],
  ['Larder', 'Preserves', 'Sauerkraut', 'jar', 'Shelf B', null, [[1, P, 'fermented', 'quart jar', 1, 4]]],
  // Root Cellar
  ['Root Cellar', 'Root Vegetables', 'Russet potatoes', 'lb', 'Bin 1', 5, [[18, HG, 'root storage', null, null, 60]]],
  ['Root Cellar', 'Root Vegetables', 'Carrots', 'lb', 'Sand Crate', null, [[6, HG, 'root storage', null, null, 45]]],
  ['Root Cellar', 'Root Vegetables', 'Onions', 'each', 'Hanging Braids', 4, [[3, HG, 'cured', null, null, 90]]],
  ['Root Cellar', 'Root Vegetables', 'Garlic', 'head', 'Hanging Braids', null, [[12, HG, 'cured', null, null, 150]]],
  ['Root Cellar', 'Root Vegetables', 'Winter squash', 'each', 'Bin 2', null, [[4, HG, 'cured', null, null, 75]]],
  ['Root Cellar', 'Fruit', 'Apples', 'lb', 'Bin 2', null, [[10, 'gifted', 'root storage', null, null, 12]]],
  ['Root Cellar', 'Root Vegetables', 'Beets', 'lb', 'Sand Crate', null, [[3, HG, 'root storage', null, null, 40]]],
  // Pantry
  ['Pantry', 'Grains & Flours', 'Flour', 'cup', 'Flour Crocks', 4, [[20, B, AB, null, null, 240, 6.0]]],
  ['Pantry', 'Grains & Flours', 'Rolled oats', 'cup', 'Flour Crocks', null, [[12, B, AB, null, null, 300, 4.5]]],
  ['Pantry', 'Baking', 'Sugar', 'cup', 'Bottom Shelf', null, [[8, B, AB, null, null, 700, 3.2]]],
  ['Pantry', 'Dairy & Eggs', 'Butter', 'cup', 'Bottom Shelf', 1, [[2, B, AB, null, null, 25, 5.0]]],
  ['Pantry', 'Dried Goods', 'Dried beans', 'cup', 'Bottom Shelf', null, [[6, B, AB, null, null, 500, 2.75]]],
  ['Pantry', 'Dairy & Eggs', 'Eggs', 'each', 'Bottom Shelf', 6, [[10, 'gifted', AB, null, null, 18]]],
  ['Pantry', 'Dairy & Eggs', 'Milk', 'cup', 'Bottom Shelf', null, [[4, B, AB, null, null, 5, 3.6]]],
  ['Pantry', 'Herbs & Spices', 'Thyme', 'tbsp', 'Spice Rack', null, [[6, HG, 'dehydrated', null, null, 365]]],
  ['Pantry', 'Herbs & Spices', 'Cinnamon', 'tsp', 'Spice Rack', null, [[20, B, AB, null, null, 500, 3.0]]],
];

const RECIPES = [
  {
    title: 'Root cellar hash',
    description: 'A big skillet of browned potatoes and carrots with eggs on top. Good for using up the bin that is getting low.',
    servings: 4, prep_minutes: 15, cook_minutes: 25, tags: ['breakfast', 'one-pan'], favorite: 1, rating: 5,
    calories: 340, protein_g: 13, carbs_g: 42, fat_g: 14, fiber_g: 6, sugar_g: 5, sodium_mg: 420,
    ingredients: [
      { quantity: 2, unit: 'lb', name: 'Russet potatoes', prep_note: 'diced small' },
      { quantity: 1, unit: 'each', name: 'Onion', prep_note: 'diced' },
      { quantity: 0.5, unit: 'lb', name: 'Carrots', prep_note: 'diced' },
      { quantity: 2, unit: 'tbsp', name: 'Butter' },
      { quantity: 4, unit: 'each', name: 'Eggs' },
      { quantity: 1, unit: 'tsp', name: 'Thyme' },
      { quantity: 1, unit: 'tsp', name: 'Salt', is_staple: 1 },
    ],
    steps: [
      'Melt the butter in a wide skillet over medium heat.',
      'Add the potatoes and carrots in one layer and leave them alone for 8 minutes so they brown.',
      'Stir in the onion and thyme and cook until everything is tender, about 10 minutes more.',
      'Make four hollows, crack in the eggs, cover, and cook until the whites set.',
    ],
  },
  {
    title: 'Apple butter oat bars',
    description: 'Chewy oat bars with a ribbon of apple butter in the middle. They keep well for a few days in a tin.',
    servings: 12, prep_minutes: 20, cook_minutes: 35, tags: ['baking', 'snack'], favorite: 1, rating: 4,
    calories: 210, protein_g: 3, carbs_g: 32, fat_g: 8,
    ingredients: [
      { quantity: 2, unit: 'cup', name: 'Rolled oats' },
      { quantity: 1, unit: 'cup', name: 'Flour' },
      { quantity: 0.5, unit: 'cup', name: 'Sugar' },
      { quantity: 0.5, unit: 'cup', name: 'Butter', prep_note: 'melted' },
      { quantity: 1, unit: 'jar', name: 'Apple butter' },
      { quantity: 1, unit: 'tsp', name: 'Cinnamon' },
      { quantity: 0.5, unit: 'tsp', name: 'Salt', is_staple: 1 },
    ],
    steps: [
      'Heat the oven to 350°F and line a square pan with parchment.',
      'Stir the oats, flour, sugar, cinnamon and salt together in a big bowl.',
      'Pour in the melted butter and mix until the crumbs hold together when squeezed.',
      'Press about two-thirds of the mixture into the pan, then spread the apple butter over it.',
      'Crumble the rest on top and bake until golden, about 35 minutes.',
      'Let the pan cool completely before you cut the bars.',
    ],
  },
  {
    title: 'Squash and white bean soup',
    description: 'A thick, gentle soup for a cold evening. The squash melts into the broth and the beans make it filling.',
    servings: 6, prep_minutes: 20, cook_minutes: 40, tags: ['supper', 'soup'], rating: 4,
    calories: 290,
    ingredients: [
      { quantity: 1, unit: 'each', name: 'Winter squash', prep_note: 'peeled and cubed' },
      { quantity: 1, unit: 'each', name: 'Onion', prep_note: 'chopped' },
      { quantity: 1, unit: 'head', name: 'Garlic', prep_note: 'cloves peeled' },
      { quantity: 2, unit: 'cup', name: 'Dried beans', prep_note: 'soaked overnight' },
      { quantity: 1, unit: 'tsp', name: 'Thyme' },
      { quantity: 6, unit: 'cup', name: 'Water', is_staple: 1 },
      { quantity: 1, unit: 'tsp', name: 'Salt', is_staple: 1 },
    ],
    steps: [
      'Drain the soaked beans and put them in a large pot with the water.',
      'Bring to a boil, then turn the heat down and simmer for 20 minutes.',
      'Add the squash, onion, garlic and thyme and simmer until the squash is soft, about 20 minutes more.',
      'Mash a few spoonfuls against the side of the pot to thicken the broth, then stir in the salt.',
    ],
  },
  {
    title: 'Skillet potato galette',
    description: 'Thin potato slices piled into a rustic, flaky crust and baked until crisp at the edges.',
    servings: 4, prep_minutes: 30, cook_minutes: 45, tags: ['supper', 'vegetarian'],
    ingredients: [
      { quantity: 1.5, unit: 'cup', name: 'Flour' },
      { quantity: 0.5, unit: 'cup', name: 'Butter', prep_note: 'cold' },
      { quantity: 2, unit: 'lb', name: 'Russet potatoes', prep_note: 'thinly sliced' },
      { quantity: 1, unit: 'each', name: 'Onion', prep_note: 'sliced' },
      { quantity: 1, unit: 'tsp', name: 'Thyme' },
      { quantity: 1, unit: 'tsp', name: 'Salt', is_staple: 1 },
    ],
    steps: [
      'Rub the cold butter into the flour with your fingertips, add a splash of cold water, and press into a dough. Chill it for 20 minutes.',
      'Roll the dough into a rough circle and lay it in a hot skillet, letting the edges hang over.',
      'Toss the potatoes, onion, thyme and salt together, then pile them in the middle.',
      'Fold the edges up over the filling and bake at 400°F until the crust is deep gold and the potatoes are tender, about 45 minutes.',
    ],
  },
  {
    title: 'Overnight oats with peaches',
    description: 'No cooking at all. Stir it together in the evening and breakfast is waiting in the morning.',
    servings: 2, prep_minutes: 5, cook_minutes: null, tags: ['breakfast', 'no-cook'],
    ingredients: [
      { quantity: 1, unit: 'cup', name: 'Rolled oats' },
      { quantity: 1, unit: 'cup', name: 'Milk' },
      { quantity: 1, unit: 'jar', name: 'Peach slices' },
      { quantity: 2, unit: 'tbsp', name: 'Honey' },
    ],
    steps: [
      'Stir the oats, milk and honey together in a bowl or two jars.',
      'Cover and chill overnight.',
      'In the morning, spoon the peach slices on top.',
    ],
  },
  {
    title: 'Roasted beets with garlic',
    description: 'Sweet, dark beets roasted with whole garlic cloves and finished with a knob of butter.',
    servings: 4, prep_minutes: 10, cook_minutes: 50, tags: ['side'],
    ingredients: [
      { quantity: 4, unit: 'lb', name: 'Beets', prep_note: 'scrubbed and quartered' },
      { quantity: 1, unit: 'head', name: 'Garlic', prep_note: 'cloves left whole' },
      { quantity: 2, unit: 'tbsp', name: 'Butter' },
    ],
    steps: [
      'Heat the oven to 400°F.',
      'Spread the beets and garlic cloves on a baking sheet and cover the pan tightly with foil.',
      'Roast until a knife slides in easily, about 50 minutes.',
      'Toss everything with the butter while it is still hot.',
    ],
  },
  {
    title: "Grandma's pickle-brine potato salad",
    description: 'The potato salad that shows up at every summer table. A splash of pickle brine is the secret.',
    servings: 6, prep_minutes: 20, cook_minutes: 20, tags: ['side', 'summer'], is_family_recipe: 1, favorite: 1, rating: 5,
    source_credit: 'Family recipe card',
    notes: 'Let it sit in the fridge for an hour before serving.',
    ingredients: [
      { quantity: 3, unit: 'lb', name: 'Russet potatoes' },
      { quantity: 1, unit: 'jar', name: 'Dill pickles' },
      { quantity: 4, unit: 'each', name: 'Eggs', prep_note: 'hard-boiled' },
      { quantity: 0.5, unit: 'cup', name: 'Mayonnaise' },
    ],
    steps: [
      'Boil the whole potatoes until a fork slides in, about 20 minutes, then peel and cube them while warm.',
      'Chop the hard-boiled eggs and a few pickles.',
      'Fold everything together with the mayonnaise and a splash of pickle brine.',
      'Chill for an hour before serving.',
    ],
  },
];

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// The folder's real name: follows junctions and symlinks, and on Windows ignores case.
const canonical = p => {
  let full = path.resolve(p);
  const rest = [];
  // Resolve the deepest part that exists, then add back what doesn't exist yet.
  while (!fs.existsSync(full) && path.dirname(full) !== full) { rest.unshift(path.basename(full)); full = path.dirname(full); }
  try { full = fs.realpathSync.native(full); } catch {}
  const out = path.join(full, ...rest);
  return process.platform === 'win32' ? out.toLowerCase() : out;
};
const within = (child, parent) => {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

// Every folder the normal (non-demo) app could be using: the default, HEARTH_DATA_DIR and config.json's dataDir.
function realDataDirs(env, root) {
  let file;
  try {
    file = readConfigFile(path.join(root, 'config.json'));
  } catch (err) {
    throw new Error(`Refusing to reset: could not read config.json to check where your real data lives (${err.message})`);
  }
  return [defaultDataDir(false), env.HEARTH_DATA_DIR, typeof file.dataDir === 'string' ? file.dataDir : null].filter(Boolean);
}

export function assertDemoFolder(config, env = process.env, root = PROJECT_ROOT) {
  if (config.demo !== true) {
    throw new Error('Refusing to reset: this is not the demo data folder (demo mode is off).');
  }
  const demo = canonical(config.dataDir);
  // The reset empties the demo folder's photos, so a real folder inside it counts too.
  if (realDataDirs(env, root).some(p => { const real = canonical(p); return within(real, demo) || within(demo, real); })) {
    throw new Error(`Refusing to reset: ${config.dataDir} is (or overlaps) your real data folder, not a demo folder. Point HEARTH_DEMO_DATA_DIR somewhere else.`);
  }
}

function resetDemoData(ctx) {
  assertDemoFolder(ctx.config);
  try { ctx.db.close(); } catch {}
  const dir = ctx.config.dataDir;
  for (const f of ['hearth.db', 'hearth.db-wal', 'hearth.db-shm']) fs.rmSync(path.join(dir, f), { force: true });
  const photos = path.join(dir, 'photos');
  if (fs.existsSync(photos)) {
    for (const e of fs.readdirSync(photos)) fs.rmSync(path.join(photos, e), { recursive: true, force: true });
  }
  ctx.reopen();
}

export function seedDemo(ctx, { reset = false } = {}) {
  if (reset) resetDemoData(ctx);
  const db = ctx.db;
  if (db.prepare('SELECT COUNT(*) n FROM items').get().n > 0) return;

  const now = new Date();
  const R = repos(db);

  transaction(db, () => {

    const storeIds = {};
    const locIds = {};
    for (const s of R.stores.list()) storeIds[s.name] = s.id;
    for (const [store, locs] of Object.entries(STORES)) {
      locs.forEach((name, i) => {
        locIds[`${store}/${name}`] = R.locations.create({ store_id: storeIds[store], name, sort_order: i }).id;
      });
    }
    const catIds = Object.fromEntries(R.categories.list({ kind: 'item' }).map(c => [c.name, c.id]));

    let code = 0;
    for (const [store, cat, name, unit, loc, low, batches] of ITEMS) {
      const item = R.items.create({
        store_id: storeIds[store], category_id: catIds[cat] ?? null, location_id: locIds[`${store}/${loc}`],
        name, unit, low_threshold: low,
      });
      for (const [qty, source, method, container, count, days, price] of batches) {
        R.batches.create({
          item_id: item.id, quantity: qty, initial_quantity: qty, unit,
          date_stored: daysFrom(now, -20), use_by: daysFrom(now, days),
          source, method, container, container_count: count,
          batch_code: source === 'preserved' ? `${name.slice(0, 2).toUpperCase()}-${pad(now.getMonth() + 1)}${pad(++code)}` : null,
          price: price ?? null, purchased_on: price != null ? daysFrom(now, -20) : null,
        });
      }
    }

    const recipeIds = RECIPES.map(r => saveRecipe(db, r).id);

    // Plan: meals spread across the current week (Monday start, the default), today included,
    // so the planner looks lived-in whichever day the demo is opened.
    const dow = (now.getDay() + 6) % 7; // Monday = 0
    const day = k => daysFrom(now, ((dow + k) % 7) - dow);
    [
      [0, 'breakfast', 0],
      [0, 'supper', 2],
      [2, 'supper', 3],
      [4, 'lunch', 6],
      [5, 'breakfast', 4],
    ].forEach(([k, slot, ri], i) => R.plan.create({ date: day(k), slot, recipe_id: recipeIds[ri], sort_order: i }));

    // Cook log
    R.cookLog.create({ recipe_id: recipeIds[0], cooked_on: daysFrom(now, -9), servings: 4, notes: 'Added extra carrots.' });
    R.cookLog.create({ recipe_id: recipeIds[0], cooked_on: daysFrom(now, -2), servings: 4 });
    R.cookLog.create({ recipe_id: recipeIds[1], cooked_on: daysFrom(now, -14), servings: 12 });

    R.shopping.create({ name: 'Beeswax wraps', quantity: 1, origin: 'manual' });
  });
}
