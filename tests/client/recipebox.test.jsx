import { it, expect, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { RecipeBox } from '../../client/src/screens/RecipeBox.jsx';

it('follows Back and Forward in the search box instead of rewriting the address', async () => {
  global.fetch = vi.fn(async () => new Response('[]', { status: 200 }));
  const router = createMemoryRouter([{ path: '/recipes', element: <RecipeBox /> }], { initialEntries: ['/recipes'] });
  render(<RouterProvider router={router} />);
  const box = await screen.findByRole('searchbox', { name: 'Search recipes' });
  const q = () => new URLSearchParams(router.state.location.search).get('q');
  await userEvent.type(box, 'flour');
  await waitFor(() => expect(q()).toBe('flour'));
  await userEvent.click(screen.getByRole('button', { name: 'Favorites' }));
  await userEvent.clear(box);
  await userEvent.type(box, 'butter');
  await waitFor(() => expect(q()).toBe('butter'));
  await act(() => router.navigate(-1));
  expect(q()).toBe('flour');
  await waitFor(() => expect(box).toHaveValue('flour'));
  await new Promise(r => setTimeout(r, 400)); // past the search debounce
  expect(q()).toBe('flour');
  await act(() => router.navigate(1));
  await waitFor(() => expect(box).toHaveValue('butter'));
});
