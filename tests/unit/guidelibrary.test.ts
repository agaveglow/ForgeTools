import { describe, expect, test } from 'bun:test';
import { ALL_GUIDES, guideText } from '../../src/content/library';
import { WORKFLOWS } from '../../src/content/workflows';
import type { KbEntry } from '../../src/data/types';
import { buildItems, copyFromGuide, copyOf, filterItems } from '../../src/lib/guideLibrary';
import { modelFromText } from '../../src/lib/visual';

const kbe = (o: Partial<KbEntry>): KbEntry => ({ id: 'k1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z', title: 'Mine', category: 'Procedures', tags: [], body: 'Mine\n\nA summary line.\n\nSTEPS\n1. One\n2. Two', pinned: false, ...o });

describe('merged guide library', () => {
  test('lists every built-in guide and flow once, then the person\'s own', () => {
    const items = buildItems([kbe({})]);
    expect(items.length).toBe(ALL_GUIDES.length + WORKFLOWS.length + 1);
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
    expect(items.filter((i) => i.source === 'mine').map((i) => i.title)).toEqual(['Mine']);
    expect(items[0].source).toBe('procedure');
    expect(items.find((i) => i.source === 'flow')!.to).toMatch(/^\/troubleshoot\//);
  });
  test('an edited copy replaces its original instead of appearing twice', () => {
    const g = ALL_GUIDES[0];
    const copy = kbe({ id: 'c1', title: g.title + ' (mine)', basedOn: g.id });
    const items = buildItems([copy]);
    expect(items.length).toBe(ALL_GUIDES.length + WORKFLOWS.length);
    const it = items.find((i) => i.basedOn === g.id)!;
    expect(it.edited).toBe(true); expect(it.to).toBe('/kb/c1'); expect(it.title).toContain('(mine)');
    expect(items.some((i) => i.key === g.id)).toBe(false);
    expect(copyOf([copy], g.id)?.id).toBe('c1');
    expect(filterItems(items, 'edited', '').length).toBe(1);
  });
  test('an orphaned copy (original removed from the app) still shows as mine', () => {
    const items = buildItems([kbe({ id: 'o1', basedOn: 'no-such-guide' })]);
    expect(items.some((i) => i.key === 'kb:o1' && i.source === 'mine')).toBe(true);
  });
  test('filter and search', () => {
    const items = buildItems([kbe({})]);
    expect(filterItems(items, 'mine', '').length).toBe(1);
    expect(filterItems(items, 'flow', '').length).toBe(WORKFLOWS.length);
    expect(filterItems(items, 'all', 'zzzzqqq').length).toBe(0);
    expect(filterItems(items, 'all', 'MINE summary').map((i) => i.title)).toEqual(['Mine']);
    expect(filterItems(items, 'procedure', 'shared mailbox').length).toBeGreaterThan(0);
  });
  test('copy keeps the same words and still reads as steps', () => {
    for (const g of ALL_GUIDES) {
      const c = copyFromGuide(g);
      expect(c.basedOn).toBe(g.id); expect(c.body).toBe(guideText(g)); expect(c.tags).toEqual(g.tags);
      const steps = g.blocks.filter((b) => b.kind === 'steps').reduce((n, b) => n + (b.kind === 'steps' ? b.items.length : 0), 0);
      if (steps >= 2) expect(modelFromText(c.title, c.body).steps.length).toBeGreaterThanOrEqual(2);
    }
  });
});
