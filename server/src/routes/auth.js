import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { pool } from '../db.js';
import { config } from '../config.js';
import { signShopToken, signAdminToken } from '../auth.js';
import { wrap, safeEqual, isExpired, slugify } from '../util.js';

const router = Router();

router.use(rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false }));

router.post(
  '/shop/login',
  wrap(async (req, res) => {
    // Le comptoir saisit le nom du restaurant ("Café de la Plage") ou son adresse ("cafe-de-la-plage")
    const typed = String(req.body?.slug || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const [rows] = await pool.query(
      'SELECT * FROM shops WHERE slug IN (?, ?) ORDER BY slug = ? DESC LIMIT 1',
      [typed, slugify(typed), typed],
    );
    const shop = rows[0];
    const ok = shop && (await bcrypt.compare(password, shop.password_hash));
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
    if (!shop.active) return res.status(403).json({ error: 'inactive' });
    if (isExpired(shop.expires_at)) return res.status(403).json({ error: 'expired' });
    res.json({ token: signShopToken(shop), shop: { name: shop.name, slug: shop.slug } });
  }),
);

router.post('/admin/login', (req, res) => {
  if (!safeEqual(req.body?.password ?? '', config.adminPassword)) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  res.json({ token: signAdminToken() });
});

export default router;
