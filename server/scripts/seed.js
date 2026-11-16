import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';

const [rows] = await pool.query('SELECT id FROM shops WHERE slug = ?', ['demo']);
if (rows.length) {
  console.log('Le restaurant "demo" existe déjà.');
} else {
  const hash = await bcrypt.hash('demo1234', 10);
  await pool.query('INSERT INTO shops (name, slug, password_hash) VALUES (?, ?, ?)', [
    'Café Démo',
    'demo',
    hash,
  ]);
  console.log('Restaurant créé : slug "demo", mot de passe "demo1234".');
}
await pool.end();
