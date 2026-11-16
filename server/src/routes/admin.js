import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { requireAdmin } from '../auth.js';
import {
  wrap,
  today,
  addDays,
  addMonths,
  daysLeft,
  computeExtension,
  isValidDate,
  csvCell,
  slugBase,
} from '../util.js';

const router = Router();
router.use(requireAdmin);

const METHOD_LABELS = {
  cash: 'Espèces',
  virement: 'Virement',
  d17: 'D17',
  flouci: 'Flouci',
  autre: 'Autre',
};
const METHODS = Object.keys(METHOD_LABELS);

// --- Helpers ---------------------------------------------------------------

// Adresse libre dérivée du nom : "cafe-plage", puis "cafe-plage-2", "cafe-plage-3"… si déjà prise.
// excludeId : ignorer le restaurant lui-même (cas d'un renommage).
async function uniqueSlug(name, excludeId = 0) {
  const base = slugBase(name);
  let candidate = base;
  for (let n = 2; n < 1000; n += 1) {
    const [rows] = await pool.query('SELECT id FROM shops WHERE slug = ? AND id <> ?', [
      candidate,
      excludeId,
    ]);
    if (!rows.length) return candidate;
    candidate = `${base.slice(0, 56)}-${n}`;
  }
  throw new Error('no_free_slug');
}

// Texte optionnel : undefined = non fourni, null = vidé
function optStr(value, max) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return String(value).trim().slice(0, max) || null;
}

// Prix : undefined = non fourni, null = vidé, NaN = invalide
function parsePrice(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100000 ? n : NaN;
}

const toNumber = (v) => (v === null || v === undefined ? null : Number(v));

const shopDto = (s) => ({
  id: s.id,
  name: s.name,
  slug: s.slug,
  active: Boolean(s.active),
  expiresAt: s.expires_at,
  daysLeft: daysLeft(s.expires_at),
  ownerName: s.owner_name,
  phone: s.phone,
  email: s.email,
  notes: s.notes,
  monthlyPrice: toNumber(s.monthly_price),
  createdAt: s.created_at,
  ...(s.total_paid !== undefined && {
    totalPaid: Number(s.total_paid),
    lastPaymentAt: s.last_payment_at,
    ordersToday: Number(s.orders_today),
  }),
});

const paymentDto = (p) => ({
  id: p.id,
  shopId: p.shop_id,
  shopName: p.shop_name,
  shopSlug: p.shop_slug,
  amount: Number(p.amount),
  method: p.method,
  paidAt: p.paid_at,
  months: p.months,
  periodStart: p.period_start,
  periodEnd: p.period_end,
  note: p.note,
  createdAt: p.created_at,
});

const PAYMENT_SELECT = `SELECT p.*, s.name AS shop_name, s.slug AS shop_slug
                          FROM payments p JOIN shops s ON s.id = p.shop_id`;

