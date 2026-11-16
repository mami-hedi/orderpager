import { useEffect, useState } from 'react';
import { fmtDT, fmtDate, monthLabel } from './format.js';

function Stat({ label, value, hint, tone }) {
  return (
    <div className={`stat ${tone || ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export default function Dashboard({ call, onOpenShop }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    call('/admin/stats').then(setStats).catch(() => setError(true));
  }, [call]);

  if (error) return <p className="error">Impossible de charger les statistiques.</p>;
  if (!stats) return <p className="muted">Chargement…</p>;

  const { counts, revenue, months, toRenew, ordersToday } = stats;
  const maxMonth = Math.max(...months.map((m) => m.total), 1);
  const toRenewCount = counts.expiring + counts.expired;

  return (
    <>
      <div className="stats">
        <Stat
          label="Restaurants actifs"
          value={counts.active}
          hint={`${counts.total} au total · ${counts.suspended} suspendu${counts.suspended > 1 ? 's' : ''}`}
        />
        <Stat
          label="À renouveler"
          value={toRenewCount}
          hint={`${counts.expiring} bientôt · ${counts.expired} expiré${counts.expired > 1 ? 's' : ''}`}
          tone={toRenewCount ? 'warn' : ''}
        />
        <Stat
          label="Encaissé ce mois"
          value={fmtDT(revenue.month)}
          hint={`${revenue.monthCount} paiement${revenue.monthCount > 1 ? 's' : ''}`}
        />
        <Stat
          label="Encaissé au total"
          value={fmtDT(revenue.total)}
          hint={`${revenue.totalCount} paiement${revenue.totalCount > 1 ? 's' : ''}`}
        />
        <Stat label="Commandes aujourd'hui" value={ordersToday} hint="tous restaurants" />
      </div>

      <h2>À renouveler</h2>
      {toRenew.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Restaurant</th>
                <th>Contact</th>
                <th>Échéance</th>
                <th>Prix mensuel</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {toRenew.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                    <div className="muted small-text">/s/{s.slug}</div>
                  </td>
                  <td>
                    {s.ownerName || '—'}
                    {s.phone && (
                      <div className="small-text">
                        <a href={`tel:${s.phone}`}>{s.phone}</a>
                      </div>
                    )}
                  </td>
                  <td>
                    {fmtDate(s.expiresAt)}{' '}
                    <span className={`badge ${s.daysLeft < 0 ? 'off' : 'warn'}`}>
                      {s.daysLeft < 0 ? `expiré (${-s.daysLeft} j)` : `J-${s.daysLeft}`}
                    </span>
                  </td>
                  <td>{s.monthlyPrice !== null ? fmtDT(s.monthlyPrice) : '—'}</td>
                  <td>
                    <button className="btn small" onClick={() => onOpenShop(s.id)}>Encaisser</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">Aucun abonnement à renouveler dans les 7 prochains jours. 👍</p>
      )}

      <h2>Revenus des 12 derniers mois</h2>
      <div className="bars">
        {months.map((m) => (
          <div key={m.month} className="bar-row">
            <span className="bar-label">{monthLabel(m.month)}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(m.total / maxMonth) * 100}%` }} />
            </div>
            <span className="bar-value">{m.total ? fmtDT(m.total) : '—'}</span>
          </div>
        ))}
      </div>
    </>
  );
}
