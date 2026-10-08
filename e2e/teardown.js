// Stops the test server (so Windows lets go of the database file), then deletes the throwaway data folder.
import fs from 'node:fs';

export default async function teardown() {
  const dir = process.env.HL_E2E_DATA_DIR;
  try { await fetch('http://127.0.0.1:4199/api/shutdown', { method: 'POST', signal: AbortSignal.timeout(10000) }); } catch { /* already gone */ }
  if (dir && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
}
