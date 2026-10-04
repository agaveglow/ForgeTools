import { describe, expect, test } from 'bun:test';
import { BLOCKS, cleanLinks, isExternal, moveBlock, normalizeLinkTarget, resolveBlocks, shapeStyle, toggleBlock } from '../../src/lib/glance';

describe('home layout', () => {
  test('default order holds every block, none hidden', () => {
    const r = resolveBlocks(undefined);
    expect(r.map((b) => b.id)).toEqual(BLOCKS.map((b) => b.id));
    expect(r.some((b) => b.hidden)).toBe(false);
  });
  test('old or odd saves still resolve', () => {
    const r = resolveBlocks({ order: ['cards', 'nope', 'cards', 'clock'], hidden: ['legend'] });
    expect(r.map((b) => b.id).slice(0, 2)).toEqual(['cards', 'clock']);
    expect(r.length).toBe(BLOCKS.length);
    expect(r.find((b) => b.id === 'legend')!.hidden).toBe(true);
  });
  test('move and hide', () => {
    const m = moveBlock(undefined, 'quick', -1);
    expect(resolveBlocks(m).map((b) => b.id).indexOf('quick')).toBe(3);
    expect(resolveBlocks(toggleBlock(m, 'apps')).find((b) => b.id === 'apps')!.hidden).toBe(true);
    expect(resolveBlocks(toggleBlock(toggleBlock(undefined, 'apps'), 'apps')).find((b) => b.id === 'apps')!.hidden).toBe(false);
  });
});
describe('quick links', () => {
  test('accepts app pages and https only', () => {
    expect(normalizeLinkTarget('/tasks')).toBe('/tasks');
    expect(normalizeLinkTarget('example.com')).toBe('https://example.com/');
    expect(normalizeLinkTarget('http://example.com')).toBeNull();
    expect(normalizeLinkTarget('javascript:alert(1)')).toBeNull();
    expect(normalizeLinkTarget('//evil.com')).toBe('https://evil.com/');
    expect(normalizeLinkTarget('nodots')).toBeNull();
    expect(isExternal('https://a.com/')).toBe(true);
  });
  test('cleanLinks drops bad ones and fixes icons', () => {
    const out = cleanLinks([{ id: 'a', label: ' Hi  there ', to: '/x', icon: 'zzz' }, { id: 'b', label: 'bad', to: 'javascript:1', icon: 'star' }]);
    expect(out.length).toBe(1); expect(out[0].icon).toBe('star'); expect(out[0].label).toBe('Hi there');
  });
  test('shapes', () => {
    expect(shapeStyle('hex', 60).clipPath).toContain('polygon');
    expect(shapeStyle('pill', 60).width).toBeGreaterThan(60);
    expect(shapeStyle(undefined, 60).borderRadius).toBe('9999px');
  });
});
