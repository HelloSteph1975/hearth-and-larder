import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, defaultDataDir } from '../../server/config.js';

describe('loadConfig', () => {
  it('uses defaults when nothing is set', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-cfg-'));
    expect(loadConfig({ env: {}, root })).toEqual({ dataDir: defaultDataDir(false), port: 4193, demo: false });
  });
  it('reads config.json and lets env override it', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-cfg-'));
    fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ dataDir: 'C:/x', port: 5000 }));
    expect(loadConfig({ env: {}, root })).toMatchObject({ dataDir: 'C:/x', port: 5000 });
    expect(loadConfig({ env: { HEARTH_PORT: '6000', HEARTH_DATA_DIR: 'D:/y' }, root })).toMatchObject({ dataDir: 'D:/y', port: 6000 });
  });
  it('demo mode uses its own folder and port', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-cfg-'));
    expect(loadConfig({ env: {}, root, demo: true })).toEqual({ dataDir: defaultDataDir(true), port: 4195, demo: true });
    expect(defaultDataDir(true)).toMatch(/Hearth & Larder Demo Data$/);
  });
});
