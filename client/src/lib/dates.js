const pad = n => String(n).padStart(2, '0');
export const toISODate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
export const todayISO = () => toISODate(new Date());
export function addDays(iso, n) { const d = parse(iso); d.setDate(d.getDate() + n); return toISODate(d); }
export const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
const START = { sunday: 0, monday: 1, saturday: 6 };
export function weekStart(iso, startDay = 'monday') {
  const d = parse(iso);
  const back = (d.getDay() - START[startDay] + 7) % 7;
  return addDays(iso, -back);
}
export const weekDays = start => Array.from({ length: 7 }, (_, i) => addDays(start, i));
export function prettyDate(iso) {
  const d = parse(iso);
  return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}`;
}
export function relativeDays(n) {
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n > 1) return `in ${n} days`;
  return `${-n} day${n === -1 ? '' : 's'} ago`;
}
