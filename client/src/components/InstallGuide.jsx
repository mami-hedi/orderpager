import { useEffect, useState } from 'react';
import { useI18n } from '../i18n.jsx';

// Carte affichée sur iPhone (hors mode « application ») : explique comment ajouter MH Bip à l'écran
// d'accueil, condition nécessaire pour recevoir les notifications push sur iOS.
export default function InstallGuide() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const steps = [1, 2, 3, 4, 5];
  return (
    <>
      <div className="install-card narrow">
        <strong>🔔 {t('iosInstallTitle')}</strong>
        <p>{t('iosInstallText')}</p>
        <button type="button" className="btn small" onClick={() => setOpen(true)}>
          {t('iosInstallBtn')}
        </button>
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div
            className="modal-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={t('guideTitle')}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>{t('guideTitle')}</h2>
            <p className="muted small-text">{t('guideSafari')}</p>
            <ol className="guide-steps">
              {steps.map((n) => (
                <li key={n}>{t(`guideStep${n}`)}</li>
              ))}
            </ol>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              {t('guideClose')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
