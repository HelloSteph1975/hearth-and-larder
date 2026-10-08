import { UNITS } from './options.js';

const UNICODE = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125 };
const UNIT_ALIASES = { cups: 'cup', tablespoon: 'tbsp', tablespoons: 'tbsp', tbs: 'tbsp', teaspoon: 'tsp', teaspoons: 'tsp',
  pounds: 'lb', pound: 'lb', lbs: 'lb', ounces: 'oz', ounce: 'oz', grams: 'g', jars: 'jar', cans: 'can', quarts: 'quart', pints: 'pint',
  gallons: 'gallon', bags: 'bag', bottles: 'bottle', bunches: 'bunch', heads: 'head', tbsps: 'tbsp', tsps: 'tsp' };

function readNumber(tok) {
  if (tok in UNICODE) return UNICODE[tok];
  const mixed = tok.match(/^(\d+)([½⅓⅔¼¾⅛])$/);
  if (mixed) return Number(mixed[1]) + UNICODE[mixed[2]];
  const frac = tok.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[2]) === 0 ? null : Number(frac[1]) / Number(frac[2]);
  return /^\d+(\.\d+)?$/.test(tok) ? Number(tok) : null;
}

export function parseIngredientLine(line) {
  const [main, ...rest] = line.trim().split(',');
  const prep_note = rest.join(',').trim();
  const toks = main.trim().split(/\s+/);
  let quantity = null;
  // One number, optionally followed by a fraction ("1 1/2"). A second whole number belongs to the name ("2 12 oz cans").
  if (toks.length && readNumber(toks[0]) !== null) {
    quantity = readNumber(toks.shift());
    const isFraction = t => t in UNICODE || /^\d+\/\d+$/.test(t);
    if (Number.isInteger(quantity) && toks.length && isFraction(toks[0]) && readNumber(toks[0]) !== null) quantity += readNumber(toks.shift());
  }
  let unit = '';
  if (quantity !== null && toks.length > 1) {
    const raw = toks[0].toLowerCase().replace(/\.$/, '');
    const u = UNIT_ALIASES[raw] ?? raw;
    if (UNITS.includes(u)) { unit = u; toks.shift(); }
  }
  if (quantity !== null) quantity = Math.round(quantity * 1000) / 1000;
  return { quantity, unit, name: toks.join(' '), prep_note };
}
