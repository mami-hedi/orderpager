import webpush from 'web-push';
import { config } from './config.js';
import { pool } from './db.js';

const { publicKey, privateKey, subject } = config.vapid;
export const pushEnabled = Boolean(publicKey && privateKey);

if (pushEnabled) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
} else {
  console.warn('[push] VAPID non configuré : notifications push désactivées (le temps réel et la sonnerie dans la page fonctionnent quand même).');
}

export async function sendReadyPush(order, shop) {
  if (!pushEnabled) return console.log('[push] ignoré : VAPID non configuré');
  if (!order.push_subscription) return console.log(`[push] ignoré : pas d'abonnement pour la commande ${order.order_number}`);
  const sub =
    typeof order.push_subscription === 'string'
      ? JSON.parse(order.push_subscription)
      : order.push_subscription;

  const payload = JSON.stringify({
    title: `${shop.name} — ${order.order_number}`,
    body: 'Votre commande est prête • طلبك جاهز',
    url: `/s/${shop.slug}`,
  });

  try {
    const r = await webpush.sendNotification(sub, payload, { TTL: 600, urgency: 'high' });
    console.log(`[push] envoyé commande ${order.order_number} → ${new URL(sub.endpoint).host} (HTTP ${r.statusCode})`);
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      await pool.query('UPDATE orders SET push_subscription = NULL WHERE id = ?', [order.id]);
    } else {
      console.error('[push]', err.statusCode || '', err.message);
    }
  }
}