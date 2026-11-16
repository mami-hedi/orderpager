import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { pool } from './db.js';
import { wrap, isExpired } from './util.js';

export const signShopToken = (shop) =>
  jwt.sign({ role: 'shop', shopId: shop.id }, config.jwtSecret, { expiresIn: '30d' });

export const signAdminToken = () =>
  jwt.sign({ role: 'admin' }, config.jwtSecret, { expiresIn: '12h' });

export function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? verifyToken(h.slice(7)) : null;
}

export const requireShop = wrap(async (req, res, next) => {
  const payload = bearer(req);
  if (!payload || payload.role !== 'shop') {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const [rows] = await pool.query(
    'SELECT id, name, slug, active, expires_at FROM shops WHERE id = ?',
    [payload.shopId],
  );
  const shop = rows[0];
  if (!shop) return res.status(401).json({ error: 'unauthorized' });
  if (!shop.active) return res.status(403).json({ error: 'inactive' });
  if (isExpired(shop.expires_at)) return res.status(403).json({ error: 'expired' });
  req.shop = shop;
  next();
});

export function requireAdmin(req, res, next) {
  const payload = bearer(req);
  if (!payload || payload.role !== 'admin') {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}
