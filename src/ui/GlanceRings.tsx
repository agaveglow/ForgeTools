import type { GlanceRingDesign } from '../data/types';
import { ringDash, ringFraction } from '../lib/glance';

export interface RingData { id: string; label: string; v: number; m: number; color: string }

const GEOM: Record<'classic' | 'thin' | 'bold' | 'dots' | 'segments', { r: number[]; w: number }> = {
  classic: { r: [88, 68, 48], w: 14 }, thin: { r: [90, 76, 62], w: 7 }, bold: { r: [86, 62, 38], w: 20 }, dots: { r: [90, 74, 58], w: 7 }, segments: { r: [90, 72, 54], w: 11 },
};

/** The clock face with the three progress rings in one of several designs. Decorative: the parent link carries the text. */
export function RingFace({ rings, design, time, date, clockColor, hideDate }: { rings: RingData[]; design: GlanceRingDesign; time: string; date: string; clockColor?: string; hideDate?: boolean }) {
  if (design === 'bars') {
    return (
      <svg viewBox="0 0 200 200" className="w-full h-auto" aria-hidden="true">
        <text x="100" y="56" textAnchor="middle" dominantBaseline="central" fontSize="34" fontWeight="600" fill={clockColor ?? 'var(--c-ink)'} data-testid="glance-time">{time}</text>
        {!hideDate && <text x="100" y="82" textAnchor="middle" fontSize="11" fill="var(--c-muted)">{date}</text>}
        {rings.map((r, i) => (
          <g key={r.id} transform={`translate(20 ${108 + i * 28})`}>
            <rect width="160" height="12" rx="6" fill="var(--c-surface2)" />
            {ringFraction(r.v, r.m) > 0 && <rect width={160 * ringFraction(r.v, r.m)} height="12" rx="6" fill={r.color} />}
          </g>
        ))}
      </svg>
    );
  }
  const g = GEOM[design];
  return (
    <svg viewBox="0 0 200 200" className="w-full h-auto" aria-hidden="true">
      {rings.map((r, i) => {
        const rad = g.r[i], f = ringFraction(r.v, r.m), c = 2 * Math.PI * rad;
        if (design === 'dots' || design === 'segments') {
          const n = design === 'dots' ? 28 - i * 3 : 16 - i * 2, lit = Math.round(f * n), pitch = c / n;
          const seg = design === 'dots' ? 0.01 : pitch * 0.78;
          return (
            <g key={r.id} transform="rotate(-90 100 100)">
              {Array.from({ length: n }, (_, k) => (
                <circle key={k} cx="100" cy="100" r={rad} fill="none" stroke={k < lit ? r.color : 'var(--c-surface2)'} strokeWidth={g.w} strokeLinecap={design === 'dots' ? 'round' : 'butt'} strokeDasharray={`${seg} ${c - seg}`} strokeDashoffset={-k * pitch} />
              ))}
            </g>
          );
        }
        return (
          <g key={r.id} transform="rotate(-90 100 100)">
            <circle cx="100" cy="100" r={rad} fill="none" stroke="var(--c-surface2)" strokeWidth={g.w} />
            {f > 0 && <circle cx="100" cy="100" r={rad} fill="none" stroke={r.color} strokeWidth={g.w} strokeLinecap="round" strokeDasharray={ringDash(rad, f)} style={{ transition: 'stroke-dasharray .6s ease' }} />}
          </g>
        );
      })}
      <text x="100" y={hideDate ? 100 : 98} textAnchor="middle" dominantBaseline="central" fontSize={design === 'bold' ? 20 : 25} fontWeight="600" fill={clockColor ?? 'var(--c-ink)'} data-testid="glance-time">{time}</text>
      {!hideDate && <text x="100" y="120" textAnchor="middle" fontSize="9.5" fill="var(--c-muted)">{date}</text>}
    </svg>
  );
}
