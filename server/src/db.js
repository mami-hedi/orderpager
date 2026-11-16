import mysql from 'mysql2/promise';
import { config } from './config.js';

export const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  connectionLimit: 10,
    enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  dateStrings: true, // DATE/TIMESTAMP renvoyés en chaînes, sans conversion de fuseau
});
