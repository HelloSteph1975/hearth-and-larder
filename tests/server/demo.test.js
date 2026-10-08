import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';
import { seedDemo } from '../../server/demo/seed.js';

let t;
afterEach(() => t?.cleanup());

const localDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

it('seeds a believable pantry once, and refuses to reset real data', async () => {
  t = makeTestContext();
  t.ctx.config.demo = true;
  seedDemo(t.ctx);
  seedDemo(t.ctx);
  const n = t.ctx.db.prepare('SELECT COUNT(*) n FROM items').get().n;
  expect(n).toBeGreaterThanOrEqual(18);
  expect(t.ctx.db.prepare('SELECT COUNT(*) n FROM recipes').get().n).toBeGreaterThanOrEqual(6);
  const home = (await t.http().get(`/api/home?today=${localDay()}`)).body;
  expect(home.use_soon.length).toBeGreaterThan(0);
  expect(home.can_make.length).toBeGreaterThan(0);
  expect(home.settings.household_name).toBe('');
  t.ctx.config.demo = false;
  expect(() => seedDemo(t.ctx, { reset: true })).toThrow(/demo/);
});

it('plans meals inside the current week, today included', () => {
  t = makeTestContext();
  t.ctx.config.demo = true;
  seedDemo(t.ctx);
  const today = localDay();
  const d = new Date();
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const iso = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const dates = t.ctx.db.prepare('SELECT date FROM meal_plan').all().map(r => r.date);
  expect(dates).toContain(today);
  expect(new Set(dates).size).toBeGreaterThanOrEqual(3);
  for (const date of dates) expect(date >= iso(monday) && date <= iso(sunday), date).toBe(true);
});

it('refuses to reset the real data folder even in demo mode', async () => {
  const { assertDemoFolder } = await import('../../server/demo/seed.js');
  const { defaultDataDir } = await import('../../server/config.js');
  expect(() => assertDemoFolder({ demo: true, dataDir: defaultDataDir(false) }, {})).toThrow(/demo/);
  expect(() => assertDemoFolder({ demo: true, dataDir: 'C:/kitchen' }, { HEARTH_DATA_DIR: 'C:/Kitchen/' })).toThrow(/demo/);
  expect(() => assertDemoFolder({ demo: true, dataDir: 'C:/hl-demo' }, { HEARTH_DATA_DIR: 'C:/kitchen' })).not.toThrow();
});

it('reset wipes and reseeds the demo folder', () => {
  t = makeTestContext();
  t.ctx.config.demo = true;
  seedDemo(t.ctx);
  t.ctx.db.prepare("UPDATE items SET deleted_at = datetime('now')").run();
  seedDemo(t.ctx, { reset: true });
  expect(t.ctx.db.prepare('SELECT COUNT(*) n FROM items WHERE deleted_at IS NULL').get().n).toBeGreaterThanOrEqual(18);
});
