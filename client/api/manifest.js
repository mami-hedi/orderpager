// Manifeste PWA dynamique (fonction Vercel) : une icône « écran d'accueil » par restaurant,
// qui rouvre /s/<slug>?n=<numéro>. Doit rester identique à la route /api/manifest du serveur Express.
const SLUG_RE = /^[a-z0-9-]{1,60}$/;
const NUM_RE = /^[A-Za-z0-9-]{1,20}$/;

export function buildManifest(slug, n) {
  const ok = typeof slug === 'string' && SLUG_RE.test(slug);
  const start = ok ? `/s/${slug}${typeof n === 'string' && NUM_RE.test(n) ? `?n=${n}` : ''}` : '/';
  return {
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
  };
}

export default function handler(req, res) {
  const q = req.query || {};
  const one = (v) => (Array.isArray(v) ? v[0] : v);
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(JSON.stringify(buildManifest(one(q.slug), one(q.n))));
}
