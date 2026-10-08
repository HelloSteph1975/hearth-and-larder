import { it, expect } from 'vitest';
import { groupShopping, estimatedTotal } from '../../client/src/screens/Shopping.jsx';

it('groups by category with Other last and totals unticked prices', () => {
  const rows = [
    { id: 1, name: 'Soap', category_name: null, est_price: 3, checked: 0 },
    { id: 2, name: 'Flour', category_name: 'Pantry Staples', est_price: 8, checked: 0 },
    { id: 3, name: 'Milk', category_name: 'Dairy & Eggs', est_price: 4, checked: 1 },
  ];
  expect(groupShopping(rows).map(g => g.category)).toEqual(['Dairy & Eggs', 'Pantry Staples', 'Other']);
  expect(estimatedTotal(rows)).toBe(11);
});

it('orders groups by the category order from Settings, not the alphabet', () => {
  const rows = [
    { id: 1, name: 'Soap', category_name: 'Household', category_sort: 5 },
    { id: 2, name: 'Thread', category_name: 'Other', category_sort: 6 },
    { id: 3, name: 'Leeks', category_name: 'Produce', category_sort: 0 },
    { id: 4, name: 'Milk', category_name: 'Dairy & Eggs', category_sort: 1 },
    { id: 5, name: 'Twine', category_name: null, category_sort: null },
  ];
  const groups = groupShopping(rows);
  expect(groups.map(g => g.category)).toEqual(['Produce', 'Dairy & Eggs', 'Household', 'Other']);
  expect(groups[3].items.map(i => i.name)).toEqual(['Thread', 'Twine']);
});

import { shortfalls, addShortfallsToList } from '../../client/src/lib/shopping.js';

it('turns missing and partial ingredients into shortfall amounts', () => {
  const status = { ingredients: [
    { name: 'Flour', status: 'partial', scaled_quantity: 3, have: 1, unit: 'cup' },
    { name: 'Cream', status: 'missing', scaled_quantity: 1.5, have: 0, unit: 'cup' },
    { name: 'Bay leaf', status: 'missing', scaled_quantity: null, have: 0, unit: null },
    { name: 'Salt', status: 'staple', is_staple: 1 },
    { name: 'Chives', status: 'missing', scaled_quantity: 1, unit: 'tbsp', optional: 1 },
    { name: 'Butter', status: 'have', scaled_quantity: 1, have: 2, unit: 'cup' },
  ] };
  expect(shortfalls(status)).toEqual([
    { name: 'Flour', quantity: 2, unit: 'cup' },
    { name: 'Cream', quantity: 1.5, unit: 'cup' },
    { name: 'Bay leaf', quantity: null, unit: null },
  ]);
});

it('skips shortfalls already waiting on the list', async () => {
  const client = {
    get: vi.fn(async () => [{ name: 'cream ', checked: 0 }, { name: 'Flour', checked: 1 }]),
    post: vi.fn(async () => ({})),
  };
  const res = await addShortfallsToList([{ name: 'Flour', quantity: 2, unit: 'cup' }, { name: 'Cream', quantity: 1, unit: 'cup' }], client);
  expect(res).toEqual({ added: ['Flour'], skipped: ['Cream'] });
  expect(client.post).toHaveBeenCalledWith('/api/shopping', { name: 'Flour', quantity: 2, unit: 'cup' });
  expect(client.post).toHaveBeenCalledTimes(1);
});

import { vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';
import { StoresProvider } from '../../client/src/components/StoresProvider.jsx';
import { Shopping } from '../../client/src/screens/Shopping.jsx';
import { todayISO } from '../../client/src/lib/dates.js';

function setup() {
  HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };
  const calls = [];
  const rows = [
    { id: 1, name: 'Butter', quantity: 1, unit: 'cup', category_name: 'Dairy & Eggs', est_price: 4, checked: 1, origin: 'plan' },
    { id: 2, name: 'Flour', quantity: 2, unit: 'cup', category_name: null, est_price: 3, checked: 1, origin: 'manual' },
    { id: 3, name: 'Soap', quantity: null, unit: null, category_name: null, est_price: null, checked: 0, origin: 'manual' },
  ];
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method ?? 'GET';
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    calls.push({ method, url, body });
    const json = d => new Response(JSON.stringify(d), { status: 200 });
    if (url === '/api/shopping' && method === 'GET') return json(rows);
    if (url === '/api/stores') return json([{ id: 1, name: 'Larder' }, { id: 3, name: 'Pantry' }]);
    if (url === '/api/settings') return json({ week_start: 'monday' });
    if (url.startsWith('/api/categories')) return json([]);
    if (url === '/api/shopping/put-away') return json({ batches: [{ id: 1 }, { id: 2 }], stamp: 'S1' });
    if (url === '/api/shopping/clear-checked') return json({ ids: [1, 2], stamp: 'S2' });
    return json({});
  });
  render(
    <ToastProvider><ConfirmProvider><StoresProvider>
      <MemoryRouter><Shopping /></MemoryRouter>
    </StoresProvider></ConfirmProvider></ToastProvider>,
  );
  return calls;
}
const posts = (calls, url) => calls.filter(c => c.method === 'POST' && c.url === url);

it('puts ticked things away and Undo restores with the returned stamp', async () => {
  const calls = setup();
  await userEvent.click(await screen.findByRole('button', { name: /Put away ticked/ }));
  const dlg = await screen.findByRole('dialog');
  await userEvent.selectOptions(within(dlg).getByRole('combobox'), 'Pantry');
  await userEvent.click(within(dlg).getByRole('button', { name: /Put away 2/ }));
  await waitFor(() => expect(posts(calls, '/api/shopping/put-away')).toHaveLength(1));
  expect(posts(calls, '/api/shopping/put-away')[0].body).toEqual({ ids: [1, 2], store_id: 3, today: todayISO() });
  await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(posts(calls, '/api/shopping/restore-many')).toHaveLength(1));
  expect(posts(calls, '/api/shopping/restore-many')[0].body).toEqual({ stamp: 'S1' });
});

it('clears ticked things and Undo restores with the returned stamp', async () => {
  const calls = setup();
  await userEvent.click(await screen.findByRole('button', { name: /Clear ticked/ }));
  await waitFor(() => expect(posts(calls, '/api/shopping/clear-checked')).toHaveLength(1));
  await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(posts(calls, '/api/shopping/restore-many')).toHaveLength(1));
  expect(posts(calls, '/api/shopping/restore-many')[0].body).toEqual({ stamp: 'S2' });
});

it('ignores a double click on a tick box while the first is in flight', async () => {
  const calls = setup();
  const box = await screen.findByRole('checkbox', { name: 'Got Soap' });
  box.click(); box.click();
  await waitFor(() => expect(calls.filter(c => c.method === 'PATCH')).toHaveLength(1));
});
