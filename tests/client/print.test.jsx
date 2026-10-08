import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';
import { StoresProvider } from '../../client/src/components/StoresProvider.jsx';
import { PrintButton } from '../../client/src/components/Print.jsx';
import { RecipeDetail } from '../../client/src/screens/RecipeDetail.jsx';
import { StoreScreen } from '../../client/src/screens/StoreScreen.jsx';
import { RecipeBox } from '../../client/src/screens/RecipeBox.jsx';
import { Planner } from '../../client/src/screens/Planner.jsx';
import { todayISO, weekStart, addDays } from '../../client/src/lib/dates.js';

const json = (d, status = 200) => new Response(JSON.stringify(d), { status });
const sheet = () => screen.getByTestId('print-sheet');
function spyPrint(onPrint) {
  return vi.spyOn(window, 'print').mockImplementation(() => onPrint?.());
}
afterEach(() => vi.restoreAllMocks());

function renderAt(path, route, element) {
  HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
  return render(
    <ToastProvider><ConfirmProvider><StoresProvider>
      <MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={element} /></Routes></MemoryRouter>
    </StoresProvider></ConfirmProvider></ToastProvider>,
  );
}

it('PrintButton is a labelled button that calls window.print', async () => {
  const print = spyPrint();
  render(<PrintButton />);
  await userEvent.click(screen.getByRole('button', { name: 'Print' }));
  expect(print).toHaveBeenCalledTimes(1);
});

const recipe = servings => ({
  id: 1, title: 'Biscuits', description: 'Flaky and tall.', servings: 4, prep_minutes: 10, cook_minutes: 15,
  source_credit: 'Grandma June', is_family_recipe: 1, notes: 'Cold butter is the secret.', calories: 210, protein_g: 4,
  times_made: 0, tags: ['bread'], photos: [], steps: [{ id: 1, text: 'Cut in the butter.' }, { id: 2, text: 'Bake hot.' }],
  ingredients: [],
  status: { servings, can_make: true, missing_names: [], counts: {}, ingredients: [
    { id: 1, section: 'Dough', name: 'Flour', quantity: 2, unit: 'cup', scaled_quantity: 2 * servings / 4, status: 'have' },
    { id: 2, section: 'Dough', name: 'Butter', quantity: 0.5, unit: 'cup', scaled_quantity: 0.5 * servings / 4, prep_note: 'cold', status: 'have' },
  ] },
});

it('prints the recipe card at the servings chosen in the scaler', async () => {
  global.fetch = vi.fn(async url => {
    if (url.startsWith('/api/cook-log')) return json([]);
    if (url === '/api/stores') return json([]);
    return json(recipe(Number(new URL(url, 'http://x').searchParams.get('servings') ?? 4)));
  });
  const print = spyPrint();
  renderAt('/recipes/1', '/recipes/:id', <RecipeDetail />);
  await userEvent.click(await screen.findByRole('button', { name: 'More servings' }));
  await userEvent.click(screen.getByRole('button', { name: 'More servings' }));
  await userEvent.click(screen.getByRole('button', { name: 'Print' }));
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  const card = within(sheet()).getByRole('article', { name: 'Biscuits' });
  expect(within(card).getByText('3 cup')).toBeInTheDocument(); // 2 cups at 4 servings, scaled to 6
  expect(within(card).getByText('¾ cup')).toBeInTheDocument();
  expect(within(card).getByText(/servings/).textContent).toBe('6 servings');
  expect(within(card).getByText('Dough')).toBeInTheDocument();
  expect(within(card).getAllByRole('listitem').map(li => li.textContent)).toContain('Bake hot.');
  expect(within(card).getByText('from Grandma June')).toBeInTheDocument();
  expect(within(card).queryByText('have it')).not.toBeInTheDocument();
  expect(within(card).queryByRole('button')).not.toBeInTheDocument();
});

it('prints the store inventory with only the items the filters show', async () => {
  const pumpkin = { id: 1, name: 'Pumpkin', quantity: 1, unit: 'each', category_name: 'Squash', location_name: 'Bin 2', next_use_by: '2026-11-02', sources: ['home-grown'], is_low: true };
  const potato = { id: 2, name: 'Potatoes', quantity: 20, unit: 'lb', category_name: 'Roots', location_name: 'Bin 1', sources: [], is_low: false };
  global.fetch = vi.fn(async url => {
    if (url === '/api/stores') return json([{ id: 3, name: 'Root Cellar', icon: 'potato' }]);
    if (url.startsWith('/api/items?')) return json(url.includes('low=1') ? [pumpkin] : [pumpkin, potato]);
    return json([]);
  });
  const print = spyPrint();
  renderAt('/store/3', '/store/:storeId', <StoreScreen />);
  expect(await screen.findByText('Potatoes')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('checkbox', { name: 'Running low only' }));
  await waitFor(() => expect(screen.queryByText('Potatoes')).not.toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: 'Print' }));
  await waitFor(() => expect(print).toHaveBeenCalled());
  const table = within(sheet()).getByRole('table');
  const rows = within(table).getAllByRole('row').slice(1);
  expect(rows).toHaveLength(1);
  expect(within(rows[0]).getByRole('rowheader')).toHaveTextContent('Pumpkin');
  expect(rows[0]).toHaveTextContent('Bin 2');
  expect(rows[0]).toHaveTextContent('running low');
  expect(within(sheet()).getByText(/1 item · running low only/)).toBeInTheDocument();
  expect(within(sheet()).getByRole('heading', { name: 'Root Cellar' })).toBeInTheDocument();
});

