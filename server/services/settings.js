import { HttpError } from '../http.js';

export const DEFAULT_SETTINGS = { household_name: '', week_start: 'monday', default_servings: '4', use_soon_days: '14' };
const RULES = {
  household_name: v => v.length <= 60,
  week_start: v => ['monday', 'sunday', 'saturday'].includes(v),
  default_servings: v => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 50,
  use_soon_days: v => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 120,
};

export function getSettings(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries(rows.map(r => [r.key, r.value])) };
}

export function saveSettings(db, input) {
  // Null-prototype objects, so a key like "__proto__" is stored as a key, not swallowed.
  const errors = Object.create(null);
  const clean = Object.create(null);
  for (const [k, v] of Object.entries(input ?? {})) {
    if (!Object.hasOwn(RULES, k)) { errors[k] = 'Unknown setting'; continue; }
    const ok = typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v));
    const norm = ok ? String(v).trim() : '';
    if (!ok || !RULES[k](norm)) errors[k] = 'Not a valid value';
    else clean[k] = norm;
  }
  if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields.', { ...errors });
  const up = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [k, v] of Object.entries(clean)) up.run(k, v);
  return getSettings(db);
}
