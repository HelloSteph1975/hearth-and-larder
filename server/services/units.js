const MASS = { g: 1, gram: 1, kg: 1000, kilogram: 1000, oz: 28.3495, ounce: 28.3495, lb: 453.592, pound: 453.592 };
const VOLUME = {
  ml: 1, milliliter: 1, l: 1000, liter: 1000, litre: 1000, tsp: 4.92892, teaspoon: 4.92892, tbsp: 14.7868, tablespoon: 14.7868,
  'fl oz': 29.5735, cup: 236.588, pint: 473.176, pt: 473.176, quart: 946.353, qt: 946.353, gallon: 3785.41, gal: 3785.41,
};
const COUNT_ALIASES = { '': 'each', count: 'each', ea: 'each', piece: 'each', pc: 'each', whole: 'each' };

const has = (map, k) => Object.hasOwn(map, k);

export const round = (n, places = 2) => Math.round(n * 10 ** places) / 10 ** places;

const KEEP_PLURAL = new Set(['molasses', 'couscous', 'hummus', 'asparagus', 'citrus', 'grits', 'swiss']);

function singular(word) {
  if (word.length <= 3 || KEEP_PLURAL.has(word)) return word;
  if (/(ss|us|is)$/.test(word)) return word;
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (/(ches|shes|xes|zes|oes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

export function normalizeName(s) {
  const words = String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length) words[words.length - 1] = singular(words[words.length - 1]);
  return words.join(' ');
}

export function normUnit(u) {
  let x = String(u ?? '').toLowerCase().trim().replace(/\.$/, '');
  if (x === 'lbs') x = 'lb';
  if (x === 'tbs' || x === 'tbl') x = 'tbsp';
  if (!has(MASS, x) && !has(VOLUME, x)) x = singular(x);
  if (has(COUNT_ALIASES, x)) x = COUNT_ALIASES[x];
  return x;
}

export function unitFamily(u) {
  const x = normUnit(u);
  if (has(MASS, x)) return 'mass';
  if (has(VOLUME, x)) return 'volume';
  return `count:${x}`;
}

export function toBase(qty, unit) {
  const x = normUnit(unit);
  if (has(MASS, x)) return { family: 'mass', amount: qty * MASS[x] };
  if (has(VOLUME, x)) return { family: 'volume', amount: qty * VOLUME[x] };
  return { family: `count:${x}`, amount: qty };
}

export function fromBase(amount, unit) {
  const x = normUnit(unit);
  if (has(MASS, x)) return amount / MASS[x];
  if (has(VOLUME, x)) return amount / VOLUME[x];
  return amount;
}

export function convert(qty, from, to) {
  const a = toBase(qty, from);
  if (a.family !== unitFamily(to)) return null;
  return fromBase(a.amount, to);
}
