import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api, socketUrl, storage } from '../api.js';

function Login({ onLogin }) {
  const [slug, setSlug] = useState(storage.get('counter:slug') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api('/auth/shop/login', { method: 'POST', body: { slug, password } });
      storage.set('counter:slug', slug.trim());
      onLogin(data.token, data.shop.name);
    } catch (err) {
      setError(
        err.message === 'expired'
          ? 'Abonnement expiré. Contactez le support pour le renouveler.'
          : err.status === 403
          ? 'Abonnement inactif. Contactez le support.'
          : err.status === 429
            ? 'Trop de tentatives, réessayez dans une minute.'
            : 'Identifiant ou mot de passe incorrect.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page narrow-page">
      <h1>Écran comptoir</h1>
      <form onSubmit={submit} className="stack">
        <label>
          Nom du restaurant
          <input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ex. Café de la Plage" autoCapitalize="none" required />
        </label>
        <label>
          Mot de passe
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy}>Connexion</button>
      </form>
    </div>
  );
}

// Aide le personnel à repérer une faute de frappe quand il tape un numéro
function readyHint(r) {
  if (!r.existed) return ' — aucun client ne suit ce numéro : appelez-le à voix haute.';
  if (!r.trackers) return " — le téléphone du client n'est pas connecté : appelez-le à voix haute.";
  return '';
}