it('fetches the chosen recipes and renders one card each before printing', async () => {
  const list = [
    { id: 1, title: 'Apple butter', tags: [], servings: 8 },
    { id: 2, title: 'Bean soup', tags: [], servings: 6 },
    { id: 3, title: 'Corn bread', tags: [], servings: 9 },
  ];
  global.fetch = vi.fn(async url => {
    if (url.startsWith('/api/recipes?')) return json(list);
    if (url === '/api/recipes/tags') return json([]);
    const m = url.match(/^\/api\/recipes\/(\d+)$/);
    if (m) {
      const r = list.find(x => x.id === Number(m[1]));
      return json({ ...r, photos: [], steps: [{ id: 1, text: `Make ${r.title}.` }], ingredients: [], status: { servings: r.servings, ingredients: [] } });
    }
    return json([]);
  });
  let cardsWhenPrinted = null;
  const print = spyPrint(() => { cardsWhenPrinted = within(sheet()).getAllByRole('article').map(a => a.getAttribute('aria-label')); });
  renderAt('/recipes', '/recipes', <RecipeBox />);
  await userEvent.click(await screen.findByRole('button', { name: 'Print cards' }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'Select Apple butter for printing' }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'Select Corn bread for printing' }));
  await userEvent.click(screen.getByRole('button', { name: 'Print 2 cards' }));
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  const urls = global.fetch.mock.calls.map(([u]) => u);
  expect(urls).toContain('/api/recipes/1');
  expect(urls).toContain('/api/recipes/3');
  expect(urls).not.toContain('/api/recipes/2');
  expect(cardsWhenPrinted).toEqual(['Apple butter', 'Corn bread']);
  expect(within(sheet()).getByText('Make Corn bread.')).toBeInTheDocument();
});

it('puts each planned meal under its day and meal on the printed week', async () => {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart(todayISO(), 'monday'), i));
  const entries = [
    { id: 1, date: days[2], slot: 'supper', recipe_id: 5, recipe_title: 'Root cellar hash', servings: 4 },
    { id: 2, date: days[0], slot: 'breakfast', recipe_id: null, note: 'Leftover porridge' },
  ];
  global.fetch = vi.fn(async url => {
    if (url === '/api/settings') return json({ week_start: 'monday' });
    if (url.startsWith('/api/plan?')) return json(entries);
    return json([]);
  });
  const print = spyPrint();
  renderAt('/planner', '/planner', <Planner />);
  await screen.findByRole('link', { name: 'Root cellar hash' });
  await userEvent.click(screen.getByRole('button', { name: 'Print' }));
  await waitFor(() => expect(print).toHaveBeenCalled());
  const table = within(sheet()).getByRole('table');
  const rowFor = label => within(table).getAllByRole('row').find(r => within(r).queryByRole('rowheader')?.textContent === label);
  const supper = within(rowFor('Supper')).getAllByRole('cell');
  expect(supper[2]).toHaveTextContent('Root cellar hash');
  expect(supper[2]).toHaveTextContent('serves 4');
  expect(supper.filter(c => c.textContent)).toHaveLength(1);
  expect(within(rowFor('Breakfast')).getAllByRole('cell')[0]).toHaveTextContent('Leftover porridge');
  expect(within(table).queryByRole('button')).not.toBeInTheDocument();
});

/* ---------- Printing stays in step with the data on screen ---------- */

import { act } from '@testing-library/react';

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

