import { ALL_GUIDES, guideText } from '../content/library';
import type { LibGuide } from '../content/library';
import { WORKFLOWS } from '../content/workflows';
import type { KbEntry } from '../data/types';

/** One list for every kind of guide. Built-in guides are read-only; editing one makes the person's own copy. */
export type GuideSource = 'procedure' | 'study' | 'flow' | 'mine';
export interface GuideItem {
  key: string; to: string; title: string; summary: string; tags: string[]; source: GuideSource;
  /** Built-in guide the person has edited. */
  edited?: boolean; basedOn?: string; hasPhotos?: boolean; updatedAt?: string;
}

export const SOURCE_LABEL: Record<GuideSource, string> = { procedure: 'Procedures', study: 'Study', flow: 'Troubleshooting', mine: 'Mine' };
const ORDER: GuideSource[] = ['procedure', 'study', 'flow', 'mine'];

const firstLines = (body: string): string => {
  const lines = body.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  const l = lines.find((x, i) => i > 0 && !/^[A-Z][A-Z0-9 ,&/'’-]{2,}$/.test(x) && !/^\d+\./.test(x) && !x.startsWith('```')) ?? '';
  return l.length > 160 ? l.slice(0, 157) + '...' : l;
};

export const copyOf = (kb: KbEntry[], builtinId: string): KbEntry | undefined => kb.find((k) => k.basedOn === builtinId);

export function buildItems(kb: KbEntry[]): GuideItem[] {
  const items: GuideItem[] = [];
  for (const g of ALL_GUIDES) {
    const source: GuideSource = g.set === 'procedures' ? 'procedure' : 'study';
    const c = copyOf(kb, g.id);
    if (c) items.push({ key: 'kb:' + c.id, to: '/kb/' + c.id, title: c.title, summary: firstLines(c.body) || g.summary, tags: c.tags, source, edited: true, basedOn: g.id, hasPhotos: !!c.images?.length, updatedAt: c.updatedAt });
    else items.push({ key: g.id, to: `/${g.set === 'procedures' ? 'procedures' : 'library'}/${g.id}`, title: g.title, summary: g.summary, tags: g.tags, source });
  }
  for (const w of WORKFLOWS) items.push({ key: 'flow:' + w.id, to: '/troubleshoot/' + w.id, title: w.title, summary: w.summary, tags: w.tags, source: 'flow' });
  const builtinIds = new Set(ALL_GUIDES.map((g) => g.id));
  for (const k of kb) {
    if (k.basedOn && builtinIds.has(k.basedOn)) continue;
    items.push({ key: 'kb:' + k.id, to: '/kb/' + k.id, title: k.title, summary: firstLines(k.body), tags: k.tags, source: 'mine', hasPhotos: !!k.images?.length, updatedAt: k.updatedAt });
  }
  return items.sort((a, b) => ORDER.indexOf(a.source) - ORDER.indexOf(b.source) || (a.source === 'mine' ? (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') : a.title.localeCompare(b.title)));
}

export function filterItems(items: GuideItem[], source: GuideSource | 'all' | 'edited', q: string): GuideItem[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((i) => (source === 'all' || (source === 'edited' ? !!i.edited : i.source === source)) && (!words.length || words.every((w) => `${i.title} ${i.summary} ${i.tags.join(' ')}`.toLowerCase().includes(w))));
}

/** The editable copy of a built-in guide. Same words, as plain text the editor and the visual guide both understand. */
export function copyFromGuide(g: LibGuide): Pick<KbEntry, 'title' | 'category' | 'tags' | 'body' | 'pinned' | 'basedOn'> {
  return { title: g.title, category: g.set === 'procedures' ? 'Procedures' : 'References', tags: [...g.tags], body: guideText(g), pinned: false, basedOn: g.id };
}
