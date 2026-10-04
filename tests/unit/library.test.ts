import { describe, expect, test } from 'bun:test';
import { ALL_GUIDES, guideText } from '../../src/content/library';
import { ROADMAP } from '../../src/content/roadmap';
import { hasBlockers, scanText } from '../../src/lib/sensitive';

const blob = (JSON.stringify(ALL_GUIDES) + JSON.stringify(ROADMAP));
describe('built-in library', () => {
  test('ids are unique and every guide has content', () => {
    const ids = ALL_GUIDES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of ALL_GUIDES) { expect(g.blocks.length).toBeGreaterThan(1); expect(g.summary.length).toBeGreaterThan(20); }
  });
  test('no secrets, addresses or contact details are shipped', () => {
    for (const g of ALL_GUIDES) expect(scanText(guideText(g)).filter((f) => f.severity === 'block' || f.kind === 'ip' || f.kind === 'email' || f.kind === 'phone')).toEqual([]);
    expect(hasBlockers(scanText(guideText(ALL_GUIDES[0])))).toBe(false);
  });
  test('no employer, customer, vendor-platform or training-provider names', () => {
    const banned = /360|manchester|hull|kieran|ritarian|itarian|\beset\b|barracuda|aptem|kyocera|ricoh|skillsforall|cisco|powercert|youtube|lucidchart|datto|n-able|atera|splashtop|teamviewer|anydesk/i;
    expect(blob.match(banned)).toBeNull();
  });
  test('roadmap has unique titles per group', () => {
    const k = ROADMAP.map((g) => `${g.group}|${g.title}`);
    expect(new Set(k).size).toBe(k.length);
    expect(ROADMAP.length).toBeGreaterThan(40);
  });
});
