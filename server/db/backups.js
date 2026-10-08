import { DatabaseSync } from 'node:sqlite';

// Photo file names a backup database refers to (deleted rows too: a restore can bring them back).
export function photoFilenamesIn(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return db.prepare('SELECT filename FROM photos').all().map(r => r.filename);
  } finally {
    db.close();
  }
}
