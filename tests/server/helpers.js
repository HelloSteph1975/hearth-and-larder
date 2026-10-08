import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createContext } from '../../server/context.js';
import { createApp } from '../../server/app.js';

export function makeTestContext({ onShutdown } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hearth-test-'));
  const ctx = createContext({ dataDir, port: 0, demo: false });
  const app = createApp(ctx, { onShutdown });
  return {
    ctx, app, dataDir,
    http: () => request(app),
    cleanup() { try { ctx.db.close(); } catch {} fs.rmSync(dataDir, { recursive: true, force: true }); },
  };
}
