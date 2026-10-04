import { describe, expect, test } from 'bun:test';
import { frameStyle, isCustomised, moveBlockIn, renameBlockIn, resolveLayout, styleBlockIn, toggleBlockIn } from '../../src/lib/pagelayout';

const B = [{ id: 'a', title: 'Alpha' }, { id: 'b', title: 'Beta' }, { id: 'c', title: 'Gamma' }];
describe('page layout', () => {
  test('untouched page keeps natural order and no styling', () => {
    const r = resolveLayout(B, undefined);
    expect(r.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(r.every((x) => !x.hidden && x.shownTitle === x.title)).toBe(true);
    expect(frameStyle({}).framed).toBe(false);
    expect(isCustomised(undefined)).toBe(false);
  });
  test('move, hide, rename, style', () => {
    let l = moveBlockIn(B, undefined, 'c', -1);
    expect(resolveLayout(B, l).map((x) => x.id)).toEqual(['a', 'c', 'b']);
    l = toggleBlockIn(l, 'a'); expect(resolveLayout(B, l)[0].hidden).toBe(true);
    l = toggleBlockIn(l, 'a'); expect(resolveLayout(B, l)[0].hidden).toBe(false);
    l = renameBlockIn(l, 'b', '  My   beta '); expect(resolveLayout(B, l).find((x) => x.id === 'b')!.shownTitle).toBe('My beta');
    l = renameBlockIn(l, 'b', ''); expect(resolveLayout(B, l).find((x) => x.id === 'b')!.shownTitle).toBe('Beta');
    l = styleBlockIn(l, 'a', { shape: 'pill', color: '#2563eb', font: 'serif' });
    const f = frameStyle(resolveLayout(B, l)[0].style);
    expect(f.framed).toBe(true); expect(String(f.style.fontFamily)).toContain('serif'); expect(String(f.style.borderLeft)).toContain('#2563eb');
    expect(isCustomised(l)).toBe(true);
  });
  test('stale saves resolve: unknown ids dropped, new blocks appended', () => {
    const r = resolveLayout(B, { order: ['zzz', 'c', 'c'], hidden: ['gone'] });
    expect(r.map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });
  test('clearing a style removes it', () => {
    const l = styleBlockIn(styleBlockIn(undefined, 'a', { shape: 'sharp' }), 'a', { shape: undefined });
    expect(isCustomised(l)).toBe(false);
  });
});
