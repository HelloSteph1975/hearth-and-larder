import { it, expect } from 'vitest';
import { addDays, weekStart, weekDays, relativeDays, prettyDate } from '../../client/src/lib/dates.js';

it('does date math on local ISO dates', () => {
  expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  expect(weekStart('2026-10-08', 'monday')).toBe('2026-10-05');
  expect(weekStart('2026-10-08', 'sunday')).toBe('2026-10-04');
  expect(weekDays('2026-10-05')).toHaveLength(7);
  expect(relativeDays(0)).toBe('today');
  expect(relativeDays(3)).toBe('in 3 days');
  expect(relativeDays(-1)).toBe('1 day ago');
  expect(prettyDate('2026-10-08')).toBe('Thu 8 Oct');
});
