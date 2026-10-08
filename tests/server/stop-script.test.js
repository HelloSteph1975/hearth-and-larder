import { describe, it, expect } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stopServer, resolvePort } from '../../scripts/stop.js';

const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));

describe('scripts/stop.js', () => {
  it('POSTs /api/shutdown and reports success', async () => {
    let hit = '';
    const srv = http.createServer((req, res) => { hit = `${req.method} ${req.url}`; res.end('{}'); });
    const port = await listen(srv);
    const result = await stopServer(port, 5000);
    srv.close();
    expect(result).toBe('stopped');
    expect(hit).toBe('POST /api/shutdown');
  });

  it('reports not running when nothing is listening', async () => {
    const srv = http.createServer();
    const port = await listen(srv);
    await new Promise(r => srv.close(r));
    expect(await stopServer(port, 2000)).toBe('not-running');
  });

  it('says stopped when the server drops the socket and is gone a moment later', async () => {
    const srv = http.createServer(req => { req.socket.destroy(); srv.close(); });
    const port = await listen(srv);
    expect(await stopServer(port, 2000, { settleMs: 50 })).toBe('stopped');
  });

  it('reads the port from env, then config.json, then defaults, and rejects a bad HEARTH_PORT', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-stop-'));
    expect(resolvePort(dir, {})).toBe(4193);
    fs.writeFileSync(path.join(dir, 'config.json'), '{"port":4555}');
    expect(resolvePort(dir, {})).toBe(4555);
    expect(resolvePort(dir, { HEARTH_PORT: '4197' })).toBe(4197);
    expect(() => resolvePort(dir, { HEARTH_PORT: 'abc' })).toThrow(/HEARTH_PORT/);
    expect(() => resolvePort(dir, { HEARTH_PORT: '70000' })).toThrow(/HEARTH_PORT/);
    fs.rmSync(dir, { recursive: true });
  });
});
