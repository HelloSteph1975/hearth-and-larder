import { it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useApi } from '../../client/src/lib/useApi.js';

function mock() {
  global.fetch = vi.fn(async url => new Response(JSON.stringify({ url }), { status: 200 }));
}

it('drops old data when the url changes by default', async () => {
  mock();
  const { result, rerender } = renderHook(({ u }) => useApi(u), { initialProps: { u: '/a' } });
  await waitFor(() => expect(result.current.data).toEqual({ url: '/a' }));
  rerender({ u: '/b' });
  expect(result.current.data).toBeNull();
  await waitFor(() => expect(result.current.data).toEqual({ url: '/b' }));
});

it('keeps old data while a new url loads with keepPrevious', async () => {
  mock();
  const { result, rerender } = renderHook(({ u }) => useApi(u, { keepPrevious: true }), { initialProps: { u: '/a' } });
  await waitFor(() => expect(result.current.data).toEqual({ url: '/a' }));
  rerender({ u: '/b' });
  expect(result.current.data).toEqual({ url: '/a' });
  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(result.current.data).toEqual({ url: '/b' }));
  expect(result.current.loading).toBe(false);
});
