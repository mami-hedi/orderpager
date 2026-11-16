import { Router } from 'express';
import { pool } from '../db.js';
import { requireShop } from '../auth.js';
import { wrap, today, normalizeNumber, daysLeft } from '../util.js';
import { markReady, markPicked, markPending } from '../orders.js';
import { getTrackerCount } from '../realtime.js';

const router = Router();
router.use(requireShop);

router.get('/me', (req, res) => {
  res.json({
    name: req.shop.name,
    slug: req.shop.slug,
    expiresAt: req.shop.expires_at,
    daysLeft: daysLeft(req.shop.expires_at),
  });
});

// Commandes du jour encore à traiter : en préparation d'abord, puis prêtes
router.get(
  '/orders',
  wrap(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT id, public_id, order_number, status, client_connected, created_at, ready_at
         FROM orders
        WHERE shop_id = ? AND business_date = ? AND status IN ('pending','ready')
        ORDER BY (status = 'ready') ASC, created_at ASC, id ASC`,
      [req.shop.id, today()],
    );
    res.json({
      orders: rows.map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        status: o.status,
        clientConnected: Boolean(o.client_connected),
        trackers: getTrackerCount(o.public_id), // > 1 : deux téléphones suivent le même numéro
      })),
    });
  }),
);

// Marquer prête par numéro (le client n'a pas forcément encore scanné)
router.post(
  '/orders/ready',
  wrap(async (req, res) => {
    const number = normalizeNumber(req.body?.orderNumber);
    if (!number) return res.status(400).json({ error: 'invalid_number' });
    res.json(await markReady(req.shop, number));
  }),
);

async function ownOrder(req, res) {
  const [rows] = await pool.query('SELECT * FROM orders WHERE id = ? AND shop_id = ?', [
    Number(req.params.id),
    req.shop.id,
  ]);
  if (!rows[0]) {
    res.status(404).json({ error: 'order_not_found' });
    return null;
  }
  return rows[0];
}

// Prête (ou "Rappeler" si déjà prête : le téléphone resonne)
router.post(
  '/orders/:id/ready',
  wrap(async (req, res) => {
    const order = await ownOrder(req, res);
    if (!order) return;
    res.json(await markReady(req.shop, order.order_number));
  }),
);

// "Prête" appuyé par erreur : remet la commande en préparation
router.post(
  '/orders/:id/unready',
  wrap(async (req, res) => {
    const order = await ownOrder(req, res);
    if (!order) return;
    await markPending(order);
    res.json({ ok: true });
  }),
);

// Récupérée / retirée de la liste
router.post(
  '/orders/:id/picked',
  wrap(async (req, res) => {
    const order = await ownOrder(req, res);
    if (!order) return;
    await markPicked(order);
    res.json({ ok: true });
  }),
);

export default router;
