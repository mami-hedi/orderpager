export const METHOD_LABELS = {
  cash: 'Espèces',
  virement: 'Virement',
  d17: 'D17',
  flouci: 'Flouci',
  autre: 'Autre',
};

export const fmtDT = (n) =>
  `${Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DT`;

// 2026-11-26 -> 26/11/2026
export const fmtDate = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');

export const todayISO = () => new Date().toLocaleDateString('en-CA');

export const monthLabel = (ym) => {
  const [y, m] = ym.split('-');
  return `${m}/${y}`;
};

// Statut global d'un restaurant, à partir de `active`, `expiresAt` et `daysLeft`
export function statusOf(shop) {
  if (!shop.active) return { key: 'suspended', label: 'Suspendu', cls: 'off' };
  if (shop.expiresAt === null) return { key: 'unlimited', label: 'Sans limite', cls: 'ok' };
  if (shop.daysLeft < 0) return { key: 'expired', label: 'Expiré', cls: 'off' };
  if (shop.daysLeft <= 7) return { key: 'expiring', label: `Expire J-${shop.daysLeft}`, cls: 'warn' };
  return { key: 'ok', label: 'Actif', cls: 'ok' };
}

export function expiryText(shop) {
  if (shop.expiresAt === null) return 'Sans limite';
  const d = shop.daysLeft;
  if (d < 0) return `${fmtDate(shop.expiresAt)} (expiré depuis ${-d} j)`;
  if (d === 0) return `${fmtDate(shop.expiresAt)} (aujourd'hui)`;
  return `${fmtDate(shop.expiresAt)} (dans ${d} j)`;
}

export function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

const ERRORS = {
  invalid_slug: 'Identifiant invalide (2 à 60 caractères : a-z, 0-9, tiret).',
  invalid_name: 'Nom invalide.',
  password_too_short: 'Mot de passe : 6 caractères minimum.',
  slug_taken: 'Cet identifiant est déjà utilisé.',
  invalid_trial: "Durée d'essai invalide (0 à 3650 jours).",
  invalid_date: 'Date invalide.',
  invalid_price: 'Prix invalide.',
  invalid_amount: 'Montant invalide.',
  invalid_method: 'Méthode de paiement invalide.',
  invalid_months: 'Nombre de mois invalide.',
  shop_not_found: 'Restaurant introuvable.',
  payment_not_found: 'Paiement introuvable.',
};

export const errorText = (err) => ERRORS[err?.message] || 'Une erreur est survenue.';
