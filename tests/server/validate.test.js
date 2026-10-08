import { it, expect } from 'vitest';
import { validate } from '../../server/validate.js';

const schema = { name: 'string!', qty: { type: 'number', min: 0 }, use_by: 'date', source: ['bought', 'preserved'], fav: 'bool' };

it('accepts good input and trims strings', () => {
  expect(validate(schema, { name: '  Jam ', qty: '2.5', use_by: '2026-11-02', source: 'bought', fav: true }))
    .toEqual({ data: { name: 'Jam', qty: 2.5, use_by: '2026-11-02', source: 'bought', fav: 1 } });
});
it('reports each bad field', () => {
  const r = validate(schema, { name: '', qty: -1, use_by: '11/02/2026', source: 'stolen' });
  expect(Object.keys(r.errors).sort()).toEqual(['name', 'qty', 'source', 'use_by']);
});
it('rejects impossible calendar dates', () => {
  expect(validate(schema, { name: 'x', use_by: '2026-02-30' }).errors.use_by).toBeTruthy();
  expect(validate(schema, { name: 'x', use_by: '2026-02-28' }).data.use_by).toBe('2026-02-28');
});
it('nullable:false fields cannot be cleared but may be omitted', () => {
  const s = { icon: { type: 'string', nullable: false } };
  expect(validate(s, { icon: '' }, { partial: true }).errors.icon).toBe('Required');
  expect(validate(s, { icon: null }).errors.icon).toBe('Required');
  expect(validate(s, {}, { partial: true })).toEqual({ data: {} });
  expect(validate(s, { icon: '   ' }, { partial: true }).errors.icon).toBe('Required');
});
it('partial mode skips missing required fields; empty string clears optional ones', () => {
  expect(validate(schema, { qty: '' }, { partial: true })).toEqual({ data: { qty: null } });
});
