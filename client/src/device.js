// iPhone / iPad (y compris iPadOS qui se présente comme un Mac) et mode « application » (écran d'accueil)
export const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches));
