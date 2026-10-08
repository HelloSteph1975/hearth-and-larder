import { it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SettingsProvider } from '../../client/src/components/SettingsProvider.jsx';
import { UseByBadge } from '../../client/src/components/ItemCard.jsx';
import { addDays, todayISO } from '../../client/src/lib/dates.js';

it('UseByBadge follows the use-soon window from Settings', async () => {
  const in10 = addDays(todayISO(), 10);
  const { unmount } = render(<UseByBadge useBy={in10} />);
  expect(screen.getByText('use in 10 days')).toBeInTheDocument(); // default window is 14 days
  unmount();
  global.fetch = vi.fn(async () => new Response(JSON.stringify({ use_soon_days: '7' }), { status: 200 }));
  render(<SettingsProvider><UseByBadge useBy={in10} /><UseByBadge useBy={addDays(todayISO(), 3)} /></SettingsProvider>);
  await waitFor(() => expect(screen.queryByText('use in 10 days')).toBeNull());
  expect(screen.getByText('use in 3 days')).toBeInTheDocument();
});
