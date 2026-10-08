import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { BatchForm } from '../../client/src/screens/BatchForm.jsx';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };
});

it('sends price null when the source is changed from bought to gifted', async () => {
  let sent;
  global.fetch = vi.fn(async (url, opts = {}) => {
    if (opts.method === 'POST') { sent = JSON.parse(opts.body); return new Response(JSON.stringify({ id: 9 }), { status: 201 }); }
    return new Response(JSON.stringify([]), { status: 200 });
  });
  const onSaved = vi.fn();
  render(<ToastProvider><BatchForm open item={{ id: 2, name: 'Honey', unit: 'jar' }} onClose={() => {}} onSaved={onSaved} /></ToastProvider>);
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '2' } });
  await userEvent.selectOptions(screen.getByLabelText('Where it came from'), 'bought');
  await screen.findByLabelText('Price paid');
  fireEvent.change(screen.getByLabelText('Price paid'), { target: { value: '12' } });
  fireEvent.change(screen.getByLabelText('Where bought'), { target: { value: 'Farm stand' } });
  await userEvent.selectOptions(screen.getByLabelText('Where it came from'), 'gifted');
  expect(screen.queryByLabelText('Price paid')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(sent).toMatchObject({ item_id: 2, source: 'gifted', price: null, vendor: null, purchased_on: null });
});
