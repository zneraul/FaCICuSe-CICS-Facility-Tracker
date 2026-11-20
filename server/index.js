import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './infrastructure/config.js';
import { buildApplicationContainer } from './infrastructure/container.js';
import { ensureFacilityCatalog } from './adapters/outbound/seedService.js';
import { verifyDatabaseConnection } from '../src/db/index.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

export async function startServer() {
  const config = loadConfig();

  if (config.storageMode === 'postgres') {
    await verifyDatabaseConnection();
    await ensureFacilityCatalog();
  } else {
    console.warn(
      '[FaCICuSe] Development mode: PostgreSQL environment variables are not configured. Using local JSON store for non-production development only.'
    );
  }

  const app = express();
  app.set('trust proxy', 1);

  app.use(express.json({ limit: '2mb' }));

  const allowedOrigin = config.appUrl;
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && origin === allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    }
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  const { apiRouter } = buildApplicationContainer(config);
  app.use('/api', apiRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  const publicHtmlDir = path.join(rootDir, 'client/public');
  app.use('/assets', express.static(path.join(publicHtmlDir, 'assets')));

  if (!config.isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: rootDir,
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(rootDir, 'dist');

    // Match Vercel's production routing: the public root uses the long-form
    // standalone landing page, while all other client routes use the React SPA.
    app.get('/', (_req, res) => {
      res.sendFile(path.join(distDir, 'landing.html'));
    });

    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`FaCICuSe server listening on http://0.0.0.0:${config.port}`);
  });

  return { app, server };
}
