import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiRouter } from './routes/index.js';
import { errorHandler, hostGuard } from './http.js';
import { PHOTO_NAME } from './services/photos.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function createApp(ctx, { onShutdown = () => {} } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); next(); });
  app.use(['/api', '/photos'], hostGuard);
  app.use(express.json({ limit: '2mb' }));
  // Serve only files named the way the app saves them, so nothing else in the folder (like _trash) is reachable.
  app.use('/photos', (req, res, next) => (PHOTO_NAME.test(req.path.slice(1)) ? next() : res.sendStatus(404)));
  app.use('/photos', express.static(path.join(ctx.config.dataDir, 'photos'), { maxAge: '7d' }));
  app.use('/photos', (req, res) => res.sendStatus(404));
  app.use('/api', apiRouter(ctx, { onShutdown }));
  const dist = path.join(ROOT, 'client', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^\/(?!api\/|photos\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.use(errorHandler);
  return app;
}
