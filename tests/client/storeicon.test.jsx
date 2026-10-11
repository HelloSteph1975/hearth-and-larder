import { it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StoreIcon, STORE_ICONS } from '../../client/src/components/StoreIcon.jsx';
import { EmptyState } from '../../client/src/components/EmptyState.jsx';

it('offers the fridge and freezer icons in the picker list', () => {
  expect(STORE_ICONS).toEqual(expect.arrayContaining(['jar', 'potato', 'wheat', 'fridge', 'freezer']));
});

it('draws the fridge and freezer art, not the fallback box', () => {
  const box = render(<StoreIcon icon="nope" />).container.innerHTML;
  for (const key of ['fridge', 'freezer']) {
    const { container } = render(<StoreIcon icon={key} size={30} />);
    const svg = container.querySelector('svg.art');
    expect(svg, key).not.toBeNull();
    expect(svg.getAttribute('width')).toBe('30');
    expect(container.innerHTML).not.toBe(box);
  }
  const fridge = render(<StoreIcon icon="fridge" />).container.innerHTML;
  const freezer = render(<StoreIcon icon="freezer" />).container.innerHTML;
  expect(fridge).not.toBe(freezer);
});

it('uses the freezer art for an empty freezer', () => {
  const freezer = render(<StoreIcon icon="freezer" size={112} />).container.querySelector('svg').innerHTML;
  const { container } = render(<EmptyState art="freezer" title="Empty" />);
  expect(container.querySelector('.empty-art svg').innerHTML).toBe(freezer);
});
