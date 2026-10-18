import { transaction } from '../db/connection.js';
import { repos } from '../db/repos.js';
import { planEntries, readyEntries } from '../db/plan.js';

const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };

export function addTime(date, n, unit) {
  const d = parse(date);
  if (unit === 'months') {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + n);
    // 31 Jan plus one month is the last day of February, not 3 March.
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  } else {
    d.setUTCDate(d.getUTCDate() + n * (unit === 'weeks' ? 7 : 1));
  }
  return iso(d);
}

// A task with a ready time counts from the day it was done, or from its planned day until then.
export function readyWindow(entry) {
  if (entry.ready_min == null) return { ready_from: null, ready_to: null };
  const start = entry.done_on ?? entry.date;
  return {
    ready_from: addTime(start, entry.ready_min, entry.ready_unit),
    ready_to: addTime(start, entry.ready_max ?? entry.ready_min, entry.ready_unit),
  };
}

export const withReady = entry => ({ ...entry, ...readyWindow(entry) });

export function planWithReady(db, from, to) {
  return planEntries(db, from, to).map(withReady);
}

// Jars started (or planned) whose ready window has not long passed: the ones to keep an eye on.
export function jarsWorking(db, today, { graceDays = 14 } = {}) {
  const cutoff = addTime(today, -graceDays, 'days');
  return readyEntries(db).map(withReady).filter(e => e.ready_to >= cutoff)
    .sort((a, b) => a.ready_from.localeCompare(b.ready_from) || a.id - b.id);
}

export function listBatchPlans(db) {
  const plans = db.prepare('SELECT * FROM batch_plans WHERE deleted_at IS NULL ORDER BY week_no, id').all();
  const days = db.prepare('SELECT * FROM batch_days ORDER BY plan_id, day_no').all();
  const ings = db.prepare('SELECT day_id, name FROM batch_day_ingredients ORDER BY day_id, sort_order, id').all();
  // One row per placement that still has entries on the planner.
  const runs = db.prepare(`SELECT r.id, r.plan_id, MIN(m.date) AS first_date, MAX(m.date) AS last_date,
      COUNT(m.id) AS tasks, COUNT(m.done_on) AS done_tasks
    FROM batch_runs r JOIN meal_plan m ON m.batch_run_id = r.id AND m.deleted_at IS NULL
    WHERE r.deleted_at IS NULL GROUP BY r.id ORDER BY first_date, r.id`).all();
  const ingByDay = Map.groupBy(ings, i => i.day_id);
  const daysByPlan = Map.groupBy(days, d => d.plan_id);
  const runsByPlan = Map.groupBy(runs, r => r.plan_id);
  return plans.map(p => {
    const placed = runsByPlan.get(p.id) ?? [];
    const finished = placed.filter(r => r.done_tasks === r.tasks);
    return {
      ...p,
      days: (daysByPlan.get(p.id) ?? []).map(d => ({ ...d, ingredients: (ingByDay.get(d.id) ?? []).map(i => i.name) })),
      runs: placed,
      done: finished.length > 0,
      done_on: finished.at(-1)?.last_date ?? null,
    };
  });
}

// Puts the three days of a batch week on the planner, Day 1 on the earliest date.
export function placeBatchWeek(db, planId, dates) {
  const sorted = [...dates].sort();
  return transaction(db, () => {
    const days = db.prepare('SELECT * FROM batch_days WHERE plan_id = ? ORDER BY day_no').all(planId);
    const run = Number(db.prepare('INSERT INTO batch_runs (plan_id) VALUES (?)').run(planId).lastInsertRowid);
    const count = db.prepare("SELECT COUNT(*) n FROM meal_plan WHERE date = ? AND slot = 'batch' AND deleted_at IS NULL");
    const entries = days.map((d, i) => repos(db).plan.create({
      date: sorted[i], slot: 'batch', note: d.task, sort_order: count.get(sorted[i]).n, batch_run_id: run, batch_day_id: d.id,
    }));
    return { run_id: run, entries: entries.map(e => e.id) };
  });
}

// Ingredients the not-yet-done batch tasks in a plan range need, as unitless shopping needs.
export function batchNeeds(db, entries) {
  const ids = entries.filter(e => e.batch_day_id && !e.done_on).map(e => e.batch_day_id);
  if (!ids.length) return [];
  const byDay = Map.groupBy(db.prepare(`SELECT day_id, name FROM batch_day_ingredients WHERE day_id IN (${ids.map(() => '?').join(',')})
    ORDER BY sort_order, id`).all(...new Set(ids)), r => r.day_id);
  return ids.flatMap(id => (byDay.get(id) ?? []).map(r => r.name));
}
