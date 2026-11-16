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

const TABS = [
  ['dashboard', 'Tableau de bord'],
  ['shops', 'Restaurants'],
  ['payments', 'Paiements'],
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
    <div className="page admin">
      <header className="row between wrap">
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
