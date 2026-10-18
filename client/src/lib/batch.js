import { addDays } from './dates.js';

export const KIND_LABEL = { big: 'Big make', jar: 'Start a jar', refill: 'Refill' };

const UNIT = { days: ['day', 'days'], weeks: ['week', 'weeks'], months: ['month', 'months'] };

// "7 to 14 days", "2 days", "1 to 2 weeks".
export function readyTime({ ready_min: min, ready_max: max, ready_unit: unit }) {
  if (min == null) return null;
  const [one, many] = UNIT[unit] ?? UNIT.days;
  if (max == null || max === min) return `${min} ${min === 1 ? one : many}`;
  return `${min} to ${max} ${many}`;
}

const parse = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
export function shortDate(iso, withYear = false) {
  const d = parse(iso);
  const out = `${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}`;
  return withYear ? `${out} ${d.getFullYear()}` : out;
}

// "Ready 28 Oct to 4 Nov". The year shows only when the window ends in another year.
export function readyRange({ ready_from: from, ready_to: to }, today) {
  if (!from) return null;
  const year = Boolean(today) && to.slice(0, 4) !== today.slice(0, 4);
  return from === to ? `Ready ${shortDate(from, year)}` : `Ready ${shortDate(from, year)} to ${shortDate(to, year)}`;
}

// Where a jar stands today: waiting, ready to check, or past its window.
export function readyState({ ready_from: from, ready_to: to }, today) {
  if (!from) return null;
  if (today < from) return 'waiting';
  return today <= to ? 'ready' : 'past';
}

// The default three days of a week: the first, third and sixth (Mon, Wed, Sat for a Monday week).
export const DEFAULT_OFFSETS = [0, 2, 5];
export const datesFor = (start, offsets) => [...offsets].sort((a, b) => a - b).map(n => addDays(start, n));
