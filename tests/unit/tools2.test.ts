import { describe, expect, test } from 'bun:test';
import { PORTS } from '../../src/content/ports';
import { RECORD_TYPES, DNS_COMMANDS } from '../../src/content/dns';
import { OPS_CHECKS } from '../../src/content/checks';
import { checkDmarc, checkSpf } from '../../src/lib/dnsRecords';
import { DEFAULT_GEN, estimateBits, generate, pool, randomBelow } from '../../src/lib/passgen';
import { fromBase64, fromHexText, macFormats, parseTime, toBase64, toHexText, urlDecode, urlEncode, viewTime } from '../../src/lib/convert';
import { scanText } from '../../src/lib/sensitive';
const BANNED = /360|manchester|hull|kieran|ritarian|itarian|\beset\b|barracuda|aptem|kyocera|ricoh|skillsforall|cisco|powercert|youtube|lucidchart|datto|n-able|atera|splashtop|teamviewer|anydesk/i;

describe('reference content', () => {
  test('ports unique and plausible', () => {
    const k = PORTS.map((p) => p.port + p.name); expect(new Set(k).size).toBe(k.length);
    for (const p of PORTS) { expect(p.port).toBeGreaterThan(0); expect(p.port).toBeLessThan(65536); }
    expect(PORTS.find((p) => p.port === 9100)?.name).toBe('Raw printing');
  });
  test('no vendor names or secrets in new content', () => {
    const text = JSON.stringify([PORTS, RECORD_TYPES, DNS_COMMANDS, OPS_CHECKS]);
    expect(BANNED.test(text)).toBe(false);
    for (const l of OPS_CHECKS) { expect(new Set(l.items).size).toBe(l.items.length); expect(scanText(l.items.join(' ')).filter((f) => f.severity === 'block')).toEqual([]); }
  });
});

describe('spf and dmarc', () => {
  test('spf', () => {
    expect((checkSpf('"v=spf1 include:mail.example.net -all"') as any).findings.some((f: any) => f.text.startsWith('Ends with -all'))).toBe(true);
    expect((checkSpf('v=spf1 +all') as any).findings.some((f: any) => f.level === 'bad')).toBe(true);
    expect('error' in (checkSpf('hello') as any)).toBe(true);
  });
  test('dmarc', () => {
    const r = checkDmarc('v=DMARC1; p=none; rua=mailto:r@example.com') as any;
    expect(r.tags.p).toBe('none'); expect(r.findings.some((f: any) => f.level === 'warn')).toBe(true);
    expect((checkDmarc('v=DMARC1; p=reject; rua=mailto:r@example.com') as any).findings.every((f: any) => f.level === 'ok')).toBe(true);
    expect((checkDmarc('v=DMARC1; rua=x') as any).findings[0].level).toBe('bad');
  });
});

describe('password tools', () => {
  test('generate honours length and sets', () => {
    for (let i = 0; i < 40; i++) {
      const p = generate({ ...DEFAULT_GEN, length: 20 }); expect(p.length).toBe(20);
      expect(/[a-z]/.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p)).toBe(true);
      expect(/[Il1O0o|]/.test(p)).toBe(false);
    }
    expect(generate({ ...DEFAULT_GEN, lower: false, upper: false, digits: false, symbols: false })).toBe('');
    expect(/^[0-9]+$/.test(generate({ ...DEFAULT_GEN, lower: false, upper: false, symbols: false }))).toBe(true);
    expect(pool(DEFAULT_GEN).length).toBe(4);
  });
  test('randomBelow stays in range and rejects biased values', () => {
    const seq = [0xffffffff, 7]; let i = 0;
    expect(randomBelow(10, (a) => { a[0] = seq[i++]; return a; })).toBe(7);
    for (let n = 0; n < 200; n++) expect(randomBelow(5)).toBeLessThan(5);
  });
  test('strength estimates', () => {
    expect(estimateBits('password123').label).toBe('Very weak');
    expect(estimateBits('Summer2024!').bits).toBeLessThan(estimateBits(generate({ ...DEFAULT_GEN, length: 20 })).bits);
    expect(estimateBits(generate({ ...DEFAULT_GEN, length: 20 })).label).toMatch(/strong/i);
  });
});

describe('converters', () => {
  test('base64, hex, url', () => {
    expect(toBase64('héllo')).toBe('aMOpbGxv'); expect(fromBase64('aMOpbGxv')).toBe('héllo'); expect(fromBase64('aGk')).toBe('hi'); expect(fromBase64('!!!')).toBeNull();
    expect(toHexText('Hi')).toBe('48 69'); expect(fromHexText('48:69')).toBe('Hi'); expect(fromHexText('4')).toBeNull();
    expect(urlEncode('a b&c')).toBe('a%20b%26c'); expect(urlDecode('a%20b+c')).toBe('a b c'); expect(urlDecode('%E0%A4%A')).toBeNull();
  });
  test('time', () => {
    const v = viewTime(0, 'UTC')!; expect(v.iso).toBe('1970-01-01T00:00:00.000Z'); expect(v.filetime).toBe('116444736000000000');
    expect(parseTime('1700000000')).toBe(1700000000000); expect(parseTime('1700000000000')).toBe(1700000000000);
    expect(parseTime('116444736000000000')).toBe(0); expect(parseTime('2026-09-01T10:00:00Z')).toBe(Date.UTC(2026, 8, 1, 10)); expect(parseTime('nonsense')).toBeNull();
  });
  test('mac', () => {
    expect(macFormats('00-1A-2B-3C-4D-5E')).toEqual(['00:1a:2b:3c:4d:5e', '00-1A-2B-3C-4D-5E', '001a.2b3c.4d5e', '001A2B3C4D5E']);
    expect(macFormats('00:1a:2b')).toBeNull();
  });
});
