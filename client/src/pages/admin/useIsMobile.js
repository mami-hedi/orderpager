import { useEffect, useState } from 'react';

// true sous 720 px de large (téléphone) ; se met à jour à la rotation de l'écran
export function useIsMobile(max = 720) {
  const query = `(max-width: ${max}px)`;
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return mobile;
}
