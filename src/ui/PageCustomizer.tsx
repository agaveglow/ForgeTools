import { Children, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { store, useSettings } from '../data/hooks';
import type { PageLayout } from '../data/types';
import { BLOCK_FONTS, BLOCK_SHAPES, BLOCK_SIZES, frameStyle, isCustomised, moveBlockIn, renameBlockIn, resolveLayout, styleBlockIn, toggleBlockIn } from '../lib/pagelayout';
import { scanText } from '../lib/sensitive';
import { clsx } from '../lib/util';
import { ColourField } from './ColourField';
import { Button, Select, TextInput } from './primitives';

export interface PageBlock { id: string; title: string; render: (title: string) => ReactNode; /** False when the block's heading is fixed inside the page, so renaming would not show. */ renamable?: boolean }

// Edit mode is shared by every group of blocks on one page, so a page made of several runs has one switch.
const editing = new Map<string, boolean>();
const listeners = new Set<() => void>();
function useEditing(group: string): [boolean, (v: boolean) => void] {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return [!!editing.get(group), (v) => { editing.set(group, v); listeners.forEach((f) => f()); }];
}

/** A named part of a page, for use inside <Blocks>. Renders its children unchanged. */
export function Block({ children }: { title: string; id?: string; children?: ReactNode }) { return <>{children}</>; }

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'block';

/** Children-mode helper: each <Block title="..."> child becomes a movable, hideable, restylable part. */
export function Blocks({ pageKey, group, toolbar = true, className, label, children }: { pageKey: string; group?: string; toolbar?: boolean; className?: string; label?: string; children?: ReactNode }) {
  const seen = new Set<string>();
  const blocks: PageBlock[] = [];
  for (const c of Children.toArray(children) as Array<{ props?: { title?: string; id?: string; children?: ReactNode } }>) {
    const t = c?.props?.title; if (!t) continue;
    let id = c.props?.id ?? slug(t); while (seen.has(id)) id += '-2'; seen.add(id);
    const inner = c.props?.children;
    blocks.push({ id, title: t, renamable: false, render: () => inner });
  }
  return <PageCustomizer pageKey={pageKey} group={group} toolbar={toolbar} className={className} label={label} blocks={blocks} />;
}

/**
 * Wraps a page's blocks so each can be moved, hidden, renamed and restyled. `pageKey` names the saved layout.
 * `as="ul"` renders the blocks as list items. Settings stay on this device; renamed titles go through the sensitive-text check.
 */
export function PageCustomizer({ pageKey, blocks, as = 'div', className, label = 'this page', group, toolbar = true }: { pageKey: string; blocks: PageBlock[]; as?: 'div' | 'ul'; className?: string; label?: string; group?: string; toolbar?: boolean }) {
  const settings = useSettings();
  const saved: PageLayout | undefined = settings.pageLayouts?.[pageKey];
  const [isEditing, setEditing] = useEditing(group ?? pageKey);
  const [warn, setWarn] = useState('');
  const save = (next: PageLayout | undefined) => {
    const all = { ...(settings.pageLayouts ?? {}) };
    if (next) all[pageKey] = next; else delete all[pageKey];
    store.updateSettings({ pageLayouts: Object.keys(all).length ? all : undefined });
  };
  const refs = blocks.map((b) => ({ id: b.id, title: b.title }));
  const layout = resolveLayout(refs, saved);
  const Wrap = as, Item = as === 'ul' ? 'li' : 'div';
  const rename = (id: string, v: string) => {
    if (scanText(v).length) { setWarn('That looks like customer or secret details. Keep titles generic.'); return; }
    setWarn(''); save(renameBlockIn(saved, id, v));
  };
  return (
    <div data-testid={`customizer-${pageKey}`}>
      {toolbar && <div className="flex items-center justify-end gap-2 mb-2">
        <button type="button" aria-pressed={isEditing} onClick={() => setEditing(!isEditing)} data-testid="customize-toggle" className="min-h-9 px-3 rounded-full border border-line text-sm text-muted hover:text-ink hover:bg-surface2">{isEditing ? 'Done' : 'Customise page'}</button>
      </div>}
      {isEditing && toolbar && <p role="status" className="text-sm rounded-sm border border-accent/50 bg-accent/5 p-2.5 mb-3">Customising {label}. Move, hide, rename or restyle each part. It saves as you go and stays on this device. Keep titles free of customer details.</p>}
      {isEditing && isCustomised(saved) && <div className="mb-2"><Button size="sm" variant="ghost" onClick={() => { save(undefined); setWarn(''); }}>Reset page</Button></div>}
      {warn && <p role="alert" className="text-sm text-bad mb-2">{warn}</p>}
      <Wrap className={className}>
        {layout.map((b, i) => {
          const def = blocks.find((x) => x.id === b.id)!;
          const { style, framed } = frameStyle(b.style);
          if (b.hidden && !isEditing) return null;
          return (
            <Item key={b.id} data-block={b.id} className={clsx(isEditing && 'rounded-xl border border-dashed border-accent/60 p-2', b.hidden && 'opacity-50')}>
              {isEditing && (
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  <span className="text-xs font-semibold flex-1 min-w-0 wrap-any">{b.shownTitle}{b.hidden ? ' (hidden)' : ''}</span>
                  <button type="button" disabled={i === 0} aria-label={`Move ${b.shownTitle} up`} onClick={() => save(moveBlockIn(refs, saved, b.id, -1))} className="min-h-9 min-w-9 rounded-md border border-line text-sm disabled:opacity-40">↑</button>
                  <button type="button" disabled={i === layout.length - 1} aria-label={`Move ${b.shownTitle} down`} onClick={() => save(moveBlockIn(refs, saved, b.id, 1))} className="min-h-9 min-w-9 rounded-md border border-line text-sm disabled:opacity-40">↓</button>
                  <button type="button" aria-label={`${b.hidden ? 'Show' : 'Hide'} ${b.shownTitle}`} onClick={() => save(toggleBlockIn(saved, b.id))} className="min-h-9 px-2 rounded-md border border-line text-xs">{b.hidden ? 'Show' : 'Hide'}</button>
                  <details className="w-full"><summary className="cursor-pointer min-h-9 flex items-center text-sm">Style and name</summary>
                    <div className="space-y-2 pt-1">
                      {def.renamable !== false && <label className="block text-sm font-medium">Title<TextInput aria-label={`Title of ${def.title}`} defaultValue={saved?.titles?.[b.id] ?? ''} placeholder={def.title} maxLength={40} onBlur={(e: { target: { value: string } }) => rename(b.id, e.target.value)} /></label>}
                      <label className="block text-sm font-medium">Shape<Select aria-label={`Shape of ${b.shownTitle}`} value={b.style.shape ?? ''} onChange={(e: { target: { value: string } }) => save(styleBlockIn(saved, b.id, { shape: (e.target.value || undefined) as never }))}><option value="">As designed</option>{BLOCK_SHAPES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select></label>
                      <label className="block text-sm font-medium">Font<Select aria-label={`Font of ${b.shownTitle}`} value={b.style.font ?? ''} onChange={(e: { target: { value: string } }) => save(styleBlockIn(saved, b.id, { font: (e.target.value || undefined) as never }))}><option value="">As designed</option>{BLOCK_FONTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select></label>
                      <label className="block text-sm font-medium">Text size<Select aria-label={`Text size of ${b.shownTitle}`} value={b.style.size ?? ''} onChange={(e: { target: { value: string } }) => save(styleBlockIn(saved, b.id, { size: (e.target.value || undefined) as never }))}><option value="">As designed</option>{BLOCK_SIZES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select></label>
                      <ColourField label={`Colour of ${b.shownTitle}`} value={b.style.color} onChange={(c) => save(styleBlockIn(saved, b.id, { color: c }))} />
                    </div>
                  </details>
                </div>
              )}
              <div data-framed={framed || undefined} style={style}>{def.render(b.shownTitle)}</div>
            </Item>
          );
        })}
      </Wrap>
    </div>
  );
}
