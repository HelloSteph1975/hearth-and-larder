import { it, expect, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, Link } from 'react-router-dom';
import { SettingsProvider } from '../../client/src/components/SettingsProvider.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';
import { RecipeEditor } from '../../client/src/screens/RecipeEditor.jsx';

function setup(path, { recipe, saveResponse, settings, withSettings = false } = {}) {
  HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
  HTMLFormElement.prototype.requestSubmit ??= function () { this.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); };
  const saves = [];
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method ?? 'GET';
    if (method === 'GET') {
      if (url === '/api/recipes/tags' || url === '/api/items') return new Response('[]', { status: 200 });
      if (url === '/api/settings') return new Response(JSON.stringify(settings ?? {}), { status: 200 });
      return new Response(JSON.stringify(recipe), { status: 200 });
    }
    saves.push({ method, url, body: JSON.parse(opts.body) });
    return saveResponse ? saveResponse() : new Response(JSON.stringify({ id: 1, title: 'x' }), { status: 200 });
  });
  const withNav = el => <><Link to="/elsewhere">Go elsewhere</Link>{el}</>;
  const router = createMemoryRouter([
    { path: '/recipes/new', element: withNav(<RecipeEditor />) },
    { path: '/recipes/:id/edit', element: withNav(<RecipeEditor />) },
    { path: '/recipes/:id', element: <p>detail page</p> },
    { path: '/elsewhere', element: <p>elsewhere page</p> },
  ], { initialEntries: [path] });
  const app = <RouterProvider router={router} />;
  render(
    <ToastProvider><ConfirmProvider>
      {withSettings ? <SettingsProvider>{app}</SettingsProvider> : app}
    </ConfirmProvider></ToastProvider>,
  );
  return saves;
}

it('puts a server ingredient error on the right row when blank rows are skipped', async () => {
  const saves = setup('/recipes/new', {
    saveResponse: () => new Response(JSON.stringify({ error: 'Please fix the highlighted fields.', details: { 'ingredients.0.name': 'Required' } }), { status: 400 }),
  });
  await userEvent.type(await screen.findByLabelText('Title'), 'Test');
  await userEvent.click(screen.getByRole('button', { name: 'Add ingredient' }));
  await userEvent.type(screen.getByLabelText('Quantity for ingredient 2'), '2');
  await userEvent.click(screen.getByRole('button', { name: 'Add to the recipe box' }));
  const second = await screen.findByRole('group', { name: 'Ingredient 2' });
  expect(await within(second).findByText('Required')).toBeInTheDocument();
  expect(within(screen.getByRole('group', { name: 'Ingredient 1' })).queryByText('Required')).toBeNull();
  expect(saves[0].body.ingredients).toHaveLength(1);
});

it('keeps an unsectioned ingredient unsectioned after a sectioned one', async () => {
  const recipe = {
    id: 1, title: 'Pie', servings: 4, tags: [], steps: [{ id: 1, text: 'Bake.' }], photos: [],
    ingredients: [
      { id: 1, section: 'Dough', name: 'Flour', quantity: 2, unit: 'cup' },
      { id: 2, section: null, name: 'Salt', quantity: 1, unit: 'tsp' },
    ],
  };
  const saves = setup('/recipes/1/edit', { recipe });
  await userEvent.click(await screen.findByRole('button', { name: 'Save recipe' }));
  await screen.findByText('detail page');
  expect(saves[0].method).toBe('PUT');
  expect(saves[0].body.ingredients.map(i => [i.name, i.section])).toEqual([['Flour', 'Dough'], ['Salt', null]]);
});

it('does not submit when Enter is pressed in an ingredient field', async () => {
  const saves = setup('/recipes/new');
  await userEvent.type(await screen.findByLabelText('Title'), 'Test');
  await userEvent.type(screen.getByLabelText('Name of ingredient 1'), 'sugar{Enter}');
  expect(saves).toHaveLength(0);
});

it('starts a new recipe at the household default servings', async () => {
  setup('/recipes/new', { withSettings: true, settings: { default_servings: '6' } });
  expect(await screen.findByLabelText('Servings')).toHaveValue(6);
});

it('labels reorder buttons with the row they move', async () => {
  setup('/recipes/new');
  await userEvent.click(await screen.findByRole('button', { name: 'Add ingredient' }));
  expect(screen.getByRole('button', { name: 'Move ingredient 2 up' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Move ingredient 1 down' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Remove ingredient 2' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Move step 1 up' })).toBeDisabled();
});

it('asks before leaving with unsaved changes, and stays when told to keep them', async () => {
  setup('/recipes/new');
  await userEvent.type(await screen.findByLabelText('Title'), 'Half-written pie');
  await userEvent.click(screen.getByRole('link', { name: 'Go elsewhere' }));
  const dlg = await screen.findByRole('dialog');
  expect(within(dlg).getByText('Throw away your changes?')).toBeInTheDocument();
  await userEvent.click(within(dlg).getByRole('button', { name: 'Keep it' }));
  expect(screen.getByLabelText('Title')).toHaveValue('Half-written pie');
  await userEvent.click(screen.getByRole('link', { name: 'Go elsewhere' }));
  await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Discard changes' }));
  expect(await screen.findByText('elsewhere page')).toBeInTheDocument();
});

it('leaves without asking when nothing changed', async () => {
  setup('/recipes/new');
  await userEvent.click(await screen.findByRole('link', { name: 'Go elsewhere' }));
  expect(await screen.findByText('elsewhere page')).toBeInTheDocument();
});

it('does not ask after a successful save', async () => {
  setup('/recipes/new');
  await userEvent.type(await screen.findByLabelText('Title'), 'Pie');
  await userEvent.click(screen.getByRole('button', { name: 'Add to the recipe box' }));
  expect(await screen.findByText('detail page')).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
