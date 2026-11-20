import { useCallback, useState } from 'react';
import { api, storage } from '../api.js';
import { useAdminApi } from './admin/useAdminApi.js';
import Dashboard from './admin/Dashboard.jsx';
import Shops from './admin/Shops.jsx';
import ShopDetail from './admin/ShopDetail.jsx';
import Payments from './admin/Payments.jsx';

function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const { token } = await api('/auth/admin/login', { method: 'POST', body: { password } });
      onLogin(token);
    } catch (err) {
      setError(err.status === 429 ? 'Trop de tentatives.' : 'Mot de passe incorrect.');
    }
  }

  return (
    <div className="page narrow-page">
      <h1>Administration</h1>
      <form onSubmit={submit} className="stack">
        <input className="input" type="password" placeholder="Mot de passe admin" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="error">{error}</p>}
        <button className="btn">Connexion</button>
      </form>
    </div>
  );
}

const ICON_PROPS = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const ICONS = {
  dashboard: (
    <svg {...ICON_PROPS}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>
  ),
  shops: (
    <svg {...ICON_PROPS}><path d="M3 9l1.5-5h15L21 9" /><path d="M4 9v11h16V9" /><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /><path d="M10 20v-6h4v6" /></svg>
  ),
  payments: (
    <svg {...ICON_PROPS}><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19" /><path d="M6.5 15h4" /></svg>
  ),
};
const TABS = [
  ['dashboard', 'Tableau de bord', 'Accueil'],
  ['shops', 'Restaurants', 'Restaurants'],
  ['payments', 'Paiements', 'Paiements'],
];

function Panel({ token, onLogout }) {
  const call = useAdminApi(token, onLogout);
  const [tab, setTab] = useState('dashboard');
  const [shopId, setShopId] = useState(null);

  const openShop = (id) => {
    setTab('shops');
    setShopId(id);
  };
  const goTab = (key) => {
    setTab(key);
    setShopId(null);
  };

  return (
    <div className="page admin has-bottom-nav">
      <header className="row between admin-head">
        <h1>Administration</h1>
        <button className="btn small secondary" onClick={onLogout}>Déconnexion</button>
      </header>

      <nav className="tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={`tab ${tab === key ? 'on' : ''}`} onClick={() => goTab(key)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === 'dashboard' && <Dashboard call={call} onOpenShop={openShop} />}
      {tab === 'shops' &&
        (shopId ? (
          <ShopDetail call={call} id={shopId} onBack={() => setShopId(null)} />
        ) : (
          <Shops call={call} onOpen={setShopId} />
        ))}
      {tab === 'payments' && <Payments call={call} token={token} onOpenShop={openShop} />}

      <nav className="bottom-nav" aria-label="Navigation principale">
        {TABS.map(([key, label, short]) => (
          <button key={key} className={`bn-item ${tab === key ? 'on' : ''}`} onClick={() => goTab(key)} aria-current={tab === key ? 'page' : undefined} aria-label={label}>
            {ICONS[key]}
            <span>{short}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function Admin() {
  const [token, setToken] = useState(() => storage.get('admin:token'));
  const logout = useCallback(() => {
    storage.del('admin:token');
    setToken(null);
  }, []);

  if (!token) {
    return (
      <Login
        onLogin={(tk) => {
          storage.set('admin:token', tk);
          setToken(tk);
        }}
      />
    );
  }
  return <Panel token={token} onLogout={logout} />;
}
