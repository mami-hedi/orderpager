import crypto from 'node:crypto';
import { config } from './config.js';

// Permet d'utiliser des handlers async dans Express 4
export const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Date du jour (YYYY-MM-DD) dans le fuseau du commerce
export const today = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: config.tz });

// "Café de la Plage" -> "cafe-de-la-plage" (adresse de la page client, générée depuis le nom)
export function slugify(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

// Adresse de base valide (2 à 60 caractères). Un nom sans lettres latines (ex. en arabe) donne "resto".
export function slugBase(name) {
  const s = slugify(name);
  if (s.length >= 2) return s;
  return s ? `${s}-resto` : 'resto';
}

// --- Dates (chaînes YYYY-MM-DD, calculées en UTC pour éviter les décalages) ---
export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Ajoute des mois en gardant le jour, plafonné au dernier jour du mois (31 janv. + 1 mois = 28/29 févr.)
export function addMonths(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

// Prolongation d'un abonnement : part de la fin actuelle si elle est encore valide,
// sinon d'aujourd'hui. periodStart = premier jour couvert par la prolongation.
export function computeExtension(expiresAt, months, now = today()) {
  const stillValid = Boolean(expiresAt) && expiresAt >= now;
  return {
    periodStart: stillValid ? addDays(expiresAt, 1) : now,
    newExpiry: addMonths(stillValid ? expiresAt : now, months),
  };
}

// Valide une date YYYY-MM-DD réelle (refuse 2026-13-45)
export function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Cellule CSV (séparateur ;) avec protection contre l'injection de formules Excel
export function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Abonnement expiré ? expires_at est le dernier jour d'accès (inclus). NULL = sans limite.
export const isExpired = (expiresAt) => Boolean(expiresAt) && expiresAt < today();

export const daysLeft = (expiresAt) =>
  expiresAt
    ? Math.round((Date.parse(`${expiresAt}T00:00:00Z`) - Date.parse(`${today()}T00:00:00Z`)) / 86_400_000)
    : null;

// Normalise un numéro de ticket : espaces, #, majuscules, chiffres arabes -> latins
export function normalizeNumber(value) {
  const s = String(value ?? '')
    .trim()
    .replace(/^#/, '')
    .toUpperCase()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  return /^[A-Z0-9-]{1,20}$/.test(s) ? s : null;
}

// Comparaison de mots de passe en temps constant
export function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Évite que le serveur envoie des requêtes vers des adresses internes (SSRF)
export function isSafePushEndpoint(endpoint) {
  try {
    const u = new URL(endpoint);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname;
    if (host === 'localhost' || host.endsWith('.local')) return false;
    if (/^[0-9.]+$/.test(host) || host.includes(':')) return false; // IP littérale
    return true;
  } catch {
    return false;
  }
}
