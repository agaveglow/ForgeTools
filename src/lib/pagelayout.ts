/** Arrange and restyle the blocks of any page. Pure helpers; the UI is in ui/PageCustomizer.tsx. Presentation only, nothing about work or customers. */
import type { PageBlockStyle, PageLayout } from '../data/types';
import { normalizeHex } from './look';
import { moveItem } from './glance';

export const BLOCK_SHAPES: Array<{ id: NonNullable<PageBlockStyle['shape']>; label: string }> = [
  { id: 'rounded', label: 'Rounded' }, { id: 'sharp', label: 'Sharp' }, { id: 'pill', label: 'Very round' }, { id: 'outline', label: 'Outline' },
];
export const BLOCK_FONTS: Array<{ id: NonNullable<PageBlockStyle['font']>; label: string; stack: string }> = [
  { id: 'sans', label: 'Clean', stack: "'Inter', ui-sans-serif, system-ui, sans-serif" },
  { id: 'serif', label: 'Serif', stack: "ui-serif, Georgia, 'Times New Roman', serif" },
  { id: 'mono', label: 'Technical', stack: "ui-monospace, 'Cascadia Code', SFMono-Regular, Menlo, Consolas, monospace" },
  { id: 'rounded', label: 'Rounded', stack: "ui-rounded, 'SF Pro Rounded', 'Nunito', 'Segoe UI', system-ui, sans-serif" },
];
export const BLOCK_SIZES: Array<{ id: NonNullable<PageBlockStyle['size']>; label: string; px: number }> = [
  { id: 'sm', label: 'Small', px: 13 }, { id: 'md', label: 'Normal', px: 0 }, { id: 'lg', label: 'Large', px: 17 },
];

export interface BlockRef { id: string; title: string }
export interface ResolvedBlock extends BlockRef { shownTitle: string; hidden: boolean; style: PageBlockStyle }

export const cleanTitle = (s: string): string => s.replace(/\s+/g, ' ').trim().slice(0, 40);

/** Saved order first (unknown ids dropped), then any block the save does not know about, in its natural place at the end. */
export function resolveLayout(blocks: BlockRef[], saved: PageLayout | undefined): ResolvedBlock[] {
  const ids = blocks.map((b) => b.id);
  const order = [...(saved?.order ?? []).filter((id, i, a) => ids.includes(id) && a.indexOf(id) === i), ...ids.filter((id) => !(saved?.order ?? []).includes(id))];
  return order.map((id) => {
    const b = blocks.find((x) => x.id === id)!;
    return { ...b, shownTitle: cleanTitle(saved?.titles?.[id] ?? '') || b.title, hidden: !!saved?.hidden?.includes(id), style: saved?.styles?.[id] ?? {} };
  });
}
export function moveBlockIn(blocks: BlockRef[], saved: PageLayout | undefined, id: string, dir: -1 | 1): PageLayout {
  const cur = resolveLayout(blocks, saved).map((b) => ({ id: b.id }));
  return { ...saved, order: moveItem(cur, id, dir).map((b) => b.id) };
}
export function toggleBlockIn(saved: PageLayout | undefined, id: string): PageLayout {
  const h = saved?.hidden ?? [];
  return { ...saved, hidden: h.includes(id) ? h.filter((x) => x !== id) : [...h, id] };
}
export function renameBlockIn(saved: PageLayout | undefined, id: string, title: string): PageLayout {
  const titles = { ...(saved?.titles ?? {}) };
  if (cleanTitle(title)) titles[id] = title.slice(0, 40); else delete titles[id];
  return { ...saved, titles };
}
export function styleBlockIn(saved: PageLayout | undefined, id: string, patch: Partial<PageBlockStyle>): PageLayout {
  const next = { ...(saved?.styles?.[id] ?? {}), ...patch };
  for (const k of Object.keys(next) as Array<keyof PageBlockStyle>) if (next[k] === undefined) delete next[k];
  return { ...saved, styles: { ...(saved?.styles ?? {}), [id]: next } };
}
export const isCustomised = (saved: PageLayout | undefined): boolean => !!saved && (!!saved.order?.length || !!saved.hidden?.length || Object.keys(saved.titles ?? {}).length > 0 || Object.keys(saved.styles ?? {}).some((k) => Object.keys(saved.styles![k]).length));

/** Inline style and class for a block's frame. Empty when nothing was changed so untouched pages look as before. */
export function frameStyle(st: PageBlockStyle): { style: Record<string, string | number>; framed: boolean } {
  const style: Record<string, string | number> = {};
  const c = normalizeHex(st.color);
  const framed = !!(st.shape || c);
  if (framed) {
    const radius = { rounded: '16px', sharp: '0px', pill: '32px', outline: '16px' }[st.shape ?? 'rounded'];
    style.borderRadius = radius; style.padding = '0.6rem'; style.border = `1px solid ${c ?? 'var(--c-line)'}`;
    if (c) { style.borderLeft = `6px solid ${c}`; if (st.shape !== 'outline') style.background = `color-mix(in srgb, ${c} 8%, var(--c-surface))`; }
    else if (st.shape !== 'outline') style.background = 'var(--c-surface)';
  }
  const f = BLOCK_FONTS.find((x) => x.id === st.font); if (f) style.fontFamily = f.stack;
  const z = BLOCK_SIZES.find((x) => x.id === st.size); if (z && z.px) style.fontSize = z.px;
  return { style, framed };
}
