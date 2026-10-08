import { it, expect } from 'vitest';
import { formatQty, formatMinutes, formatMoney } from '../../client/src/lib/format.js';

it('formats quantities with kitchen fractions', () => {
  expect(formatQty(1.5)).toBe('1½');
  expect(formatQty(0.25)).toBe('¼');
  expect(formatQty(0.33)).toBe('⅓');
  expect(formatQty(2)).toBe('2');
  expect(formatQty(1.37)).toBe('1.37');
  expect(formatQty(null)).toBe('');
});
it('formats minutes and money', () => {
  expect(formatMinutes(65)).toBe('1 hr 5 min');
  expect(formatMinutes(40)).toBe('40 min');
  expect(formatMoney(4.5)).toBe('$4.50');
});
