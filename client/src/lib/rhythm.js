import { api } from './api.js';
import { daysBetween } from './dates.js';
import { shortDate } from './batch.js';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const PRESETS = [
  { value: 'w1', label: 'Every week', every: [1, 1, 'weeks'] },
  { value: 'w2', label: 'Every 2 weeks', every: [2, 2, 'weeks'] },
  { value: 'w24', label: 'Every 2 to 4 weeks', every: [2, 4, 'weeks'] },
  { value: 'm1', label: 'Every month', every: [1, 1, 'months'] },
  { value: 'm12', label: 'Every month or two', every: [1, 2, 'months'] },
  { value: 'm34', label: 'Every 3 to 4 months', every: [3, 4, 'months'] },
  { value: 'y1', label: 'Once a year', every: [1, 1, 'years'] },
  { value: 'season', label: 'In its season' },
  { value: 'own', label: 'My own' },
];

export function presetOf(r) {
  if (r.season_months) return 'season';
  const max = r.every_max ?? r.every_min;
  return PRESETS.find(p => p.every && p.every[0] === r.every_min && p.every[1] === max && p.every[2] === r.every_unit)?.value ?? 'own';
}

const monthList = s => (s ?? '').split(',').map(Number).filter(n => n >= 1 && n <= 12);

// "Jun to Sep", "Dec to Feb", or "Jan, Apr" when the months don't run together.
export function monthRange(s) {
  const set = new Set(monthList(s));
  if (!set.size) return '';
  if (set.size === 12) return 'all year';
  const start = [...set].find(m => !set.has(m === 1 ? 12 : m - 1));
  const run = [];
  if (start) for (let m = start; set.has(m) && run.length < 12; m = m === 12 ? 1 : m + 1) run.push(m);
  if (run.length === set.size) return run.length === 1 ? MONTHS[run[0] - 1] : `${MONTHS[run[0] - 1]} to ${MONTHS[run.at(-1) - 1]}`;
  return [...set].sort((a, b) => a - b).map(m => MONTHS[m - 1]).join(', ');
}

const UNIT = { weeks: ['week', 'weeks'], months: ['month', 'months'], years: ['year', 'years'] };
export function cadenceText(r) {
  if (r.season_months) return `In season ${monthRange(r.season_months)}`;
  const [one, many] = UNIT[r.every_unit] ?? UNIT.weeks;
  const min = r.every_min;
  const max = r.every_max ?? min;
  if (min === max) return min === 1 ? `Every ${one}` : `Every ${min} ${many}`;
  return `Every ${min} to ${max} ${many}`;
}

// [badge tone or null, text] for where a staple stands today.
export function statusOf(r, today) {
  switch (r.state) {
    case 'harvest': {
      const ago = daysBetween(r.harvest.harvested_on, today);
      return ['garden', `${r.harvest.crop} picked ${ago === 0 ? 'today' : ago === 1 ? 'yesterday' : `${ago} days ago`}`];
    }
    case 'overdue': return ['tomato', `Was due by ${shortDate(r.due_to)}`];
    case 'due': return ['honey', r.season_months ? 'In season now' : `Due now, by ${shortDate(r.due_to)}`];
    case 'later':
      if (r.season_months) return [null, r.in_season ? 'Made this season' : `Next season from ${MONTHS[Number(r.next_season.slice(5, 7)) - 1]}`];
      return [null, `Next from ${shortDate(r.due_from)}`];
    default: return [null, 'Not made yet'];
  }
}

// The group a staple sits in on the rhythm list.
export function groupOf(r) {
  if (r.season_months) return 'In their season';
  if (r.every_unit === 'weeks') return (r.every_max ?? r.every_min) <= 1 ? 'Every week' : 'Every few weeks';
  return 'Every month or longer';
}
export const GROUPS = ['Every week', 'Every few weeks', 'Every month or longer', 'In their season'];

// Logs a make for today, with an Undo in the toast.
export async function markMade(rhythm, today, { toast, onChange }) {
  try {
    const log = await api.post(`/api/rhythms/${rhythm.id}/made`, { made_on: today });
    onChange?.();
    toast.show({
      message: `Made ${rhythm.name}. Nice work.`,
      duration: 8000,
      action: {
        label: 'Undo',
        onClick: async () => {
          try { await api.del(log.undo); onChange?.(); } catch (err) { toast.show({ message: err.message, duration: 6000 }); }
        },
      },
    });
  } catch (err) { toast.show({ message: err.message, duration: 6000 }); }
}
