import { describe, expect, test } from 'bun:test';
import { calcSubnet, classify, convertNumber, costPerPage, humanDuration, parsePrefix, prefixForHosts, sameSubnet, toInt, transferSeconds } from '../../src/lib/subnet';

describe('subnet', () => {
  test('/24 basics', () => {
    const s = calcSubnet('192.168.10.25/24') as any;
    expect(s.network).toBe('192.168.10.0'); expect(s.broadcast).toBe('192.168.10.255');
    expect(s.first).toBe('192.168.10.1'); expect(s.last).toBe('192.168.10.254'); expect(s.hosts).toBe(254);
    expect(s.mask).toBe('255.255.255.0'); expect(s.wildcard).toBe('0.0.0.255'); expect(s.kind).toBe('Private');
  });
  test('mask input, odd prefixes, /31 and /32', () => {
    const s = calcSubnet('10.1.2.200', '255.255.255.192') as any;
    expect(s.prefix).toBe(26); expect(s.network).toBe('10.1.2.192'); expect(s.hosts).toBe(62);
    expect((calcSubnet('10.0.0.1/31') as any).hosts).toBe(2);
    expect((calcSubnet('10.0.0.1/32') as any).hosts).toBe(1);
    expect((calcSubnet('10.0.0.1/0') as any).hosts).toBe(2 ** 32 - 2);
  });
  test('rejects bad input', () => {
    expect('error' in (calcSubnet('300.1.1.1/24') as any)).toBe(true);
    expect('error' in (calcSubnet('1.2.3.4/33') as any)).toBe(true);
    expect(parsePrefix('255.0.255.0')).toBeNull();
    expect(parsePrefix('/16')).toBe(16);
    expect(toInt('1.2.3')).toBeNull();
  });
  test('classify and same subnet', () => {
    expect(classify(toInt('169.254.4.4')!)).toContain('APIPA');
    expect(classify(toInt('127.0.0.1')!)).toContain('Loopback');
    expect(classify(toInt('172.20.0.1')!)).toBe('Private');
    expect(classify(toInt('172.32.0.1')!)).toBe('Public');
    expect(sameSubnet('192.168.1.5', '192.168.1.200', 24)).toBe(true);
    expect(sameSubnet('192.168.1.5', '192.168.2.5', 24)).toBe(false);
  });
  test('prefix for hosts', () => { expect(prefixForHosts(30)).toBe(27); expect(prefixForHosts(31)).toBe(26); expect(prefixForHosts(0)).toBeNull(); });
  test('converter', () => {
    expect(convertNumber('255')).toEqual({ dec: '255', hex: '0xFF', bin: '0b11111111' });
    expect((convertNumber('0xff') as any).dec).toBe('255');
    expect((convertNumber('0b101') as any).dec).toBe('5');
    expect('error' in (convertNumber('abc') as any)).toBe(true);
  });
  test('transfer time and cost', () => {
    expect(transferSeconds(1, 'GB', 100, 'Mbps')).toBeCloseTo(80, 5);
    expect(transferSeconds(0, 'GB', 100, 'Mbps')).toBeNull();
    expect(humanDuration(3725)).toBe('1 h 2 min');
    expect(costPerPage(80, 20000)).toBeCloseTo(0.004, 6);
    expect(costPerPage(80, 0)).toBeNull();
  });
});
