import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { config } from './config.js';
import { pool } from './db.js';
import { initRealtime } from './realtime.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import shopRoutes from './routes/shop.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const origins = config.clientOrigin.split(',').map((s) => s.trim());

const app = express();
app.set('trust proxy', 1); // derrière Render / un reverse proxy
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: origins }));
app.use(express.json({ limit: '10kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/admin', adminRoutes);
// Manifeste PWA par restaurant (icône « écran d'accueil »). Même logique que client/api/manifest.js (Vercel).
const SLUG_RE = /^[a-z0-9-]{1,60}$/;
const NUM_RE = /^[A-Za-z0-9-]{1,20}$/;
app.get('/api/manifest', (req, res) => {
  const { slug, n } = req.query;
  const ok = typeof slug === 'string' && SLUG_RE.test(slug);
  const start = ok ? `/s/${slug}${typeof n === 'string' && NUM_RE.test(n) ? `?n=${n}` : ''}` : '/';
  res.type('application/manifest+json').set('Cache-Control', 'no-store').send(
    JSON.stringify({
      id: ok ? `/s/${slug}` : '/',
      name: 'MH Bip',
      short_name: 'MH Bip',
      start_url: start,
      scope: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#0f766e',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      ],
    }),
  );
});

app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

// En production, le serveur peut servir directement le front compilé
const dist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(dist)) {
  // /assets : noms hachés par Vite, donc cache longue durée sans risque.
  // Le reste (index.html, sw.js) est toujours revalidé, sinon une mise à jour n'arrive jamais chez les clients.
  app.use('/assets', express.static(path.join(dist, 'assets'), { maxAge: '1y', immutable: true }));
  app.use('/assets', (req, res) => res.status(404).end());
  app.use(express.static(dist, { maxAge: 0 }));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'server_error' });
});

const server = http.createServer(app);
const io = initRealtime(server, origins);

// Nettoyage : on garde 3 jours d'historique (et on supprime les abonnements push avec)
async function cleanup() {
  try {
    await pool.query('DELETE FROM orders WHERE business_date < (CURDATE() - INTERVAL 3 DAY)');
  } catch (err) {
    console.error('cleanup', err.message);
  }
}
cleanup();
setInterval(cleanup, 6 * 60 * 60 * 1000).unref();

server.listen(config.port, () => {
  console.log(`API prête sur http://localhost:${config.port}`);
});

// Arrêt propre quand Docker redémarre ou met à jour le conteneur
function shutdown(signal) {
  console.log(`${signal} reçu : arrêt en cours…`);
  io.close(() => pool.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
