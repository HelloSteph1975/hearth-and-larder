import { BATCH_MONTHS } from './batchSeed.js';

const TS =`created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), deleted_at TEXT`;

export const migrations = [
  `
  CREATE TABLE stores (id INTEGER PRIMARY KEY, name TEXT NOT NULL, icon TEXT NOT NULL DEFAULT 'jar',
    color TEXT NOT NULL DEFAULT '#C44A3A', sort_order INTEGER NOT NULL DEFAULT 0, ${TS});
  CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'item' CHECK (kind IN ('item','shopping')), sort_order INTEGER NOT NULL DEFAULT 0, ${TS});
  CREATE TABLE locations (id INTEGER PRIMARY KEY, store_id INTEGER NOT NULL REFERENCES stores(id),
    name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, ${TS});
  CREATE TABLE items (id INTEGER PRIMARY KEY, store_id INTEGER NOT NULL REFERENCES stores(id),
    category_id INTEGER REFERENCES categories(id), location_id INTEGER REFERENCES locations(id),
    name TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'each', low_threshold REAL, notes TEXT,
    favorite INTEGER NOT NULL DEFAULT 0, ${TS});
  CREATE TABLE recipes (id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT,
    servings REAL NOT NULL DEFAULT 4, prep_minutes INTEGER, cook_minutes INTEGER, source_credit TEXT,
    is_family_recipe INTEGER NOT NULL DEFAULT 0, favorite INTEGER NOT NULL DEFAULT 0,
    rating INTEGER CHECK (rating BETWEEN 0 AND 5), notes TEXT,
    calories REAL, protein_g REAL, carbs_g REAL, fat_g REAL, fiber_g REAL, sugar_g REAL, sodium_mg REAL, ${TS});
  CREATE TABLE batches (id INTEGER PRIMARY KEY, item_id INTEGER NOT NULL REFERENCES items(id),
    quantity REAL NOT NULL DEFAULT 0, initial_quantity REAL, unit TEXT NOT NULL DEFAULT 'each',
    date_stored TEXT, use_by TEXT,
    source TEXT CHECK (source IN ('home-grown','preserved','bought','gifted','foraged')),
    method TEXT CHECK (method IN ('water bath','pressure canned','dehydrated','fermented','cured','frozen','root storage','as bought','other')),
    container TEXT, container_count INTEGER, recipe_id INTEGER REFERENCES recipes(id), batch_code TEXT, notes TEXT,
    price REAL, vendor TEXT, purchased_on TEXT, used_up_at TEXT, ${TS});
  CREATE TABLE photos (id INTEGER PRIMARY KEY, owner_type TEXT NOT NULL CHECK (owner_type IN ('item','batch','recipe')),
    owner_id INTEGER NOT NULL, filename TEXT NOT NULL, caption TEXT, sort_order INTEGER NOT NULL DEFAULT 0, ${TS});
  CREATE TABLE recipe_tags (recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE, tag TEXT NOT NULL,
    PRIMARY KEY (recipe_id, tag));
  CREATE TABLE recipe_ingredients (id INTEGER PRIMARY KEY, recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    section TEXT, quantity REAL, unit TEXT, name TEXT NOT NULL, prep_note TEXT,
    optional INTEGER NOT NULL DEFAULT 0, is_staple INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE recipe_steps (id INTEGER PRIMARY KEY, recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    text TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE cook_log (id INTEGER PRIMARY KEY, recipe_id INTEGER NOT NULL REFERENCES recipes(id),
    cooked_on TEXT NOT NULL, servings REAL, notes TEXT, ${TS});
  CREATE TABLE meal_plan (id INTEGER PRIMARY KEY, date TEXT NOT NULL,
    slot TEXT NOT NULL CHECK (slot IN ('breakfast','lunch','supper','snack')),
    recipe_id INTEGER REFERENCES recipes(id), note TEXT, servings REAL, sort_order INTEGER NOT NULL DEFAULT 0, ${TS},
    CHECK (recipe_id IS NOT NULL OR note IS NOT NULL));
  CREATE TABLE shopping_items (id INTEGER PRIMARY KEY, name TEXT NOT NULL, quantity REAL, unit TEXT,
    category_id INTEGER REFERENCES categories(id), est_price REAL, checked INTEGER NOT NULL DEFAULT 0,
    origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('plan','manual')), plan_range TEXT, ${TS});
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  CREATE INDEX idx_batches_item ON batches(item_id);
  CREATE INDEX idx_photos_owner ON photos(owner_type, owner_id);
  CREATE INDEX idx_plan_date ON meal_plan(date);
  CREATE INDEX idx_ing_recipe ON recipe_ingredients(recipe_id);

  INSERT INTO stores (name, icon, color, sort_order) VALUES
    ('Larder', 'jar', '#C44A3A', 0), ('Root Cellar', 'potato', '#8E5A3A', 1), ('Pantry', 'wheat', '#B8862E', 2);
  INSERT INTO categories (name, kind, sort_order) VALUES
    ('Preserves','item',0),('Grains & Flours','item',1),('Root Vegetables','item',2),('Fruit','item',3),
    ('Dairy & Eggs','item',4),('Meat & Fish','item',5),('Herbs & Spices','item',6),('Baking','item',7),
    ('Oils & Vinegars','item',8),('Dried Goods','item',9),('Other','item',10),
    ('Produce','shopping',0),('Dairy & Eggs','shopping',1),('Meat & Fish','shopping',2),('Bakery','shopping',3),
    ('Pantry Staples','shopping',4),('Household','shopping',5),('Other','shopping',6);
  `,
  // 2: what each cook took from which batch, so deleting a cook log can put the stock back.
  `
  CREATE TABLE cook_deductions (id INTEGER PRIMARY KEY, cook_log_id INTEGER NOT NULL REFERENCES cook_log(id),
    batch_id INTEGER NOT NULL REFERENCES batches(id), amount REAL NOT NULL, was_used_up INTEGER NOT NULL DEFAULT 0);
  CREATE INDEX idx_deductions_log ON cook_deductions(cook_log_id);
  CREATE INDEX idx_deductions_batch ON cook_deductions(batch_id);
  `,
  // 3: a Refrigerator and a Freezer, each with a few starter shelves. A store the user
  // already made with the same name is left alone, and nothing that exists is moved.
  db => {
    const BUILT_IN = [
      { name: 'Refrigerator', icon: 'fridge', color: '#5E8C8A', shelves: ['Top shelf', 'Crisper drawer', 'Door'] },
      { name: 'Freezer', icon: 'freezer', color: '#5B7FA6', shelves: ['Top shelf', 'Bottom drawer'] },
    ];
    const exists = db.prepare('SELECT 1 FROM stores WHERE deleted_at IS NULL AND lower(trim(name)) = lower(?)');
    const next = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 n FROM stores');
    const addStore = db.prepare('INSERT INTO stores (name, icon, color, sort_order) VALUES (?, ?, ?, ?)');
    const addShelf = db.prepare('INSERT INTO locations (store_id, name, sort_order) VALUES (?, ?, ?)');
    for (const s of BUILT_IN) {
      if (exists.get(s.name)) continue;
      const id = Number(addStore.run(s.name, s.icon, s.color, next.get().n).lastInsertRowid);
      s.shelves.forEach((shelf, i) => addShelf.run(id, shelf, i));
    }
  },
  // 4: batch days. The planner gains a 'batch' slot, and twelve built-in batch weeks
  // can be placed on it. SQLite can't change a CHECK, so meal_plan is rebuilt with its rows kept.
  db => {
    db.exec(`
    CREATE TABLE batch_plans (id INTEGER PRIMARY KEY, week_no INTEGER NOT NULL, month_title TEXT NOT NULL, month_note TEXT,
      title TEXT NOT NULL, cook TEXT, ${TS});
    CREATE TABLE batch_days (id INTEGER PRIMARY KEY, plan_id INTEGER NOT NULL REFERENCES batch_plans(id),
      day_no INTEGER NOT NULL CHECK (day_no BETWEEN 1 AND 3), kind TEXT NOT NULL CHECK (kind IN ('big','jar','refill')), task TEXT NOT NULL,
      ready_min INTEGER, ready_max INTEGER, ready_unit TEXT CHECK (ready_unit IN ('days','weeks','months')));
    CREATE TABLE batch_day_ingredients (id INTEGER PRIMARY KEY, day_id INTEGER NOT NULL REFERENCES batch_days(id),
      name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE batch_runs (id INTEGER PRIMARY KEY, plan_id INTEGER NOT NULL REFERENCES batch_plans(id), ${TS});

    CREATE TABLE meal_plan_new (id INTEGER PRIMARY KEY, date TEXT NOT NULL,
      slot TEXT NOT NULL CHECK (slot IN ('breakfast','lunch','supper','snack','batch')),
      recipe_id INTEGER REFERENCES recipes(id), note TEXT, servings REAL, sort_order INTEGER NOT NULL DEFAULT 0,
      batch_run_id INTEGER REFERENCES batch_runs(id), batch_day_id INTEGER REFERENCES batch_days(id), done_on TEXT, ${TS},
      CHECK (recipe_id IS NOT NULL OR note IS NOT NULL));
    INSERT INTO meal_plan_new (id, date, slot, recipe_id, note, servings, sort_order, created_at, updated_at, deleted_at)
      SELECT id, date, slot, recipe_id, note, servings, sort_order, created_at, updated_at, deleted_at FROM meal_plan;
    DROP TABLE meal_plan;
    ALTER TABLE meal_plan_new RENAME TO meal_plan;
    CREATE INDEX idx_plan_date ON meal_plan(date);
    CREATE INDEX idx_plan_run ON meal_plan(batch_run_id);
    CREATE INDEX idx_batch_days_plan ON batch_days(plan_id);
    CREATE INDEX idx_batch_ing_day ON batch_day_ingredients(day_id);
    `);
    seedBatchPlans(db);
  },
];

