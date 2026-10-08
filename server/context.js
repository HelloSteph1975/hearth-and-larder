import { openDb } from './db/connection.js';

export function createContext(config) {
  const ctx = {
    config,
    db: openDb(config.dataDir),
    reopen() { ctx.db = openDb(config.dataDir); return ctx.db; },
  };
  return ctx;
}
