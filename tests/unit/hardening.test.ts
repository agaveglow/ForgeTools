import { describe, expect, test } from 'bun:test';
import { ALERT_TYPES, HARDENING, PHISHING } from '../../src/content/hardening';
import { scanText } from '../../src/lib/sensitive';
const BANNED = /360|manchester|hull|kieran|ritarian|itarian|\beset\b|barracuda|aptem|kyocera|ricoh|skillsforall|cisco|powercert|youtube|lucidchart|datto|n-able|atera|splashtop|teamviewer|anydesk/i;
describe('hardening content', () => {
  test('lists are unique, generic and scan clean', () => {
    const all = [...HARDENING, PHISHING];
    expect(new Set(all.map((l) => l.id)).size).toBe(all.length);
    for (const l of all) { expect(l.items.length).toBeGreaterThan(8); expect(new Set(l.items).size).toBe(l.items.length);
      const t = l.title + l.intro + l.items.join(' '); expect(BANNED.test(t)).toBe(false); expect(scanText(t)).toEqual([]); }
    for (const a of ALERT_TYPES) expect(BANNED.test(a.join(' '))).toBe(false);
  });
});
