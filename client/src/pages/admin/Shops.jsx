import { useCallback, useEffect, useMemo, useState } from 'react';
import { fmtDT, fmtDate, statusOf, expiryText, errorText, slugify } from './format.js';

const FILTERS = [
  ['all', 'Tous'],
  ['ok', 'Actifs'],
  ['expiring', 'Expirent bientôt'],
  ['expired', 'Expirés'],
  ['suspended', 'Suspendus'],
];

const EMPTY_FORM = {
  name: '',
  password: '',
  ownerName: '',
  phone: '',
  monthlyPrice: '',
  trialDays: 10,
};

function matchesFilter(shop, filter) {
  const key = statusOf(shop).key;
  if (filter === 'all') return true;
  if (filter === 'ok') return key === 'ok' || key === 'unlimited' || key === 'expiring';
  return key === filter;
}

export default function Shops({ call, onOpen }) {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('expiry');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setShops((await call('/admin/shops')).shops);
    } catch {
      // 401 géré par useAdminApi
    }
    setLoading(false);
  }, [call]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = shops.filter((s) => {
      if (!matchesFilter(s, filter)) return false;
      if (!needle) return true;
      return [s.name, s.slug, s.ownerName, s.phone].some((v) => v && v.toLowerCase().includes(needle));
    });
    list.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'fr');
      if (sort === 'created') return b.createdAt.localeCompare(a.createdAt);
      // échéance la plus proche d'abord ; "sans limite" à la fin
      if (a.expiresAt === b.expiresAt) return 0;
      if (a.expiresAt === null) return 1;
      if (b.expiresAt === null) return -1;
      return a.expiresAt.localeCompare(b.expiresAt);
    });
    return list;
  }, [shops, q, filter, sort]);

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map(([key]) => [key, shops.filter((s) => matchesFilter(s, key)).length])),
    [shops],
  );

  async function create(e) {
    e.preventDefault();
    setError('');
    try {
      await call('/admin/shops', {
        method: 'POST',
        body: {
          name: form.name,
          password: form.password,
          ownerName: form.ownerName,
          phone: form.phone,
          monthlyPrice: form.monthlyPrice === '' ? null : Number(form.monthlyPrice),
          trialDays: Number(form.trialDays),
        },
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <>
      <div className="row between wrap">
        <h2 className="flush">Restaurants ({shops.length})</h2>
        <button className="btn small" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Fermer' : '+ Nouveau restaurant'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="card form-grid">
          <label>
            Nom du restaurant *
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <span className="muted small-text">
              Adresse de la page client : /s/{slugify(form.name) || '…'}{' '}
              (un numéro est ajouté si ce nom existe déjà)
            </span>
          </label>
          <label>
            Mot de passe du comptoir *
            <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </label>
          <label>
            Gérant
            <input className="input" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
          </label>
          <label>
            Téléphone
            <input className="input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label>
            Prix mensuel (DT)
            <input className="input" type="number" min="0" step="0.001" value={form.monthlyPrice} onChange={(e) => setForm({ ...form, monthlyPrice: e.target.value })} />
          </label>
          <label>
            Essai gratuit (jours, 0 = sans limite)
            <input className="input" type="number" min="0" max="3650" value={form.trialDays} onChange={(e) => setForm({ ...form, trialDays: e.target.value })} />
          </label>
          {error && <p className="error full">{error}</p>}
          <div className="full">
            <button className="btn">Créer le restaurant</button>
          </div>
        </form>
      )}

      <div className="toolbar">
        <input
          className="input search"
          type="search"
          placeholder="Rechercher (nom, identifiant, gérant, téléphone)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="expiry">Tri : échéance</option>
          <option value="name">Tri : nom</option>
          <option value="created">Tri : plus récents</option>
        </select>
      </div>
      <div className="chips">
        {FILTERS.map(([key, label]) => (
          <button key={key} className={`chip ${filter === key ? 'on' : ''}`} onClick={() => setFilter(key)}>
            {label} ({counts[key]})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="muted">Chargement…</p>
      ) : visible.length ? (
        <div className="table-wrap">
          <table className="table clickable">
            <thead>
              <tr>
                <th>Restaurant</th>
                <th>Statut</th>
                <th>Échéance</th>
                <th>Dernier paiement</th>
                <th>Total encaissé</th>
                <th>Cmd. aujourd'hui</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => {
                const st = statusOf(s);
                return (
                  <tr key={s.id} onClick={() => onOpen(s.id)}>
                    <td>
                      <strong>{s.name}</strong>
                      <div className="muted small-text">
                        /s/{s.slug}
                        {s.ownerName ? ` · ${s.ownerName}` : ''}
                      </div>
                    </td>
                    <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                    <td>{expiryText(s)}</td>
                    <td>{fmtDate(s.lastPaymentAt)}</td>
                    <td>{s.totalPaid ? fmtDT(s.totalPaid) : '—'}</td>
                    <td>{s.ordersToday}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">Aucun restaurant ne correspond.</p>
      )}
    </>
  );
}
