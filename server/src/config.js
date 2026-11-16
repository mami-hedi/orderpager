import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';

// En production, on refuse de démarrer avec des secrets absents, par défaut ou trop courts :
// un oubli ne doit jamais laisser /admin protégé par "admin" ou "change-me".
if (isProd) {
  const WEAK = new Set(['', 'admin', 'change-me', 'dev-secret-change-me', 'password']);
  const jwt = process.env.JWT_SECRET || '';
  const adminPwd = process.env.ADMIN_PASSWORD || '';
  if (WEAK.has(jwt) || jwt.length < 32) {
    throw new Error('JWT_SECRET manquant ou trop faible (32 caractères minimum). Générer avec : openssl rand -hex 32');
  }
  if (WEAK.has(adminPwd) || adminPwd.length < 10) {
    throw new Error('ADMIN_PASSWORD manquant ou trop faible (10 caractères minimum, pas de valeur par défaut)');
  }
}

export const config = {
  port: Number(process.env.PORT || 4000),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME || 'orderpager',
    // TiDB Cloud exige TLS : DB_SSL=true
    ...(process.env.DB_SSL === 'true' ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } } : {}),
  },
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:contact@example.com',
  },
  tz: process.env.TZ_BUSINESS || 'Africa/Tunis',
};
