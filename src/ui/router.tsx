import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

/** Minimal hash router (works from file:// and inside Capacitor). Routes look like #/logs/abc?x=1 */
export function currentPath(): string {
  const h = window.location.hash.replace(/^#/, '');
  return (h.split('?')[0] || '/') || '/';
}
export function currentQuery(): URLSearchParams {
  const h = window.location.hash.replace(/^#/, '');
  return new URLSearchParams(h.includes('?') ? h.slice(h.indexOf('?') + 1) : '');
}
export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  const target = '#' + to;
  if (opts.replace) window.location.replace(target);
  else window.location.hash = target;
}
export function usePath(): string {
  useHashKey();
  return currentPath();
}
export function useHashKey(): string {
  const [k, setK] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setK(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return k;
}

/** Match "/logs/:id" style patterns. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

export function Link({ to, children, className, ...rest }: { to: string; children?: ReactNode; className?: string; [k: string]: unknown }) {
  return (
    <a href={'#' + to} className={className} {...rest}>
      {children}
    </a>
  );
}
