import { it, expect, vi } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { ConfirmProvider, useConfirm } from '../../client/src/components/ConfirmProvider.jsx';
import { Dialog } from '../../client/src/components/Dialog.jsx';
import { useApi } from '../../client/src/lib/useApi.js';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

it('gives each dialog its own title id', () => {
  render(<>
    <Dialog open onClose={() => {}} title="First">a</Dialog>
    <Dialog open onClose={() => {}} title="Second">b</Dialog>
  </>);
  const [a, b] = screen.getAllByRole('dialog', { hidden: true });
  expect(a.getAttribute('aria-labelledby')).not.toBe(b.getAttribute('aria-labelledby'));
  expect(document.getElementById(a.getAttribute('aria-labelledby'))).toHaveTextContent('First');
});

it('answers an unanswered confirm with false when a new one arrives', async () => {
  let confirm;
  function Grab() { confirm = useConfirm(); return null; }
  render(<ConfirmProvider><Grab /></ConfirmProvider>);
  let first;
  act(() => { first = confirm({ title: 'One?' }); });
  act(() => { confirm({ title: 'Two?' }); });
  await expect(first).resolves.toBe(false);
  expect(await screen.findByText('Two?')).toBeInTheDocument();
});

it('drops old data when the url changes and clears it for a null url', async () => {
  global.fetch = vi.fn(async url => {
    await new Promise(r => setTimeout(r, url.endsWith('/2') ? 30 : 0));
    return new Response(JSON.stringify({ url }), { status: 200 });
  });
  const { result, rerender } = renderHook(({ url }) => useApi(url), { initialProps: { url: '/api/items/1' } });
  await waitFor(() => expect(result.current.data).toEqual({ url: '/api/items/1' }));
  rerender({ url: '/api/items/2' });
  expect(result.current.data).toBeNull();
  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(result.current.data).toEqual({ url: '/api/items/2' }));
  rerender({ url: null });
  expect(result.current.data).toBeNull();
  expect(result.current.loading).toBe(false);
});
