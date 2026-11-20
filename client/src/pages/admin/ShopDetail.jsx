import { useCallback, useEffect, useState } from 'react';
import {
  METHOD_LABELS,
  fmtDT,
  fmtDate,
  todayISO,
  statusOf,
  expiryText,
  errorText,
  slugify,
} from './format.js';

const round3 = (n) => Math.round(n * 1000) / 1000;
const MONTH_CHOICES = [0, 1, 2, 3, 6, 12];
const emptyPayment = () => ({ amount: null, months: 1, method: 'cash', paidAt: todayISO(), note: '' });

export default function ShopDetail({ call, id, onBack }) {
  const [shop, setShop] = useState(null);
  const [payments, setPayments] = useState([]);
  const [info, setInfo] = useState(null);
  const [expiry, setExpiry] = useState('');
  const [msg, setMsg] = useState(null); // { type: 'ok' | 'error', text }
  const [pay, setPay] = useState(emptyPayment);
  const [regenSlug, setRegenSlug] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await call(`/admin/shops/${id}`);
      setShop(data.shop);
      setPayments(data.payments);
      setInfo({
        name: data.shop.name,
        ownerName: data.shop.ownerName || '',
        phone: data.shop.phone || '',
        email: data.shop.email || '',
        monthlyPrice: data.shop.monthlyPrice ?? '',
        notes: data.shop.notes || '',
      });
      setExpiry(data.shop.expiresAt || '');
      setRegenSlug(false);
    } catch (err) {
      setMsg({ type: 'error', text: errorText(err) });
    }
  }, [call, id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!shop || !info) {
    return (
      <>
        <button className="link" onClick={onBack}>← Retour à la liste</button>
        {msg ? <p className="error">{msg.text}</p> : <p className="muted">Chargement…</p>}
      </>
    );
  }

  const st = statusOf({ ...shop, paid: payments.length > 0 });
  const origin = window.location.origin;
  // Adresse qui serait générée d'après le nom saisi (différente de l'adresse actuelle ?)
  const wantedSlug = slugify(info.name);
  const slugDiffers = Boolean(wantedSlug) && wantedSlug !== shop.slug;
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  // Montant proposé = prix mensuel × nombre de mois, tant qu'il n'a pas été modifié à la main
  const suggested =
    shop.monthlyPrice !== null && pay.months > 0 ? String(round3(shop.monthlyPrice * pay.months)) : '';
  const amountValue = pay.amount ?? suggested;

  async function run(action, okText) {
    setMsg(null);
    try {
      const result = await action();
      if (okText) setMsg({ type: 'ok', text: typeof okText === 'function' ? okText(result) : okText });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: errorText(err) });
    }
  }

  const patch = (body, okText) =>
    run(() => call(`/admin/shops/${id}`, { method: 'PATCH', body }), okText);

  function saveInfo(e) {
    e.preventDefault();
    patch(
      {
        name: info.name,
        ownerName: info.ownerName,
        phone: info.phone,
        email: info.email,
        notes: info.notes,
        monthlyPrice: info.monthlyPrice === '' ? null : Number(info.monthlyPrice),
        regenerateSlug: regenSlug,
      },
      (r) =>
        r.slug
          ? `Informations enregistrées. Nouvelle adresse : /s/${r.slug}. Réimprimez le poster QR.`
          : 'Informations enregistrées.',
    );
  }

  function changePassword() {
    const password = window.prompt('Nouveau mot de passe du comptoir (6 caractères minimum)');
    if (password) patch({ password }, 'Mot de passe du comptoir modifié.');
  }

  function saveExpiry() {
    patch({ expiresAt: expiry || null }, 'Date d’échéance enregistrée.');
  }

  const gift = (months) =>
    run(
      () => call(`/admin/shops/${id}/extend`, { method: 'POST', body: { months } }),
      (r) => `Prolongé sans paiement. Nouvelle échéance : ${fmtDate(r.expiresAt)}.`,
    );

  function addPayment(e) {
    e.preventDefault();
    run(
      async () => {
        const result = await call(`/admin/shops/${id}/payments`, {
          method: 'POST',
          body: {
            amount: amountValue === '' ? '' : Number(amountValue),
            months: Number(pay.months),
            method: pay.method,
            paidAt: pay.paidAt,
            note: pay.note,
          },
        });
        setPay(emptyPayment());
        return result;
      },
      (r) =>
        Number(pay.months) > 0
          ? `Paiement enregistré. Nouvelle échéance : ${fmtDate(r.expiresAt)}.`
          : 'Paiement enregistré (sans prolongation).',
    );
  }

  function removePayment(p) {
    const ok = window.confirm(
      `Supprimer le paiement du ${fmtDate(p.paidAt)} (${fmtDT(p.amount)}) ?\n\nL’échéance de l’abonnement ne sera pas modifiée.`,
    );
    if (ok) run(() => call(`/admin/payments/${p.id}`, { method: 'DELETE' }), 'Paiement supprimé.');
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      setMsg({ type: 'ok', text: 'Lien copié.' });
    } catch {
      setMsg({ type: 'error', text: 'Copie impossible : sélectionnez le lien à la main.' });
    }
  }

  return (
    <>
      <button className="link" onClick={onBack}>← Retour à la liste</button>
      <div className="row between wrap">
        <h2 className="flush">{shop.name}</h2>
        <span className={`badge ${st.cls}`}>{st.label}</span>
      </div>
      {msg && <p className={msg.type === 'ok' ? 'ok-text' : 'error'}>{msg.text}</p>}

      <div className="detail-grid">
        <section className="card">
          <h3>Abonnement</h3>
          <p>
            Échéance : <strong>{expiryText(shop)}</strong>
          </p>
          <label>
            Modifier la date d’échéance
            <div className="row">
              <input className="input" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
              <button className="btn small" onClick={saveExpiry}>Enregistrer</button>
            </div>
          </label>
          <p className="muted small-text">Vide = abonnement sans limite. La date indiquée est le dernier jour d’accès.</p>
          <div className="row wrap">
            <span className="muted small-text">Offrir sans paiement :</span>
            <button className="btn small secondary" onClick={() => gift(1)}>+1 mois</button>
            <button className="btn small secondary" onClick={() => gift(12)}>+1 an</button>
          </div>
          <div className="row wrap">
            <button className="link" onClick={() => patch({ active: !shop.active }, shop.active ? 'Restaurant suspendu.' : 'Restaurant réactivé.')}>
              {shop.active ? 'Suspendre le compte' : 'Réactiver le compte'}
            </button>
          </div>
        </section>

        <section className="card">
          <h3>Accès</h3>
          <p className="small-text">
            Adresse client : <strong>/s/{shop.slug}</strong>
          </p>
          <div className="stack tight">
            <div className="row wrap">
              <a className="link" href={`${origin}/counter`} target="_blank" rel="noreferrer">Écran comptoir</a>
              <button className="link" onClick={() => copy(`${origin}/counter`)}>Copier</button>
            </div>
            <div className="row wrap">
              <a className="link" href={`${origin}/s/${shop.slug}`} target="_blank" rel="noreferrer">Page client</a>
              <button className="link" onClick={() => copy(`${origin}/s/${shop.slug}`)}>Copier</button>
            </div>
            <a className="link" href={`${origin}/poster/${shop.slug}`} target="_blank" rel="noreferrer">Poster QR (à imprimer)</a>
            <button className="link left" onClick={changePassword}>Changer le mot de passe du comptoir</button>
          </div>
          <p className="muted small-text">Commandes aujourd’hui : {shop.ordersToday}</p>
        </section>
      </div>

      <section className="card">
        <h3>Enregistrer un paiement</h3>
        <form onSubmit={addPayment} className="form-grid">
          <label>
            Mois ajoutés à l’abonnement
            <select className="input" value={pay.months} onChange={(e) => setPay({ ...pay, months: Number(e.target.value) })}>
              {MONTH_CHOICES.map((m) => (
                <option key={m} value={m}>{m === 0 ? '0 (sans prolongation)' : `${m} mois`}</option>
              ))}
            </select>
          </label>
          <label>
            Montant (DT)
            <input
              className="input"
              type="number"
              min="0"
              step="0.001"
              value={amountValue}
              onChange={(e) => setPay({ ...pay, amount: e.target.value })}
              placeholder={shop.monthlyPrice === null ? 'Saisir le montant' : ''}
              required
            />
          </label>
          <label>
            Méthode
            <select className="input" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
              {Object.entries(METHOD_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Date du paiement
            <input className="input" type="date" value={pay.paidAt} onChange={(e) => setPay({ ...pay, paidAt: e.target.value })} required />
          </label>
          <label className="full">
            Note (facultatif)
            <input className="input" value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} maxLength={255} placeholder="ex. reçu n° 14, virement BIAT…" />
          </label>
          <div className="full">
            <button className="btn">Enregistrer le paiement</button>
          </div>
        </form>

        <h3>Historique ({payments.length}) · total {fmtDT(totalPaid)}</h3>
        {payments.length ? (
          <div className="table-wrap">
            <table className="table cards">
              <thead>
                <tr>
                  <th>Date et montant</th>
                  <th>Méthode</th>
                  <th>Période couverte</th>
                  <th>Note</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="cell-main">{fmtDate(p.paidAt)} · <strong>{fmtDT(p.amount)}</strong></td>
                    <td data-label="Méthode">{METHOD_LABELS[p.method]}</td>
                    <td data-label="Période">{p.periodEnd ? `${fmtDate(p.periodStart)} → ${fmtDate(p.periodEnd)} (${p.months} mois)` : '—'}</td>
                    <td data-label="Note">{p.note || ''}</td>
                    <td className="cell-action"><button className="link danger" onClick={() => removePayment(p)}>Supprimer</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Aucun paiement enregistré.</p>
        )}
      </section>

      <section className="card">
        <h3>Informations du restaurant</h3>
        <form onSubmit={saveInfo} className="form-grid">
          <label>
            Nom affiché aux clients
            <input className="input" value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} required />
          </label>
          <label>
            Gérant
            <input className="input" value={info.ownerName} onChange={(e) => setInfo({ ...info, ownerName: e.target.value })} />
          </label>
          <label>
            Téléphone
            <input className="input" type="tel" value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} />
          </label>
          <label>
            Email
            <input className="input" type="email" value={info.email} onChange={(e) => setInfo({ ...info, email: e.target.value })} />
          </label>
          <label>
            Prix mensuel convenu (DT)
            <input className="input" type="number" min="0" step="0.001" value={info.monthlyPrice} onChange={(e) => setInfo({ ...info, monthlyPrice: e.target.value })} />
          </label>
          <label className="full">
            Notes internes
            <textarea className="input" rows="3" value={info.notes} onChange={(e) => setInfo({ ...info, notes: e.target.value })} />
          </label>
          {slugDiffers && (
            <label className="full check">
              <input type="checkbox" checked={regenSlug} onChange={(e) => setRegenSlug(e.target.checked)} />
              <span>
                Mettre à jour l’adresse de la page client : <strong>/s/{shop.slug}</strong> devient{' '}
                <strong>/s/{wantedSlug}</strong>
                <span className="warn-text left-text">
                  Attention : le poster QR déjà imprimé ne fonctionnera plus, il faudra le réimprimer.
                </span>
              </span>
            </label>
          )}
          {!slugDiffers && (
            <p className="muted small-text full">
              L’adresse de la page client (/s/{shop.slug}) correspond au nom. Si vous renommez le restaurant, vous pourrez la mettre à jour ici.
            </p>
          )}
          <div className="full">
            <button className="btn">Enregistrer les informations</button>
          </div>
        </form>
      </section>
    </>
  );
}