// "2026-12-25" -> "25/12/2026"
function formatDate(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

function Board({ token, shopName, onLogout }) {
  const [orders, setOrders] = useState([]);
  const [num, setNum] = useState('');
  const [msg, setMsg] = useState(null); // { text, undoId? }
  const [sub, setSub] = useState({ daysLeft: null, expiresAt: null });
  const { daysLeft, expiresAt } = sub;
  const inputRef = useRef(null);

  // Jours restants de l'abonnement : chargés à l'ouverture, puis rafraîchis chaque heure
  // et au retour sur l'onglet (l'écran comptoir reste ouvert plusieurs jours).
  useEffect(() => {
    const refresh = () =>
      api('/shop/me', { token })
        .then((me) => setSub({ daysLeft: me.daysLeft, expiresAt: me.expiresAt }))
        .catch(() => {});
    refresh();
    const timer = setInterval(refresh, 60 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token]);

  const load = useCallback(async () => {
    try {
      const data = await api('/shop/orders', { token });
      setOrders(data.orders);
    } catch (err) {
      if (err.status === 401 || err.status === 403) onLogout();
    }
  }, [token, onLogout]);

  useEffect(() => {
    load();
    const socket = io(socketUrl, { auth: { role: 'shop', token } });
    socket.on('orders:changed', load);
    socket.on('connect', load);
    socket.on('auth_error', onLogout);
    const poll = setInterval(load, 15000);
    return () => {
      socket.disconnect();
      clearInterval(poll);
    };
  }, [token, load, onLogout]);

  async function ready(e) {
    e.preventDefault();
    const n = num.trim();
    if (!n) return;
    try {
      const r = await api('/shop/orders/ready', { method: 'POST', token, body: { orderNumber: n } });
      setMsg({ text: `✓ N° ${r.orderNumber} prête${readyHint(r)}`, undoId: r.id });
      setNum('');
      load();
    } catch (err) {
      setMsg({ text: err.message === 'invalid_number' ? 'Numéro invalide' : 'Erreur, réessayez' });
    }
    inputRef.current?.focus();
  }

  async function act(id, what) {
    try {
      await api(`/shop/orders/${id}/${what}`, { method: 'POST', token });
    } catch {
      setMsg({ text: 'Erreur, réessayez' });
    }
    load();
  }

  // "Prête" tapé par erreur : la commande repasse en préparation, le téléphone arrête de sonner
  async function undo(id) {
    await act(id, 'unready');
    setMsg({ text: 'Annulé : la commande est repassée en préparation.' });
  }

  const pending = orders.filter((o) => o.status === 'pending');
  const done = orders.filter((o) => o.status === 'ready');

  return (
    <div className="page wide">
      <header className="row between">
        <div>
          <h1>{shopName || 'Comptoir'}</h1>
          {daysLeft !== null && (
            <span className={`sub-pill ${daysLeft <= 0 ? 'danger' : daysLeft <= 7 ? 'warn' : 'ok'}`}>
              {daysLeft <= 0
                ? 'Abonnement : dernier jour'
                : `Abonnement : ${daysLeft} jour${daysLeft > 1 ? 's' : ''} restant${daysLeft > 1 ? 's' : ''}`}
              {expiresAt && <small> · jusqu'au {formatDate(expiresAt)}</small>}
            </span>
          )}
        </div>
        <button className="btn small secondary" onClick={onLogout}>Déconnexion</button>
      </header>

      {daysLeft !== null && daysLeft <= 7 && (
        <div className="banner">
          {daysLeft <= 0
            ? "Votre abonnement expire aujourd'hui."
            : `Votre abonnement expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}.`}{' '}
          Contactez-nous pour le renouveler.
        </div>
      )}

      <form onSubmit={ready} className="row quick">
        <input
          ref={inputRef}
          className="input big"
          value={num}
          onChange={(e) => setNum(e.target.value)}
          placeholder="N° du ticket"
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={20}
          autoFocus
        />
        <button className="btn go" disabled={!num.trim()}>Prête ✓</button>
      </form>
      {msg && (
        <p className="muted">
          {msg.text}{' '}
          {msg.undoId && (
            <button className="link" onClick={() => undo(msg.undoId)}>Annuler</button>
          )}
        </p>
      )}

      <h2>En préparation ({pending.length})</h2>
      <div className="grid">
        {pending.map((o) => (
          <div key={o.id} className="card">
            <div className="card-number">{o.orderNumber}</div>
            <div className={`phone ${o.clientConnected ? 'on' : ''}`}>
              {o.clientConnected ? '📱 suit sur son téléphone' : 'pas de suivi mobile'}
            </div>
            {o.trackers > 1 && <div className="warn-text">⚠ {o.trackers} téléphones suivent ce numéro</div>}
            <button className="btn go" onClick={() => act(o.id, 'ready')}>Prête ✓</button>
            <button className="link" onClick={() => act(o.id, 'picked')}>Retirer</button>
          </div>
        ))}
        {!pending.length && <p className="muted">Aucune commande en préparation.</p>}
      </div>

      <h2>Prêtes ({done.length})</h2>
      <div className="grid">
        {done.map((o) => (
          <div key={o.id} className="card is-ready">
            <div className="card-number">{o.orderNumber}</div>
            <div className={`phone ${o.clientConnected ? 'on' : ''}`}>
              {o.clientConnected ? '📱 connecté' : 'sans téléphone : appelez le numéro'}
            </div>
            {o.trackers > 1 && <div className="warn-text">⚠ {o.trackers} téléphones suivent ce numéro</div>}
            <button className="btn secondary" onClick={() => act(o.id, 'ready')}>Rappeler 🔔</button>
            <button className="btn" onClick={() => act(o.id, 'picked')}>Récupérée</button>
            <button className="link" onClick={() => undo(o.id)}>Annuler (pas prête)</button>
          </div>
        ))}
        {!done.length && <p className="muted">Aucune commande prête.</p>}
      </div>
    </div>
  );
}

export default function Counter() {
  const [token, setToken] = useState(() => storage.get('counter:token'));
  const [shopName, setShopName] = useState(() => storage.get('counter:shop') || '');

  const logout = useCallback(() => {
    storage.del('counter:token');
    setToken(null);
  }, []);

  if (!token) {
    return (
      <Login
        onLogin={(tk, name) => {
          storage.set('counter:token', tk);
          storage.set('counter:shop', name);
          setShopName(name);
          setToken(tk);
        }}
      />
    );
  }
  return <Board token={token} shopName={shopName} onLogout={logout} />;
}
