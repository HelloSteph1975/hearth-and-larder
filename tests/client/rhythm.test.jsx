import { it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { RhythmForm, rhythmBody } from '../../client/src/components/RhythmForm.jsx';
import { DueSoonCard } from '../../client/src/screens/Hearth.jsx';
import { cadenceText, monthRange, statusOf, presetOf, groupOf } from '../../client/src/lib/rhythm.js';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

it('describes how often and where a staple stands', () => {
  expect(cadenceText({ every_min: 1, every_max: 1, every_unit: 'weeks' })).toBe('Every week');
  expect(cadenceText({ every_min: 2, every_max: 4, every_unit: 'weeks' })).toBe('Every 2 to 4 weeks');
  expect(cadenceText({ every_min: 1, every_max: null, every_unit: 'years' })).toBe('Every year');
  expect(cadenceText({ season_months: '12,1,2' })).toBe('In season Dec to Feb');
  expect(monthRange('1,4')).toBe('Jan, Apr');
  expect(monthRange('10')).toBe('Oct');
  expect(statusOf({ state: 'harvest', harvest: { crop: 'Tomatoes', harvested_on: '2026-10-14' } }, '2026-10-17')).toEqual(['garden', 'Tomatoes picked 3 days ago']);
  expect(statusOf({ state: 'overdue', due_to: '2026-10-08' }, '2026-10-17')).toEqual(['tomato', 'Was due by 8 Oct']);
  expect(statusOf({ state: 'due', season_months: '9,10,11' }, '2026-10-17')).toEqual(['honey', 'In season now']);
  expect(statusOf({ state: 'later', season_months: '6,7', in_season: false, next_season: '2027-06-01' }, '2026-10-17')).toEqual([null, 'Next season from Jun']);
  expect(statusOf({ state: 'new' }, '2026-10-17')).toEqual([null, 'Not made yet']);
  expect(presetOf({ every_min: 2, every_max: 4, every_unit: 'weeks' })).toBe('w24');
  expect(presetOf({ every_min: 5, every_max: 5, every_unit: 'weeks' })).toBe('own');
  expect(groupOf({ every_min: 1, every_max: 2, every_unit: 'months' })).toBe('Every month or longer');
});

it('sends a repeat or a set of months, never both', () => {
  expect(rhythmBody({ name: 'Ghee', preset: 'w24', crops: '', notes: '', months: [9] }))
    .toEqual({ name: 'Ghee', crops: null, notes: null, every_min: 2, every_max: 4, every_unit: 'weeks', season_months: null });
  expect(rhythmBody({ name: 'Pesto', preset: 'season', months: [9, 6, 7], crops: 'Basil', notes: '' }))
    .toMatchObject({ every_min: null, season_months: '6,7,9', crops: 'Basil' });
  expect(rhythmBody({ name: 'Granola', preset: 'own', every_min: '5', every_max: '', every_unit: 'weeks', months: [] }))
    .toMatchObject({ every_min: 5, every_max: 5, every_unit: 'weeks' });
});

it('adds a seasonal staple with its months and crops', async () => {
  const calls = [];
  global.fetch = vi.fn(async (url, opts = {}) => { calls.push([url, opts.method, JSON.parse(opts.body)]); return new Response('{}', { status: 201 }); });
  const onSaved = vi.fn();
  render(<ToastProvider><RhythmForm open onClose={() => {}} onSaved={onSaved} /></ToastProvider>);
  await userEvent.type(screen.getByLabelText('What you make'), 'Pesto');
  await userEvent.selectOptions(screen.getByLabelText('How often'), 'season');
  await userEvent.click(screen.getByLabelText('Jul'));
  await userEvent.click(screen.getByLabelText('Aug'));
  await userEvent.type(screen.getByLabelText('Made from'), 'Basil');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(calls).toEqual([['/api/rhythms', 'POST', { name: 'Pesto', crops: 'Basil', notes: null, every_min: null, every_max: null, every_unit: null, season_months: '7,8' }]]);
});

it('the Hearth card logs a make with an undo', async () => {
  const calls = [];
  global.fetch = vi.fn(async (url, opts = {}) => {
    calls.push([url, opts.method ?? 'GET']);
    return new Response(JSON.stringify(opts.method === 'POST' ? { id: 9, undo: '/api/rhythm-log/9' } : { ok: true }), { status: 200 });
  });
  const onChange = vi.fn();
  const rows = [{ id: 4, name: 'Bread', state: 'overdue', due_to: '2026-10-08' }];
  render(<MemoryRouter><ToastProvider><DueSoonCard rows={rows} today="2026-10-17" onChange={onChange} /></ToastProvider></MemoryRouter>);
  expect(screen.getByText('Was due by 8 Oct')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Made Bread today' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(calls).toEqual([['/api/rhythms/4/made', 'POST'], ['/api/rhythm-log/9', 'DELETE']]));
  expect(onChange).toHaveBeenCalledTimes(2);
});
