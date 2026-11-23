import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api, socketUrl, storage } from '../api.js';
import { useI18n } from '../i18n.jsx';
import { startAlarm, stopAlarm, unlockAudio } from '../alarm.js';
import { requestPermission, subscribeForOrder } from '../push.js';
import { isIOS, isStandalone } from '../device.js';
import InstallGuide from '../components/InstallGuide.jsx';

const NUMBER_RE = /^[A-Za-z0-9-]{1,20}$/;

// Numéro mémorisé dans l'URL (?n=112) : l'app installée sur l'écran d'accueil iOS a un stockage séparé de Safari,
// l'URL est donc le seul moyen de retrouver le numéro après l'installation.
function numberFromUrl() {
  const n = new URLSearchParams(window.location.search).get('n') || '';
  return NUMBER_RE.test(n) ? n : '';
}

function setUrlNumber(slug, n) {
  try {
    window.history.replaceState(null, '', n ? `/s/${slug}?n=${encodeURIComponent(n)}` : `/s/${slug}`);
  } catch {
    // sans gravité
  }
}

const notifPermission = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

function Shell({ title, children, status }) {
  const { lang, setLang } = useI18n();
  return (
    <div className={`screen ${status || ''}`}>
      <header className="topbar">
        <strong>{title}</strong>
        <button className="lang" onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')}>
          {lang === 'fr' ? 'العربية' : 'Français'}
        </button>
      </header>
      <main className="center">{children}</main>
    </div>
  );
}

