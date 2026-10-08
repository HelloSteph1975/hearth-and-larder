import { it, expect } from 'vitest';
import { planDropTarget, SLOTS } from '../../client/src/screens/Planner.jsx';

it('parses drop targets', () => {
  expect(planDropTarget('2026-10-08|supper')).toEqual({ date: '2026-10-08', slot: 'supper' });
  expect(planDropTarget('drawer')).toBeNull();
  expect(planDropTarget('2026-10-08|brunch')).toBeNull();
  expect(SLOTS).toEqual(['breakfast', 'lunch', 'supper', 'snack']);
});

import { vi } from 'vitest';
import { applyDrop, announcements } from '../../client/src/screens/Planner.jsx';

const fake = () => ({ post: vi.fn(async () => ({})), patch: vi.fn(async () => ({})) });
const drag = data => ({ data: { current: data } });

it('applyDrop posts a dragged recipe to the target cell', async () => {
  const c = fake();
  const res = await applyDrop({ active: drag({ recipe: { id: 7, title: 'Hash' } }), over: { id: '2026-10-08|supper' } }, c);
  expect(res).toBe('created');
  expect(c.post).toHaveBeenCalledWith('/api/plan', { date: '2026-10-08', slot: 'supper', recipe_id: 7 });
  expect(c.patch).not.toHaveBeenCalled();
});

it('applyDrop patches a dragged entry to the new cell', async () => {
  const c = fake();
  const entry = { id: 3, date: '2026-10-07', slot: 'lunch', recipe_title: 'Hash' };
  expect(await applyDrop({ active: drag({ entry }), over: { id: '2026-10-09|snack' } }, c)).toBe('moved');
  expect(c.patch).toHaveBeenCalledWith('/api/plan/3', { date: '2026-10-09', slot: 'snack' });
});

it('applyDrop does nothing for the same cell or an invalid target', async () => {
  const c = fake();
  const entry = { id: 3, date: '2026-10-07', slot: 'lunch' };
  expect(await applyDrop({ active: drag({ entry }), over: { id: '2026-10-07|lunch' } }, c)).toBeNull();
  expect(await applyDrop({ active: drag({ entry }), over: { id: 'drawer' } }, c)).toBeNull();
  expect(await applyDrop({ active: drag({ entry }), over: null }, c)).toBeNull();
  expect(await applyDrop({ active: drag({ recipe: { id: 1 } }), over: null }, c)).toBeNull();
  expect(c.post).not.toHaveBeenCalled();
  expect(c.patch).not.toHaveBeenCalled();
});

it('announces drags by name, day and meal', () => {
  const active = drag({ recipe: { id: 1, title: 'Root cellar hash' } });
  expect(announcements.onDragStart({ active })).toBe('Picked up Root cellar hash.');
  expect(announcements.onDragOver({ active, over: { id: '2026-10-06|supper' } })).toBe('Root cellar hash is over Tue 6 Oct, supper.');
  expect(announcements.onDragEnd({ active, over: { id: '2026-10-06|supper' } })).toBe('Dropped Root cellar hash on Tue 6 Oct, supper.');
  expect(announcements.onDragEnd({ active, over: null })).toMatch(/not placed/);
  expect(announcements.onDragCancel({ active })).toMatch(/cancelled/);
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { AddToPlanDialog } from '../../client/src/components/AddToPlanDialog.jsx';

it('edits a plan entry in place with a PATCH', async () => {
  HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
  const calls = [];
  global.fetch = vi.fn(async (url, opts = {}) => {
    calls.push({ url, method: opts.method ?? 'GET', body: opts.body ? JSON.parse(opts.body) : undefined });
    return new Response(JSON.stringify({ id: 3 }), { status: 200 });
  });
  const entry = { id: 3, date: '2026-10-07', slot: 'supper', recipe_id: 7, recipe_title: 'Hash', servings: 4, note: null };
  const onSaved = vi.fn();
  render(<ToastProvider><AddToPlanDialog open entry={entry} recipes={[{ id: 7, title: 'Hash' }]} onClose={() => {}} onSaved={onSaved} /></ToastProvider>);
  expect(screen.getByRole('heading', { name: 'Edit Hash' })).toBeInTheDocument();
  expect(screen.getByLabelText('Day')).toHaveValue('2026-10-07');
  await userEvent.clear(screen.getByLabelText('Servings'));
  await userEvent.type(screen.getByLabelText('Servings'), '6');
  await userEvent.selectOptions(screen.getByLabelText('Meal'), 'lunch');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ url: '/api/plan/3', method: 'PATCH', body: { date: '2026-10-07', slot: 'lunch', recipe_id: 7, servings: '6', note: null } });
});
