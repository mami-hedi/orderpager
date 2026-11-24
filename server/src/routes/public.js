import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { pool } from '../db.js';
import { config } from '../config.js';
import { wrap, today, normalizeNumber, isSafePushEndpoint, slugify } from '../util.js';
import { findOrCreateOrder, resetOrder, markPicked, cancelPending } from '../orders.js';
import { emitShopChanged } from '../realtime.js';

const router = Router();

router.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));

// Plus strict pour la saisie de numéros : évite qu'un script crée des centaines de fausses commandes
const trackLimiter = rateLimit({ windowMs: 60_000, limit: 15, standardHeaders: true, legacyHeaders: false });

async function getActiveShop(slug) {
  // Un restaurant suspendu ou dont l'abonnement est expiré n'est plus joignable par les clients
  // L'adresse peut aussi être tapée avec des espaces ou des accents ("/s/Café de la Plage")
  const typed = String(slug).toLowerCase();
  const [rows] = await pool.query(
    `SELECT id, name, slug FROM shops
      WHERE slug IN (?, ?) AND active = 1 AND (expires_at IS NULL OR expires_at >= ?)
      ORDER BY slug = ? DESC LIMIT 1`,
    [typed, slugify(typed), today(), typed],
  );
  return rows[0] || null;
}

async function getTodayOrder(publicId) {
  const [rows] = await pool.query(
    `SELECT o.*, s.name AS shop_name, s.slug AS shop_slug
       FROM orders o JOIN shops s ON s.id = o.shop_id
      WHERE o.public_id = ?`,
    [publicId],
  );
  const o = rows[0];
  return o && o.business_date === today() ? o : null;
}

router.get('/config', (req, res) => {
  res.json({ vapidPublicKey: config.vapid.publicKey || null });
});

router.get(
  '/shops/:slug',
  wrap(async (req, res) => {
    const shop = await getActiveShop(req.params.slug);
    if (!shop) return res.status(404).json({ error: 'shop_not_found' });
    res.json({ name: shop.name, slug: shop.slug });
  }),
);

// Le client saisit son numéro de ticket : on crée (ou retrouve) la commande
router.post(
  '/shops/:slug/track',
  trackLimiter,
  wrap(async (req, res) => {
    const shop = await getActiveShop(req.params.slug);
    if (!shop) return res.status(404).json({ error: 'shop_not_found' });

    const number = normalizeNumber(req.body?.orderNumber);
    if (!number) return res.status(400).json({ error: 'invalid_number' });

    let order = await findOrCreateOrder(shop.id, number);
    if (order.status === 'picked') order = await resetOrder(order.id);
    emitShopChanged(shop.id);

    res.json({ publicId: order.public_id, orderNumber: order.order_number, status: order.status });
  }),
);

router.get(
  '/orders/:publicId',
  wrap(async (req, res) => {
    const o = await getTodayOrder(req.params.publicId);
    if (!o) return res.status(404).json({ error: 'order_not_found' });
    res.json({ orderNumber: o.order_number, status: o.status, shopName: o.shop_name });
  }),
);

router.post(
  '/orders/:publicId/push',
  wrap(async (req, res) => {
    const o = await getTodayOrder(req.params.publicId);
    if (!o) return res.status(404).json({ error: 'order_not_found' });

    const sub = req.body?.subscription;
    const valid =
      sub &&
      typeof sub.endpoint === 'string' &&
      isSafePushEndpoint(sub.endpoint) &&
      typeof sub.keys?.p256dh === 'string' &&
      typeof sub.keys?.auth === 'string';
    if (!valid) return res.status(400).json({ error: 'invalid_subscription' });

    await pool.query('UPDATE orders SET push_subscription = ? WHERE id = ?', [
      JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }),
      o.id,
    ]);
    console.log(`[push] abonnement enregistré (commande ${o.id}, ${new URL(sub.endpoint).host})`);
    res.json({ ok: true });
  }),
);

// Le client corrige son numéro : on retire sa commande en préparation
router.post(
  '/orders/:publicId/cancel',
  wrap(async (req, res) => {
    const o = await getTodayOrder(req.params.publicId);
    if (o) await cancelPending(o);
    res.json({ ok: true });
  }),
);

// Le client confirme qu'il a récupéré sa commande
router.post(
  '/orders/:publicId/picked',
  wrap(async (req, res) => {
    const o = await getTodayOrder(req.params.publicId);
    if (!o) return res.status(404).json({ error: 'order_not_found' });
    await markPicked(o);
    res.json({ ok: true });
  }),
);

export default router;