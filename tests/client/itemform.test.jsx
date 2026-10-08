import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ItemForm } from '../../client/src/screens/ItemForm.jsx';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };
});

function mockFetch(handler) {
  global.fetch = vi.fn(async (url, opts = {}) => {
    const { status = 200, body } = handler(url, opts);
    return new Response(JSON.stringify(body), { status });
  });
}

it('shows server field errors inline and keeps typed values', async () => {
  mockFetch((url, opts) => {
    if (url.startsWith('/api/categories') || url.startsWith('/api/locations')) return { body: [] };
    if (opts.method === 'POST') return { status: 400, body: { error: 'Please fix the highlighted fields.', details: { use_by: "Use-by can't be before the date stored" } } };
    return { body: {} };
  });
  render(<ToastProvider><ItemForm open storeId={1} onClose={() => {}} onSaved={() => {}} /></ToastProvider>);
  await userEvent.type(screen.getByLabelText('Name'), 'Pickles');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText("Use-by can't be before the date stored")).toBeInTheDocument();
  expect(screen.getByLabelText('Name')).toHaveValue('Pickles');
});

it('sends the first batch with the item', async () => {
  let sent;
  mockFetch((url, opts) => {
    if (opts.method === 'POST') { sent = JSON.parse(opts.body); return { status: 201, body: { id: 5 } }; }
    return { body: [] };
  });
  const onSaved = vi.fn();
  render(<ToastProvider><ItemForm open storeId={1} onClose={() => {}} onSaved={onSaved} /></ToastProvider>);
  await userEvent.type(screen.getByLabelText('Name'), 'Apple butter');
  await userEvent.type(screen.getByLabelText('Quantity'), '6');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(sent).toMatchObject({ store_id: 1, name: 'Apple butter', first_batch: { quantity: '6' } });
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 5 })));
});

it('asks for a quantity when other first-batch fields are filled, and does not submit', async () => {
  mockFetch(() => ({ body: [] }));
  render(<ToastProvider><ItemForm open storeId={1} onClose={() => {}} onSaved={() => {}} /></ToastProvider>);
  await userEvent.type(screen.getByLabelText('Name'), 'Pickles');
  await userEvent.type(screen.getByLabelText('Batch code'), 'A1');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Add a quantity for the first batch')).toBeInTheDocument();
  expect(global.fetch.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false);
});

it('lists server errors that have no field in a form-level alert', async () => {
  mockFetch((url, opts) => (opts.method === 'POST'
    ? { status: 400, body: { error: 'Nope', details: { store_id: 'Please pick a store.' } } }
    : { body: [] }));
  render(<ToastProvider><ItemForm open storeId={1} onClose={() => {}} onSaved={() => {}} /></ToastProvider>);
  await userEvent.type(screen.getByLabelText('Name'), 'Pickles');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Please pick a store.');
});

it('moves an item to another store and clears its shelf', async () => {
  const { StoresProvider } = await import('../../client/src/components/StoresProvider.jsx');
  let sent;
  const urls = [];
  mockFetch((url, opts) => {
    urls.push(url);
    if (url === '/api/stores') return { body: [{ id: 1, name: 'Larder' }, { id: 2, name: 'Root Cellar' }] };
    if (url === '/api/locations?store_id=1') return { body: [{ id: 7, name: 'Shelf A', store_id: 1 }] };
    if (url === '/api/locations?store_id=2') return { body: [{ id: 9, name: 'Bin 1', store_id: 2 }] };
    if (opts.method === 'PATCH') { sent = JSON.parse(opts.body); return { body: { id: 5, ...sent } }; }
    return { body: [] };
  });
  const item = { id: 5, store_id: 1, name: 'Carrots', unit: 'lb', category_id: null, location_id: 7, low_threshold: null, notes: null, favorite: 0 };
  const onSaved = vi.fn();
  render(<ToastProvider><StoresProvider><ItemForm open item={item} onClose={() => {}} onSaved={onSaved} /></StoresProvider></ToastProvider>);
  const store = await screen.findByLabelText('Store');
  await waitFor(() => expect(screen.getByLabelText('Shelf, bin or crock')).toHaveValue('7'));
  await userEvent.selectOptions(store, 'Root Cellar');
  expect(screen.getByLabelText('Shelf, bin or crock')).toHaveValue('');
  await waitFor(() => expect(urls).toContain('/api/locations?store_id=2'));
  await screen.findByRole('option', { name: 'Bin 1' });
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(sent).toMatchObject({ store_id: 2, location_id: null });
});
