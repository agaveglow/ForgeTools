import type { ReactNode } from 'react';

export function Bar({ value, max, label, tone = 'accent' }: { value: number; max: number; label: string; tone?: 'accent' | 'ok' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)} aria-valuetext={`${value} of ${max}`} className="h-2 rounded-full bg-surface2 overflow-hidden">
      <div className={'h-full ' + (tone === 'ok' ? 'bg-ok' : 'bg-accent')} style={{ width: pct + '%' }} />
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-3xl font-semibold leading-tight tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  );
}
