import { useEffect, useMemo, useState } from 'react';
import { apiBlob } from '../../api.js';
import { METHOD_LABELS, fmtDT, fmtDate, todayISO, errorText } from './format.js';
import { useIsMobile } from './useIsMobile.js';

export default function Payments({ call, token, onOpenShop }) {
  const [shops, setShops] = useState([]);
  const [filters, setFilters] = useState({ shopId: '', method: '', from: '', to: '' });
  const [data, setData] = useState({ payments: [], total: 0, count: 0 });
  const [error, setError] = useState('');
  const isMobile = useIsMobile();
  const [showFilters, setShowFilters] = useState(false);
  const activeFilters = Object.values(filters).filter(Boolean).length;

  useEffect(() => {
    call('/admin/shops').then((d) => setShops(d.shops)).catch(() => {});
  }, [call]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    return params.toString();
  }, [filters]);

  useEffect(() => {
    setError('');
    call(`/admin/payments${query ? `?${query}` : ''}`)
      .then(setData)
      .catch((err) => setError(errorText(err)));
  }, [call, query]);

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  async function exportCsv() {
    setError('');
    try {
      const blob = await apiBlob(`/admin/payments/export${query ? `?${query}` : ''}`, { token });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `paiements-${todayISO()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Export impossible.');
    }
  }

  return (
    <>
      <div className="row between wrap">
        <h2 className="flush">Paiements</h2>
        <div className="row">
          {isMobile && (
            <button className="btn small secondary" onClick={() => setShowFilters((v) => !v)}>
              Filtres{activeFilters ? ` (${activeFilters})` : ''}
            </button>
          )}
          <button className="btn small" onClick={exportCsv}>Exporter en CSV (Excel)</button>
        </div>
      </div>

      <div className="card form-grid four" hidden={isMobile && !showFilters}>
        <label>
          Restaurant
          <select className="input" value={filters.shopId} onChange={set('shopId')}>
            <option value="">Tous</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label>
          Méthode
          <select className="input" value={filters.method} onChange={set('method')}>
            <option value="">Toutes</option>
            {Object.entries(METHOD_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          Du
          <input className="input" type="date" value={filters.from} onChange={set('from')} />
        </label>
        <label>
          Au
          <input className="input" type="date" value={filters.to} onChange={set('to')} />
        </label>
        <div className="full row wrap">
          <button
            className="link"
            onClick={() => setFilters((f) => ({ ...f, from: `${todayISO().slice(0, 7)}-01`, to: '' }))}
          >
            Ce mois
          </button>
          <button
            className="link"
            onClick={() => setFilters((f) => ({ ...f, from: `${todayISO().slice(0, 4)}-01-01`, to: '' }))}
          >
            Cette année
          </button>
          <button className="link" onClick={() => setFilters({ shopId: '', method: '', from: '', to: '' })}>
            Tout afficher
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <p>
        <strong>{data.count}</strong> paiement{data.count > 1 ? 's' : ''} · total{' '}
        <strong>{fmtDT(data.total)}</strong>
        {data.count > data.payments.length && (
          <span className="muted small-text"> (les {data.payments.length} plus récents sont affichés ; l’export contient tout)</span>
        )}
      </p>

      {data.payments.length ? (
        <div className="table-wrap">
          <table className="table cards">
            <thead>
              <tr>
                <th>Date</th>
                <th>Restaurant</th>
                <th>Montant</th>
                <th>Méthode</th>
                <th>Période couverte</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id}>
                  <td data-label="Date">{fmtDate(p.paidAt)}</td>
                  <td className="cell-main"><button className="link" onClick={() => onOpenShop(p.shopId)}>{p.shopName}</button></td>
                  <td data-label="Montant">{fmtDT(p.amount)}</td>
                  <td data-label="Méthode">{METHOD_LABELS[p.method]}</td>
                  <td data-label="Période">{p.periodEnd ? `${fmtDate(p.periodStart)} → ${fmtDate(p.periodEnd)}` : '—'}</td>
                  <td data-label="Note">{p.note || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">Aucun paiement pour ces filtres.</p>
      )}
    </>
  );
}