export default function Track() {
  const { slug } = useParams();
  const { t } = useI18n();
  const storageKey = `pager:${slug}`;

  const [shop, setShop] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [number, setNumber] = useState(numberFromUrl);
  const [perm, setPerm] = useState(notifPermission);
  const [order, setOrder] = useState(null); // { publicId, orderNumber, status, rev }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const wakeLock = useRef(null);

  // Infos du restaurant + reprise de la commande en cours (si la page a été rechargée)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await api(`/public/shops/${slug}`);
        if (cancelled) return;
        setShop(s);
      } catch {
        if (!cancelled) setNotFound(true);
        return;
      }
      const saved = storage.get(storageKey);
      if (!saved?.publicId) return;
      try {
        const o = await api(`/public/orders/${saved.publicId}`);
        if (cancelled) return;
        if (o.status === 'picked') storage.del(storageKey);
        else setOrder({ publicId: saved.publicId, orderNumber: o.orderNumber, status: o.status, rev: 0 });
      } catch {
        storage.del(storageKey);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, storageKey]);

  // Manifeste propre à ce restaurant : l'icône ajoutée à l'écran d'accueil rouvre directement la bonne page
  // (et le bon numéro) et porte le nom du restaurant.
  const shopName = shop?.name;
  const trackedNumber = order?.orderNumber;
  useEffect(() => {
    if (!shopName) return undefined;
    const link = document.querySelector('link[rel="manifest"]');
    const meta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    const prevHref = link?.getAttribute('href');
    const prevTitle = meta?.getAttribute('content');
    const q = new URLSearchParams({ slug });
    if (trackedNumber) q.set('n', trackedNumber);
    if (link) link.setAttribute('href', `/api/manifest?${q}`);
    if (meta) meta.setAttribute('content', shopName.slice(0, 20));
    return () => {
      if (link && prevHref) link.setAttribute('href', prevHref);
      if (meta && prevTitle) meta.setAttribute('content', prevTitle);
    };
  }, [shopName, slug, trackedNumber]);

  // Garde l'URL à jour avec le numéro suivi
  useEffect(() => {
    if (!shopName) return;
    if (trackedNumber) setUrlNumber(slug, trackedNumber);
  }, [shopName, slug, trackedNumber]);

  // Notifications déjà autorisées (ex. reprise d'une commande) : on (ré)enregistre l'abonnement
  useEffect(() => {
    const id = order?.publicId;
    if (id && notifPermission() === 'granted') subscribeForOrder(id).catch(() => {});
  }, [order?.publicId]);

  // Resynchronise le statut (reconnexion, retour au premier plan, filet de sécurité)
  const publicId = order?.publicId;
  const refresh = useCallback(async () => {
    if (!publicId) return;
    try {
      const o = await api(`/public/orders/${publicId}`);
      setOrder((cur) =>
        cur && cur.publicId === publicId && cur.status !== o.status
          ? { ...cur, status: o.status, rev: (cur.rev || 0) + 1 }
          : cur,
      );
    } catch (err) {
      if (err.status === 404) {
        storage.del(storageKey);
        setOrder(null);
      }
    }
  }, [publicId, storageKey]);

  // Temps réel : le serveur pousse "order:update" quand le comptoir appuie sur "Prête"
  useEffect(() => {
    if (!publicId) return undefined;
    const socket = io(socketUrl, { auth: { role: 'client', publicId } });
    socket.on('order:update', ({ status }) => {
      setDismissed(false);
      setOrder((cur) => (cur ? { ...cur, status, rev: (cur.rev || 0) + 1 } : cur));
    });
    socket.on('connect', refresh);
    const poll = setInterval(refresh, 8000);
    return () => {
      socket.disconnect();
      clearInterval(poll);
    };
  }, [publicId, refresh]);

  // Garde l'écran allumé pendant l'attente (évite de perdre la connexion)
  useEffect(() => {
    if (!publicId) return undefined;
    const acquire = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          wakeLock.current = await navigator.wakeLock.request('screen');
        }
      } catch {
        // non supporté ou refusé : sans gravité
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        acquire();
        refresh();
      }
    };
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
    };
  }, [publicId, refresh]);

  // Sonnerie tant que la commande est prête et non acquittée
  useEffect(() => {
    if (order?.status === 'ready' && !dismissed) startAlarm();
    else stopAlarm();
    return stopAlarm;
  }, [order?.status, order?.rev, dismissed]);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    unlockAudio(); // geste utilisateur : autorise le son plus tard
    const permission = requestPermission(); // idem pour les notifications
    setBusy(true);
    try {
      const o = await api(`/public/shops/${slug}/track`, {
        method: 'POST',
        body: { orderNumber: number },
      });
      storage.set(storageKey, { publicId: o.publicId });
      setDismissed(false);
      setOrder({ publicId: o.publicId, orderNumber: o.orderNumber, status: o.status, rev: 0 });
      setUrlNumber(slug, o.orderNumber);
      permission
        .then((p) => {
          setPerm(notifPermission());
          return p === 'granted' ? subscribeForOrder(o.publicId) : null;
        })
        .catch(() => {});
    } catch (err) {
      setError(err.message === 'invalid_number' ? t('invalidNumber') : t('genericError'));
    } finally {
      setBusy(false);
    }
  }

  async function onPicked() {
    stopAlarm();
    try {
      await api(`/public/orders/${order.publicId}/picked`, { method: 'POST' });
    } catch {
      // même si l'appel échoue, on affiche l'écran de fin
    }
    setOrder((cur) => (cur ? { ...cur, status: 'picked' } : cur));
  }

  // Geste utilisateur : demande l'autorisation des notifications (app installée sur iPhone)
  async function enableNotifications() {
    try {
      const p = await requestPermission();
      setPerm(notifPermission());
      if (p === 'granted' && order?.publicId) await subscribeForOrder(order.publicId);
    } catch {
      setPerm(notifPermission());
    }
  }

  function reset() {
    storage.del(storageKey);
    setUrlNumber(slug, '');
    setOrder(null);
    setNumber('');
    setDismissed(false);
  }

  // Faute de frappe : on retire la commande et on revient à la saisie, numéro pré-rempli
  async function changeNumber() {
    stopAlarm();
    const previous = order.orderNumber;
    try {
      await api(`/public/orders/${order.publicId}/cancel`, { method: 'POST' });
    } catch {
      // sans gravité : le serveur nettoiera la commande plus tard
    }
    reset();
    setNumber(previous);
  }

  if (notFound) {
    return (
      <Shell title="MH Bip">
        <p className="error">{t('shopNotFound')}</p>
      </Shell>
    );
  }
  if (!shop) {
    return (
      <Shell title="MH Bip">
        <p className="muted">{t('loading')}</p>
      </Shell>
    );
  }

  if (order?.status === 'picked') {
    return (
      <Shell title={shop.name}>
        <div className="big-emoji">🎉</div>
        <h1>{t('done')}</h1>
        <button className="btn secondary" onClick={reset}>{t('newOrder')}</button>
      </Shell>
    );
  }

  if (order?.status === 'ready') {
    return (
      <Shell title={shop.name} status="ready">
        <div className="big-emoji pulse">🔔</div>
        <h1>{t('ready')}</h1>
        <div className="ticket">{order.orderNumber}</div>
        <p className="lead">{t('goCounter')}</p>
        {!dismissed && (
          <button className="btn light" onClick={() => { stopAlarm(); setDismissed(true); }}>
            {t('stopAlarm')}
          </button>
        )}
        <button className="btn light outline" onClick={onPicked}>{t('picked')}</button>
        <button className="link light" onClick={changeNumber}>{t('wrongNumber')}</button>
      </Shell>
    );
  }

  if (order) {
    return (
      <Shell title={shop.name}>
        <p className="muted">{t('yourOrder')}</p>
        <div className="ticket">{order.orderNumber}</div>
        <div className="spinner" aria-hidden="true" />
        <h2>{t('preparing')}</h2>
        <p className="muted narrow">{t('keepOpen')}</p>
        {isIOS() && !isStandalone() && <InstallGuide />}
        {isIOS() && isStandalone() && perm === 'granted' && <p className="notif-status ok narrow">✓ {t('notifOn')}</p>}
        {isIOS() && isStandalone() && perm === 'default' && (
          <button type="button" className="btn small" onClick={enableNotifications}>{t('notifEnable')}</button>
        )}
        {isIOS() && isStandalone() && perm === 'denied' && <p className="notif-status bad narrow">{t('notifDenied')}</p>}
        <button className="link" onClick={changeNumber}>{t('wrongNumber')}</button>
      </Shell>
    );
  }

  return (
    <Shell title={shop.name}>
      <h1>{t('enterNumber')}</h1>
      {isIOS() && isStandalone() && perm === 'default' && <p className="muted narrow">{t('notifInstalledHint')}</p>}
      <form onSubmit={onSubmit} className="stack">
        <input
          className="input big"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder={t('numberPlaceholder')}
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={20}
          autoFocus
        />
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy || !number.trim()}>{t('track')}</button>
      </form>
    </Shell>
  );
}
