import { it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { PlaceBatchDialog } from '../../client/src/components/PlaceBatchDialog.jsx';
import { JarsCard } from '../../client/src/screens/Hearth.jsx';
import { BatchDays } from '../../client/src/screens/BatchDays.jsx';
import { readyTime, readyRange, readyState, datesFor } from '../../client/src/lib/batch.js';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

const day = (id, day_no, kind, task, ready = [null, null, null]) =>
  ({ id, day_no, kind, task, ready_min: ready[0], ready_max: ready[1], ready_unit: ready[2], ingredients: [] });
const WEEK1 = {
  id: 1, week_no: 1, month_title: 'Month 1: Mexican foundations', month_note: 'Beans first.', title: 'Beans, stock and a starter', cook: 'Frijoles de olla.',
  days: [day(11, 1, 'big', 'A pot of black beans.'), day(12, 2, 'jar', 'A sourdough starter.', [7, 14, 'days']), day(13, 3, 'refill', 'Plain yogurt.')],
  runs: [], done: false, done_on: null,
};

it('describes ready times and windows', () => {
  expect(readyTime({ ready_min: 7, ready_max: 14, ready_unit: 'days' })).toBe('7 to 14 days');
  expect(readyTime({ ready_min: 2, ready_max: 2, ready_unit: 'days' })).toBe('2 days');
  expect(readyTime({ ready_min: 1, ready_max: null, ready_unit: 'weeks' })).toBe('1 week');
  expect(readyTime({ ready_min: null })).toBeNull();
  expect(readyRange({ ready_from: '2026-10-28', ready_to: '2026-11-04' }, '2026-10-20')).toBe('Ready 28 Oct to 4 Nov');
  expect(readyRange({ ready_from: '2026-12-28', ready_to: '2027-04-28' }, '2026-10-20')).toBe('Ready 28 Dec 2026 to 28 Apr 2027');
  expect(readyRange({ ready_from: null })).toBeNull();
  const w = { ready_from: '2026-10-28', ready_to: '2026-11-04' };
  expect([readyState(w, '2026-10-27'), readyState(w, '2026-10-28'), readyState(w, '2026-11-05')]).toEqual(['waiting', 'ready', 'past']);
  expect(datesFor('2026-10-19', [5, 0, 2])).toEqual(['2026-10-19', '2026-10-21', '2026-10-24']);
});

it('places a week on the three days picked, in date order', async () => {
  const calls = [];
  global.fetch = vi.fn(async (url, opts = {}) => { calls.push([url, JSON.parse(opts.body)]); return new Response('{}', { status: 201 }); });
  const onSaved = vi.fn();
  render(<ToastProvider><PlaceBatchDialog open plan={WEEK1} start="2026-10-19" onClose={() => {}} onSaved={onSaved} /></ToastProvider>);
  // Mon, Wed and Sat start ticked; swap Saturday for Friday.
  expect(screen.getByLabelText('Sat 24 Oct')).toBeChecked();
  expect(screen.getByLabelText('Thu 22 Oct')).toBeDisabled();
  await userEvent.click(screen.getByLabelText('Sat 24 Oct'));
  expect(screen.getByRole('button', { name: 'Put on the planner' })).toBeDisabled();
  await userEvent.click(screen.getByLabelText('Fri 23 Oct'));
  expect(screen.getByRole('list', { name: 'What goes where' })).toHaveTextContent('Fri 23 Oct: Day 3, refill');
  await userEvent.click(screen.getByRole('button', { name: 'Put on the planner' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith('2026-10-19'));
  expect(calls).toEqual([['/api/batch-plans/1/place', { dates: ['2026-10-19', '2026-10-21', '2026-10-23'] }]]);
});

it('shows jars working with where each one stands', () => {
  const jar = { id: 5, date: '2026-10-21', done_on: '2026-10-22', note: 'A sourdough starter.', batch_kind: 'jar', batch_week: 1, ready_from: '2026-10-29', ready_to: '2026-11-05' };
  render(<MemoryRouter><JarsCard rows={[jar]} today="2026-10-30" /></MemoryRouter>);
  expect(screen.getByText('Week 1 · Start a jar')).toBeInTheDocument();
  expect(screen.getByText(/Started Thu 22 Oct\. Ready 29 Oct to 5 Nov/)).toBeInTheDocument();
  expect(screen.getByText('check it now')).toBeInTheDocument();
});

it('lists the weeks by month and says which are done', async () => {
  const done = { ...WEEK1, id: 2, week_no: 2, title: 'Masa', runs: [{ id: 1, first_date: '2026-10-12' }], done: true, done_on: '2026-10-17' };
  const plans = [{ ...done }, { ...WEEK1, id: 3, week_no: 3 }];
  global.fetch = vi.fn(async url => new Response(JSON.stringify(String(url).startsWith('/api/batch-plans') ? plans : []), { status: 200 }));
  render(<MemoryRouter><ToastProvider><BatchDays /></ToastProvider></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'Month 1: Mexican foundations' })).toBeInTheDocument();
  expect(screen.getByText('1 of 2 weeks done. Next up: Week 3.')).toBeInTheDocument();
  expect(screen.getByText('Done Sat 17 Oct')).toBeInTheDocument();
  expect(screen.getAllByText('Ready in 7 to 14 days')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Put Week 2 on the planner' })).toHaveTextContent('Plan it again');
});
