import { it, expect } from 'vitest';
import { greeting } from '../../client/src/screens/Hearth.jsx';
import { formatSize } from '../../client/src/screens/Settings.jsx';

it('greets by time of day', () => {
  expect(greeting(6, 'Stephanie')).toBe('Good morning, Stephanie');
  expect(greeting(13, '')).toBe('Good afternoon');
  expect(greeting(19, 'Stephanie')).toBe('Good evening, Stephanie');
});

it('formats backup sizes', () => {
  expect(formatSize(500)).toBe('1 KB');
  expect(formatSize(20480)).toBe('20 KB');
  expect(formatSize(3 * 1024 * 1024)).toBe('3.0 MB');
});

import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';
import { BackupsCard } from '../../client/src/screens/Settings.jsx';

it('restore posts once and locks the buttons until reload', async () => {
  HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };
  const posts = [];
  global.fetch = vi.fn(async (url, opts = {}) => {
    const json = d => new Response(JSON.stringify(d), { status: 200 });
    if (opts.method === 'POST') { posts.push(url); return new Promise(() => {}); }
    return json([
      { name: 'hearth-2026-10-07.db', size: 2048, modified: '2026-10-07T10:00:00Z' },
      { name: 'pre-restore-2026-10-06T10-00-00.db', size: 2048, modified: '2026-10-06T10:00:00Z' },
    ]);
  });
  render(<ToastProvider><ConfirmProvider><BackupsCard /></ConfirmProvider></ToastProvider>);
  expect(await screen.findByText('Safety copy before restore')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Restore hearth-2026-10-07.db' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Restore' }));
  await waitFor(() => expect(posts).toHaveLength(1));
  for (const b of screen.getAllByRole('button', { name: /^Restore / })) expect(b).toBeDisabled();
  expect(screen.getByRole('button', { name: /Back up now/ })).toBeDisabled();
});
