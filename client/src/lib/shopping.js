import { api } from './api.js';
import { normalizeName, toBase, fromBase } from '../../../server/services/units.js';

const norm = s => String(s ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
const round = n => Math.round(n * 100) / 100;

// What a recipe is short of, at the servings it was checked for: the gap when we know it, else the full amount.
export function shortfalls(status) {
  return (status?.ingredients ?? [])
    .filter(i => (i.status === 'missing' || i.status === 'partial') && !i.optional && !i.is_staple)
    .map(i => {
      const quantity = i.scaled_quantity == null ? null : round(Math.max(0, i.scaled_quantity - (i.have ?? 0)));
      return quantity ? { name: i.name, quantity, unit: i.unit || null } : { name: i.name, quantity: null, unit: null };
    });
}

// One name on several recipe lines (dough and filling) gives several shortfalls. Add those up when their
// units convert (in the first line's unit); rows whose units can't be combined stay separate.
export function combineShortfalls(rows) {
  const out = new Map();
  for (const row of rows) {
    const base = row.quantity == null ? null : toBase(row.quantity, row.unit);
    const key = `${normalizeName(row.name)}|${base ? base.family : 'any'}`;
    const seen = out.get(key);
    if (!seen) { out.set(key, { row: { ...row }, amount: base?.amount ?? null }); continue; }
    if (base) {
      seen.amount += base.amount;
      seen.row.quantity = round(fromBase(seen.amount, seen.row.unit));
    }
  }
  return [...out.values()].map(v => v.row);
}

// Adds each shortfall unless something by that name is already waiting (unticked) on the list.
export async function addShortfallsToList(rows, client = api) {
  const list = await client.get('/api/shopping');
  const waiting = new Set((list ?? []).filter(r => !r.checked).map(r => norm(r.name)));
  const added = [];
  const skipped = [];
  for (const row of combineShortfalls(rows)) {
    if (waiting.has(norm(row.name))) { skipped.push(row.name); continue; }
    await client.post('/api/shopping', row);
    added.push(row.name);
  }
  return { added, skipped };
}

export function shortfallMessage({ added, skipped }, title) {
  const forWhat = title ? ` for ${title}` : '';
  if (!added.length) return `Already on the shopping list${forWhat}`;
  const extra = skipped.length ? ` (${skipped.length} already on it)` : '';
  return `Added ${added.length} to the shopping list${forWhat}${extra}`;
}
