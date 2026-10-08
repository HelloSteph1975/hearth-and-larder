import { it, expect } from 'vitest';
import { normalizeName, unitFamily, convert, toBase, normUnit } from '../../server/services/units.js';

it('normalizes ingredient names', () => {
  expect(normalizeName('  Russet Potatoes ')).toBe('russet potato');
  expect(normalizeName('Blackberries')).toBe('blackberry');
  expect(normalizeName('Tomatoes')).toBe('tomato');
  expect(normalizeName('Peaches')).toBe('peach');
  expect(normalizeName('Molasses')).toBe('molasses');
  expect(normalizeName('Jalapeños')).toBe('jalapeno');
  expect(normalizeName('Flour, all-purpose')).toBe('flour all purpose');
});
it('groups units into families', () => {
  expect(unitFamily('lb')).toBe('mass');
  expect(unitFamily('Cups')).toBe('volume');
  expect(unitFamily('jars')).toBe('count:jar');
  expect(unitFamily('')).toBe('count:each');
  expect(unitFamily(null)).toBe('count:each');
  expect(normUnit('Tbsp.')).toBe('tbsp');
});
it('converts within a family only', () => {
  expect(convert(1, 'lb', 'oz')).toBeCloseTo(16, 2);
  expect(convert(2, 'cup', 'tbsp')).toBeCloseTo(32, 1);
  expect(convert(3, 'jar', 'jars')).toBe(3);
  expect(convert(1, 'cup', 'g')).toBeNull();
  expect(toBase(2, 'kg')).toEqual({ family: 'mass', amount: 2000 });
});
