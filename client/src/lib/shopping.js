import { api } from './api.js';

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

// Adds each shortfall unless something by that name is already waiting on the list.
export async function addShortfallsToList(rows, client = api) {
  const list = await client.get('/api/shopping');
  const waiting = new Set((list ?? []).filter(r => !r.checked).map(r => norm(r.name)));
  const added = [];
  const skipped = [];
  for (const row of rows) {
    if (waiting.has(norm(row.name))) { skipped.push(row.name); continue; }
    await client.post('/api/shopping', row);
    waiting.add(norm(row.name));
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