it('Ctrl+P during a week change prints a loading note, never last week under new dates', async () => {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart(todayISO(), 'monday'), i));
  const nextWeek = deferred();
  global.fetch = vi.fn(async url => {
    if (url === '/api/settings') return json({ week_start: 'monday' });
    if (url === `/api/plan?from=${days[0]}&to=${days[6]}`) return json([{ id: 1, date: days[2], slot: 'supper', recipe_id: 5, recipe_title: 'Root cellar hash' }]);
    if (url.startsWith('/api/plan?')) return nextWeek.promise;
    return json([]);
  });
  renderAt('/planner', '/planner', <Planner />);
  await screen.findByRole('link', { name: 'Root cellar hash' });
  await userEvent.click(screen.getByRole('button', { name: 'Next week' }));
  act(() => { window.dispatchEvent(new Event('beforeprint')); });
  expect(sheet()).toHaveTextContent('Still loading');
  expect(within(sheet()).queryByText('Root cellar hash')).not.toBeInTheDocument();
  await act(async () => nextWeek.resolve(json([{ id: 2, date: addDays(days[0], 7), slot: 'lunch', recipe_id: 6, recipe_title: 'Bean soup' }])));
  await waitFor(() => expect(within(sheet()).getByText('Bean soup')).toBeInTheDocument());
  expect(within(sheet()).queryByText('Root cellar hash')).not.toBeInTheDocument();
  act(() => { window.dispatchEvent(new Event('afterprint')); });
  expect(screen.queryByTestId('print-sheet')).not.toBeInTheDocument();
});

it('drops a queued print when the view changes before its data arrives', async () => {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart(todayISO(), 'monday'), i));
  const later = deferred();
  global.fetch = vi.fn(async url => {
    if (url === '/api/settings') return json({ week_start: 'monday' });
    if (url === `/api/plan?from=${days[0]}&to=${days[6]}`) return json([]);
    if (url.startsWith('/api/plan?')) return later.promise.then(d => json(d));
    return json([]);
  });
  const print = spyPrint();
  renderAt('/planner', '/planner', <Planner />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Print' })).toBeEnabled());
  await userEvent.click(screen.getByRole('button', { name: 'Next week' }));
  await userEvent.click(screen.getByRole('button', { name: 'Print' }));
  await userEvent.click(screen.getByRole('button', { name: 'Next week' }));
  await act(async () => later.resolve([]));
  await new Promise(r => setTimeout(r, 100));
  expect(print).not.toHaveBeenCalled();
});

it('cancels a queued print when loading fails, so a later load does not open the dialog', async () => {
  const pumpkin = { id: 1, name: 'Pumpkin', quantity: 1, unit: 'each', sources: [], is_low: true };
  const lowOnly = deferred();
  global.fetch = vi.fn(async url => {
    if (url === '/api/stores') return json([{ id: 3, name: 'Root Cellar', icon: 'potato' }]);
    if (url.startsWith('/api/items?')) return url.includes('low=1') ? lowOnly.promise : json([pumpkin]);
    return json([]);
  });
  const print = spyPrint();
  renderAt('/store/3', '/store/:storeId', <StoreScreen />);
  await screen.findByText('Pumpkin');
  await userEvent.click(screen.getByRole('checkbox', { name: 'Running low only' }));
  await userEvent.click(screen.getByRole('button', { name: 'Print' }));
  await act(async () => lowOnly.resolve(json({ error: 'The cellar door is stuck.' }, 500)));
  expect(await screen.findByText('The cellar door is stuck.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('checkbox', { name: 'Running low only' }));
  expect(await screen.findByText('Pumpkin')).toBeInTheDocument();
  await new Promise(r => setTimeout(r, 100));
  expect(print).not.toHaveBeenCalled();
  expect(screen.queryByTestId('print-sheet')).not.toBeInTheDocument();
});

it('holds card printing while a filter loads and only prints cards the new list still shows', async () => {
  const all = [{ id: 1, title: 'Apple butter', tags: [] }, { id: 2, title: 'Bean soup', tags: [] }, { id: 3, title: 'Corn bread', tags: [] }];
  const favorites = deferred();
  global.fetch = vi.fn(async url => {
    if (url === '/api/recipes?') return json(all);
    if (url.startsWith('/api/recipes?favorite=1')) return favorites.promise;
    if (url === '/api/recipes/tags') return json([]);
    const m = url.match(/^\/api\/recipes\/(\d+)$/);
    if (m) return json({ ...all.find(x => x.id === Number(m[1])), photos: [], steps: [], ingredients: [], status: { servings: 4, ingredients: [] } });
    return json([]);
  });
  const print = spyPrint();
  renderAt('/recipes', '/recipes', <RecipeBox />);
  await userEvent.click(await screen.findByRole('button', { name: 'Print cards' }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'Select Apple butter for printing' }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'Select Corn bread for printing' }));
  await userEvent.click(screen.getByRole('button', { name: 'Favorites' }));
  expect(screen.getByRole('button', { name: 'Print 2 cards' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Print index' })).toBeDisabled();
  await act(async () => favorites.resolve(json([all[0], all[1]])));
  await userEvent.click(await screen.findByRole('button', { name: 'Print 1 card' }));
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  const urls = global.fetch.mock.calls.map(([u]) => u);
  expect(urls).toContain('/api/recipes/1');
  expect(urls).not.toContain('/api/recipes/3');
  expect(within(sheet()).getAllByRole('article').map(a => a.getAttribute('aria-label'))).toEqual(['Apple butter']);
});
