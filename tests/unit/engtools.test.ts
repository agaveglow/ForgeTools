import { describe, expect, test } from 'bun:test';
import { ENG_GROUPS, ENG_TOOLS } from '../../src/content/engtools';

const BANNED = /360|manchester|hull|kieran|ritarian|itarian|\beset\b|barracuda|aptem|kyocera|ricoh|skillsforall|cisco|powercert|youtube|lucidchart|datto|n-able|atera|splashtop|teamviewer|anydesk/i;

describe('engineer tool guide', () => {
  test('complete, unique and grouped', () => {
    expect(ENG_TOOLS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(ENG_TOOLS.map(t => t.id)).size).toBe(ENG_TOOLS.length);
    for (const t of ENG_TOOLS) { expect(ENG_GROUPS).toContain(t.group); expect(t.what.length).toBeGreaterThan(20); expect(t.use.length).toBeGreaterThan(20); }
  });
  test('scanning and capture tools carry an authorisation warning', () => {
    for (const id of ['nmap', 'wireshark', 'tor']) expect(ENG_TOOLS.find(t => t.id === id)!.care).toMatch(/authoris|permission|policy/i);
  });
  test('only documentation addresses, no secrets, no employer or vendor names', () => {
    const blob = JSON.stringify(ENG_TOOLS);
    for (const ip of blob.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g) ?? []) expect(/^(192\.0\.2\.|0\.0\.0\.0|127\.)/.test(ip) || ip === '192.0.2.0').toBe(true);
    expect(BANNED.test(blob)).toBe(false);
  });
});
