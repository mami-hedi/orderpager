import { api } from './api.js';

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// À appeler directement dans le clic (geste utilisateur), avant tout await réseau :
// Safari/iOS refuse la demande de permission sinon.
export function requestPermission() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return Promise.resolve('unsupported');
  }
  return Notification.requestPermission();
}

export async function subscribeForOrder(publicId) {
  const { vapidPublicKey } = await api('/public/config');
  if (!vapidPublicKey) return false;

  // `ready` ne se résout jamais si le service worker n'est pas enregistré : on limite l'attente pour afficher une erreur
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => setTimeout(() => reject(new Error('service worker non prêt (rechargez la page)')), 10000)),
  ]);
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }
  await api(`/public/orders/${publicId}/push`, {
    method: 'POST',
    body: { subscription: sub.toJSON() },
  });
  return true;
}