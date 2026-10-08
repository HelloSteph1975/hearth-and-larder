import { repos } from './repos.js';
import { transaction } from './connection.js';
import { validate, check } from '../validate.js';
import { HttpError, notFound } from '../http.js';
import { recipeSchema, ingredientSchema } from '../schemas.js';

const STATS = `(SELECT MAX(cooked_on) FROM cook_log c WHERE c.recipe_id = r.id AND c.deleted_at IS NULL) AS last_made,
  (SELECT COUNT(*) FROM cook_log c WHERE c.recipe_id = r.id AND c.deleted_at IS NULL) AS times_made,
  (SELECT p.filename FROM photos p WHERE p.owner_type = 'recipe' AND p.owner_id = r.id AND p.deleted_at IS NULL ORDER BY p.sort_order, p.id LIMIT 1) AS photo`;

const tagsFor = (db, id) => db.prepare('SELECT tag FROM recipe_tags WHERE recipe_id = ? ORDER BY tag').all(id).map(r => r.tag);
const ingredientsFor = (db, id) => db.prepare('SELECT * FROM recipe_ingredients WHERE recipe_id = ? ORDER BY sort_order, id').all(id);

export function getRecipe(db, id) {
  const row = db.prepare(`SELECT r.*, ${STATS} FROM recipes r WHERE r.id = ? AND r.deleted_at IS NULL`).get(id);
  if (!row) return null;
  return {
    ...row,
    tags: tagsFor(db, id),
    ingredients: ingredientsFor(db, id),
    steps: db.prepare('SELECT id, text FROM recipe_steps WHERE recipe_id = ? ORDER BY sort_order, id').all(id),
    photos: db.prepare("SELECT * FROM photos WHERE owner_type = 'recipe' AND owner_id = ? AND deleted_at IS NULL ORDER BY sort_order, id").all(id),
  };
}

export function listRecipes(db, f = {}) {
  const where = ['r.deleted_at IS NULL'];
  const args = [];
  if (f.q) { where.push('(r.title LIKE ? OR r.description LIKE ?)'); args.push(`%${f.q}%`, `%${f.q}%`); }
  if (f.tag) { where.push('EXISTS (SELECT 1 FROM recipe_tags t WHERE t.recipe_id = r.id AND t.tag = ?)'); args.push(String(f.tag).toLowerCase()); }
  if (f.favorite === '1') where.push('r.favorite = 1');
  if (f.family === '1') where.push('r.is_family_recipe = 1');
  return db.prepare(`SELECT r.*, ${STATS} FROM recipes r WHERE ${where.join(' AND ')} ORDER BY r.title COLLATE NOCASE`).all(...args)
    .map(r => ({
      ...r,
      tags: tagsFor(db, r.id),
      ingredients: ingredientsFor(db, r.id),
      total_minutes: (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0) || null,
    }));
}

export function allTags(db) {
  return db.prepare(`SELECT DISTINCT t.tag FROM recipe_tags t JOIN recipes r ON r.id = t.recipe_id
    WHERE r.deleted_at IS NULL ORDER BY t.tag`).all().map(r => r.tag);
}

function checkChildren(input) {
  const errors = {};
  for (const key of ['ingredients', 'steps', 'tags']) {
    if (input[key] != null && !Array.isArray(input[key])) errors[key] = 'Must be a list';
  }
  if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields.', errors);
  const ingredients = (input.ingredients ?? []).map((ing, i) => {
    const r = validate(ingredientSchema, ing ?? {});
    if (r.errors) for (const [k, v] of Object.entries(r.errors)) errors[`ingredients.${i}.${k}`] = v;
    return { ...r.data, sort_order: i };
  });
  if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields.', errors);
  const steps = (input.steps ?? []).map(s => (typeof s === 'string' ? s : s?.text)).map(s => String(s ?? '').trim()).filter(Boolean);
  const tags = [...new Set((input.tags ?? []).map(x => String(x).trim().toLowerCase()).filter(Boolean))];
  return { ingredients, steps, tags };
}

export function saveRecipe(db, input, id = null) {
  const data = check(recipeSchema, input);
  const { ingredients, steps, tags } = checkChildren(input);
  return transaction(db, () => {
    const R = repos(db).recipes;
    const row = id ? R.update(id, data) : R.create(data);
    if (!row) throw notFound('Recipe not found');
    db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(row.id);
    db.prepare('DELETE FROM recipe_steps WHERE recipe_id = ?').run(row.id);
    db.prepare('DELETE FROM recipe_tags WHERE recipe_id = ?').run(row.id);
    const insIng = db.prepare(`INSERT INTO recipe_ingredients (recipe_id, section, quantity, unit, name, prep_note, optional, is_staple, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const g of ingredients) {
      insIng.run(row.id, g.section ?? null, g.quantity ?? null, g.unit ?? null, g.name, g.prep_note ?? null, g.optional ?? 0, g.is_staple ?? 0, g.sort_order);
    }
    const insStep = db.prepare('INSERT INTO recipe_steps (recipe_id, text, sort_order) VALUES (?, ?, ?)');
    steps.forEach((text, i) => insStep.run(row.id, text, i));
    const insTag = db.prepare('INSERT INTO recipe_tags (recipe_id, tag) VALUES (?, ?)');
    for (const tag of tags) insTag.run(row.id, tag);
    return getRecipe(db, row.id);
  });
}