function seedBatchPlans(db) {
  const addPlan = db.prepare('INSERT INTO batch_plans (week_no, month_title, month_note, title, cook) VALUES (?, ?, ?, ?, ?)');
  const addDay = db.prepare('INSERT INTO batch_days (plan_id, day_no, kind, task, ready_min, ready_max, ready_unit) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const addIng = db.prepare('INSERT INTO batch_day_ingredients (day_id, name, sort_order) VALUES (?, ?, ?)');
  let weekNo = 0;
  for (const month of BATCH_MONTHS) {
    for (const week of month.weeks) {
      const planId = Number(addPlan.run(++weekNo, month.title, month.note, week.title, week.cook).lastInsertRowid);
      week.days.forEach(([kind, task, ready, ingredients], i) => {
        const [min, max, unit] = ready ?? [null, null, null];
        const dayId = Number(addDay.run(planId, i + 1, kind, task, min, max, unit).lastInsertRowid);
        ingredients.forEach((name, j) => addIng.run(dayId, name, j));
      });
    }
  }
}

export function migrate(db) {
  const current = db.prepare('PRAGMA user_version').get().user_version;
  for (let i = current; i < migrations.length; i++) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const step = migrations[i];
      if (typeof step === 'function') step(db); else db.exec(step);
      db.exec(`PRAGMA user_version = ${i + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}
