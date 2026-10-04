import { GLANCE_ICONS } from '../lib/glance';

export const HUE = { accent: 'var(--c-accent)', ok: 'var(--c-ok)', info: 'var(--c-info)', warn: 'var(--c-warn)', bad: 'var(--c-bad)' } as const;
export type Hue = keyof typeof HUE;

export function Icon({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {(GLANCE_ICONS[name] ?? GLANCE_ICONS.file).map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

/** A round, tinted icon holder, like an app on a watch. */
export function RoundIcon({ name, hue, size = 48 }: { name: string; hue: Hue; size?: number }) {
  return (
    <span className="grid place-items-center rounded-full shrink-0 border border-line" style={{ width: size, height: size, color: HUE[hue], background: `color-mix(in srgb, ${HUE[hue]} 20%, var(--c-surface))` }}>
      <Icon name={name} size={Math.round(size * 0.5)} />
    </span>
  );
}
