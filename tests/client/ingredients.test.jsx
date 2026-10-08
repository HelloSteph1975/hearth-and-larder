import { it, expect } from 'vitest';
import { parseIngredientLine } from '../../client/src/lib/ingredients.js';

it('parses common ingredient lines', () => {
  expect(parseIngredientLine('1 1/2 cups flour, sifted')).toEqual({ quantity: 1.5, unit: 'cup', name: 'flour', prep_note: 'sifted' });
  expect(parseIngredientLine('2 eggs')).toEqual({ quantity: 2, unit: '', name: 'eggs', prep_note: '' });
  expect(parseIngredientLine('½ tsp salt')).toEqual({ quantity: 0.5, unit: 'tsp', name: 'salt', prep_note: '' });
  expect(parseIngredientLine('Butter for the pan')).toEqual({ quantity: null, unit: '', name: 'Butter for the pan', prep_note: '' });
});

it('handles plural units, mixed numbers and odd input', () => {
  expect(parseIngredientLine('2 gallons milk')).toMatchObject({ quantity: 2, unit: 'gallon', name: 'milk' });
  expect(parseIngredientLine('3 bags spinach')).toMatchObject({ unit: 'bag' });
  expect(parseIngredientLine('2 bottles wine')).toMatchObject({ unit: 'bottle' });
  expect(parseIngredientLine('2 bunches kale')).toMatchObject({ unit: 'bunch' });
  expect(parseIngredientLine('2 heads garlic')).toMatchObject({ unit: 'head' });
  expect(parseIngredientLine('2 tbsps sugar')).toMatchObject({ unit: 'tbsp' });
  expect(parseIngredientLine('2 tsps salt')).toMatchObject({ unit: 'tsp' });
  expect(parseIngredientLine('2 cans beans')).toMatchObject({ unit: 'can' });
  expect(parseIngredientLine('2 12 oz cans tomatoes')).toEqual({ quantity: 2, unit: '', name: '12 oz cans tomatoes', prep_note: '' });
  expect(parseIngredientLine('1/0 cup flour')).toEqual({ quantity: null, unit: '', name: '1/0 cup flour', prep_note: '' });
  expect(parseIngredientLine('1 ½ cups oats')).toMatchObject({ quantity: 1.5, unit: 'cup' });
});
