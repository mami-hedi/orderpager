import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { config } from '../src/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { database, ...conn } = config.db;

const connection = await mysql.createConnection({ ...conn, multipleStatements: true });
await connection.query(
  `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
);
await connection.changeUser({ database });
await connection.query(fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8'));

// Migrations : colonnes ajoutées à `shops` après la première version
const shopColumns = [
  ['expires_at', 'DATE NULL DEFAULT NULL AFTER active'],
  ['owner_name', 'VARCHAR(120) NULL'],
  ['phone', 'VARCHAR(30) NULL'],
  ['email', 'VARCHAR(160) NULL'],
  ['monthly_price', 'DECIMAL(10,3) NULL'],
  ['notes', 'TEXT NULL'],
];

for (const [column, ddl] of shopColumns) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'shops' AND COLUMN_NAME = ?`,
    [database, column],
  );
  if (!rows[0].n) {
    await connection.query(`ALTER TABLE shops ADD COLUMN \`${column}\` ${ddl}`);
    console.log(`Migration appliquée : colonne shops.${column} ajoutée.`);
  }
}

await connection.end();
console.log(`Base "${database}" prête.`);