function paymentFilter(q) {
  const where = [];
  const params = [];
  const shopId = Number(q.shopId);
  if (Number.isInteger(shopId) && shopId > 0) {
    where.push('p.shop_id = ?');
    params.push(shopId);
  }
  if (METHODS.includes(q.method)) {
    where.push('p.method = ?');
    params.push(q.method);
  }
  if (isValidDate(q.from)) {
    where.push('p.paid_at >= ?');
    params.push(q.from);
  }
  if (isValidDate(q.to)) {
    where.push('p.paid_at <= ?');
    params.push(q.to);
  }
  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

// --- Tableau de bord -------------------------------------------------------

router.get(
  '/stats',
  wrap(async (req, res) => {
    const t = today();
    const monthKey = t.slice(0, 7);
    const monthStart = `${monthKey}-01`;

    const [[c]] = await pool.query(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(active = 1), 0) AS active_count,
              COALESCE(SUM(active = 1 AND expires_at IS NULL), 0) AS unlimited,
              COALESCE(SUM(active = 1 AND expires_at IS NOT NULL AND expires_at < ?), 0) AS expired,
              COALESCE(SUM(active = 1 AND expires_at IS NOT NULL AND expires_at >= ? AND expires_at <= ?), 0) AS expiring
         FROM shops`,
      [t, t, addDays(t, 7)],
    );

    const [[month]] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS n
         FROM payments WHERE DATE_FORMAT(paid_at, '%Y-%m') = ?`,
      [monthKey],
    );
    const [[all]] = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS n FROM payments',
    );

    // 12 derniers mois, y compris ceux sans paiement
    const startMonth = addMonths(monthStart, -11);
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(paid_at, '%Y-%m') AS ym, SUM(amount) AS total, COUNT(*) AS n
         FROM payments WHERE paid_at >= ? GROUP BY ym`,
      [startMonth],
    );
    const byMonth = new Map(rows.map((r) => [r.ym, r]));
    const months = [];
    for (let i = 11; i >= 0; i -= 1) {
      const ym = addMonths(monthStart, -i).slice(0, 7);
      const r = byMonth.get(ym);
      months.push({ month: ym, total: r ? Number(r.total) : 0, count: r ? Number(r.n) : 0 });
    }

    // Restaurants actifs expirés ou qui expirent dans les 7 jours
    const [renew] = await pool.query(
      `SELECT id, name, slug, owner_name, phone, expires_at, monthly_price
         FROM shops
        WHERE active = 1 AND expires_at IS NOT NULL AND expires_at <= ?
        ORDER BY expires_at ASC`,
      [addDays(t, 7)],
    );

    const [[orders]] = await pool.query(
      'SELECT COUNT(*) AS n FROM orders WHERE business_date = ?',
      [t],
    );

    res.json({
      counts: {
        total: Number(c.total),
        active: Number(c.active_count),
        suspended: Number(c.total) - Number(c.active_count),
        unlimited: Number(c.unlimited),
        expired: Number(c.expired),
        expiring: Number(c.expiring),
      },
      revenue: {
        month: Number(month.total),
        monthCount: Number(month.n),
        total: Number(all.total),
        totalCount: Number(all.n),
      },
      months,
      toRenew: renew.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        ownerName: s.owner_name,
        phone: s.phone,
        expiresAt: s.expires_at,
        daysLeft: daysLeft(s.expires_at),
        monthlyPrice: toNumber(s.monthly_price),
      })),
      ordersToday: Number(orders.n),
    });
  }),
);

// --- Restaurants -----------------------------------------------------------

router.get(
  '/shops',
  wrap(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT s.*,
              (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.shop_id = s.id) AS total_paid,
              (SELECT MAX(p.paid_at) FROM payments p WHERE p.shop_id = s.id) AS last_payment_at,
              (SELECT COUNT(*) FROM orders o WHERE o.shop_id = s.id AND o.business_date = ?) AS orders_today
         FROM shops s
        ORDER BY s.created_at DESC`,
      [today()],
    );
    res.json({ shops: rows.map(shopDto) });
  }),
);

