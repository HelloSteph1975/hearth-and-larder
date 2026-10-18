import { repos } from '../db/repos.js';
import { addTime } from './batch.js';
import { normalizeName } from './units.js';

// A harvest this recent, picked after the last make, makes its staple due.
export const HARVEST_DAYS = 14;
// "Due this week" also shows what comes due in the next few days.
export const SOON_DAYS = 6;

const pad = n => String(n).padStart(2, '0');
const monthsOf = s => new Set((s ?? '').split(',').map(Number).filter(n => n >= 1 && n <= 12));
export const cropsOf = s => (s ?? '').split(',').map(x => x.trim()).filter(Boolean);
const step = (date, n, unit) => (unit === 'years' ? addTime(date, n * 12, 'months') : addTime(date, n, unit));
const ym = date => [Number(date.slice(0, 4)), Number(date.slice(5, 7))];
const prev = ([y, m]) => (m === 1 ? [y - 1, 12] : [y, m - 1]);
const next = ([y, m]) => (m === 12 ? [y + 1, 1] : [y, m + 1]);
const first = ([y, m]) => `${y}-${pad(m)}-01`;

// The first day of the in-season stretch that today falls in, or null when out of season.
export function seasonStart(today, months) {
  let at = ym(today);
  if (!months.has(at[1])) return null;
  for (let i = 0; i < 11 && months.has(prev(at)[1]); i++) at = prev(at);
  return first(at);
}

// The first day of the next in-season stretch that starts after today.
export function nextSeason(today, months) {
  let at = ym(today);
  for (let i = 0; i < 24; i++) {
    const before = at;
    at = next(at);
    if (months.has(at[1]) && !months.has(before[1])) return first(at);
  }
  return null;
}

// Where a staple stands today. States: harvest, overdue, due, later, new (never made, nothing pulling it in).
export function rhythmStatus(r, { lastMade = null, harvest = null } = {}, today) {
  const base = { last_made: lastMade, harvest: null, due_from: null, due_to: null, in_season: false, next_season: null };
  const months = monthsOf(r.season_months);
  if (months.size) {
    const start = seasonStart(today, months);
    base.in_season = Boolean(start);
    base.next_season = nextSeason(today, months);
  }
  if (harvest) return { ...base, state: 'harvest', harvest, due_from: today };
  if (months.size) {
    const start = seasonStart(today, months);
    if (start && (!lastMade || lastMade < start)) return { ...base, state: 'due', due_from: start };
    return { ...base, state: 'later', due_from: base.next_season };
  }
  if (!lastMade) return { ...base, state: 'new' };
  const due_from = step(lastMade, r.every_min, r.every_unit);
  const due_to = step(lastMade, r.every_max ?? r.every_min, r.every_unit);
  const state = today > due_to ? 'overdue' : today >= due_from ? 'due' : 'later';
  return { ...base, state, due_from, due_to };
}

// Recent harvests: logged ones, plus home-grown batches put on the shelves.
export function recentHarvests(db, today) {
  const from = addTime(today, -HARVEST_DAYS, 'days');
  const logged = db.prepare(`SELECT crop, quantity, unit, harvested_on FROM harvests
    WHERE deleted_at IS NULL AND harvested_on BETWEEN ? AND ?`).all(from, today);
  const grown = db.prepare(`SELECT i.name AS crop, b.quantity, b.unit, COALESCE(b.date_stored, date(b.created_at)) AS harvested_on
    FROM batches b JOIN items i ON i.id = b.item_id
    WHERE b.deleted_at IS NULL AND i.deleted_at IS NULL AND b.source = 'home-grown'
      AND COALESCE(b.date_stored, date(b.created_at)) BETWEEN ? AND ?`).all(from, today);
  return [...logged, ...grown].sort((a, b) => b.harvested_on.localeCompare(a.harvested_on));
}

const RANK = { harvest: 0, overdue: 1, due: 2, later: 3, new: 4 };

export function listRhythms(db, today) {
  const rows = repos(db).rhythms.list();
  const last = new Map(db.prepare('SELECT rhythm_id, MAX(made_on) AS made_on FROM rhythm_log WHERE deleted_at IS NULL GROUP BY rhythm_id').all()
    .map(x => [x.rhythm_id, x.made_on]));
  const harvests = recentHarvests(db, today).map(h => ({ ...h, key: normalizeName(h.crop) }));
  return rows.map(r => {
    const lastMade = last.get(r.id) ?? null;
    const crops = new Set(cropsOf(r.crops).map(normalizeName));
    const harvest = harvests.find(h => crops.has(h.key) && (!lastMade || h.harvested_on > lastMade)) ?? null;
    const { key, ...h } = harvest ?? {};
    return { ...r, ...rhythmStatus(r, { lastMade, harvest: harvest ? h : null }, today) };
  });
}

// What wants making now or in the next few days, most pressing first.
export function dueSoon(db, today) {
  const soon = addTime(today, SOON_DAYS, 'days');
  return listRhythms(db, today)
    .filter(r => ['harvest', 'overdue', 'due'].includes(r.state) || (r.state === 'later' && r.due_from && r.due_from <= soon))
    .sort((a, b) => RANK[a.state] - RANK[b.state] || (a.due_from ?? '').localeCompare(b.due_from ?? '') || a.sort_order - b.sort_order);
}

export function logMade(db, rhythmId, madeOn, planEntryId = null) {
  return repos(db).rhythmLog.create({ rhythm_id: rhythmId, made_on: madeOn, plan_entry_id: planEntryId });
}

// A planner task tied to a staple: ticking it done logs a make, unticking takes it back.
export function syncPlanMake(db, entry) {
  const R = repos(db).rhythmLog;
  const log = db.prepare('SELECT * FROM rhythm_log WHERE plan_entry_id = ? AND deleted_at IS NULL').get(entry.id);
  if (!entry.rhythm_id || !entry.done_on) {
    if (log) db.prepare('DELETE FROM rhythm_log WHERE id = ?').run(log.id);
    return;
  }
  if (log) R.update(log.id, { made_on: entry.done_on, rhythm_id: entry.rhythm_id });
  else logMade(db, entry.rhythm_id, entry.done_on, entry.id);
}

const MONTHS = /^(1[0-2]|[1-9])(,(1[0-2]|[1-9]))*$/;
// Returns field errors for a staple, or null when it is fine.
export function rhythmErrors(r) {
  const errors = {};
  if (r.season_months && !MONTHS.test(r.season_months)) errors.season_months = 'Pick months from the list';
  if (r.every_min != null && !r.every_unit) errors.every_unit = 'Pick weeks, months or years';
  if (r.every_min != null && r.every_max != null && r.every_max < r.every_min) errors.every_max = "Can't be less than the first number";
  if (r.every_min == null && !r.season_months) errors.every_min = 'Say how often, or pick its months';
  return Object.keys(errors).length ? errors : null;
}
