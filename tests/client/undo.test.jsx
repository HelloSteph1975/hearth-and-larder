import { it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';
import { useDeleteWithUndo } from '../../client/src/components/useDeleteWithUndo.jsx';

function Harness({ onChange }) {
  const del = useDeleteWithUndo();
  return <button onClick={() => del({ url: '/api/items/1', label: 'Jam', onChange })}>Delete jam</button>;
}

it('confirms, deletes, then undoes', async () => {
  HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };
  const calls = [];
  global.fetch = vi.fn(async (url, opts) => {
    calls.push(`${opts.method} ${url}`);
    return new Response(JSON.stringify(opts.method === 'DELETE' ? { ok: true, restore: '/api/items/1/restore' } : {}), { status: 200 });
  });
  const onChange = vi.fn();
  render(<ToastProvider><ConfirmProvider><Harness onChange={onChange} /></ConfirmProvider></ToastProvider>);
  await userEvent.click(screen.getByText('Delete jam'));
  await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
  expect(calls).toEqual(['DELETE /api/items/1', 'POST /api/items/1/restore']);
  expect(onChange).toHaveBeenCalledTimes(2);
});

it('shows the error when undo fails', async () => {
  HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };
  global.fetch = vi.fn(async (url, opts) => (opts.method === 'DELETE'
    ? new Response(JSON.stringify({ ok: true, restore: '/api/items/1/restore' }), { status: 200 })
    : new Response(JSON.stringify({ error: 'That item is gone for good' }), { status: 404 })));
  const onChange = vi.fn();
  render(<ToastProvider><ConfirmProvider><Harness onChange={onChange} /></ConfirmProvider></ToastProvider>);
  await userEvent.click(screen.getByText('Delete jam'));
  await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
  expect(await screen.findByText('That item is gone for good')).toBeInTheDocument();
  expect(onChange).toHaveBeenCalledTimes(1);
});
