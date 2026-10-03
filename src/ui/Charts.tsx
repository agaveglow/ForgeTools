/** Small accessible SVG charts. Colours come from the theme variables so they follow the look. */
import type { HeatCell } from '../lib/progress';

export function Ring({ value, max, label, size = 76, center }: { value: number; max: number; label: string; size?: number; center?: string }) {
  const r = (size - 10) / 2, c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${value} of ${max}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-surface2)" strokeWidth="9" />
      {pct > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={pct >= 1 ? 'var(--c-ok)' : 'var(--c-accent)'} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />}
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={size / 4.2} fontWeight="600" fill="var(--c-ink)">{center ?? (max > 0 ? Math.round(pct * 100) + '%' : '–')}</text>
    </svg>
  );
}

export function Heatmap({ weeks, label }: { weeks: HeatCell[][]; label: string }) {
  const cell = 14, gap = 3, w = weeks.length * (cell + gap), h = 7 * (cell + gap);
  const level = (n: number) => (n <= 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : 3);
  const op = [0, 0.3, 0.6, 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="w-full max-w-md h-auto">
      {weeks.map((col, x) => col.map((c, y) => (
        <rect key={c.date} x={x * (cell + gap)} y={y * (cell + gap)} width={cell} height={cell} rx="3" fill={c.future ? 'none' : level(c.count) ? 'var(--c-accent)' : 'var(--c-surface2)'} fillOpacity={c.future ? 0 : level(c.count) ? op[level(c.count)] : 1} stroke={c.future ? 'var(--c-line)' : 'none'} strokeDasharray={c.future ? '2 2' : undefined}><title>{`${c.date}: ${c.count} ${c.count === 1 ? 'item' : 'items'}`}</title></rect>
      )))}
    </svg>
  );
}

export function BarChart({ data, label, unit = 'h' }: { data: Array<{ label: string; value: number }>; label: string; unit?: string }) {
  const W = 320, H = 120, pad = 18, max = Math.max(1, ...data.map((d) => d.value));
  const bw = (W - pad) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label={label} className="w-full h-auto max-w-md">
      <line x1={pad} y1={H} x2={W} y2={H} stroke="var(--c-line)" />
      {data.map((d, i) => {
        const bh = Math.round((d.value / max) * (H - 18));
        const x = pad + i * bw + bw * 0.15;
        return (
          <g key={i}>
            <rect x={x} y={H - bh} width={bw * 0.7} height={Math.max(bh, d.value > 0 ? 2 : 0)} rx="3" fill="var(--c-accent)"><title>{`${d.label}: ${d.value} ${unit}`}</title></rect>
            {d.value > 0 && <text x={x + bw * 0.35} y={H - bh - 4} textAnchor="middle" fontSize="10" fill="var(--c-muted)">{d.value}</text>}
            <text x={x + bw * 0.35} y={H + 13} textAnchor="middle" fontSize="9" fill="var(--c-muted)">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** One stacked bar split into labelled coloured parts. */
export function StackBar({ parts, label }: { parts: Array<{ label: string; value: number; color: string }>; label: string }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  return (
    <div>
      <div role="img" aria-label={`${label}: ${parts.map((p) => `${p.value} ${p.label}`).join(', ')}`} className="flex h-3 rounded-full overflow-hidden bg-surface2">
        {total > 0 && parts.filter((p) => p.value > 0).map((p) => <div key={p.label} style={{ width: (p.value / total) * 100 + '%', background: p.color }} />)}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-muted">
        {parts.map((p) => <li key={p.label} className="inline-flex items-center gap-1"><span aria-hidden className="size-2 rounded-full" style={{ background: p.color }} />{p.label} {p.value}</li>)}
      </ul>
    </div>
  );
}
