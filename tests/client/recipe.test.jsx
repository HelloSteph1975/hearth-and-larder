import { it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';
import { RecipeDetail } from '../../client/src/screens/RecipeDetail.jsx';

const recipe = servings => ({
  id: 1, title: 'Biscuits', servings: 4, times_made: 2, last_made: '2026-10-01', tags: [], photos: [], steps: [{ id: 1, text: 'Bake.' }],
  calories: 200, ingredients: [],
  status: { servings, can_make: true, missing_names: [], counts: {}, ingredients: [
    { id: 1, name: 'Flour', quantity: 2, unit: 'cup', scaled_quantity: 2 * servings / 4, status: 'have' },
  ] },
});

it('scales ingredients when servings change', async () => {
  HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
  global.fetch = vi.fn(async url => {
    const s = Number(new URL(url, 'http://x').searchParams.get('servings') ?? 4);
    return new Response(JSON.stringify(recipe(s)), { status: 200 });
  });
  render(
    <ToastProvider><ConfirmProvider>
      <MemoryRouter initialEntries={['/recipes/1']}><Routes><Route path="/recipes/:id" element={<RecipeDetail />} /></Routes></MemoryRouter>
    </ConfirmProvider></ToastProvider>,
  );
  expect(await screen.findByText('2')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'More servings' }));
  await userEvent.click(screen.getByRole('button', { name: 'More servings' }));
  expect(await screen.findByText('3')).toBeInTheDocument();
  expect(screen.getByText(/Made 2 times/)).toBeInTheDocument();
});

import { waitFor, within } from '@testing-library/react';

function cookSetup() {
  HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };
  const calls = [];
  let history = [{ id: 4, recipe_id: 1, cooked_on: '2026-10-01', servings: 4, notes: 'Extra butter' }];
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method ?? 'GET';
    calls.push({ method, url });
    const json = (d, status = 200) => new Response(JSON.stringify(d), { status });
    if (url.startsWith('/api/cook-log?')) return json(history);
    if (url === '/api/recipes/1/cook/preview') return json({ deductions: [{ batch_id: 2, item_name: 'Flour', ingredient_name: 'Flour', take: 2, unit: 'cup', available: 5 }], unmatched: [] });
    if (url === '/api/recipes/1/cook') return json({ id: 9, recipe_id: 1, cooked_on: '2026-10-07' }, 201);
    if (method === 'DELETE') { history = []; return json({ ok: true, restore: `${url}/restore` }); }
    if (url.endsWith('/restore')) return json({});
    return json(recipe(4));
  });
  render(
    <ToastProvider><ConfirmProvider>
      <MemoryRouter initialEntries={['/recipes/1']}><Routes><Route path="/recipes/:id" element={<RecipeDetail />} /></Routes></MemoryRouter>
    </ConfirmProvider></ToastProvider>,
  );
  return calls;
}

it('offers Undo after cooking, which deletes the cook log', async () => {
  const calls = cookSetup();
  await userEvent.click(await screen.findByRole('button', { name: 'I cooked this' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Take from the shelves' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(calls.some(c => c.method === 'DELETE' && c.url === '/api/cook-log/9')).toBe(true));
  expect(await screen.findByText('Put everything back on the shelves')).toBeInTheDocument();
});

it('lists cooking history and deletes an entry with Undo', async () => {
  const calls = cookSetup();
  const section = await screen.findByRole('region', { name: 'Cooking history' });
  expect(await within(section).findByText('Extra butter')).toBeInTheDocument();
  await userEvent.click(within(section).getByRole('button', { name: /Remove the cooking on/ }));
  await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(calls.some(c => c.method === 'DELETE' && c.url === '/api/cook-log/4')).toBe(true));
  await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(calls.some(c => c.method === 'POST' && c.url === '/api/cook-log/4/restore')).toBe(true));
});

it('plans the recipe at the servings picked on the page', async () => {
  HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
  global.fetch = vi.fn(async url => {
    const s = Number(new URL(url, 'http://x').searchParams.get('servings') ?? 4);
    return new Response(JSON.stringify(recipe(s)), { status: 200 });
  });
  render(
    <ToastProvider><ConfirmProvider>
      <MemoryRouter initialEntries={['/recipes/1']}><Routes><Route path="/recipes/:id" element={<RecipeDetail />} /></Routes></MemoryRouter>
    </ConfirmProvider></ToastProvider>,
  );
  await userEvent.click(await screen.findByRole('button', { name: 'More servings' }));
  await userEvent.click(screen.getByRole('button', { name: 'More servings' }));
  await userEvent.click(screen.getByRole('button', { name: /Plan it/ }));
  const dlg = await screen.findByRole('dialog');
  expect(within(dlg).getByLabelText('Servings')).toHaveValue(6);
});
