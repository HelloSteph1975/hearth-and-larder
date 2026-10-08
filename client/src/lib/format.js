const FRACTIONS = [[0.25, '¼'], [0.33, '⅓'], [0.5, '½'], [0.67, '⅔'], [0.75, '¾']];

export function formatQty(n) {
  if (n == null || Number.isNaN(n)) return '';
  const whole = Math.floor(n);
  const frac = Math.round((n - whole) * 100) / 100;
  if (frac === 0) return String(whole);
  const hit = FRACTIONS.find(([v]) => Math.abs(v - frac) < 0.011);
  if (hit) return `${whole || ''}${hit[1]}`;
  return String(Math.round(n * 100) / 100);
}

export function formatMinutes(n) {
  if (!n) return '';
  const h = Math.floor(n / 60);
  const m = n % 60;
  return [h && `${h} hr`, m && `${m} min`].filter(Boolean).join(' ');
}

export const formatMoney = n => (n == null ? '' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n));
