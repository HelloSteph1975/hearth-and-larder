import { getRecipe } from '../db/recipes.js';
import { repos } from '../db/repos.js';
import { addDeduction, deductionsFor, updateDeduction, anyBatch, setBatchStock } from '../db/cook.js';
import { transaction } from '../db/connection.js';
import { stockIndex, scaleQty } from './stock.js';
import { toBase, fromBase, round, normalizeName } from './units.js';
import { HttpError, notFound } from '../http.js';

export function proposeDeductions(db, recipeId, servings) {
  const recipe = getRecipe(db, recipeId);
  if (!recipe) throw notFound('Recipe not found');
  const index = stockIndex(db);
  const deductions = [];
  const unmatched = [];
  for (const ing of recipe.ingredients) {
    if (ing.is_staple) continue;
    const batches = index.get(normalizeName(ing.name)) ?? [];
    const need = scaleQty(ing.quantity, recipe.servings, servings ?? recipe.servings);
    if (!batches.length || need == null) { if (!batches.length) unmatched.push(ing.name); continue; }
    let remaining = toBase(need, ing.unit);
    for (const b of batches) {
      if (remaining.amount <= 1e-9) break;
      const avail = toBase(b.quantity, b.unit);
      if (avail.family !== remaining.family) continue;
      const takeBase = Math.min(avail.amount, remaining.amount);
      const consumed = takeBase >= avail.amount;
      remaining = { ...remaining, amount: remaining.amount - takeBase };
      deductions.push({
        ingredient_id: ing.id, ingredient_name: ing.name, batch_id: b.batch_id, item_name: b.item_name,
        take: consumed ? b.quantity : round(fromBase(takeBase, b.unit), 4), unit: b.unit, available: b.quantity,
      });
    }
  }
  return { deductions, unmatched };
}

// Takes up to `take` from a batch. Returns what was really taken and whether that used the batch up.
function takeFromBatch(db, batch, take, stamp) {
  const left = round(Math.max(0, batch.quantity - take), 4);
  const amount = round(batch.quantity - left, 4);
  const was_used_up = left <= 0 && !batch.used_up_at;
  setBatchStock(db, batch.id, left, was_used_up ? stamp : batch.used_up_at);
  return { amount, was_used_up };
}

export function applyCook(db, { recipe_id, servings, cooked_on, notes, deductions = [] }) {
  return transaction(db, () => {
    const R = repos(db);
    if (!R.recipes.get(recipe_id)) throw notFound('Recipe not found');
    const bad = () => new HttpError(400, 'One of the stock lines is no longer valid. Please reopen the dialog.');
    if (!Array.isArray(deductions)) throw bad();
    const takes = deductions.map(d => {
      if (!d || typeof d !== 'object' || Array.isArray(d)) throw bad();
      const blank = d.take == null || (typeof d.take === 'string' && !d.take.trim());
      const take = blank ? NaN : Number(d.take);
      const b = R.batches.get(Number(d.batch_id));
      if (!b || b.used_up_at || !Number.isFinite(take) || take < 0) throw bad();
      return { batch_id: b.id, take };
    });
    const log = R.cookLog.create({ recipe_id, cooked_on, servings: servings ?? null, notes: notes ?? null });
    const stamp = new Date().toISOString();
    for (const { batch_id, take } of takes) {
      if (take === 0) continue;
      // Re-read so two lines from the same batch both count.
      const taken = takeFromBatch(db, anyBatch(db, batch_id), take, stamp);
      if (taken.amount > 0) addDeduction(db, { cook_log_id: log.id, batch_id, ...taken });
    }
    return log;
  });
}

// Deleting a cook log puts back what it took, and un-marks batches it used up.
export function returnCookStock(db, cookLogId) {
  for (const d of deductionsFor(db, cookLogId)) {
    const b = anyBatch(db, d.batch_id);
    if (!b) continue;
    setBatchStock(db, b.id, round(b.quantity + d.amount, 4), d.was_used_up ? null : b.used_up_at);
  }
}

// Restoring a cook log takes the same amounts again (or what is left, if less).
export function reapplyCookStock(db, cookLogId) {
  const stamp = new Date().toISOString();
  for (const d of deductionsFor(db, cookLogId)) {
    const b = anyBatch(db, d.batch_id);
    if (!b) continue;
    updateDeduction(db, d.id, takeFromBatch(db, b, d.amount, stamp));
  }
}
