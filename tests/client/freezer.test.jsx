import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { StoresProvider } from '../../client/src/components/StoresProvider.jsx';
import { ItemForm } from '../../client/src/screens/ItemForm.jsx';
import { BatchForm } from '../../client/src/screens/BatchForm.jsx';
import { isFreezerStore } from '../../client/src/components/BatchFields.jsx';

const STORES = [
  { id: 1, name: 'Larder', icon: 'jar' },
  { id: 5, name: 'Freezer', icon: 'freezer' },
];

let posted;
beforeEach(() => {
  HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };
  posted = null;
  global.fetch = vi.fn(async (url, opts = {}) => {
    if (opts.method === 'POST') { posted = JSON.parse(opts.body); return new Response(JSON.stringify({ id: 9 }), { status: 201 }); }
    return new Response(JSON.stringify(url.startsWith('/api/stores') ? STORES : []), { status: 200 });
  });
});

const wrap = ui => render(<ToastProvider><StoresProvider>{ui}</StoresProvider></ToastProvider>);

it('knows a freezer by its icon or its name', () => {
  expect(isFreezerStore({ name: 'Chest', icon: 'freezer' })).toBe(true);
  expect(isFreezerStore({ name: ' freezer ', icon: 'snowflake' })).toBe(true);
  expect(isFreezerStore({ name: 'Refrigerator', icon: 'fridge' })).toBe(false);
  expect(isFreezerStore(undefined)).toBe(false);
});

it('starts a first batch in the Freezer as frozen, and still saves an item with no batch', async () => {
  const onSaved = vi.fn();
  wrap(<ItemForm open storeId={5} onClose={() => {}} onSaved={onSaved} />);
  await waitFor(() => expect(screen.getByLabelText('Method')).toHaveValue('frozen'));
  await userEvent.type(screen.getByLabelText('Name'), 'Peas');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(posted.first_batch).toBeUndefined();
});

it('keeps the method the user picks in the Freezer', async () => {
  wrap(<ItemForm open storeId={5} onClose={() => {}} onSaved={() => {}} />);
  await waitFor(() => expect(screen.getByLabelText('Method')).toHaveValue('frozen'));
  await userEvent.selectOptions(screen.getByLabelText('Method'), 'dehydrated');
  await userEvent.type(screen.getByLabelText('Name'), 'Apple rings');
  await userEvent.type(screen.getByLabelText('Quantity'), '3');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(posted).not.toBeNull());
  expect(posted.first_batch).toMatchObject({ method: 'dehydrated' });
});

it('leaves the method empty in other stores', async () => {
  wrap(<ItemForm open storeId={1} onClose={() => {}} onSaved={() => {}} />);
  await screen.findByLabelText('Method');
  await new Promise(r => setTimeout(r, 50));
  expect(screen.getByLabelText('Method')).toHaveValue('');
});

it('prefills frozen for a new batch of a Freezer item, but not when editing one', async () => {
  const item = { id: 2, name: 'Peaches', unit: 'cup', store_id: 5 };
  const { unmount } = wrap(<BatchForm open item={item} onClose={() => {}} onSaved={() => {}} />);
  await waitFor(() => expect(screen.getByLabelText('Method')).toHaveValue('frozen'));
  unmount();
  wrap(<BatchForm open item={item} batch={{ id: 4, quantity: 2, method: 'other' }} onClose={() => {}} onSaved={() => {}} />);
  await new Promise(r => setTimeout(r, 50));
  expect(screen.getByLabelText('Method')).toHaveValue('other');
});
