import { Server } from 'socket.io';
import { pool } from './db.js';
import { verifyToken } from './auth.js';

let io = null;
const clientCounts = new Map(); // publicId -> nombre de sockets ouverts

export function initRealtime(httpServer, origins) {
  io = new Server(httpServer, { cors: { origin: origins } });

  io.on('connection', (socket) => {
    const { role, publicId, token } = socket.handshake.auth || {};

    if (role === 'shop') {
      const payload = verifyToken(token);
      if (!payload || payload.role !== 'shop') {
        socket.emit('auth_error');
        socket.disconnect(true);
        return;
      }
      socket.join(`shop:${payload.shopId}`);
      return;
    }

    if (role === 'client' && typeof publicId === 'string' && publicId.length === 36) {
      socket.join(`order:${publicId}`);
      const n = (clientCounts.get(publicId) || 0) + 1;
      clientCounts.set(publicId, n);
      if (n === 1) setConnected(publicId, 1);

      socket.on('disconnect', () => {
        const left = (clientCounts.get(publicId) || 1) - 1;
        if (left <= 0) {
          clientCounts.delete(publicId);
          setConnected(publicId, 0);
        } else {
          clientCounts.set(publicId, left);
        }
      });
      return;
    }

    socket.disconnect(true);
  });

  return io;
}

async function setConnected(publicId, value) {
  try {
    const [rows] = await pool.query(
      'SELECT id, shop_id, client_connected FROM orders WHERE public_id = ?',
      [publicId],
    );
    const o = rows[0];
    if (!o || o.client_connected === value) return;
    await pool.query('UPDATE orders SET client_connected = ? WHERE id = ?', [value, o.id]);
    emitShopChanged(o.shop_id);
  } catch (err) {
    console.error('setConnected', err.message);
  }
}

// Nombre de téléphones actuellement connectés pour une commande
export const getTrackerCount = (publicId) => clientCounts.get(publicId) || 0;

export const emitOrderUpdate = (publicId, status) =>
  io?.to(`order:${publicId}`).emit('order:update', { publicId, status });

export const emitShopChanged = (shopId) =>
  io?.to(`shop:${shopId}`).emit('orders:changed');
