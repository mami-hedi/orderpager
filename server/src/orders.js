import { randomUUID } from 'node:crypto';
import { pool } from './db.js';
import { today } from './util.js';
import { emitOrderUpdate, emitShopChanged, getTrackerCount } from './realtime.js';
import { sendReadyPush } from './push.js';

const SELECT_BY_NUMBER =
  'SELECT * FROM orders WHERE shop_id = ? AND order_number = ? AND business_date = ?';

export async function findOrCreateOrder(shopId, number) {
  const date = today();
  const [rows] = await pool.query(SELECT_BY_NUMBER, [shopId, number, date]);
  if (rows[0]) return rows[0];

  try {
    await pool.query(
      'INSERT INTO orders (public_id, shop_id, order_number, business_date) VALUES (?, ?, ?, ?)',
      [randomUUID(), shopId, number, date],
    );
  } catch (err) {
    if (err.code !== 'ER_DUP_ENTRY') throw err; // course entre deux requêtes : on relit
  }
  const [again] = await pool.query(SELECT_BY_NUMBER, [shopId, number, date]);
  return again[0];
}

// Un numéro déjà "récupéré" qui revient le même jour = nouvelle commande
export async function resetOrder(id) {
  await pool.query(
    `UPDATE orders
        SET status = 'pending', ready_at = NULL, picked_at = NULL,
            push_subscription = NULL, client_connected = 0
      WHERE id = ?`,
    [id],
  );
  const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);
  return rows[0];
}

// Le comptoir marque la commande prête (la crée si le client n'a pas encore scanné).
// Rappuyer sur "Prête" fait resonner le téléphone du client.
// Renvoie aussi `existed` (un client avait-il déjà saisi ce numéro ?) et `trackers`
// (combien de téléphones sont connectés) pour que le comptoir repère une faute de frappe.
export async function markReady(shop, number) {
  const [before] = await pool.query(SELECT_BY_NUMBER, [shop.id, number, today()]);
  const existed = before.length > 0 && before[0].status !== 'picked';
  const order = before[0] || (await findOrCreateOrder(shop.id, number));
  await pool.query(
    "UPDATE orders SET status = 'ready', ready_at = NOW(), picked_at = NULL WHERE id = ?",
    [order.id],
  );
  emitOrderUpdate(order.public_id, 'ready');
  emitShopChanged(shop.id);
  sendReadyPush(order, shop).catch((err) => console.error('[push]', err.message));
  return {
    id: order.id,
    orderNumber: order.order_number,
    status: 'ready',
    existed,
    trackers: getTrackerCount(order.public_id),
  };
}

// Annulation d'un "Prête" par erreur : la commande repasse en préparation
// et le téléphone du client arrête de sonner.
export async function markPending(order) {
  await pool.query("UPDATE orders SET status = 'pending', ready_at = NULL WHERE id = ?", [order.id]);
  emitOrderUpdate(order.public_id, 'pending');
  emitShopChanged(order.shop_id);
}

// Le client s'est trompé de numéro : on supprime sa commande en préparation,
// sauf si un autre téléphone suit le même numéro.
export async function cancelPending(order) {
  if (order.status !== 'pending' || getTrackerCount(order.public_id) > 1) return false;
  await pool.query("DELETE FROM orders WHERE id = ? AND status = 'pending'", [order.id]);
  emitShopChanged(order.shop_id);
  return true;
}

export async function markPicked(order) {
  await pool.query(
    "UPDATE orders SET status = 'picked', picked_at = NOW(), push_subscription = NULL WHERE id = ?",
    [order.id],
  );
  emitOrderUpdate(order.public_id, 'picked');
  emitShopChanged(order.shop_id);
}
