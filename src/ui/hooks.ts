import { useEffect, useState } from 'react';

export function useMediaQuery(q: string): boolean {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : false);
  const [m, setM] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}
export const useIsMobile = () => useMediaQuery('(max-width: 767px)');

export function useTitle(t: string): void {
  useEffect(() => { document.title = t ? `${t} · ForgeTools` : 'ForgeTools'; }, [t]);
}
