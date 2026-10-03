/**
 * Appearance: accent colour, text size, font and corner style. Pure helpers plus one function that applies
 * the result to the page. Only presentation settings live here, nothing about work or customers.
 */
export type TextScale = 'sm' | 'md' | 'lg' | 'xl';
export type FontStyle = 'sans' | 'serif' | 'mono';
export type Corners = 'sharp' | 'soft' | 'round';

export interface LookSettings { accent?: string; textScale?: TextScale; fontStyle?: FontStyle; corners?: Corners }

export const ACCENT_PRESETS: Array<{ id: string; label: string; hex: string }> = [
  { id: 'forge', label: 'Forge orange', hex: '#d9531e' },
  { id: 'blue', label: 'Blue', hex: '#2563eb' },
  { id: 'teal', label: 'Teal', hex: '#0d9488' },
  { id: 'green', label: 'Green', hex: '#16a34a' },
  { id: 'purple', label: 'Purple', hex: '#7c3aed' },
  { id: 'pink', label: 'Pink', hex: '#db2777' },
  { id: 'red', label: 'Red', hex: '#dc2626' },
  { id: 'slate', label: 'Slate', hex: '#475569' },
];

export const TEXT_SCALES: Record<TextScale, { label: string; px: number }> = {
  sm: { label: 'Small', px: 13.5 }, md: { label: 'Default', px: 15 }, lg: { label: 'Large', px: 17 }, xl: { label: 'Extra large', px: 19 },
};
export const FONT_STACKS: Record<FontStyle, { label: string; stack: string }> = {
  sans: { label: 'Clean', stack: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" },
  serif: { label: 'Readable serif', stack: "ui-serif, Georgia, 'Times New Roman', serif" },
  mono: { label: 'Technical', stack: "ui-monospace, 'Cascadia Code', 'JetBrains Mono', SFMono-Regular, Menlo, Consolas, monospace" },
};
export const CORNER_RADII: Record<Corners, { label: string; xs: string; sm: string; md: string }> = {
  sharp: { label: 'Sharp', xs: '0px', sm: '0px', md: '0px' },
  soft: { label: 'Soft', xs: '2px', sm: '4px', md: '6px' },
  round: { label: 'Round', xs: '6px', sm: '10px', md: '16px' },
};

export const normalizeHex = (s: string | undefined): string | undefined => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((s ?? '').trim());
  if (!m) return undefined;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return '#' + h.toLowerCase();
};

type RGB = [number, number, number];
const toRgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
const toHex = (c: RGB) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
export const luminance = (hex: string): number => { const [r, g, b] = toRgb(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
export const contrast = (a: string, b: string): number => { const la = luminance(a), lb = luminance(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
const mix = (hex: string, withHex: string, t: number): string => { const a = toRgb(hex), b = toRgb(withHex); return toHex([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as RGB); };

/** Text colour that is readable on the given background. */
export const readableInk = (bg: string): string => (contrast(bg, '#ffffff') >= contrast(bg, '#111111') ? '#ffffff' : '#111111');

const SURFACE = { light: '#ffffff', dark: '#16181b' } as const;

/**
 * Adjusts a chosen colour until it is clearly visible (3:1, the minimum for icons and outlines) against the
 * theme's surface, so a custom colour can never make the app unreadable. Returns the accent and its text colour.
 */
export function accentFor(hex: string, theme: 'light' | 'dark'): { accent: string; ink: string; adjusted: boolean } {
  let c = hex;
  const toward = theme === 'light' ? '#000000' : '#ffffff';
  for (let i = 0; i < 20 && contrast(c, SURFACE[theme]) < 3; i++) c = mix(c, toward, 0.1);
  return { accent: c, ink: readableInk(c), adjusted: c !== hex };
}

export type VarMap = Record<string, string>;

/** Everything the page needs for a look, per theme. */
export function lookVars(look: LookSettings): { common: VarMap; light: VarMap; dark: VarMap } {
  const common: VarMap = {};
  const scale = TEXT_SCALES[look.textScale ?? 'md'];
  if (look.textScale && look.textScale !== 'md') common['font-size'] = scale.px + 'px';
  if (look.fontStyle && look.fontStyle !== 'sans') common['--ft-font'] = FONT_STACKS[look.fontStyle].stack;
  if (look.corners && look.corners !== 'soft') {
    const r = CORNER_RADII[look.corners];
    common['--r-xs'] = r.xs; common['--r-sm'] = r.sm; common['--r-md'] = r.md;
  }
  const hex = normalizeHex(look.accent);
  const light: VarMap = {}, dark: VarMap = {};
  if (hex) {
    const l = accentFor(hex, 'light'), d = accentFor(hex, 'dark');
    light['--c-accent'] = l.accent; light['--c-accent-ink'] = l.ink;
    dark['--c-accent'] = d.accent; dark['--c-accent-ink'] = d.ink;
  }
  return { common, light, dark };
}

const MANAGED = ['font-size', '--ft-font', '--r-xs', '--r-sm', '--r-md', '--c-accent', '--c-accent-ink'];
export const LOOK_KEY = 'forgetools:look';

/** Applies a look to the page and remembers it so the next load can apply it before first paint. */
export function applyLook(look: LookSettings, theme: 'light' | 'dark', root: HTMLElement = document.documentElement): void {
  const v = lookVars(look);
  for (const k of MANAGED) root.style.removeProperty(k);
  for (const [k, val] of Object.entries({ ...v.common, ...(theme === 'light' ? v.light : v.dark) })) root.style.setProperty(k, val);
  try {
    if (Object.keys(v.common).length + Object.keys(v.light).length === 0) localStorage.removeItem(LOOK_KEY);
    else localStorage.setItem(LOOK_KEY, JSON.stringify(v));
  } catch { /* storage unavailable */ }
}
