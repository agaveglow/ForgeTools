import { describe, expect, test } from 'bun:test';
import { resolveLayout, toLayout, moveWidget, WIDGETS } from '../../src/lib/widgets';
import { accentFor, contrast, lookVars, normalizeHex, readableInk } from '../../src/lib/look';
import { iconFor, layoutDiagram } from '../../src/lib/visual';
import { heatmapWeeks, weeklyHoursSeries } from '../../src/lib/progress';

describe('dashboard layout', () => {
  test('defaults include every widget once', () => {
    const l = resolveLayout(undefined);
    expect(l.map((w) => w.id).sort()).toEqual(WIDGETS.map((w) => w.id).sort());
    expect(l.every((w) => !w.hidden)).toBe(true);
  });
  test('drops unknown ids, appends new ones, keeps renames, sizes and hidden', () => {
    const l = resolveLayout({ order: ['today', 'ghost', 'quick'], hidden: ['quick'], sizes: { today: 3 }, titles: { today: 'My day' } });
    expect(l[0]).toMatchObject({ id: 'today', title: 'My day', size: 3 });
    expect(l[1]).toMatchObject({ id: 'quick', hidden: true });
    expect(l.length).toBe(WIDGETS.length);
    expect(l.find((w) => w.id === 'ghost')).toBeUndefined();
  });
  test('toLayout stores only differences from default', () => {
    const t = toLayout(resolveLayout(undefined));
    expect(t.sizes).toEqual({});
    expect(t.titles).toEqual({});
  });
  test('move skips hidden widgets', () => {
    const l = resolveLayout({ order: ['a-none', 'today', 'rings', 'week'], hidden: ['rings'] });
    const m = moveWidget(l, 'week', -1);
    const vis = m.filter((w) => !w.hidden).map((w) => w.id);
    expect(vis.indexOf('week')).toBeLessThan(vis.indexOf('today'));
    expect(moveWidget(l, 'today', -1)).toEqual(l);
  });
});

describe('appearance', () => {
  test('hex handling', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex('zzz')).toBeUndefined();
  });
  test('readable ink', () => {
    expect(readableInk('#ffffff')).toBe('#111111');
    expect(readableInk('#000000')).toBe('#ffffff');
  });
  test('faint colours are corrected so they stay visible', () => {
    const l = accentFor('#fff176', 'light');
    expect(l.adjusted).toBe(true);
    expect(contrast(l.accent, '#ffffff')).toBeGreaterThanOrEqual(3);
    const d = accentFor('#101010', 'dark');
    expect(contrast(d.accent, '#16181b')).toBeGreaterThanOrEqual(3);
    expect(accentFor('#2563eb', 'light').adjusted).toBe(false);
  });
  test('default look sets nothing', () => {
    const v = lookVars({});
    expect(Object.keys(v.common).length + Object.keys(v.light).length).toBe(0);
    expect(lookVars({ textScale: 'xl', corners: 'round' }).common['font-size']).toBe('19px');
  });
});

describe('visuals', () => {
  test('icons follow wording', () => {
    expect(iconFor({ text: 'Run the command', commands: ['ping x'] })).toBe('terminal');
    expect(iconFor({ text: 'Clear the paper jam in tray 2', commands: [] })).toBe('printer');
    expect(iconFor({ text: 'Do not power off during the update', commands: [] })).toBe('warning');
    expect(iconFor({ text: 'Hmm', commands: [] })).toBe('step');
  });
  test('photo steps get taller nodes', () => {
    const m = { title: 't', cautions: [], steps: [{ n: 1, text: 'Open the panel', commands: [], caution: false }, { n: 2, text: 'Close it', commands: [], caution: false }] };
    const a = layoutDiagram(m).height, b = layoutDiagram(m, 29, 4, new Set([1])).height;
    expect(b).toBeGreaterThan(a + 60);
  });
  test('heatmap shape and chart data', () => {
    const now = new Date(2026, 9, 3);
    const w = heatmapWeeks(new Map([['2026-10-02', 2]]), now, 12);
    expect(w.length).toBe(12);
    expect(w.every((c) => c.length === 7)).toBe(true);
    expect(w.flat().find((c) => c.date === '2026-10-02')?.count).toBe(2);
    expect(w[11].some((c) => c.future)).toBe(true);
    expect(weeklyHoursSeries([], now, 8).length).toBe(8);
  });
});

import { daysUntil, blankWidget } from '../../src/ui/CustomWidgets';
describe('custom cards', () => {
  test('appear in the layout, keep position, vanish when deleted', () => {
    const customs = [{ id: 'c1', title: 'Mine' }];
    const l = resolveLayout({ order: ['c1', 'today'] }, customs);
    expect(l[0]).toMatchObject({ id: 'c1', title: 'Mine', size: 1 });
    expect(l.length).toBe(WIDGETS.length + 1);
    expect(resolveLayout({ order: ['c1', 'today'] }, []).find((w) => w.id === 'c1')).toBeUndefined();
  });
  test('layout does not store titles for custom cards', () => {
    const l = resolveLayout(undefined, [{ id: 'c1', title: 'Mine' }]);
    expect(toLayout(l).titles).toEqual({});
  });
  test('countdown', () => {
    expect(daysUntil('2026-10-10', new Date(2026, 9, 3))).toBe(7);
    expect(daysUntil('2026-10-01', new Date(2026, 9, 3))).toBe(-2);
    expect(daysUntil('', new Date())).toBeUndefined();
  });
  test('blank cards have sensible defaults', () => {
    expect(blankWidget('progress')).toMatchObject({ value: 0, target: 10 });
    expect(blankWidget('checklist').items).toEqual([]);
  });
});
