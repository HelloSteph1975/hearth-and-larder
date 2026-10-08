import { loadConfig } from './config.js';
import { createContext } from './context.js';
import { createApp, ROOT } from './app.js';
import { purgeSoftDeleted, purgeTrash } from './services/purge.js';
import { ensureRecentBackup, rotateBackups } from './services/backup.js';

export function runMaintenance(ctx) {
  const { db, config } = ctx;
  const steps = [
    ['Startup backup', () => ensureRecentBackup(db, config.dataDir)],
    ['Purging old deleted rows', () => purgeSoftDeleted(db, config.dataDir)],
    ['Purging photo trash', () => purgeTrash(config.dataDir)],
    ['Rotating backups', () => rotateBackups(config.dataDir)],
  ];
  for (const [label, fn] of steps) {
    try { fn(); } catch (err) { console.error(`${label} failed (the app will still run):`, err); }
  }
}

const demo = process.argv.includes('--demo');
let config;
try {
  config = loadConfig({ root: ROOT, demo });
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
let ctx;
try {
  ctx = createContext(config);
} catch (err) {
  console.error(`Could not open the data folder at ${config.dataDir}:`, err.message);
  process.exit(1);
}
if (demo) {
  const { seedDemo } = await import('./demo/seed.js');
  seedDemo(ctx, { reset: process.argv.includes('--reset') });
}
runMaintenance(ctx);

let server;
function shutdown() {
  server?.close();
  try { ctx.db.close(); } catch {}
  process.exit(0);
}
const app = createApp(ctx, { onShutdown: shutdown });
server = app.listen(config.port, '127.0.0.1', () => {
  console.log(`Hearth & Larder${demo ? ' (demo)' : ''} is open at http://localhost:${config.port}`);
  console.log(`Data folder: ${config.dataDir}`);
});
server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${config.port} is busy; Hearth & Larder is probably already running.`);
    process.exit(0);
  }
  throw err;
});
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
