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

// Regroupe les abonnements à traiter par urgence : en retard, dernier jour, cette semaine
export function groupTodo(toRenew) {
  return [
    { key: 'late', title: 'En retard', tone: 'off', items: toRenew.filter((s) => s.daysLeft < 0) },
    { key: 'today', title: "Dernier jour aujourd'hui", tone: 'warn', items: toRenew.filter((s) => s.daysLeft === 0) },
    { key: 'week', title: 'Cette semaine', tone: 'trial', items: toRenew.filter((s) => s.daysLeft > 0) },
  ].filter((g) => g.items.length);
}

function whenText(s) {
  if (s.daysLeft < 0) return `terminé depuis ${-s.daysLeft} j (${fmtDate(s.expiresAt)})`;
  if (s.daysLeft === 0) return `se termine aujourd'hui`;
  return `se termine dans ${s.daysLeft} j (${fmtDate(s.expiresAt)})`;
}

function TodoItem({ s, onOpenShop }) {
  return (
    <li className="todo-item">
      <div className="todo-main">
        <strong>{s.name}</strong>
        <div className="small-text">
          <span className={`badge ${s.paid ? 'ok' : 'trial'}`}>{s.paid ? 'Abonnement' : 'Essai gratuit'}</span>{' '}
          {whenText(s)}
        </div>
        <div className="muted small-text">
          {s.ownerName || 'Gérant non renseigné'}
          {s.monthlyPrice !== null && ` · ${fmtDT(s.monthlyPrice)} / mois`}
        </div>
      </div>
      <div className="todo-actions">
        <button className="btn small" onClick={() => onOpenShop(s.id)}>Encaisser</button>
        {s.phone ? (
          <a className="btn small secondary" href={`tel:${s.phone}`}>Appeler</a>
        ) : (
          <span className="muted small-text">Pas de téléphone</span>
        )}
      </div>
    </li>
  );
}

export default function Dashboard({ call, onOpenShop }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    call('/admin/stats').then(setStats).catch(() => setError(true));
  }, [call]);

  if (error) return <p className="error">Impossible de charger les statistiques. Le serveur se réveille peut-être : réessayez dans une minute.</p>;
  if (!stats) return <p className="muted">Chargement… (la première requête peut prendre une minute)</p>;

  const { counts, revenue, months, toRenew, ordersToday, paying } = stats;
  const maxMonth = Math.max(...months.map((m) => m.total), 1);
  const previous = months.length > 1 ? months[months.length - 2].total : 0;
  const groups = groupTodo(toRenew);

  return (
    <>
      <section className="card todo">
        <div className="row between wrap">
          <h2 className="flush">À faire aujourd'hui</h2>
          {toRenew.length > 0 && <span className="badge warn">{toRenew.length} à traiter</span>}
        </div>
        {groups.length ? (
          groups.map((g) => (
            <div key={g.key} className="todo-group">
              <h3 className={`todo-title ${g.tone}`}>{g.title} ({g.items.length})</h3>
              <ul className="todo-list">
                {g.items.map((s) => (
                  <TodoItem key={s.id} s={s} onOpenShop={onOpenShop} />
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className="ok-text flush">Rien à faire aujourd'hui : aucun abonnement ne se termine dans les 7 prochains jours.</p>
        )}
      </section>

      <div className="stats">
        <Stat
          label="Restaurants actifs"
          value={counts.active}
          hint={`${counts.total} au total · ${counts.suspended} suspendu${counts.suspended > 1 ? 's' : ''}`}
        />
        <Stat
          label="En essai gratuit"
          value={counts.trials}
          hint="n'ont encore rien payé"
        />
        <Stat
          label="Abonnements payants / mois"
          value={fmtDT(paying.monthly)}
          hint={`${paying.count} restaurant${paying.count > 1 ? 's' : ''}${paying.withoutPrice ? ` · ${paying.withoutPrice} sans prix mensuel` : ''}`}
        />
        <Stat
          label="Encaissé ce mois"
          value={fmtDT(revenue.month)}
          hint={`Mois dernier : ${fmtDT(previous)} · ${revenue.monthCount} paiement${revenue.monthCount > 1 ? 's' : ''}`}
        />
        <Stat
          label="Encaissé au total"
          value={fmtDT(revenue.total)}
          hint={`${revenue.totalCount} paiement${revenue.totalCount > 1 ? 's' : ''}`}
        />
        <Stat label="Commandes aujourd'hui" value={ordersToday} hint="tous restaurants" />
      </div>

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
