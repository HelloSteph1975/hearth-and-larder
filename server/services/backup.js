import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { HttpError } from '../http.js';
import { untrashLivePhotos } from './photos.js';

const pad = n => String(n).padStart(2, '0');
const localDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dirOf = dataDir => path.join(dataDir, 'backups');
const NAME = /^(hearth-\d{4}-\d{2}-\d{2}|pre-restore-[\dT-]+)\.db$/;

export function backupNow(db, dataDir, now = new Date()) {
  const name = `hearth-${localDate(now)}.db`;
  const file = path.join(dirOf(dataDir), name);
  const tmp = `${file}.tmp`;
  fs.rmSync(tmp, { force: true });
  try {
    db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
    fs.renameSync(tmp, file);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
  fs.utimesSync(file, now, now);
  return { name, file };
}

export function listBackups(dataDir) {
  const dir = dirOf(dataDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(n => NAME.test(n)).map(name => {
    const st = fs.statSync(path.join(dir, name));
    return { name, size: st.size, modified: st.mtime.toISOString() };
  }).sort((a, b) => b.modified.localeCompare(a.modified) || b.name.localeCompare(a.name));
}

export function rotateBackups(dataDir, { keepDays = 30, keepMin = 5, now = Date.now() } = {}) {
  const removed = [];
  listBackups(dataDir).forEach((b, i) => {
    if (i < keepMin) return;
    if (now - Date.parse(b.modified) > keepDays * 86400000) {
      fs.rmSync(path.join(dirOf(dataDir), b.name), { force: true });
      removed.push(b.name);
    }
  });
  return removed;
}

export function ensureRecentBackup(db, dataDir, now = new Date()) {
  const newest = listBackups(dataDir).find(b => b.name.startsWith('hearth-'));
  if (newest && now.getTime() - Date.parse(newest.modified) < 86400000) return false;
  backupNow(db, dataDir, now);
  return true;
}

export function restoreBackup(ctx, name) {
  if (!NAME.test(String(name))) throw new HttpError(400, 'That is not a Hearth & Larder backup.');
  const src = path.join(dirOf(ctx.config.dataDir), name);
  if (!fs.existsSync(src)) throw new HttpError(404, 'Backup not found.');
  const live = path.join(ctx.config.dataDir, 'hearth.db');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('Z', '');
  const safetyCopy = `pre-restore-${stamp}.db`;
  const safetyPath = path.join(dirOf(ctx.config.dataDir), safetyCopy);
  const tmp = `${live}.restore-tmp`;
  fs.copyFileSync(src, tmp);
  let valid = false;
  try {
    const probe = new DatabaseSync(tmp, { readOnly: true });
    try { valid = probe.prepare('PRAGMA integrity_check').get().integrity_check === 'ok'; } finally { probe.close(); }
  } catch { valid = false; }
  if (!valid) {
    fs.rmSync(tmp, { force: true });
    throw new HttpError(400, 'That backup file is damaged, so nothing was changed.');
  }
  try {
    ctx.db.exec(`VACUUM INTO '${safetyPath.replace(/'/g, "''")}'`);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
  ctx.db.close();
  let failure = null;
  try {
    for (const ext of ['-wal', '-shm']) { try { fs.rmSync(live + ext, { force: true }); } catch {} }
    fs.renameSync(tmp, live);
  } catch (err) {
    failure = err;
    fs.rmSync(tmp, { force: true });
    try {
      fs.copyFileSync(safetyPath, live);
      for (const ext of ['-wal', '-shm']) { try { fs.rmSync(live + ext, { force: true }); } catch {} }
    } catch {}
  }
  const FAILED = 'Restore failed; your data was put back from the safety copy.';
  try {
    ctx.reopen();
  } catch {
    let recovered = false;
    try {
      fs.copyFileSync(safetyPath, live);
      for (const ext of ['-wal', '-shm']) { try { fs.rmSync(live + ext, { force: true }); } catch {} }
      ctx.reopen();
      recovered = true;
    } catch {}
    if (recovered) throw new HttpError(500, FAILED);
    throw new HttpError(500, `Restore failed and the database could not be reopened. Please restart Hearth & Larder; your safety copy is ${safetyCopy} in the backups folder.`);
  }
  if (failure) throw new HttpError(500, FAILED);
  let photosBack = 0;
  try { photosBack = untrashLivePhotos(ctx.db, ctx.config.dataDir); } catch (err) { console.error('Could not bring back trashed photos:', err); }
  return { restored: name, safetyCopy, photosBack };
}