router.post(
  '/shops',
  wrap(async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const password = String(req.body?.password || '');

    if (!name || name.length > 120) return res.status(400).json({ error: 'invalid_name' });
    if (password.length < 6) return res.status(400).json({ error: 'password_too_short' });

    // L'adresse vient du nom. Un `slug` explicite reste accepté (API), mais n'est plus demandé dans l'interface.
    const customSlug = String(req.body?.slug || '').trim().toLowerCase();
    if (customSlug && !/^[a-z0-9-]{2,60}$/.test(customSlug)) {
      return res.status(400).json({ error: 'invalid_slug' });
    }
    const slug = customSlug || (await uniqueSlug(name));

    // Essai gratuit : 7 jours par défaut ; 0 = abonnement sans limite
    const trialDays = req.body?.trialDays === undefined ? 10 : Number(req.body.trialDays);
    if (!Number.isInteger(trialDays) || trialDays < 0 || trialDays > 3650) {
      return res.status(400).json({ error: 'invalid_trial' });
    }
    const expiresAt = trialDays === 0 ? null : addDays(today(), trialDays);

    const monthlyPrice = parsePrice(req.body?.monthlyPrice);
    if (Number.isNaN(monthlyPrice)) return res.status(400).json({ error: 'invalid_price' });

    try {
      const hash = await bcrypt.hash(password, 10);
      const [result] = await pool.query(
        `INSERT INTO shops (name, slug, password_hash, expires_at, owner_name, phone, email, monthly_price, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          slug,
          hash,
          expiresAt,
          optStr(req.body?.ownerName, 120) ?? null,
          optStr(req.body?.phone, 30) ?? null,
          optStr(req.body?.email, 160) ?? null,
          monthlyPrice ?? null,
          optStr(req.body?.notes, 2000) ?? null,
        ],
      );
      res.status(201).json({ id: result.insertId, name, slug, active: true, expiresAt });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'slug_taken' });
      throw err;
    }
  }),
);

// Fiche complète : infos + historique des paiements
router.get(
  '/shops/:id',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const [rows] = await pool.query('SELECT * FROM shops WHERE id = ?', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'shop_not_found' });
    const [payments] = await pool.query(
      `${PAYMENT_SELECT} WHERE p.shop_id = ? ORDER BY p.paid_at DESC, p.id DESC`,
      [id],
    );
    const [[orders]] = await pool.query(
      'SELECT COUNT(*) AS n FROM orders WHERE shop_id = ? AND business_date = ?',
      [id, today()],
    );
    res.json({
      shop: { ...shopDto(rows[0]), ordersToday: Number(orders.n) },
      payments: payments.map(paymentDto),
    });
  }),
);

router.patch(
  '/shops/:id',
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const fields = [];
    const values = [];

    if (typeof req.body?.active === 'boolean') {
      fields.push('active = ?');
      values.push(req.body.active ? 1 : 0);
    }
    let newName = null;
    if (typeof req.body?.name === 'string' && req.body.name.trim()) {
      newName = req.body.name.trim().slice(0, 120);
      fields.push('name = ?');
      values.push(newName);
    }

    // Met à jour l'adresse de la page client d'après le nom (à la demande : l'ancien QR imprimé cesse de marcher)
    let newSlug = null;
    if (req.body?.regenerateSlug === true) {
      const [cur] = await pool.query('SELECT name FROM shops WHERE id = ?', [id]);
      if (!cur[0]) return res.status(404).json({ error: 'shop_not_found' });
      newSlug = await uniqueSlug(newName || cur[0].name, id);
      fields.push('slug = ?');
      values.push(newSlug);
    }
    if (typeof req.body?.password === 'string') {
      if (req.body.password.length < 6) return res.status(400).json({ error: 'password_too_short' });
      fields.push('password_hash = ?');
      values.push(await bcrypt.hash(req.body.password, 10));
    }
    if (req.body?.expiresAt !== undefined) {
      const v = req.body.expiresAt;
      if (v !== null && !isValidDate(v)) return res.status(400).json({ error: 'invalid_date' });
      fields.push('expires_at = ?');
      values.push(v);
    }

    // Colonnes texte : les noms viennent de cette liste fixe, jamais de la requête
    const textFields = {
      ownerName: ['owner_name', 120],
      phone: ['phone', 30],
      email: ['email', 160],
      notes: ['notes', 2000],
    };
    for (const [key, [column, max]] of Object.entries(textFields)) {
      const v = optStr(req.body?.[key], max);
      if (v !== undefined) {
        fields.push(`${column} = ?`);
        values.push(v);
      }
    }

    const price = parsePrice(req.body?.monthlyPrice);
    if (Number.isNaN(price)) return res.status(400).json({ error: 'invalid_price' });
    if (price !== undefined) {
      fields.push('monthly_price = ?');
      values.push(price);
    }

    if (!fields.length) return res.status(400).json({ error: 'nothing_to_update' });

    try {
      const [result] = await pool.query(`UPDATE shops SET ${fields.join(', ')} WHERE id = ?`, [
        ...values,
        id,
      ]);
      if (!result.affectedRows) return res.status(404).json({ error: 'shop_not_found' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'slug_taken' });
      throw err;
    }
    res.json({ ok: true, slug: newSlug });
  }),
);

// Prolongation sans paiement (cadeau, geste commercial)
router.post(
  '/shops/:id/extend',
  wrap(async (req, res) => {
    const months = Number(req.body?.months);
    if (!Number.isInteger(months) || months < 1 || months > 36) {
      return res.status(400).json({ error: 'invalid_months' });
    }
    const [rows] = await pool.query('SELECT id, expires_at FROM shops WHERE id = ?', [
      Number(req.params.id),
    ]);
    const shop = rows[0];
    if (!shop) return res.status(404).json({ error: 'shop_not_found' });

    const { newExpiry } = computeExtension(shop.expires_at, months);
    await pool.query('UPDATE shops SET expires_at = ? WHERE id = ?', [newExpiry, shop.id]);
    res.json({ expiresAt: newExpiry, daysLeft: daysLeft(newExpiry) });
  }),
);

// --- Paiements -------------------------------------------------------------

// Enregistre un paiement et, si `months` > 0, prolonge l'abonnement dans la même transaction
router.post(
  '/shops/:id/payments',
  wrap(async (req, res) => {
    const amount = Number(req.body?.amount);
    if (req.body?.amount === '' || !Number.isFinite(amount) || amount < 0 || amount > 1_000_000) {
      return res.status(400).json({ error: 'invalid_amount' });
    }
    const method = req.body?.method ?? 'cash';
    if (!METHODS.includes(method)) return res.status(400).json({ error: 'invalid_method' });

    const paidAt = req.body?.paidAt ?? today();
    if (!isValidDate(paidAt)) return res.status(400).json({ error: 'invalid_date' });

    const months = req.body?.months === undefined ? 0 : Number(req.body.months);
    if (!Number.isInteger(months) || months < 0 || months > 36) {
      return res.status(400).json({ error: 'invalid_months' });
    }
    const note = optStr(req.body?.note, 255) ?? null;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query('SELECT id, expires_at FROM shops WHERE id = ? FOR UPDATE', [
        Number(req.params.id),
      ]);
      const shop = rows[0];
      if (!shop) {
        await conn.rollback();
        return res.status(404).json({ error: 'shop_not_found' });
      }

      let expiresAt = shop.expires_at;
      let periodStart = null;
      let periodEnd = null;
      if (months > 0) {
        const ext = computeExtension(shop.expires_at, months);
        periodStart = ext.periodStart;
        periodEnd = ext.newExpiry;
        expiresAt = ext.newExpiry;
        await conn.query('UPDATE shops SET expires_at = ? WHERE id = ?', [expiresAt, shop.id]);
      }

      const [result] = await conn.query(
        `INSERT INTO payments (shop_id, amount, method, paid_at, months, period_start, period_end, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [shop.id, amount, method, paidAt, months, periodStart, periodEnd, note],
      );
      await conn.commit();
      res.status(201).json({ id: result.insertId, expiresAt, daysLeft: daysLeft(expiresAt) });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }),
);

// Registre global, filtrable (restaurant, méthode, période)
router.get(
  '/payments',
  wrap(async (req, res) => {
    const { where, params } = paymentFilter(req.query);
    const [rows] = await pool.query(
      `${PAYMENT_SELECT} ${where} ORDER BY p.paid_at DESC, p.id DESC LIMIT 1000`,
      params,
    );
    const [[sum]] = await pool.query(
      `SELECT COALESCE(SUM(p.amount), 0) AS total, COUNT(*) AS n FROM payments p ${where}`,
      params,
    );
    res.json({
      payments: rows.map(paymentDto),
      total: Number(sum.total),
      count: Number(sum.n),
    });
  }),
);

// Export CSV (séparateur ;, virgule décimale, BOM UTF-8 : s'ouvre directement dans Excel)
router.get(
  '/payments/export',
  wrap(async (req, res) => {
    const { where, params } = paymentFilter(req.query);
    const [rows] = await pool.query(
      `${PAYMENT_SELECT} ${where} ORDER BY p.paid_at ASC, p.id ASC`,
      params,
    );
    const header = [
      'Date',
      'Restaurant',
      'Identifiant',
      'Montant (DT)',
      'Méthode',
      'Mois ajoutés',
      'Période du',
      'Période au',
      'Note',
    ];
    const lines = [header.map(csvCell).join(';')];
    for (const p of rows) {
      lines.push(
        [
          p.paid_at,
          p.shop_name,
          p.shop_slug,
          Number(p.amount).toFixed(3).replace('.', ','),
          METHOD_LABELS[p.method],
          p.months,
          p.period_start,
          p.period_end,
          p.note,
        ]
          .map(csvCell)
          .join(';'),
      );
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="paiements-${today()}.csv"`);
    res.send(`﻿${lines.join('\r\n')}\r\n`);
  }),
);

// Corriger une erreur de saisie. N'ajuste pas l'abonnement : modifier la date sur la fiche si besoin.
router.delete(
  '/payments/:id',
  wrap(async (req, res) => {
    const [result] = await pool.query('DELETE FROM payments WHERE id = ?', [Number(req.params.id)]);
    if (!result.affectedRows) return res.status(404).json({ error: 'payment_not_found' });
    res.json({ ok: true });
  }),
);

export default router;
