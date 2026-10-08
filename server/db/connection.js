import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { migrate } from './migrations.js';

export function ensureDataDirs(dataDir) {
  for (const d of [dataDir, path.join(dataDir, 'photos'), path.join(dataDir, 'photos', '_trash'), path.join(dataDir, 'backups')]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

export function openDb(dataDir, file = 'hearth.db') {
  ensureDataDirs(dataDir);
  const db = new DatabaseSync(path.join(dataDir, file));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

export function transaction(db, fn) {
  if (db.isTransaction) return fn();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw err;
  }
}
